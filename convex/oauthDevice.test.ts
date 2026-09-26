// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  CLI_CLIENT_ID,
  CLI_RESOURCE,
  DEVICE_GRANT_TYPE,
  OAUTH_ISSUER,
} from "./oauthConfig";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
};
const post = (
  t: ReturnType<typeof setup>,
  path: string,
  fields: Record<string, string>
) =>
  t.fetch(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      resource: CLI_RESOURCE,
      ...fields,
    }),
  });
const start = async (t: ReturnType<typeof setup>) => {
  const response = await post(t, "/oauth/device/code", { scope: "cli:access" });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    interval: number;
    expires_in: number;
  };
};
const poll = (
  t: ReturnType<typeof setup>,
  code: string,
  fields: Record<string, string> = {}
) =>
  post(t, "/oauth/token", {
    grant_type: DEVICE_GRANT_TYPE,
    device_code: code,
    ...fields,
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("requires explicit browser approval, exchanges once, and rotates CLI audience tokens", async () => {
  const t = setup();
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
  vi.useFakeTimers();
  const device = await start(t);
  expect(device).toMatchObject({
    interval: 5,
    expires_in: 900,
    verification_uri: `${OAUTH_ISSUER}/device`,
  });
  expect(device.user_code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  expect(device.verification_uri_complete).toBe(
    `${OAUTH_ISSUER}/device?user_code=${device.user_code}`
  );
  const stored = await t.run((ctx) =>
    ctx.db.query("oauthDeviceCodes").unique()
  );
  expect(stored?.deviceCodeHash).not.toBe(device.device_code);
  expect(stored?.userCodeHash).not.toContain(device.user_code.replace("-", ""));
  expect(stored?.status).toBe("pending");
  vi.setSystemTime(Date.now() + 5000);
  expect(await (await poll(t, device.device_code)).json()).toEqual({
    error: "authorization_pending",
  });
  await expect(
    t.mutation(api.oauthDevice.decide, {
      userCode: device.user_code,
      approved: true,
    })
  ).rejects.toThrow("Unauthorized");
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "user@example.test" })
  );
  const browser = t.withIdentity({
    subject: userId,
    issuer: "https://ep-convex-site.echoja.com",
  });
  await expect(
    t
      .withIdentity({ subject: userId, issuer: OAUTH_ISSUER })
      .mutation(api.oauthDevice.decide, {
        userCode: device.user_code,
        approved: true,
      })
  ).rejects.toThrow("Unauthorized");
  expect(
    await browser.mutation(api.oauthDevice.decide, {
      userCode: device.user_code.toLowerCase(),
      approved: true,
    })
  ).toBe("approved");
  expect(
    await browser.mutation(api.oauthDevice.decide, {
      userCode: device.user_code,
      approved: false,
    })
  ).toBe("invalid_code");
  vi.setSystemTime(Date.now() + 5000);
  const response = await poll(t, device.device_code);
  expect(response.status).toBe(200);
  const tokens = (await response.json()) as {
    access_token: string;
    refresh_token: string;
  };
  await expect(
    jwtVerify(tokens.access_token, publicKey, {
      issuer: OAUTH_ISSUER,
      audience: CLI_RESOURCE,
    })
  ).resolves.toMatchObject({
    payload: { sub: userId, scope: "cli:access", client_id: CLI_CLIENT_ID },
  });
  await expect(
    jwtVerify(tokens.access_token, publicKey, {
      audience: "https://mcp-ep.echoja.com/mcp",
    })
  ).rejects.toThrow();
  expect(await (await poll(t, device.device_code)).json()).toEqual({
    error: "invalid_grant",
  });
  const refresh = (token: string, extra: Record<string, string> = {}) =>
    post(t, "/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: token,
      ...extra,
    });
  expect(
    (
      await refresh(tokens.refresh_token, {
        resource: "https://mcp-ep.echoja.com/mcp",
      })
    ).status
  ).toBe(400);
  expect(
    (await refresh(tokens.refresh_token, { scope: "cards:write" })).status
  ).toBe(400);
  const rotatedResponse = await refresh(tokens.refresh_token);
  expect(rotatedResponse.status).toBe(200);
  const rotated = (await rotatedResponse.json()) as { refresh_token: string };
  expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
  expect((await refresh(tokens.refresh_token)).status).toBe(400);
  expect((await refresh(rotated.refresh_token)).status).toBe(400);
});

it("enforces polling backoff, client binding, denial, and expiry", async () => {
  const t = setup();
  vi.useFakeTimers();
  const device = await start(t);
  expect(
    (await poll(t, device.device_code, { client_id: "other" })).status
  ).toBe(400);
  expect(await (await poll(t, device.device_code)).json()).toEqual({
    error: "slow_down",
  });
  vi.setSystemTime(Date.now() + 5000);
  expect(await (await poll(t, device.device_code)).json()).toEqual({
    error: "slow_down",
  });
  vi.setSystemTime(Date.now() + 15000);
  expect(await (await poll(t, device.device_code)).json()).toEqual({
    error: "authorization_pending",
  });
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  expect(
    await t.withIdentity({ subject: userId }).mutation(api.oauthDevice.decide, {
      userCode: device.user_code,
      approved: false,
    })
  ).toBe("denied");
  expect(await (await poll(t, device.device_code)).json()).toEqual({
    error: "access_denied",
  });
  const expires = await start(t);
  vi.setSystemTime(Date.now() + 900000);
  expect(await (await poll(t, expires.device_code)).json()).toEqual({
    error: "expired_token",
  });
  expect(
    await t.withIdentity({ subject: userId }).mutation(api.oauthDevice.decide, {
      userCode: expires.user_code,
      approved: true,
    })
  ).toBe("invalid_code");
  expect(await t.mutation(internal.oauthDevice.cleanup, {})).toBe(2);
  expect(
    await t.run((ctx) => ctx.db.query("oauthRefreshTokens").collect())
  ).toEqual([]);
});

it("rate limits failed user-code guesses and rejects unsupported requests", async () => {
  const t = setup();
  vi.useFakeTimers();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const browser = t.withIdentity({ subject: userId });
  for (let i = 0; i < 10; i++) {
    expect(
      await browser.mutation(api.oauthDevice.decide, {
        userCode: "WRNG-CODE",
        approved: true,
      })
    ).toBe("invalid_code");
  }
  expect(
    await browser.mutation(api.oauthDevice.decide, {
      userCode: "ABCD-EFGH",
      approved: true,
    })
  ).toBe("slow_down");
  for (const fields of [
    { scope: "cards:read" },
    { scope: "cli:access", client_id: "unknown" },
    { scope: "cli:access", resource: "https://example.com" },
  ]) {
    expect((await post(t, "/oauth/device/code", fields)).status).toBe(400);
  }
  for (let i = 0; i < 60; i++) {
    await start(t);
  }
  expect(
    (await post(t, "/oauth/device/code", { scope: "cli:access" })).status
  ).toBe(429);
});
