import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// The marker and increment commit together. Both live writes and backfill use
// this path, so retries, duplicate events, and migration restarts cannot recount.
export async function countActivityOnce(
  ctx: MutationCtx,
  activity: Doc<"activities">,
  backfill = false
) {
  if (activity.dailyCounted) {
    return;
  }
  const existing = await ctx.db
    .query("activityDailyCounts")
    .withIndex("by_userId_and_localDate", (q) =>
      q.eq("userId", activity.userId).eq("localDate", activity.localDate)
    )
    .unique();
  const counts = {
    questionSeenCount:
      (existing?.questionSeenCount ?? 0) +
      Number(activity.eventType === "review_question_seen"),
    revealCount:
      (existing?.revealCount ?? 0) +
      Number(activity.eventType === "review_answer_revealed"),
    ratedCount:
      (existing?.ratedCount ?? 0) +
      Number(activity.eventType === "review_rated"),
  };
  if (existing) {
    await ctx.db.patch("activityDailyCounts", existing._id, {
      ...counts,
      verified: backfill ? false : existing.verified,
    });
  } else {
    await ctx.db.insert("activityDailyCounts", {
      userId: activity.userId,
      localDate: activity.localDate,
      ...counts,
      verified: !backfill,
    });
  }
  await ctx.db.patch("activities", activity._id, { dailyCounted: true });
}
