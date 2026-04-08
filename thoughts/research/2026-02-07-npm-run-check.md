---
date: 2026-02-07T00:00:00+09:00
researcher: th.kim
git_commit: 67a4dd0ea032f965964aafae2d7609b76e0b717c
branch: main
repository: english-punch-app
topic: "npm run check 스크립트 구조 및 관련 설정 조사"
tags: [research, codebase, check, lint, knip, vitest, ci, dedupe]
status: complete
last_updated: 2026-02-07
last_updated_by: th.kim
---

# Research: npm run check

**Date**: 2026-02-07
**Git Commit**: 67a4dd0ea032f965964aafae2d7609b76e0b717c
**Branch**: main
**Repository**: english-punch-app

## Research Question
`npm run check`가 무엇을 실행하며, 관련된 설정과 CI 파이프라인은 어떻게 구성되어 있는가?

## Summary

`npm run check`는 `scripts/check-local.sh` 셸 스크립트를 실행하며, 내부적으로 4가지 체크를 순차적으로 수행한다: **lint**, **knip**, **test**, **dedupe**. 모든 체크는 실패하더라도 끝까지 실행되며, 마지막에 실패한 항목들을 요약 출력한다. GitHub Actions CI 워크플로우(`.github/workflows/check.yml`)도 동일한 4가지 체크를 수행한다.

## Detailed Findings

### 1. check-local.sh 스크립트 (`scripts/check-local.sh`)

진입점: `package.json:21` → `"check": "./scripts/check-local.sh"`

#### 전처리 (lines 1-17)
- `set -euo pipefail`로 안전한 셸 실행 보장
- `corepack enable`으로 패키지 매니저 버전 고정 (`npm@11.6.2`, `package.json:85`)
- Node.js 버전이 24.x가 아니면 경고 출력 (CI와 동일한 버전 사용 유도)
- `npm ci`로 클린 설치

#### 체크 실행 (lines 19-40)
`run_and_capture` 헬퍼 함수를 사용하여 각 체크를 실행하고, 실패 시 `failures` 배열에 기록:

| 순서 | 이름 | 명령어 |
|------|------|--------|
| 1 | lint | `npm run lint` |
| 2 | knip | `npm run knip` |
| 3 | test | `CI=true npm run test` |
| 4 | dedupe | `npm dedupe && git diff --exit-code package-lock.json` |

`set +e`로 에러 발생 시에도 계속 진행하며, 모든 체크 완료 후 실패 목록을 출력하고 하나라도 실패하면 `exit 1`.

---

### 2. Lint (`eslint.config.js`)

명령어: `eslint src convex` (`package.json:13`)

#### 대상 파일
- `**/*.{ts,tsx}` (TypeScript/TSX 전체)
- 제외: `dist`, `convex/_generated`, `eslint.config.js`, `postcss.config.js`, `tailwind.config.js`, `vite.config.ts`

#### 플러그인
- `@eslint/js` - JavaScript 기본 추천 규칙
- `typescript-eslint` (`recommendedTypeChecked`) - 타입 체크 포함 TypeScript 규칙
- `eslint-plugin-react-hooks` - React Hooks 규칙
- `eslint-plugin-react-refresh` - HMR 관련 규칙
- `eslint-plugin-prettier` - Prettier 통합
- `@convex-dev/eslint-plugin` - Convex 전용 규칙

#### 주요 커스텀 규칙
- `@typescript-eslint/no-unused-vars`: warn (`_` 접두사 무시)
- `@typescript-eslint/ban-ts-comment`: error
- `@typescript-eslint/no-explicit-any`: off (명시적 any 허용)
- `no-restricted-syntax`: `as any` 캐스팅 차단 (error)
- `@typescript-eslint/no-unsafe-*` 계열: 모두 off (암묵적 any 허용)
- `@typescript-eslint/require-await`: off (Convex handler 패턴 호환)
- `curly`: error (제어문 중괄호 강제)

#### 테스트 파일 오버라이드 (`eslint.config.js:93-110`)
- `**/*.test.{ts,tsx}` 대상
- Vitest 글로벌 변수 추가

#### 타입 체크용 tsconfig 참조
- `tsconfig.node.json`, `tsconfig.app.json`, `convex/tsconfig.json`

---

### 3. Knip (`knip.jsonc`)

명령어: `knip` (`package.json:19`)

사용하지 않는 파일, 의존성, export를 감지하는 도구.

#### 엔트리 포인트
- `src/main.tsx` - 앱 메인 진입점
- `src/scripts/changePassword.ts` - 비밀번호 변경 스크립트
- `convex/http.ts` - Convex HTTP 엔드포인트
- `convex/auth.ts` - Convex 인증 설정
- `setup.mjs` - 프로젝트 셋업 스크립트
- `src/lib/deeplink.ts` - 딥링크 처리
- `src/lib/tauri.ts` - Tauri 플랫폼 통합
- `src/routes/__root.tsx` - TanStack Router 루트 라우트

#### 분석 대상
- `src/**/*.{ts,tsx}`, `convex/**/*.{ts,tsx}`

