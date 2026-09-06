// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { sha256Base64Url } from "./oauthProtocol";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("publishes ChatGPT-compatible OAuth authorization server metadata", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/.well-known/oauth-authorization-server");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(
    expect.objectContaining({
      issuer: "https://ep.echoja.com",
      authorization_endpoint: "https://ep.echoja.com/oauth/authorize",
      token_endpoint: "https://ep.echoja.com/oauth/token",
      jwks_uri: "https://ep.echoja.com/oauth/jwks",
      client_id_metadata_document_supported: true,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
    })
  );
});

it("publishes the RSA key used to verify English Punch access tokens", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/oauth/jwks");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    keys: [
      expect.objectContaining({
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        kid: "ep-oauth-2026-08-20",
      }),
    ],
  });
});

it("exchanges an authorization code only once and enforces its PKCE binding", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));

  await t.mutation(internal.oauth.storeAuthorizationCode, {
    codeHash: "code-hash",
    userId,
    clientId: "https://chatgpt.com/oauth/client.json",
    redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
    resource: "https://mcp-ep.echoja.com/mcp",
    scope: "cards:read reviews:read",
    codeChallenge: "challenge",
    expiresAt: 1_900_000_000_000,
  });

  const args = {
    codeHash: "code-hash",
    clientId: "https://chatgpt.com/oauth/client.json",
    redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
    resource: "https://mcp-ep.echoja.com/mcp",
    codeChallenge: "challenge",
    refreshTokenHash: "refresh-token-hash",
    refreshTokenFamilyId: "refresh-token-family",
    refreshTokenExpiresAt: 1_900_000_000_000,
    now: 1_800_000_000_000,
  };

  await expect(
    t.mutation(internal.oauth.exchangeAuthorizationCode, args)
  ).resolves.toEqual({
    userId,
    clientId: args.clientId,
    resource: args.resource,
    scope: "cards:read reviews:read",
  });
  await expect(
    t.mutation(internal.oauth.exchangeAuthorizationCode, args)
  ).resolves.toBeNull();
});

it("deletes expired authorization codes in a bounded cleanup batch", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  vi.useFakeTimers();
  vi.setSystemTime(200);

  for (const [codeHash, expiresAt] of [
    ["expired", 100],
    ["active", 300],
  ] as const) {
    await t.mutation(internal.oauth.storeAuthorizationCode, {
      codeHash,
      userId,
      clientId: "https://chatgpt.com/oauth/client.json",
      redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
      resource: "https://mcp-ep.echoja.com/mcp",
      scope: "cards:read",
      codeChallenge: "challenge",
      expiresAt,
    });
  }

  await expect(
    t.mutation(internal.oauth.deleteExpiredAuthorizationCodes, {})
  ).resolves.toBe(1);
  await expect(
    t.mutation(internal.oauth.exchangeAuthorizationCode, {
      codeHash: "active",
      clientId: "https://chatgpt.com/oauth/client.json",
      redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
      resource: "https://mcp-ep.echoja.com/mcp",
      codeChallenge: "challenge",
      refreshTokenHash: "refresh-token-hash",
      refreshTokenFamilyId: "refresh-token-family",
      refreshTokenExpiresAt: 1_900_000_000_000,
      now: 200,
    })
  ).resolves.toEqual(expect.objectContaining({ userId }));
});

