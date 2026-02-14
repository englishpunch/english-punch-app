import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "./convex-client.js";

const server = new McpServer({
  name: "english-punch",
  version: "0.1.0",
});

// Authenticate and validate env vars on startup (will throw if missing)
const client = await getConvexClient();

server.registerTool(
  "whoami",
  { description: "Health check — returns the authenticated user info" },
  async () => {
    const user = await client.query(api.auth.loggedInUser);
    if (!user) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }] };
  }
);

// Tools, prompts, and resources will be registered here in Phases 4-5:
// registerBagTools(server, client);
// registerCardTools(server, client);
// registerLearningTools(server, client);
// registerStatsTools(server, client);
// registerCardGenerationPrompts(server);
// registerSchemaResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
