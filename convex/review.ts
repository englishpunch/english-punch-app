import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { reviewCardHandler } from "./fsrs";

/**
 * Server-side pending-review concept for the stateless CLI review
 * flow. Split the interactive review loop into three composable
 * mutations — each is one Convex round-trip and the CLI never
 * tracks per-attempt state locally.
 *
 * Data model: `pendingReviews` in convex/fsrsSchema.ts holds at most
 * one row per user. Existence = "in progress", `revealTime` presence
 * = "answer shown". Row is deleted on rateReview/abandonReview.
 *
 * Design doc: thoughts/plans/2026-04-11-server-side-review-attempt.md
 */

const STALE_PENDING_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Start a new review attempt for the given bag.
 *
 * - If a fresh pending row already exists, returns a discriminated
 *   failure `{ ok: false, token: "REVIEW_ALREADY_PENDING", cardId }`.
 * - If an existing row is stale (> 30 min), it is auto-abandoned and
 *   a new one is created.
 * - If no card is due in the bag, returns
 *   `{ ok: false, token: "NO_CARD_AVAILABLE" }`.
 * - On success, returns `{ ok: true, cardId, bagId, question, hint? }`
 *   — intentionally WITHOUT the answer or explanation.
 */
export const startReview = mutation({
  args: {
    userId: v.id("users"),
    bagId: v.id("bags"),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      cardId: v.id("cards"),
      bagId: v.id("bags"),
      question: v.string(),
      hint: v.optional(v.string()),
    }),
    v.object({
      ok: v.literal(false),
      token: v.literal("REVIEW_ALREADY_PENDING"),
      cardId: v.id("cards"),
    }),
    v.object({
      ok: v.literal(false),
      token: v.literal("NO_CARD_AVAILABLE"),
    }),
    v.object({
      ok: v.literal(false),
      token: v.literal("BAG_NOT_FOUND"),
    })
  ),
  handler: async (ctx, args) => {
    const bag = await ctx.db.get("bags", args.bagId);
    if (!bag || bag.userId !== args.userId || bag.deletedAt !== undefined) {
      return { ok: false as const, token: "BAG_NOT_FOUND" as const };
    }

    const existing = await ctx.db
      .query("pendingReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const now = Date.now();

    if (existing) {
      if (now - existing.startTime > STALE_PENDING_MS) {
        await ctx.db.delete("pendingReviews", existing._id);
      } else {
        return {
          ok: false as const,
          token: "REVIEW_ALREADY_PENDING" as const,
          cardId: existing.cardId,
        };
      }
    }

    const dueCards = await ctx.db
      .query("cards")
      .withIndex("by_user_and_due", (q) =>
        q.eq("userId", args.userId).lte("due", now)
      )
      .filter((q) => q.eq(q.field("bagId"), args.bagId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("suspended"), false))
      .order("asc")
      .take(1);

    const card = dueCards[0];
    if (!card) {
      return { ok: false as const, token: "NO_CARD_AVAILABLE" as const };
    }

    await ctx.db.insert("pendingReviews", {
      userId: args.userId,
      cardId: card._id,
      bagId: args.bagId,
      startTime: now,
    });

    return {
      ok: true as const,
      cardId: card._id,
      bagId: args.bagId,
      question: card.question,
      hint: card.hint,
    };
  },
});

/**
 * Reveal the answer for the current pending review.
 *
 * Idempotent — calling reveal twice returns the same answer fields
 * and does not advance any state beyond the first invocation.
 */