it("keeps refresh tokens client-bound and deletes expired tokens in a bounded batch", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  vi.useFakeTimers();
  vi.setSystemTime(200);

  await t.run(async (ctx) => {
    for (const [tokenHash, expiresAt] of [
      ["expired", 100],
      ["active", 300],
    ] as const) {
      await ctx.db.insert("oauthRefreshTokens", {
        tokenHash,
        familyId: tokenHash,
        status: "active",
        userId,
        clientId: "https://chatgpt.com/oauth/client.json",
        resource: "https://mcp-ep.echoja.com/mcp",
        scope: "cards:read",
        expiresAt,
      });
    }
  });

  await expect(
    t.mutation(internal.oauth.deleteExpiredRefreshTokens, {})
  ).resolves.toBe(1);
  await expect(
    t.mutation(internal.oauth.rotateRefreshToken, {
      tokenHash: "active",
      clientId: "https://chatgpt.com/oauth/other-client.json",
      resource: "https://mcp-ep.echoja.com/mcp",
      replacementTokenHash: "replacement",
      replacementExpiresAt: 400,
      now: 200,
    })
  ).resolves.toBeNull();
  await expect(
    t.mutation(internal.oauth.rotateRefreshToken, {
      tokenHash: "active",
      clientId: "https://chatgpt.com/oauth/client.json",
      resource: "https://mcp-ep.echoja.com/mcp",
      replacementTokenHash: "replacement",
      replacementExpiresAt: 400,
      now: 200,
    })
  ).resolves.toEqual(expect.objectContaining({ userId }));
});

it("requires an English Punch login before granting ChatGPT access", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.action(api.oauthActions.completeAuthorization, {
      approved: true,
      responseType: "code",
      clientId: "https://chatgpt.com/oauth/client.json",
      redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
      resource: "https://mcp-ep.echoja.com/mcp",
      scope: "cards:read reviews:read",
      state: "state-123",
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
    })
  ).rejects.toThrow("Unauthorized");
});

it("grants a one-time authorization code to a validated ChatGPT CIMD client", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const clientId = "https://chatgpt.com/oauth/client.json";
  const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          client_id: clientId,
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
  );

  const redirect = await t
    .withIdentity({ subject: userId })
    .action(api.oauthActions.completeAuthorization, {
      approved: true,
      responseType: "code",
      clientId,
      redirectUri,
      resource: "https://mcp-ep.echoja.com/mcp",
      scope: "cards:read reviews:read",
      state: "state-123",
      codeChallenge: "A".repeat(43),
      codeChallengeMethod: "S256",
    });

  const redirectUrl = new URL(redirect);
  expect(redirectUrl.origin + redirectUrl.pathname).toBe(redirectUri);
  expect(redirectUrl.searchParams.get("code")).toMatch(/^[\w-]{40,}$/);
  expect(redirectUrl.searchParams.get("state")).toBe("state-123");
  expect(redirectUrl.searchParams.get("iss")).toBe("https://ep.echoja.com");
});

it("rejects token requests outside the authorization-code PKCE flow", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "unsupported_grant_type",
  });
});

