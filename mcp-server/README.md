# English Punch remote MCP server

The production entry point exposes an OAuth-protected MCP Streamable HTTP
resource at `https://mcp-ep.echoja.com/mcp`. The existing STDIO entry point
remains available for local clients.

## Security model

ChatGPT authenticates the user at the OAuth authorization server on
`https://ep.echoja.com`. The remote MCP server keeps no user password or static
API key. It forwards the bearer JWT to Convex, which verifies the issuer,
signature, and audience and resolves the token subject to an existing English
Punch user. Each Convex function derives the user from the verified token; MCP
tools never accept or forward a model-supplied user ID.

The authorization server must issue access-token JWTs with:

- `iss`: `https://ep.echoja.com`
- `sub`: the English Punch Convex `users` document ID
- `aud`: `https://mcp-ep.echoja.com/mcp`
- `client_id` or `azp`: the OAuth client ID
- `scope` as a space-separated string, or `scopes` as an array
- `exp`: expiry in seconds since the Unix epoch
- `resource`: `https://mcp-ep.echoja.com/mcp` (recommended)

It must publish authorization-server or OpenID discovery plus a JWKS endpoint,
support Authorization Code with PKCE, and support a ChatGPT-compatible client
registration method. The supported scopes are listed in `.env.example`.

## Configure Convex trust

The issuer and resource are fixed in `convex/oauthConfig.ts`. Store the private
signing JWK directly from a protected file, then deploy Convex:

```sh
pnpm exec convex env set MCP_OAUTH_PRIVATE_JWK \
  --from-file /protected/path/private.jwk \
  --env-file .env.convex-selfhost
pnpm exec convex deploy --env-file .env.convex-selfhost
```

Do this only after the issuer's discovery and JWKS URLs are reachable. Convex
uses them to validate access tokens.

## Run locally

Use a real OAuth access token only in a local environment variable or an API
client's authorization field; never commit it or paste it into chat.

```sh
pnpm --filter @english-punch/mcp-server start:http
curl http://localhost:3001/healthz -H 'Host: mcp-ep.echoja.com'
curl http://localhost:3001/.well-known/oauth-protected-resource/mcp \
  -H 'Host: mcp-ep.echoja.com'
```

The health response includes the canonical English Punch product version:

```json
{ "status": "ok", "version": "0.3.7" }
```

## Build and deploy the container

Build from the repository root because the MCP package copies the generated
Convex API definitions:

```sh
docker build -f mcp-server/Dockerfile -t english-punch-mcp .
docker run --rm -p 3001:3001 --env-file mcp-server/.env.local \
  english-punch-mcp
```

On every merge to `main`, `.github/workflows/docker.yml` builds the frontend
and MCP images for `linux/amd64` and `linux/arm64`, publishes both to GHCR with
the same `sha-<commit>` tag and product-version OCI label, and opens one infra
PR that advances both image tags and the Helm `appVersion`. The Argo CD-managed
Helm chart in `echoja/infra/apps/english-punch` owns the MCP Deployment,
Service, and Ingress resources.

For the first deployment, merge the infra chart scaffold while `mcp.enabled`
is still `false`, then merge the app change. The app's `main` build publishes
both images and opens the infra PR that updates both tags and enables MCP. If
the app is merged first, merge the scaffold and rerun the Docker workflow on
`main`; `workflow_dispatch` runs the same recoverable infra-update path.

The production endpoint is exposed through Traefik. The host is already
covered by the Cloudflare Tunnel wildcard
`*.echoja.com -> http://localhost:18081`, so no MCP-specific tunnel rule is
needed. Do not deploy production images with `k3d image import` or apply a
repository-local Kubernetes manifest.

## Connect ChatGPT

After DNS, TLS, OAuth discovery, and the MCP health checks are working:

1. Enable developer mode in ChatGPT settings.
2. Create an app/connector with `https://mcp-ep.echoja.com/mcp` as the MCP URL.
3. Complete OAuth in the browser and grant the desired English Punch scopes.
4. Test `list-bags`, a card creation in a test bag, and the complete
   `start-review` → `reveal-review` → `rate-review` flow.

The authorization server issues a rotating refresh token with the initial
access token, so ChatGPT can renew an expired access token without another
interactive login. After deploying refresh-token support, disconnect and
reconnect any connector that was authorized before the deployment.

The repository plugin bundle is in `plugins/english-punch`. It intentionally
does not contain `.app.json`: that file requires the app ID assigned after the
remote MCP connection is registered.
