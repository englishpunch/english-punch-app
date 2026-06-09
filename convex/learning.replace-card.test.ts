import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { replaceCardContentAndResetScheduleHandler } from "./learning";

describe("replaceCardContentAndResetScheduleHandler", () => {
  const cardId = "card_1" as Id<"cards">;
  const bagId = "bag_1" as Id<"bags">;
  const now = new Date("2026-06-09T00:00:00.000Z");

  let patch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    patch = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces content and resets FSRS schedule including elapsed_days", async () => {
    const card = {
      _id: cardId,
      bagId,
      question: "old question",
      answer: "old",
      due: new Date("2026-07-01T00:00:00.000Z").getTime(),
      stability: 12,
      difficulty: 6,
      elapsed_days: 14,
      scheduled_days: 20,
      learning_steps: 0,
      reps: 8,
      lapses: 2,
      state: 2,
      last_review: new Date("2026-06-01T00:00:00.000Z").getTime(),
      tags: [],
      suspended: false,
    };

    const bag = {
      _id: bagId,
      newCards: 3,
      learningCards: 4,
      reviewCards: 5,
    };

    const ctx = {
      db: {
        get: vi.fn(
          async (table: "cards" | "bags", id: Id<"cards"> | Id<"bags">) => {
            if (id === cardId) {
              return card;
            }
            if (id === bagId) {
              return bag;
            }
            return null;
          }
        ),
        patch,
      },
    };

    await replaceCardContentAndResetScheduleHandler(ctx as never, {
      cardId,
      bagId,
      question: "I felt ___ after reading the rejection letter.",
      answer: "disheartened",
      hint: "discouraged, dejected, low-spirited",
      explanation: "Use when someone has lost confidence or hope.",
      context: "after a rejection",
    });

    expect(patch).toHaveBeenCalledWith(
      "cards",
      cardId,
      expect.objectContaining({
        question: "I felt ___ after reading the rejection letter.",
        answer: "disheartened",
        hint: "discouraged, dejected, low-spirited",
        explanation: "Use when someone has lost confidence or hope.",
        context: "after a rejection",
        due: now.getTime(),
        stability: 0,
        difficulty: 0,
        elapsed_days: undefined,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: undefined,
        suspended: false,
      })
    );

    expect(patch).toHaveBeenCalledWith(
      "bags",
      bagId,
      expect.objectContaining({
        newCards: 4,
        learningCards: 4,
        reviewCards: 4,
      })
    );
  });
});
