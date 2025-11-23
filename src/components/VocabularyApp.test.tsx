import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VocabularyApp } from "./VocabularyApp";
import { Id } from "../../convex/_generated/dataModel";

vi.mock("./DeckManager", () => ({
  __esModule: true,
  default: () => <div data-testid="deck-manager" />,
}));

const userId = "user_123" as Id<"users">;

describe("VocabularyApp design", () => {
  it("uses a neutral hero surface without responsive layout prefixes", () => {
    const { container } = render(<VocabularyApp userId={userId} />);

    const hero = screen
      .getByRole("heading", { name: /스마트 간격 반복 학습/i })
      .closest("section");
    expect(hero?.className).toContain("from-gray-50");
    expect(hero?.className).not.toMatch(/from-blue|to-purple/);
    expect(container.innerHTML).not.toMatch(/\b(?:sm:|md:|lg:|xl:)/);
  });
});
