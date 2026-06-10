---
date: 2026-04-29
author: codex
status: draft
topic: Replace review-log-only activity history with event-level activities and reveal-based daily heatmap
---

# Activities Log and Reveal Heatmap Plan

## Goal

The goal of the Activity tab is to let the user quickly see what study actions they did today. The current `reviewLogs` table is closer to an FSRS result ledger after rating is complete, and it cannot represent the moment when a user saw a question or revealed an answer.

The final screen should show daily activity density like a GitHub contribution graph, but the count basis is **only answer reveal (`review_answer_revealed`) events**. Do not add streak, active-day, or consecutive-study-day metrics.

## Requirements

- Record seeing a question, revealing an answer, and submitting a rating as separate events.
- The daily heatmap counts only reveal events.
- Activity details show question-seen, reveal, and rating events for the same date.
- Answer snapshots in Activity details are hidden by default and shown only when a row is expanded.
- Optional numeric values that may not be used for filtering or sorting, such as `rating`, `duration`, `stability`, and `difficulty`, should not be promoted to top-level fields.
- Keep the existing `reviewLogs` table as stable as possible. Activities are an additional event log for the user's behavior timeline; they are not intended to replace or delete `reviewLogs`.
- When changing the `ep` CLI, keep the `--json`, deterministic error token, idempotency, self-describing `--help`, and minimal chrome rules from `docs/cli-llm-as-caller.md`.

## Key Decision: Payload Field for Non-Index Data

The requested "jsonb field" direction matches these requirements. Convex does not have PostgreSQL's `jsonb` type, so use a `payload` field for the same role.

Principles:

- Put only values needed for querying, filtering, sorting, and ownership checks at the top level.
- Put event-specific details and numeric metrics in `payload`.
- Put `rating`, `durationMs`, `stability`, `difficulty`, and FSRS before/after values in `payload`.
- Keep `eventType`, `userId`, `localDate`, `occurredAt`, `source`, `cardId`, `bagId`, `attemptId`, and `dedupeKey` at the top level.

Convex schema example:

```ts
activities: defineTable({
  userId: v.id("users"),
  eventType: v.union(
    v.literal("review_question_seen"),
    v.literal("review_answer_revealed"),
    v.literal("review_rated")
  ),
  occurredAt: v.number(),
  localDate: v.string(),
  timezone: v.string(),
  source: v.union(v.literal("web"), v.literal("cli"), v.literal("system")),
  cardId: v.optional(v.id("cards")),
  bagId: v.optional(v.id("bags")),
  attemptId: v.optional(v.string()),
  dedupeKey: v.string(),
  schemaVersion: v.number(),
  payload: v.optional(v.any()),
})
  .index("by_user_and_occurred_at", ["userId", "occurredAt"])
  .index("by_user_event_date", ["userId", "eventType", "localDate"])
  .index("by_user_date_time", ["userId", "localDate", "occurredAt"])
  .index("by_user_and_dedupe_key", ["userId", "dedupeKey"])
  .index("by_attempt", ["attemptId"]);
```

`payload: v.any()` makes the schema looser. To compensate, route every write path through helpers in `convex/activities.ts`, with event-type-specific payload builders inside those helpers.

## Event Semantics

### `review_question_seen`

The moment a question is shown to the user.

Top-level:

- `eventType`: `review_question_seen`
- `cardId`
- `bagId`
- `attemptId`
- `source`

Payload example:

```ts
{
  questionSnapshot: card.question,
  hintSnapshot: card.hint,
}
```

### `review_answer_revealed`

The moment the user reveals the answer. The heatmap counts only this event.

Top-level:

- `eventType`: `review_answer_revealed`
- `cardId`
- `bagId`
- `attemptId`
- `source`

Payload example:

```ts
{
  questionSnapshot: card.question,
  answerSnapshot: card.answer,
  explanationSnapshot: card.explanation,
  elapsedSinceQuestionMs,
}
```

### `review_rated`

The moment the user submits a 1-4 rating and the FSRS update succeeds.

Top-level:

- `eventType`: `review_rated`
- `cardId`
- `bagId`
- `attemptId`
- `source`

Payload example:

```ts
{
  rating,
  durationMs,
  reviewType: "scheduled",
  legacyReviewLogId,
  fsrs: {
    before: {
      state,
      due,
      scheduled_days,
      elapsed_days,
      reps,
      lapses,
      stability,
      difficulty
    },
    after: {
      state,
      due,
      scheduled_days,
      elapsed_days,
      reps,
      lapses,
      stability,
      difficulty
    }
  }
}
```

These values are not audit or selection keys, so do not put them at the top level.

## Attempt Identity and Deduplication

Each review attempt has an `attemptId` that groups question-seen, reveal, and rated events.

Deduplication rules:

- Every activity insert must receive a `dedupeKey`.
- Before inserting, query existing rows through `by_user_and_dedupe_key`.
- If a row already exists, return that row instead of inserting a duplicate.

Deduplication key examples:

