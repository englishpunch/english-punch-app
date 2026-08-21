// @vitest-environment node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ConvexHttpClient } from "convex/browser";
import { describe, expect, it, vi } from "vitest";
import { createEnglishPunchServer } from "./server";

describe("English Punch MCP tools", () => {
  it("describes question and answer as format-agnostic strings", async () => {
    const convexClient = {} as ConvexHttpClient;
    const server = createEnglishPunchServer(convexClient, ["cards:write"]);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();
    const createCard = tools.find((tool) => tool.name === "create-card");
    const updateCard = tools.find((tool) => tool.name === "update-card");

    expect(createCard).toMatchObject({
      description: "Create a vocabulary card from question and answer strings.",
      inputSchema: {
        properties: {
          question: { type: "string", description: "Question text" },
          answer: { type: "string", description: "Answer text" },
        },
      },
    });
    expect(updateCard).toMatchObject({
      inputSchema: {
        properties: {
          question: { type: "string", description: "Updated question text" },
          answer: { type: "string", description: "Updated answer text" },
        },
      },
    });

    await client.close();
    await server.close();
  });

  it("creates a card for the OAuth-authenticated user", async () => {
    const mutation = vi.fn().mockResolvedValue("card_456");
    const convexClient = { mutation } as unknown as ConvexHttpClient;
    const server = createEnglishPunchServer(convexClient, ["cards:write"]);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: "create-card",
      arguments: {
        bagId: "bag_123",
        question: "I need to ___ this OAuth flow.",
        answer: "verify",
      },
    });

    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      bagId: "bag_123",
      question: "I need to ___ this OAuth flow.",
      answer: "verify",
    });
    expect(result.structuredContent).toEqual({
      cardId: "card_456",
      answer: "verify",
      created: true,
    });

    await client.close();
    await server.close();
  });

  it("reports unsuccessful card writes instead of claiming success", async () => {
    const mutation = vi.fn().mockResolvedValue(false);
    const convexClient = { mutation } as unknown as ConvexHttpClient;
    const server = createEnglishPunchServer(convexClient, ["cards:write"]);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const updateResult = await client.callTool({
      name: "update-card",
      arguments: {
        cardId: "card_123",
        bagId: "bag_123",
        question: "This result must be ___.",
        answer: "accurate",
      },
    });
    const deleteResult = await client.callTool({
      name: "delete-card",
      arguments: { cardId: "card_123", bagId: "bag_123" },
    });

    expect(updateResult.structuredContent).toMatchObject({
      updated: false,
      scheduleReset: false,
    });
    expect(deleteResult.structuredContent).toMatchObject({ deleted: false });

    await client.close();
    await server.close();
  });
});