export const revealReview = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      cardId: v.id("cards"),
      question: v.string(),
      hint: v.optional(v.string()),
      answer: v.string(),
      explanation: v.optional(v.string()),
      context: v.optional(v.string()),
    }),
    v.object({
      ok: v.literal(false),
      token: v.literal("NO_PENDING_REVIEW"),
    })
  ),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!pending) {
      return { ok: false as const, token: "NO_PENDING_REVIEW" as const };
    }

    const card = await ctx.db.get("cards", pending.cardId);
    if (!card || card.deletedAt !== undefined) {
      // Card was deleted out from under the pending row — clean up.
      await ctx.db.delete("pendingReviews", pending._id);
      return { ok: false as const, token: "NO_PENDING_REVIEW" as const };
    }

    if (pending.revealTime === undefined) {
      await ctx.db.patch("pendingReviews", pending._id, {
        revealTime: Date.now(),
      });
    }

    return {
      ok: true as const,
      cardId: card._id,
      question: card.question,
      hint: card.hint,
      answer: card.answer,
      explanation: card.explanation,
      context: card.context,
    };
  },
});

/**
 * Rate the current pending review (1=Again, 2=Hard, 3=Good, 4=Easy),
 * delegate to the canonical `reviewCardHandler` for FSRS math and
 * `reviewLogs` insertion, then delete the pending row.
 *
 * Rejects with `REVIEW_NOT_REVEALED` if the caller hasn't run
 * `revealReview` yet — the CLI flow is strictly start → reveal → rate.
 */
export const rateReview = mutation({
  args: {
    userId: v.id("users"),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      nextReviewDate: v.string(),
      nextReviewTimestamp: v.number(),
      newState: v.number(),
      dueCount: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      token: v.literal("NO_PENDING_REVIEW"),
    }),
    v.object({
      ok: v.literal(false),
      token: v.literal("REVIEW_NOT_REVEALED"),
    })
  ),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!pending) {
      return { ok: false as const, token: "NO_PENDING_REVIEW" as const };
    }

    if (pending.revealTime === undefined) {
      return { ok: false as const, token: "REVIEW_NOT_REVEALED" as const };
    }

    const now = Date.now();
    const duration = now - pending.startTime;

    const fsrsResult = await reviewCardHandler(ctx, {
      userId: args.userId,
      cardId: pending.cardId,
      rating: args.rating,
      duration,
      sessionId: pending._id,
    });

    await ctx.db.delete("pendingReviews", pending._id);

    const remaining = await ctx.db
      .query("cards")
      .withIndex("by_user_and_due", (q) =>
        q.eq("userId", args.userId).lte("due", now)
      )
      .filter((q) => q.eq(q.field("bagId"), pending.bagId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("suspended"), false))
      .take(101);

    return {
      ok: true as const,
      nextReviewDate: fsrsResult.nextReviewDate,
      nextReviewTimestamp: fsrsResult.nextReviewTimestamp,
      newState: fsrsResult.newState,
      dueCount: remaining.length,
    };
  },
});

/**
 * Abandon the user's pending review without recording any FSRS
 * state change. Idempotent — returns `{ ok: true, existed: false }`
 * if there was nothing to abandon.
 */
export const abandonReview = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    ok: v.literal(true),
    existed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!pending) {
      return { ok: true as const, existed: false };
    }

    await ctx.db.delete("pendingReviews", pending._id);
    return { ok: true as const, existed: true };
  },
});

/**
 * Inspect the user's current pending review, if any. Used by
 * `ep review status` and by any caller that wants to resume a
 * partially-driven flow across terminals/devices.
 */
export const getCurrentPendingReview = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      cardId: v.id("cards"),
      bagId: v.id("bags"),
      startTime: v.number(),
      revealTime: v.optional(v.number()),
      question: v.string(),
      hint: v.optional(v.string()),
      revealed: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!pending) {
      return null;
    }

    const card = await ctx.db.get("cards", pending.cardId);
    if (!card || card.deletedAt !== undefined) {
      return null;
    }

    return {
      cardId: pending.cardId,
      bagId: pending.bagId,
      startTime: pending.startTime,
      revealTime: pending.revealTime,
      question: card.question,
      hint: card.hint,
      revealed: pending.revealTime !== undefined,
    };
  },
});
