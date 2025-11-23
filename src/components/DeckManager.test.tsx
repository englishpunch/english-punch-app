import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeckManager from "./DeckManager";
import { Id } from "../../convex/_generated/dataModel";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

const userId = "user_123" as Id<"users">;

const sampleDeck = {
  _id: "deck_1" as Id<"decks">,
  name: "샘플 덱",
  description: "기본 표현 덱",
  totalCards: 12,
  newCards: 4,
  learningCards: 3,
  reviewCards: 5,
  tags: ["기초"],
  isActive: true,
};

describe("DeckManager design", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue([sampleDeck]);
    useMutationMock.mockReturnValue(vi.fn());
  });

  it("keeps actions on the primary palette and avoids responsive class prefixes", async () => {
    const user = userEvent.setup();
    const { container } = render(<DeckManager userId={userId} />);

    const studyButton = screen.getByRole("button", { name: /학습하기/i });
    expect(studyButton.className).not.toMatch(/bg-blue|bg-green|bg-orange/);
    expect(studyButton.className).toMatch(/bg-primary/);

    expect(container.innerHTML).not.toMatch(/\b(?:sm:|md:|lg:|xl:)/);

    await user.click(studyButton);
  });
});
