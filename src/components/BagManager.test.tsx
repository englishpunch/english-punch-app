import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BagManager from "./BagManager";
import { Id } from "../../convex/_generated/dataModel";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

const userId = "user_123" as Id<"users">;

const sampleBag = {
  _id: "bag_1" as Id<"bags">,
  name: "샘플 샌드백",
  description: "기본 표현 샌드백",
  totalCards: 12,
  newCards: 4,
  learningCards: 3,
  reviewCards: 5,
  tags: ["기초"],
  isActive: true,
};

describe("BagManager design", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue([sampleBag]);
    useMutationMock.mockReturnValue(vi.fn());
  });

  it("keeps actions on the primary palette and avoids responsive class prefixes", async () => {
    const user = userEvent.setup();
    const { container } = render(<BagManager userId={userId} />);

    const studyButton = screen.getByRole("button", { name: /학습하기/i });
    expect(studyButton.className).not.toMatch(/bg-blue|bg-green|bg-orange/);
    expect(studyButton.className).toMatch(/bg-primary/);

    expect(container.innerHTML).not.toMatch(/\b(?:sm:|md:|lg:|xl:)/);

    await user.click(studyButton);
  });
});
