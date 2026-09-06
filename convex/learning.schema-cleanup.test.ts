// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("creates a studyable card without retired metadata while preserving content", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const asUser = t.withIdentity({ subject: userId });
  const bagId = await asUser.mutation(api.learning.createBag, {
    name: "My vocabulary",
  });
  const cardId = await asUser.mutation(api.learning.createCard, {
    bagId,
    question: "A general question",
    answer: "A general answer",
    sourceWord: "book",
    expression: "reserve a table",
  });

  const card = await asUser.query(api.learning.getOneDueCard, { bagId });

  expect(card).toMatchObject({
    _id: cardId,
    question: "A general question",
    answer: "A general answer",
    sourceWord: "book",
    expression: "reserve a table",
    state: 0,
    suspended: false,
  });
  expect(card).not.toHaveProperty("tags");
  expect(card).not.toHaveProperty("source");
});

it("preserves starter bags, settings, and review history after cleanup", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const asUser = t.withIdentity({ subject: userId });
  const bagId = await asUser.mutation(api.learning.createSampleBag, {});

  const bags = await asUser.query(api.learning.getUserBags, {});
  expect(bags).toEqual([
    expect.objectContaining({
      _id: bagId,
      tags: ["basic", "daily conversation"],
      isActive: true,
    }),
  ]);
  const settings = await asUser.query(api.fsrs.getUserSettings, {});
  expect(settings).toMatchObject({
    dailyNewCards: 20,
    dailyReviewCards: 200,
    totalReviews: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const card = await asUser.query(api.learning.getOneDueCard, { bagId });
  expect(card).not.toHaveProperty("tags");
  expect(card).not.toHaveProperty("source");
  if (typeof card === "string") {
    throw new Error("Expected a starter card");
  }
  await asUser.mutation(api.fsrs.reviewCard, {
    cardId: card._id,
    rating: 3,
    duration: 1000,
  });
  const history = await asUser.query(api.fsrs.getRecentReviewLogs, {});
  expect(history).toEqual([
    expect.objectContaining({ cardId: card._id, rating: 3, duration: 1000 }),
  ]);
});

it("does not declare retired learning tables or fields", () => {
  for (const table of ["dailyStats", "cardTemplates", "sessions"]) {
    expect(schema.tables).not.toHaveProperty(table);
  }
  expect(schema.tables.userSettings.validator.fields).not.toHaveProperty(
    "lastReviewDate"
  );
  expect(schema.tables.bags.validator.fields).not.toHaveProperty("sortOrder");
  expect(schema.tables.cards.validator.fields).not.toHaveProperty("tags");
  expect(schema.tables.cards.validator.fields).not.toHaveProperty("source");
});
