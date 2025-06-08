import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import tool definitions
import { AnalyzeStudentPerformanceTool } from "./tools/analyze-student-performance";
import { CompareDomainPerformanceTool } from "./tools/compare-domain-performance";
import { IdentifyStrugglingStudentsTool } from "./tools/identify-struggling-students";
import { GetSchoolOverviewTool } from "./tools/get-school-overview";
import { GetExamPercentileTool } from "./tools/get-exam-percentile";
import { PredictNextExamScoresTool } from "./tools/predict-next-exam-scores";

/**
 * Main MCP server configuration.
 *
 * Sets up the server and registers analysis tools defined in `src/tools`.
 */
const server = new McpServer({
  name: "educational-insights",
  version: "1.0.0",
  description: "Educational data analysis and insights server",
  capabilities: {
    resources: { subscribe: true, listChanges: true },
    logging: {}
  }
});

// Register all tools with the server
[
  AnalyzeStudentPerformanceTool,
  CompareDomainPerformanceTool,
  IdentifyStrugglingStudentsTool,
  GetSchoolOverviewTool,
  GetExamPercentileTool,
  PredictNextExamScoresTool
].forEach((tool) => {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.inputSchema },
    tool.run as any
  );
});

/**
 * Entry point: connects transport and starts the MCP server.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP Server is running.");
}

main().catch(console.error);