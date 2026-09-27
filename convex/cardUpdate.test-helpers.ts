/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

export async function setupReviewedCard(
  state: 0 | 1 | 2 | 3 = 2,
  suspended = false
) {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const bagId = await ctx.db.insert("bags", {
      userId,
      name: "Preservation test",
      isActive: true,
      totalCards: 1,
      newCards: state === 0 ? 1 : 0,
      learningCards: state === 1 ? 1 : 0,
      reviewCards: state === 2 ? 1 : 0,
      tags: [],
      lastModified: "2026-09-01T00:00:00.000Z",
    });
    const cardId = await ctx.db.insert("cards", {
      userId,
      bagId,
      question: "She felt ___ after the rejection.",
      answer: "disheartened",
      hint: "discouraged",
      explanation: "Use when someone loses hope.",
      sourceWord: "dishearten",
      expression: "disheartened",
      due: 1_800_000_000_000,
      stability: 12,
      difficulty: 6,
      elapsed_days: 14,
      scheduled_days: 20,
      learning_steps: 1,
      reps: 8,
      lapses: 2,
      state,
      last_review: 1_790_000_000_000,
      suspended,
    });
    await ctx.db.insert("reviewLogs", {
      userId,
      cardId,
      rating: 3,
      state: 2,
      due: 1_790_000_000_000,
      stability: 10,
      difficulty: 6,
      scheduled_days: 14,
      learning_steps: 0,
      review: 1_790_000_000_000,
      elapsed_days: 14,
      duration: 2300,
      reviewType: "scheduled",
    });
    return { userId, bagId, cardId };
  });
  const read = () =>
    t.run(async (ctx) => ({
      card: (await ctx.db.get("cards", ids.cardId))!,
      bag: (await ctx.db.get("bags", ids.bagId))!,
      history: await ctx.db
        .query("reviewLogs")
        .withIndex("by_card", (q) => q.eq("cardId", ids.cardId))
        .collect(),
    }));
  return { t, owner: t.withIdentity({ subject: ids.userId }), ...ids, read };
}
