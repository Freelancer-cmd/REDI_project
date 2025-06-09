import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
import OpenAI from "openai";
import { MCPClient } from "../src/mcp-client";
import { abbreviateIds } from "../src/utils/data";

dotenv.config();

const argv = process.argv.slice(2);
const overwrite = argv.includes("--overwrite") || argv.includes("-f");
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`Usage: ts-node run_dialog_evaluation.ts [options]
Options:
  --overwrite, -f        Regenerate dialog_conversations.json
  -h, --help             Show this help message
`);
  process.exit(0);
}

const DIALOG_FILE = path.resolve(__dirname, "dialog_conversations.json");

async function main() {
  if (!overwrite && fs.existsSync(DIALOG_FILE)) {
    console.log(
      `Skipping dialog generation (use --overwrite to regenerate): ${DIALOG_FILE}`
    );
  } else {
    if (overwrite && fs.existsSync(DIALOG_FILE)) {
      console.log(`Overwriting existing dialog file: ${DIALOG_FILE}`);
    }
    console.log("Connecting to MCP server for dialog simulation...");
    const client = new MCPClient();
    await client.connect();

    // Load and abbreviate IDs for context
    const raw = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../data/resp_data.json"), "utf8")
    );
    const allStudentIds: string[] = raw.schools.flatMap((s: any) =>
      s.students.map((st: any) => st.id)
    );
    const allSchoolIds: string[] = raw.schools.map((s: any) => s.id);
    const studentIds = abbreviateIds(allStudentIds);
    const schoolIds = abbreviateIds(allSchoolIds);
    
    // System prompt variants for answerer (assistant role)
    const SYSTEM_PROMPTS: string[] = [
      `You are an educational data analyst assistant with access to tools for analyzing student and school performance data, and for predicting future exam scores.
Available student IDs (first 5, and last 5): ${studentIds.join(", ")}
Available school IDs (first 5, and last 5): ${schoolIds.join(", ")}
In general, assume 9999 schools, with each 10 students minimum.
Available exam IDs: A value 1, 2, 3, ..., 8
Available domains (case-insensitive): a, b, c.
YOU CAN PROVIDE THIS DATA IN ORDER TO HELP THE QUESTIONING ALONG THE WAY.

If a user asks for analysis or predictions without specific IDs or domains, suggest they include these identifiers for more targeted results.`,
      `As an educational insights agent, you have access to powerful tools for analyzing academic performance and forecasting exam results.
Available student IDs (first 5, and last 5): ${studentIds.join(", ")}
Available school IDs (first 5, and last 5): ${schoolIds.join(", ")}
Encourage users to clarify queries by providing specific IDs or domains for accurate results. 
YOU CAN PROVIDE THIS DATA IN ORDER TO HELP THE QUESTIONING ALONG THE WAY.`,
      `As an educational insights agent, you have access to powerful tools for analyzing academic performance and forecasting exam results.
Encourage users to clarify queries by providing specific IDs or domains for accurate results.
YOU CAN PROVIDE THIS DATA IN ORDER TO HELP THE QUESTIONING ALONG THE WAY.`
    ];

    // System prompt for questioner (teacher role)
    const QUESTIONING_SYSTEM = `You are a teacher and an experienced AI tester. Your role is to evaluate an AI assistant designed for educational data analysis by simulating a challenging but realistic user.
Your primary task is to *ask questions* that progressively guide the assistant toward performing specific data analyses.
You DO NOT provide data yourself. Instead, your questions should elicit the necessary identifiers (like Student ID, School ID, Exam ID, or Domain) from the assistant, or prompt the assistant to ask for them.
Your goal is to test how effectively the assistant can pinpoint what information is needed for a query and then utilize its tools.
Begin by asking a general question about insights into schools or students. Based on the assistant's response, ask follow-up questions to narrow down the scope and gather any missing specific identifiers (e.g., "Which school are you interested in?", "Can you provide a student ID for that?", "What exam number are we looking at?", "Which domain (A, B, or C) should I focus on?").
Keep the conversation focused on obtaining specific analytical results. Do not offer solutions or external data; just ask clarifying and probing questions.`;

    const openai = new OpenAI();
    const dialogGroups: Array<{
      systemPrompt: string;
      conversations: Array<{ conversation_id: string; messages: any[] }>;
    }> = [];
    const CONVERSATIONS = 25;

    for (const systemPrompt of SYSTEM_PROMPTS) {
      const groupConversations: Array<{ conversation_id: string; messages: any[] }> = [];
      for (let i = 0; i < CONVERSATIONS; i++) {
        console.log(
          `Simulating dialog ${i + 1}/${CONVERSATIONS} [System prompt #${
            SYSTEM_PROMPTS.indexOf(systemPrompt) + 1
          }]`
        );
        const questionerHistory: any[] = [
          { role: "system", content: QUESTIONING_SYSTEM },
          { role: "user", content: "Please begin by asking the first question. Please provide the relevant data I need to answer questions about." },
        ];
        const dialogMessages: any[] = [];
        for (let turn = 0; turn < 10; turn++) {
          const qRes = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: questionerHistory,
          });
          const question = qRes.choices[0].message?.content?.trim() || "";
          dialogMessages.push({ role: "user", content: question });
          questionerHistory.push({ role: "assistant", content: question });
          console.log(`Question: ${question}`);
          const answerHistory = [
            { role: "system", content: systemPrompt },
            ...dialogMessages,
          ] as any;
          const answer = await client.chat(answerHistory);
          dialogMessages.push({ role: "assistant", content: answer });
          questionerHistory.push({ role: "user", content: answer });
          console.log(`Answer: ${answer}`);
        }

        groupConversations.push({
          conversation_id: `dialog_${i + 1}`,
          messages: dialogMessages,
        });
      }
      dialogGroups.push({ systemPrompt, conversations: groupConversations });
    }

    await client.disconnect();
    fs.writeFileSync(DIALOG_FILE, JSON.stringify(dialogGroups, null, 2));
    console.log(
      `Saved ${CONVERSATIONS} dialogs for each of ${SYSTEM_PROMPTS.length} system prompts to ${DIALOG_FILE}`
    );
  }

  // Invoke LLM judge on dialog conversations
  console.log("Running LLM_as_judge.py for dialog evaluation...");
  execSync(
    `python LLM_as_judge.py -i dialog_conversations.json -o dialog_evaluations.json`,
    { cwd: __dirname, stdio: "inherit" }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});