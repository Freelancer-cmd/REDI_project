import { MCPClient } from "./mcp-client";
import * as readline from "readline";
import OpenAI from "openai";
import fs from "fs";

function abbreviateIds(ids: string[], count: number = 5): string[] {
    if (ids.length <= count * 2) {
        return ids;
    }
    return [...ids.slice(0, count), ...ids.slice(-count)];
}

async function runEducationalAnalyticsDemo() {
    const client = new MCPClient();
    
    try {
        // Connect to MCP server
        await client.connect();

        // Load dataset to provide dynamic ID suggestions
        const data = JSON.parse(fs.readFileSync("data/resp_data.json", "utf8"));
        const allStudentIds = data.schools.flatMap((s: any) =>
            s.students.map((st: any) => st.id)
        );
        const allSchoolIds = data.schools.map((s: any) => s.id);
        const studentIds = abbreviateIds(allStudentIds);
        const schoolIds = abbreviateIds(allSchoolIds);

        console.log("\n🎓 Educational Analytics Demo");
        console.log("=".repeat(60));
        console.log("Ask questions about student and school performance!");
        console.log("You can use the following identifiers:");
        console.log(`- Student IDs: ${studentIds.join(", ")}`);
        console.log(`- School IDs: ${schoolIds.join(", ")}`);
        console.log("You can specify domains (case-insensitive): a, b, c");
        console.log("\nExample queries:");
        console.log("- 'Analyze the performance of student_s1p1 across all domains'");
        console.log(
            "- 'Find students in school_1 who are struggling in domain b with threshold of 4'"
        );
        console.log("- 'Give me an overview of school_1'");
        console.log("- 'Compare domain performance for school_1'");
        console.log("- 'What percentile did student_s1p1 achieve on exam 5?'");
        console.log("\nType 'quit' to exit\n");

        // Set up interactive conversation
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: `You are an educational data analyst assistant with access to tools for analyzing student and school performance data.
When users ask questions about students or schools, use these tools to provide detailed, actionable insights.

Available student IDs: ${studentIds.join(", ")}
Available school IDs: ${schoolIds.join(", ")}
Available domains (case-insensitive): a, b, c

If a user asks for analysis without specific IDs or domains, suggest they include these identifiers for more targeted results.`,
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
                query: "Find students in school_1 who are struggling in domain b with threshold of 4"
            },
            {
                title: "School Overview",
                query: "Give me a comprehensive overview of school_1"
            },
            {
                title: "Student Exam Percentile",
                query: "What percentile did student_s1p1 achieve on exam 5?"
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
                        content: `You are an educational data analyst assistant. When executing tools, retrieve performance data from the provided tools and present their output directly, without omitting any details or inventing data. Format the results clearly for the user.`
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