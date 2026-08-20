// @vitest-environment node

import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ConvexHttpClient } from "convex/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadServerConfig } from "./config";
import { createMcpHttpServer } from "./http-server";

const openServers: Array<{ close: () => void }> = [];

afterEach(() => {
  for (const server of openServers.splice(0)) {
    server.close();
  }
});

describe("English Punch MCP HTTP server", () => {
  it("serves OAuth protected-resource discovery without authentication", async () => {
    const config = loadServerConfig({
      MCP_ALLOWED_HOSTS: "127.0.0.1",
    });
    const server = createMcpHttpServer(config, {
      authenticate: async () => {
        throw new Error("authentication should not run for discovery");
      },
    });
    openServers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const { port } = server.address() as AddressInfo;

    const response = await fetch(
      `http://127.0.0.1:${port}/.well-known/oauth-protected-resource/mcp`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      resource: "https://mcp-ep.echoja.com/mcp",
      authorization_servers: ["https://ep.echoja.com"],
    });
  });

  it("runs an authenticated, scope-filtered Streamable HTTP session", async () => {
    const config = loadServerConfig({
      MCP_ALLOWED_HOSTS: "127.0.0.1",
    });
    const convexClient = {
      setAuth: vi.fn(),
    } as unknown as ConvexHttpClient;
    const server = createMcpHttpServer(config, {
      authenticate: async (authorizationHeader) => {
        expect(authorizationHeader).toBe("Bearer access-token");
        return {
          auth: {
            token: "access-token",
            clientId: "chatgpt-client",
            scopes: ["cards:read"],
            userId: "user_123",
            resource: config.resourceUrl,
          },
          client: convexClient,
        };
      },
    });
    openServers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const { port } = server.address() as AddressInfo;
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
      { requestInit: { headers: { authorization: "Bearer access-token" } } }
    );
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await client.connect(transport);
    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "get-card",
      "list-cards",
    ]);

    await client.close();
  });

  it("expires abandoned Streamable HTTP sessions", async () => {
    const config = loadServerConfig({
      MCP_ALLOWED_HOSTS: "127.0.0.1",
      MCP_SESSION_IDLE_TIMEOUT_MS: "20",
    });
    const convexClient = { setAuth: vi.fn() } as unknown as ConvexHttpClient;
    const server = createMcpHttpServer(config, {
      authenticate: async () => ({
        auth: {
          token: "access-token",
          clientId: "chatgpt-client",
          scopes: ["cards:read"],
          userId: "user_123",
          resource: config.resourceUrl,
        },
        client: convexClient,
      }),
    });
    openServers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const { port } = server.address() as AddressInfo;
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
      { requestInit: { headers: { authorization: "Bearer access-token" } } }
    );
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await client.connect(transport);
    await new Promise((resolve) => setTimeout(resolve, 60));

    await expect(client.listTools()).rejects.toThrow();
    await client.close();
  });

  it("challenges unauthenticated MCP requests with resource metadata", async () => {
    const config = loadServerConfig({
      MCP_ALLOWED_HOSTS: "127.0.0.1",
    });
    const server = createMcpHttpServer(config, {
      authenticate: async () => {
        throw new Error("A Bearer access token is required");
      },
    });
    openServers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://mcp-ep.echoja.com/.well-known/oauth-protected-resource/mcp"'
    );
  });
});
