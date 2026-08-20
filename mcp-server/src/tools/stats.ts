import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { resultContent } from "./result.js";

export function registerStatsTools(
  server: McpServer,
  client: ConvexHttpClient,
  scopes: ReadonlySet<string>
) {
  if (scopes.has("reviews:read")) {
    server.registerTool(
      "get-review-history",
      {
        title: "Get review history",
        description:
          "Get recent vocabulary review logs with card information, rating, and server-measured duration.",
        inputSchema: {
          limit: z
            .number()
            .optional()
            .describe("Max number of reviews to return (default 50)"),
        },
        outputSchema: { reviews: z.array(z.unknown()) },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ limit }) => {
        const result = await client.query(api.fsrs.getRecentReviewLogs, {
          ...(limit ? { limit } : {}),
        });
        return resultContent({ reviews: result });
      }
    );
  }

  if (scopes.has("reviews:read")) {
    server.registerTool(
      "get-user-settings",
      {
        title: "Get review settings",
        description:
          "Get the authenticated user's FSRS parameters, daily limits, and streak data.",
        outputSchema: { settings: z.unknown() },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const result = await client.query(api.fsrs.getUserSettings, {});
        return resultContent({ settings: result });
      }
    );
  }
}
