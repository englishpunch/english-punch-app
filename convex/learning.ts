import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * 샘플 백 생성 - 영어 학습용 기본 카드들
 */
export const createSampleBag = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.id("bags"),
  handler: async (ctx, args) => {
    console.log("🎯 CreateSampleBag started for userId:", args.userId);

    // 사용자 설정 확인/생성
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!userSettings) {
      console.log("👤 Creating user settings with default FSRS parameters");

      // 기본 FSRS 설정으로 사용자 설정 생성
      const userSettingsId = await ctx.db.insert("userSettings", {
        userId: args.userId,
        fsrsParameters: {
          w: [
            0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
            1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
            1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
          ], // FSRS-6 기본값
          request_retention: 0.9,
          maximum_interval: 36500,
          enable_fuzz: true,
          enable_short_term: true,
          learning_steps: ["1m", "10m"],
          relearning_steps: ["10m"],
        },
        dailyNewCards: 20,
        dailyReviewCards: 200,
        timezone: "Asia/Seoul",
        totalReviews: 0,
        currentStreak: 0,
        longestStreak: 0,
      });
      console.log("✅ User settings created:", userSettingsId);
    } else {
      console.log("📋 User settings already exist");
    }

    // 샘플 백 생성
    console.log("📦 Creating sample bag");
    const bagId = await ctx.db.insert("bags", {
      userId: args.userId,
      name: "영어 기초 표현",
      description: "일상생활에서 자주 사용하는 영어 표현들을 학습합니다.",
      isActive: true,
      sortOrder: 1,
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      tags: ["기초", "일상회화"],
      lastModified: new Date().toISOString(),
    });
    console.log("✅ Sample bag created:", bagId);

    // 샘플 카드들
    const sampleCards = [
      {
        question: "I'd like to ___ a table for two at 7 pm.",
        answer: "reserve",
        hint: "book in advance",
        explanation: "레스토랑에서 테이블을 예약할 때 사용하는 표현입니다.",
      },
      {
        question: "Could you ___ me the way to the station?",
        answer: "show",
        hint: "give directions",
        explanation: "길을 물어볼 때 사용하는 정중한 표현입니다.",
      },
      {
        question: "I'm ___ forward to seeing you.",
        answer: "looking",
        hint: "anticipating",
        explanation: "누군가를 만나기를 기대한다는 표현입니다.",
      },
      {
        question: "How ___ have you been studying English?",
        answer: "long",
        hint: "duration of time",
        explanation: "기간을 묻는 질문에 사용합니다.",
      },
      {
        question: "I ___ up early this morning.",
        answer: "woke",
        hint: "stopped sleeping",
        explanation: "잠에서 깨다는 의미의 동사 wake의 과거형입니다.",
      },
      {
        question: "Can you ___ me a favor?",
        answer: "do",
        hint: "help with something",
        explanation: "부탁을 할 때 사용하는 표현입니다.",
      },
      {
        question: "I'm ___ about the weather today.",
        answer: "worried",
        hint: "concerned",
        explanation: "무언가를 걱정할 때 사용하는 형용사입니다.",
      },
      {
        question: "Let's ___ in touch.",
        answer: "keep",
        hint: "maintain contact",
        explanation: "연락을 계속 유지하자는 의미의 표현입니다.",
      },
      {
        question: "I ___ my keys somewhere.",
        answer: "lost",
        hint: "can't find",
        explanation: "무언가를 잃어버렸을 때 사용합니다.",
      },
      {
        question: "Could you ___ down the music?",
        answer: "turn",
        hint: "make quieter",
        explanation: "소리를 줄여달라고 요청할 때 사용합니다.",
      },
    ];

    const now = new Date();
    const nowTimestamp = now.getTime();
    const nowIsoString = now.toISOString();
    let cardCount = 0;

    console.log(`📚 Creating ${sampleCards.length} sample cards`);

    for (const cardData of sampleCards) {
      const cardId = await ctx.db.insert("cards", {
        userId: args.userId,
        bagId: bagId,
        question: cardData.question,
        answer: cardData.answer,
        hint: cardData.hint,
        explanation: cardData.explanation,

        // FSRS 초기 상태 (새 카드)
        due: nowTimestamp,
        stability: 0,
        difficulty: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0, // New
        last_review: undefined,

        // 메타데이터
        tags: ["기초"],
        source: "기본 패키지",
        suspended: false,
      });
      cardCount++;
      console.log(`📄 Card ${cardCount} created:`, {
        cardId,
        question: cardData.question,
      });
    }

    // 백 통계 업데이트
    console.log("📊 Updating bag statistics");
    await ctx.db.patch("bags", bagId, {
      totalCards: cardCount,
      newCards: cardCount,
      lastModified: nowIsoString,
    });

    console.log("✅ CreateSampleBag completed:", {
      bagId,
      cardCount,
      totalCards: cardCount,
      newCards: cardCount,
    });

    return bagId;
  },
});

