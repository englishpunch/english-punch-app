import {
  createHashHistory,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  Router,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { Id } from "../convex/_generated/dataModel";
import BagManager from "./components/BagManager";
import PlansPage from "./components/PlansPage";
import ActivityPage from "./components/ActivityPage";
import ProfilePage from "./components/ProfilePage";
import MobileShell from "./components/MobileShell";
import ComingSoon from "./components/ComingSoon";

type RouterContext = { userId: Id<"users"> };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/run" />,
});

const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/run",
  component: RunRoute,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/home",
  component: HomeRoute,
});

const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plans",
  component: PlansRoute,
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityRoute,
});

const clubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/club",
  component: ClubRoute,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfileRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  homeRoute,
  runRoute,
  plansRoute,
  activityRoute,
  profileRoute,
  clubRoute,
]);

type History = ReturnType<typeof createMemoryHistory>;

export const createAppRouter = ({
  userId,
  history,
}: {
  userId: Id<"users">;
  history?: History;
}) => {
  const context = { userId } as RouterContext;
  const router = createRouter({
    routeTree,
    history: history ?? createHashHistory(),
    context,
    defaultPreload: "intent",
  });

  router.update({ context });

  return router;
};

// Type augmentation for TanStack Router
const __routerForTypes = createAppRouter({
  userId: "router-user" as Id<"users">,
  history: createMemoryHistory({ initialEntries: ["/run"] }),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof __routerForTypes;
  }
}

function RootLayout() {
  const router = useRouter();
  const userId = router.options.context?.userId;

  if (!userId) {
    throw new Error("router context missing userId");
  }

  const user = { _id: userId } as const;

  return (
    <MobileShell user={user}>
      <Outlet />
    </MobileShell>
  );
}

function RunRoute() {
  const router = useRouter();
  const userId = router.options.context.userId;
  return <BagManager userId={userId} />;
}

function PlansRoute() {
  const router = useRouter();
  const userId = router.options.context.userId;
  return <PlansPage userId={userId} />;
}

function ActivityRoute() {
  const router = useRouter();
  const userId = router.options.context.userId;
  return <ActivityPage userId={userId} />;
}

function ProfileRoute() {
  return <ProfilePage />;
}

function HomeRoute() {
  return <ComingSoon label="Home" />;
}

function ClubRoute() {
  return <ComingSoon label="클럽" />;
}
