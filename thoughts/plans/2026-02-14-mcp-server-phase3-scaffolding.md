# Phase 3: MCP Server Scaffolding

## Overview

Create the MCP server package with its `package.json`, `tsconfig.json`, Convex client wrapper, and entry point. This phase establishes the foundation — no tools/prompts/resources yet.

## Prerequisites

- Phase 1 complete (pnpm workspaces + turborepo configured)
- ~~Phase 2 complete (Convex backend updated)~~ — Phase 2 is no longer needed. The MCP server authenticates as a real user, so `getAuthUserId(ctx)` works naturally without any Convex backend changes.

## Desired End State

- `mcp-server/` directory exists as a pnpm workspace package (listed in `pnpm-workspace.yaml`)
- `pnpm install` from root resolves all dependencies
- `mcp-server/src/index.ts` creates a `McpServer` and connects via `StdioServerTransport`
- `mcp-server/src/convex-client.ts` sets up `ConvexHttpClient` with real user authentication (email/password sign-in)
- Server starts without import errors (even though no tools are registered yet)

## What We're NOT Doing

- Implementing any tools, prompts, or resources (Phases 4-5)
- Registering in `~/.claude/mcp.json` yet (Phase 6)
- Adding tests for the MCP server
- Using admin auth (`setAdminAuth` / deploy keys) — the MCP server has no admin privileges

## Implementation

### New Files

#### 1. `mcp-server/package.json`

```json
{
  "name": "@english-punch/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "convex": "^1.31.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.20.6",
    "typescript": "~5.9.3"
  }
}

> **Note:** The package is registered in `pnpm-workspace.yaml` as `"mcp-server"`. Dependencies are installed via `pnpm install` at the monorepo root. pnpm hoists shared deps (e.g. `convex`, `zod`) but keeps the `.pnpm` store layout.
```

#### 2. `mcp-server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
```

#### 3. `mcp-server/src/convex-client.ts`

Convex HTTP client setup with real user authentication:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const CONVEX_URL = "https://strong-otter-914.convex.cloud";

let cachedClient: ConvexHttpClient | null = null;

export async function getConvexClient(): Promise<ConvexHttpClient> {
  if (cachedClient) return cachedClient;

  const email = process.env.CONVEX_USER_EMAIL;
  if (!email) {
    throw new Error(
      "CONVEX_USER_EMAIL environment variable is required."
    );
  }

  const password = process.env.CONVEX_USER_PASSWORD;
  if (!password) {
    throw new Error(
      "CONVEX_USER_PASSWORD environment variable is required."
    );
  }

  const client = new ConvexHttpClient(CONVEX_URL);

  // Authenticate as a real user via the Password provider.
  // This calls the same signIn action the web app uses.
  const result = await client.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });

  // result contains { token, refreshToken }
  // Set the JWT so all subsequent queries/mutations use this user's session.
  const token = result.token as string;
  client.setAuth(token);

  cachedClient = client;
  return client;
}
```

**Auth strategy notes:**
- Calls `auth:signIn` action with email/password — same flow as the web app
- `signIn` creates a session in `authSessions` table and returns a JWT + refresh token
- `client.setAuth(token)` sets the JWT so `getAuthUserId(ctx)` resolves the user naturally
- No admin privileges — MCP server can only access what the authenticated user can access
- Web app sessions are unaffected — both sessions coexist independently

**Token expiry:**
- Default JWT duration is 1 hour, which may be too short for long MCP sessions
- Configure longer JWT duration in `convexAuth()` options if needed (affects all sessions globally)
- Alternative: re-authenticate periodically or implement refresh token rotation

#### 4. `mcp-server/src/index.ts`

Entry point — creates server and connects via stdio:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConvexClient } from "./convex-client.js";

const server = new McpServer({
  name: "english-punch",
  version: "0.1.0",
});

// Authenticate and validate env vars on startup (will throw if missing)
const client = await getConvexClient();

// Tools, prompts, and resources will be registered here in Phases 4-5:
// registerBagTools(server, client);
// registerCardTools(server, client);
// registerLearningTools(server, client);
// registerStatsTools(server, client);
// registerCardGenerationPrompts(server);
// registerSchemaResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Import path note:** The SDK import paths (`@modelcontextprotocol/sdk/server/mcp.js` vs `@modelcontextprotocol/server`) may differ by installed SDK version. Verify after `pnpm install` and adjust if needed.

**Convex API import:** Tool modules will import `api` from the parent project:
```typescript
import { api } from "../../convex/_generated/api.js";
```
This works because `tsx` resolves relative paths at runtime. In the pnpm monorepo, `mcp-server/` is symlinked into `node_modules/@english-punch/mcp-server`, but source files remain in place so relative paths resolve correctly. The `convex/_generated/api.js` file (not `.ts`) is the runtime-ready generated file.

## Impact on Other Phases

### Phase 2 — Eliminated
No Convex backend changes needed. `getOneDueCard` and `getDueCardCount` work as-is because the MCP server authenticates as a real user.

### Phase 4 — Simplified
Tool modules no longer need to pass explicit `userId` to `getOneDueCard` and `getDueCardCount`. All Convex functions that use `getAuthUserId(ctx)` work automatically. Tools that accept `userId` as an explicit argument (e.g. `getUserBags`, `createBag`) still need to know the user ID — this can be obtained by calling `api.auth.loggedInUser` once at startup and caching the result.

### Phase 6 — Env Vars Change
`~/.claude/mcp.json` env block changes from:
```json
{
  "CONVEX_DEPLOY_KEY": "<deploy-key>",
  "CONVEX_USER_ID": "<user-id>"
}
```
to:
```json
{
  "CONVEX_USER_EMAIL": "<email>",
  "CONVEX_USER_PASSWORD": "<password>"
}
```

## Success Criteria

### Automated Verification:
- [x] `pnpm install` from root resolves all workspace deps
- [x] `pnpm --filter @english-punch/mcp-server start` starts without import/syntax errors
  - (It will hang waiting for stdin — that's expected. Ctrl+C to stop.)
- [x] TypeScript types resolve: `pnpm --filter @english-punch/mcp-server exec tsc --noEmit` passes (or only has expected path errors for not-yet-created tool files)

### Manual Verification:
- [x] `mcp-server/node_modules` is created by pnpm (symlinked from the `.pnpm` store)
- [x] `@modelcontextprotocol/sdk` package is installed (check with `pnpm --filter @english-punch/mcp-server ls`)
- [x] Server authenticates successfully with valid email/password env vars