/**
 * 사용자의 백 목록 조회
 */
export const getUserBags = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("bags"),
      name: v.string(),
      description: v.optional(v.string()),
      totalCards: v.number(),
      newCards: v.number(),
      learningCards: v.number(),
      reviewCards: v.number(),
      tags: v.array(v.string()),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const bags = await ctx.db
      .query("bags")
      .withIndex("by_user_and_deleted_at", (q) =>
        q.eq("userId", args.userId).eq("deletedAt", undefined)
      )
      .collect();

    return bags.map((bag) => ({
      _id: bag._id,
      name: bag.name,
      description: bag.description,
      totalCards: bag.totalCards,
      newCards: bag.newCards,
      learningCards: bag.learningCards,
      reviewCards: bag.reviewCards,
      tags: bag.tags,
      isActive: bag.isActive,
    }));
  },
});

/**
 * 학습 가능한 카드 하나 조회 (due date 기준)
 */
export const getOneDueCard = query({
  args: {
    bagId: v.id("bags"),
  },
  handler: async (ctx, args) => {
    const nowTimestamp = Date.now();
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_user_and_due", (q) =>
        q.eq("userId", userId).lte("due", nowTimestamp)
      )
      .filter((q) => q.eq(q.field("bagId"), args.bagId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("suspended"), false))
      .order("asc")
      .take(1);
    const card = cards[0];

    if (!card) {
      return "NO_CARD_AVAILABLE";
    }

    return card;
  },
});

