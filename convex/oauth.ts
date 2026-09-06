import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";

type ExpiringOAuthTable = "oauthAuthorizationCodes" | "oauthRefreshTokens";

const deleteExpiredOAuthDocuments = async (
  ctx: MutationCtx,
  table: ExpiringOAuthTable
) => {
  const expiredDocuments = await ctx.db
    .query(table)
    .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
    .take(1_000);

  for (const document of expiredDocuments) {
    if ("familyId" in document && document.status === "used") {
      const active = await ctx.db
        .query("oauthRefreshTokens")
        .withIndex("by_family_id_and_status", (q) =>
          q.eq("familyId", document.familyId).eq("status", "active")
        )
        .unique();
      if (active && active.expiresAt > Date.now()) {
        await ctx.db.patch("oauthRefreshTokens", document._id, {
          expiresAt: active.expiresAt,
        });
        continue;
      }
    }
    await ctx.db.delete(table, document._id);
  }
  return expiredDocuments.length;
};

const tokenGrantValidator = v.object({
  userId: v.id("users"),
  clientId: v.string(),
  resource: v.string(),
  scope: v.string(),
});

export const storeAuthorizationCode = internalMutation({
  args: {
    codeHash: v.string(),
    userId: v.id("users"),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.string(),
    scope: v.string(),
    codeChallenge: v.string(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("oauthAuthorizationCodes", args);
    return null;
  },
});

export const exchangeAuthorizationCode = internalMutation({
  args: {
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.string(),
    codeChallenge: v.string(),
    refreshTokenHash: v.string(),
    refreshTokenFamilyId: v.string(),
    refreshTokenExpiresAt: v.number(),
    now: v.number(),
  },
  returns: v.union(v.null(), tokenGrantValidator),
  handler: async (ctx, args) => {
    const authorizationCode = await ctx.db
      .query("oauthAuthorizationCodes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .unique();

    if (
      !authorizationCode ||
      authorizationCode.expiresAt <= args.now ||
      authorizationCode.clientId !== args.clientId ||
      authorizationCode.redirectUri !== args.redirectUri ||
      authorizationCode.resource !== args.resource ||
      authorizationCode.codeChallenge !== args.codeChallenge
    ) {
      return null;
    }

    await ctx.db.delete("oauthAuthorizationCodes", authorizationCode._id);
    await ctx.db.insert("oauthRefreshTokens", {
      tokenHash: args.refreshTokenHash,
      familyId: args.refreshTokenFamilyId,
      status: "active",
      userId: authorizationCode.userId,
      clientId: authorizationCode.clientId,
      resource: authorizationCode.resource,
      scope: authorizationCode.scope,
      expiresAt: args.refreshTokenExpiresAt,
    });
    return {
      userId: authorizationCode.userId,
      clientId: authorizationCode.clientId,
      resource: authorizationCode.resource,
      scope: authorizationCode.scope,
    };
  },
});

export const rotateRefreshToken = internalMutation({
  args: {
    tokenHash: v.string(),
    clientId: v.string(),
    resource: v.string(),
    replacementTokenHash: v.string(),
    replacementExpiresAt: v.number(),
    scope: v.optional(v.string()),
    now: v.number(),
  },
  returns: v.union(v.null(), v.literal("invalid_scope"), tokenGrantValidator),
  handler: async (ctx, args) => {
    const refreshToken = await ctx.db
      .query("oauthRefreshTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!refreshToken) {
      return null;
    }
    if (
      refreshToken.clientId !== args.clientId ||
      refreshToken.resource !== args.resource
    ) {
      return null;
    }
    if (refreshToken.status === "used") {
      const activeToken = await ctx.db
        .query("oauthRefreshTokens")
        .withIndex("by_family_id_and_status", (q) =>
          q.eq("familyId", refreshToken.familyId).eq("status", "active")
        )
        .unique();
      if (activeToken) {
        await ctx.db.patch("oauthRefreshTokens", activeToken._id, {
          status: "used",
        });
      }
      return null;
    }
    if (refreshToken.expiresAt <= args.now) {
      await ctx.db.delete("oauthRefreshTokens", refreshToken._id);
      return null;
    }

    const accessTokenScope = args.scope ?? refreshToken.scope;
    const grantedScopes = new Set(refreshToken.scope.split(" "));
    if (
      args.scope &&
      args.scope.split(" ").some((scope) => !grantedScopes.has(scope))
    ) {
      return "invalid_scope";
    }

    await ctx.db.patch("oauthRefreshTokens", refreshToken._id, {
      status: "used",
    });
    await ctx.db.insert("oauthRefreshTokens", {
      tokenHash: args.replacementTokenHash,
      familyId: refreshToken.familyId,
      status: "active",
      userId: refreshToken.userId,
      clientId: refreshToken.clientId,
      resource: refreshToken.resource,
      scope: refreshToken.scope,
      expiresAt: args.replacementExpiresAt,
    });
    return {
      userId: refreshToken.userId,
      clientId: refreshToken.clientId,
      resource: refreshToken.resource,
      scope: accessTokenScope,
    };
  },
});

export const deleteExpiredAuthorizationCodes = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) =>
    await deleteExpiredOAuthDocuments(ctx, "oauthAuthorizationCodes"),
});

export const deleteExpiredRefreshTokens = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) =>
    await deleteExpiredOAuthDocuments(ctx, "oauthRefreshTokens"),
});
