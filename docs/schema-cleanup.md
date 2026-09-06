# Unused learning schema cleanup (#88)

## Scope

- Retired tables: `dailyStats`, `cardTemplates`, and `sessions`.
- Retired fields: `userSettings.lastReviewDate`, `bags.sortOrder`, `cards.tags`, and `cards.source`.
- Retained: bag tags, card `sourceWord`/`expression`, settings APIs, review logs and snapshots,
  activities, pending reviews, authentication, and OAuth tables.
- `getOneDueCard` returns a whole card document. Removing card metadata intentionally
  removes those properties from that response; callers must not require them.
- Standalone index cleanup, streak computation, and daily-limit enforcement are separate work.

## Deployment order

Do not deploy the final strict schema directly over documents containing retired fields.
Do not run `pnpm dev` against an unmigrated shared deployment from this revision.

1. Export the deployment, including file storage. Keep the export outside the repository
   with restricted permissions, and verify archive integrity and its checksum.
2. Deploy the transitional revision `6e5ba39`. It accepts old and new documents, stops
   writing retired metadata, and exposes temporary internal-only migration helpers.
3. Run `schemaCleanup:removeRetiredFields` separately for `userSettings`, `bags`, and
   `cards`. Run `schemaCleanup:emptyRetiredTable` separately for the three retired tables.
   Each accepts `{ table, paginationOpts }`; start with `cursor: null`, `numItems: 50`,
   `maximumRowsRead: 50`, and `maximumBytesRead: 1000000`. Pass the returned
   `continueCursor` to the next call until `isDone` is true. Interrupted runs can restart
   from the beginning. Never invoke these helpers without a verified backup.
4. Repeat every complete scan and require `changed: 0`. Export again and compare retained
   records by ID, ignoring only the retired fields. Concurrent reviews may legitimately
   change scheduling fields and append logs; correlate those changes with new review logs.
5. Deploy the final schema. The temporary helpers and their generated API references
   must be removed along with the retired declarations. No cleanup cron remains active.
6. Build frontend/MCP images through GitHub Actions, merge the generated infra PR, and
   verify ArgoCD health, API versions, and the version-matched CLI release.

## Recovery

The transitional migration code and tests remain in Git history (`b436c5b`, `6e5ba39`).
The export is the recovery source for removed fields and historical session rows.
Before restoring retired fields, redeploy the compatible transitional schema. Restore
only the intended fields/rows under controlled maintenance; do not overwrite the entire
live database with an older snapshot, which could discard reviews or authentication
changes made since the export. Restoring pre-cleanup application code also requires
restoring its formerly required fields for documents created after the export.
