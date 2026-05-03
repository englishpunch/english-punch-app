# Date and Time Rules

## Why

- 날짜 포맷이 `Intl`, `toLocale*`, `toISOString().slice(...)`, 개별 `dayjs` import로 흩어지면 timezone 기준이 불명확해진다.
- Activity heatmap처럼 사용자 기준 날짜가 중요한 기능에서는 UTC date와 local date가 하루 어긋날 수 있다.
- 날짜 처리 규칙은 표시 포맷, calendar arithmetic, timezone 변환의 기준을 코드 전체에서 동일하게 만든다.

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

new Intl.DateTimeFormat("ko-KR").format(date);
date.toLocaleDateString("ko-KR");
date.toLocaleTimeString("ko-KR");
date.toLocaleString("ko-KR");
date.toISOString().slice(0, 10);
```

## Notes

- `Date.now()` and `new Date()` are allowed when a native timestamp or `Date` object is explicitly required.
- `toISOString()` is allowed when an ISO timestamp is explicitly required, but not for deriving date-only strings.
- `userSettings.timezone` should be used for user-facing local dates; fallback to `Asia/Seoul` is acceptable when settings are missing.
- Convex currently imports shared date helpers from `src/lib/dayjs.ts`. Long term, Convex code should move under `src` or the app should introduce a proper shared module boundary.
