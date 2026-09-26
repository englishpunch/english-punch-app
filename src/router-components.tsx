import { Outlet, useNavigate, useParams } from "@tanstack/react-router";
import ActivityPage from "./components/ActivityPage";
import BagManager from "./components/BagManager";
import FSRSStudySession from "./components/FSRSStudySession";
import type { Id } from "../convex/_generated/dataModel";
import ComingSoon from "./components/ComingSoon";
import MobileShell from "./components/MobileShell";
import BagListPage from "./components/BagListPage";
import BagDetailPage from "./components/BagDetailPage";
import CardAddPage from "./components/CardAddPage";
import CardEditPage from "./components/CardEditPage";
import ProfilePage from "./components/ProfilePage";
import { useTranslation } from "react-i18next";

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

export function RunBagRoute() {
  const { bagId } = useParams({ from: "/run/$bagId" });
  const navigate = useNavigate();
  return (
    <FSRSStudySession
      key={bagId}
      bagId={bagId as Id<"bags">}
      onComplete={() => void navigate({ to: "/run" })}
    />
  );
}

export function PlansRoute() {
  return <BagListPage />;
}

export function PlansBagDetailRoute() {
  return <BagDetailPage />;
}

export function CardAddRoute() {
  return <CardAddPage />;
}

export function CardEditRoute() {
  return <CardEditPage />;
}

export function ActivityRoute() {
  return <ActivityPage />;
}

export function ProfileRoute() {
  return <ProfilePage />;
}

export function HomeRoute() {
  const { t } = useTranslation();
  return <ComingSoon label={t("nav.home")} />;
}

export function ClubRoute() {
  const { t } = useTranslation();
  return <ComingSoon label={t("nav.club")} />;
}
