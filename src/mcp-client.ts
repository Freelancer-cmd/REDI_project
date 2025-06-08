import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

interface MCPTool {
    name: string;
    description?: string;
    inputSchema: any;
}

interface OpenAITool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

export class MCPClient {
    private client!: Client;
    private transport!: StdioClientTransport;
    private openai: OpenAI;
    private tools: MCPTool[] = [];

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async connect() {
        console.log("🔌 Connecting to MCP server...");
        
        // Create transport that will spawn the MCP server process
        this.transport = new StdioClientTransport({
            command: "ts-node",
            args: ["src/mcp-server.ts"],
        });

        // Create and connect the client
        this.client = new Client({
            name: "educational-analytics-client",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {},
            },
        });

        await this.client.connect(this.transport);
        console.log("✅ Connected to MCP server");

        // Discover available tools
        await this.discoverTools();
    }

    private async discoverTools() {
        console.log("🔍 Discovering available tools...");
        
        try {
            const toolsResponse = await this.client.listTools();
            this.tools = toolsResponse.tools || [];
            
            console.log(`📋 Found ${this.tools.length} tools:`);
            this.tools.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
            });
        } catch (error) {
            console.error("❌ Failed to discover tools:", error);
            throw error;
        }
    }

    private convertMCPToolsToOpenAI(): OpenAITool[] {
        return this.tools.map(tool => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description || `Execute ${tool.name}`,
                parameters: this.convertZodSchemaToJsonSchema(tool.inputSchema),
            },
        }));
    }

    private convertZodSchemaToJsonSchema(zodSchema: any): any {
        // Convert Zod schema object to JSON Schema format
        if (!zodSchema) {
            return { type: "object", properties: {}, required: [] };
        }

        const properties: any = {};
        const required: string[] = [];

        // Extract properties from Zod schema
        Object.entries(zodSchema).forEach(([key, value]: [string, any]) => {
            if (value && typeof value === 'object' && value._def) {
                // This is a Zod type
                const zodType = value._def.typeName;
                
                switch (zodType) {
                    case 'ZodString':
                        properties[key] = {
                            type: "string",
                            description: value._def.description || `${key} parameter`,
                        };
                        if (!value.isOptional()) {
                            required.push(key);
                        }
                        break;
                    case 'ZodNumber':
                        properties[key] = {
                            type: "number",
                            description: value._def.description || `${key} parameter`,
                        };
                        if (value._def.defaultValue !== undefined) {
                            properties[key].default = value._def.defaultValue;
                        }
                        if (!value.isOptional()) {
                            required.push(key);
                        }
                        break;
                    case 'ZodEnum':
                        properties[key] = {
                            type: "string",
                            enum: value._def.values,
                            description: value._def.description || `${key} parameter`,
                        };
                        break;
                    case 'ZodOptional':
                        // Handle optional types
                        const innerType = value._def.innerType._def.typeName;
                        if (innerType === 'ZodEnum') {
                            properties[key] = {
                                type: "string",
                                enum: value._def.innerType._def.values,
                                description: value._def.description || `${key} parameter`,
                            };
                        }
                        break;
                    case 'ZodDefault':
                        // Handle default values
                        const defaultInnerType = value._def.innerType._def.typeName;
                        if (defaultInnerType === 'ZodNumber') {
                            properties[key] = {
                                type: "number",
                                description: value._def.description || `${key} parameter`,
                                default: value._def.defaultValue,
                            };
                        }
                        break;
                    default:
                        properties[key] = {
                            type: "string",
                            description: value._def.description || `${key} parameter`,
                        };
                }
            }
        });

        return {
            type: "object",
            properties,
            required,
        };
    }

    async callTool(name: string, args: any): Promise<any> {
        try {
            console.log(`🔧 Calling tool: ${name} with args:`, args);
            
            const response = await this.client.callTool({
                name,
                arguments: args,
            });

            console.log(`✅ Tool ${name} completed successfully`);
            return response;
        } catch (error) {
            console.error(`❌ Tool ${name} failed:`, error);
            throw error;
        }
    }

    async chat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
        try {
            const openaiTools = this.convertMCPToolsToOpenAI();
            
            console.log("💬 Sending request to OpenAI...");
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages,
                tools: openaiTools,
                tool_choice: "auto",
            });

            const message = response.choices[0]?.message;
            
            if (!message) {
                throw new Error("No response from OpenAI");
            }

            // Handle tool calls
            if (message.tool_calls && message.tool_calls.length > 0) {
                console.log(`🛠️  Processing ${message.tool_calls.length} tool call(s)...`);
                
                // Add assistant message with tool calls
                messages.push(message);
                
                // Execute each tool call
                for (const toolCall of message.tool_calls) {
                    try {
                        const toolResult = await this.callTool(
                            toolCall.function.name,
                            JSON.parse(toolCall.function.arguments)
                        );
                        
                        // Add tool result to messages
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(toolResult.content || toolResult),
                        });
                    } catch (error) {
                        console.error(`Tool call ${toolCall.function.name} failed:`, error);
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: `Error: ${errorMessage}`,
                        });
                    }
                }
                
                // Get final response after tool execution
                const finalResponse = await this.openai.chat.completions.create({
                    model: "gpt-4",
                    messages,
                });
                
                return finalResponse.choices[0]?.message?.content || "No response";
            }
            
            return message.content || "No response";
            
        } catch (error) {
            console.error("❌ Chat failed:", error);
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    async disconnect() {
        if (this.transport) {
            await this.transport.close();
            console.log("🔌 Disconnected from MCP server");
        }
    }
}