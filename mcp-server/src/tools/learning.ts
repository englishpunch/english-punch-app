import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { resultContent } from "./result.js";
import { bagId, rating } from "./schema.js";

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const reviewWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function registerLearningTools(
  server: McpServer,
  client: ConvexHttpClient,
  scopes: ReadonlySet<string>
) {
  if (scopes.has("reviews:read")) {
    server.registerTool(
      "get-due-card-count",
      {
        title: "Get due card count",
        description:
          "Get the number of vocabulary cards currently due in one bag.",
        inputSchema: { bagId },
        outputSchema: { bagId: z.string(), dueCount: z.number().int() },
        annotations: readOnlyAnnotations,
      },
      async ({ bagId }) => {
        const dueCount = await client.query(api.learning.getDueCardCount, {
          bagId,
          now: Date.now(),
        });
        return resultContent({ bagId, dueCount });
      }
    );

    server.registerTool(
      "get-review-status",
      {
        title: "Get review status",
        description:
          "Get the authenticated user's current pending review so a review can resume across conversations.",
        outputSchema: { review: z.unknown() },
        annotations: readOnlyAnnotations,
      },
      async () => {
        const review = await client.query(
          api.review.getCurrentPendingReview,
          {}
        );
        return resultContent({ review });
      }
    );
  }

  if (scopes.has("reviews:write")) {
    server.registerTool(
      "start-review",
      {
        title: "Start vocabulary review",
        description:
          "Start the next due vocabulary review in a bag. Returns the question and hint without revealing the answer.",
        inputSchema: { bagId },
        outputSchema: { result: z.unknown() },
        annotations: reviewWriteAnnotations,
      },
      async ({ bagId }) => {
        const result = await client.mutation(api.review.startReview, {
          bagId,
        });
        return resultContent({ result });
      }
    );

    server.registerTool(
      "reveal-review",
      {
        title: "Reveal review answer",
        description:
          "Reveal the answer and explanation for the authenticated user's pending review. Call only after the user attempts an answer or asks to reveal it.",
        outputSchema: { result: z.unknown() },
        annotations: reviewWriteAnnotations,
      },
      async () => {
        const result = await client.mutation(api.review.revealReview, {});
        return resultContent({ result });
      }
    );

    server.registerTool(
      "rate-review",
      {
        title: "Rate vocabulary review",
        description:
          "Rate the revealed pending review: 1=Again, 2=Hard, 3=Good, 4=Easy. English Punch measures response time on the server.",
        inputSchema: { rating },
        outputSchema: { result: z.unknown() },
        annotations: reviewWriteAnnotations,
      },
      async ({ rating }) => {
        const result = await client.mutation(api.review.rateReview, {
          rating,
        });
        const structuredContent =
          result.ok === true
            ? {
                result: {
                  ...result,
                  stateLabel: STATE_LABELS[result.newState] ?? "Unknown",
                },
              }
            : { result };
        return resultContent(structuredContent);
      }
    );

    server.registerTool(
      "abort-review",
      {
        title: "Abort vocabulary review",
        description:
          "Abandon the authenticated user's pending review without changing its FSRS schedule.",
        outputSchema: { result: z.unknown() },
        annotations: {
          ...reviewWriteAnnotations,
          destructiveHint: true,
          idempotentHint: true,
        },
      },
      async () => {
        const result = await client.mutation(api.review.abandonReview, {});
        return resultContent({ result });
      }
    );
  }
}
