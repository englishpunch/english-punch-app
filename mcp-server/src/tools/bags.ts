import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { resultContent } from "./result.js";
import { bagId } from "./schema.js";

export function registerBagTools(
  server: McpServer,
  client: ConvexHttpClient,
  scopes: ReadonlySet<string>
) {
  if (scopes.has("bags:read")) {
    server.registerTool(
      "list-bags",
      {
        title: "List vocabulary bags",
        description:
          "List all vocabulary bags for the authenticated user with card counts and tags.",
        outputSchema: {
          bags: z.array(
            z.object({
              _id: z.string(),
              name: z.string(),
              description: z.string().optional(),
              totalCards: z.number(),
              newCards: z.number(),
              learningCards: z.number(),
              reviewCards: z.number(),
              tags: z.array(z.string()),
              isActive: z.boolean(),
            })
          ),
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const result = await client.query(api.learning.getUserBags, {});
        return resultContent({ bags: result });
      }
    );
  }

  if (scopes.has("bags:write")) {
    server.registerTool(
      "create-bag",
      {
        title: "Create vocabulary bag",
        description: "Create a vocabulary bag for the authenticated user.",
        inputSchema: { name: z.string().describe("Name of the bag") },
        outputSchema: {
          bagId: z.string(),
          name: z.string(),
          created: z.boolean(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ name }) => {
        const createdBagId = await client.mutation(api.learning.createBag, {
          name,
        });
        return resultContent({ bagId: createdBagId, name, created: true });
      }
    );
  }

  if (scopes.has("bags:write")) {
    server.registerTool(
      "delete-bag",
      {
        title: "Delete vocabulary bag",
        description:
          "Soft-delete a vocabulary bag and all of its cards. Confirm with the user before calling this tool.",
        inputSchema: { bagId },
        outputSchema: { bagId: z.string(), deleted: z.boolean() },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ bagId }) => {
        const deleted = await client.mutation(api.learning.deleteBag, {
          bagId,
        });
        return resultContent({ bagId, deleted });
      }
    );
  }

  if (scopes.has("bags:read")) {
    server.registerTool(
      "get-bag-stats",
      {
        title: "Get bag statistics",
        description:
          "Get detailed statistics for a vocabulary bag, including difficulty, stability, repetitions, and lapses.",
        inputSchema: { bagId },
        outputSchema: { bagId: z.string(), stats: z.unknown() },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ bagId }) => {
        const result = await client.query(api.learning.getBagDetailStats, {
          bagId,
        });
        return resultContent({ bagId, stats: result });
      }
    );
  }
}
