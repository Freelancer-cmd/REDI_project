# Educational Analytics Demo with OpenAI Tools & MCP

A TypeScript project demonstrating how to build an interactive educational analytics assistant using OpenAI tool calling and the Model Context Protocol (MCP).

## Setup

1. Clone the repository and navigate into its directory:
   ```bash
   git clone <repo-url>
   cd openai-tools-and-mcp-examples
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root and set your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Running the Demos

### Interactive Educational Analytics Demo

This will automatically start the MCP server and launch an interactive prompt:

```bash
npm run client
```

Ask questions about student and school performance (type `quit` to exit).

### Predefined Examples

Run a series of predefined analytics queries:

```bash
npm run client-demo
```

### Advanced Usage

- **Run built client/server:**
  ```bash
  npm run server      # Build and run MCP server
  npm run client      # Build and run interactive client
  ```

## Evaluation

To automatically generate and evaluate prompt responses for each MCP tool:

```bash
# In one terminal, start the MCP server:
npm run server

# In another terminal, run the evaluation script:
npm run evaluate
```

This will:

1. Generate 50 diverse prompts per registered tool (valid, invalid, and incomplete questions).
2. Send each prompt to the MCP server via the client and record user–assistant conversations.
3. Use the Python `LLM_as_judge.py` script to assess responses with the LLM and save results to `evaluation/evaluations.json`.

## How It Works

### MCP Server (`src/mcp-server.ts`)

- Sets up the MCP server and registers analysis tools defined in `src/tools/`:
  - `analyze-student-performance`
  - `compare-domain-performance`
  - `identify-struggling-students`
  - `get-school-overview`
  - `get-exam-percentile`

### MCP Client (`src/mcp-client.ts`) & Example Conversation (`src/example-conversation.ts`)

- Discovers tools from the MCP server and converts them to OpenAI function definitions.
- Sends user queries to OpenAI, automatically executes any tool calls, and returns the final analysis.

The example conversation script provides both an interactive REPL and a predefined examples mode.

## Learning Resources

- [OpenAI Tools Documentation](https://platform.openai.com/docs/guides/function-calling)
- [Model Context Protocol (MCP) Documentation](https://github.com/microsoft/modelcontextprotocol)
