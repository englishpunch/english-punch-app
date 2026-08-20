import { importJWK, SignJWT, type JWK } from "jose";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { MCP_RESOURCE, OAUTH_ISSUER, oauthPublicJwk } from "./oauthConfig";
import { sha256Base64Url } from "./oauthProtocol";

const MAX_TOKEN_REQUEST_BYTES = 16_384;
const ACCESS_TOKEN_LIFETIME_SECONDS = 3_600;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });

const oauthError = (error: string) => jsonResponse({ error }, 400);

const readSingle = (form: URLSearchParams, name: string) => {
  const values = form.getAll(name);
  return values.length === 1 && values[0].length > 0 ? values[0] : null;
};

const privateSigningKey = async () => {
  let jwk: JWK;
  try {
    const parsed = JSON.parse(env.MCP_OAUTH_PRIVATE_JWK) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("not an object");
    }
    jwk = parsed;
  } catch {
    throw new Error("MCP_OAUTH_PRIVATE_JWK is not a valid private JWK");
  }
  return await importJWK(jwk, "RS256");
};

export const token = httpAction(async (ctx, request) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_TOKEN_REQUEST_BYTES) {
    return oauthError("invalid_request");
  }

  const body = await request.text();
  if (body.length > MAX_TOKEN_REQUEST_BYTES) {
    return oauthError("invalid_request");
  }
  const form = new URLSearchParams(body);
  if (readSingle(form, "grant_type") !== "authorization_code") {
    return oauthError("unsupported_grant_type");
  }

  const code = readSingle(form, "code");
  const clientId = readSingle(form, "client_id");
  const redirectUri = readSingle(form, "redirect_uri");
  const resource = readSingle(form, "resource");
  const codeVerifier = readSingle(form, "code_verifier");
  if (
    !code ||
    !clientId ||
    !redirectUri ||
    resource !== MCP_RESOURCE ||
    !codeVerifier ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
  ) {
    return oauthError("invalid_request");
  }

  const exchanged: {
    userId: Id<"users">;
    clientId: string;
    resource: string;
    scope: string;
  } | null = await ctx.runMutation(internal.oauth.exchangeAuthorizationCode, {
    codeHash: await sha256Base64Url(code),
    clientId,
    redirectUri,
    resource,
    codeChallenge: await sha256Base64Url(codeVerifier),
    now: Date.now(),
  });
  if (!exchanged) {
    return oauthError("invalid_grant");
  }

  const now = Math.floor(Date.now() / 1_000);
  const accessToken = await new SignJWT({
    client_id: exchanged.clientId,
    scope: exchanged.scope,
    resource: exchanged.resource,
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: oauthPublicJwk.kid,
      typ: "JWT",
    })
    .setIssuer(OAUTH_ISSUER)
    .setSubject(exchanged.userId)
    .setAudience(MCP_RESOURCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_LIFETIME_SECONDS)
    .sign(await privateSigningKey());

  return jsonResponse(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      scope: exchanged.scope,
    },
    200
  );
});
