/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as fsrs from "../fsrs.js";
import type * as fsrsSchema from "../fsrsSchema.js";
import type * as http from "../http.js";
import type * as learning from "../learning.js";
import type * as router from "../router.js";
import type * as sampleData from "../sampleData.js";
import type * as studySessions from "../studySessions.js";
import type * as vocabulary from "../vocabulary.js";
import type * as words from "../words.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  fsrs: typeof fsrs;
  fsrsSchema: typeof fsrsSchema;
  http: typeof http;
  learning: typeof learning;
  router: typeof router;
  sampleData: typeof sampleData;
  studySessions: typeof studySessions;
  vocabulary: typeof vocabulary;
  words: typeof words;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
