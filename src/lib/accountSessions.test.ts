import { Window } from "happy-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { createAccountSessions } from "./accountSessions";

const deployment = "https://accounts.example.test";
const firstUser = { _id: "first", email: "first@example.test" };
const secondUser = { _id: "second", email: "second@example.test" };
const storage = new Window().localStorage;
const tabStorage = new Window().sessionStorage;
beforeEach(() => {
  storage.clear();
  tabStorage.clear();
});

it("preserves the legacy namespace, adds an isolated session, and restores either account", () => {
  const reload = vi.fn();
  const first = createAccountSessions(storage, tabStorage, deployment, reload);
  expect(first.namespace).toBe(deployment);
  first.register(firstUser);
  first.addAccount();
  expect(reload).toHaveBeenCalledOnce();
  const second = createAccountSessions(storage, tabStorage, deployment, reload);
  expect(second.namespace).not.toBe(first.namespace);
  expect(second.getSnapshot()).toEqual([
    { userId: firstUser._id, email: firstUser.email, session: "legacy" },
  ]);
  second.register(secondUser);
  expect(second.getSnapshot()).toHaveLength(2);
  second.switchAccount("legacy");
  const restored = createAccountSessions(
    storage,
    tabStorage,
    deployment,
    reload
  );
  expect(restored.namespace).toBe(first.namespace);
  restored.forgetCurrent();
  expect(restored.getSnapshot()).toEqual([
    {
      session: second.session,
      userId: secondUser._id,
      email: secondUser.email,
    },
  ]);
  expect(() => restored.switchAccount("legacy")).toThrow("no longer saved");
  restored.switchAccount(second.session);
  expect(
    createAccountSessions(storage, tabStorage, deployment, reload).namespace
  ).toBe(second.namespace);
});

it("pins the account in each tab even when another tab changes its selection", () => {
  const first = createAccountSessions(storage, tabStorage, deployment, vi.fn());
  first.register(firstUser);
  const secondTab = new Window().sessionStorage;
  const second = createAccountSessions(storage, secondTab, deployment, vi.fn());
  second.addAccount();
  const currentSecond = createAccountSessions(
    storage,
    secondTab,
    deployment,
    vi.fn()
  );
  currentSecond.register(secondUser);
  expect(
    createAccountSessions(storage, tabStorage, deployment, vi.fn()).session
  ).toBe("legacy");
  expect(
    createAccountSessions(storage, secondTab, deployment, vi.fn()).session
  ).toBe(currentSecond.session);
});

it("keeps metadata deployment-scoped and ignores malformed metadata", () => {
  const store = createAccountSessions(storage, tabStorage, deployment, vi.fn());
  storage.setItem(`ep.accounts.${deployment}.account.bad`, "not json");
  storage.setItem(
    `ep.accounts.${deployment}.account.wrong`,
    JSON.stringify({ session: "other", userId: 7, email: null })
  );
  store.register(firstUser);
  const other = createAccountSessions(
    storage,
    tabStorage,
    "https://other.example.test",
    vi.fn()
  );
  expect(other.getSnapshot()).toEqual([]);
  expect(store.getSnapshot()).toHaveLength(1);
});
