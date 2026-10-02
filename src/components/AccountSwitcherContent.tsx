import { Check, ChevronDown, LogOut, Plus, UserRound } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslation } from "react-i18next";
import type { AccountSessions } from "@/lib/accountSessions";
import { Button } from "./Button";

type User = { _id: string; email?: string; name?: string };

export default function AccountSwitcherContent({
  sessions,
  user,
  disabled,
  expanded,
}: {
  sessions: AccountSessions;
  user: User | null;
  disabled: boolean;
  expanded: boolean;
}) {
  const { t } = useTranslation();
  const { signOut } = useAuthActions();
  const accounts = useSyncExternalStore(
    sessions.subscribe,
    sessions.getSnapshot
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      return;
    }
    try {
      sessions.register(user);
    } catch {
      queueMicrotask(() => setError("accounts.storageError"));
    }
  }, [sessions, user]);
  const run = (action: () => void) => {
    try {
      setError(null);
      if (user) {
        sessions.register(user);
      }
      action();
    } catch {
      setError("accounts.storageError");
    }
  };
  const logout = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      sessions.forgetCurrent();
    } catch {
      setError("accounts.signOutError");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details
      open={expanded || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
      className="group/account w-full rounded-xl border border-gray-200 bg-white"
    >
      <summary className="focus-visible:outline-primary-500 flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
        <UserRound size={18} className="shrink-0 text-gray-500" aria-hidden />
        <span className="min-w-0 flex-1 break-all">
          {expanded
            ? t("accounts.title")
            : (user?.email ?? t("accounts.choose"))}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 text-gray-400 group-open/account:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-1 border-t border-gray-100 p-2">
        {accounts.map((account) => (
          <Button
            key={account.session}
            variant="plain"
            fullWidth
            disabled={disabled || busy || account.session === sessions.session}
            aria-current={
              account.session === sessions.session ? "true" : undefined
            }
            className="aria-current:bg-primary-50 aria-current:text-primary-800 h-auto min-h-12 justify-start rounded-lg px-3 py-3 text-left text-sm font-medium break-all whitespace-normal hover:bg-gray-50 disabled:opacity-100"
            onClick={() => run(() => sessions.switchAccount(account.session))}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600"
              aria-hidden
            >
              {account.email.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              {account.email}
              {account.session === sessions.session && (
                <span className="mt-0.5 block text-xs font-normal text-gray-500">
                  {t(user ? "accounts.current" : "accounts.expired")}
                </span>
              )}
            </span>
            {account.session === sessions.session && user && (
              <Check size={16} className="shrink-0" aria-hidden />
            )}
          </Button>
        ))}
        {user && (
          <Button
            variant="plain"
            fullWidth
            disabled={disabled || busy}
            className="justify-start px-3 text-sm"
            onClick={() => run(sessions.addAccount)}
          >
            <Plus size={18} aria-hidden />
            {t("accounts.add")}
          </Button>
        )}
        {user && (
          <Button
            variant="ghost"
            fullWidth
            disabled={disabled || busy}
            className="justify-start px-3 text-sm text-gray-600"
            onClick={() => void logout()}
          >
            <LogOut size={18} aria-hidden />
            {t("accounts.signOut")}
          </Button>
        )}
        {error && (
          <p role="alert" className="px-3 py-2 text-sm text-red-600">
            {t(error)}
          </p>
        )}
      </div>
    </details>
  );
}
