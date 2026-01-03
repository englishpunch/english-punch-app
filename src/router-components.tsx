import { Outlet } from "@tanstack/react-router";
import ActivityPage from "./components/ActivityPage";
import BagManager from "./components/BagManager";
import ComingSoon from "./components/ComingSoon";
import MobileShell from "./components/MobileShell";
import BagListPage from "./components/BagListPage";
import BagDetailPage from "./components/BagDetailPage";
import ProfilePage from "./components/ProfilePage";

export function RootLayout() {
  return (
    <MobileShell>
      <Outlet />
    </MobileShell>
  );
}

export function RunRoute() {
  return <BagManager />;
}

export function PlansRoute() {
  return <BagListPage />;
}

export function PlansBagDetailRoute() {
  return <BagDetailPage />;
}

export function ActivityRoute() {
  return <ActivityPage />;
}

export function ProfileRoute() {
  return <ProfilePage />;
}

export function HomeRoute() {
  return <ComingSoon label="Home" />;
}

export function ClubRoute() {
  return <ComingSoon label="클럽" />;
}
