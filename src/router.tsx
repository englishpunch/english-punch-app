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
  ProfileRoute,
  RootLayout,
  RunRoute,
} from "./router-components";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { BAG_CARD_SORT_DEFAULTS } from "./lib/bagCardSort";

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
      sortBy: fallback(
        z.enum(["due", "created"]),
        BAG_CARD_SORT_DEFAULTS.sortBy
      ).default(BAG_CARD_SORT_DEFAULTS.sortBy),
      sortDirection: fallback(
        z.enum(["asc", "desc"]),
        BAG_CARD_SORT_DEFAULTS.sortDirection
      ).default(BAG_CARD_SORT_DEFAULTS.sortDirection),
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
