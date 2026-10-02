/** Browser account metadata is separate from tokens owned by Convex Auth.
 * A tab pins its account; switching another tab cannot change an in-flight
 * approval or mutation here. Reloading creates a fresh client and query cache.
 */
type SavedAccount = {
  session: string;
  userId: string;
  email: string;
};

export function createAccountSessions(
  storage: Storage,
  tabStorage: Storage,
  deployment: string,
  reload: () => void
) {
  const prefix = `ep.accounts.${deployment}.`;
  const selectedKey = `${prefix}selected`;
  const accountPrefix = `${prefix}account.`;
  const selected =
    tabStorage.getItem(selectedKey) ?? storage.getItem(selectedKey) ?? "legacy";
  const session = /^[a-zA-Z0-9-]+$/.test(selected) ? selected : "legacy";
  tabStorage.setItem(selectedKey, session);
  const namespaceFor = (id: string) =>
    id === "legacy" ? deployment : `${deployment}/epAccount/${id}`;
  const listeners = new Set<() => void>();
  let snapshot = "";
  let accounts: SavedAccount[] = [];
  const getSnapshot = () => {
    const values: SavedAccount[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(accountPrefix)) {
        continue;
      }
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
        if (
          value &&
          typeof value === "object" &&
          "session" in value &&
          typeof value.session === "string" &&
          /^[a-zA-Z0-9-]+$/.test(value.session) &&
          "userId" in value &&
          typeof value.userId === "string" &&
          "email" in value &&
          typeof value.email === "string" &&
          key === `${accountPrefix}${value.session}`
        ) {
          values.push(value as SavedAccount);
        }
      } catch {
        /* Ignore invalid metadata, never inspect auth tokens. */
      }
    }
    values.sort(
      (a, b) =>
        a.email.localeCompare(b.email) || a.session.localeCompare(b.session)
    );
    const next = JSON.stringify(values);
    if (next !== snapshot) {
      snapshot = next;
      accounts = values;
    }
    return accounts;
  };
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const select = (id: string) => {
    tabStorage.setItem(selectedKey, id);
    storage.setItem(selectedKey, id);
    // Keep device/OAuth query parameters, but discard account-specific app routes.
    reload();
  };
  return {
    session,
    namespace: namespaceFor(session),
    getSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (
          event.storageArea === storage &&
          (event.key === null || event.key.startsWith(accountPrefix))
        ) {
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    register(user: { _id: string; email?: string; name?: string }) {
      const account = {
        session,
        userId: user._id,
        email: user.email ?? user.name ?? user._id,
      };
      const key = `${accountPrefix}${session}`;
      const value = JSON.stringify(account);
      if (storage.getItem(key) === value) {
        return;
      }
      storage.setItem(key, value);
      notify();
    },
    switchAccount(id: string) {
      if (!getSnapshot().some((account) => account.session === id)) {
        throw new Error("Account is no longer saved.");
      }
      select(id);
    },
    addAccount: () => {
      select(crypto.randomUUID());
    },
    forgetCurrent() {
      storage.removeItem(`${accountPrefix}${session}`);
      notify();
    },
  };
}

export type AccountSessions = ReturnType<typeof createAccountSessions>;
