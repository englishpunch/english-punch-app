// @vitest-environment node

import { describe, expect, it } from "vitest";
import { loadServerConfig } from "./config";

describe("loadServerConfig", () => {
  it("loads production-safe defaults", () => {
    const config = loadServerConfig({});

    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 3001,
      convexUrl: "https://ep-convex.echoja.com",
      resourceUrl: "https://mcp-ep.echoja.com/mcp",
      authorizationServerUrl: "https://ep.echoja.com",
      oauthAudience: "https://mcp-ep.echoja.com/mcp",
      sessionIdleTimeoutMs: 1_800_000,
    });
    expect(config.supportedScopes).toContain("cards:write");
    expect(config.allowedHosts).toEqual(["mcp-ep.echoja.com"]);
  });

  it("normalizes URL and list overrides", () => {
    const config = loadServerConfig({
      MCP_HOST: "127.0.0.1",
      MCP_PORT: "4321",
      MCP_PUBLIC_URL: "https://mcp.example.test/mcp/",
      MCP_ALLOWED_HOSTS: "mcp.example.test, localhost:4321",
      MCP_OAUTH_ISSUER: "https://auth.example.test/",
      MCP_OAUTH_AUDIENCE: "english-punch-test",
      MCP_OAUTH_SCOPES: "cards:read cards:write",
      CONVEX_URL: "https://convex.example.test/",
      MCP_SESSION_IDLE_TIMEOUT_MS: "60000",
    });

    expect(config).toMatchObject({
      host: "127.0.0.1",
      port: 4321,
      convexUrl: "https://convex.example.test",
      resourceUrl: "https://mcp.example.test/mcp",
      authorizationServerUrl: "https://auth.example.test",
      oauthAudience: "english-punch-test",
      supportedScopes: ["cards:read", "cards:write"],
      allowedHosts: ["mcp.example.test", "localhost:4321"],
      sessionIdleTimeoutMs: 60_000,
    });
  });

  it("rejects an invalid port", () => {
    expect(() => loadServerConfig({ MCP_PORT: "70000" })).toThrow("MCP_PORT");
  });

  it("rejects an invalid session idle timeout", () => {
    expect(() =>
      loadServerConfig({ MCP_SESSION_IDLE_TIMEOUT_MS: "0" })
    ).toThrow("MCP_SESSION_IDLE_TIMEOUT_MS");
  });

  it("requires HTTPS for public production URLs", () => {
    expect(() =>
      loadServerConfig({ MCP_PUBLIC_URL: "http://mcp.example.test/mcp" })
    ).toThrow("MCP_PUBLIC_URL");
  });
});
