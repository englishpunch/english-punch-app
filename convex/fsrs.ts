import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { fsrs, generatorParameters, createEmptyCard, Rating, State, Grade } from "ts-fsrs";

/**
 * FSRS 알고리즘을 사용한 카드 복습 처리
 */
export const reviewCard = mutation({
  args: {
    userId: v.id("users"),
    cardId: v.id("cards"),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)), // Again, Hard, Good, Easy
    duration: v.number(), // 응답 시간 (밀리초)
    sessionId: v.optional(v.string()),
  },
  returns: v.object({
    nextReviewDate: v.string(),
    nextReviewTimestamp: v.number(),
    newState: v.number(),
    newStability: v.number(),
    newDifficulty: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log("🔄 ReviewCard started:", { cardId: args.cardId, rating: args.rating, userId: args.userId });

    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== args.userId) {
      const error = "Card not found";
      console.error("❌ ReviewCard error:", error);
      throw new Error(error);
    }

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!userSettings) {
      const error = "User settings not found";
      console.error("❌ ReviewCard error:", error);
      throw new Error(error);
    }

    const now = new Date();
    const reviewTime = now.toISOString();
    
    console.log("📊 Card before review:", {
      state: card.state,
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses
    });

    console.log("🎯 Review input:", {
      rating: args.rating,
      grade: args.rating,
      ratingName: args.rating === 1 ? "Again" : 
                   args.rating === 2 ? "Hard" : 
                   args.rating === 3 ? "Good" : "Easy"
    });

    // ts-fsrs 인스턴스 생성 (파라미터 타입 안전성 보장)
    const fsrsParams = {
      ...userSettings.fsrsParameters,
      learning_steps: userSettings.fsrsParameters.learning_steps as any, // Steps 타입으로 캐스팅
      relearning_steps: userSettings.fsrsParameters.relearning_steps as any, // Steps 타입으로 캐스팅
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
      last_review: card.last_review ? new Date(card.last_review) : undefined,
    };

    // ts-fsrs로 다음 상태 계산 (Rating을 Grade로 변환, Manual=0 제외)
    const grade = args.rating as Grade; // 1=Again, 2=Hard, 3=Good, 4=Easy
    const recordLogItem = f.next({...fsrsCard, elapsed_days: 0}, now, grade);
    
    console.log("✨ FSRS calculation result:", {
      newCard: recordLogItem.card,
      log: recordLogItem.log
    });

    // 카드 업데이트
    await ctx.db.patch(args.cardId, {
      due: recordLogItem.card.due.getTime(),
      stability: recordLogItem.card.stability,
      difficulty: recordLogItem.card.difficulty,
      scheduled_days: recordLogItem.card.scheduled_days,
      learning_steps: recordLogItem.card.learning_steps,
      reps: recordLogItem.card.reps,
      lapses: recordLogItem.card.lapses,
      state: recordLogItem.card.state,
      last_review: recordLogItem.card.last_review?.getTime(),
    });

    // lapses 변화 추적
    const lapsesChanged = recordLogItem.card.lapses > card.lapses;
    const repsIncreased = recordLogItem.card.reps > card.reps;

    console.log("💾 Card updated successfully with new values:", {
      due: new Date(recordLogItem.card.due).toISOString(),
      dueTimestamp: recordLogItem.card.due.getTime(),
      state: recordLogItem.card.state,
      stability: recordLogItem.card.stability,
      difficulty: recordLogItem.card.difficulty,
      reps: recordLogItem.card.reps,
      lapses: recordLogItem.card.lapses
    });

    if (lapsesChanged) {
      console.log("⚠️ LAPSES INCREASED:", {
        before: card.lapses,
        after: recordLogItem.card.lapses,
        rating: args.rating,
        ratingName: args.rating === 1 ? "Again" : 
                   args.rating === 2 ? "Hard" : 
                   args.rating === 3 ? "Good" : "Easy"
      });
    }

    if (repsIncreased) {
      console.log("📈 REPS INCREASED:", {
        before: card.reps,
        after: recordLogItem.card.reps
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
      duration: args.duration,
      sessionId: args.sessionId,
      reviewType: "scheduled",
    });

    console.log("📝 ReviewLog created:", reviewLog);

    const result = {
      nextReviewDate: new Date(recordLogItem.card.due).toISOString(),
      nextReviewTimestamp: recordLogItem.card.due.getTime(),
      newState: recordLogItem.card.state,
      newStability: recordLogItem.card.stability,
      newDifficulty: recordLogItem.card.difficulty,
    };

    console.log("✅ ReviewCard completed:", result);
    return result;
  },
});


/**
 * 사용자 설정 조회
 */
export const getUserSettings = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.object({
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
  })),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings) return null;

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

/**
 * 학습 세션 시작
 */
export const startSession = mutation({
  args: {
    userId: v.id("users"),
    sessionType: v.union(v.literal("daily"), v.literal("custom"), v.literal("cramming")),
  },
  returns: v.string(), // sessionId
  handler: async (ctx, args) => {
    console.log("🚀 StartSession called:", args);
    
    const sessionId = `session_${args.userId}_${Date.now()}`;
    
    const sessionResult = await ctx.db.insert("sessions", {
      userId: args.userId,
      startTime: new Date().toISOString(),
      cardsReviewed: 0,
      cardsNew: 0,
      cardsLearning: 0,
      cardsRelearning: 0,
      manualCount: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
      averageDuration: 0,
      averageDifficulty: 0,
      sessionType: args.sessionType,
    });

    console.log("✅ Session created:", { sessionId, sessionResult });
    return sessionId;
  },
});

/**
 * 학습 세션 종료
 */
export const endSession = mutation({
  args: {
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log("🏁 EndSession called:", args);
    
    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("startTime"), args.sessionId.split("_")[2]))
      .first();

    if (!session) {
      console.log("⚠️ Session not found for sessionId:", args.sessionId);
      return null;
    }

    console.log("📋 Session found:", session);

    // 세션 통계 계산
    const logs = await ctx.db
      .query("reviewLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    console.log("📊 Found review logs:", logs.length);

    let totalDuration = 0;
    let totalDifficulty = 0;
    const counts = [0, 0, 0, 0, 0]; // [Manual, Again, Hard, Good, Easy]

    for (const log of logs) {
      totalDuration += log.duration;
      totalDifficulty += log.difficulty;
      counts[log.rating]++;
    }

    const averageDuration = logs.length > 0 ? totalDuration / logs.length : 0;
    const averageDifficulty = logs.length > 0 ? totalDifficulty / logs.length : 0;

    const sessionStats = {
      endTime: new Date().toISOString(),
      cardsReviewed: logs.length,
      manualCount: counts[0],
      againCount: counts[1],
      hardCount: counts[2],
      goodCount: counts[3],
      easyCount: counts[4],
      averageDuration,
      averageDifficulty,
    };

    console.log("📈 Session statistics:", sessionStats);

    await ctx.db.patch(session._id, sessionStats);
    
    console.log("✅ Session ended successfully:", { sessionId: args.sessionId, stats: sessionStats });
    return null;
  },
});