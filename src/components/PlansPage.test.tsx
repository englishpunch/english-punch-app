import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PlansPage from "./PlansPage";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const mockedUseQuery = useQuery as unknown as vi.Mock;
const mockedUseMutation = useMutation as unknown as vi.Mock;

describe("PlansPage decks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMutation.mockImplementation(() => vi.fn());
  });

  it("adds and deletes decks", async () => {
    const user = userEvent.setup();
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.deckId) return [];
      return [{ _id: "deck1", name: "Deck 1", totalCards: 0 }];
    });

    render(<PlansPage userId={"user_1" as any} />);

    await user.type(screen.getByPlaceholderText(/새 덱 이름/i), "New Deck");
    await user.click(screen.getByRole("button", { name: /덱 추가/i }));

    const hasCreateDeck = mockedUseMutation.mock.results.some((r) =>
      (r.value as vi.Mock).mock.calls.some((call: any[]) => call[0]?.name === "New Deck"),
    );
    expect(hasCreateDeck).toBe(true);

    await user.click(screen.getByRole("button", { name: /삭제 deck 1/i }));
    const hasDeleteDeck = mockedUseMutation.mock.results.some((r) =>
      (r.value as vi.Mock).mock.calls.some((call: any[]) => call[0]?.deckId === "deck1"),
    );
    expect(hasDeleteDeck).toBe(true);
  });
});

describe("PlansPage cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMutation.mockImplementation(() => vi.fn());
  });

  it("adds, edits (with reset), and deletes cards in a deck", async () => {
    const user = userEvent.setup();
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.deckId) {
        return [
          { _id: "card1", question: "Q1", answer: "A1", hint: "H1", explanation: "E1" },
        ];
      }
      return [{ _id: "deck1", name: "Deck 1", totalCards: 1 }];
    });

    render(<PlansPage userId={"user_1" as any} />);

    await user.click(screen.getByRole("button", { name: /관리 deck 1/i }));

    // add card
    await user.type(screen.getByPlaceholderText(/질문을 입력/i), "What? ");
    await user.type(screen.getByPlaceholderText(/정답을 입력/i), "Answer");
    await user.click(screen.getByRole("button", { name: /카드 추가/i }));

    const createCardSpy = mockedUseMutation.mock.results.find((r) => r.value.mock.calls.some((c: any[]) => c[0]?.question === "What? "))?.value as vi.Mock;
    expect(createCardSpy).toBeTruthy();
    expect(createCardSpy).toHaveBeenCalledWith({
      deckId: "deck1",
      userId: "user_1",
      question: "What? ",
      answer: "Answer",
      hint: "",
      explanation: "",
    });

    // edit card
    await user.click(screen.getByRole("button", { name: /수정 card1/i }));
    const questionInput = screen.getByDisplayValue(/Q1/);
    await user.clear(questionInput);
    await user.type(questionInput, "Q1 edited");
    await user.click(screen.getByRole("button", { name: /저장 card1/i }));

    const updateCardSpy = mockedUseMutation.mock.results
      .map((r) => r.value as vi.Mock)
      .find((spy) => spy.mock.calls.some((call) => call[0]?.cardId === "card1" && call[0]?.question === "Q1 edited"));
    expect(updateCardSpy).toBeTruthy();
    const lastCall = updateCardSpy!.mock.calls.find((call) => call[0].question === "Q1 edited")[0];
    expect(lastCall.state).toBe(0);
    expect(lastCall.reps).toBe(0);
    expect(lastCall.lapses).toBe(0);
    expect(lastCall.scheduled_days).toBe(0);
    expect(lastCall.learning_steps).toBe(0);
    expect(lastCall.stability).toBe(0);
    expect(lastCall.difficulty).toBe(0);
    expect(typeof lastCall.due).toBe("number");

    // delete card
    await user.click(screen.getByRole("button", { name: /삭제 card1/i }));
    const deleteCardSpy = mockedUseMutation.mock.results
      .map((r) => r.value as vi.Mock)
      .find((spy) => spy.mock.calls.some((call) => call[0]?.cardId === "card1" && call[0]?.question === undefined));
    expect(deleteCardSpy).toBeTruthy();
    expect(deleteCardSpy).toHaveBeenCalledWith({ cardId: "card1", deckId: "deck1" });
  });
});
