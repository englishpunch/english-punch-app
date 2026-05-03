import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { fsrs, State, Grade, Steps } from "ts-fsrs";
import { getGlobalLogger } from "../src/lib/globalLogger";
import { logReviewRated, type ActivitySource } from "./activities";

type ReviewCardArgs = {
  userId: Id<"users">;
  cardId: Id<"cards">;
  rating: 1 | 2 | 3 | 4;
  duration: number;
  sessionId?: string;
  attemptId?: string;
  source?: ActivitySource;
};

type ReviewCardResult = {
  nextReviewDate: string;
  nextReviewTimestamp: number;
  newState: number;
  newStability: number;
  newDifficulty: number;
};

const logger = getGlobalLogger();

/**
 * FSRS 알고리즘을 사용한 카드 복습 처리
 * TODO: userId를 args에서 제거하고, 인증된 사용자 정보에서 가져오도록 변경
 */
export const reviewCardHandler = async (
  ctx: MutationCtx,
  args: ReviewCardArgs
): Promise<ReviewCardResult> => {
  const runId = `${args.userId}-${args.cardId}-${Date.now()}`;

  logger.info(runId, {
    m: "🔄 ReviewCard started:",
    cardId: args.cardId,
    rating: args.rating,
    userId: args.userId,
  });

  const card = await ctx.db.get("cards", args.cardId);
  if (!card || card.userId !== args.userId || card.deletedAt !== undefined) {
    const error = "Card not found";
    logger.error(runId, { m: "❌ ReviewCard error:", error });
    throw new Error(error);
  }

  const userSettings = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .unique();

  if (!userSettings) {
    const error = "User settings not found";
    logger.error(runId, { m: "❌ ReviewCard error:", error });
    throw new Error(error);
  }

  const now = new Date();
  const lastReviewDate = card.last_review ? new Date(card.last_review) : null;

  const previousElapsedDays = card.elapsed_days ?? 0;

  logger.info(runId, {
    m: "📊 Card before review:",
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    elapsed_days: previousElapsedDays,
    last_review: lastReviewDate?.toISOString(),
  });

  logger.info(runId, {
    m: "🎯 Review input:",
    rating: args.rating,
    grade: args.rating,
    ratingName:
      args.rating === 1
        ? "Again"
        : args.rating === 2
          ? "Hard"
          : args.rating === 3
            ? "Good"
            : "Easy",
  });

  // ts-fsrs 인스턴스 생성 (파라미터 타입 안전성 보장)
  const fsrsParams = {
    ...userSettings.fsrsParameters,
    learning_steps: userSettings.fsrsParameters.learning_steps as Steps, // Steps 타입으로 캐스팅
    relearning_steps: userSettings.fsrsParameters.relearning_steps as Steps, // Steps 타입으로 캐스팅
  };
  const f = fsrs(fsrsParams);

  // 현재 카드를 ts-fsrs Card 형식으로 변환
  const fsrsCard = {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: lastReviewDate ?? undefined,
    elapsed_days: previousElapsedDays,
  };

  // ts-fsrs로 다음 상태 계산 (Rating을 Grade로 변환, Manual=0 제외)
  const grade = args.rating as Grade; // 1=Again, 2=Hard, 3=Good, 4=Easy
  const recordLogItem = f.next(fsrsCard, now, grade);

  if (
    recordLogItem.card.elapsed_days === undefined ||
    recordLogItem.card.elapsed_days === null ||
    recordLogItem.log.elapsed_days === undefined ||
    recordLogItem.log.elapsed_days === null ||
    recordLogItem.log.last_elapsed_days === undefined ||
    recordLogItem.log.last_elapsed_days === null
  ) {
    throw new Error("FSRS did not return elapsed_days");
  }

  logger.info(runId, {
    m: "✨ FSRS calculation result:",
    newCard: recordLogItem.card,
    log: recordLogItem.log,
  });

  // 카드 업데이트
  await ctx.db.patch("cards", args.cardId, {
    due: recordLogItem.card.due.getTime(),
    stability: recordLogItem.card.stability,
    difficulty: recordLogItem.card.difficulty,
    scheduled_days: recordLogItem.card.scheduled_days,
    learning_steps: recordLogItem.card.learning_steps,
    reps: recordLogItem.card.reps,
    lapses: recordLogItem.card.lapses,
    state: recordLogItem.card.state,
    last_review: recordLogItem.card.last_review?.getTime(),
    elapsed_days: recordLogItem.card.elapsed_days,
  });

  // lapses 변화 추적
  const lapsesChanged = recordLogItem.card.lapses > card.lapses;
  const repsIncreased = recordLogItem.card.reps > card.reps;

  logger.info(runId, {
    m: "💾 Card updated successfully with new values:",
    due: new Date(recordLogItem.card.due).toISOString(),
    dueTimestamp: recordLogItem.card.due.getTime(),
    state: recordLogItem.card.state,
    stability: recordLogItem.card.stability,
    difficulty: recordLogItem.card.difficulty,
    reps: recordLogItem.card.reps,
    lapses: recordLogItem.card.lapses,
    elapsed_days: recordLogItem.card.elapsed_days,
  });

  if (lapsesChanged) {
    logger.warn(runId, {
      m: "⚠️ LAPSES INCREASED:",
      before: card.lapses,
      after: recordLogItem.card.lapses,
      rating: args.rating,
      ratingName:
        args.rating === 1
          ? "Again"
          : args.rating === 2
            ? "Hard"
            : args.rating === 3
              ? "Good"
              : "Easy",
    });
  }

  if (repsIncreased) {
    logger.info(runId, {
      m: "📈 REPS INCREASED:",
      before: card.reps,
      after: recordLogItem.card.reps,
    });
  }

  // ReviewLog 생성
  const reviewLog = await ctx.db.insert("reviewLogs", {
    userId: args.userId,
    cardId: args.cardId,
    rating: recordLogItem.log.rating,
    state: recordLogItem.log.state,
    due: recordLogItem.log.due.getTime(),
    stability: recordLogItem.log.stability,
    difficulty: recordLogItem.log.difficulty,
    scheduled_days: recordLogItem.log.scheduled_days,
    learning_steps: recordLogItem.log.learning_steps,
    review: recordLogItem.log.review.getTime(),
    elapsed_days: recordLogItem.log.elapsed_days,
    last_elapsed_days: recordLogItem.log.last_elapsed_days,
    duration: args.duration,
    sessionId: args.sessionId,
    reviewType: "scheduled",
  });

  const attemptId = args.attemptId ?? args.sessionId ?? reviewLog;
  await logReviewRated(ctx, {
    userId: args.userId,
    cardId: args.cardId,
    bagId: card.bagId,
    source: args.source ?? "web",
    attemptId,
    dedupeKey: `${args.source ?? "web"}:${attemptId}:rated`,
    occurredAt: recordLogItem.log.review.getTime(),
    payload: {
      rating: args.rating,
      durationMs: args.duration,
      reviewType: "scheduled",
      legacyReviewLogId: reviewLog,
      fsrs: {
        before: {
          state: card.state,
          due: card.due,
          scheduled_days: card.scheduled_days,
          elapsed_days: previousElapsedDays,
          reps: card.reps,
          lapses: card.lapses,
          stability: card.stability,
          difficulty: card.difficulty,
        },
        after: {
          state: recordLogItem.card.state,
          due: recordLogItem.card.due.getTime(),
          scheduled_days: recordLogItem.card.scheduled_days,
          elapsed_days: recordLogItem.card.elapsed_days,
          reps: recordLogItem.card.reps,
          lapses: recordLogItem.card.lapses,
          stability: recordLogItem.card.stability,
          difficulty: recordLogItem.card.difficulty,
        },
      },
    },
  });

  logger.info(runId, { m: "📝 ReviewLog created:", reviewLog });

  const result = {
    nextReviewDate: new Date(recordLogItem.card.due).toISOString(),
    nextReviewTimestamp: recordLogItem.card.due.getTime(),
    newState: recordLogItem.card.state,
    newStability: recordLogItem.card.stability,
    newDifficulty: recordLogItem.card.difficulty,
  };

  logger.info(runId, { m: "✅ ReviewCard completed:", result });
  return result;
};

