import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { createAppRouter } from "./router";
const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

const mockUserId = "user_1" as Id<"users">;

const setupQueryMock = () => {
  useQueryMock.mockImplementation((query) => {
    switch (query) {
      case api.auth.loggedInUser:
        return { _id: mockUserId } as const;
      case api.fsrs.getRecentReviewLogs:
        return [];
      case api.learning.getUserBags:
        return [];
      case api.learning.getBagCards:
        return [];
      default:
        return undefined;
    }
  });
};

const renderAt = (path: string) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter({ userId: mockUserId, history });
  render(<RouterProvider router={router} />);
};

describe("app routes use per-page Convex queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMock();
  });

  it("/run triggers bags query", () => {
    renderAt("/run");
    return waitFor(() =>
      expect(useQueryMock).toHaveBeenCalledWith(api.learning.getUserBags, {
        userId: mockUserId,
      })
    );
  });

  it("/plans triggers bags query for list view", () => {
    renderAt("/plans");
    return waitFor(() =>
      expect(useQueryMock).toHaveBeenCalledWith(api.learning.getUserBags, {
        userId: mockUserId,
      })
    );
  });

  it("/activity triggers recent review logs query", () => {
    renderAt("/activity");
    return waitFor(() =>
      expect(useQueryMock).toHaveBeenCalledWith(api.fsrs.getRecentReviewLogs, {
        userId: mockUserId,
        limit: 50,
      })
    );
  });

  it("/profile triggers logged in user query", () => {
    renderAt("/profile");
    return waitFor(() =>
      expect(useQueryMock).toHaveBeenCalledWith(api.auth.loggedInUser)
    );
  });
});
