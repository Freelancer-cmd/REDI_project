import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const server = new McpServer({
    name: "calculator",
    version: "1.0.0",
    description: "A simple calculator tool",

    capabilities: {
        resources: {
            subscribe: true,
            listChanges: true
        },
        logging: {}
    }
});

// Add a tool for addition
server.registerTool(
    "add",
    {
        description: "Add two numbers",
        inputSchema: z.object({
            a: z.number().describe("First number to add"),
            b: z.number().describe("Second number to add")
        }).shape,
        outputSchema: z.object({
            sum: z.number().describe("The sum of the two numbers")
        }).shape
    },
    async ({ a, b }: { a: number; b: number }) => {
        const sum = a + b;
        return {
            content: [],
            structuredContent: {
                sum
            }
        };
    }
);

// server.tool(
//     "multiply",
//     {
//         a: z.number().describe("First number to multiply"),
//         b: z.number().describe("Second number to multiply")
//     },
//     async ({ a, b }: { a: number; b: number }) => {
//         const product = a * b;
//         return {
//             content: [
//                 {
//                     type: "text",
//                     text: `The product of ${a} and ${b} is ${product}`
//                 }
//             ]
//         };
//     }
// );

server.resource("report", "file:///home/upc6/Downloads/BABUBHAI-TANK.pdf", async (uri) => ({
    contents: [
        {
            uri: uri.href,
            text: "App configuration here"
        }
    ]
}));

const app = express();

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: { [sessionId: string]: SSEServerTransport } = {};

app.get("/sse", async (_: Request, res: Response) => {
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
        console.log(`Connection closed for session: ${transport.sessionId}`);
    });
    console.log(`New connection established for session: ${transport.sessionId}`);

    await server.connect(transport);
});

// Apply NO body parsing middleware to this route
app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (transport) {
        // Let handlePostMessage read the raw stream directly
        await transport.handlePostMessage(req, res);
    } else {
        console.error(`No transport found for sessionId: ${sessionId}`);
        res.status(400).send("No transport found for sessionId");
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Calculator SSE server listening on port ${PORT}`);
});
