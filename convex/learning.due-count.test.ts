// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const setupTest = () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  return t;
};

it("counts every due card instead of capping the result at 101", async () => {
  const t = setupTest();
  const { bagId, userId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const bagId = await ctx.db.insert("bags", {
      userId,
      name: "Large review bag",
      isActive: true,
      totalCards: 102,
      newCards: 102,
      learningCards: 0,
      reviewCards: 0,
      tags: [],
      lastModified: "2026-08-20T00:00:00.000Z",
    });

    for (let index = 0; index < 102; index += 1) {
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
        suspended: false,
      });
    }
    return { bagId, userId };
  });

  await t.mutation(internal.cardAggregate.backfillDueCards, { cursor: null });

  const count = await t
    .withIdentity({ subject: userId })
    .query(api.learning.getDueCardCount, { bagId, now: Date.now() });

  expect(count).toBe(102);
});
