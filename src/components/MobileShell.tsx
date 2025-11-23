import React, { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import DeckManager from "./DeckManager";
import ActivityPage from "./ActivityPage";
import PlansPage from "./PlansPage";
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
import { useAuthActions } from "@convex-dev/auth/react";

interface MobileShellProps {
  user: { _id: Id<"users">; email?: string; name?: string };
}

type TabKey = "home" | "plans" | "run" | "club" | "activity";

const tabs: Record<
  TabKey,
  { key: TabKey; label: string; title: string; icon: React.ElementType }
> = {
  home: { key: "home", label: "home", title: "Home", icon: Home },
  plans: { key: "plans", label: "plans", title: "Plans", icon: ListChecks },
  run: { key: "run", label: "run", title: "Run", icon: PlayCircle },
  club: { key: "club", label: "club", title: "Club", icon: Users },
  activity: {
    key: "activity",
    label: "activity",
    title: "Activity",
    icon: Activity,
  },
};

export default function MobileShell({ user }: MobileShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("run");
  const [showProfile, setShowProfile] = useState(false);

  const screenTitle = tabs[activeTab].title;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200 px-2 py-1 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 z-10"
          aria-label="open profile"
          onClick={() => setShowProfile(true)}
        >
          <User2 className="h-5 w-5 text-gray-700" aria-hidden />
        </Button>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-gray-800">
          {screenTitle}
        </span>
      </header>

      <main className="px-4 py-6 max-w-5xl mx-auto">
        {activeTab === "home" && (
          <HomeTab userName={user.name || user.email || "learner"} />
        )}
        {activeTab === "plans" && <PlansPage userId={user._id} />}
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
        {Object.values(tabs).map((tab) => {
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

function HomeTab({ userName: _userName }: { userName: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
        <p className="text-sm text-gray-600">
          학습 콘텐츠와 이벤트가 추가될 예정입니다.
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
  const { signOut, signIn } = useAuthActions();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* <div className="absolute inset-0 bg-black/40" onClick={onClose} /> */}
      <div className="absolute inset-0 bg-white pt-4 px-4 pb-10 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
              {(user.name || user.email || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-600">내 프로필</p>
              <p className="text-lg font-semibold text-gray-900">
                {user.name || "-"}
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
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <span className="text-gray-600">사용자 ID</span>
            <span className="font-mono text-gray-900 break-all">
              {user._id}
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
              void signIn("password", fd);
            }}
          >
            <input
              className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" fullWidth aria-label="로그인">
              로그인
            </Button>
          </form>
        </div>
        <div className="mt-auto">
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
