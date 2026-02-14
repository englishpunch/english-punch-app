# Phase 6: Register MCP Server and End-to-End Verification

## Overview

Register the MCP server in Claude Code's `~/.claude/mcp.json`, set up credentials, and verify everything works end-to-end.

## Prerequisites

- All previous phases (1-5) complete
- Access to Convex dashboard for credential retrieval

## Desired End State

- MCP server appears in Claude Code `/mcp` output
- All 15 tools, 3 prompts, and 1 resource are available
- Read and write operations work against the live Convex backend
- Credentials stored securely in MCP config env vars

## What We're NOT Doing

- Setting up CI/CD for the MCP server
- Publishing the MCP server as an npm package
- Adding to the root `npm run check` script

## Implementation

### 1. Get Credentials

#### Convex Deploy Key
1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select the `strong-otter-914` deployment
3. Settings → Deploy Keys
4. Copy the deploy key (format: `prod:...` or `dev:...`)

#### User ID
1. Go to Convex Dashboard → Data
2. Open the `users` table
3. Copy your `_id` value (format: `j57...` or similar Convex ID)

### 2. Update `~/.claude/mcp.json`

**File**: `~/.claude/mcp.json`

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "uvx",
      "args": ["mcp-google-sheets@latest"],
      "env": {
        "SERVICE_ACCOUNT_PATH": "/Users/th.kim/Downloads/lucid-access-487306-p6-59149cfbc828.json"
      }
    },
    "english-punch": {
      "command": "pnpm",
      "args": ["--dir", "/Users/th.kim/Desktop/english-punch-app", "--filter", "@english-punch/mcp-server", "start"],
      "env": {
        "CONVEX_DEPLOY_KEY": "<paste-deploy-key-here>",
        "CONVEX_USER_ID": "<paste-user-id-here>"
      }
    }
  }
}
```

**Note:** This file is at `~/.claude/mcp.json` (user home, not project root), so it's not in git.

### 3. Restart Claude Code

The MCP server loads on Claude Code startup. A restart is required after changing `mcp.json`.

### 4. CLAUDE.md Update

Add MCP server reference to `CLAUDE.md` for future context:

```diff
+## MCP Server
+
+An MCP server at `mcp-server/` provides Claude Code tools for managing bags, cards, and learning sessions.
+
+- `pnpm --filter @english-punch/mcp-server start` — start the MCP server manually
+- Registered in `~/.claude/mcp.json` as `english-punch`
+- Requires `CONVEX_DEPLOY_KEY` and `CONVEX_USER_ID` env vars
```

## End-to-End Verification Checklist

### Connection & Discovery:
- [ ] Restart Claude Code
- [ ] `/mcp` shows `english-punch` server as connected
- [ ] 15 tools listed
- [ ] 3 prompts listed
- [ ] 1 resource listed

### Read Operations:
- [ ] `list-bags` — returns your bags with card counts
- [ ] `get-bag-stats` — returns detailed stats for a specific bag
- [ ] `list-cards` — returns paginated cards from a bag
- [ ] `get-due-card-count` — returns a number
- [ ] `get-user-settings` — returns FSRS parameters and streak data
- [ ] `get-review-history` — returns recent review logs

### Write Operations:
- [ ] `create-bag` with name "MCP Test Bag" — returns new bag ID
- [ ] `create-card` in the test bag — card appears in app
- [ ] `create-cards-batch` with 3 cards — all 3 appear in app
- [ ] `update-card` — card content changes in app
- [ ] `delete-card` — card disappears from app
- [ ] `delete-bag` — test bag disappears from app

### Learning Operations:
- [ ] `get-due-card` — returns a card or "NO_CARD_AVAILABLE"
- [ ] `review-card` with rating 3 — returns next review schedule

### Prompts:
- [ ] `generate-card` with word "hesitate" — produces valid card JSON
- [ ] `generate-cards-batch` with topic "emotions" — produces 5 cards
- [ ] `improve-card` with a weak card — provides improvements

### Resource:
- [ ] Card format resource accessible and contains schema documentation

## Troubleshooting

### Server doesn't appear in `/mcp`:
- Check `~/.claude/mcp.json` for JSON syntax errors
- Verify the `--dir` path and `--filter` package name are correct
- Check that `pnpm install` was run from the project root

### Tools return errors:
- Verify `CONVEX_DEPLOY_KEY` is correct and not expired
- Verify `CONVEX_USER_ID` matches an existing user in the database
- Run `pnpm --filter @english-punch/mcp-server start` manually to see error output on stderr

### Import errors:
- Ensure `convex/_generated/api.js` exists (run `pnpm exec convex dev` first)
- Check that the relative import path `../../convex/_generated/api.js` resolves correctly from `mcp-server/src/tools/`
- If pnpm strict mode causes resolution issues, verify `convex` is listed in `mcp-server/package.json` dependencies

## References

- MCP server source: `mcp-server/src/`
- Convex deployment: `dev:strong-otter-914`
- Convex URL: `https://strong-otter-914.convex.cloud`
- MCP config: `~/.claude/mcp.json`
