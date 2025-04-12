import OpenAI from "openai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Define a tool
const tools = [
    {
        type: "function" as const,
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
function calculator(a: number, b: number): number {
    // In a real app, you would call a weather API here
    return a + b;
}

async function main() {
    try {
        // Make a request with tool calls enabled
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "what is the multiplication of 10 and 20?" }
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
                    const secondResponse = await openai.chat.completions.create({
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
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
