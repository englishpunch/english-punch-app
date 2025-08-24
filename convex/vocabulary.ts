import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user's vocabulary lists
export const getUserWordLists = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("userWordLists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Create a new word list
export const createWordList = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("userWordLists", {
      userId,
      name: args.name,
      description: args.description,
      wordIds: [],
      isPublic: args.isPublic,
    });
  },
});

// Search for words
export const searchWords = query({
  args: {
    searchTerm: v.string(),
    difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db
      .query("words")
      .withSearchIndex("search_words", (q) => {
        let searchQuery = q.search("word", args.searchTerm);
        if (args.difficulty) {
          searchQuery = searchQuery.eq("difficulty", args.difficulty);
        }
        if (args.category) {
          searchQuery = searchQuery.eq("category", args.category);
        }
        return searchQuery;
      });

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

// Get words by difficulty
export const getWordsByDifficulty = query({
  args: {
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let query = ctx.db
      .query("words")
      .withIndex("by_difficulty", (q) => q.eq("difficulty", args.difficulty));

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

// Add word to user's list
export const addWordToList = mutation({
  args: {
    wordListId: v.id("userWordLists"),
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const wordList = await ctx.db.get(args.wordListId);
    if (!wordList || wordList.userId !== userId) {
      throw new Error("Word list not found or access denied");
    }

    // Check if word is already in the list
    if (wordList.wordIds.includes(args.wordId)) {
      return wordList._id;
    }

    // Add word to the list
    await ctx.db.patch(args.wordListId, {
      wordIds: [...wordList.wordIds, args.wordId],
    });

    return wordList._id;
  },
});

// Get user's progress for a specific word
export const getUserWordProgress = query({
  args: {
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("userWordProgress")
      .withIndex("by_user_and_word", (q) => q.eq("userId", userId).eq("wordId", args.wordId))
      .unique();
  },
});

// Update user's progress for a word
export const updateWordProgress = mutation({
  args: {
    wordId: v.id("words"),
    isCorrect: v.boolean(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingProgress = await ctx.db
      .query("userWordProgress")
      .withIndex("by_user_and_word", (q) => q.eq("userId", userId).eq("wordId", args.wordId))
      .unique();

    const now = Date.now();
    const nextReview = calculateNextReview(args.difficulty, args.isCorrect, existingProgress?.timesCorrect || 0);

    if (existingProgress) {
      // Update existing progress
      const newMasteryLevel = calculateMasteryLevel(
        existingProgress.masteryLevel,
        args.isCorrect,
        existingProgress.timesStudied + 1
      );

      await ctx.db.patch(existingProgress._id, {
        masteryLevel: newMasteryLevel,
        timesStudied: existingProgress.timesStudied + 1,
        timesCorrect: args.isCorrect ? existingProgress.timesCorrect + 1 : existingProgress.timesCorrect,
        lastStudied: now,
        nextReview,
        difficulty: args.difficulty,
      });
    } else {
      // Create new progress record
      await ctx.db.insert("userWordProgress", {
        userId,
        wordId: args.wordId,
        masteryLevel: args.isCorrect ? 20 : 5,
        timesStudied: 1,
        timesCorrect: args.isCorrect ? 1 : 0,
        lastStudied: now,
        nextReview,
        difficulty: args.difficulty,
      });
    }
  },
});

// Get words due for review
export const getWordsForReview = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const progressRecords = await ctx.db
      .query("userWordProgress")
      .withIndex("by_user_and_next_review", (q) => q.eq("userId", userId).lte("nextReview", now))
      .take(args.limit || 20);

    // Get the actual word data
    const words = await Promise.all(
      progressRecords.map(async (progress) => {
        const word = await ctx.db.get(progress.wordId);
        return {
          ...word,
          progress,
        };
      })
    );

    return words.filter(word => word !== null);
  },
});

// Helper functions
function calculateMasteryLevel(currentLevel: number, isCorrect: boolean, timesStudied: number): number {
  if (isCorrect) {
    return Math.min(100, currentLevel + (100 - currentLevel) * 0.1);
  } else {
    return Math.max(0, currentLevel - 15);
  }
}

function calculateNextReview(difficulty: string, isCorrect: boolean, timesCorrect: number): number {
  const now = Date.now();
  const baseInterval = 24 * 60 * 60 * 1000; // 1 day in milliseconds

  let multiplier = 1;
  if (isCorrect) {
    multiplier = Math.pow(2, timesCorrect); // Exponential backoff for correct answers
  } else {
    multiplier = 0.5; // Review sooner if incorrect
  }

  // Adjust based on difficulty
  switch (difficulty) {
    case "easy":
      multiplier *= 2;
      break;
    case "hard":
      multiplier *= 0.5;
      break;
    default: // medium
      break;
  }

  return now + (baseInterval * multiplier);
}
