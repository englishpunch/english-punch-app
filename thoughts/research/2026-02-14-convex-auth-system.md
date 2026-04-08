---
date: 2026-02-14T18:00:00+09:00
researcher: claude
git_commit: 96d6b0323f7f14b695957e93e02330c39bcdbd51
branch: main
repository: english-punch-app
topic: "How does the Convex auth system work, and how can the MCP server authenticate as a real user?"
tags: [research, codebase, auth, convex, mcp-server, password-provider, jwt, sessions]
status: complete
last_updated: 2026-02-14
last_updated_by: claude
---

# Research: Convex Auth System & MCP Server Authentication

**Date**: 2026-02-14T18:00:00+09:00
**Researcher**: claude
**Git Commit**: 96d6b0323f7f14b695957e93e02330c39bcdbd51
**Branch**: main
**Repository**: english-punch-app

## Research Question

How is the Convex auth system configured in this app? Specifically:
1. What auth provider(s) does `@convex-dev/auth` use?
2. How are auth sessions managed (tokens, cookies, etc.)?
3. How does the web app authenticate with Convex?
4. What would be needed for the MCP server to authenticate as a real user (not admin) so that `getAuthUserId(ctx)` works naturally?

## Summary

The app uses **Password-only** authentication via `@convex-dev/auth/providers/Password` (email + password, Scrypt hashing). Sessions use **RS256 JWT access tokens** (1 hour expiry) + **refresh tokens** (30 day expiry), stored in `localStorage` on the client. The web app wraps everything in `ConvexAuthProvider` which handles token storage and automatic refresh.

For the MCP server to authenticate as a real user (instead of using admin deploy keys), it needs to:
1. Call the `signIn` action with the user's email/password to obtain JWT + refresh tokens
2. Use `ConvexHttpClient.setAuth()` with a token provider that returns the JWT
3. Handle token refresh when the JWT expires (every 1 hour)

This approach means `getAuthUserId(ctx)` works identically to the web app — no Convex backend changes needed.

## Detailed Findings

### 1. Auth Provider: Password Only

**`convex/auth.ts:1-7`**

```typescript
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

- Single provider: `Password` (email/password)
- No OAuth (Google, GitHub, etc.)
- Password hashing: Scrypt (via Lucia library)
- `convexAuth()` exports: `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`

### 2. Database Schema

**`convex/schema.ts:1-8`**

`authTables` from `@convex-dev/auth/server` creates these tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User profiles | `email`, `name`, `isAnonymous` |
| `authAccounts` | Provider accounts | `userId`, `provider`, `providerAccountId`, `secret` (hashed pw) |
| `authSessions` | Active sessions | `userId`, `expirationTime` |
| `authRefreshTokens` | Refresh tokens | `sessionId`, `expirationTime`, `firstUsedTime`, `parentRefreshTokenId` |
| `authVerificationCodes` | Magic links, OTP | — |
| `authRateLimits` | Rate limiting | — |

### 3. Token System

**JWT Access Token** (1 hour default):
- Algorithm: RS256
- Signing key: `JWT_PRIVATE_KEY` environment variable (PKCS8)
- Public key: exposed at `/.well-known/jwks.json` HTTP endpoint
- `sub` claim format: `"${userId}|${sessionId}"` (pipe-delimited)
- `iss`: `CONVEX_SITE_URL`
- `aud`: `"convex"`

**Refresh Token** (30 day default):
- Format: `"${refreshTokenId}|${sessionId}"` (pipe-delimited)
- Stored in `authRefreshTokens` table
- Supports reuse detection with tree structure (prevents replay attacks)
- 10-second reuse window for concurrent requests

**Client Storage**:
- JWT key: `__convexAuthJWT` in localStorage
- Refresh token key: `__convexAuthRefreshToken` in localStorage
- Namespaced by deployment URL

### 4. Web App Auth Flow

**Provider setup** — `src/main.tsx:14`:
```
<ConvexAuthProvider client={convex}>
```

**Auth gate** — `src/App.tsx:12`:
```typescript
const loggedInUser = useQuery(api.auth.loggedInUser);
// undefined = loading, null = not authenticated, object = authenticated
```

**Sign-in flow** — `src/components/AuthPage.tsx:57`:
```typescript
signIn("password", formData)  // formData: { email, password, flow: "signIn"|"signUp" }
```

1. Client calls `signIn("password", { email, password, flow })` via `useAuthActions()`
2. Backend action `auth:signIn` routes to Password provider's `authorize()` callback
3. `authorize()` queries `authAccounts` by `["provider", "providerAccountId"]` index
4. Verifies password hash (Scrypt)
5. Creates session in `authSessions` table (30 day expiry)
6. Generates JWT + refresh token
7. Returns tokens to client
8. `ConvexAuthProvider` stores tokens in localStorage
9. All subsequent Convex requests include JWT automatically
10. `getAuthUserId(ctx)` validates JWT → extracts userId from `sub` claim

### 5. `getAuthUserId(ctx)` Resolution

```
ctx.auth.getUserIdentity()  →  Convex runtime validates JWT signature via JWKS
                             →  Returns identity with subject claim
                             →  Split "userId|sessionId" on "|"
                             →  Return userId as Id<"users">
