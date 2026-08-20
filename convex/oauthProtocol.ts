import { MCP_OAUTH_SCOPES, MCP_RESOURCE, OAUTH_ISSUER } from "./oauthConfig";

const CHATGPT_CLIENT_PATH =
  /^\/oauth\/(?:client|[A-Za-z0-9_-]+\/client)\.json$/;
const MAX_CLIENT_METADATA_BYTES = 65_536;

type ClientMetadata = {
  client_id?: unknown;
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  token_endpoint_auth_methods_supported?: unknown;
};

const base64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

export const randomOAuthToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

export const sha256Base64Url = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return base64Url(new Uint8Array(digest));
};

export const normalizeRequestedScopes = (scope: string) => {
  if (scope.length > 1_024) {
    throw new Error("OAuth scope is too long");
  }
  const requested = [...new Set(scope.split(/\s+/).filter(Boolean))];
  if (
    requested.length === 0 ||
    requested.some(
      (candidate) =>
        !MCP_OAUTH_SCOPES.includes(
          candidate as (typeof MCP_OAUTH_SCOPES)[number]
        )
    )
  ) {
    throw new Error("OAuth scope is not supported");
  }
  return requested.join(" ");
};

export const validateAuthorizationRequest = (args: {
  responseType: string;
  resource: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}) => {
  if (args.responseType !== "code") {
    throw new Error("Only the OAuth authorization-code flow is supported");
  }
  if (args.resource !== MCP_RESOURCE) {
    throw new Error("OAuth resource does not match English Punch MCP");
  }
  if (args.codeChallengeMethod !== "S256") {
    throw new Error("PKCE S256 is required");
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(args.codeChallenge)) {
    throw new Error("PKCE code challenge is invalid");
  }
  return normalizeRequestedScopes(args.scope);
};

export const validateChatGptClient = async (
  clientId: string,
  redirectUri: string
) => {
  let clientMetadataUrl: URL;
  try {
    clientMetadataUrl = new URL(clientId);
  } catch {
    throw new Error("OAuth client_id must be a valid ChatGPT CIMD URL");
  }
  if (
    clientMetadataUrl.protocol !== "https:" ||
    clientMetadataUrl.hostname !== "chatgpt.com" ||
    clientMetadataUrl.port !== "" ||
    clientMetadataUrl.search !== "" ||
    clientMetadataUrl.hash !== "" ||
    !CHATGPT_CLIENT_PATH.test(clientMetadataUrl.pathname)
  ) {
    throw new Error("OAuth client_id is not an approved ChatGPT CIMD URL");
  }

  const response = await fetch(clientMetadataUrl, {
    headers: { Accept: "application/json" },
    redirect: "error",
  });
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (!response.ok || contentLength > MAX_CLIENT_METADATA_BYTES) {
    throw new Error("ChatGPT client metadata could not be verified");
  }

  const text = await response.text();
  if (text.length > MAX_CLIENT_METADATA_BYTES) {
    throw new Error("ChatGPT client metadata is too large");
  }

  let metadata: ClientMetadata;
  try {
    metadata = JSON.parse(text) as ClientMetadata;
  } catch {
    throw new Error("ChatGPT client metadata is not valid JSON");
  }

  const redirectUris = metadata.redirect_uris;
  const authMethods = Array.isArray(
    metadata.token_endpoint_auth_methods_supported
  )
    ? metadata.token_endpoint_auth_methods_supported
    : [metadata.token_endpoint_auth_method];
  if (
    (metadata.client_id !== undefined && metadata.client_id !== clientId) ||
    !Array.isArray(redirectUris) ||
    !redirectUris.every((uri) => typeof uri === "string") ||
    !redirectUris.includes(redirectUri) ||
    !authMethods.includes("none")
  ) {
    throw new Error("ChatGPT client metadata does not authorize this request");
  }
};

export const oauthRedirect = (
  redirectUri: string,
  parameters: Record<string, string | undefined>
) => {
  const redirect = new URL(redirectUri);
  for (const [name, value] of Object.entries({
    ...parameters,
    iss: OAUTH_ISSUER,
  })) {
    if (value !== undefined) {
      redirect.searchParams.set(name, value);
    }
  }
  return redirect.toString();
};
