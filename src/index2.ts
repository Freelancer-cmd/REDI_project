import OpenAI from "openai";
import * as dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Configure the transport to connect to your server's specific SSE endpoint
const transport = new SSEClientTransport(
    new URL("http://localhost:3001/sse")
);

// Create the MCP client instance
const mcpClient = new Client(
    {
        name: "educational-insights-client",
        version: "1.0.0"
    },
    {
        capabilities: {
            logging: {}
        }
    }
);

// Define MCP server tools
const tools = [
    {
        type: "function" as const,
        function: {
            name: "analyze-student-performance",
            description: "Analyze individual student performance across domains",
            parameters: {
                type: "object",
                properties: {
                    student_id: {
                        type: "string",
                        description: "ID of the student to analyze"
                    }
                },
                required: ["student_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "compare-domain-performance",
            description: "Compare performance across domains (a, b, c) for a specific school",
            parameters: {
                type: "object",
                properties: {
                    school_id: {
                        type: "string",
                        description: "Required school ID to analyze"
                    }
                },
                required: ["school_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "identify-struggling-students",
            description: "Identify students who are struggling in specific domains within a school",
            parameters: {
                type: "object",
                properties: {
                    school_id: {
                        type: "string",
                        description: "Required school ID to analyze"
                    },
                    domain: {
                        type: "string",
                        enum: ["a", "b", "c"],
                        description: "Specific domain to analyze"
                    },
                    threshold: {
                        type: "number",
                        description: "Minimum correct items threshold (out of 10)",
                        default: 5
                    }
                },
                required: ["school_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get-school-overview",
            description: "Get overview of a specific school and its performance",
            parameters: {
                type: "object",
                properties: {
                    school_id: {
                        type: "string",
                        description: "Required school ID to analyze"
                    }
                },
                required: ["school_id"]
            }
        }
    }
];

// Function to handle MCP tool calls
async function handleMcpToolCall(functionName: string, args: any): Promise<string> {
    try {
        // Call the MCP server tool
        const result = await mcpClient.callTool({
            name: functionName,
            arguments: args
        });

        // Extract text content from the result
        if (result.content && Array.isArray(result.content) && result.content.length > 0) {
            const textContent = result.content.find((item: any) => item.type === "text");
            return textContent ? textContent.text : "No text content returned";
        }
        
        return "No content returned from MCP server";
    } catch (error) {
        console.error(`Error calling MCP tool ${functionName}:`, error);
        return `Error calling ${functionName}: ${error}`;
    }
}

// Function to connect to MCP server
async function connectToMcpServer() {
    try {
        console.log("Connecting to MCP server...");
        await mcpClient.connect(transport);
        console.log("Connected to MCP server successfully!");
    } catch (error) {
        console.error("Failed to connect to MCP server:", error);
        throw error;
    }
}

async function main() {
    try {
        // Connect to MCP server first
        await connectToMcpServer();

        // Make a request with tool calls enabled
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are a helpful educational data analysis assistant. You can analyze student performance, compare domain performance, identify struggling students, and provide school overviews." },
                { role: "user", content: "Can you analyze the performance of student S001?" }
            ],
            tools: tools
        });

        const responseMessage = chatCompletion.choices[0].message;

        // Check for tool calls
        if (responseMessage.tool_calls) {
            const toolCalls = responseMessage.tool_calls;

            // Process each tool call
            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);

                // Handle the MCP tool call
                const result = await handleMcpToolCall(functionName, args);

                // Use the tool call result in a follow-up request
                const secondResponse = await openai.chat.completions.create({
                    model: "gpt-4-turbo",
                    messages: [
                        { role: "system", content: "You are a helpful educational data analysis assistant." },
                        { role: "user", content: "Can you analyze the performance of student S001?" },
                        responseMessage,
                        {
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: result
                        }
                    ]
                });

                console.log("Final Response:", secondResponse.choices[0].message.content);
            }
        } else {
            console.log("Final Response:", responseMessage.content);
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        // Close MCP client connection
        try {
            await mcpClient.close();
            console.log("MCP client connection closed.");
        } catch (error) {
            console.error("Error closing MCP client:", error);
        }
    }
}

main();