it("exchanges a ChatGPT PKCE code and rotates audience-bound tokens", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const clientId = "https://chatgpt.com/oauth/client.json";
  const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";
  const codeVerifier = "v".repeat(43);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          client_id: clientId,
          redirect_uris: [redirectUri],
          token_endpoint_auth_methods_supported: ["none"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
  );

  const redirect = await t
    .withIdentity({ subject: userId })
    .action(api.oauthActions.completeAuthorization, {
      approved: true,
      responseType: "code",
      clientId,
      redirectUri,
      resource: "https://mcp-ep.echoja.com/mcp",
      scope: "cards:read reviews:read",
      state: "state-456",
      codeChallenge,
      codeChallengeMethod: "S256",
    });
  vi.unstubAllGlobals();

  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  vi.stubEnv(
    "MCP_OAUTH_PRIVATE_JWK",
    JSON.stringify({
      ...(await exportJWK(privateKey)),
      kid: "ep-oauth-2026-08-20",
      alg: "RS256",
      use: "sig",
    })
  );

  const tokenRequest = () =>
    t.fetch("/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: new URL(redirect).searchParams.get("code") ?? "",
        client_id: clientId,
        redirect_uri: redirectUri,
        resource: "https://mcp-ep.echoja.com/mcp",
        code_verifier: codeVerifier,
      }),
    });

  const response = await tokenRequest();
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
  };
  expect(body).toMatchObject({
    expires_in: 3_600,
    refresh_token: expect.stringMatching(/^[\w-]{40,}$/),
    scope: "cards:read reviews:read",
    token_type: "Bearer",
  });
  const refreshTokenHash = await sha256Base64Url(body.refresh_token);
  const storedRefreshToken = await t.run((ctx) =>
    ctx.db
      .query("oauthRefreshTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", refreshTokenHash))
      .unique()
  );
  expect(storedRefreshToken).toMatchObject({
    clientId,
    status: "active",
    tokenHash: refreshTokenHash,
  });
  expect(storedRefreshToken?.tokenHash).not.toBe(body.refresh_token);
  await expect(
    jwtVerify(body.access_token, publicKey, {
      issuer: "https://ep.echoja.com",
      audience: "https://mcp-ep.echoja.com/mcp",
    })
  ).resolves.toMatchObject({
    payload: {
      sub: userId,
      client_id: clientId,
      resource: "https://mcp-ep.echoja.com/mcp",
    },
  });

  const refreshRequest = (refreshToken: string, scope?: string) =>
    t.fetch("/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        resource: "https://mcp-ep.echoja.com/mcp",
        ...(scope ? { scope } : {}),
      }),
    });

  const overScopedResponse = await refreshRequest(
    body.refresh_token,
    "cards:write"
  );
  expect(overScopedResponse.status).toBe(400);
  expect(await overScopedResponse.json()).toEqual({ error: "invalid_scope" });

  const issuedAt = Date.now();
  vi.useFakeTimers();
  vi.setSystemTime(issuedAt + 29 * 24 * 60 * 60 * 1_000);
  const refreshedResponse = await refreshRequest(body.refresh_token);
  expect(refreshedResponse.status).toBe(200);
  const refreshedBody = (await refreshedResponse.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
  };
  expect(refreshedBody).toMatchObject({
    expires_in: 3_600,
    refresh_token: expect.stringMatching(/^[\w-]{40,}$/),
    scope: "cards:read reviews:read",
    token_type: "Bearer",
  });
  expect(refreshedBody.refresh_token).not.toBe(body.refresh_token);
  await expect(
    jwtVerify(refreshedBody.access_token, publicKey, {
      issuer: "https://ep.echoja.com",
      audience: "https://mcp-ep.echoja.com/mcp",
    })
  ).resolves.toMatchObject({
    payload: {
      sub: userId,
      client_id: clientId,
      resource: "https://mcp-ep.echoja.com/mcp",
    },
  });

  const narrowedResponse = await refreshRequest(
    refreshedBody.refresh_token,
    "cards:read"
  );
  expect(narrowedResponse.status).toBe(200);
  const narrowedBody = (await narrowedResponse.json()) as {
    access_token: string;
    refresh_token: string;
    scope: string;
  };
  expect(narrowedBody).toMatchObject({
    refresh_token: expect.not.stringMatching(refreshedBody.refresh_token),
    scope: "cards:read",
  });
  await expect(
    jwtVerify(narrowedBody.access_token, publicKey, {
      issuer: "https://ep.echoja.com",
      audience: "https://mcp-ep.echoja.com/mcp",
    })
  ).resolves.toMatchObject({ payload: { scope: "cards:read" } });

  vi.setSystemTime(issuedAt + 31 * 24 * 60 * 60 * 1_000);
  await t.mutation(internal.oauth.deleteExpiredRefreshTokens, {});
  const refreshReplay = await refreshRequest(body.refresh_token);
  expect(refreshReplay.status).toBe(400);
  expect(await refreshReplay.json()).toEqual({ error: "invalid_grant" });

  const revokedFamily = await refreshRequest(narrowedBody.refresh_token);
  expect(revokedFamily.status).toBe(400);
  expect(await revokedFamily.json()).toEqual({ error: "invalid_grant" });

  const replay = await tokenRequest();
  expect(replay.status).toBe(400);
  expect(await replay.json()).toEqual({ error: "invalid_grant" });
});
