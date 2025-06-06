const fetch = require("node-fetch");
const fs = require("fs");
const EventSource = require("eventsource");

/**
 * Makes a POST request to the MCP server to initialize, then connects to SSE stream
 */
async function testMcpStreamingRequest() {
    const url = "http://localhost:3000/mcp";

    // Example MCP initialize request
    const initializeRequest = {
        jsonrpc: "2.0",
        method: "listTools",
        params: {},
        id: 1
    };

    try {
        console.log("Sending MCP initialization request...");

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

        // Get session ID from response headers
        const sessionId = response.headers.get("mcp-session-id");
        if (!sessionId) {
            throw new Error("No session ID received");
        }

        console.log("Session established with ID:", sessionId);

        // Parse the initial response
        const responseData = await response.json();
        console.log("Initialization response:", JSON.stringify(responseData, null, 2));

        // Now connect to the SSE endpoint to receive streaming updates
        connectToEventStream(sessionId);

        // After connecting to SSE, make a tool call that will trigger events
        setTimeout(() => makeToolCall(sessionId), 1000);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

/**
 * Connects to the Server-Sent Events stream using the established session ID
 */
function connectToEventStream(sessionId) {
    const sseUrl = `http://localhost:3000/mcp`;

    const eventSourceInitDict = {
        headers: {
            "MCP-Session-ID": sessionId
        }
    };

    console.log(`Connecting to SSE stream at ${sseUrl} with session ID ${sessionId}`);
    const eventSource = new EventSource(sseUrl, eventSourceInitDict);

    // Handle connection open
    eventSource.onopen = (event) => {
        console.log("SSE connection established");
    };

    // Handle connection error
    eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        eventSource.close();
    };

    // Handle incoming messages
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("Received SSE event:", JSON.stringify(data, null, 2));

            // Save each event to a file with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            fs.writeFileSync(`mcp-event-${timestamp}.json`, JSON.stringify(data, null, 2));

            // Check if this is a termination message
            if (data.method === "end" || (data.result && data.result.status === "complete")) {
                console.log("Stream completed, closing connection");
                eventSource.close();
            }
        } catch (error) {
            console.error("Error parsing SSE data:", error);
        }
    };

    // Listen for specific event types if the server sends them
    eventSource.addEventListener("tool", (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("Tool event received:", JSON.stringify(data, null, 2));
        } catch (error) {
            console.error("Error parsing tool event:", error);
        }
    });

    return eventSource;
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
                name: "Streaming MCP User"
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
    } catch (error) {
        console.error("Error during tool call:", error.message);
    }
}

/**
 * Terminates an MCP session
 */
async function terminateSession(sessionId) {
    const url = "http://localhost:3000/mcp";

    try {
        console.log(`Terminating session ${sessionId}...`);

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "MCP-Session-ID": sessionId
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        console.log(`Session ${sessionId} terminated successfully`);
    } catch (error) {
        console.error("Error terminating session:", error.message);
    }
}

// Setup proper termination
process.on("SIGINT", () => {
    console.log("Test interrupted, shutting down...");
    process.exit(0);
});

// Execute the test
testMcpStreamingRequest()
    .then(() => {
        console.log("Stream test initiated");
    })
    .catch((err) => {
        console.error("Test failed:", err);
    });
