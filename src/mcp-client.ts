import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Configure the transport to connect to your server's specific SSE endpoint
const transport = new SSEClientTransport(
    new URL("http://localhost:3001/sse") // Provide the full SSE endpoint URL
);

// Create the client instance
const client = new Client(
    {
        name: "example-calculator-client",
        version: "1.0.0"
    },
    {
        capabilities: {
            logging: {}
        }
    }
);

async function runClient() {
    try {
        // Connect to the server
        await connect();
        // await listResources();
        //   await listTools();
        await callAddTool();
    } catch (error) {
        console.error("\nClient error:", error);
    } finally {
        console.log("\nClient script finished.");
        await client.close();
    }
}

runClient();

async function connect() {
    console.log("Connecting to server...");
    await client.connect(transport);
    console.log("Connected successfully!");
}

async function listResources() {
    const resources = await client.listResources();
    console.log("Available resources:", JSON.stringify(resources, null, 2));
}

async function listTools() {
    const tools = await client.listTools();
    console.log("Available tools:", JSON.stringify(tools, null, 2));
}

async function callAddTool() {
    // Define the arguments for the 'add' tool
    const args = { a: 5, b: 3 };
    console.log(`\nCalling 'add' tool with arguments: ${JSON.stringify(args)}`);

    // Call the 'add' tool
    const result = await client.callTool({
        name: "add",
        arguments: args
    });

    // Print the result from the tool
    console.log("\nTool result:", JSON.stringify(result, null, 2));
}

// async function callResource() {
//     const resource = await client.subscribeResource({
//         name: "add1",
//         arguments: { a: 5, b: 3 }
//     });

//     console.log("\nResource result:", JSON.stringify(resource, null, 2));
// }
