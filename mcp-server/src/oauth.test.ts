// @vitest-environment node

import { describe, expect, it } from "vitest";
import { loadServerConfig } from "./config";
import {
  authenticateBearerRequest,
  bearerChallenge,
  decodeAccessTokenClaims,
  protectedResourceMetadata,
  readBearerToken,
} from "./oauth";

const config = loadServerConfig({});

const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("OAuth protected resource metadata", () => {
  it("advertises the resource, authorization server, and scopes", () => {
    expect(protectedResourceMetadata(config)).toEqual({
      resource: "https://mcp-ep.echoja.com/mcp",
      authorization_servers: ["https://ep.echoja.com"],
      bearer_methods_supported: ["header"],
      scopes_supported: config.supportedScopes,
      resource_documentation: "https://ep.echoja.com/docs/chatgpt",
    });
  });

  it("builds an RFC 9728 discovery challenge", () => {
    expect(bearerChallenge(config)).toBe(
      'Bearer resource_metadata="https://mcp-ep.echoja.com/.well-known/oauth-protected-resource/mcp"'
    );
  });
});

describe("bearer token parsing", () => {
  it("accepts one bearer token", () => {
    expect(readBearerToken("Bearer token-value")).toBe("token-value");
  });

  it.each([undefined, "", "Basic abc", "Bearer ", "Bearer a b"])(
    "rejects %s",
    (header) => {
      expect(() => readBearerToken(header)).toThrow("Bearer");
    }
  );
});

describe("access token claims", () => {
  it("extracts OAuth identity, audience, scopes, and expiry", () => {
    const token = `${encode({ alg: "RS256" })}.${encode({
      sub: "user_123",
      aud: ["another-api", config.oauthAudience],
      client_id: "chatgpt-client",
      scope: "cards:read cards:write",
      exp: 1_900_000_000,
      resource: config.resourceUrl,
    })}.signature`;

    expect(decodeAccessTokenClaims(token)).toEqual({
      subject: "user_123",
      audiences: ["another-api", config.oauthAudience],
      clientId: "chatgpt-client",
      scopes: ["cards:read", "cards:write"],
      expiresAt: 1_900_000_000,
      resource: config.resourceUrl,
    });
  });

  it("accepts azp and array-form scopes", () => {
    const token = `${encode({ alg: "RS256" })}.${encode({
      sub: "user_123",
      aud: config.oauthAudience,
      azp: "chatgpt-client",
      scopes: ["bags:read"],
    })}.signature`;

    expect(decodeAccessTokenClaims(token)).toMatchObject({
      clientId: "chatgpt-client",
      scopes: ["bags:read"],
    });
  });

  it("rejects malformed tokens and missing subjects", () => {
    expect(() => decodeAccessTokenClaims("opaque-token")).toThrow("JWT");

    const token = `${encode({ alg: "RS256" })}.${encode({
      aud: config.oauthAudience,
    })}.signature`;
    expect(() => decodeAccessTokenClaims(token)).toThrow("sub");
  });
});

describe("authenticated MCP requests", () => {
  it("accepts a current audience-bound token for an existing user", async () => {
    const token = `${encode({ alg: "RS256" })}.${encode({
      sub: "user_123",
      aud: config.oauthAudience,
      client_id: "chatgpt-client",
      scope: "cards:read cards:write",
      exp: 1_900_000_000,
      resource: config.resourceUrl,
    })}.signature`;

    await expect(
      authenticateBearerRequest(config, `Bearer ${token}`, {
        now: () => 1_800_000_000,
        validateUser: async (accessToken) => {
          expect(accessToken).toBe(token);
          return { userId: "user_123" };
        },
      })
    ).resolves.toEqual({
      token,
      clientId: "chatgpt-client",
      scopes: ["cards:read", "cards:write"],
      expiresAt: 1_900_000_000,
      resource: config.resourceUrl,
      userId: "user_123",
    });
  });

  it("rejects access tokens without an expiry", async () => {
    const token = `${encode({ alg: "RS256" })}.${encode({
      sub: "user_123",
      aud: config.oauthAudience,
      client_id: "chatgpt-client",
      scope: "cards:read",
    })}.signature`;

    await expect(
      authenticateBearerRequest(config, `Bearer ${token}`, {
        validateUser: async () => ({ userId: "user_123" }),
      })
    ).rejects.toThrow("exp");
  });

  it.each([
    {
      name: "another user",
      claims: {
        sub: "user_123",
        aud: config.oauthAudience,
        client_id: "chatgpt-client",
        scope: "cards:read",
        exp: 1_900_000_000,
      },
      validatedUserId: "user_456",
      error: "English Punch user",
    },
    {
      name: "another audience",
      claims: {
        sub: "user_123",
        aud: "https://another.example/mcp",
        client_id: "chatgpt-client",
        scope: "cards:read",
        exp: 1_900_000_000,
      },
      validatedUserId: "user_123",
      error: "audience",
    },
    {
      name: "another resource",
      claims: {
        sub: "user_123",
        aud: config.oauthAudience,
        client_id: "chatgpt-client",
        scope: "cards:read",
        exp: 1_900_000_000,
        resource: "https://another.example/mcp",
      },
      validatedUserId: "user_123",
      error: "resource",
    },
    {
      name: "an expired token",
      claims: {
        sub: "user_123",
        aud: config.oauthAudience,
        client_id: "chatgpt-client",
        scope: "cards:read",
        exp: 1_700_000_000,
      },
      validatedUserId: "user_123",
      error: "expired",
    },
    {
      name: "an unrelated scope",
      claims: {
        sub: "user_123",
        aud: config.oauthAudience,
        client_id: "chatgpt-client",
        scope: "admin:write",
        exp: 1_900_000_000,
      },
      validatedUserId: "user_123",
      error: "scope",
    },
  ])("rejects $name", async ({ claims, validatedUserId, error }) => {
    const token = `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;

    await expect(
      authenticateBearerRequest(config, `Bearer ${token}`, {
        now: () => 1_800_000_000,
        validateUser: async () => ({ userId: validatedUserId }),
      })
    ).rejects.toThrow(error);
  });
});
