import ProfileDialog from "./ProfileDialog";
import React, { useState } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { Activity, ChevronDown, User2 } from "lucide-react";
import {
  BoxingGlove,
  PunchingBag,
  type BoxingIconProps,
} from "boxing-icons/react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTranslation } from "react-i18next";

interface MobileShellProps {
  children?: React.ReactNode;
}

type TabKey = "plans" | "run" | "activity";

const tabPaths: Record<TabKey, string> = {
  plans: "/plans",
  run: "/run",
  activity: "/activity",
};

const tabConfig: Record<
  TabKey,
  {
    key: TabKey;
    labelKey: string;
    titleKey: string;
    icon: React.ComponentType<BoxingIconProps>;
  }
> = {
  plans: {
    key: "plans",
    labelKey: "nav.bags",
    titleKey: "nav.bags",
    icon: PunchingBag,
  },
  run: {
    key: "run",
    labelKey: "nav.run",
    titleKey: "nav.run",
    icon: BoxingGlove,
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
  const user = useQuery(api.auth.loggedInUser);
  const { location } = useRouterState();
  const pathname = location.pathname;

  const activeTab = deriveTabFromPath(pathname);
  const [showProfile, setShowProfile] = useState(false);

  const screenTitle = t(
    pathname.startsWith("/profile")
      ? "common.labels.profile"
      : pathname.startsWith("/home")
        ? "nav.home"
        : pathname.startsWith("/club")
          ? "nav.club"
          : tabConfig[activeTab].titleKey
  );

  return (
    <div className="min-h-screen pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom))] [--shell-bottom-nav-height:5rem] [--shell-header-height:4rem]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white/95 px-4 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight text-gray-900">
          {screenTitle}
        </h1>
        <Button
          variant="plain"
          size="sm"
          className="max-w-[65%] min-w-0 gap-2 rounded-full py-1.5 pr-2 pl-1.5 hover:bg-gray-50"
          aria-label={t("profileDrawer.openProfile")}
          aria-haspopup="dialog"
          onClick={() => setShowProfile(true)}
        >
          <span
            className="bg-primary-50 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            aria-hidden
          >
            {user?.email?.slice(0, 1).toUpperCase() ?? <User2 size={16} />}
          </span>
          <span className="truncate text-xs font-medium text-gray-600">
            {user?.email ?? t("common.labels.profile")}
          </span>
          <ChevronDown
            size={14}
            className="shrink-0 text-gray-400"
            aria-hidden
          />
        </Button>
      </header>

      <main className={cn("mx-auto")}>{children}</main>

      <BottomNav activeTab={activeTab} />
      {showProfile && <ProfileDialog onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function BottomNav({ activeTab }: { activeTab: TabKey }) {
  const router = useRouter();
  const { t } = useTranslation();
  const navigateTo = (path: string) => router.navigate({ to: path });

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full -translate-x-1/2 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] sm:w-160">
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
                "min-h-16 w-full flex-col items-center gap-0 rounded-none py-2 text-xs font-medium",
                isActive
                  ? "text-primary-700 bg-primary-50/60 font-bold"
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

function deriveTabFromPath(pathname: string): TabKey {
  if (pathname.startsWith("/plans")) {
    return "plans";
  }
  if (pathname.startsWith("/activity")) {
    return "activity";
  }
  if (pathname.startsWith("/run")) {
    return "run";
  }
  return "run";
}
