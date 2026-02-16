import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { getUserId } from "../convex-client.js";

export function registerStatsTools(
  server: McpServer,
  client: ConvexHttpClient
) {
  server.registerTool(
    "get-review-history",
    {
      description:
        "Get recent review logs with card info, rating, and duration",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Max number of reviews to return (default 50)"),
      },
    },
    async ({ limit }) => {
      const result = await client.query(api.fsrs.getRecentReviewLogs, {
        userId: getUserId(),
        ...(limit ? { limit } : {}),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get-user-settings",
    {
      description: "Get FSRS parameters, daily limits, and streak data",
    },
    async () => {
      const result = await client.query(api.fsrs.getUserSettings, {
        userId: getUserId(),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
