// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("sorts completed reviews first, ignores reveals, and preserves historical study", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const user = t.withIdentity({ subject: userId });
  const never = await user.mutation(api.learning.createBag, {
    name: "Never studied",
  });
  const older = await user.mutation(api.learning.createBag, { name: "Older" });
  const recent = await user.mutation(api.learning.createBag, {
    name: "Recent",
  });
  const historical = await user.mutation(api.learning.createBag, {
    name: "Historical",
  });
  const removed = await user.mutation(api.learning.createBag, {
    name: "Deleted",
  });
  const oldCard = await user.mutation(api.learning.createCard, {
    bagId: historical,
    question: "Q",
    answer: "A",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch("cards", oldCard, { last_review: 50 });
    await ctx.db.patch("bags", removed, { deletedAt: 1 });
    for (const [bagId, occurredAt, eventType] of [
      [older, 100, "review_rated"],
      [recent, 200, "review_rated"],
      [never, 300, "review_answer_revealed"],
      [removed, 400, "review_rated"],
    ] as const) {
      await ctx.db.insert("activities", {
        userId,
        bagId,
        occurredAt,
        eventType,
        localDate: "1970-01-01",
        timezone: "Asia/Seoul",
        source: "web",
        dedupeKey: `${bagId}-${occurredAt}`,
        schemaVersion: 1,
      });
    }
    const otherUser = await ctx.db.insert("users", {});
    await ctx.db.insert("bags", {
      userId: otherUser,
      name: "Private",
      tags: [],
      isActive: true,
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      lastModified: "",
    });
  });
  const rows = await user.query(api.learning.getStudyBags, { now: Date.now() });
  expect(rows.map((row) => row._id)).toEqual([
    recent,
    older,
    historical,
    never,
  ]);
  expect(rows.map((row) => row.lastReviewedAt)).toEqual([200, 100, 50, null]);
  await expect(
    t.query(api.learning.getStudyBags, { now: 0 })
  ).rejects.toThrow();
});

it("uses actual due counts and moves a bag to the top after a completed review", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const user = t.withIdentity({ subject: userId });
  const sample = await user.mutation(api.learning.createSampleBag, {});
  const bagId = await user.mutation(api.learning.createBag, { name: "Next" });
  const cardId = await user.mutation(api.learning.createCard, {
    bagId,
    question: "Q",
    answer: "A",
  });
  const suspended = await user.mutation(api.learning.createCard, {
    bagId,
    question: "Hidden",
    answer: "A",
  });
  await user.mutation(api.learning.setCardSuspended, {
    cardId: suspended,
    suspended: true,
  });
  const before = await user.query(api.learning.getStudyBags, {
    now: Date.now(),
  });
  expect(before.map((row) => row._id)).toEqual([sample, bagId]);
  expect(before[1].dueCount).toBe(1);
  await user.mutation(api.fsrs.reviewCard, {
    cardId,
    rating: 3,
    duration: 1000,
  });
  const after = await user.query(api.learning.getStudyBags, {
    now: Date.now(),
  });
  expect(after[0]._id).toBe(bagId);
  expect(after[0].lastReviewedAt).toBeGreaterThan(0);
  expect(after[0].dueCount).toBe(0);
});
