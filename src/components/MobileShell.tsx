import React, { useState } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import {
  Activity,
  Home,
  ListChecks,
  LucideProps,
  PlayCircle,
  User2,
  Users,
  X,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTranslation } from "react-i18next";
import { languageOptions } from "@/i18n";

interface MobileShellProps {
  children?: React.ReactNode;
}

type TabKey = "home" | "plans" | "run" | "club" | "activity";

const tabPaths: Record<TabKey, string> = {
  home: "/home",
  plans: "/plans",
  run: "/run",
  club: "/club",
  activity: "/activity",
};

const tabConfig: Record<
  TabKey,
  {
    key: TabKey;
    labelKey: string;
    titleKey: string;
    icon: React.ComponentType<LucideProps>;
  }
> = {
  home: { key: "home", labelKey: "nav.home", titleKey: "nav.home", icon: Home },
  plans: {
    key: "plans",
    labelKey: "nav.plans",
    titleKey: "nav.plans",
    icon: ListChecks,
  },
  run: {
    key: "run",
    labelKey: "nav.run",
    titleKey: "nav.run",
    icon: PlayCircle,
  },
  club: {
    key: "club",
    labelKey: "nav.club",
    titleKey: "nav.club",
    icon: Users,
  },
  activity: {
    key: "activity",
    labelKey: "nav.activity",
    titleKey: "nav.activity",
    icon: Activity,
  },
};

export default function MobileShell({ children }: MobileShellProps) {
  const { t } = useTranslation();
  let pathname = "/run";

  const { location } = useRouterState();
  pathname = location.pathname;
  const isRunRoute = pathname.startsWith("/run");

  const activeTab = deriveTabFromPath(pathname);
  const [showProfile, setShowProfile] = useState(false);

  const screenTitle = t(tabConfig[activeTab].titleKey);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/90 px-2 py-1 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          className="z-10 px-2"
          aria-label={t("profileDrawer.openProfile")}
          onClick={() => setShowProfile(true)}
        >
          <User2 className="h-5 w-5 text-gray-700" aria-hidden />
        </Button>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-gray-800">
          {screenTitle}
        </span>
      </header>

      <main
        className={cn(
          "mx-auto",
          isRunRoute ? "w-full max-w-none px-0" : "max-w-5xl px-4"
        )}
      >
        {children}
      </main>

      <BottomNav activeTab={activeTab} />
      <ProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}

function BottomNav({ activeTab }: { activeTab: TabKey }) {
  const router = useRouter();
  const { t } = useTranslation();
  const navigateTo = (path: string) => router.navigate({ to: path });

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full -translate-x-1/2 border-t border-gray-200 bg-white shadow-lg sm:w-160">
      <div className="mx-auto flex max-w-5xl justify-around">
        {Object.values(tabConfig).map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;
          const label = t(tab.labelKey);
          return (
            <Button
              key={tab.key}
              onClick={() => void navigateTo(tabPaths[tab.key])}
              className={cn(
                "w-full flex-col items-center gap-0 py-2 text-xs font-medium",
                isActive
                  ? "text-primary-700 font-bold"
                  : "text-gray-500 hover:text-gray-700"
              )}
              variant="plain"
              size="sm"
              fullWidth
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary-700 stroke-[2.5]" : "text-gray-500"
                )}
                aria-hidden
              />
              <span className="mt-1 capitalize">{label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

function ProfileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { signOut, signIn } = useAuthActions();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const user = useQuery(api.auth.loggedInUser);
  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* <div className="absolute inset-0 bg-black/40" onClick={onClose} /> */}
      <div className="absolute inset-0 flex flex-col bg-white px-4 pt-4 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 text-primary-700 flex h-12 w-12 items-center justify-center rounded-full font-semibold">
              {(user?.name || user?.email || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {t("profileDrawer.title")}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {user?.name || "-"}
              </p>
              {user?.email && (
                <p className="text-sm text-gray-600">{user.email}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="px-2" onClick={onClose}>
            <X className="h-5 w-5 text-gray-700" aria-hidden />
          </Button>
        </div>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="text-gray-600">{t("common.labels.userId")}</span>
            <span className="font-mono break-all text-gray-900">
              {user?._id}
            </span>
          </div>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.set("email", email);
              fd.set("password", password);
              fd.set("flow", "signIn");
              const signInResult = signIn("password", fd);
              Promise.resolve(signInResult)
                .then(() => {
                  toast.success(t("profileDrawer.signInSuccess"));
                  setEmail("");
                  setPassword("");
                  onClose();
                })
                .catch((error) => {
                  console.error("Sign-in error:", error);
                  toast.error(t("profileDrawer.signInError"));
                });
            }}
          >
            <input
              className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
              placeholder={t("common.labels.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
              placeholder={t("common.labels.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              fullWidth
              aria-label={t("common.actions.signIn")}
            >
              {t("common.actions.signIn")}
            </Button>
          </form>
          <div className="space-y-2">
            <label
              className="text-xs font-medium text-gray-600"
              htmlFor="language-select"
            >
              {t("settings.language.label")}
            </label>
            <select
              id="language-select"
              className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
              value={selectedLanguage}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-auto">
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            {t("common.actions.signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function deriveTabFromPath(pathname: string): TabKey {
  if (pathname.startsWith("/plans")) return "plans";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/profile")) return "home";
  if (pathname.startsWith("/run")) return "run";
  if (pathname.startsWith("/club")) return "club";
  if (pathname.startsWith("/home")) return "home";
  return "run";
}
