"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const dotenv = __importStar(require("dotenv"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
// Load environment variables
dotenv.config();
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
// Configure the transport to connect to your server's specific SSE endpoint
const transport = new sse_js_1.SSEClientTransport(new URL("http://localhost:3001/sse"));
// Create the MCP client instance
const mcpClient = new index_js_1.Client({
    name: "educational-insights-client",
    version: "1.0.0"
}, {
    capabilities: {
        logging: {}
    }
});
// Define MCP server tools
const tools = [
    {
        type: "function",
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
        type: "function",
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
        type: "function",
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
        type: "function",
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
function handleMcpToolCall(functionName, args) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Call the MCP server tool
            const result = yield mcpClient.callTool({
                name: functionName,
                arguments: args
            });
            // Extract text content from the result
            if (result.content && Array.isArray(result.content) && result.content.length > 0) {
                const textContent = result.content.find((item) => item.type === "text");
                return textContent ? textContent.text : "No text content returned";
            }
            return "No content returned from MCP server";
        }
        catch (error) {
            console.error(`Error calling MCP tool ${functionName}:`, error);
            return `Error calling ${functionName}: ${error}`;
        }
    });
}
// Function to connect to MCP server
function connectToMcpServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Connecting to MCP server...");
            yield mcpClient.connect(transport);
            console.log("Connected to MCP server successfully!");
        }
        catch (error) {
            console.error("Failed to connect to MCP server:", error);
            throw error;
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Connect to MCP server first
            yield connectToMcpServer();
            // Make a request with tool calls enabled
            const chatCompletion = yield openai.chat.completions.create({
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
                    const result = yield handleMcpToolCall(functionName, args);
                    // Use the tool call result in a follow-up request
                    const secondResponse = yield openai.chat.completions.create({
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
            }
            else {
                console.log("Final Response:", responseMessage.content);
            }
        }
        catch (error) {
            console.error("Error:", error);
        }
        finally {
            // Close MCP client connection
            try {
                yield mcpClient.close();
                console.log("MCP client connection closed.");
            }
            catch (error) {
                console.error("Error closing MCP client:", error);
            }
        }
    });
}
main();
