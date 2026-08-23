import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { ConvexHttpClient } from "convex/browser";
import type { GenericId } from "convex/values";
import type { AuthenticatedRequest } from "./oauth.js";
import type { ServerConfig } from "./config.js";
import { bearerChallenge, protectedResourceMetadata } from "./oauth.js";
import { createEnglishPunchServer } from "./server.js";
import { ENGLISH_PUNCH_VERSION } from "./version.js";

type AuthenticationResult = {
  auth: AuthenticatedRequest;
  client: ConvexHttpClient;
};

type HttpServerDependencies = {
  authenticate: (
    authorizationHeader: string | undefined
  ) => Promise<AuthenticationResult>;
};

type Session = {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createEnglishPunchServer>;
  client: ConvexHttpClient;
  userId: GenericId<"users">;
  clientId: string;
  scopes: string[];
  lastAccessedAt: number;
};

const MAX_BODY_BYTES = 1_048_576;

const sendJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const requestHost = (request: IncomingMessage) => {
  const host = request.headers.host;
  if (!host) {
    return null;
  }
  try {
    return { host, hostname: new URL(`http://${host}`).hostname };
  } catch {
    return null;
  }
};

const hasAllowedHost = (request: IncomingMessage, config: ServerConfig) => {
  const requested = requestHost(request);
  return (
    requested !== null &&
    config.allowedHosts.some(
      (allowed) =>
        allowed.toLowerCase() === requested.host.toLowerCase() ||
        allowed.toLowerCase() === requested.hostname.toLowerCase()
    )
  );
};

const readJsonBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body exceeds 1 MiB");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON");
  }
};

const sessionIdFrom = (request: IncomingMessage) => {
  const value = request.headers["mcp-session-id"];
  return Array.isArray(value) ? value[0] : value;
};

const authHeaderFrom = (request: IncomingMessage) => {
  const value = request.headers.authorization;
  return Array.isArray(value) ? value[0] : value;
};

export const createMcpHttpServer = (
  config: ServerConfig,
  dependencies: HttpServerDependencies
) => {
  const sessions = new Map<string, Session>();
  const sessionSweep = setInterval(
    () => {
      const oldestAllowed = Date.now() - config.sessionIdleTimeoutMs;
      for (const [sessionId, session] of sessions) {
        if (session.lastAccessedAt <= oldestAllowed) {
          sessions.delete(sessionId);
          void session.transport.close();
        }
      }
    },
    Math.min(config.sessionIdleTimeoutMs, 60_000)
  );
  sessionSweep.unref();
  const metadataPaths = new Set([
    "/.well-known/oauth-protected-resource",
    `/.well-known/oauth-protected-resource${new URL(config.resourceUrl).pathname}`,
  ]);

  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    if (!hasAllowedHost(request, config)) {
      sendJson(response, 421, { error: "Misdirected Request" });
      return;
    }

    if (request.method === "GET" && pathname === "/healthz") {
      sendJson(response, 200, {
        status: "ok",
        version: ENGLISH_PUNCH_VERSION,
      });
      return;
    }

    if (request.method === "GET" && metadataPaths.has(pathname)) {
      sendJson(response, 200, protectedResourceMetadata(config));
      return;
    }

    if (pathname !== new URL(config.resourceUrl).pathname) {
      sendJson(response, 404, { error: "Not Found" });
      return;
    }

    if (!["GET", "POST", "DELETE"].includes(request.method ?? "")) {
      sendJson(
        response,
        405,
        { error: "Method Not Allowed" },
        { allow: "GET, POST, DELETE" }
      );
      return;
    }

    let authenticated: AuthenticationResult;
    try {
      authenticated = await dependencies.authenticate(authHeaderFrom(request));
    } catch (error) {
      console.warn(
        "MCP authentication failed",
        error instanceof Error ? error.message : "Unknown authentication error"
      );
      sendJson(
        response,
        401,
        {
          error: "invalid_token",
          error_description:
            "A valid English Punch OAuth access token is required",
        },
        { "www-authenticate": bearerChallenge(config) }
      );
      return;
    }

    const { auth } = authenticated;
    const authenticatedRequest: Parameters<
      StreamableHTTPServerTransport["handleRequest"]
    >[0] = request;
    authenticatedRequest.auth = {
      token: auth.token,
      clientId: auth.clientId,
      scopes: auth.scopes,
      ...(auth.expiresAt !== undefined ? { expiresAt: auth.expiresAt } : {}),
      resource: new URL(auth.resource ?? config.resourceUrl),
      extra: { userId: auth.userId },
    };

    try {
      const sessionId = sessionIdFrom(request);
      let session = sessionId ? sessions.get(sessionId) : undefined;

      if (session) {
        session.lastAccessedAt = Date.now();
        const samePrincipal =
          session.userId === auth.userId && session.clientId === auth.clientId;
        const retainsScopes = session.scopes.every((scope) =>
          auth.scopes.includes(scope)
        );
        if (!samePrincipal || !retainsScopes) {
          sendJson(response, 403, { error: "Session authorization changed" });
          return;
        }
        session.client.setAuth(auth.token);
      } else if (sessionId) {
        sendJson(response, 404, { error: "Unknown MCP session" });
        return;
      } else if (request.method === "POST") {
        const body = await readJsonBody(request);
        if (!isInitializeRequest(body)) {
          sendJson(response, 400, {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Initialize the MCP session first",
            },
            id: null,
          });
          return;
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (initializedSessionId) => {
            if (session) {
              sessions.set(initializedSessionId, session);
            }
          },
        });
        const mcpServer = createEnglishPunchServer(
          authenticated.client,
          auth.scopes
        );
        session = {
          transport,
          server: mcpServer,
          client: authenticated.client,
          userId: auth.userId,
          clientId: auth.clientId,
          scopes: auth.scopes,
          lastAccessedAt: Date.now(),
        };
        transport.onclose = () => {
          const closedSessionId = transport.sessionId;
          if (closedSessionId) {
            sessions.delete(closedSessionId);
          }
          void mcpServer.close();
        };
        await mcpServer.connect(transport);
        await transport.handleRequest(authenticatedRequest, response, body);
        return;
      } else {
        sendJson(response, 400, { error: "Missing MCP session ID" });
        return;
      }

      await session.transport.handleRequest(authenticatedRequest, response);
    } catch (error) {
      console.error("MCP HTTP request failed", error);
      if (!response.headersSent) {
        sendJson(response, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  server.on("close", () => {
    clearInterval(sessionSweep);
    for (const session of sessions.values()) {
      void session.transport.close();
    }
    sessions.clear();
  });

  return server;
};
