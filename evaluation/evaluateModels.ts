import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const MODELS = ["gpt-3.5-turbo", "gpt-4", "gpt-4o", "gpt-4.1", "gpt-4.1-nano", "o4-mini"];

async function main() {
  const promptsByTool: Record<string, string[]> = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "prompts.json"), "utf8")
  );
  const promptToTool: Record<string, string> = {};
  for (const tool of Object.keys(promptsByTool)) {
    for (const prompt of promptsByTool[tool]) {
      promptToTool[prompt] = tool;
    }
  }

  const openai = new OpenAI();
  const toolNames = Object.keys(promptsByTool).join(", ");
  const results: Record<string, Record<string, string>> = {};

  for (const model of MODELS) {
    console.log(`Evaluating model: ${model}`);
    results[model] = {};
    for (const prompt of Object.keys(promptToTool)) {
      const messages = [
        {
          role: "user",
          content: `Given the user query: "${prompt}", select the appropriate tool name from [${toolNames}]. Respond with only the tool name.`,
        },
      ];
      // @ts-ignore
      const response = await openai.chat.completions.create({ model, messages });
      // @ts-ignore
      results[model][prompt] = response.choices?.[0].message?.content.trim() ?? "";
    }
  }

  const outPath = path.resolve(__dirname, "model_tool_selection_results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Saved results to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});