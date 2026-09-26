# English Punch OAuth architecture

English Punch is its own OAuth authorization server for the ChatGPT MCP
connection and CLI device login. The issuer is `https://ep.echoja.com`. MCP tokens
use audience `https://mcp-ep.echoja.com/mcp`; CLI tokens use the separate audience
`https://ep-convex.echoja.com` with account-wide `cli:access` permission.

## Convex Auth subject exception

The general Convex rule treats `tokenIdentifier` as the stable identifier for
an external identity. This integration has a narrower contract: access tokens
are minted only after an existing English Punch session is authenticated by
`@convex-dev/auth`, and their signed `sub` claim is the corresponding Convex
`Id<"users">`. English Punch therefore uses the official
`getAuthUserId(ctx)` helper to recover that database ownership key.

This exception is safe only while all of the following remain true:

- English Punch is the token issuer.
- Convex validates the token signature, issuer, and the appropriate MCP or CLI audience before a
  function runs.
- The authorization action obtains the subject from the authenticated English
  Punch session; clients cannot supply or override it.
- The MCP server confirms that the token resolves to the same typed Convex user
  ID before exposing tools.

Do not generalize this exception to third-party identity tokens. Those must use
an issuer-aware `tokenIdentifier` mapping.

## OAuth properties

- Authorization Code flow with PKCE S256
- ChatGPT Client ID Metadata Document validation
- One-time authorization codes with a five-minute lifetime
- RS256 access tokens with a one-hour lifetime
- Opaque, rotating refresh tokens with a sliding 30-day lifetime
- Hashed refresh-token storage with client and resource binding
- Exact resource and audience binding
- Per-tool least-privilege scopes
- No client secrets in ChatGPT

The token endpoint supports both `authorization_code` and `refresh_token`
grants. Every successful refresh invalidates the presented refresh token and
returns a replacement. Expired and replayed tokens return `invalid_grant`; a
detected replay also revokes the active token in the same token family.

Connections authorized before refresh-token support was deployed do not have a
refresh token. Disconnect and reconnect the English Punch connector once after
deployment so ChatGPT receives one through a new authorization-code exchange.

## CLI device authorization

The public CLI client ID is `english-punch-cli`; no client secret is distributed.
`POST /oauth/device/code` accepts that client, CLI resource, and `cli:access` scope.
It returns a 256-bit device code, an eight-character user code (40 bits), a
15-minute expiry, and a five-second polling interval. Both codes are hashed in
storage. Issuance is rate limited globally to 60 per minute; approval attempts,
including failed guesses, are limited to 10 per minute per signed-in user using
`@convex-dev/rate-limiter`.

`/device` requires an existing browser login and an explicit Allow/Deny decision.
Visiting a prefilled link never grants access. The public decision mutation does
not accept a user ID and rejects OAuth identities; only the authenticated browser
session supplies the subject. The screen describes the CLI's account-wide access.

`POST /oauth/token` also accepts
`urn:ietf:params:oauth:grant-type:device_code`. Pending requests return
`authorization_pending`; early polls return `slow_down` and increase the required
interval by five seconds. Denied/expired codes return `access_denied`/`expired_token`.
A successful exchange consumes the device code transactionally and creates a
refresh-token family. CLI refresh uses the existing rotation/replay protection,
bound to the CLI client and resource. Device records are cleaned up hourly.

### Rollout

Deploy the Convex schema, rate limiter component, HTTP routes, and CLI JWT provider
before deploying the frontend and releasing the CLI. No database backfill is
required for device grants. The existing OAuth signing key is reused. CLI tokens
are intentionally rejected by the MCP audience verifier.

The web Caddy configuration proxies `/oauth/token` and `/oauth/device/code` to
`https://ep-convex-site.echoja.com`, while `/device` uses the SPA. Any upstream
proxy that separately routes OAuth paths must also forward the new device endpoint.
Publish the updated static OAuth/OpenID metadata with the web application.
Verify the deployed metadata, one device login, refresh, and an authenticated
read before publishing the CLI release. Local tests do not verify live proxy rules.

## Due-card aggregate migration

After deploying this version to an existing Convex database, start the
idempotent aggregate backfill once. Each mutation processes a bounded page and
schedules the next page until every existing card is indexed:

```sh
node --env-file=.env.convex-selfhost node_modules/convex/bin/main.js \
  run cardAggregate:backfillDueCards '{"cursor":null}'
```

New databases do not require a backfill. All card creation and update mutations
maintain the aggregate transactionally after this migration.

## References

- [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth)
- [OAuth 2.0 refresh-token grant](https://www.rfc-editor.org/rfc/rfc6749.html#section-6)
- [OAuth 2.0 refresh-token protection](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)

- [OAuth 2.0 Device Authorization Grant (RFC 8628)](https://www.rfc-editor.org/rfc/rfc8628.html)
- [GitHub CLI login](https://cli.github.com/manual/gh_auth_login)
