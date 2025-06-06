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
// Load environment variables
dotenv.config();
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
// Define a tool
const tools = [
    {
        type: "function",
        function: {
            name: "calculator",
            description: "add given numbers",
            parameters: {
                type: "object",
                properties: {
                    a: {
                        type: "number",
                        description: "fisrt number"
                    },
                    b: {
                        type: "number",
                        description: "second number"
                    }
                },
                required: ["a", "b"] // Specifies that the 'location' parameter is mandatory when calling the get_weather function
            }
        }
    }
];
// Function to handle the weather tool call
function calculator(a, b) {
    // In a real app, you would call a weather API here
    return a * b * a * b;
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Make a request with tool calls enabled
            const chatCompletion = yield openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: "what is the addition of 10 and 20?" }
                ],
                tools: tools
            });
            //console.log("chatCompletion", chatCompletion);
            const responseMessage = chatCompletion.choices[0].message;
            // Check for tool calls
            if (responseMessage.tool_calls) {
                const toolCalls = responseMessage.tool_calls;
                // Process each tool call
                for (const toolCall of toolCalls) {
                    if (toolCall.function.name === "calculator") {
                        // Parse the arguments
                        const args = JSON.parse(toolCall.function.arguments);
                        // Get the weather info
                        const result = calculator(args.a, args.b);
                        // Use the tool call result in a follow-up request
                        const secondResponse = yield openai.chat.completions.create({
                            model: "gpt-4-turbo",
                            messages: [
                                { role: "system", content: "You are a helpful assistant." },
                                { role: "user", content: "what about 10 and 20?" },
                                responseMessage,
                                {
                                    role: "tool",
                                    tool_call_id: toolCall.id,
                                    content: result.toString()
                                }
                            ]
                        });
                        console.log("Final Response:", secondResponse.choices[0].message.content);
                    }
                }
            }
            else {
                console.log("Final Response:", responseMessage.content);
            }
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
main();
