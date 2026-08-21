import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import {
  oauthAuthorizationServerMetadata,
  oauthPublicJwk,
} from "./oauthConfig";
import { token } from "./oauthHttp";

const http = httpRouter();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

http.route({
  path: "/.well-known/oauth-authorization-server",
  method: "GET",
  handler: httpAction(async () =>
    jsonResponse(oauthAuthorizationServerMetadata)
  ),
});

http.route({
  path: "/oauth/jwks",
  method: "GET",
  handler: httpAction(async () => jsonResponse({ keys: [oauthPublicJwk] })),
});

http.route({ path: "/oauth/token", method: "POST", handler: token });

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: Date.now() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }),
});

// CORS preflight handler
http.route({
  path: "/api/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;
