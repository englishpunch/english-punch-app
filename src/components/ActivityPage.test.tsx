import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ActivityPage from "./ActivityPage";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: query }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const values = new Map<string, unknown>();
const day = {
  date: "2026-09-16",
  questionSeenCount: 1,
  revealCount: 1,
  ratedCount: 1,
  intensity: 1,
};
const history = {
  summary: day,
  activities: [
    {
      _id: "rated",
      eventType: "review_rated",
      occurredAt: 0,
      timezone: "Asia/Seoul",
      payload: {
        questionSnapshot: "A question that can load independently",
        answerSnapshot: "answer",
        rating: 3,
      },
    },
  ],
};

beforeEach(() => {
  values.clear();
  query.mockReset();
  values.set("auth:loggedInUser", { _id: "user" });
  query.mockImplementation((ref: FunctionReference<"query">, args: unknown) =>
    args === "skip" ? undefined : values.get(getFunctionName(ref))
  );
});
afterEach(cleanup);

it("renders history while the heatmap is still loading", () => {
  values.set("activities:getLatestActivityDate", {
    date: day.date,
    hasActivity: true,
  });
  values.set("activities:getActivitiesByDate", history);
  render(<ActivityPage />);
  expect(screen.getByTestId("activity-heatmap-loading")).toBeInTheDocument();
  expect(
    screen.getByText("A question that can load independently")
  ).toBeInTheDocument();
  expect(
    query.mock.calls.some(
      ([ref, args]) =>
        getFunctionName(ref) === "activities:getActivitiesByDate" &&
        args.localDate === day.date
    )
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: /activity.summary.rated/ })
  ).toHaveAttribute("aria-pressed", "true");
});

it("renders the heatmap independently and preserves a selected date when the latest-date query resolves", () => {
  values.set("activities:getActivityHeatmap", {
    fromDate: day.date,
    toDate: day.date,
    days: [day],
  });
  const { rerender } = render(<ActivityPage />);
  expect(
    screen.getByTestId(`activity-heatmap-cell-${day.date}`)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByTestId(`activity-heatmap-cell-${day.date}`));
  values.set("activities:getLatestActivityDate", {
    date: "2026-09-15",
    hasActivity: true,
  });
  values.set("activities:getActivitiesByDate", history);
  rerender(<ActivityPage />);
  expect(screen.getByRole("heading", { name: day.date })).toBeInTheDocument();
  expect(
    screen.getByText("A question that can load independently")
  ).toBeInTheDocument();
});

it("shows the no-activity state without waiting for the heatmap", () => {
  values.set("activities:getLatestActivityDate", {
    date: day.date,
    hasActivity: false,
  });
  render(<ActivityPage />);
  expect(screen.getByText("activity.emptyTitle")).toBeInTheDocument();
  expect(screen.getByTestId("activity-heatmap-loading")).toBeInTheDocument();
});
