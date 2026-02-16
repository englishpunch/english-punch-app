import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex-generated/api.js";
import type { Id } from "../convex-generated/dataModel.js";
import { getUserId } from "../convex-client.js";

export function registerCardTools(server: McpServer, client: ConvexHttpClient) {
  server.registerTool(
    "create-card",
    {
      description:
        "Create a flashcard in a bag. Question should have ___ blank, answer fills it.",
      inputSchema: {
        bagId: z.string().describe("ID of the bag"),
        question: z
          .string()
          .describe(
            'Sentence with ___ blank, e.g. "I\'d like to ___ a table for two"'
          ),
        answer: z
          .string()
          .describe('Word that fills the blank, e.g. "reserve"'),
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
      await client.mutation(api.learning.createCard, {
        bagId: bagId as Id<"bags">,
        userId: getUserId(),
        question,
        answer,
        hint,
        explanation,
        context,
        sourceWord,
        expression,
      });
      return {
        content: [{ type: "text", text: `Card created: "${answer}"` }],
      };
    }
  );

  server.registerTool(
    "create-cards-batch",
    {
      description: "Create multiple flashcards in a bag at once",
      inputSchema: {
        bagId: z.string().describe("ID of the bag"),
        cards: z
          .array(
            z.object({
              question: z.string().describe("Sentence with ___ blank"),
              answer: z.string().describe("Word that fills the blank"),
              hint: z.string().optional().describe("Clue under 12 words"),
              explanation: z
                .string()
                .optional()
                .describe("10-70 words explaining usage"),
              context: z.string().optional().describe("Additional context"),
              sourceWord: z.string().optional().describe("Source word"),
              expression: z.string().optional().describe("Expression"),
            })
          )
          .describe("Array of cards to create"),
      },
    },
    async ({ bagId, cards }) => {
      const result = await client.mutation(api.learning.createCardsBatch, {
        bagId: bagId as Id<"bags">,
        userId: getUserId(),
        cards,
      });
      return {
        content: [{ type: "text", text: `Created ${result.length} cards.` }],
      };
    }
  );

  server.registerTool(
    "get-card",
    {
      description: "Get full details of a specific card",
      inputSchema: {
        cardId: z.string().describe("ID of the card"),
        bagId: z.string().describe("ID of the bag containing the card"),
      },
    },
    async ({ cardId, bagId }) => {
      const result = await client.query(api.learning.getCard, {
        cardId: cardId as Id<"cards">,
        bagId: bagId as Id<"bags">,
        userId: getUserId(),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "list-cards",
    {
      description:
        "List cards in a bag with pagination (30 per page) and optional search",
      inputSchema: {
        bagId: z.string().describe("ID of the bag"),
        search: z
          .string()
          .optional()
          .describe("Search query to filter cards by answer"),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from previous response"),
      },
    },
    async ({ bagId, search, cursor }) => {
      const result = await client.query(api.learning.getBagCardsPaginated, {
        bagId: bagId as Id<"bags">,
        userId: getUserId(),
        paginationOpts: { numItems: 30, cursor: cursor ?? null },
        ...(search ? { search } : {}),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "update-card",
    {
      description:
        "Update a card's content (resets FSRS schedule to initial state)",
      inputSchema: {
        cardId: z.string().describe("ID of the card"),
        bagId: z.string().describe("ID of the bag containing the card"),
        question: z.string().describe("Updated sentence with ___ blank"),
        answer: z.string().describe("Updated answer word"),
        hint: z.string().optional().describe("Updated hint"),
        explanation: z.string().optional().describe("Updated explanation"),
        context: z.string().optional().describe("Updated context"),
        sourceWord: z.string().optional().describe("Updated source word"),
        expression: z.string().optional().describe("Updated expression"),
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
      await client.mutation(api.learning.updateCard, {
        cardId: cardId as Id<"cards">,
        bagId: bagId as Id<"bags">,
        question,
        answer,
        hint,
        explanation,
        context,
        sourceWord,
        expression,
      });
      return {
        content: [{ type: "text", text: `Card updated: "${answer}"` }],
      };
    }
  );

  server.registerTool(
    "delete-card",
    {
      description: "Delete a card from a bag (soft delete)",
      inputSchema: {
        cardId: z.string().describe("ID of the card"),
        bagId: z.string().describe("ID of the bag containing the card"),
      },
    },
    async ({ cardId, bagId }) => {
      await client.mutation(api.learning.deleteCard, {
        cardId: cardId as Id<"cards">,
        bagId: bagId as Id<"bags">,
      });
      return {
        content: [{ type: "text", text: "Card deleted successfully." }],
      };
    }
  );
}