- CLI question seen: `cli:${pendingReviewId}:question_seen`
- CLI reveal: `cli:${pendingReviewId}:answer_revealed`
- CLI rated: `cli:${pendingReviewId}:rated`
- Web question seen: `web:${attemptId}:question_seen`
- Web reveal: `web:${attemptId}:answer_revealed`
- Web rated: `web:${attemptId}:rated`

The CLI uses `pendingReviews._id` as `attemptId`. The web app builds `attemptId` from card id, reps, last review time, and the current date, then passes the same value to question-seen, reveal, and rated events during the same card render lifetime.

## Timezone and Local Date

The heatmap must use the user's local date.

Implementation principles:

- Store `occurredAt` as a `Date.now()` millisecond timestamp.
- Prefer `userSettings.timezone` for `timezone`.
- Fall back to `"Asia/Seoul"` when user settings are missing.
- `localDate` is a `YYYY-MM-DD` string computed by configured `dayjs` in `timezone`.

Example:

```ts
dayjs(timestamp).tz(timezone).format(DATE_FORMAT);
```

## Write Paths

### CLI `startReview`

File: `convex/review.ts`

Flow:

1. Validate bag ownership.
2. Check existing `pendingReviews`.
3. Insert new `pendingReviews` row.
4. Insert `review_question_seen` activity.
5. Return the current response shape unchanged.

No activity is inserted when `startReview` returns `REVIEW_ALREADY_PENDING`.

### CLI `revealReview`

File: `convex/review.ts`

Flow:

1. Find current pending review.
2. Load card.
3. If `pending.revealTime === undefined`, patch `revealTime` and insert `review_answer_revealed`.
4. If `pending.revealTime !== undefined`, return the answer without inserting a duplicate activity.
5. Return the current response shape unchanged.

This preserves reveal idempotency.

### CLI `rateReview`

File: `convex/review.ts`

Flow:

1. Find current pending review.
2. Reject if not revealed.
3. Call `reviewCardHandler` with:
   - `attemptId: pending._id`
   - `source: "cli"`
4. `reviewCardHandler` updates the card, writes the existing `reviewLogs` row as before, and writes `review_rated`.
5. Delete `pendingReviews` row.
6. Return the current response shape unchanged.

### Web question seen

Files:

- `src/components/FSRSStudySession.tsx`
- `src/components/StudyCard.tsx`

Flow:

1. When a due card is rendered, create a stable `attemptId`.
2. Call `api.activities.logReviewQuestionSeen`.
3. Do not block the UI on this mutation.
4. Use `dedupeKey` so retry/remount does not double-count the same attempt.
5. Treat failures as best-effort only: no toast, no blocking state, no study-flow interruption.

### Web reveal

File: `src/components/StudyCard.tsx`

Flow:

1. When `handleShowAnswer` runs, call `api.activities.logReviewAnswerRevealed`.
2. Only call once per card attempt.
3. Heatmap count is based on this event.

### Web rating

Files:

- `src/components/FSRSStudySession.tsx`
- `convex/fsrs.ts`

Flow:

1. Pass `attemptId` and `source: "web"` to `api.fsrs.reviewCard`.
2. `reviewCardHandler` updates the card.
3. Keep inserting the existing `reviewLogs` row as before.
4. Insert `review_rated` activity in the same mutation after FSRS succeeds.

If `reviewCardHandler` fails, no `review_rated` activity is inserted.

## Read APIs

### `activities:getActivityHeatmap`

Args:

```ts
{
  userId: v.id("users"),
  fromDate: v.optional(v.string()),
  toDate: v.optional(v.string()),
}
```

Behavior:

- Query `activities` by `by_user_event_date`.
- Filter `eventType = "review_answer_revealed"`.
- Group by `localDate`.
- Return zero-filled dates for the requested range.
- Do not return streak or active day metrics.

Return shape:

```ts
{
  fromDate: string,
  toDate: string,
  days: Array<{
    date: string,
    revealCount: number,
    intensity: 0 | 1 | 2 | 3 | 4,
  }>,
}
```

Intensity can be derived from `revealCount`:

- `0`: 0 reveals
- `1`: 1 reveal
- `2`: 2-4 reveals
- `3`: 5-9 reveals
- `4`: 10+ reveals

### `activities:getActivitiesByDate`

Args:

```ts
{
  userId: v.id("users"),
  localDate: v.string(),
}
```

Behavior:

- Query `activities` by `by_user_date_time`.
- Return all events for the date in ascending `occurredAt`.
- Include a lightweight summary:
  - `questionSeenCount`
  - `revealCount`
  - `ratedCount`
- No streak or active-days fields.

Return event shape:

```ts
{
  _id,
  eventType,
  occurredAt,
  localDate,
  source,
  cardId,
  bagId,
  attemptId,
  payload,
}
```

### Compatibility: `fsrs:getRecentReviewLogs`

Keep this query alive for MCP compatibility and any callers that still want the legacy completed-review ledger.

Do not rewrite it to read from `activities` unless a future task explicitly asks for that. `reviewLogs` and `activities` answer different questions:

- `reviewLogs`: completed FSRS review records.
- `activities`: user-visible action timeline.

## Activity UI

File: `src/components/ActivityPage.tsx`

Target layout:

