// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("soft-deletes a large bag's cards through scheduled bounded batches", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const { bagId, userId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const bagId = await ctx.db.insert("bags", {
      userId,
      name: "Large bag",
      isActive: true,
      sortOrder: 0,
      totalCards: 61,
      newCards: 61,
      learningCards: 0,
      reviewCards: 0,
      tags: [],
      lastModified: "2026-08-20T00:00:00.000Z",
    });

    for (let index = 0; index < 61; index += 1) {
      await ctx.db.insert("cards", {
        userId,
        bagId,
        question: `Question ${index}: ___`,
        answer: `answer-${index}`,
        due: 0,
        stability: 0,
        difficulty: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        tags: [],
        suspended: false,
      });
    }
    return { bagId, userId };
  });
  await t.mutation(internal.cardAggregate.backfillDueCards, { cursor: null });

  await t.withIdentity({ subject: userId }).mutation(api.learning.deleteBag, {
    bagId,
  });

  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }

  const result = await t.run(async (ctx) => {
    const bag = await ctx.db.get("bags", bagId);
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_bag", (q) => q.eq("bagId", bagId))
      .collect();
    return { bag, cards };
  });

  expect(result.bag?.deletedAt).toEqual(expect.any(Number));
  expect(result.cards).toHaveLength(61);
  expect(
    result.cards.every((card) => card.deletedAt === result.bag?.deletedAt)
  ).toBe(true);
});
