export type ServerConfig = {
  host: string;
  port: number;
  convexUrl: string;
  resourceUrl: string;
  authorizationServerUrl: string;
  oauthAudience: string;
  supportedScopes: string[];
  allowedHosts: string[];
  resourceDocumentationUrl: string;
  sessionIdleTimeoutMs: number;
};

const DEFAULT_RESOURCE_URL = "https://mcp-ep.echoja.com/mcp";
const DEFAULT_AUTHORIZATION_SERVER_URL = "https://ep.echoja.com";
export const DEFAULT_SCOPES = [
  "profile:read",
  "bags:read",
  "bags:write",
  "cards:read",
  "cards:write",
  "reviews:read",
  "reviews:write",
];

const normalizedUrl = (name: string, value: string, requireHttps = false) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (requireHttps && parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }

  return parsed.toString().replace(/\/$/, "");
};

const parsedPort = (value: string | undefined) => {
  const port = Number(value ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MCP_PORT must be an integer from 1 to 65535");
  }
  return port;
};

const positiveInteger = (
  name: string,
  value: string | undefined,
  fallback: number
) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const commaSeparated = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const spaceSeparated = (value: string) =>
  value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const loadServerConfig = (
  environment: NodeJS.ProcessEnv = process.env
): ServerConfig => {
  const resourceUrl = normalizedUrl(
    "MCP_PUBLIC_URL",
    environment.MCP_PUBLIC_URL ?? DEFAULT_RESOURCE_URL,
    true
  );
  const authorizationServerUrl = normalizedUrl(
    "MCP_OAUTH_ISSUER",
    environment.MCP_OAUTH_ISSUER ?? DEFAULT_AUTHORIZATION_SERVER_URL,
    true
  );
  const publicUrl = new URL(resourceUrl);

  return {
    host: environment.MCP_HOST ?? "0.0.0.0",
    port: parsedPort(environment.MCP_PORT),
    convexUrl: normalizedUrl(
      "CONVEX_URL",
      environment.CONVEX_URL ?? "https://ep-convex.echoja.com"
    ),
    resourceUrl,
    authorizationServerUrl,
    oauthAudience: environment.MCP_OAUTH_AUDIENCE ?? resourceUrl,
    supportedScopes: environment.MCP_OAUTH_SCOPES
      ? spaceSeparated(environment.MCP_OAUTH_SCOPES)
      : DEFAULT_SCOPES,
    allowedHosts: environment.MCP_ALLOWED_HOSTS
      ? commaSeparated(environment.MCP_ALLOWED_HOSTS)
      : [publicUrl.host],
    resourceDocumentationUrl: normalizedUrl(
      "MCP_RESOURCE_DOCUMENTATION_URL",
      environment.MCP_RESOURCE_DOCUMENTATION_URL ??
        `${authorizationServerUrl}/docs/chatgpt`,
      true
    ),
    sessionIdleTimeoutMs: positiveInteger(
      "MCP_SESSION_IDLE_TIMEOUT_MS",
      environment.MCP_SESSION_IDLE_TIMEOUT_MS,
      30 * 60 * 1_000
    ),
  };
};
