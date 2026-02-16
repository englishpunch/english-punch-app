import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import type { Id } from "../convex-generated/dataModel.js";
import { getUserId } from "../convex-client.js";

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

export function registerLearningTools(
  server: McpServer,
  client: ConvexHttpClient
) {
  server.registerTool(
    "get-due-card",
    {
      description: "Get the next due card for review in a bag",
      inputSchema: { bagId: z.string().describe("ID of the bag") },
    },
    async ({ bagId }) => {
      const result = await client.query(api.learning.getOneDueCard, {
        bagId: bagId as Id<"bags">,
      });
      if (result === "NO_CARD_AVAILABLE") {
        return { content: [{ type: "text", text: "NO_CARD_AVAILABLE" }] };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get-due-card-count",
    {
      description: "Get the number of cards due for review in a bag",
      inputSchema: { bagId: z.string().describe("ID of the bag") },
    },
    async ({ bagId }) => {
      const count = await client.query(api.learning.getDueCardCount, {
        bagId: bagId as Id<"bags">,
      });
      return { content: [{ type: "text", text: String(count) }] };
    }
  );

  server.registerTool(
    "review-card",
    {
      description:
        "Submit a review rating for a card. Rating: 1=Again, 2=Hard, 3=Good, 4=Easy",
      inputSchema: {
        cardId: z.string().describe("ID of the card to review"),
        rating: z
          .number()
          .int()
          .min(1)
          .max(4)
          .describe("1=Again, 2=Hard, 3=Good, 4=Easy"),
        duration: z.number().describe("Response time in milliseconds"),
        sessionId: z
          .string()
          .optional()
          .describe("Optional session ID for grouping reviews"),
      },
    },
    async ({ cardId, rating, duration, sessionId }) => {
      const result = await client.mutation(api.fsrs.reviewCard, {
        userId: getUserId(),
        cardId: cardId as Id<"cards">,
        rating: rating as 1 | 2 | 3 | 4,
        duration,
        ...(sessionId ? { sessionId } : {}),
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...result,
                stateLabel: STATE_LABELS[result.newState] ?? "Unknown",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
