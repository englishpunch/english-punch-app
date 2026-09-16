// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setupReviewedCard } from "./cardReplacement.test-helpers";

describe("helper-only card updates", () => {
  for (const state of [0, 1, 2, 3] as const) {
    for (const suspended of [false, true]) {
      it(`preserves all parameters, history and counts (state ${state}, suspended ${suspended})`, async () => {
        const { owner, read, cardId, bagId } = await setupReviewedCard(
          state,
          suspended
        );
        for (const change of [
          { hint: "dejected" },
          { explanation: "A loss of confidence or hope." },
          { hint: "", explanation: "" },
          {},
        ]) {
          const before = await read();
          const args = {
            cardId,
            bagId,
            question: before.card.question,
            answer: before.card.answer,
            hint: before.card.hint,
            explanation: before.card.explanation,
            ...change,
          };
          await owner.mutation(
            api.learning.replaceCardContentAndResetSchedule,
            args
          );
          const after = await read();
          expect(after.card).toEqual({ ...before.card, ...change });
          expect(after.history).toEqual(before.history);
          expect(after.bag).toEqual({
            ...before.bag,
            lastModified: after.bag.lastModified,
          });
        }
      });
    }
  }

  it("reports schedule preservation and resets accurately to connected tools", async () => {
    const { owner, read, cardId, bagId } = await setupReviewedCard();
    const before = await read();
    const args = {
      cardId,
      bagId,
      question: before.card.question,
      answer: before.card.answer,
      hint: "updated hint",
      explanation: before.card.explanation,
    };
    expect(await owner.mutation(api.learning.replaceCardContent, args)).toEqual(
      { updated: true, scheduleReset: false }
    );
    expect((await read()).card).toEqual({
      ...before.card,
      hint: "updated hint",
    });
    expect(
      await owner.mutation(api.learning.replaceCardContent, {
        ...args,
        answer: "changed",
      })
    ).toEqual({ updated: true, scheduleReset: true });
    expect(
      await owner.mutation(api.learning.replaceCardContent, {
        ...args,
        answer: "changed",
      })
    ).toEqual({ updated: true, scheduleReset: false });
  });

  it.each([
    "question",
    "answer",
    "context",
    "sourceWord",
    "expression",
  ] as const)("still resets the schedule when %s changes", async (field) => {
    const { owner, read, cardId, bagId } = await setupReviewedCard();
    const before = await read();
    await owner.mutation(api.learning.replaceCardContentAndResetSchedule, {
      cardId,
      bagId,
      question: before.card.question,
      answer: before.card.answer,
      hint: before.card.hint,
      explanation: before.card.explanation,
      [field]: "changed",
    });
    const after = await read();
    expect(after.card).toMatchObject({
      state: 0,
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      scheduled_days: 0,
      learning_steps: 0,
    });
    expect(after.card.last_review).toBeUndefined();
    expect(after.card.elapsed_days).toBeUndefined();
    expect(after.bag).toMatchObject({ newCards: 1, reviewCards: 0 });
    expect(after.history).toEqual(before.history);
  });
});
