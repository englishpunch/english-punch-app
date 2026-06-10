import { paginationOptsValidator } from "convex/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create a sample bag with starter English-learning cards.
 */
export const createSampleBag = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.id("bags"),
  handler: async (ctx, args) => {
    console.log("🎯 CreateSampleBag started for userId:", args.userId);

    // Check or create user settings.
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!userSettings) {
      console.log("👤 Creating user settings with default FSRS parameters");

      // Create user settings with default FSRS settings.
      const userSettingsId = await ctx.db.insert("userSettings", {
        userId: args.userId,
        fsrsParameters: {
          w: [
            0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
            1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
            1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
          ], // FSRS-6 defaults
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

    // Create the sample bag.
    console.log("📦 Creating sample bag");
    const bagId = await ctx.db.insert("bags", {
      userId: args.userId,
      name: "Basic English Expressions",
      description: "Practice common English expressions used in daily life.",
      isActive: true,
      sortOrder: 1,
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      tags: ["basic", "daily conversation"],
      lastModified: new Date().toISOString(),
    });
    console.log("✅ Sample bag created:", bagId);

    // Sample cards.
    const sampleCards = [
      {
        question: "I'd like to ___ a table for two at 7 pm.",
        answer: "reserve",
        hint: "book in advance",
        explanation:
          "Use this expression when booking a table at a restaurant.",
      },
      {
        question: "Could you ___ me the way to the station?",
        answer: "show",
        hint: "give directions",
        explanation: "This is a polite expression for asking directions.",
      },
      {
        question: "I'm ___ forward to seeing you.",
        answer: "looking",
        hint: "anticipating",
        explanation: "Use this to say you are excited to meet someone.",
      },
      {
        question: "How ___ have you been studying English?",
        answer: "long",
        hint: "duration of time",
        explanation: "Use this when asking about a duration of time.",
      },
      {
        question: "I ___ up early this morning.",
        answer: "woke",
        hint: "stopped sleeping",
        explanation:
          "This is the past tense of wake, meaning to stop sleeping.",
      },
      {
        question: "Can you ___ me a favor?",
        answer: "do",
        hint: "help with something",
        explanation: "Use this phrase when asking someone for help.",
      },
      {
        question: "I'm ___ about the weather today.",
        answer: "worried",
        hint: "concerned",
        explanation:
          "This adjective describes feeling concerned about something.",
      },
      {
        question: "Let's ___ in touch.",
        answer: "keep",
        hint: "maintain contact",
        explanation: "Use this expression to suggest staying in contact.",
      },
      {
        question: "I ___ my keys somewhere.",
        answer: "lost",
        hint: "can't find",
        explanation: "Use this when you cannot find something you had.",
      },
      {
        question: "Could you ___ down the music?",
        answer: "turn",
        hint: "make quieter",
        explanation: "Use this when asking someone to make sound quieter.",
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

        // Initial FSRS state for a new card.
        due: nowTimestamp,
        stability: 0,
        difficulty: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0, // New
        last_review: undefined,

        // Metadata.
        tags: ["basic"],
        source: "starter package",
        suspended: false,
      });
      cardCount++;
      console.log(`📄 Card ${cardCount} created:`, {
        cardId,
        question: cardData.question,
      });
    }

    // Update bag statistics.
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
 * Get a user's bag list.
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
 * Get one studyable card, ordered by due date.
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
      .withIndex("by_user_bag_deleted_suspended_due", (q) =>
        q
          .eq("userId", userId)
          .eq("bagId", args.bagId)
          .eq("deletedAt", undefined)
          .eq("suspended", false)
          .lte("due", nowTimestamp)
      )
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
      .withIndex("by_user_bag_deleted_suspended_due", (q) =>
        q
          .eq("userId", userId)
          .eq("bagId", args.bagId)
          .eq("deletedAt", undefined)
          .eq("suspended", false)
          .lte("due", nowTimestamp)
      )
      .take(101);

    return dueCardsList.length;
  },
});

