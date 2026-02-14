# English Punch App

지시사항 작성 원칙: @.claude/meta-rules.md

## Project Structure

- **pnpm monorepo** with Turborepo orchestration
- 패키지 매니저는 반드시 `pnpm`을 사용할 것. `npm`, `yarn` 절대 사용 금지.
- 워크스페이스 구성 (`pnpm-workspace.yaml`):
  - `.` (루트) — 메인 앱 (Vite + React + TanStack Router + Convex + Tauri)
  - `mcp-server/` — MCP 서버

## Check Commands

- `pnpm run check` — 커밋 전에 실행. lint + knip + test. Staged 변경이 있어도 안전.
- `pnpm run check:all` — 커밋 후 또는 clean tree에서 실행. 위 항목 + dedupe 체크 포함. CI에서 실행되는 전체 범위.

### 개별 실행

- `pnpm run lint` — ESLint
- `pnpm run knip` — 미사용 코드/의존성 감지
- `pnpm run test` — Vitest 단위 테스트
