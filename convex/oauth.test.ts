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

it("exchanges a ChatGPT PKCE code for a short-lived audience-bound JWT once", async () => {
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
    scope: string;
    token_type: string;
  };
  expect(body).toMatchObject({
    expires_in: 3_600,
    scope: "cards:read reviews:read",
    token_type: "Bearer",
  });
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

  const replay = await tokenRequest();
  expect(replay.status).toBe(400);
  expect(await replay.json()).toEqual({ error: "invalid_grant" });
});