export const getDueCardCount = query({
  args: {
    bagId: v.id("bags"),
  },
  handler: async (ctx, args) => {
    const nowTimestamp = Date.now();
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }
    const dueCardsList = await ctx.db
      .query("cards")
      .withIndex("by_user_and_due", (q) =>
        q.eq("userId", userId).lte("due", nowTimestamp)
      )
      .filter((q) => q.eq(q.field("bagId"), args.bagId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .filter((q) => q.eq(q.field("suspended"), false))
      .take(101);

    return dueCardsList.length;
  },
});

/**
 * 백 통계 업데이트
 */
export const updateBagStats = mutation({
  args: {
    bagId: v.id("bags"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bag = await ctx.db.get("bags", args.bagId);
    if (!bag || bag.deletedAt !== undefined) {
      return null;
    }
    // 각 상태별 카드 수 계산
    const allCards = await ctx.db
      .query("cards")
      .withIndex("by_bag_and_deleted_at", (q) =>
        q.eq("bagId", args.bagId).eq("deletedAt", undefined)
      )
      .collect();

    const stats = {
      totalCards: allCards.length,
      newCards: allCards.filter((card) => card.state === 0).length,
      learningCards: allCards.filter((card) => card.state === 1).length,
      reviewCards: allCards.filter((card) => card.state === 2).length,
    };

    await ctx.db.patch("bags", args.bagId, {
      ...stats,
      lastModified: new Date().toISOString(),
    });

    console.log("📊 Bag statistics updated:", { bagId: args.bagId, stats });
    return null;
  },
});

/**
 * 백 상세 통계 조회
 */
export const getBagDetailStats = query({
  args: {
    userId: v.id("users"),
    bagId: v.id("bags"),
  },
  returns: v.union(
    v.null(),
    v.object({
      bagInfo: v.object({
        _id: v.id("bags"),
        name: v.string(),
        description: v.optional(v.string()),
        tags: v.array(v.string()),
        totalCards: v.number(),
        newCards: v.number(),
        learningCards: v.number(),
        reviewCards: v.number(),
        lastModified: v.string(),
      }),
      cardStats: v.object({
        totalCards: v.number(),
        newCards: v.number(),
        learningCards: v.number(),
        reviewCards: v.number(),
        relearningCards: v.number(),
        suspendedCards: v.number(),
        dueCards: v.number(),
      }),
      difficultyDistribution: v.object({
        veryEasy: v.number(),
        easy: v.number(),
        medium: v.number(),
        hard: v.number(),
        veryHard: v.number(),
      }),
      stabilityDistribution: v.object({
        veryLow: v.number(),
        low: v.number(),
        medium: v.number(),
        high: v.number(),
        veryHigh: v.number(),
      }),
      repsDistribution: v.object({
        new: v.number(),
        beginner: v.number(),
        intermediate: v.number(),
        advanced: v.number(),
        expert: v.number(),
      }),
      lapsesDistribution: v.object({
        perfect: v.number(),
        occasional: v.number(),
        frequent: v.number(),
        problematic: v.number(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    // 백 정보 조회
    const bag = await ctx.db.get("bags", args.bagId);
    if (!bag || bag.userId !== args.userId || bag.deletedAt !== undefined) {
      return null;
    }

    // 모든 카드 조회
    const allCards = await ctx.db
      .query("cards")
      .withIndex("by_bag_and_deleted_at", (q) =>
        q.eq("bagId", args.bagId).eq("deletedAt", undefined)
      )
      .collect();

    const nowTimestamp = Date.now();

    // 기본 카드 통계
    const cardStats = {
      totalCards: allCards.length,
      newCards: allCards.filter((card) => card.state === 0).length,
      learningCards: allCards.filter((card) => card.state === 1).length,
      reviewCards: allCards.filter((card) => card.state === 2).length,
      relearningCards: allCards.filter((card) => card.state === 3).length,
      suspendedCards: allCards.filter((card) => card.suspended).length,
      dueCards: allCards.filter(
        (card) => card.due <= nowTimestamp && !card.suspended
      ).length,
    };

    // 난이도 분포 (0-10 범위)
    const difficultyDistribution = {
      veryEasy: allCards.filter((card) => card.difficulty <= 2).length,
      easy: allCards.filter(
        (card) => card.difficulty > 2 && card.difficulty <= 4
      ).length,
      medium: allCards.filter(
        (card) => card.difficulty > 4 && card.difficulty <= 6
      ).length,
      hard: allCards.filter(
        (card) => card.difficulty > 6 && card.difficulty <= 8
      ).length,
      veryHard: allCards.filter((card) => card.difficulty > 8).length,
    };

    // 안정성 분포 (일 단위)
    const stabilityDistribution = {
      veryLow: allCards.filter((card) => card.stability <= 1).length,
      low: allCards.filter((card) => card.stability > 1 && card.stability <= 7)
        .length,
      medium: allCards.filter(
        (card) => card.stability > 7 && card.stability <= 30
      ).length,
      high: allCards.filter(
        (card) => card.stability > 30 && card.stability <= 90
      ).length,
      veryHigh: allCards.filter((card) => card.stability > 90).length,
    };

    // 반복 횟수 분포
    const repsDistribution = {
      new: allCards.filter((card) => card.reps === 0).length,
      beginner: allCards.filter((card) => card.reps > 0 && card.reps <= 3)
        .length,
      intermediate: allCards.filter((card) => card.reps > 3 && card.reps <= 10)
        .length,
      advanced: allCards.filter((card) => card.reps > 10 && card.reps <= 20)
        .length,
      expert: allCards.filter((card) => card.reps > 20).length,
    };

    // 실수 횟수 분포
    const lapsesDistribution = {
      perfect: allCards.filter((card) => card.lapses === 0).length,
      occasional: allCards.filter((card) => card.lapses > 0 && card.lapses <= 2)
        .length,
      frequent: allCards.filter((card) => card.lapses > 2 && card.lapses <= 5)
        .length,
      problematic: allCards.filter((card) => card.lapses > 5).length,
    };

    return {
      bagInfo: {
        _id: bag._id,
        name: bag.name,
        description: bag.description,
        tags: bag.tags,
        totalCards: bag.totalCards,
        newCards: bag.newCards,
        learningCards: bag.learningCards,
        reviewCards: bag.reviewCards,
        lastModified: bag.lastModified,
      },
      cardStats,
      difficultyDistribution,
      stabilityDistribution,
      repsDistribution,
      lapsesDistribution,
    };
  },
});

/**
 * 새로운 백 생성
 */
export const createBag = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const nowIso = new Date().toISOString();
    const bagId = await ctx.db.insert("bags", {
      userId: args.userId,
      name: args.name,
      description: undefined,
      isActive: true,
      sortOrder: 0,
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      tags: [],
      lastModified: nowIso,
    });
    return bagId;
  },
});

/** 삭제: 백과 카드 */
export const deleteBag = mutation({
  args: {
    bagId: v.id("bags"),
  },
  handler: async (ctx, args) => {
    const bag = await ctx.db.get("bags", args.bagId);
    if (!bag || bag.deletedAt !== undefined) {
      return null;
    }

    const deletedAt = Date.now();
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_bag_and_deleted_at", (q) =>
        q.eq("bagId", args.bagId).eq("deletedAt", undefined)
      )
      .collect();

    await Promise.all(
      cards.map((card) =>
        ctx.db.patch("cards", card._id, {
          deletedAt,
        })
      )
    );
    await ctx.db.patch("bags", args.bagId, {
      deletedAt,
      lastModified: new Date(deletedAt).toISOString(),
    });
    return null;
  },
});

/** 단일 카드 조회 */
export const getCard = query({
  args: {
    cardId: v.id("cards"),
    bagId: v.id("bags"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    if (
      !card ||
      card.bagId !== args.bagId ||
      card.userId !== args.userId ||
      card.deletedAt !== undefined
    ) {
      return null;
    }
    return {
      _id: card._id,
      _creationTime: card._creationTime,
      question: card.question,
      answer: card.answer,
      hint: card.hint,
      explanation: card.explanation,
      context: card.context,
    };
  },
});

/** 백의 카드 페이지네이션 조회 (30개 단위) */
export const getBagCardsPaginated = query({
  args: {
    bagId: v.id("bags"),
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.search?.trim();
    const query = searchQuery
      ? ctx.db
          .query("cards")
          .withSearchIndex("search_answer", (q) =>
            q
              .search("answer", searchQuery)
              .eq("bagId", args.bagId)
              .eq("userId", args.userId)
              .eq("deletedAt", undefined)
          )
      : ctx.db
          .query("cards")
          .withIndex("by_bag_and_deleted_at", (q) =>
            q.eq("bagId", args.bagId).eq("deletedAt", undefined)
          )
          .filter((q) => q.eq(q.field("userId"), args.userId))
          .order("desc");
    const result = await query.paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((c) => ({
        _id: c._id,
        _creationTime: c._creationTime,
        question: c.question,
        answer: c.answer,
        hint: c.hint,
        explanation: c.explanation,
        context: c.context,
      })),
    };
  },
});

const initialSchedule = (now: number) => ({
  due: now,
  stability: 0,
  difficulty: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0 as const,
  last_review: undefined,
  suspended: false,
});

/** 카드 생성 */
export const createCard = mutation({
  args: {
    bagId: v.id("bags"),
    userId: v.id("users"),
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),
    context: v.optional(v.string()),
    sourceWord: v.optional(v.string()),
    expression: v.optional(v.string()),
  },
  returns: v.id("cards"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const cardId = await ctx.db.insert("cards", {
      bagId: args.bagId,
      userId: args.userId,
      question: args.question,
      answer: args.answer,
      hint: args.hint,
      explanation: args.explanation,
      context: args.context,
      sourceWord: args.sourceWord,
      expression: args.expression,
      tags: [],
      source: "manual",
      ...initialSchedule(now),
    });

    const bag = await ctx.db.get("bags", args.bagId);
    if (bag && bag.deletedAt === undefined) {
      await ctx.db.patch("bags", args.bagId, {
        totalCards: bag.totalCards + 1,
        newCards: bag.newCards + 1,
        lastModified: new Date(now).toISOString(),
      });
    }
    return cardId;
  },
});

/** 카드 수정 + 스케줄 초기화 */
export const updateCard = mutation({
  args: {
    bagId: v.id("bags"),
    cardId: v.id("cards"),
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),
    context: v.optional(v.string()),
    sourceWord: v.optional(v.string()),
    expression: v.optional(v.string()),
    due: v.optional(v.number()),
    stability: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    scheduled_days: v.optional(v.number()),
    learning_steps: v.optional(v.number()),
    reps: v.optional(v.number()),
    lapses: v.optional(v.number()),
    state: v.optional(
      v.union(v.literal(0), v.literal(1), v.literal(2), v.literal(3))
    ),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    if (!card || card.bagId !== args.bagId || card.deletedAt !== undefined) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("cards", args.cardId, {
      question: args.question,
      answer: args.answer,
      hint: args.hint,
      explanation: args.explanation,
      context: args.context,
      sourceWord: args.sourceWord,
      expression: args.expression,
      ...initialSchedule(now),
    });

    const bag = await ctx.db.get("bags", args.bagId);
    if (bag && bag.deletedAt === undefined) {
      // 이전 상태가 0이 아니면 newCards 증가, 다른 상태 감소는 생략 (간단 집계)
      const newCards = bag.newCards + (card.state === 0 ? 0 : 1);
      const learningCards = bag.learningCards - (card.state === 1 ? 1 : 0);
      const reviewCards = bag.reviewCards - (card.state === 2 ? 1 : 0);
      await ctx.db.patch("bags", args.bagId, {
        newCards,
        learningCards,
        reviewCards,
        lastModified: new Date(now).toISOString(),
      });
    }
    return null;
  },
});

/** 카드 삭제 */
export const deleteCard = mutation({
  args: {
    cardId: v.id("cards"),
    bagId: v.id("bags"),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    const bag = await ctx.db.get("bags", args.bagId);
    if (
      !card ||
      !bag ||
      card.deletedAt !== undefined ||
      bag.deletedAt !== undefined
    ) {
      return null;
    }
    const deletedAt = Date.now();
    await ctx.db.patch("cards", args.cardId, {
      deletedAt,
    });

    const counts = {
      totalCards: bag.totalCards - 1,
      newCards: bag.newCards - (card.state === 0 ? 1 : 0),
      learningCards: bag.learningCards - (card.state === 1 ? 1 : 0),
      reviewCards: bag.reviewCards - (card.state === 2 ? 1 : 0),
    };
    await ctx.db.patch("bags", args.bagId, {
      ...counts,
      lastModified: new Date(deletedAt).toISOString(),
    });
    return null;
  },
});

/** 카드 일괄 생성 (다중 표현용) */
export const createCardsBatch = mutation({
  args: {
    bagId: v.id("bags"),
    userId: v.id("users"),
    cards: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
        hint: v.optional(v.string()),
        explanation: v.optional(v.string()),
        context: v.optional(v.string()),
        sourceWord: v.optional(v.string()),
        expression: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cardIds = [];

    for (const cardData of args.cards) {
      const cardId = await ctx.db.insert("cards", {
        bagId: args.bagId,
        userId: args.userId,
        question: cardData.question,
        answer: cardData.answer,
        hint: cardData.hint,
        explanation: cardData.explanation,
        context: cardData.context,
        sourceWord: cardData.sourceWord,
        expression: cardData.expression,
        tags: [],
        source: "multi-expression",
        ...initialSchedule(now),
      });
      cardIds.push(cardId);
    }

    const bag = await ctx.db.get("bags", args.bagId);
    if (bag && bag.deletedAt === undefined) {
      await ctx.db.patch("bags", args.bagId, {
        totalCards: bag.totalCards + args.cards.length,
        newCards: bag.newCards + args.cards.length,
        lastModified: new Date(now).toISOString(),
      });
    }

    return cardIds;
  },
});
