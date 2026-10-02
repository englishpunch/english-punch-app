import { Window } from "happy-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AccountSwitcher from "./AccountSwitcher";
import { AccountSessionsContext } from "@/lib/accountSessionsContext";
import { createAccountSessions } from "@/lib/accountSessions";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const storage = new Window().localStorage;
const tabStorage = new Window().sessionStorage;
beforeEach(() => {
  storage.clear();
  tabStorage.clear();
  signOut.mockReset();
});
afterEach(cleanup);

it("adds an account while retaining the original session and allows returning without signing out", () => {
  const reload = vi.fn();
  const sessions = createAccountSessions(storage, tabStorage, "test", reload);
  const user = { _id: "first", email: "first@example.test" };
  const { unmount } = render(
    <AccountSessionsContext.Provider value={sessions}>
      <AccountSwitcher user={user} />
    </AccountSessionsContext.Provider>
  );
  fireEvent.click(document.querySelector("summary")!);
  fireEvent.click(screen.getByRole("button", { name: "accounts.add" }));
  expect(signOut).not.toHaveBeenCalled();
  expect(sessions.getSnapshot()).toHaveLength(1);
  expect(reload).toHaveBeenCalledOnce();
  unmount();
  const added = createAccountSessions(storage, tabStorage, "test", reload);
  render(
    <AccountSessionsContext.Provider value={added}>
      <AccountSwitcher user={null} />
    </AccountSessionsContext.Provider>
  );
  fireEvent.click(document.querySelector("summary")!);
  fireEvent.click(screen.getByRole("button", { name: user.email }));
  expect(
    createAccountSessions(storage, tabStorage, "test", reload).session
  ).toBe("legacy");
});

it("disables switching during approval and signs out only the current account", async () => {
  const first = createAccountSessions(storage, tabStorage, "test", vi.fn());
  first.register({ _id: "first", email: "first@example.test" });
  first.addAccount();
  const sessions = createAccountSessions(storage, tabStorage, "test", vi.fn());
  const user = { _id: "second", email: "second@example.test" };
  const view = (disabled: boolean) => (
    <AccountSessionsContext.Provider value={sessions}>
      <AccountSwitcher user={user} disabled={disabled} />
    </AccountSessionsContext.Provider>
  );
  const { rerender } = render(view(true));
  fireEvent.click(document.querySelector("summary")!);
  expect(
    screen.getByRole("button", { name: "first@example.test" })
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "accounts.add" })).toBeDisabled();
  rerender(view(false));
  signOut.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "accounts.signOut" }));
  await waitFor(() => expect(sessions.getSnapshot()).toHaveLength(1));
  expect(sessions.getSnapshot()[0].email).toBe("first@example.test");
  expect(signOut).toHaveBeenCalledOnce();
});
