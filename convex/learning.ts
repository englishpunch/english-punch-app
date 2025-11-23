import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * 샘플 덱 생성 - 영어 학습용 기본 카드들
 */
export const createSampleDeck = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.id("decks"),
  handler: async (ctx, args) => {
    console.log("🎯 CreateSampleDeck started for userId:", args.userId);

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

    // 샘플 덱 생성
    console.log("📦 Creating sample deck");
    const deckId = await ctx.db.insert("decks", {
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
    console.log("✅ Sample deck created:", deckId);

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
        deckId: deckId,
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

    // 덱 통계 업데이트
    console.log("📊 Updating deck statistics");
    await ctx.db.patch(deckId, {
      totalCards: cardCount,
      newCards: cardCount,
      lastModified: nowIsoString,
    });

    console.log("✅ CreateSampleDeck completed:", {
      deckId,
      cardCount,
      totalCards: cardCount,
      newCards: cardCount,
    });

    return deckId;
  },
});

/**
 * 사용자의 덱 목록 조회
 */
export const getUserDecks = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("decks"),
      name: v.string(),
      description: v.optional(v.string()),
      totalCards: v.number(),
      newCards: v.number(),
      learningCards: v.number(),
      reviewCards: v.number(),
      tags: v.array(v.string()),
      isActive: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const decks = await ctx.db
      .query("decks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return decks.map((deck) => ({
      _id: deck._id,
      name: deck.name,
      description: deck.description,
      totalCards: deck.totalCards,
      newCards: deck.newCards,
      learningCards: deck.learningCards,
      reviewCards: deck.reviewCards,
      tags: deck.tags,
      isActive: deck.isActive,
    }));
  },
});

/**
 * 덱의 학습 가능한 카드들 조회 (due date 기준)
 */
export const getDueCards = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("cards"),
      question: v.string(),
      answer: v.string(),
      hint: v.optional(v.string()),
      explanation: v.optional(v.string()),
      due: v.number(),
      state: v.number(),
      reps: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const nowTimestamp = Date.now();
    const limit = args.limit || 10;

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_user_and_due", (q) =>
        q.eq("userId", args.userId).lte("due", nowTimestamp),
      )
      .filter((q) => q.eq(q.field("deckId"), args.deckId))
      .filter((q) => q.eq(q.field("suspended"), false))
      .order("asc")
      .take(limit);

    return cards.map((card) => ({
      _id: card._id,
      question: card.question,
      answer: card.answer,
      hint: card.hint,
      explanation: card.explanation,
      due: card.due,
      state: card.state,
      reps: card.reps,
    }));
  },
});

/**
 * 새로운 카드들 조회 (state = 0)
 */
export const getNewCards = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("cards"),
      question: v.string(),
      answer: v.string(),
      hint: v.optional(v.string()),
      explanation: v.optional(v.string()),
      due: v.number(),
      state: v.number(),
      reps: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const cards = await ctx.db
      .query("cards")
      .withIndex(
        "by_user_and_state",
        (q) => q.eq("userId", args.userId).eq("state", 0), // New cards
      )
      .filter((q) => q.eq(q.field("deckId"), args.deckId))
      .filter((q) => q.eq(q.field("suspended"), false))
      .take(limit);

    return cards.map((card) => ({
      _id: card._id,
      question: card.question,
      answer: card.answer,
      hint: card.hint,
      explanation: card.explanation,
      due: card.due,
      state: card.state,
      reps: card.reps,
    }));
  },
});

/**
 * 덱 통계 업데이트
 */