/**
 * Update bag statistics.
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
    // Count cards by state.
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

const stateCountField = (state: 0 | 1 | 2 | 3) => {
  if (state === 0) {
    return "newCards";
  }
  if (state === 1) {
    return "learningCards";
  }
  if (state === 2) {
    return "reviewCards";
  }
  return null;
};

const buildMovedBagStats = (
  bag: {
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
  },
  state: 0 | 1 | 2 | 3,
  direction: 1 | -1
) => {
  const patch: {
    totalCards: number;
    newCards?: number;
    learningCards?: number;
    reviewCards?: number;
  } = {
    totalCards: Math.max(0, bag.totalCards + direction),
  };
  const field = stateCountField(state);
  if (field) {
    patch[field] = Math.max(0, bag[field] + direction);
  }
  return patch;
};

export const disableCardForRun = mutation({
  args: {
    cardId: v.id("cards"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const card = await ctx.db.get("cards", args.cardId);
    if (!card || card.userId !== userId || card.deletedAt !== undefined) {
      throw new ConvexError("Card not found");
    }

    if (card.suspended) {
      return null;
    }

    const nowIso = new Date().toISOString();
    await ctx.db.patch("cards", args.cardId, {
      suspended: true,
    });

    const bag = await ctx.db.get("bags", card.bagId);
    if (bag && bag.userId === userId && bag.deletedAt === undefined) {
      await ctx.db.patch("bags", card.bagId, {
        lastModified: nowIso,
      });
    }

    return null;
  },
});

export const moveCardToBag = mutation({
  args: {
    cardId: v.id("cards"),
    targetBagId: v.id("bags"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const card = await ctx.db.get("cards", args.cardId);
    if (!card || card.userId !== userId || card.deletedAt !== undefined) {
      throw new ConvexError("Card not found");
    }

    if (card.bagId === args.targetBagId) {
      return null;
    }

    const [sourceBag, targetBag] = await Promise.all([
      ctx.db.get("bags", card.bagId),
      ctx.db.get("bags", args.targetBagId),
    ]);

    if (
      !sourceBag ||
      sourceBag.userId !== userId ||
      sourceBag.deletedAt !== undefined
    ) {
      throw new ConvexError("Source bag not found");
    }

    if (
      !targetBag ||
      targetBag.userId !== userId ||
      targetBag.deletedAt !== undefined
    ) {
      throw new ConvexError("Target bag not found");
    }

    const nowIso = new Date().toISOString();
    await ctx.db.patch("cards", args.cardId, {
      bagId: args.targetBagId,
    });
    await ctx.db.patch("bags", card.bagId, {
      ...buildMovedBagStats(sourceBag, card.state, -1),
      lastModified: nowIso,
    });
    await ctx.db.patch("bags", args.targetBagId, {
      ...buildMovedBagStats(targetBag, card.state, 1),
      lastModified: nowIso,
    });

    return null;
  },
});

/**
 * Get detailed bag statistics.
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
    // Get bag information.
    const bag = await ctx.db.get("bags", args.bagId);
    if (!bag || bag.userId !== args.userId || bag.deletedAt !== undefined) {
      return null;
    }

    // Get all cards.
    const allCards = await ctx.db
      .query("cards")
      .withIndex("by_bag_and_deleted_at", (q) =>
        q.eq("bagId", args.bagId).eq("deletedAt", undefined)
      )
      .collect();

    const nowTimestamp = Date.now();

    // Basic card statistics.
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

    // Difficulty distribution on a 0-10 scale.
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

    // Stability distribution in days.
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

    // Review count distribution.
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

    // Lapse count distribution.
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
 * Create a new bag.
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

/** Delete a bag and its cards. */
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

/** Get a single card. */
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
      sourceWord: card.sourceWord,
      expression: card.expression,
    };
  },
});

/** Get a paginated card page for a bag, 30 cards at a time. */
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
          .withIndex("by_bag_deleted_user", (q) =>
            q
              .eq("bagId", args.bagId)
              .eq("deletedAt", undefined)
              .eq("userId", args.userId)
          )
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
        sourceWord: c.sourceWord,
        expression: c.expression,
      })),
    };
  },
});

const initialSchedule = (now: number) => ({
  due: now,
  stability: 0,
  difficulty: 0,
  elapsed_days: undefined,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0 as const,
  last_review: undefined,
  suspended: false,
});

const cardContentReplacementArgs = {
  bagId: v.id("bags"),
  cardId: v.id("cards"),
  question: v.string(),
  answer: v.string(),
  hint: v.optional(v.string()),
  explanation: v.optional(v.string()),
  context: v.optional(v.string()),
  sourceWord: v.optional(v.string()),
  expression: v.optional(v.string()),
};

type CardContentReplacementArgs = {
  bagId: Id<"bags">;
  cardId: Id<"cards">;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  context?: string;
  sourceWord?: string;
  expression?: string;
};

export const replaceCardContentAndResetScheduleHandler = async (
  ctx: MutationCtx,
  args: CardContentReplacementArgs
) => {
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
};

/** Create a card. */
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

/** Replace card content and reset the FSRS schedule. */
export const replaceCardContentAndResetSchedule = mutation({
  args: cardContentReplacementArgs,
  returns: v.null(),
  handler: replaceCardContentAndResetScheduleHandler,
});

/** @deprecated use replaceCardContentAndResetSchedule */
export const updateCard = mutation({
  args: {
    ...cardContentReplacementArgs,
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
  returns: v.null(),
  handler: replaceCardContentAndResetScheduleHandler,
});

/** Delete a card. */
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

/** Create cards in bulk for multiple expressions. */
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
