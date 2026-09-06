import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "delete expired OAuth authorization codes",
  { hours: 1 },
  internal.oauth.deleteExpiredAuthorizationCodes
);

crons.interval(
  "delete expired OAuth refresh tokens",
  { hours: 1 },
  internal.oauth.deleteExpiredRefreshTokens
);

export default crons;
