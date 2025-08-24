import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Vocabulary words in the system
  words: defineTable({
    word: v.string(),
    definition: v.string(),
    pronunciation: v.optional(v.string()),
    partOfSpeech: v.string(), // noun, verb, adjective, etc.
    difficulty: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    examples: v.array(v.string()),
    synonyms: v.optional(v.array(v.string())),
    antonyms: v.optional(v.array(v.string())),
    category: v.optional(v.string()), // business, academic, daily, etc.
  })
    .index("by_word", ["word"])
    .index("by_difficulty", ["difficulty"])
    .index("by_category", ["category"])
    .searchIndex("search_words", {
      searchField: "word",
      filterFields: ["difficulty", "partOfSpeech", "category"],
    }),

  // User's personal vocabulary lists
  userWordLists: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    wordIds: v.array(v.id("words")),
    isPublic: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_public", ["userId", "isPublic"]),

  // User's study progress for individual words
  userWordProgress: defineTable({
    userId: v.id("users"),
    wordId: v.id("words"),
    masteryLevel: v.number(), // 0-100
    timesStudied: v.number(),
    timesCorrect: v.number(),
    lastStudied: v.number(),
    nextReview: v.number(), // timestamp for spaced repetition
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  })
    .index("by_user_and_word", ["userId", "wordId"])
    .index("by_user_and_next_review", ["userId", "nextReview"])
    .index("by_user", ["userId"]),

  // Study sessions
  studySessions: defineTable({
    userId: v.id("users"),
    wordListId: v.optional(v.id("userWordLists")),
    sessionType: v.union(
      v.literal("flashcards"),
      v.literal("quiz"),
      v.literal("spelling"),
      v.literal("definition_match")
    ),
    wordsStudied: v.array(v.id("words")),
    correctAnswers: v.number(),
    totalQuestions: v.number(),
    duration: v.number(), // in seconds
    completedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "completedAt"]),

  // Daily goals and streaks
  userStats: defineTable({
    userId: v.id("users"),
    currentStreak: v.number(),
    longestStreak: v.number(),
    totalWordsLearned: v.number(),
    totalStudySessions: v.number(),
    dailyGoal: v.number(), // words per day
    lastStudyDate: v.optional(v.number()),
    weeklyStats: v.object({
      monday: v.number(),
      tuesday: v.number(),
      wednesday: v.number(),
      thursday: v.number(),
      friday: v.number(),
      saturday: v.number(),
      sunday: v.number(),
    }),
  })
    .index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