- Top: compact daily heatmap.
- Middle: selected date summary.
- Bottom: timeline for the selected date.

No streak, active days, or motivational stat counters.

Heatmap behavior:

- Each cell represents one `localDate`.
- Color intensity is based only on `review_answer_revealed` count.
- Clicking a date selects that day and loads `getActivitiesByDate`.
- Today is selected by default if it has activities; otherwise the latest day with reveal activity can be selected.

Daily summary:

- `Questions seen N`
- `Answers revealed N`
- `Ratings completed N`

Timeline examples:

- `09:12 Question seen: I'd like to ___ a table...`
- `09:13 Answer revealed`
- `09:14 Rated`

Answer snapshots should be hidden by default and shown only after the row is expanded. Rating labels can be shown if present in payload, but the UI should not depend on rating being top-level.

## Migration Strategy

### Phase 1: Additive schema and helpers

- Add `activities` table in `convex/fsrsSchema.ts`.
- Add `convex/activities.ts`.
- Implement:
  - `logActivity`
  - `logReviewQuestionSeen`
  - `logReviewAnswerRevealed`
  - `getActivityHeatmap`
  - `getActivitiesByDate`
- Add unit tests for date grouping and dedupe helper behavior where practical.

### Phase 2: Dual-write new events

- CLI:
  - `startReview` writes `review_question_seen`.
  - `revealReview` writes `review_answer_revealed` only on first reveal.
  - `rateReview` writes `review_rated`.
- Web:
  - `StudyCard` writes question seen and reveal events.
  - `reviewCard` writes rated event.
- Keep `reviewLogs` insert unchanged.

### Phase 3: Build Activity UI on activities

- Replace `ActivityPage` data source with `activities:getActivityHeatmap` and `activities:getActivitiesByDate`.
- Keep old recent review list logic only as a short-term fallback if needed.
- Add i18n strings for English, Korean, Japanese.

### Phase 4: Backfill historical rated events

Existing `reviewLogs` only prove that a rating happened. They do not prove when reveal happened.

Backfill rule:

- Create `review_rated` activities from historical `reviewLogs`.
- Put old FSRS fields in `payload`.
- Use `source: "system"`.
- Use `dedupeKey: legacy-review-log:${reviewLogId}`.
- Do not backfill `review_answer_revealed`.
- Do not count backfilled rated events in the reveal heatmap.

This keeps the heatmap semantically honest. If historical heatmap is required later, it should be explicitly labeled as estimated.

### Phase 5: Keep `reviewLogs` stable

Do not plan to remove `reviewLogs`.

Long-term behavior:

- Keep inserting `reviewLogs` for completed FSRS reviews.
- Keep `fsrs:getRecentReviewLogs` backed by `reviewLogs`.
- Treat `activities` as a separate product-facing event stream.
- Avoid schema churn in `reviewLogs` unless FSRS itself needs it.

## Files Likely To Change

- `convex/fsrsSchema.ts`
- `convex/activities.ts`
- `convex/fsrs.ts`
- `convex/review.ts`
- `src/components/ActivityPage.tsx`
- `src/components/FSRSStudySession.tsx`
- `src/components/StudyCard.tsx`
- `src/i18n/resources.ts`
- `mcp-server/src/tools/stats.ts`
- `cli/internal/ep/cmd/review_service.go` only if CLI response shapes need new IDs
- `convex/_generated/*` after Convex codegen

## Test Plan

### Convex

- `logReviewQuestionSeen` is idempotent for the same `dedupeKey`.
- `logReviewAnswerRevealed` is idempotent for the same `dedupeKey`.
- `getActivityHeatmap` counts only `review_answer_revealed`.
- `getActivityHeatmap` ignores `review_question_seen` and `review_rated`.
- `getActivitiesByDate` returns all event types for the selected date.
- `rateReview` creates `review_rated` only after reveal and successful FSRS update.

### Web

- Rendering a card logs question seen once per attempt.
- Clicking show answer logs reveal once.
- Rating logs rated and advances the card as before.
- Activity heatmap color changes after reveal, not after question seen or rating alone.
- Deleted card snapshots still render from payload when card content is no longer available.

### CLI

- `ep review start` logs question seen.
- `ep review reveal` logs reveal only the first time.
- `ep review rate` logs rated and preserves existing JSON/text output.
- `ep review abort` does not create rated or reveal events.
- `ep review status` does not create events.

### Required local checks

```bash
pnpm run check
cd cli && ~/go/bin/golangci-lint run
cd cli && go vet ./... && go test ./... && go build ./...
```

## Resolved Decisions

- Activity detail hides answer snapshots until the row is expanded.
- `reviewLogs` stays as the completed FSRS review ledger and should be kept as stable as possible.
- Web `review_question_seen` logging is best-effort only. Failed logging should not show a toast or interrupt the study flow.

## Recommended First Implementation Slice

Start with a narrow vertical slice:

1. Add `activities` table and helper.
2. Log CLI `revealReview` as `review_answer_revealed`.
3. Add `getActivityHeatmap`.
4. Render a minimal reveal-only heatmap in `ActivityPage`.

This proves the main product value before touching all web and rating paths.
