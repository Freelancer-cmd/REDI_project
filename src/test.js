const fetch = require("node-fetch");
const fs = require("fs");

/**
 * Makes a POST request to the MCP server and handles the streaming response
 */
async function testMcpRequest() {
    const url = "http://localhost:3000/mcp";

    // Example MCP initialize request
    const initializeRequest = {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
            capabilities: {
                protocols: ["mcp-0.7.0"]
            }
        },
        id: 1
    };

    try {
        console.log("Sending MCP request:", JSON.stringify(initializeRequest, null, 2));

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(initializeRequest)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Check if there's a session ID in the response headers
        const sessionId = response.headers.get("mcp-session-id");
        console.log("Session ID:", sessionId);

        // Read and parse the response
        const responseData = await response.json();
        console.log("Response:", JSON.stringify(responseData, null, 2));

        // Save the response to a file
        fs.writeFileSync("mcp-response.json", JSON.stringify(responseData, null, 2));

        // If we have a session ID, let's make a tool call
        if (sessionId) {
            await makeToolCall(sessionId);
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

/**
 * Makes a tool call using the established session
 */
async function makeToolCall(sessionId) {
    const url = "http://localhost:3000/mcp";

    // Example tool call request
    const toolCallRequest = {
        jsonrpc: "2.0",
        method: "callTool",
        params: {
            name: "greet",
            parameters: {
                name: "MCP Test User"
            }
        },
        id: 2
    };

    try {
        console.log("Sending tool call request:", JSON.stringify(toolCallRequest, null, 2));

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "MCP-Session-ID": sessionId
            },
            body: JSON.stringify(toolCallRequest)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Read and parse the response
        const responseData = await response.json();
        console.log("Tool call response:", JSON.stringify(responseData, null, 2));

        // Save the tool call response to a file
        fs.writeFileSync("mcp-tool-response.json", JSON.stringify(responseData, null, 2));
    } catch (error) {
        console.error("Error during tool call:", error.message);
    }
}

// Execute the test
testMcpRequest()
    .then(() => {
        console.log("Test completed");
    })
    .catch((err) => {
        console.error("Test failed:", err);
    });
