# Date and Time Rules

## Why

- If date formatting is split across `Intl`, `toLocale*`, `toISOString().slice(...)`, and ad hoc `dayjs` imports, the timezone basis becomes unclear.
- In user-local features such as the Activity heatmap, UTC dates and local dates can drift by one day.
- These rules keep display formatting, calendar arithmetic, and timezone conversion consistent across the codebase.

## Rules

- ALWAYS use `dayjs` for date/time formatting and calendar arithmetic.
- ALWAYS import configured `dayjs` and format constants from `@/lib/dayjs` in app code.
- ALWAYS import configured `dayjs` and format constants from `../src/lib/dayjs` in Convex code until Convex moves under `src`.
- ALWAYS use fixed display formats:
  - date: `YYYY-MM-DD`
  - datetime: `YYYY-MM-DD HH:mm`
  - time: `HH:mm`
  - weekday: `ddd`
- ALWAYS use explicit timezone conversion when deriving a user-facing local date from a timestamp or datetime.
- Prefer direct configured `dayjs` calls for simple calendar arithmetic instead of thin wrappers around `add`, `subtract`, `startOf`, `tz`, or `format`.
- NEVER import `dayjs`, `dayjs/plugin/*`, or `dayjs/locale/*` outside `src/lib/dayjs.ts`.
- NEVER use `Intl.DateTimeFormat`.
- NEVER use `Date.prototype.toLocaleDateString`, `Date.prototype.toLocaleTimeString`, or `Date.prototype.toLocaleString`.
- NEVER create date-only strings with `toISOString().slice(...)`.

## Approved Patterns

```ts
import { dayjs, DATE_FORMAT, TIME_FORMAT, WEEKDAY_FORMAT } from "@/lib/dayjs";

dayjs(timestamp).tz(timezone).format(DATE_FORMAT);
dayjs(timestamp).format(TIME_FORMAT);
dayjs(date).startOf("week").format(DATE_FORMAT);
dayjs(date).format(WEEKDAY_FORMAT);
```

Convex code uses a relative import until Convex code moves under `src`:

```ts
import { dayjs, DATE_FORMAT } from "../src/lib/dayjs";

dayjs(timestamp).tz(timezone).format(DATE_FORMAT);
```

## Disallowed Patterns

```ts
import dayjs from "dayjs";

new Intl.DateTimeFormat("en-US").format(date);
date.toLocaleDateString("en-US");
date.toLocaleTimeString("en-US");
date.toLocaleString("en-US");
date.toISOString().slice(0, 10);
```

## Notes

- `Date.now()` and `new Date()` are allowed when a native timestamp or `Date` object is explicitly required.
- `toISOString()` is allowed when an ISO timestamp is explicitly required, but not for deriving date-only strings.
- `userSettings.timezone` should be used for user-facing local dates; fallback to `Asia/Seoul` is acceptable when settings are missing.
- Convex currently imports shared date helpers from `src/lib/dayjs.ts`. Long term, Convex code should move under `src` or the app should introduce a proper shared module boundary.
