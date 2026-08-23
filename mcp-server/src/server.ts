import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "./convex-generated/api.js";
import { registerBagTools } from "./tools/bags.js";
import { registerCardTools } from "./tools/cards.js";
import { registerLearningTools } from "./tools/learning.js";
import { resultContent } from "./tools/result.js";
import { registerStatsTools } from "./tools/stats.js";
import { ENGLISH_PUNCH_VERSION } from "./version.js";

export const createEnglishPunchServer = (
  client: ConvexHttpClient,
  grantedScopes: readonly string[]
) => {
  const scopes = new Set(grantedScopes);
  const server = new McpServer(
    {
      name: "english-punch",
      version: ENGLISH_PUNCH_VERSION,
    },
    {
      instructions:
        "Identity comes only from OAuth. Confirm before deleting data or replacing a card, which resets its schedule. Reviews must follow get status, start, user attempt, reveal, then rate; never invent response duration.",
    }
  );

  if (scopes.has("profile:read")) {
    server.registerTool(
      "whoami",
      {
        title: "Get English Punch profile",
        description: "Return the authenticated English Punch user profile.",
        outputSchema: {
          user: z.object({
            id: z.string(),
            name: z.string().optional(),
            email: z.string().optional(),
          }),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const user = await client.query(api.auth.loggedInUser);
        if (!user) {
          return {
            content: [{ type: "text", text: "Not authenticated" }],
            isError: true,
          };
        }
        return resultContent({
          user: {
            id: user._id,
            ...(user.name ? { name: user.name } : {}),
            ...(user.email ? { email: user.email } : {}),
          },
        });
      }
    );
  }

  registerBagTools(server, client, scopes);
  registerCardTools(server, client, scopes);
  registerLearningTools(server, client, scopes);
  registerStatsTools(server, client, scopes);

  return server;
};