#### 제외 항목
- 디렉토리: `convex/_generated/**`, `src-tauri/target/**`, `dist/**`, `coverage/**`
- 파일: `src/routeTree.gen.ts` (자동 생성)

#### 무시하는 의존성
- `@fabianlars/tauri-plugin-oauth` (Rust 측에서 사용)
- `es-toolkit`
- `tailwindcss` (CSS import 메커니즘)
- `@testing-library/*` (테스트 유틸)

#### 기타 설정
- `paths`: `@/*` → `src/*` (Vite alias 대응)
- `includeEntryExports`: false

---

### 4. Test (`vitest`)

명령어: `vitest run` (`package.json:15`), check-local.sh에서 `CI=true`로 실행

#### 설정 (`vite.config.ts:51-59`)
- `globals: true` - 전역 테스트 API (describe, it, expect 등)
- `environment: "happy-dom"` - DOM 시뮬레이션
- `setupFiles: "./src/setupTests.ts"` - 테스트 셋업
- `coverage.provider: "v8"`, `coverage.reporter: ["text", "lcov"]`

#### 셋업 파일 (`src/setupTests.ts`)
- `@testing-library/jest-dom/vitest` import로 DOM 매처 활성화 (`toBeInTheDocument()` 등)

#### 테스트 파일 (총 3개)
- `src/lib/utils.test.ts` - `cn` 유틸리티 함수 테스트 (2개 테스트 케이스)
- `src/scripts/changePassword.test.ts` - 비밀번호 변경 스크립트 테스트 (4개 테스트 케이스)
- `convex/fsrs.elapsed-days.test.ts` - FSRS 경과일 추적 테스트 (2개 테스트 케이스)

테스트 파일은 별도 디렉토리 없이 소스 파일 옆에 co-locate 되어 있음.

#### 테스트 의존성
- `vitest` ^4.0.14
- `@vitest/coverage-v8` ^4.0.14
- `@testing-library/jest-dom` ^6.9.1
- `@testing-library/react` ^16.3.0
- `@testing-library/user-event` ^14.6.1
- `happy-dom` ^20.0.11

---

### 5. Dedupe

명령어: `npm dedupe && git diff --exit-code package-lock.json`

`npm dedupe`를 실행하여 중복 의존성을 정리한 후, `package-lock.json`에 변경이 있으면 실패. 이미 최적화된 상태인지 확인하는 용도.

---

### 6. CI 워크플로우 (`.github/workflows/check.yml`)

#### 트리거
- `main` 브랜치 push
- 모든 Pull Request

#### 환경
- `ubuntu-latest`, Node.js 24, npm 캐시 사용

#### 체크 단계 (각각 `continue-on-error: true`)

| 순서 | 이름 | 명령어 |
|------|------|--------|
| 1 | Lint | `npm run lint` |
| 2 | Dedupe | `npm dedupe && git diff --exit-code` |
| 3 | Knip | `npm run knip` |
| 4 | Test | `CI=true npm run test` |

#### 실패 처리 (lines 47-88)
- 모든 step의 outcome을 수집
- `::error::` annotation으로 실패 표시
- `$GITHUB_STEP_SUMMARY`에 실패 요약 출력
- 하나라도 실패하면 `exit 1`

---

## CI vs Local 비교

| 항목 | Local (`check-local.sh`) | CI (`check.yml`) |
|------|--------------------------|-------------------|
| 실행 순서 | lint → knip → test → dedupe | lint → dedupe → knip → test |
| dedupe diff 범위 | `package-lock.json`만 | 전체 `git diff --exit-code` |
| Node.js 설정 | corepack + 버전 경고 | actions/setup-node@v4 (24.x) |
| 실패 처리 | bash 배열 + 요약 출력 | `continue-on-error` + step summary |
| 의존성 설치 | `npm ci` | `npm ci` (동일) |

Pre-commit hook이나 Husky는 설정되어 있지 않음 (`.git/hooks/`에 sample 파일만 존재).

## Code References
- `package.json:21` - check 스크립트 정의
- `scripts/check-local.sh` - 로컬 체크 스크립트 전체
- `eslint.config.js` - ESLint 설정 전체
- `knip.jsonc` - Knip 설정 전체
- `vite.config.ts:51-59` - Vitest 테스트 설정
- `src/setupTests.ts` - 테스트 셋업 파일
- `.github/workflows/check.yml` - CI 워크플로우

## Architecture Documentation
- **체크 실행 패턴**: Local과 CI 모두 "모든 체크를 끝까지 실행 후 실패 요약" 패턴을 사용
- **도구 체인**: ESLint (코드 품질/스타일) → Knip (미사용 코드 감지) → Vitest (단위 테스트) → npm dedupe (의존성 정리 확인)
- **타입 체크**: `npm run check`에는 별도 `tsc` 단계가 없음. 단, ESLint가 `recommendedTypeChecked`를 사용하므로 타입 기반 린트 규칙은 적용됨. 전체 타입 체크는 `npm run build` (`tsc && vite build`)에서 수행
