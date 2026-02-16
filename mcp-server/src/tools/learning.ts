import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { getUserId } from "../convex-client.js";
import { bagId, cardId, rating } from "./schema.js";

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
      inputSchema: { bagId },
    },
    async ({ bagId }) => {
      const result = await client.query(api.learning.getOneDueCard, {
        bagId,
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
      inputSchema: { bagId },
    },
    async ({ bagId }) => {
      const count = await client.query(api.learning.getDueCardCount, {
        bagId,
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
        cardId,
        rating,
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
        cardId,
        rating,
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