export const reviewCard = mutation({
  args: {
    userId: v.id("users"),
    cardId: v.id("cards"),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)), // Again, Hard, Good, Easy
    duration: v.number(), // 응답 시간 (밀리초)
    sessionId: v.optional(v.string()),
    attemptId: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("cli"))),
  },
  returns: v.object({
    nextReviewDate: v.string(),
    nextReviewTimestamp: v.number(),
    newState: v.number(),
    newStability: v.number(),
    newDifficulty: v.number(),
  }),
  handler: reviewCardHandler,
});

/**
 * 최근 리뷰 로그 조회 (activity 화면용)
 */
export const getRecentReviewLogs = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("reviewLogs"),
      cardId: v.id("cards"),
      rating: v.number(),
      state: v.number(),
      review: v.number(),
      duration: v.number(),
      question: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const logs = await ctx.db
      .query("reviewLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    const enriched = await Promise.all(
      logs.map(async (log) => {
        const card = await ctx.db.get("cards", log.cardId);
        return {
          _id: log._id,
          cardId: log.cardId,
          rating: log.rating,
          state: log.state,
          review: log.review,
          duration: log.duration,
          question:
            card && card.deletedAt === undefined ? card.question : undefined,
        };
      })
    );

    return enriched;
  },
});

/**
 * 사용자 설정 조회
 */
export const getUserSettings = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      fsrsParameters: v.object({
        w: v.array(v.number()),
        request_retention: v.number(),
        maximum_interval: v.number(),
        enable_fuzz: v.boolean(),
        enable_short_term: v.boolean(),
        learning_steps: v.array(v.string()),
        relearning_steps: v.array(v.string()),
      }),
      dailyNewCards: v.number(),
      dailyReviewCards: v.number(),
      timezone: v.string(),
      totalReviews: v.number(),
      currentStreak: v.number(),
      longestStreak: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings) {
      return null;
    }

    return {
      fsrsParameters: settings.fsrsParameters,
      dailyNewCards: settings.dailyNewCards,
      dailyReviewCards: settings.dailyReviewCards,
      timezone: settings.timezone,
      totalReviews: settings.totalReviews,
      currentStreak: settings.currentStreak,
      longestStreak: settings.longestStreak,
    };
  },
});
