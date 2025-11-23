import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StudyCard from "./StudyCard";

const baseCard = {
  _id: "card_1",
  question: "What is the capital of France?",
  answer: "Paris",
  hint: "Eiffel Tower",
  explanation: "Paris is the capital city.",
  state: 0,
  reps: 1,
};

describe("StudyCard design", () => {
  it("uses primary/gray palette for rating buttons and avoids responsive classes", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StudyCard card={baseCard} onGrade={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /답 보기/i }));

    const ratingButtons = [/다시/i, /어려움/i, /보통/i, /쉬움/i].map((label) =>
      screen.getByRole("button", { name: label }),
    );

    ratingButtons.forEach((button) => {
      expect(button.className).not.toMatch(/bg-(?:blue|green|orange|purple)/);
      expect(button.className).toMatch(/bg-primary|bg-red/);
    });

    expect(container.innerHTML).not.toMatch(/\b(?:sm:|md:|lg:|xl:)/);
  });
});
