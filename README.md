# OpenAI Tool Calls and MCP (Model Context Protocol) Examples

A TypeScript project demonstrating both OpenAI function calling capabilities and Model Context Protocol (MCP) implementation.

## Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure your OpenAI API key in the `.env` file:

```
OPENAI_API_KEY=your_api_key_here
```

## Running the Examples

### OpenAI Tool Calls Example

```bash
npm run dev
```

### MCP Server Example

```bash
ts-node src/mcp-server.ts
```

### MCP Client Example

```bash
ts-node src/mcp-client.ts
```

## How It Works

This project demonstrates:

### OpenAI Tool Calls

1. Setting up a simple calculator tool (function)
2. Sending a request to OpenAI with the tool definition
3. Handling the tool call response
4. Sending a follow-up request with the tool result

### Model Context Protocol (MCP)

1. Implementing an MCP server that exposes calculator tools
2. Creating an MCP client that connects to the server
3. Calling tools through the MCP protocol
4. Handling responses between client and server

The code is heavily commented to explain each step of the process.

## Learning Resources

-   [OpenAI Tools Documentation](https://platform.openai.com/docs/guides/function-calling)
-   [Model Context Protocol (MCP) Documentation](https://github.com/microsoft/modelcontextprotocol)
