import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { learningTables } from "./fsrsSchema";

export default defineSchema({
  ...authTables,
  ...learningTables,
  oauthAuthorizationCodes: defineTable({
    codeHash: v.string(),
    userId: v.id("users"),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.string(),
    scope: v.string(),
    codeChallenge: v.string(),
    expiresAt: v.number(),
  })
    .index("by_code_hash", ["codeHash"])
    .index("by_expires_at", ["expiresAt"]),
});
