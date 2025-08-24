import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create a new study session
export const createStudySession = mutation({
  args: {
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
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const sessionId = await ctx.db.insert("studySessions", {
      userId,
      wordListId: args.wordListId,
      sessionType: args.sessionType,
      wordsStudied: args.wordsStudied,
      correctAnswers: args.correctAnswers,
      totalQuestions: args.totalQuestions,
      duration: args.duration,
      completedAt: Date.now(),
    });

    // Update user stats
    await updateUserStats(ctx, userId, args.wordsStudied.length);

    return sessionId;
  },
});

// Get user's study sessions
export const getUserStudySessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// Get user statistics
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return stats;
  },
});

// Update daily goal
export const updateDailyGoal = mutation({
  args: {
    dailyGoal: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (stats) {
      await ctx.db.patch(stats._id, {
        dailyGoal: args.dailyGoal,
      });
    } else {
      await ctx.db.insert("userStats", {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalWordsLearned: 0,
        totalStudySessions: 0,
        dailyGoal: args.dailyGoal,
        weeklyStats: {
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0,
        },
      });
    }
  },
});

// Initialize user stats
export const initializeUserStats = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingStats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingStats) {
      return existingStats;
    }

    const statsId = await ctx.db.insert("userStats", {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      totalWordsLearned: 0,
      totalStudySessions: 0,
      dailyGoal: 10,
      weeklyStats: {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
      },
    });

    return await ctx.db.get(statsId);
  },
});

// Helper function to update user stats
async function updateUserStats(ctx: any, userId: string, wordsStudied: number) {
  let stats = await ctx.db
    .query("userStats")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  const now = Date.now();
  const today = new Date(now);
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof stats.weeklyStats;

  if (stats) {
    // Check if this is a new day for streak calculation
    const lastStudyDate = stats.lastStudyDate ? new Date(stats.lastStudyDate) : null;
    const isNewDay = !lastStudyDate || 
      today.toDateString() !== lastStudyDate.toDateString();

    let newStreak = stats.currentStreak;
    if (isNewDay) {
      // Check if it's consecutive days
      if (lastStudyDate) {
        const daysDiff = Math.floor((now - stats.lastStudyDate!) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          newStreak += 1;
        } else if (daysDiff > 1) {
          newStreak = 1; // Reset streak
        }
      } else {
        newStreak = 1; // First study session
      }
    }

    await ctx.db.patch(stats._id, {
      currentStreak: newStreak,
      longestStreak: Math.max(stats.longestStreak, newStreak),
      totalWordsLearned: stats.totalWordsLearned + wordsStudied,
      totalStudySessions: stats.totalStudySessions + 1,
      lastStudyDate: now,
      weeklyStats: {
        ...stats.weeklyStats,
        [dayOfWeek]: stats.weeklyStats[dayOfWeek] + wordsStudied,
      },
    });
  }
}
