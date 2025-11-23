import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityPage from "./ActivityPage";
import { useQuery } from "convex/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const mockedUseQuery = useQuery as unknown as vi.Mock;

describe("ActivityPage", () => {
  it("shows rating and question from review logs", () => {
    mockedUseQuery.mockReturnValue([
      {
        _id: "log1",
        cardId: "card1",
        rating: 3,
        state: 2,
        review: 1700000000000,
        duration: 1200,
        question: "What is the capital of France?",
      },
    ]);

    render(<ActivityPage userId={"user_1" as any} />);

    expect(screen.getByText(/Good/i)).toBeInTheDocument();
    expect(screen.getByText(/capital of France/i)).toBeInTheDocument();
  });
});
