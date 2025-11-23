import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import App from "./App";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: () => vi.fn(),
  useConvexAuth: vi.fn().mockReturnValue({ isAuthenticated: false }),
  Authenticated: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Unauthenticated: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: vi.fn(),
}));

const mockedUseQuery = useQuery as unknown as vi.Mock;
const mockedUseAuthActions = useAuthActions as unknown as vi.Mock;

describe("App shell auth & default tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto signs in anonymously when unauthenticated", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    mockedUseAuthActions.mockReturnValue({ signIn });
    mockedUseQuery.mockReturnValue(null);

    render(<App />);

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("anonymous"));
    expect(screen.getByTestId("global-loader")).toBeInTheDocument();
  });

  it("shows run tab active by default when authenticated", () => {
    mockedUseAuthActions.mockReturnValue({ signIn: vi.fn() });
    mockedUseQuery.mockReturnValue({ _id: "user_1", email: "u@test.com" });

    render(<App />);

    const runTab = screen.getByRole("button", { name: /run/i });
    expect(runTab).toHaveAttribute("aria-current", "page");
  });
});
