/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as authUser from "../authUser.js";
import type * as cardAggregate from "../cardAggregate.js";
import type * as crons from "../crons.js";
import type * as fsrs from "../fsrs.js";
import type * as fsrsSchema from "../fsrsSchema.js";
import type * as http from "../http.js";
import type * as learning from "../learning.js";
import type * as oauth from "../oauth.js";
import type * as oauthActions from "../oauthActions.js";
import type * as oauthConfig from "../oauthConfig.js";
import type * as oauthHttp from "../oauthHttp.js";
import type * as oauthProtocol from "../oauthProtocol.js";
import type * as review from "../review.js";
import type * as router from "../router.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  authUser: typeof authUser;
  cardAggregate: typeof cardAggregate;
  crons: typeof crons;
  fsrs: typeof fsrs;
  fsrsSchema: typeof fsrsSchema;
  http: typeof http;
  learning: typeof learning;
  oauth: typeof oauth;
  oauthActions: typeof oauthActions;
  oauthConfig: typeof oauthConfig;
  oauthHttp: typeof oauthHttp;
  oauthProtocol: typeof oauthProtocol;
  review: typeof review;
  router: typeof router;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  dueCards: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"dueCards">;
};
