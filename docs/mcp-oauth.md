# ChatGPT MCP OAuth architecture

English Punch is its own OAuth authorization server for the ChatGPT MCP
connection. The issuer is `https://ep.echoja.com`, and the only resource and
access-token audience is `https://mcp-ep.echoja.com/mcp`.

## Convex Auth subject exception

The general Convex rule treats `tokenIdentifier` as the stable identifier for
an external identity. This integration has a narrower contract: access tokens
are minted only after an existing English Punch session is authenticated by
`@convex-dev/auth`, and their signed `sub` claim is the corresponding Convex
`Id<"users">`. English Punch therefore uses the official
`getAuthUserId(ctx)` helper to recover that database ownership key.

This exception is safe only while all of the following remain true:

- English Punch is the token issuer.
- Convex validates the token signature, issuer, and MCP audience before a
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
