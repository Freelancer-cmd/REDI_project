import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { CallToolResult, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";

// Create an MCP server with implementation details
const server = new McpServer(
    {
        name: "simple-streamable-http-server",
        version: "1.0.0"
    },
    { capabilities: { logging: {} } }
);

// Register a simple tool that returns a greeting
server.tool(
    "greet",
    "A simple greeting tool",
    {
        name: z.string().describe("Name to greet")
    },
    async ({ name }): Promise<CallToolResult> => {
        return {
            content: [
                {
                    type: "text",
                    text: `Hello, ${name}!`
                }
            ]
        };
    }
);

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post("/mcp", async (req: Request, res: Response) => {
    console.log("Received MCP request:", req.body);
    try {
        // Check for existing session ID
        let transport: StreamableHTTPServerTransport;

        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined
        });

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
                console.log(`Transport closed for session ${sid}, removing from transports map`);
                delete transports[sid];
            }
        };

        // Connect the transport to the MCP server BEFORE handling the request
        // so responses can flow back through the same transport
        await server.connect(transport);

        transport.onmessage = (message) => {
            fs.writeFileSync("test.json", JSON.stringify(message, null, 2));
        };

        isInitializeRequest(req.body);
        await transport.handleRequest(req, res);

        return; // Already handled
    } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: "Internal server error"
                },
                id: null
            });
        }
    }
});

// Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
    }

    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers["last-event-id"] as string | undefined;
    if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
        console.log(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
});

// Handle DELETE requests for session termination (according to MCP spec)
app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send("Invalid or missing session ID");
        return;
    }

    console.log(`Received session termination request for session ${sessionId}`);

    try {
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    } catch (error) {
        console.error("Error handling session termination:", error);
        if (!res.headersSent) {
            res.status(500).send("Error processing session termination");
        }
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
    console.log("Shutting down server...");

    // Close all active transports to properly clean up resources

    await server.close();
    console.log("Server shutdown complete");
    process.exit(0);
});
