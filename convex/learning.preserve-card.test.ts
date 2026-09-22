// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setupReviewedCard } from "./cardReplacement.test-helpers";

describe("card content updates", () => {
  for (const state of [0, 1, 2, 3] as const) {
    for (const suspended of [false, true]) {
      it(`preserves all parameters, history and counts (state ${state}, suspended ${suspended})`, async () => {
        const { owner, read, cardId, bagId } = await setupReviewedCard(
          state,
          suspended
        );
        for (const change of [
          { question: "A new question" },
          { answer: "a new answer" },
          { context: "a new context" },
          { sourceWord: "a new source word" },
          { expression: "a new expression" },
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
          await owner.mutation(api.learning.replaceCardContent, args);
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

  it("reports schedule preservation to connected tools", async () => {
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
    ).toEqual({ updated: true, scheduleReset: false });
    expect(
      await owner.mutation(api.learning.replaceCardContent, {
        ...args,
        answer: "changed",
      })
    ).toEqual({ updated: true, scheduleReset: false });
  });

  it.each([
    api.learning.replaceCardContentAndResetSchedule,
    api.learning.updateCard,
  ])("preserves progress through legacy endpoints %s", async (endpoint) => {
    const { owner, read, cardId, bagId } = await setupReviewedCard();
    const before = await read();
    const change = {
      question: "Changed question",
      answer: "Changed answer",
      hint: "Changed hint",
      explanation: "Changed explanation",
      context: "Changed context",
      sourceWord: "Changed source word",
      expression: "Changed expression",
    };
    expect(await owner.mutation(endpoint, { cardId, bagId, ...change })).toBe(
      true
    );
    const after = await read();
    expect(after.card).toEqual({ ...before.card, ...change });
    expect(after.bag).toEqual({
      ...before.bag,
      lastModified: after.bag.lastModified,
    });
    expect(after.history).toEqual(before.history);
  });
});
