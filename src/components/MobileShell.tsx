import React, { useMemo, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import DeckManager from "./DeckManager";
import ActivityPage from "./ActivityPage";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import {
  Activity,
  Home,
  ListChecks,
  PlayCircle,
  User2,
  Users,
  X,
} from "lucide-react";
import { SignOutButton } from "../SignOutButton";

interface MobileShellProps {
  user: { _id: Id<"users">; email?: string; name?: string };
}

type TabKey = "home" | "plans" | "run" | "club" | "activity";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "home", label: "home", icon: Home },
  { key: "plans", label: "plans", icon: ListChecks },
  { key: "run", label: "run", icon: PlayCircle },
  { key: "club", label: "club", icon: Users },
  { key: "activity", label: "activity", icon: Activity },
];

export default function MobileShell({ user }: MobileShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("run");
  const [showProfile, setShowProfile] = useState(false);

  const screenTitle = useMemo(() => {
    switch (activeTab) {
      case "home":
        return "Home";
      case "plans":
        return "Plans";
      case "run":
        return "Run";
      case "club":
        return "Club";
      case "activity":
        return "Activity";
      default:
        return "";
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          aria-label="open profile"
          onClick={() => setShowProfile(true)}
        >
          <User2 className="h-5 w-5 text-gray-700" aria-hidden />
        </Button>
        <span className="text-sm font-semibold text-gray-800">
          {screenTitle}
        </span>
        <div className="w-9" aria-hidden />
      </header>

      <main className="px-4 py-6 max-w-5xl mx-auto">
        {activeTab === "home" && (
          <HomeTab userName={user.name || user.email || "learner"} />
        )}
        {activeTab === "plans" && <ComingSoon label="플랜" />}
        {activeTab === "run" && <RunTab userId={user._id} />}
        {activeTab === "club" && <ComingSoon label="클럽" />}
        {activeTab === "activity" && <ActivityPage userId={user._id} />}
      </main>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      <ProfileDrawer
        open={showProfile}
        onClose={() => setShowProfile(false)}
        user={user}
      />
    </div>
  );
}

function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-5xl mx-auto flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "flex flex-col items-center py-2 w-full text-xs font-medium transition-colors",
                isActive
                  ? "text-primary-700"
                  : "text-gray-500 hover:text-gray-700"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary-700" : "text-gray-500"
                )}
                aria-hidden
              />
              <span className="mt-1 capitalize">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function HomeTab({ userName }: { userName: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <p className="text-sm text-gray-600">
          학습 콘텐츠와 이벤트가 여기에 표시될 예정입니다.
        </p>
      </div>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 text-center space-y-3">
      <p className="text-lg font-semibold text-gray-900">
        {label} 페이지 준비중
      </p>
      <p className="text-sm text-gray-600">조금만 기다려주세요.</p>
    </div>
  );
}

function RunTab({ userId }: { userId: Id<"users"> }) {
  return (
    <div className="space-y-4">
      <DeckManager userId={userId} />
    </div>
  );
}

function ProfileDrawer({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: { _id: Id<"users">; email?: string; name?: string };
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 bg-white rounded-t-3xl pt-6 px-4 pb-10 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
              {(user.name || user.email || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-600">내 프로필</p>
              <p className="text-lg font-semibold text-gray-900">
                {user.name || "익명"}
              </p>
              {user.email && (
                <p className="text-sm text-gray-600">{user.email}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="px-2" onClick={onClose}>
            <X className="h-5 w-5 text-gray-700" aria-hidden />
          </Button>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <span className="text-gray-600">사용자 ID</span>
            <span className="font-mono text-gray-900">{user._id}</span>
          </div>
        </div>
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
