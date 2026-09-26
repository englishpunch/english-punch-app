import { importJWK, SignJWT, type JWK } from "jose";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import {
  CLI_CLIENT_ID,
  CLI_RESOURCE,
  DEVICE_GRANT_TYPE,
  MCP_RESOURCE,
  OAUTH_ISSUER,
  oauthPublicJwk,
} from "./oauthConfig";
import {
  normalizeRequestedScopes,
  randomOAuthToken,
  sha256Base64Url,
} from "./oauthProtocol";

const MAX_TOKEN_REQUEST_BYTES = 16_384;
const ACCESS_TOKEN_LIFETIME_SECONDS = 3_600;
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

type TokenGrant = {
  userId: Id<"users">;
  clientId: string;
  resource: string;
  scope: string;
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });

const oauthError = (error: string) => jsonResponse({ error }, 400);

const readSingle = (form: URLSearchParams, name: string) => {
  const values = form.getAll(name);
  return values.length === 1 && values[0].length > 0 ? values[0] : null;
};

const readOptionalSingle = (form: URLSearchParams, name: string) => {
  const values = form.getAll(name);
  if (values.length === 0) {
    return undefined;
  }
  return values.length === 1 && values[0].length > 0 ? values[0] : null;
};

const privateSigningKey = async () => {
  let jwk: JWK;
  try {
    const parsed = JSON.parse(env.MCP_OAUTH_PRIVATE_JWK) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("not an object");
    }
    jwk = parsed;
  } catch {
    throw new Error("MCP_OAUTH_PRIVATE_JWK is not a valid private JWK");
  }
  return await importJWK(jwk, "RS256");
};

const signAccessToken = async (grant: TokenGrant) => {
  const now = Math.floor(Date.now() / 1_000);
  return await new SignJWT({
    client_id: grant.clientId,
    scope: grant.scope,
    resource: grant.resource,
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: oauthPublicJwk.kid,
      typ: "JWT",
    })
    .setIssuer(OAUTH_ISSUER)
    .setSubject(grant.userId)
    .setAudience(grant.resource)
    .setJti(randomOAuthToken())
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_LIFETIME_SECONDS)
    .sign(await privateSigningKey());
};

