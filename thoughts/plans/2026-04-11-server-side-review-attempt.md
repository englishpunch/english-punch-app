---
date: 2026-04-11
author: claude
status: draft
topic: Server-side pending-review concept for stateless CLI review flow
---

# Server-Side Pending Reviews

## Overview

Split the interactive review loop into three stateless, composable CLI commands. Each command is one round-trip to Convex; no client-side state file, no TUI. A new small `pendingReviews` table on the server holds the transient per-attempt state between calls — it is **ephemeral** (row is deleted on rating or abandonment) so the existing append-only `reviewLogs` ledger stays untouched.

Motivation:

- The current review flow (`FSRSStudySession` in `src/components/FSRSStudySession.tsx`) is a single interactive component that tracks `startTime`, reveals the answer, and submits the rating in one session. The CLI inherits none of that context between invocations.
- A client-side state file (`~/.config/english-punch/current-review.json`) is simpler but breaks under two terminals, two devices, or cleared home dirs.
- We rejected extending `reviewLogs` with a `status` field because it would force `rating`, `duration`, and every FSRS field (`stability`, `difficulty`, `scheduled_days`, `elapsed_days`, …) to become optional. Every existing aggregation query (`fsrs:getRecentReviewLogs`, `dailyStats`) would need a `status = "completed"` filter forever or silently miscount. Mutable rows also don't belong in an append-only ledger.
- A tiny dedicated table — max one row per active user, deleted on terminal state — is semantically cleaner and leaves every existing query alone.

## Scope

- **In scope**: new `pendingReviews` table, three Convex mutations (`startReview`, `revealReview`, `rateReview`), CLI commands `ep review start / reveal / rate`, fallback to `default_bag_id` from config.
- **Out of scope**: multi-card attempts, collaborative review, attempt history UI on the web app, abandoning stale attempts via cron. Web app continues to use the existing single-shot `fsrs:reviewCard` mutation unchanged.

---

## Data Model

### New table: `pendingReviews`

Defined in `convex/fsrsSchema.ts` alongside `reviewLogs`. **Ephemeral**: at most one row per user, deleted on `rateReview` or `abandonReview`.

| Field | Type | Notes |
|---|---|---|
| `userId` | `v.id("users")` | Owner; indexed |
| `cardId` | `v.id("cards")` | The card under review |
| `bagId` | `v.id("bags")` | Denormalized for scoping |
| `startTime` | `v.number()` | `Date.now()` at creation — source of truth for `duration` |
| `revealTime` | `v.optional(v.number())` | Set on `revealReview`. Presence = "answer has been shown" |

No `status`, no `rating`, no `reviewLogId`, no `endTime`, no `source`. The lifecycle is encoded in row existence and the presence of `revealTime`:

- Row absent → no pending review
- Row present, `revealTime === undefined` → question shown, answer hidden
- Row present, `revealTime !== undefined` → answer revealed, awaiting rating

Indexes:

- `by_user` on `["userId"]` — `getCurrentPendingReview` reads by user (expected cardinality ≤ 1 row per user).

State transitions:

```
(no row) ──startReview──▶ row created ──revealReview──▶ revealTime set
                                │                              │
                                │                              ├─rateReview──▶ (row deleted, reviewLogs row inserted)
                                │                              │
                                └───── abandonReview / stale timeout ─────▶ (row deleted, no log)
```

A user can only have **one** pending review at a time. `startReview` enforces this by checking for an existing row and either rejecting or auto-abandoning it if stale (> 30 minutes).

### Why not reuse `reviewLogs`?

`reviewLogs` (convex/fsrsSchema.ts:131) is an append-only ledger with required `rating`, `duration`, and FSRS fields (`state`, `stability`, `difficulty`, `scheduled_days`, `learning_steps`, `elapsed_days`). Those fields only exist *after* FSRS processes the rating, so the only way to put "pending" rows there would be to make all of them optional. That change would ripple into every reader (`fsrs:getRecentReviewLogs`, `dailyStats` aggregates, any future analytics) which would then need an explicit "completed only" filter forever — and silently miscount where the filter is forgotten. Mutable rows in an append-only ledger is also a clean-code smell. A tiny dedicated table keeps the ledger pristine.

---

## Convex Mutations

All live in a new file `convex/review.ts`. Each enforces ownership via `userId` + the active auth token (following the pattern in `convex/fsrs.ts:42-58`).

Since there is at most one pending review per user, none of these mutations take an `attemptId` — the row is always looked up by `userId`.

### `review:startReview`

- **Args**: `userId`, `bagId`
- **Behavior**:
  1. Look up any existing pending review for this user via the `by_user` index.
     - If found and `startTime` is older than 30 minutes, delete it (auto-abandon) and continue.
     - If found and fresh, reject with `REVIEW_ALREADY_PENDING` and the existing `cardId` so the client can route the user to `reveal`/`rate`/`abort`.
  2. Call the same query used by `learning:getOneDueCard` (convex/learning.ts:238) to fetch the next due card in `bagId`.
  3. Return `NO_CARD_AVAILABLE` if none.
  4. Insert a `pendingReviews` row with `startTime: Date.now()`.
  5. Return `{ cardId, question, hint }` — **no answer, no explanation**.
- **Why**: the server is the authoritative timer. No way for the client to cheat duration or peek at the answer before revealing.

### `review:revealReview`

