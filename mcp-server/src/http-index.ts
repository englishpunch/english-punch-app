#!/usr/bin/env node
import { loadServerConfig } from "./config.js";
import { getConvexClientForAccessToken } from "./convex-client.js";
import { createMcpHttpServer } from "./http-server.js";
import { authenticateBearerRequest } from "./oauth.js";

const config = loadServerConfig();
const server = createMcpHttpServer(config, {
  authenticate: async (authorizationHeader) => {
    let authenticatedClient:
      Awaited<ReturnType<typeof getConvexClientForAccessToken>> | undefined;
    const auth = await authenticateBearerRequest(config, authorizationHeader, {
      validateUser: async (token) => {
        authenticatedClient = await getConvexClientForAccessToken(
          config.convexUrl,
          token
        );
        return { userId: authenticatedClient.userId };
      },
    });

    if (!authenticatedClient) {
      throw new Error("Access token validation did not complete");
    }
    return { auth, client: authenticatedClient.client };
  },
});

server.listen(config.port, config.host, () => {
  console.error(
    `English Punch MCP listening on ${config.host}:${config.port} for ${config.resourceUrl}`
  );
});

const shutdown = () => {
  server.close((error) => {
    if (error) {
      console.error("Failed to close English Punch MCP cleanly", error);
      process.exitCode = 1;
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
