import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from "@tanstack/react-router";
import {
  ActivityRoute,
  ClubRoute,
  HomeRoute,
  PlansRoute,
  PlansBagDetailRoute,
  CardAddRoute,
  CardEditRoute,
  BatchCardCreationRoute,
  ProfileRoute,
  RootLayout,
  RunRoute,
} from "./router-components";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const rootRoute = createRootRoute({
  component: RootLayout,
  validateSearch: zodValidator(
    z.object({
      mock: fallback(z.boolean().optional(), false),
    })
  ),
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

const plansBagDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plans/$bagId",
  component: PlansBagDetailRoute,
  validateSearch: zodValidator(
    z.object({
      search: fallback(z.string().optional(), ""),
    })
  ),
});

const cardAddRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plans/$bagId/cards/new",
  component: CardAddRoute,
});

const cardEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plans/$bagId/cards/$cardId/edit",
  component: CardEditRoute,
});

const batchCardCreationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plans/$bagId/cards/batch",
  component: BatchCardCreationRoute,
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
  plansBagDetailRoute,
  cardAddRoute,
  cardEditRoute,
  batchCardCreationRoute,
  activityRoute,
  profileRoute,
  clubRoute,
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
