import { getAuthUserId } from "@convex-dev/auth/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { CLI_CLIENT_ID, CLI_RESOURCE, OAUTH_ISSUER } from "./oauthConfig";
import { sha256Base64Url } from "./oauthProtocol";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  deviceStarts: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 60,
  },
  deviceDecisions: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 10,
  },
});

export const create = internalMutation({
  args: { deviceCodeHash: v.string(), userCodeHash: v.string() },
  returns: v.union(
    v.literal("created"),
    v.literal("slow_down"),
    v.literal("collision")
  ),
  handler: async (ctx, args) => {
    if (!(await rateLimiter.limit(ctx, "deviceStarts")).ok) {
      return "slow_down" as const;
    }
    const existing = await ctx.db
      .query("oauthDeviceCodes")
      .withIndex("by_user_code_hash", (q) =>
        q.eq("userCodeHash", args.userCodeHash)
      )
      .unique();
    if (existing) {
      return "collision" as const;
    }
    const now = Date.now();
    await ctx.db.insert("oauthDeviceCodes", {
      ...args,
      clientId: CLI_CLIENT_ID,
      resource: CLI_RESOURCE,
      scope: "cli:access",
      status: "pending",
      expiresAt: now + 15 * MINUTE,
      intervalMs: 5_000,
      nextPollAt: now + 5_000,
    });
    return "created" as const;
  },
});

// Only an interactive web session can approve a new CLI login. Existing OAuth
// grants must not be able to bootstrap another user's consent or mint sessions.
export const decide = mutation({
  args: { userCode: v.string(), approved: v.boolean() },
  returns: v.union(
    v.literal("approved"),
    v.literal("denied"),
    v.literal("invalid_code"),
    v.literal("slow_down")
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = await getAuthUserId(ctx);
    if (!userId || identity?.issuer === OAUTH_ISSUER) {
      throw new ConvexError("Unauthorized");
    }
    // Return failures instead of throwing so failed guesses consume their quota.
    if (
      !(await rateLimiter.limit(ctx, "deviceDecisions", { key: userId })).ok
    ) {
      return "slow_down" as const;
    }
    const code = args.userCode.toUpperCase().replace(/[-\s]/g, "");
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
      return "invalid_code" as const;
    }
    const userCodeHash = await sha256Base64Url(code);
    const device = await ctx.db
      .query("oauthDeviceCodes")
      .withIndex("by_user_code_hash", (q) => q.eq("userCodeHash", userCodeHash))
      .unique();
    if (
      !device ||
      device.expiresAt <= Date.now() ||
      device.status !== "pending"
    ) {
      return "invalid_code" as const;
    }
    const status = args.approved ? ("approved" as const) : ("denied" as const);
    await ctx.db.patch("oauthDeviceCodes", device._id, { status, userId });
    return status;
  },
});

export const exchange = internalMutation({
  args: {
    deviceCodeHash: v.string(),
    clientId: v.string(),
    resource: v.string(),
    refreshTokenHash: v.string(),
    refreshTokenFamilyId: v.string(),
    refreshTokenExpiresAt: v.number(),
  },
  returns: v.union(
    v.object({ error: v.string() }),
    v.object({
      userId: v.id("users"),
      clientId: v.string(),
      resource: v.string(),
      scope: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("oauthDeviceCodes")
      .withIndex("by_device_code_hash", (q) =>
        q.eq("deviceCodeHash", args.deviceCodeHash)
      )
      .unique();
    if (
      !device ||
      device.clientId !== args.clientId ||
      device.resource !== args.resource ||
      device.status === "used"
    ) {
      return { error: "invalid_grant" };
    }
    const now = Date.now();
    if (device.expiresAt <= now) {
      return { error: "expired_token" };
    }
    if (device.status === "denied") {
      return { error: "access_denied" };
    }
    if (now < device.nextPollAt) {
      const intervalMs = device.intervalMs + 5_000;
      await ctx.db.patch("oauthDeviceCodes", device._id, {
        intervalMs,
        nextPollAt: now + intervalMs,
      });
      return { error: "slow_down" };
    }
    if (device.status === "pending") {
      await ctx.db.patch("oauthDeviceCodes", device._id, {
        nextPollAt: now + device.intervalMs,
      });
      return { error: "authorization_pending" };
    }
    if (!device.userId) {
      return { error: "invalid_grant" };
    }
    await ctx.db.patch("oauthDeviceCodes", device._id, { status: "used" });
    await ctx.db.insert("oauthRefreshTokens", {
      tokenHash: args.refreshTokenHash,
      familyId: args.refreshTokenFamilyId,
      status: "active",
      userId: device.userId,
      clientId: device.clientId,
      resource: device.resource,
      scope: device.scope,
      expiresAt: args.refreshTokenExpiresAt,
    });
    return {
      userId: device.userId,
      clientId: device.clientId,
      resource: device.resource,
      scope: device.scope,
    };
  },
});

export const cleanup = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("oauthDeviceCodes")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now()))
      .take(1_000);
    for (const device of expired) {
      await ctx.db.delete("oauthDeviceCodes", device._id);
    }
    return expired.length;
  },
});
