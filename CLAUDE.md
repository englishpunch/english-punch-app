# English Punch App

## Check Commands

- `npm run check` — 커밋 전에 실행. lint + knip + test. Staged 변경이 있어도 안전.
- `npm run check:all` — 커밋 후 또는 clean tree에서 실행. 위 항목 + dedupe 체크 포함. CI에서 실행되는 전체 범위.

### 개별 실행

- `npm run lint` — ESLint
- `npm run knip` — 미사용 코드/의존성 감지
- `npm run test` — Vitest 단위 테스트
