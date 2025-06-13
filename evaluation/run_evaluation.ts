import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
import OpenAI from "openai";
import { MCPClient } from "../src/mcp-client";

dotenv.config();

const argv = process.argv.slice(2);
const overwriteAll = argv.includes('--overwrite') || argv.includes('-f');
const overwritePrompts = overwriteAll || argv.includes('--overwrite-prompts');
const overwriteConversations = overwriteAll || overwritePrompts || argv.includes('--overwrite-conversations');
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: ts-node run_evaluation.ts [options]
Options:
  --overwrite, -f                Regenerate prompts.json and conversations.json
  --overwrite-prompts            Regenerate prompts.json only (also regenerates conversations)
  --overwrite-conversations      Regenerate conversations.json only
  -h, --help                     Show this help message`);
  process.exit(0);
}

/**
 * Options:
 *   --overwrite, -f                Regenerate prompts.json and conversations.json
 *   --overwrite-prompts            Regenerate prompts.json only
 *   --overwrite-conversations      Regenerate conversations.json only
 *   -h, --help                     Show help message
 */
/**
 * Evaluation harness:
 * 1. Generates 50 diverse prompts per MCP tool (valid, invalid, incomplete).
 * 2. Sends prompts to the MCP server via the MCPClient.
 * 3. Records user–assistant conversations to conversations.json.
 * 4. Invokes the Python LLM_as_judge.py script to evaluate responses.
 */

const PROMPTS_FILE = path.resolve(__dirname, "prompts.json");
const CONVERSATIONS_FILE = path.resolve(__dirname, "conversations.json");

// Import tool definitions and examples to guide prompt generation
import { AnalyzeStudentPerformanceTool } from "../src/tools/analyze-student-performance";
import { CompareDomainPerformanceTool } from "../src/tools/compare-domain-performance";
import { IdentifyStrugglingStudentsTool } from "../src/tools/identify-struggling-students";
import { GetSchoolOverviewTool } from "../src/tools/get-school-overview";
import { GetExamPercentileTool } from "../src/tools/get-exam-percentile";
import { PredictNextExamScoresTool } from "../src/tools/predict-next-exam-scores";

import {abbreviateIds} from "../src/utils/data";

/** Definitions for each tool and exemplar valid queries to seed prompt generation */
const TOOL_DEFINITIONS: Array<{
  tool: { name: string; description: string; inputSchema: Record<string, any> };
  examples: string[];
}> = [
  {
    tool: AnalyzeStudentPerformanceTool,
    examples: [
      "Analyze the performance of student_s1p1 across all domains"
    ],
  },
  {
    tool: CompareDomainPerformanceTool,
    examples: [
      "Compare domain performance for school_1"
    ],
  },
  {
    tool: IdentifyStrugglingStudentsTool,
    examples: [
      "Find students in school_1 who are struggling in domain b with threshold of 4"
    ],
  },
  {
    tool: GetSchoolOverviewTool,
    examples: [
      "Give me a comprehensive overview of school_1"
    ],
  },
  {
    tool: GetExamPercentileTool,
    examples: [
      "What percentile did student_s1p1 achieve on exam 5?"
    ],
  },
  {
    tool: PredictNextExamScoresTool,
    examples: [
      "Predict the next two exam scores for student_s1p1"
    ],
  },
];

// Load dataset to provide dynamic ID suggestions
const data = JSON.parse(fs.readFileSync("data/resp_data.json", "utf8"));
const allStudentIds = data.schools.flatMap((s: any) =>
    s.students.map((st: any) => st.id)
);
const allSchoolIds = data.schools.map((s: any) => s.id);
const studentIds = abbreviateIds(allStudentIds);
const schoolIds = abbreviateIds(allSchoolIds);

/**
 * Generate example prompts for a given tool by asking the LLM.
 */
async function generatePrompts(
  openai: OpenAI,
  tool: { name: string; description: string; inputSchema: Record<string, any> },
  examples: string[]
): Promise<string[]> {
  // Build descriptions for each input parameter from its zod .describe metadata
  const paramDescriptions = Object.entries(tool.inputSchema)
    .map(
      ([param, schema]) =>
        `- ${param}: ${(schema as any)._def.description || ""}`
    )
    .join("\n");
  const examplesList = examples.map((e) => `- "${e}"`).join("\n");
  const generationPrompt = `You are designing user queries for an MCP tool.
