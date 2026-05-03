import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import type { Value } from "convex/values";
import { dayjs, DATE_FORMAT } from "../src/lib/dayjs";

export type ActivityEventType =
  | "review_question_seen"
  | "review_answer_revealed"
  | "review_rated";

export type ActivitySource = "web" | "cli" | "system";

const DEFAULT_TIMEZONE = "Asia/Seoul";
const ACTIVITY_SCHEMA_VERSION = 1;
const DEFAULT_HEATMAP_WEEKS = 13;

const activitySourceValidator = v.union(
  v.literal("web"),
  v.literal("cli"),
  v.literal("system")
);

const activityEventTypeValidator = v.union(
  v.literal("review_question_seen"),
  v.literal("review_answer_revealed"),
  v.literal("review_rated")
);

type LogActivityArgs = {
  userId: Id<"users">;
  eventType: ActivityEventType;
  source: ActivitySource;
  dedupeKey: string;
  occurredAt?: number;
  cardId?: Id<"cards">;
  bagId?: Id<"bags">;
  attemptId?: string;
  payload?: Value;
};

type ReviewActivityLogArgs = {
  userId: Id<"users">;
  cardId: Id<"cards">;
  bagId: Id<"bags">;
  source: ActivitySource;
  attemptId: string;
  dedupeKey: string;
  occurredAt?: number;
  payload?: Value;
};

export async function logActivity(
  ctx: MutationCtx,
  args: LogActivityArgs
): Promise<Id<"activities">> {
  const existing = await ctx.db
    .query("activities")
    .withIndex("by_user_and_dedupe_key", (q) =>
      q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey)
    )
    .unique();

  if (existing) {
    return existing._id;
  }

  const occurredAt = args.occurredAt ?? Date.now();
  const timezone = await getUserTimezone(ctx, args.userId);

  return await ctx.db.insert("activities", {
    userId: args.userId,
    eventType: args.eventType,
    occurredAt,
    localDate: dayjs(occurredAt).tz(timezone).format(DATE_FORMAT),
    timezone,
    source: args.source,
    cardId: args.cardId,
    bagId: args.bagId,
    attemptId: args.attemptId,
    dedupeKey: args.dedupeKey,
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    payload: args.payload,
  });
}

export async function logReviewQuestionSeen(
  ctx: MutationCtx,
  args: ReviewActivityLogArgs
) {
  return await logActivity(ctx, {
    userId: args.userId,
    eventType: "review_question_seen",
    source: args.source,
    cardId: args.cardId,
    bagId: args.bagId,
    attemptId: args.attemptId,
    dedupeKey: args.dedupeKey,
    occurredAt: args.occurredAt,
    payload: args.payload,
  });
}

export async function logReviewAnswerRevealed(
  ctx: MutationCtx,
  args: ReviewActivityLogArgs
) {
  return await logActivity(ctx, {
    userId: args.userId,
    eventType: "review_answer_revealed",
    source: args.source,
    cardId: args.cardId,
    bagId: args.bagId,
    attemptId: args.attemptId,
    dedupeKey: args.dedupeKey,
    occurredAt: args.occurredAt,
    payload: args.payload,
  });
}

export async function logReviewRated(
  ctx: MutationCtx,
  args: ReviewActivityLogArgs
) {
  return await logActivity(ctx, {
    userId: args.userId,
    eventType: "review_rated",
    source: args.source,
    cardId: args.cardId,
    bagId: args.bagId,
    attemptId: args.attemptId,
    dedupeKey: args.dedupeKey,
    occurredAt: args.occurredAt,
    payload: args.payload,
  });
}

export const logReviewQuestionSeenFromWeb = mutation({
  args: {
    userId: v.id("users"),
    cardId: v.id("cards"),
    attemptId: v.string(),
    dedupeKey: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    activityId: v.optional(v.id("activities")),
  }),
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    if (!card || card.userId !== args.userId || card.deletedAt !== undefined) {
      return { ok: false };
    }

    const activityId = await logReviewQuestionSeen(ctx, {
      userId: args.userId,
      cardId: card._id,
      bagId: card.bagId,
      source: "web",
      attemptId: args.attemptId,
      dedupeKey: args.dedupeKey,
      payload: {
        questionSnapshot: card.question,
        hintSnapshot: card.hint,
      },
    });

    return { ok: true, activityId };
  },
});

export const logReviewAnswerRevealedFromWeb = mutation({
  args: {
    userId: v.id("users"),
    cardId: v.id("cards"),
    attemptId: v.string(),
    dedupeKey: v.string(),
    elapsedSinceQuestionMs: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    activityId: v.optional(v.id("activities")),
  }),
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    if (!card || card.userId !== args.userId || card.deletedAt !== undefined) {
      return { ok: false };
    }

    const activityId = await logReviewAnswerRevealed(ctx, {
      userId: args.userId,
      cardId: card._id,
      bagId: card.bagId,
      source: "web",
      attemptId: args.attemptId,
      dedupeKey: args.dedupeKey,
      payload: {
        questionSnapshot: card.question,
        answerSnapshot: card.answer,
        explanationSnapshot: card.explanation,
        elapsedSinceQuestionMs: args.elapsedSinceQuestionMs,
      },
    });

    return { ok: true, activityId };
  },
});

