// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("uses the authenticated user even when a legacy user ID is supplied", async () => {
  const t = convexTest(schema, modules);
  const { authenticatedUserId, claimedUserId, claimedUserBagId } = await t.run(
    async (ctx) => {
      const authenticatedUserId = await ctx.db.insert("users", {});
      const claimedUserId = await ctx.db.insert("users", {});
      const claimedUserBagId = await ctx.db.insert("bags", {
        userId: claimedUserId,
        name: "Another user's bag",
        isActive: true,
        sortOrder: 0,
        totalCards: 0,
        newCards: 0,
        learningCards: 0,
        reviewCards: 0,
        tags: [],
        lastModified: "2026-08-20T00:00:00.000Z",
      });
      return { authenticatedUserId, claimedUserId, claimedUserBagId };
    }
  );

  await expect(
    t
      .withIdentity({ subject: authenticatedUserId })
      .mutation(api.learning.createCard, {
        userId: claimedUserId,
        bagId: claimedUserBagId,
        question: "This must be ___.",
        answer: "rejected",
      })
  ).rejects.toThrow("Bag not found");
});
