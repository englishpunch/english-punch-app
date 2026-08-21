import type { ServerConfig } from "./config";
import type { GenericId } from "convex/values";

export type AccessTokenClaims = {
  subject: string;
  audiences: string[];
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  resource?: string;
};

export type AuthenticatedRequest = {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  resource?: string;
  userId: GenericId<"users">;
};

type AuthenticationDependencies = {
  now?: () => number;
  validateUser: (
    token: string
  ) => Promise<{ userId: GenericId<"users"> } | null>;
};

export const protectedResourceMetadata = (config: ServerConfig) => ({
  resource: config.resourceUrl,
  authorization_servers: [config.authorizationServerUrl],
  bearer_methods_supported: ["header"],
  scopes_supported: config.supportedScopes,
  resource_documentation: config.resourceDocumentationUrl,
});

const protectedResourceMetadataUrl = (config: ServerConfig) => {
  const resource = new URL(config.resourceUrl);
  const path = resource.pathname === "/" ? "" : resource.pathname;
  return `${resource.origin}/.well-known/oauth-protected-resource${path}`;
};

export const bearerChallenge = (config: ServerConfig) =>
  `Bearer resource_metadata="${protectedResourceMetadataUrl(config)}"`;

export const readBearerToken = (header: string | undefined) => {
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw new Error("A single Bearer access token is required");
  }
  return match[1];
};

const stringArray = (value: unknown, claim: string): string[] => {
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.length > 0)
  ) {
    return value;
  }
  throw new Error(`Access token must include a valid ${claim} claim`);
};

export const decodeAccessTokenClaims = (token: string): AccessTokenClaims => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Access token must be a JWT");
  }

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Access token must contain valid JWT claims");
  }

  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("Access token must include a sub claim");
  }

  const clientId = claims.client_id ?? claims.azp;
  if (typeof clientId !== "string" || clientId.length === 0) {
    throw new Error("Access token must include a client_id or azp claim");
  }

  const scopeClaim = claims.scope ?? claims.scopes;
  const scopes =
    typeof scopeClaim === "string"
      ? scopeClaim.split(/\s+/).filter(Boolean)
      : stringArray(scopeClaim, "scope");

  return {
    subject: claims.sub,
    audiences: stringArray(claims.aud, "aud"),
    clientId,
    scopes,
    ...(typeof claims.exp === "number" ? { expiresAt: claims.exp } : {}),
    ...(typeof claims.resource === "string"
      ? { resource: claims.resource }
      : {}),
  };
};

export const authenticateBearerRequest = async (
  config: ServerConfig,
  authorizationHeader: string | undefined,
  dependencies: AuthenticationDependencies
): Promise<AuthenticatedRequest> => {
  const token = readBearerToken(authorizationHeader);
  const claims = decodeAccessTokenClaims(token);
  const validatedUser = await dependencies.validateUser(token);
  if (!validatedUser || validatedUser.userId !== claims.subject) {
    throw new Error("Access token does not identify an English Punch user");
  }

  if (!claims.audiences.includes(config.oauthAudience)) {
    throw new Error("Access token audience does not match this MCP resource");
  }
  if (claims.resource && claims.resource !== config.resourceUrl) {
    throw new Error("Access token resource does not match this MCP resource");
  }

  if (claims.expiresAt === undefined) {
    throw new Error("Access token must include an exp claim");
  }
  const now = dependencies.now?.() ?? Math.floor(Date.now() / 1000);
  if (claims.expiresAt <= now) {
    throw new Error("Access token has expired");
  }

  const scopes = claims.scopes.filter((scope) =>
    config.supportedScopes.includes(scope)
  );
  if (scopes.length === 0) {
    throw new Error("Access token does not grant an English Punch scope");
  }

  return {
    token,
    clientId: claims.clientId,
    scopes,
    expiresAt: claims.expiresAt,
    ...(claims.resource ? { resource: claims.resource } : {}),
    userId: validatedUser.userId,
  };
};
