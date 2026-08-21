import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  oauthRedirect,
  randomOAuthToken,
  sha256Base64Url,
  validateAuthorizationRequest,
  validateChatGptClient,
} from "./oauthProtocol";

export const completeAuthorization = action({
  args: {
    approved: v.boolean(),
    responseType: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.string(),
    scope: v.string(),
    state: v.optional(v.string()),
    codeChallenge: v.string(),
    codeChallengeMethod: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Unauthorized");
    }

    const scope = validateAuthorizationRequest(args);
    await validateChatGptClient(args.clientId, args.redirectUri);

    if (!args.approved) {
      return oauthRedirect(args.redirectUri, {
        error: "access_denied",
        state: args.state,
      });
    }

    const code = randomOAuthToken();
    await ctx.runMutation(internal.oauth.storeAuthorizationCode, {
      codeHash: await sha256Base64Url(code),
      userId,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      resource: args.resource,
      scope,
      codeChallenge: args.codeChallenge,
      expiresAt: Date.now() + 5 * 60 * 1_000,
    });

    return oauthRedirect(args.redirectUri, { code, state: args.state });
  },
});
