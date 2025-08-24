import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Add a new word to the system (admin function)
export const addWord = mutation({
  args: {
    word: v.string(),
    definition: v.string(),
    pronunciation: v.optional(v.string()),
    partOfSpeech: v.string(),
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    examples: v.array(v.string()),
    synonyms: v.optional(v.array(v.string())),
    antonyms: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if word already exists
    const existingWord = await ctx.db
      .query("words")
      .withIndex("by_word", (q) => q.eq("word", args.word.toLowerCase()))
      .unique();

    if (existingWord) {
      throw new Error("Word already exists");
    }

    return await ctx.db.insert("words", {
      word: args.word.toLowerCase(),
      definition: args.definition,
      pronunciation: args.pronunciation,
      partOfSpeech: args.partOfSpeech,
      difficulty: args.difficulty,
      examples: args.examples,
      synonyms: args.synonyms,
      antonyms: args.antonyms,
      category: args.category,
    });
  },
});

// Get a specific word by ID
export const getWord = query({
  args: {
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.get(args.wordId);
  },
});

// Get words from a specific word list
export const getWordsFromList = query({
  args: {
    wordListId: v.id("userWordLists"),
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

    // Get all words in the list
    const words = await Promise.all(
      wordList.wordIds.map(async (wordId) => {
        const word = await ctx.db.get(wordId);
        const progress = await ctx.db
          .query("userWordProgress")
          .withIndex("by_user_and_word", (q) => q.eq("userId", userId).eq("wordId", wordId))
          .unique();
        
        return {
          ...word,
          progress,
        };
      })
    );

    return words.filter(word => word !== null);
  },
});

// Get random words for practice
export const getRandomWords = query({
  args: {
    count: v.number(),
    difficulty: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let allWords;
    
    if (args.difficulty) {
      allWords = await ctx.db
        .query("words")
        .withIndex("by_difficulty", (q) => q.eq("difficulty", args.difficulty!))
        .collect();
    } else {
      allWords = await ctx.db.query("words").collect();
    }


    
    // Filter by category if specified
    let filteredWords = allWords;
    if (args.category) {
      filteredWords = allWords.filter(word => word.category === args.category);
    }

    // Shuffle and take requested count
    const shuffled = filteredWords.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(args.count, shuffled.length));
  },
});

// Get word categories
export const getWordCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const words = await ctx.db.query("words").collect();
    const categories = new Set<string>();
    
    words.forEach(word => {
      if (word.category) {
        categories.add(word.category);
      }
    });

    return Array.from(categories).sort();
  },
});
