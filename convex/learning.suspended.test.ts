// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const setupCard = async (suspended = false) => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const otherUserId = await ctx.db.insert("users", {});
    const bagId = await ctx.db.insert("bags", {
      userId,
      name: "Test bag",
      isActive: true,
      sortOrder: 0,
      totalCards: 1,
      newCards: 1,
      learningCards: 0,
      reviewCards: 0,
      tags: [],
      lastModified: "2026-08-18T00:00:00.000Z",
    });
    const cardId = await ctx.db.insert("cards", {
      userId,
      bagId,
      question: "A test ___?",
      answer: "card",
      due: 1_755_558_600_000,
      stability: 3,
      difficulty: 4,
      scheduled_days: 5,
      learning_steps: 0,
      reps: 2,
      lapses: 1,
      state: 2,
      last_review: 1_755_126_600_000,
      tags: [],
      suspended,
    });
    return { cardId, otherUserId, userId };
  });
  return { t, ...ids };
};

describe("setCardSuspended", () => {
  it("rejects an unauthenticated caller", async () => {
    const { cardId, t } = await setupCard();

    await expect(
      t.mutation(api.learning.setCardSuspended, {
        cardId,
        suspended: true,
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("lets the owner suspend and resume without resetting the schedule", async () => {
    const { cardId, t, userId } = await setupCard();
    const asOwner = t.withIdentity({ subject: userId });

    await asOwner.mutation(api.learning.setCardSuspended, {
      cardId,
      suspended: true,
    });
    await asOwner.mutation(api.learning.setCardSuspended, {
      cardId,
      suspended: false,
    });

    const card = await t.run((ctx) => ctx.db.get("cards", cardId));
    expect(card).toMatchObject({
      suspended: false,
      due: 1_755_558_600_000,
      stability: 3,
      difficulty: 4,
      scheduled_days: 5,
      reps: 2,
      lapses: 1,
      state: 2,
      last_review: 1_755_126_600_000,
    });
  });

  it("rejects a different authenticated user", async () => {
    const { cardId, otherUserId, t } = await setupCard();

    await expect(
      t
        .withIdentity({ subject: otherUserId })
        .mutation(api.learning.setCardSuspended, {
          cardId,
          suspended: true,
        })
    ).rejects.toThrow("Card not found");
  });
});
