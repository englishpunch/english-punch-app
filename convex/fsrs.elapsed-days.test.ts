import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { State } from "ts-fsrs";
import type { Id } from "./_generated/dataModel";

describe("reviewCard elapsed_days tracking", () => {
  const userId = "user_1" as Id<"users">;
  const cardId = "card_1" as Id<"cards">;
  const bagId = "bag_1" as Id<"bags">;

  const now = new Date("2024-01-07T00:00:00.000Z");
  const lastReview = new Date("2024-01-01T00:00:00.000Z");

  const buildUserSettings = () => ({
    _id: "settings_1",
    userId,
    fsrsParameters: {
      w: Array(17).fill(0.5),
      request_retention: 0.9,
      maximum_interval: 36500,
      enable_fuzz: false,
      enable_short_term: false,
      learning_steps: ["1m", "10m"],
      relearning_steps: ["10m", "1d"],
    },
    dailyNewCards: 20,
    dailyReviewCards: 200,
    timezone: "UTC",
    totalReviews: 0,
    currentStreak: 0,
    longestStreak: 0,
  });

  const buildCard = () => ({
    _id: cardId,
    userId,
    bagId,
    question: "Q",
    answer: "A",
    due: lastReview.getTime(),
    stability: 3,
    difficulty: 3,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 5,
    lapses: 1,
    state: State.Review,
    last_review: lastReview.getTime(),
    tags: [],
    suspended: false,
    // previous interval between prior two reviews
    elapsed_days: 5,
  });

  let ctx: any;
  let patch: ReturnType<typeof vi.fn>;
  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const card = buildCard();
    const userSettings = buildUserSettings();

    patch = vi.fn().mockResolvedValue(undefined);
    insert = vi.fn().mockResolvedValue("log_1");

    ctx = {
      db: {
        get: vi.fn().mockResolvedValue(card),
        patch,
        insert,
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            unique: vi.fn().mockResolvedValue(userSettings),
          }),
        }),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores current and previous elapsed days on card and log", async () => {
    const { reviewCardHandler } = await import("./fsrs");

    await reviewCardHandler(ctx, {
      userId,
      cardId,
      rating: 3,
      duration: 1234,
      sessionId: "session_1",
    });

    // Should persist the interval since last review on the card
    expect(patch).toHaveBeenCalledWith(
      cardId,
      expect.objectContaining({
        elapsed_days: 6,
      }),
    );

    // Should capture both current and previous intervals in the review log
    expect(insert).toHaveBeenCalledWith(
      "reviewLogs",
      expect.objectContaining({
        elapsed_days: 6,
        last_elapsed_days: 5,
      }),
    );
  });

  it("fails fast if FSRS omits elapsed_days", async () => {
    vi.doMock("ts-fsrs", async () => {
      const actual = await vi.importActual<typeof import("ts-fsrs")>("ts-fsrs");
      return {
        ...actual,
        fsrs: () => ({
          next: () => ({
            card: {
              due: new Date("2024-01-08T00:00:00.000Z"),
              stability: 3,
              difficulty: 3,
              scheduled_days: 1,
              learning_steps: 0,
              reps: 6,
              lapses: 1,
              state: State.Review,
              last_review: now,
              // intentionally missing elapsed_days to ensure we don't fallback
            },
            log: {
              rating: 3,
              state: State.Review,
              due: new Date("2024-01-01T00:00:00.000Z"),
              stability: 3,
              difficulty: 3,
              scheduled_days: 1,
              learning_steps: 0,
              review: now,
              // intentionally missing elapsed_days to trigger guard
              last_elapsed_days: 5,
            },
          }),
        }),
      };
    });

    const { reviewCardHandler } = await import("./fsrs");

    await expect(
      reviewCardHandler(ctx, {
        userId,
        cardId,
        rating: 3,
        duration: 1234,
        sessionId: "session_2",
      }),
    ).rejects.toThrow(/elapsed_days/);

    expect(patch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
