---
date: 2026-04-29
author: codex
status: draft
topic: Replace review-log-only activity history with event-level activities and reveal-based daily heatmap
---

# Activities Log and Reveal Heatmap Plan

## Goal

Activity 탭의 목적은 "오늘 내가 이런 학습 활동을 했구나"를 한눈에 느끼게 하는 것이다. 현재 `reviewLogs`는 평가가 끝난 뒤의 FSRS 결과 원장에 가깝고, 사용자가 문제를 본 순간이나 답을 공개한 순간을 표현하지 못한다.

최종 화면은 GitHub 잔디처럼 일별 활동 밀도를 보여주되, count 기준은 **답 공개(`review_answer_revealed`) 이벤트만** 사용한다. Streak, active days, 연속 학습일 같은 지표는 만들지 않는다.

## Requirements

- 문제를 본 것, 답을 reveal 한 것, rating을 매긴 것을 별도 이벤트로 남긴다.
- 일별 heatmap은 reveal 이벤트만 센다.
- Activity 상세에는 같은 날짜의 문제 보기, reveal, 평가 이벤트를 볼 수 있게 한다.
- Activity 상세의 answer snapshot은 기본으로 숨기고, row를 펼쳤을 때만 보여준다.
- `rating`, `duration`, `stability`, `difficulty`처럼 optional이고 필터/정렬 기준으로 쓰지 않을 수치값은 top-level 필드로 승격하지 않는다.
- 기존 `reviewLogs`는 최대한 그대로 유지한다. Activities는 사용자의 행동 타임라인을 위한 추가 event log이며, `reviewLogs`를 대체하거나 삭제하는 것을 목표로 하지 않는다.
- `ep` CLI 변경 시 `docs/cli-llm-as-caller.md`의 `--json`, 에러 토큰, 멱등성, `--help` 자기기술, 최소 chrome 규칙을 유지한다.

## Key Decision: Payload Field for Non-Index Data

사용자가 말한 "jsonb 필드" 방향은 이 요구사항에 맞다. Convex에는 PostgreSQL의 `jsonb` 타입이 없으므로, 같은 역할을 하는 `payload` 필드를 둔다.

원칙:

- Top-level 필드는 조회, 필터, 정렬, 소유권 확인에 필요한 값만 둔다.
- 이벤트별 부가 정보와 수치 metric은 `payload`에 넣는다.
- `rating`, `durationMs`, `stability`, `difficulty`, FSRS before/after 값은 `payload`에 둔다.
- `eventType`, `userId`, `localDate`, `occurredAt`, `source`, `cardId`, `bagId`, `attemptId`, `dedupeKey`는 top-level에 둔다.

Convex schema 예시:

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

`payload: v.any()`는 schema가 느슨해지는 단점이 있다. 대신 모든 write path는 `convex/activities.ts`의 helper를 통해서만 쓰게 하고, helper 안에서 이벤트 타입별 payload builder를 둔다.

## Event Semantics

### `review_question_seen`

문제가 사용자에게 제시된 순간이다.

Top-level:

- `eventType`: `review_question_seen`
- `cardId`
- `bagId`
- `attemptId`
- `source`

Payload 예시:

```ts
{
  questionSnapshot: card.question,
  hintSnapshot: card.hint,
}
```

### `review_answer_revealed`

사용자가 답을 공개한 순간이다. Heatmap은 이 이벤트만 센다.

Top-level:

- `eventType`: `review_answer_revealed`
- `cardId`
- `bagId`
- `attemptId`
- `source`

Payload 예시:

```ts
{
  questionSnapshot: card.question,
  answerSnapshot: card.answer,
  explanationSnapshot: card.explanation,
  elapsedSinceQuestionMs,
}
```

### `review_rated`

사용자가 1-4 rating을 제출했고 FSRS 업데이트가 성공한 순간이다.

Top-level:

- `eventType`: `review_rated`
- `cardId`
- `bagId`
- `attemptId`
- `source`

Payload 예시:

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

이 값들은 audit이나 select 기준이 아니므로 top-level에 두지 않는다.

## Attempt Identity and Deduplication

각 review attempt는 question seen, reveal, rated 이벤트를 묶는 `attemptId`를 가진다.

Deduplication 규칙:

- 모든 activity insert는 `dedupeKey`를 필수로 받는다.
- insert 전에 `by_user_and_dedupe_key`로 기존 row를 조회한다.
- 기존 row가 있으면 새로 insert하지 않고 기존 row를 반환한다.

Deduplication key 예시:

- CLI question seen: `cli:${pendingReviewId}:question_seen`
- CLI reveal: `cli:${pendingReviewId}:answer_revealed`
- CLI rated: `cli:${pendingReviewId}:rated`
- Web question seen: `web:${attemptId}:question_seen`
- Web reveal: `web:${attemptId}:answer_revealed`
- Web rated: `web:${attemptId}:rated`

CLI는 `pendingReviews._id`를 `attemptId`로 쓴다. Web은 카드 id, reps, 마지막 리뷰 시각, 현재 날짜를 조합한 `attemptId`를 만들고, 같은 card render lifetime 동안 question seen, reveal, rated에 같은 값을 전달한다.

## Timezone and Local Date

Heatmap은 사용자 기준 날짜로 보여야 한다.

구현 원칙:

- `occurredAt`은 `Date.now()` millisecond timestamp로 저장한다.
- `timezone`은 `userSettings.timezone`을 우선 사용한다.
- user settings가 없으면 `"Asia/Seoul"`로 fallback한다.
- `localDate`는 configured `dayjs`가 `timezone`으로 계산한 `YYYY-MM-DD` 문자열이다.

예시:

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

- `문제 봄 N`
- `답 공개 N`
- `평가 완료 N`

Timeline examples:

- `09:12 문제를 봄: I'd like to ___ a table...`
- `09:13 답을 공개함`
- `09:14 평가함`

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
