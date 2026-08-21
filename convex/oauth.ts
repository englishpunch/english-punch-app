import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const exchangedCodeValidator = v.object({
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
    now: v.number(),
  },
  returns: v.union(v.null(), exchangedCodeValidator),
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
    return {
      userId: authorizationCode.userId,
      clientId: authorizationCode.clientId,
      resource: authorizationCode.resource,
      scope: authorizationCode.scope,
    };
  },
});

export const deleteExpiredAuthorizationCodes = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expiredCodes = await ctx.db
      .query("oauthAuthorizationCodes")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", now))
      .take(1_000);

    for (const code of expiredCodes) {
      await ctx.db.delete("oauthAuthorizationCodes", code._id);
    }
    return expiredCodes.length;
  },
});