export const updateDeckStats = mutation({
  args: {
    deckId: v.id("decks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 각 상태별 카드 수 계산
    const allCards = await ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const stats = {
      totalCards: allCards.length,
      newCards: allCards.filter((card) => card.state === 0).length,
      learningCards: allCards.filter((card) => card.state === 1).length,
      reviewCards: allCards.filter((card) => card.state === 2).length,
    };

    await ctx.db.patch(args.deckId, {
      ...stats,
      lastModified: new Date().toISOString(),
    });

    console.log("📊 Deck statistics updated:", { deckId: args.deckId, stats });
    return null;
  },
});

/**
 * 덱 상세 통계 조회
 */
export const getDeckDetailStats = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      deckInfo: v.object({
        _id: v.id("decks"),
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
    }),
  ),
  handler: async (ctx, args) => {
    // 덱 정보 조회
    const deck = await ctx.db.get(args.deckId);
    if (!deck || deck.userId !== args.userId) {
      return null;
    }

    // 모든 카드 조회
    const allCards = await ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
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
        (card) => card.due <= nowTimestamp && !card.suspended,
      ).length,
    };

    // 난이도 분포 (0-10 범위)
    const difficultyDistribution = {
      veryEasy: allCards.filter((card) => card.difficulty <= 2).length,
      easy: allCards.filter(
        (card) => card.difficulty > 2 && card.difficulty <= 4,
      ).length,
      medium: allCards.filter(
        (card) => card.difficulty > 4 && card.difficulty <= 6,
      ).length,
      hard: allCards.filter(
        (card) => card.difficulty > 6 && card.difficulty <= 8,
      ).length,
      veryHard: allCards.filter((card) => card.difficulty > 8).length,
    };

    // 안정성 분포 (일 단위)
    const stabilityDistribution = {
      veryLow: allCards.filter((card) => card.stability <= 1).length,
      low: allCards.filter((card) => card.stability > 1 && card.stability <= 7)
        .length,
      medium: allCards.filter(
        (card) => card.stability > 7 && card.stability <= 30,
      ).length,
      high: allCards.filter(
        (card) => card.stability > 30 && card.stability <= 90,
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
      deckInfo: {
        _id: deck._id,
        name: deck.name,
        description: deck.description,
        tags: deck.tags,
        totalCards: deck.totalCards,
        newCards: deck.newCards,
        learningCards: deck.learningCards,
        reviewCards: deck.reviewCards,
        lastModified: deck.lastModified,
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
 * 새로운 덱 생성
 */
export const createDeck = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const nowIso = new Date().toISOString();
    const deckId = await ctx.db.insert("decks", {
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
    return deckId;
  },
});

/** 삭제: 덱과 카드 */
export const deleteDeck = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    await Promise.all(cards.map((c) => ctx.db.delete(c._id)));
    await ctx.db.delete(args.deckId);
    return null;
  },
});

/** 덱의 카드 전체 조회 (관리용) */
export const getDeckCards = query({
  args: {
    deckId: v.id("decks"),
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("cards"),
      question: v.string(),
      answer: v.string(),
      hint: v.optional(v.string()),
      explanation: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    return cards.map((c) => ({
      _id: c._id,
      question: c.question,
      answer: c.answer,
      hint: c.hint,
      explanation: c.explanation,
    }));
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
  state: 0,
  last_review: undefined,
  suspended: false,
});

/** 카드 생성 */
export const createCard = mutation({
  args: {
    deckId: v.id("decks"),
    userId: v.id("users"),
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("cards", {
      deckId: args.deckId,
      userId: args.userId,
      question: args.question,
      answer: args.answer,
      hint: args.hint,
      explanation: args.explanation,
      tags: [],
      source: "manual",
      ...initialSchedule(now),
    });

    const deck = await ctx.db.get(args.deckId);
    if (deck) {
      await ctx.db.patch(args.deckId, {
        totalCards: deck.totalCards + 1,
        newCards: deck.newCards + 1,
        lastModified: new Date(now).toISOString(),
      });
    }
    return null;
  },
});

/** 카드 수정 + 스케줄 초기화 */
export const updateCard = mutation({
  args: {
    deckId: v.id("decks"),
    cardId: v.id("cards"),
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),
    due: v.optional(v.number()),
    stability: v.optional(v.number()),
    difficulty: v.optional(v.number()),
    scheduled_days: v.optional(v.number()),
    learning_steps: v.optional(v.number()),
    reps: v.optional(v.number()),
    lapses: v.optional(v.number()),
    state: v.optional(v.union(v.literal(0), v.literal(1), v.literal(2), v.literal(3))),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card || card.deckId !== args.deckId) return null;

    const now = Date.now();
    await ctx.db.patch(args.cardId, {
      question: args.question,
      answer: args.answer,
      hint: args.hint,
      explanation: args.explanation,
      ...initialSchedule(now),
    });

    const deck = await ctx.db.get(args.deckId);
    if (deck) {
      // 이전 상태가 0이 아니면 newCards 증가, 다른 상태 감소는 생략 (간단 집계)
      const newCards = deck.newCards + (card.state === 0 ? 0 : 1);
      const learningCards = deck.learningCards - (card.state === 1 ? 1 : 0);
      const reviewCards = deck.reviewCards - (card.state === 2 ? 1 : 0);
      await ctx.db.patch(args.deckId, {
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
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    const deck = await ctx.db.get(args.deckId);
    if (!card || !deck) return null;
    await ctx.db.delete(args.cardId);

    const counts = {
      totalCards: deck.totalCards - 1,
      newCards: deck.newCards - (card.state === 0 ? 1 : 0),
      learningCards: deck.learningCards - (card.state === 1 ? 1 : 0),
      reviewCards: deck.reviewCards - (card.state === 2 ? 1 : 0),
    };
    await ctx.db.patch(args.deckId, {
      ...counts,
      lastModified: new Date().toISOString(),
    });
    return null;
  },
});
