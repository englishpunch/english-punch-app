# Phase 4: Implement MCP Tools

## Overview

Register all 15 MCP tools across 4 modules: bags (4), cards (6), learning (3), and stats (2). Each tool wraps a Convex query or mutation, translating MCP string inputs to Convex typed arguments.

## Prerequisites

- Phase 3 complete (server scaffolding exists)

## Desired End State

- 15 tools registered on the MCP server
- Each tool calls the corresponding Convex function via `ConvexHttpClient`
- Tools return structured JSON responses
- `mcp-server/src/index.ts` imports and registers all tool modules

## What We're NOT Doing

- Adding authentication/authorization beyond the deploy key
- Implementing prompts or resources (Phase 5)
- Adding input validation beyond what zod schemas provide
- Creating wrapper types for Convex IDs (using string + cast)

## Implementation

### File Structure

```
mcp-server/src/tools/
  bags.ts       # 4 tools
  cards.ts      # 6 tools
  learning.ts   # 3 tools
  stats.ts      # 2 tools
```

### Common Pattern

Each module exports a `register*Tools(server, client)` function:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../convex/_generated/api.js";
import { getUserId } from "../convex-client.js";

export function registerBagTools(server: McpServer, client: ConvexHttpClient) {
  const userId = getUserId();

  server.tool(
    "tool-name",
    "Description of the tool",
    { param: z.string().describe("Description") },
    async ({ param }) => {
      const result = await client.query(api.module.function, { ... });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

**Note on Convex IDs:** MCP tool inputs are strings. Convex expects typed `Id<"table">`. We cast at the boundary: `userId as Id<"users">`. The `as any` pattern avoids importing Convex's `Id` generic type.

---

### 1. `mcp-server/src/tools/bags.ts` — Bag CRUD (4 tools)

| Tool | Type | Convex Function | Inputs | Output |
|------|------|----------------|--------|--------|
| `list-bags` | Query | `api.learning.getUserBags` | (none) | Array of bags with name, card counts, tags |
| `create-bag` | Mutation | `api.learning.createBag` | `name: string` | New bag ID |
| `delete-bag` | Mutation | `api.learning.deleteBag` | `bagId: string` | Confirmation |
| `get-bag-stats` | Query | `api.learning.getBagDetailStats` | `bagId: string` | Bag info + difficulty/stability/reps/lapses distributions |

---

### 2. `mcp-server/src/tools/cards.ts` — Card CRUD (6 tools)

| Tool | Type | Convex Function | Inputs | Output |
|------|------|----------------|--------|--------|
| `create-card` | Mutation | `api.learning.createCard` | `bagId, question, answer, hint?, explanation?, context?, sourceWord?, expression?` | Confirmation with answer |
| `create-cards-batch` | Mutation | `api.learning.createCardsBatch` | `bagId, cards: Array<{question, answer, hint?, explanation?, context?, sourceWord?, expression?}>` | Count of created cards |
| `get-card` | Query | `api.learning.getCard` | `cardId, bagId` | Full card details including FSRS state |
| `list-cards` | Query | `api.learning.getBagCardsPaginated` | `bagId, search?, cursor?` | Paginated cards (30/page) with continuation cursor |
| `update-card` | Mutation | `api.learning.updateCard` | `cardId, bagId, question, answer, hint?, explanation?, context?, sourceWord?, expression?` | Confirmation |
| `delete-card` | Mutation | `api.learning.deleteCard` | `cardId, bagId` | Confirmation |

**Card format reminder:**
- `question`: Sentence with `___` blank, e.g. `"I'd like to ___ a table for two"`
- `answer`: Word that fills the blank, e.g. `"reserve"`
- `hint`: Clue under 12 words, e.g. `"book in advance"`
- `explanation`: 10-70 words explaining usage and contrasting synonyms

---

### 3. `mcp-server/src/tools/learning.ts` — Learning Session (3 tools)

| Tool | Type | Convex Function | Inputs | Output |
|------|------|----------------|--------|--------|
| `get-due-card` | Query | `api.learning.getOneDueCard` | `bagId` | Next due card or "NO_CARD_AVAILABLE" |
| `get-due-card-count` | Query | `api.learning.getDueCardCount` | `bagId` | Number of due cards |
| `review-card` | Mutation | `api.fsrs.reviewCard` | `cardId, rating: 1\|2\|3\|4, duration: number (ms), sessionId?` | Next review date, new state/stability/difficulty |

**Rating semantics:**
- `1` = Again (forgot completely)
- `2` = Hard (recalled with difficulty)
- `3` = Good (recalled correctly)
- `4` = Easy (recalled effortlessly)

**FSRS state labels for response:**
- `0` = New, `1` = Learning, `2` = Review, `3` = Relearning

The `review-card` tool should map numeric state to human-readable labels in its response.

**Note:** `get-due-card` and `get-due-card-count` pass `userId` explicitly (Phase 2 change).

---

### 4. `mcp-server/src/tools/stats.ts` — Stats & Settings (2 tools)

| Tool | Type | Convex Function | Inputs | Output |
|------|------|----------------|--------|--------|
| `get-review-history` | Query | `api.fsrs.getRecentReviewLogs` | `limit?: number` | Array of recent reviews with card, rating, duration |
| `get-user-settings` | Query | `api.fsrs.getUserSettings` | (none) | FSRS parameters, daily limits, streak data |

---

### 5. Update `mcp-server/src/index.ts`

Uncomment/add tool registration imports:

```typescript
import { registerBagTools } from "./tools/bags.js";
import { registerCardTools } from "./tools/cards.js";
import { registerLearningTools } from "./tools/learning.js";
import { registerStatsTools } from "./tools/stats.js";

// After server creation:
registerBagTools(server, client);
registerCardTools(server, client);
registerLearningTools(server, client);
registerStatsTools(server, client);
```

## Success Criteria

### Automated Verification:
- [ ] `pnpm --filter @english-punch/mcp-server start` starts without errors
- [ ] TypeScript compiles: `pnpm --filter @english-punch/mcp-server exec tsc --noEmit`

### Manual Verification (after Phase 6 registration):
- [ ] `/mcp` in Claude Code shows 15 tools
- [ ] `list-bags` returns actual bag data
- [ ] `create-bag` + `delete-bag` round-trip works
- [ ] `create-card` creates a card visible in the app
- [ ] `get-due-card` returns a card or "NO_CARD_AVAILABLE"
- [ ] `review-card` with rating 3 returns next review schedule
