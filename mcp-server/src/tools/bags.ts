import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { getUserId } from "../convex-client.js";
import { bagId } from "./schema.js";

export function registerBagTools(server: McpServer, client: ConvexHttpClient) {
  server.registerTool(
    "list-bags",
    {
      description:
        "List all bags for the current user with card counts and tags",
    },
    async () => {
      const result = await client.query(api.learning.getUserBags, {
        userId: getUserId(),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "create-bag",
    {
      description: "Create a new bag (collection of flashcards)",
      inputSchema: { name: z.string().describe("Name of the bag") },
    },
    async ({ name }) => {
      const bagId = await client.mutation(api.learning.createBag, {
        userId: getUserId(),
        name,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ bagId }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "delete-bag",
    {
      description: "Delete a bag and all its cards (soft delete)",
      inputSchema: { bagId },
    },
    async ({ bagId }) => {
      await client.mutation(api.learning.deleteBag, {
        bagId,
      });
      return {
        content: [{ type: "text", text: "Bag deleted successfully." }],
      };
    }
  );

  server.registerTool(
    "get-bag-stats",
    {
      description:
        "Get detailed statistics for a bag including difficulty/stability/reps/lapses distributions",
      inputSchema: { bagId },
    },
    async ({ bagId }) => {
      const result = await client.query(api.learning.getBagDetailStats, {
        userId: getUserId(),
        bagId,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
