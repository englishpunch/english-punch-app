# Activity daily-count rollout (#95)

The heatmap reads one small `activityDailyCounts` record per active local date.
New web and CLI events update the summary and their `dailyCounted` marker in the
same transaction. Duplicate dedupe keys return before incrementing. Historical
backfill uses each event's stored local date, even if the user's timezone has
changed since that event.

The migration is additive: event payloads and the existing history API stay
unchanged. Until a user's last uncounted event is migrated, their heatmap uses
the original event query. An indexed lookup of at most one uncounted event gates
the switch, so partially backfilled totals never appear. Users with no legacy
events use summaries immediately. All future event writers must use
`logActivity`; events must not be deleted or recategorized without maintaining
the associated counts.

## Validation before rollout

Run `pnpm exec vitest run convex/activities.daily-counts.test.ts
convex/activities.heatmap.test.ts src/components/ActivityPage.test.tsx` on one
line. Tests compare every heatmap bucket before, during, and after backfill,
including interleaved live writes and migration restarts. They also cover
migration dry-run rollback, the scheduled runner, date boundaries, user
isolation, and independent history rendering.

## Deployment and backfill

Deploy the backend before the frontend; the new frontend calls
`activities:getLatestActivityDate`.

```sh
pnpm exec convex dev --once --env-file .env.convex-selfhost --tail-logs disable
```

Dry-run one batch before starting the backfill. Its preview can contain existing
activity content; keep that output private. Dry runs deliberately roll back.

```sh
node --env-file=.env.convex-selfhost node_modules/convex/bin/main.js run \
  activityMigrations:backfillDailyCounts '{"dryRun":true}'
```

Start or resume the tracked migration. The component schedules batches of 50;
new events continue to be counted transactionally while it runs.

```sh
node --env-file=.env.convex-selfhost node_modules/convex/bin/main.js run \
  activityMigrations:backfillDailyCounts
node --env-file=.env.convex-selfhost node_modules/convex/bin/main.js run \
  --component migrations lib:getStatus
```

Confirm `isDone` and no migration error. Re-running resumes or skips completed
work. An intentional restart with `{"reset":true}` is also safe: already-counted
events are not counted again. Never clear daily summaries while retaining the
per-event markers.

Verify the production page retains its daily totals and one-year range, and
inspect execution logs for `activities:getActivityHeatmap`: after completion,
reads should scale with active days, not event count. Measure page load and
function execution separately. Test history loading while the heatmap response
is delayed; it must not wait for that response.

The backfill uses the [Convex migrations component](https://www.convex.dev/components/migrations)
for batching, progress tracking, and resumability.