export const getActivityHeatmap = query({
  args: {
    userId: v.id("users"),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    fromDate: v.string(),
    toDate: v.string(),
    days: v.array(
      v.object({
        date: v.string(),
        questionSeenCount: v.number(),
        revealCount: v.number(),
        ratedCount: v.number(),
        intensity: v.union(
          v.literal(0),
          v.literal(1),
          v.literal(2),
          v.literal(3),
          v.literal(4)
        ),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const timezone = await getUserTimezone(ctx, args.userId);
    const toDate =
      args.toDate ?? dayjs(Date.now()).tz(timezone).format(DATE_FORMAT);
    const fromDate =
      args.fromDate ??
      dayjs(toDate)
        .subtract(DEFAULT_HEATMAP_WEEKS - 1, "week")
        .startOf("week")
        .format(DATE_FORMAT);
    const [startDate, endDate] =
      fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate];

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_date_time", (q) =>
        q
          .eq("userId", args.userId)
          .gte("localDate", startDate)
          .lte("localDate", endDate)
      )
      .collect();

    const countsByDate = new Map<
      string,
      {
        questionSeenCount: number;
        revealCount: number;
        ratedCount: number;
      }
    >();
    for (const activity of activities) {
      const counts = countsByDate.get(activity.localDate) ?? {
        questionSeenCount: 0,
        revealCount: 0,
        ratedCount: 0,
      };

      if (activity.eventType === "review_question_seen") {
        counts.questionSeenCount++;
      } else if (activity.eventType === "review_answer_revealed") {
        counts.revealCount++;
      } else if (activity.eventType === "review_rated") {
        counts.ratedCount++;
      }

      countsByDate.set(activity.localDate, counts);
    }

    const days = enumerateDates(startDate, endDate).map((date) => {
      const counts = countsByDate.get(date) ?? {
        questionSeenCount: 0,
        revealCount: 0,
        ratedCount: 0,
      };
      return {
        date,
        questionSeenCount: counts.questionSeenCount,
        revealCount: counts.revealCount,
        ratedCount: counts.ratedCount,
        intensity: getRevealIntensity(counts.revealCount),
      };
    });

    return {
      fromDate: startDate,
      toDate: endDate,
      days,
    };
  },
});

export const getActivitiesByDate = query({
  args: {
    userId: v.id("users"),
    localDate: v.string(),
  },
  returns: v.object({
    localDate: v.string(),
    summary: v.object({
      questionSeenCount: v.number(),
      revealCount: v.number(),
      ratedCount: v.number(),
    }),
    activities: v.array(
      v.object({
        _id: v.id("activities"),
        eventType: activityEventTypeValidator,
        occurredAt: v.number(),
        localDate: v.string(),
        timezone: v.string(),
        source: activitySourceValidator,
        cardId: v.optional(v.id("cards")),
        bagId: v.optional(v.id("bags")),
        attemptId: v.optional(v.string()),
        payload: v.optional(v.any()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_user_date_time", (q) =>
        q.eq("userId", args.userId).eq("localDate", args.localDate)
      )
      .order("asc")
      .collect();

    let questionSeenCount = 0;
    let revealCount = 0;
    let ratedCount = 0;

    for (const activity of activities) {
      if (activity.eventType === "review_question_seen") {
        questionSeenCount++;
      } else if (activity.eventType === "review_answer_revealed") {
        revealCount++;
      } else if (activity.eventType === "review_rated") {
        ratedCount++;
      }
    }

    return {
      localDate: args.localDate,
      summary: {
        questionSeenCount,
        revealCount,
        ratedCount,
      },
      activities: activities.map((activity) => ({
        _id: activity._id,
        eventType: activity.eventType,
        occurredAt: activity.occurredAt,
        localDate: activity.localDate,
        timezone: activity.timezone,
        source: activity.source,
        cardId: activity.cardId,
        bagId: activity.bagId,
        attemptId: activity.attemptId,
        payload: activity.payload,
      })),
    };
  },
});

async function getUserTimezone(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  const settings = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  return settings?.timezone ?? DEFAULT_TIMEZONE;
}

function enumerateDates(fromDate: string, toDate: string) {
  const dates: string[] = [];
  for (
    let date = fromDate;
    date <= toDate;
    date = dayjs(date).add(1, "day").format(DATE_FORMAT)
  ) {
    dates.push(date);
  }
  return dates;
}

function getRevealIntensity(revealCount: number): 0 | 1 | 2 | 3 | 4 {
  if (revealCount === 0) {
    return 0;
  }
  if (revealCount === 1) {
    return 1;
  }
  if (revealCount <= 4) {
    return 2;
  }
  if (revealCount <= 9) {
    return 3;
  }
  return 4;
}