```

### 6. MCP Server Current State

**`mcp-server/src/index.ts:1`**: Empty stub (`export {};`)
**`mcp-server/package.json`**: No dependencies installed

The original plan (Phase 2-6 docs) used `setAdminAuth(deployKey)` + explicit `userId` parameter. This approach is being reconsidered in favor of real user authentication.

### 7. How MCP Server Can Authenticate as Real User

Two mechanisms available on `ConvexHttpClient`:

- `setAdminAuth(deployKey)` — admin access, bypasses auth (current plan, being abandoned)
- `setAuth(tokenProvider)` — user-level auth, provides JWT to Convex runtime

**Option A: Direct signIn via Convex HTTP action**

The MCP server can call the `auth:signIn` action with email/password credentials:

1. Store user's email/password as env vars (or prompt on first use)
2. Call `signIn` action to get JWT + refresh token
3. Use `client.setAuth(() => jwt)` to authenticate as that user
4. Refresh token every ~1 hour using the refresh token

**Option B: Create a custom Convex action for token generation**

Create a new internal action that:
1. Validates credentials (email + password)
2. Creates a session via `callSignIn()` helper
3. Returns JWT + refresh token
4. MCP server calls this action once, then uses tokens

**Key constraint**: The Password provider's `signIn` action is exposed as a Convex action, not a simple HTTP endpoint. The MCP server would need to call it via `ConvexHttpClient.action()`.

**Token refresh**: JWT expires every 1 hour. The MCP server needs to either:
- Re-authenticate with email/password periodically
- Implement refresh token rotation (call the `auth:signIn` mutation with existing refresh token)
- Use a longer JWT duration (configurable in `convexAuth()` options)

## Code References

- `convex/auth.ts:1-22` — Auth configuration with Password provider
- `convex/auth.config.ts:1-8` — Auth config with Convex as identity provider
- `convex/schema.ts:6` — `...authTables` spread into schema
- `src/main.tsx:14` — `ConvexAuthProvider` wrapping app
- `src/App.tsx:12` — Auth state check via `useQuery(api.auth.loggedInUser)`
- `src/components/AuthPage.tsx:57` — `signIn("password", formData)` call
- `src/lib/convexClient.ts:25` — `ConvexReactClient` initialization
- `mcp-server/src/index.ts:1` — Empty stub

## Architecture Documentation

### Auth Flow Diagram

```
[User] → email/password → [AuthPage.tsx]
  → signIn("password", formData) → [ConvexAuthProvider]
    → action auth:signIn → [Password provider authorize()]
      → query authAccounts → verify Scrypt hash
      → insert authSessions → generate JWT (RS256) + refresh token
    ← { token, refreshToken }
  → store in localStorage
  → all queries include JWT automatically
    → getAuthUserId(ctx) → validates JWT → extracts userId from sub claim
```

### MCP Server Auth (Proposed)

```
[MCP Server] → email/password from env vars
  → ConvexHttpClient.action(api.auth.signIn, { provider: "password", params: { email, password, flow: "signIn" } })
  ← { token, refreshToken }
  → client.setAuth(() => token)
  → all queries authenticated as real user
  → getAuthUserId(ctx) works naturally — no backend changes needed
```

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-14-mcp-server-phase2-convex-backend.md` — Original plan to add optional `userId` param to `getOneDueCard` and `getDueCardCount` (now potentially unnecessary)
- `thoughts/shared/plans/2026-02-14-mcp-server-phase3-scaffolding.md` — Original MCP scaffolding plan using `setAdminAuth(deployKey)`
- `thoughts/shared/plans/2026-02-14-mcp-server-phase4-tools.md` — Tool implementations passing explicit `userId`
- `thoughts/shared/plans/2026-02-14-mcp-server-phase6-registration.md` — MCP registration with `CONVEX_DEPLOY_KEY` and `CONVEX_USER_ID` env vars

## Open Questions

1. **Token refresh in MCP**: How should the MCP server handle JWT expiry (1hr)? Options:
   - Re-authenticate with email/password each time
   - Implement refresh token rotation
   - Configure longer JWT duration in `convexAuth()` options
   - Accept the 1hr limit (MCP sessions are typically short)

2. **Credential storage**: Where should user email/password be stored for MCP?
   - Environment variables in `~/.claude/mcp.json` (simple but password in plaintext)
   - System keychain integration
   - Interactive prompt on first use with token caching

3. **`signIn` action accessibility**: Can `ConvexHttpClient` (without any auth) call the `auth:signIn` action? This action is typically called from the unauthenticated client in the browser — needs verification that it works the same way via `ConvexHttpClient`.

4. **Multiple sessions**: Creating a new MCP session — does it invalidate existing web app sessions? The `createNewAndDeleteExistingSession` function name suggests it might.
