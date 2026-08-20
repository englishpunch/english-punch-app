import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import { resultContent } from "./result.js";
import { bagId, cardId } from "./schema.js";

export function registerCardTools(
  server: McpServer,
  client: ConvexHttpClient,
  scopes: ReadonlySet<string>
) {
  if (scopes.has("cards:write")) {
    server.registerTool(
      "create-card",
      {
        title: "Create vocabulary card",
        description:
          "Create a vocabulary card from question and answer strings.",
        outputSchema: {
          cardId: z.string(),
          answer: z.string(),
          created: z.boolean(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          bagId,
          question: z.string().describe("Question text"),
          answer: z.string().describe("Answer text"),
          hint: z
            .string()
            .optional()
            .describe('Clue under 12 words, e.g. "book in advance"'),
          explanation: z
            .string()
            .optional()
            .describe("10-70 words explaining usage and contrasting synonyms"),
          context: z.string().optional().describe("Additional context"),
          sourceWord: z.string().optional().describe("Source word"),
          expression: z.string().optional().describe("Expression"),
        },
      },
      async ({
        bagId,
        question,
        answer,
        hint,
        explanation,
        context,
        sourceWord,
        expression,
      }) => {
        const createdCardId = await client.mutation(api.learning.createCard, {
          bagId,
          question,
          answer,
          hint,
          explanation,
          context,
          sourceWord,
          expression,
        });
        return resultContent({
          cardId: createdCardId,
          answer,
          created: true,
        });
      }
    );
  }

  if (scopes.has("cards:read")) {
    server.registerTool(
      "get-card",
      {
        title: "Get vocabulary card",
        description: "Get the full details of one vocabulary card.",
        inputSchema: { cardId, bagId },
        outputSchema: { card: z.unknown() },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ cardId, bagId }) => {
        const result = await client.query(api.learning.getCard, {
          cardId,
          bagId,
        });
        return resultContent({ card: result });
      }
    );
  }

  if (scopes.has("cards:read")) {
    server.registerTool(
      "list-cards",
      {
        title: "List vocabulary cards",
        description:
          "List vocabulary cards in a bag with pagination and optional answer search.",
        inputSchema: {
          bagId,
          search: z
            .string()
            .optional()
            .describe("Search query to filter cards by answer"),
          cursor: z
            .string()
            .optional()
            .describe("Pagination cursor from previous response"),
        },
        outputSchema: { bagId: z.string(), result: z.unknown() },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ bagId, search, cursor }) => {
        const result = await client.query(api.learning.getBagCardsPaginated, {
          bagId,
          paginationOpts: { numItems: 30, cursor: cursor ?? null },
          ...(search ? { search } : {}),
        });
        return resultContent({ bagId, result });
      }
    );
  }

  if (scopes.has("cards:write")) {
    server.registerTool(
      "update-card",
      {
        title: "Replace vocabulary card",
        description:
          "Replace a card's content and reset its FSRS schedule. Confirm with the user because review progress will be reset.",
        inputSchema: {
          cardId,
          bagId,
          question: z.string().describe("Updated question text"),
          answer: z.string().describe("Updated answer text"),
          hint: z.string().optional().describe("Updated hint"),
          explanation: z.string().optional().describe("Updated explanation"),
          context: z.string().optional().describe("Updated context"),
          sourceWord: z.string().optional().describe("Updated source word"),
          expression: z.string().optional().describe("Updated expression"),
        },
        outputSchema: {
          cardId: z.string(),
          answer: z.string(),
          updated: z.boolean(),
          scheduleReset: z.boolean(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({
        cardId,
        bagId,
        question,
        answer,
        hint,
        explanation,
        context,
        sourceWord,
        expression,
      }) => {
        const updated = await client.mutation(
          api.learning.replaceCardContentAndResetSchedule,
          {
            cardId,
            bagId,
            question,
            answer,
            hint,
            explanation,
            context,
            sourceWord,
            expression,
          }
        );
        return resultContent({
          cardId,
          answer,
          updated,
          scheduleReset: updated,
        });
      }
    );
  }

  if (scopes.has("cards:write")) {
    server.registerTool(
      "delete-card",
      {
        title: "Delete vocabulary card",
        description:
          "Soft-delete a vocabulary card. Confirm with the user before calling this tool.",
        inputSchema: { cardId, bagId },
        outputSchema: {
          cardId: z.string(),
          bagId: z.string(),
          deleted: z.boolean(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ cardId, bagId }) => {
        const deleted = await client.mutation(api.learning.deleteCard, {
          cardId,
          bagId,
        });
        return resultContent({ cardId, bagId, deleted });
      }
    );
  }
}
