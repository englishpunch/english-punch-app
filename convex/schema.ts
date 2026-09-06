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
  oauthRefreshTokens: defineTable({
    tokenHash: v.string(),
    familyId: v.string(),
    status: v.union(v.literal("active"), v.literal("used")),
    userId: v.id("users"),
    clientId: v.string(),
    resource: v.string(),
    scope: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_family_id_and_status", ["familyId", "status"])
    .index("by_expires_at", ["expiresAt"]),
});
