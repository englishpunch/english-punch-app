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
          w: [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567], // FSRS-5 기본값
          request_retention: 0.9,
          maximum_interval: 36500,
          enable_fuzz: false,
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
      createdAt: new Date().toISOString(),
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

    const now = new Date().toISOString();
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
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0, // New
        last_review: undefined,
        
        // 메타데이터
        tags: ["기초"],
        source: "기본 패키지",
        createdAt: now,
        suspended: false,
      });
      cardCount++;
      console.log(`📄 Card ${cardCount} created:`, { cardId, question: cardData.question });
    }

    // 덱 통계 업데이트
    console.log("📊 Updating deck statistics");
    await ctx.db.patch(deckId, {
      totalCards: cardCount,
      newCards: cardCount,
      lastModified: now,
    });

    console.log("✅ CreateSampleDeck completed:", { 
      deckId, 
      cardCount, 
      totalCards: cardCount,
      newCards: cardCount
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
  returns: v.array(v.object({
    _id: v.id("decks"),
    name: v.string(),
    description: v.optional(v.string()),
    totalCards: v.number(),
    newCards: v.number(),
    learningCards: v.number(),
    reviewCards: v.number(),
    tags: v.array(v.string()),
    isActive: v.boolean(),
  })),
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
  returns: v.array(v.object({
    _id: v.id("cards"),
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),
    due: v.string(),
    state: v.number(),
    reps: v.number(),
  })),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const limit = args.limit || 10;

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_user_and_due", (q) => 
        q.eq("userId", args.userId).lte("due", now)
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
  returns: v.array(v.object({
    _id: v.id("cards"),
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),
    due: v.string(),
    state: v.number(),
    reps: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_user_and_state", (q) => 
        q.eq("userId", args.userId).eq("state", 0) // New cards
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
      newCards: allCards.filter(card => card.state === 0).length,
      learningCards: allCards.filter(card => card.state === 1).length,
      reviewCards: allCards.filter(card => card.state === 2).length,
    };

    await ctx.db.patch(args.deckId, {
      ...stats,
      lastModified: new Date().toISOString(),
    });

    console.log("📊 Deck statistics updated:", { deckId: args.deckId, stats });
    return null;
  },
});