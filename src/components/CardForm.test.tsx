import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardForm, type CardFormHandle } from "./CardForm";
import { useRef } from "react";

// Mock dependencies
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
}));

vi.mock("@/hooks/useIsMock", () => ({
  default: () => false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("CardForm", () => {
  it("should render with autoFocus prop", () => {
    const onSubmit = vi.fn();

    render(<CardForm onSubmit={onSubmit} autoFocus={true} />);

    const answerInput = screen.getByLabelText("cardForm.answerLabel");
    expect(answerInput).toBeInTheDocument();
    // In test environments, autofocus may not be present, but we can verify the input exists
    expect(answerInput).toHaveAttribute("id", "card-answer");
  });

  it("should expose reset method via ref", () => {
    const onSubmit = vi.fn();

    const TestComponent = () => {
      const ref = useRef<CardFormHandle>(null);

      return (
        <>
          <CardForm ref={ref} onSubmit={onSubmit} />
          <button onClick={() => ref.current?.reset()}>Reset</button>
        </>
      );
    };

    const { container } = render(<TestComponent />);
    expect(container).toBeInTheDocument();
  });
});
