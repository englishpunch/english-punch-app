import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Rating, State } from "ts-fsrs";

/**
 * Schema definitions for an English-learning app backed by
 * the FSRS (Free Spaced Repetition Scheduler) algorithm.
 * Compatible with the ts-fsrs API.
 */
export const learningTables = {
  /**
   * User profile extension with FSRS parameters and study settings.
   * Integrated with the existing users table.
   */
  userSettings: defineTable({
    userId: v.id("users"),

    // FSRS algorithm parameters aligned with the ts-fsrs FSRSParameters interface.
    fsrsParameters: v.object({
      // Base FSRS parameters.
      w: v.array(v.number()), // Weight array.
      request_retention: v.number(), // Target retention, default 0.9.
      maximum_interval: v.number(), // Maximum review interval in days.
      enable_fuzz: v.boolean(), // Enable review interval fuzzing.

      // Short-term learning settings.
      enable_short_term: v.boolean(), // Enable short-term learning steps.
      learning_steps: v.array(v.string()), // Learning steps, e.g. ["1m", "10m"].
      relearning_steps: v.array(v.string()), // Relearning steps.
    }),

    // Study settings.
    dailyNewCards: v.number(), // New cards per day.
    dailyReviewCards: v.number(), // Review cards per day.
    timezone: v.string(), // User timezone.

    // Statistics.
    totalReviews: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastReviewDate: v.optional(v.string()), // ISO date string.
  }).index("by_user", ["userId"]),

  /**
   * Study bag, which is a card group.
   */
  bags: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),

    // Bag settings.
    isActive: v.boolean(),
    sortOrder: v.number(),

    // Statistics.
    totalCards: v.number(),
    newCards: v.number(),
    learningCards: v.number(),
    reviewCards: v.number(),

    // Metadata.
    tags: v.array(v.string()),
    lastModified: v.string(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_active", ["userId", "isActive"])
    .index("by_user_and_deleted_at", ["userId", "deletedAt"]),

  /**
   * Study card, fully compatible with the ts-fsrs Card interface.
   */
  cards: defineTable({
    userId: v.id("users"),
    bagId: v.id("bags"),

    // Card content in fill-in-the-blank format.
    question: v.string(), // "I'd like to ___ a table for two at 7 pm."
    answer: v.string(), // "reserve"
    hint: v.optional(v.string()), // "book in advance"
    explanation: v.optional(v.string()), // Additional explanation.
    context: v.optional(v.string()), // Generation context, such as "advising a friend".
    sourceWord: v.optional(v.string()), // Original source expression for multi-expression generation.
    expression: v.optional(v.string()), // Generated English expression for multi-expression generation.

    // FSRS scheduling data matching the ts-fsrs Card interface.
    due: v.number(), // Next due timestamp, convertible to Date.
    stability: v.number(), // Memory stability.
    difficulty: v.number(), // Card difficulty.
    elapsed_days: v.optional(v.number()), // Days elapsed since the last review.
    scheduled_days: v.number(), // Scheduled interval.
    learning_steps: v.number(), // Current learning step.
    reps: v.number(), // Total review count.
    lapses: v.number(), // Failure count.

    // FSRS state, matching ts-fsrs State enum: 0=New, 1=Learning, 2=Review, 3=Relearning.
    state: v.union(
      v.literal(0), // New
      v.literal(1), // Learning
      v.literal(2), // Review
      v.literal(3) // Relearning
    ),

    // Last review information.
    last_review: v.optional(v.number()), // Last review timestamp.

    // Metadata.
    tags: v.array(v.string()),
    source: v.optional(v.string()), // Card source.
    suspended: v.boolean(), // Whether the card is suspended.
    deletedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_bag", ["bagId"])
    .index("by_user_and_deleted_at", ["userId", "deletedAt"])
    .index("by_bag_and_deleted_at", ["bagId", "deletedAt"])
    .index("by_due", ["due"]) // Sort all cards by due date.
    .index("by_user_and_due", ["userId", "due"]) // Sort each user's cards by due date.
    .index("by_bag_and_due", ["bagId", "due"]) // Sort each bag's cards by due date.
    .index("by_user_bag_deleted_suspended_due", [
      "userId",
      "bagId",
      "deletedAt",
      "suspended",
      "due",
    ])
    .index("by_bag_deleted_user", ["bagId", "deletedAt", "userId"])
    .index("by_user_and_state", ["userId", "state"])
    .index("by_bag_and_state", ["bagId", "state"])
    .index("by_user_and_learning_steps", ["userId", "learning_steps"])
    .index("by_due_and_suspended", ["due", "suspended"]) // Due date plus suspended state.
    .searchIndex("search_answer", {
      searchField: "answer",
      filterFields: ["bagId", "userId", "deletedAt"],
    }),

  /**
   * Review log, fully compatible with the ts-fsrs ReviewLog interface.
   */
  reviewLogs: defineTable({
    userId: v.id("users"),
    cardId: v.id("cards"),

    // Review information, matching ts-fsrs Rating enum: 0=Manual, 1=Again, 2=Hard, 3=Good, 4=Easy.
    rating: v.union(
      v.literal(Rating.Manual), // Manual, unused and excluded from Grade.
      v.literal(Rating.Again), // Again
      v.literal(Rating.Hard), // Hard
      v.literal(Rating.Good), // Good
      v.literal(Rating.Easy) // Easy
    ),

    // Matches the ts-fsrs ReviewLog interface.
    state: v.union(
      v.literal(State.New), // New
      v.literal(State.Learning), // Learning
      v.literal(State.Review), // Review
      v.literal(State.Relearning) // Relearning
    ),
    due: v.number(), // Previously scheduled review timestamp.
    stability: v.number(), // Stability before review.
    difficulty: v.number(), // Difficulty before review.
    scheduled_days: v.number(), // Previously scheduled interval.
    learning_steps: v.number(), // Learning step.
    review: v.number(), // Review timestamp.
    elapsed_days: v.optional(v.number()), // Elapsed days for this review.
    last_elapsed_days: v.optional(v.number()), // Previous review interval.

    // Study time and session information, as additional fields.
    duration: v.number(), // Response time in milliseconds.
    sessionId: v.optional(v.string()), // Study session ID.
    reviewType: v.union(
      v.literal("manual"), // Manual review.
      v.literal("scheduled"), // Scheduled review.
      v.literal("cramming") // Cramming review.
    ),
  })
    .index("by_card", ["cardId"])
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "review"])
    .index("by_session", ["sessionId"])
    .index("by_rating", ["rating"]),

  /**
   * User activity events.
   *
   * `reviewLogs` remains the ledger of completed FSRS reviews. This table owns
   * the behavior timeline and reveal-based heatmap shown in the Activity tab.
   */
  activities: defineTable({
    userId: v.id("users"),
    eventType: v.union(
      v.literal("review_question_seen"),
      v.literal("review_answer_revealed"),
      v.literal("review_rated")
    ),
    occurredAt: v.number(),
    localDate: v.string(), // YYYY-MM-DD in `timezone`
    timezone: v.string(),
    source: v.union(v.literal("web"), v.literal("cli"), v.literal("system")),
    cardId: v.optional(v.id("cards")),
    bagId: v.optional(v.id("bags")),
    attemptId: v.optional(v.string()),
    dedupeKey: v.string(),
    schemaVersion: v.number(),
    payload: v.optional(v.any()),
  })
    .index("by_user_and_occurred_at", ["userId", "occurredAt"])
    .index("by_user_event_date", ["userId", "eventType", "localDate"])
    .index("by_user_date_time", ["userId", "localDate", "occurredAt"])
    .index("by_user_and_dedupe_key", ["userId", "dedupeKey"])
    .index("by_attempt", ["attemptId"]),

  /**
   * In-progress review attempt for the stateless CLI review flow.
   *
   * At most one row per user. Presence plus `revealTime` expresses lifecycle:
   *   no row             -> no in-progress review
   *   row, no revealTime -> question shown, answer hidden
   *   row with revealTime -> answer revealed, waiting for rating
   *
   * Delete the row on rating (`rateReview`) or abandon (`abandonReview`).
   * This dedicated table avoids changing the append-only reviewLogs schema.
   */
  pendingReviews: defineTable({
    userId: v.id("users"),
    cardId: v.id("cards"),
    bagId: v.id("bags"),
    startTime: v.number(), // Date.now() at creation — source of truth for duration
    revealTime: v.optional(v.number()), // Date.now() when answer was revealed
  }).index("by_user", ["userId"]),

  /**
   * Study session.
   */
  sessions: defineTable({
    userId: v.id("users"),
    bagId: v.optional(v.id("bags")), // Which bag this session is for

    // Session information.
    startTime: v.string(), // Start time.
    endTime: v.optional(v.string()), // End time.

    // Ordered card IDs for this session (shuffled once at session start)
    cardIds: v.optional(v.array(v.id("cards"))),

    // Session statistics.
    cardsReviewed: v.number(),
    cardsNew: v.number(),
    cardsLearning: v.number(),
    cardsRelearning: v.number(),

    // Accuracy counts by Rating.
    manualCount: v.number(), // Manual (0)
    againCount: v.number(), // Again (1)
    hardCount: v.number(), // Hard (2)
    goodCount: v.number(), // Good (3)
    easyCount: v.number(), // Easy (4)

    // Average data.
    averageDuration: v.number(), // Average response time.
    averageDifficulty: v.number(), // Average difficulty.

    // Session type.
    sessionType: v.union(
      v.literal("daily"), // Daily study.
      v.literal("custom"), // Custom study.
      v.literal("cramming") // Cramming.
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "startTime"]),

  /**
   * User statistics as aggregate data.
   */
  dailyStats: defineTable({
    userId: v.id("users"),
    date: v.string(), // Date in YYYY-MM-DD format.

    // Daily statistics.
    cardsReviewed: v.number(),
    cardsNew: v.number(),
    cardsLearning: v.number(),
    cardsRelearning: v.number(),

    // Time statistics.
    totalStudyTime: v.number(), // Total study time in milliseconds.
    averageAnswerTime: v.number(), // Average response time.

    // Performance metrics.
    retention: v.number(), // Retention rate.
    correctAnswers: v.number(),
    totalAnswers: v.number(),

    // Rating distribution aligned with the ts-fsrs Rating enum.
    manualCount: v.number(), // Manual (0)
    againCount: v.number(), // Again (1)
    hardCount: v.number(), // Hard (2)
    goodCount: v.number(), // Good (3)
    easyCount: v.number(), // Easy (4)
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"]),

  /**
   * Card templates, prebuilt cards.
   */
  cardTemplates: defineTable({
    // Template information.
    category: v.string(), // For example "daily conversation", "business", or "travel".
    level: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),

    // Card content.
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),

    // Metadata.
    tags: v.array(v.string()),
    source: v.optional(v.string()),
    popularity: v.number(), // Popularity.
    difficulty: v.number(), // Average difficulty.
  })
    .index("by_category", ["category"])
    .index("by_level", ["level"])
    .index("by_category_and_level", ["category", "level"]),
};