Tool name: "${tool.name}"
Description: ${tool.description}
Input parameters:
${paramDescriptions}

Example valid user queries:
${examplesList}

Generate 50 example user queries for this tool, including:
 - valid queries that conform to the parameter requirements,
 - invalid queries with missing or malformed parameters,
 - incomplete queries lacking required identifiers or unclear expressions.
Return only a JSON array of strings (no markdown, no code fences, and no comments).

Available student IDs (first 5, and last 5): ${studentIds.join(", ")}
Available school IDs (first 5, and last 5): ${schoolIds.join(", ")}
In general, assume 9999 schools, with each 10 students minimum. 
Available exam IDs: A value 1, 2, 3, ..., 8
Available domains (case-insensitive): a, b, c
`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: generationPrompt }],
  });
  const msg = response.choices[0].message;
  const content = msg && msg.content ? msg.content.trim() : "";
  // Strip Markdown code fences to ensure pure JSON outp
  const cleaned = content.replace(/```(?:json)?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: parse line-by-line, removing comments, array brackets, and quotes
    return cleaned
      .split(/\r?\n/)
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => line && line !== "[" && line !== "]")
      .map((line) => {
        const m = line.match(/^"(.+?)",?$/);
        return m ? m[1] : line;
      });
  }
}

async function main() {
  const openai = new OpenAI();

  // Phase 1: generate or load prompts
  let promptsByTool: Record<string, string[]> = {};
  if (!overwritePrompts && fs.existsSync(PROMPTS_FILE)) {
    promptsByTool = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
  } else {
    if (overwritePrompts && fs.existsSync(PROMPTS_FILE)) {
      console.log(`Overwriting existing prompts file: ${PROMPTS_FILE}`);
    }
    for (const { tool, examples } of TOOL_DEFINITIONS) {
      console.log(`Generating prompts for ${tool.name}...`);
      promptsByTool[tool.name] = await generatePrompts(openai, tool, examples);
    }
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify(promptsByTool, null, 2));
    console.log(`Saved prompts to ${PROMPTS_FILE}`);
  }

  // Phase 2: generate or load conversations
  if (!overwriteConversations && fs.existsSync(CONVERSATIONS_FILE)) {
    console.log(`Skipping conversations generation (use --overwrite-conversations to regenerate).`);
  } else {
    if (overwriteConversations && fs.existsSync(CONVERSATIONS_FILE)) {
      console.log(`Overwriting existing conversations file: ${CONVERSATIONS_FILE}`);
    }
    console.log("Connecting to MCP server...");
    const client = new MCPClient();
    await client.connect();


    const conversations: Array<{ conversation_id: string; messages: any[] }> = [];
    for (const {tool} of TOOL_DEFINITIONS) {
      const prompts = promptsByTool[tool.name] || [];
      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        console.log(`→ [${tool.name}] (${i + 1}/${prompts.length}): ${prompt}`);
        const messages = [
          {
            role: "system",
          content: `You are an educational data analyst assistant with access to tools for analyzing student and school performance data, and for predicting future exam scores.
When users ask questions about students, schools, or future performance predictions, use these tools to provide detailed, actionable insights.

Available student IDs (first 5, and last 5): ${studentIds.join(", ")}
Available school IDs (first 5, and last 5): ${schoolIds.join(", ")}
In general, assume 9999 schools, with each 10 students minimum. 
Available exam IDs: A value 1, 2, 3, ..., 8
Available domains (case-insensitive): a, b, c

If a user asks for analysis or predictions without specific IDs or domains, suggest they include these identifiers for more targeted results.`,
          },
          {role: "user", content: prompt},
        ];
        let assistantReply: string;
        try {
          assistantReply = await client.chat(messages as any);
        } catch (err: any) {
          assistantReply = `Error calling tool: ${err.message || String(err)}`;
        }
        conversations.push({
          conversation_id: `${tool.name}_${i + 1}`,
          messages: [
            {role: "user", content: prompt},
            {role: "assistant", content: assistantReply},
          ],
        });
      }
    }

    await client.disconnect();
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
    console.log(`Saved ${conversations.length} conversations to ${CONVERSATIONS_FILE}`);
  }
  // Phase 3: invoke the Python LLM-as-judge script
  console.log("Running LLM_as_judge.py...");
  execSync("python LLM_as_judge.py", { cwd: __dirname, stdio: "inherit" });
  console.log("Evaluation complete. See evaluations.json in the evaluation folder.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});