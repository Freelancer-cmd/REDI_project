import { MCPClient } from "./mcp-client";
import * as readline from "readline";
import OpenAI from "openai";

async function runEducationalAnalyticsDemo() {
    const client = new MCPClient();
    
    try {
        // Connect to MCP server
        await client.connect();
        
        console.log("\n🎓 Educational Analytics Demo");
        console.log("=" .repeat(50));
        console.log("Ask questions about student and school performance!");
        console.log("Example queries:");
        console.log("- 'Analyze student performance for student_s1p1'");
        console.log("- 'Which students in school_1 are struggling in Domain B?'");
        console.log("- 'Give me an overview of school_1'");
        console.log("- 'Compare domain performance for school_1'");
        console.log("\nType 'quit' to exit\n");

        // Set up interactive conversation
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: `You are an educational data analyst assistant. You have access to powerful tools for analyzing student and school performance data.
When users ask questions about students or schools, use these tools to provide detailed, insightful analysis. Always be specific about the data you're analyzing and provide actionable insights.

Available student IDs in the dataset appear to follow patterns like 'student_s1p1', 'student_s1p2', etc.
Available school IDs appear to follow patterns like 'school_1', 'school_2', etc.

If a user asks for analysis but doesn't provide specific IDs, suggest they provide specific student or school IDs for more targeted analysis.`
            }
        ];

        const askQuestion = () => {
            rl.question("🤔 Ask about educational data: ", async (input) => {
                if (input.toLowerCase() === 'quit') {
                    rl.close();
                    await client.disconnect();
                    return;
                }

                if (input.trim() === '') {
                    askQuestion();
                    return;
                }

                try {
                    // Add user message
                    messages.push({ role: "user", content: input });
                    
                    console.log("\n🔍 Analyzing your request...");
                    
                    // Get response from LLM with tool calls
                    const response = await client.chat([...messages]);
                    
                    console.log("\n📊 Analysis Results:");
                    console.log("-".repeat(30));
                    console.log(response);
                    console.log("-".repeat(30));
                    
                    // Add assistant response to conversation history
                    messages.push({ role: "assistant", content: response });
                    
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("\n❌ Error:", errorMessage);
                }
                
                console.log(); // Add spacing
                askQuestion();
            });
        };

        askQuestion();

    } catch (error) {
        console.error("❌ Failed to start demo:", error);
        process.exit(1);
    }
}

async function runPredefinedExamples() {
    const client = new MCPClient();
    
    try {
        await client.connect();
        
        console.log("\n🎯 Running Predefined Educational Analytics Examples");
        console.log("=" .repeat(60));
        
        const examples = [
            {
                title: "Student Performance Analysis",
                query: "Analyze the performance of student_s1p1 across all domains"
            },
            {
                title: "School Domain Comparison", 
                query: "Compare domain performance for school_1"
            },
            {
                title: "Identify Struggling Students",
                query: "Find students in school_1 who are struggling in Domain B with threshold of 4"
            },
            {
                title: "School Overview",
                query: "Give me a comprehensive overview of school_1"
            }
        ];

        for (const example of examples) {
            console.log(`\n📋 ${example.title}`);
            console.log(`Query: "${example.query}"`);
            console.log("-".repeat(50));
            
            try {
                const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                    {
                        role: "system",
                        content: "You are an educational data analyst. Use the available tools to provide detailed analysis of student and school performance data."
                    },
                    {
                        role: "user", 
                        content: example.query
                    }
                ];
                
                const response = await client.chat(messages);
                console.log(response);
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`❌ Failed: ${errorMessage}`);
            }
            
            console.log("\n" + "=".repeat(60));
            
            // Wait a moment between examples
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
    } catch (error) {
        console.error("❌ Failed to run examples:", error);
    } finally {
        await client.disconnect();
    }
}

// Main execution
async function main() {
    const mode = process.argv[2];
    
    if (mode === 'examples') {
        await runPredefinedExamples();
    } else {
        await runEducationalAnalyticsDemo();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    process.exit(0);
});

main().catch(console.error);