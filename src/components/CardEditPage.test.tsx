import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { api } from "../../convex/_generated/api";
import { setupReviewedCard } from "../../convex/cardReplacement.test-helpers";
import CardEditPage from "./CardEditPage";

const hooks = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
  params: {},
  navigate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => hooks.query(...args),
  useMutation: () => hooks.mutate,
  useAction: () => vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => hooks.params,
  useNavigate: () => hooks.navigate,
  useSearch: () => false,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("editing a reviewed card through the frontend", () => {
  it.each(["hint", "explanation"] as const)(
    "saves only %s without changing parameters or history",
    async (field) => {
      const { owner, read, bagId, cardId, userId } = await setupReviewedCard();
      const before = await read();
      hooks.params = { bagId, cardId };
      hooks.query.mockImplementation((ref) => {
        switch (getFunctionName(ref)) {
          case "auth:loggedInUser":
            return { _id: userId };
          case "learning:getUserBags":
            return [before.bag];
          case "learning:getCard":
            return before.card;
        }
      });
      hooks.mutate.mockImplementation((args) =>
        owner.mutation(api.learning.replaceCardContentAndResetSchedule, args)
      );
      const { container } = render(<CardEditPage />);
      fireEvent.change(container.querySelector(`#card-${field}`)!, {
        target: { value: "Updated helper text" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "cardEdit.submitLabel" })
      );
      await waitFor(() => expect(hooks.navigate).toHaveBeenCalled());
      const after = await read();
      expect(after.card).toEqual({
        ...before.card,
        context: "",
        [field]: "Updated helper text",
      });
      expect(after.history).toEqual(before.history);
      expect(after.bag).toEqual({
        ...before.bag,
        lastModified: after.bag.lastModified,
      });
    }
  );
});