- **Args**: `userId`
- **Behavior**:
  1. Load the user's pending review. Reject with `NO_PENDING_REVIEW` if none.
  2. If `revealTime` is already set, return the answer fields anyway (**idempotent** — calling reveal twice in two terminals is fine).
  3. Otherwise set `revealTime = Date.now()`.
  4. Return `{ answer, explanation, context, hint }` fields from the card.
- **Why separate from rate**: keeps the CLI flow strictly: question → answer → rating. Also enables future analytics on "time to reveal" vs "time to rate".

### `review:rateReview`

- **Args**: `userId`, `rating` (1–4)
- **Behavior**:
  1. Load the user's pending review. Reject with `NO_PENDING_REVIEW` if none.
  2. Reject with `REVIEW_NOT_REVEALED` if `revealTime` is unset — force the user to reveal first.
  3. Compute `duration = Date.now() - pending.startTime` (server-side, authoritative).
  4. Call the existing `reviewCardHandler` (convex/fsrs.ts:221) with `{ cardId, rating, duration, sessionId: <pending._id as string> }` — reuses all FSRS logic, creates the `reviewLogs` row.
  5. **Delete the pending row.**
  6. Return `{ nextReviewDate, nextReviewTimestamp, newState }` plus the remaining due-card count for the bag.
- **Why reuse `reviewCardHandler`**: zero duplication of FSRS math; `pendingReviews` is a wrapper around the existing mutation, not a replacement.

### `review:abandonReview` (optional, for `ep review abort`)

- **Args**: `userId`
- **Behavior**: deletes the user's pending row if it exists. No FSRS state change — the card stays due.

### `review:getCurrentPendingReview`

- **Args**: `userId`
- **Behavior**: query (not mutation) that returns `{ cardId, bagId, startTime, revealTime?, question, hint }` for the user's pending review, or `null`. Used by `ep review status` and also called by the CLI's other subcommands in the stateless flow below.

---

## CLI Commands

Under `cli/internal/ep/cmd/review.go`. All fall back to `cfg.DefaultBagID` when `--bag` is omitted.

```
ep review start [--bag <id>]        → prints question (creates pending row)
ep review reveal                    → prints answer (sets revealTime on pending row)
ep review rate <1|2|3|4>            → submits rating, deletes pending row, prints next due date
ep review status                    → shows the user's pending review (if any)
ep review abort                     → deletes the user's pending row
```

Because `pendingReviews` is keyed by `userId` with at-most-one cardinality, the client never needs to remember an attempt ID — every command just sends `userId` and the server finds the row. This is fully stateless on the client and naturally correct in multi-terminal / multi-device scenarios (the server is the single source of truth; two terminals racing `reveal` both get the same answer thanks to idempotency).

Exit codes follow `common/errors.go` semantics:

- `2` — `NO_PENDING_REVIEW` (user ran `reveal`/`rate`/`abort` without calling `start`)
- `2` — `REVIEW_ALREADY_PENDING` (user ran `start` with one already live)
- `2` — `REVIEW_NOT_REVEALED` (user ran `rate` before `reveal`)
- `3` — Convex unreachable

`--json` output for each command: `start` returns `{ cardId, question, hint, bagId }`; `reveal` returns the answer payload; `rate` returns the FSRS result plus remaining due count.

---

## Migration & Backward Compatibility

- The web app's `FSRSStudySession` continues to call `fsrs:reviewCard` directly. No change needed.
- `reviewLogs` schema is **unchanged** — no fields added, no fields relaxed. All existing queries (`fsrs:getRecentReviewLogs`, `dailyStats`, etc.) keep working as-is.
- `pendingReviews` is a new, empty table. No data migration needed.
- Existing `sessions` table (fsrsSchema.ts) remains unused by this plan.

---

## Open Questions

1. **Stale-review timeout**: 30 minutes hardcoded, or user-configurable? Start with hardcoded; revisit after usage.
2. **One pending per user vs per bag**: the "one pending at a time" rule is per user. If the user wants to review two bags concurrently in two terminals, they cannot. Acceptable for v1.
3. **Web app using the same flow**: the web app could eventually adopt `startReview`/`revealReview`/`rateReview` for a "resume where you left off" experience. Out of scope for v1 but the design allows it — `pendingReviews` is user-keyed, not CLI-keyed.

---

## Implementation Order

1. **Schema** — add `pendingReviews` table to `convex/fsrsSchema.ts` with the `by_user` index. Regenerate Go types via `cd cli && make generate` (runs `cli/codegen/generate.mjs`).
2. **Mutations** — `convex/review.ts` with `startReview`, `revealReview`, `rateReview`, `abandonReview`, `getCurrentPendingReview`. Unit-test against the Convex test harness.
3. **CLI command scaffold** — `ep review start / reveal / rate / status / abort` under `cli/internal/ep/cmd/review.go`. Each command is a thin wrapper around one Convex mutation; no local state.
4. **Default-bag fallback** — `ep review start` without `--bag` reads `cfg.DefaultBagID`, errors with a clear message if unset ("no default bag — run `ep bags default set <id>` or pass --bag").
5. **End-to-end test** — log in as a test user, `ep review start → reveal → rate`, confirm FSRS state moves, the `reviewLogs` row is created, and the `pendingReviews` row is gone.
6. **Docs** — update `thoughts/plans/2026-04-08-cli-go.md` to mark the review TODO as "superseded by 2026-04-11-server-side-review-attempt.md".
