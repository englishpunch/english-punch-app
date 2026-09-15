import { Migrations } from "@convex-dev/migrations";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { countActivityOnce } from "./activityDailyCounts";

const migrations = new Migrations<DataModel>(components.migrations);
const countsValidator = v.object({
  questionSeenCount: v.number(),
  revealCount: v.number(),
  ratedCount: v.number(),
});
type Counts = {
  questionSeenCount: number;
  revealCount: number;
  ratedCount: number;
};
const emptyCounts = (): Counts => ({
  questionSeenCount: 0,
  revealCount: 0,
  ratedCount: 0,
});

export const backfillDailyCounts = migrations.define({
  table: "activities",
  batchSize: 50,
  migrateOne: async (ctx, activity) => {
    await countActivityOnce(ctx, activity, true);
  },
});

// Start one bounded verification chain per historical day after counting ends.
export const verifyDailyCounts = migrations.define({
  table: "activityDailyCounts",
  batchSize: 25,
  migrateOne: async (ctx, day): Promise<void> => {
    if (!day.verified) {
      await ctx.scheduler.runAfter(
        0,
        internal.activityMigrations.verifyDayPage,
        {
          dayId: day._id,
          cursor: null,
          expected: null,
          counts: emptyCounts(),
        }
      );
    }
  },
});

export const runDailyCounts = migrations.runner([
  internal.activityMigrations.backfillDailyCounts,
  internal.activityMigrations.verifyDailyCounts,
]);

export const verifyDayPage = internalMutation({
  args: {
    dayId: v.id("activityDailyCounts"),
    cursor: v.union(v.string(), v.null()),
    expected: v.union(countsValidator, v.null()),
    counts: countsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const day = await ctx.db.get("activityDailyCounts", args.dayId);
    if (!day || day.verified) {
      return null;
    }
    let cursor = args.cursor;
    let counts = args.counts;
    let expected = args.expected;
    // Events are append-only. A changed total means a write occurred between
    // pages: start again rather than comparing different database snapshots.
    if (!expected || !sameCounts(day, expected)) {
      cursor = null;
      counts = emptyCounts();
      expected = {
        questionSeenCount: day.questionSeenCount,
        revealCount: day.revealCount,
        ratedCount: day.ratedCount,
      };
    }
    const page = await ctx.db
      .query("activities")
      .withIndex("by_user_date_time", (q) =>
        q.eq("userId", day.userId).eq("localDate", day.localDate)
      )
      .paginate({ cursor, numItems: 100, maximumBytesRead: 1024 * 1024 });
    for (const event of page.page) {
      if (event.eventType === "review_question_seen") {
        counts.questionSeenCount++;
      } else if (event.eventType === "review_answer_revealed") {
        counts.revealCount++;
      } else {
        counts.ratedCount++;
      }
    }
    if (page.isDone) {
      if (!sameCounts(counts, expected)) {
        throw new Error(
          `Daily activity totals differ for summary ${day._id}; summary reads remain disabled`
        );
      }
      await ctx.db.patch("activityDailyCounts", day._id, { verified: true });
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.activityMigrations.verifyDayPage,
        {
          dayId: day._id,
          cursor: page.continueCursor,
          expected,
          counts,
        }
      );
    }
    return null;
  },
});

export const verificationStatus = internalQuery({
  args: {},
  returns: v.object({
    ready: v.boolean(),
    backfillPending: v.boolean(),
    verificationPending: v.boolean(),
  }),
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("activities")
      .withIndex("by_dailyCounted_and_userId", (q) =>
        q.eq("dailyCounted", undefined)
      )
      .first();
    const unverified = await ctx.db
      .query("activityDailyCounts")
      .withIndex("by_verified_and_userId", (q) => q.eq("verified", false))
      .first();
    return {
      ready: !pending && !unverified,
      backfillPending: !!pending,
      verificationPending: !!unverified,
    };
  },
});

function sameCounts(a: Counts, b: Counts) {
  return (
    a.questionSeenCount === b.questionSeenCount &&
    a.revealCount === b.revealCount &&
    a.ratedCount === b.ratedCount
  );
}