export const token = httpAction(async (ctx, request) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_TOKEN_REQUEST_BYTES) {
    return oauthError("invalid_request");
  }

  const body = await request.text();
  if (body.length > MAX_TOKEN_REQUEST_BYTES) {
    return oauthError("invalid_request");
  }
  const form = new URLSearchParams(body);
  const grantType = readSingle(form, "grant_type");
  if (!grantType) {
    return oauthError("invalid_request");
  }
  if (grantType === DEVICE_GRANT_TYPE) {
    const deviceCode = readSingle(form, "device_code");
    const clientId = readSingle(form, "client_id");
    const resource = readSingle(form, "resource");
    if (
      !deviceCode ||
      clientId !== CLI_CLIENT_ID ||
      resource !== CLI_RESOURCE
    ) {
      return oauthError("invalid_request");
    }
    const refreshToken = randomOAuthToken();
    const exchanged: TokenGrant | { error: string } = await ctx.runMutation(
      internal.oauthDevice.exchange,
      {
        deviceCodeHash: await sha256Base64Url(deviceCode),
        clientId,
        resource,
        refreshTokenHash: await sha256Base64Url(refreshToken),
        refreshTokenFamilyId: randomOAuthToken(),
        refreshTokenExpiresAt: Date.now() + REFRESH_TOKEN_LIFETIME_MS,
      }
    );
    if ("error" in exchanged) {
      return oauthError(exchanged.error);
    }
    return jsonResponse(
      {
        access_token: await signAccessToken(exchanged),
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
        refresh_token: refreshToken,
        scope: exchanged.scope,
      },
      200
    );
  }
  if (grantType === "refresh_token") {
    const currentRefreshToken = readSingle(form, "refresh_token");
    const clientId = readSingle(form, "client_id");
    const resource = readSingle(form, "resource");
    const rawScope = readOptionalSingle(form, "scope");
    if (
      !currentRefreshToken ||
      !clientId ||
      (resource !== MCP_RESOURCE && resource !== CLI_RESOURCE) ||
      rawScope === null
    ) {
      return oauthError("invalid_request");
    }
    let scope: string | undefined;
    try {
      scope = rawScope
        ? normalizeRequestedScopes(rawScope, resource)
        : undefined;
    } catch {
      return oauthError("invalid_scope");
    }

    const now = Date.now();
    const replacementRefreshToken = randomOAuthToken();
    const refreshed: TokenGrant | "invalid_scope" | null =
      await ctx.runMutation(internal.oauth.rotateRefreshToken, {
        tokenHash: await sha256Base64Url(currentRefreshToken),
        clientId,
        resource,
        replacementTokenHash: await sha256Base64Url(replacementRefreshToken),
        replacementExpiresAt: now + REFRESH_TOKEN_LIFETIME_MS,
        scope,
        now,
      });
    if (refreshed === "invalid_scope") {
      return oauthError("invalid_scope");
    }
    if (!refreshed) {
      return oauthError("invalid_grant");
    }

    return jsonResponse(
      {
        access_token: await signAccessToken(refreshed),
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
        refresh_token: replacementRefreshToken,
        scope: refreshed.scope,
      },
      200
    );
  }
  if (grantType !== "authorization_code") {
    return oauthError("unsupported_grant_type");
  }

  const code = readSingle(form, "code");
  const clientId = readSingle(form, "client_id");
  const redirectUri = readSingle(form, "redirect_uri");
  const resource = readSingle(form, "resource");
  const codeVerifier = readSingle(form, "code_verifier");
  if (
    !code ||
    !clientId ||
    !redirectUri ||
    resource !== MCP_RESOURCE ||
    !codeVerifier ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
  ) {
    return oauthError("invalid_request");
  }

  const now = Date.now();
  const refreshToken = randomOAuthToken();
  const refreshTokenFamilyId = randomOAuthToken();
  const exchanged: TokenGrant | null = await ctx.runMutation(
    internal.oauth.exchangeAuthorizationCode,
    {
      codeHash: await sha256Base64Url(code),
      clientId,
      redirectUri,
      resource,
      codeChallenge: await sha256Base64Url(codeVerifier),
      refreshTokenHash: await sha256Base64Url(refreshToken),
      refreshTokenFamilyId,
      refreshTokenExpiresAt: now + REFRESH_TOKEN_LIFETIME_MS,
      now,
    }
  );
  if (!exchanged) {
    return oauthError("invalid_grant");
  }

  return jsonResponse(
    {
      access_token: await signAccessToken(exchanged),
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      refresh_token: refreshToken,
      scope: exchanged.scope,
    },
    200
  );
});

export const deviceAuthorization = httpAction(async (ctx, request) => {
  if (
    Number(request.headers.get("content-length") ?? "0") >
    MAX_TOKEN_REQUEST_BYTES
  ) {
    return oauthError("invalid_request");
  }
  const body = await request.text();
  if (body.length > MAX_TOKEN_REQUEST_BYTES) {
    return oauthError("invalid_request");
  }
  const form = new URLSearchParams(body);
  if (
    readSingle(form, "client_id") !== CLI_CLIENT_ID ||
    readSingle(form, "resource") !== CLI_RESOURCE
  ) {
    return oauthError("invalid_client");
  }
  if (readSingle(form, "scope") !== "cli:access") {
    return oauthError("invalid_scope");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const deviceCode = randomOAuthToken();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const rawCode = Array.from(bytes, (byte) => alphabet[byte & 31]).join("");
    const result: "created" | "slow_down" | "collision" = await ctx.runMutation(
      internal.oauthDevice.create,
      {
        deviceCodeHash: await sha256Base64Url(deviceCode),
        userCodeHash: await sha256Base64Url(rawCode),
      }
    );
    if (result === "slow_down") {
      return jsonResponse({ error: "slow_down" }, 429);
    }
    if (result === "collision") {
      continue;
    }
    const userCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`;
    return jsonResponse(
      {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: `${OAUTH_ISSUER}/device`,
        verification_uri_complete: `${OAUTH_ISSUER}/device?user_code=${userCode}`,
        expires_in: 900,
        interval: 5,
      },
      200
    );
  }
  return jsonResponse({ error: "temporarily_unavailable" }, 503);
});
