import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ mutation: vi.fn().mockResolvedValue(null) }));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.mutation,
  useQuery: (
    query: Parameters<typeof getFunctionName>[0],
    args?: { bagId?: string }
  ) => {
    switch (getFunctionName(query)) {
      case "auth:loggedInUser":
        return { _id: "user-1" };
      case "learning:getUserBags":
        return [
          {
            _id: "bag-1",
            name: "TOEFL",
            totalCards: 1234,
            newCards: 1234,
            learningCards: 0,
            tags: [],
            isActive: true,
          },
          {
            _id: "bag-2",
            name: "Phrases",
            totalCards: 7,
            newCards: 7,
            learningCards: 0,
            tags: [],
            isActive: true,
          },
        ];
      case "learning:getOneDueCard":
        return {
          _id: `card-${args?.bagId}`,
          reps: 0,
          question: "Study this card",
          answer: "answer",
        };
      case "learning:getDueCardCount":
        return args?.bagId === "bag-1" ? 1234 : 7;
      default:
        return undefined;
    }
  },
}));
vi.mock("./components/MobileShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./components/StudyCard", () => ({ default: () => <p>Study card</p> }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en", resolvedLanguage: "en" },
    t: (key: string, params?: { countDisplay?: string; count?: number }) => {
      if (key === "studySession.cardsDue") {
        return `${params?.countDisplay} cards due`;
      }
      if (key === "bagManager.actions.studyWithCount") {
        return `Study ${params?.count}`;
      }
      return key;
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

let originalStorage: PropertyDescriptor | undefined;
beforeEach(() => {
  originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined },
  });
});
afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(window, "localStorage", originalStorage);
  } else {
    Reflect.deleteProperty(window, "localStorage");
  }
});

it("pushes a bag URL, displays the exact count, and restores Back/Forward navigation", async () => {
  const { createAppRouter } = await import("./router");
  const history = createMemoryHistory({ initialEntries: ["/run"] });
  const router = createAppRouter(history);
  render(<RouterProvider router={router} />);
  const link = await screen.findByRole("link", { name: "Study 1234" });
  expect(link).toHaveAttribute("href", "/run/bag-1");
  fireEvent.click(link);
  await screen.findByText("1,234 cards due");
  expect(router.state.location.pathname).toBe("/run/bag-1");
  expect(history.length).toBe(2);
  expect(screen.getByRole("heading", { name: "TOEFL" })).toBeInTheDocument();
  await act(async () => history.back());
  await screen.findByRole("link", { name: "Study 1234" });
  expect(router.state.location.pathname).toBe("/run");
  await act(async () => history.forward());
  await screen.findByText("1,234 cards due");
  await act(async () =>
    router.navigate({ to: "/run/$bagId", params: { bagId: "bag-2" } })
  );
  await screen.findByText("7 cards due");
  expect(screen.getByRole("heading", { name: "Phrases" })).toBeInTheDocument();
});

it("opens a bag directly and provides a path back to the bag list", async () => {
  const { createAppRouter } = await import("./router");
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ["/run/bag-1"] })
  );
  render(<RouterProvider router={router} />);
  await screen.findByText("1,234 cards due");
  fireEvent.click(screen.getByRole("button", { name: "common.actions.back" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/run"));
  await screen.findByRole("link", { name: "Study 1234" });
});
