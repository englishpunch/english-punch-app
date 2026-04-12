# English Punch 🥊

영어 학습을 위한 간격 반복 학습(Spaced Repetition) 앱

## 개요

English Punch는 [FSRS (Free Spaced Repetition Scheduler)](https://github.com/open-spaced-repetition/ts-fsrs) 알고리즘 기반의 영어 학습 애플리케이션입니다. 매일 복싱 도장에 가듯이 꾸준히 영어를 학습하자는 의미에서 "Punch"라는 이름을 붙였습니다.

웹 앱뿐만 아니라 **`ep` CLI**와 **MCP 서버**를 함께 제공하여, Claude Code 같은 LLM 에이전트가 대화 맥락에서 곧바로 카드를 추가하고 복습을 돌릴 수 있도록 설계되었습니다.

## 카드 형식

빈칸 채우기 형식의 실용적인 영어 문장 학습:

```
문제: I'd like to ___ a table for two at 7 pm. (book in advance)
정답: reserve
```

## 프로젝트 구조

pnpm workspace + Turborepo 기반 모노레포입니다.

- **`.` (루트)** — 웹 앱 (Vite + React + TanStack Router + Convex)
- **`cli/`** — `ep` Go CLI (Cobra + Viper + Convex HTTP)
- **`mcp-server/`** — MCP 서버 (Claude Code / 기타 MCP 클라이언트용)

### `ep` CLI

- **1순위 사용자는 Claude Code skill**이며, 사람 터미널 사용자는 부수적입니다.
- 모든 커맨드가 `--json` 플래그, 결정적 에러 토큰, 멱등성, 자기기술형 `--help`를 제공합니다. 자세한 설계 원칙은 [`docs/cli-llm-as-caller.md`](docs/cli-llm-as-caller.md) 참고.
- Homebrew 설치: `brew install englishpunch/tap/ep`

### Claude Code Skill

- `english-punch` skill이 `ep` CLI를 호출해 다음을 수행합니다:
  - 대화 도중 마주친 낯선 어휘를 플래시카드로 즉시 캡처
  - 대화 맥락에서 문제/힌트/해설 자동 생성
  - FSRS 기반 스케줄링으로 복습 세션을 엔드 투 엔드로 진행

## 기술 스택

### Frontend

- **React 19** + **Vite** — UI 및 번들러
- **TanStack Router** — 타입 안전 라우팅
- **Tailwind CSS v4** — 스타일링
- **i18next** — 다국어 지원

### Backend

- **Convex** — 리액티브 백엔드 플랫폼 (실시간 DB, 서버리스 함수, WebSocket)
- **@convex-dev/auth** — 인증

### CLI / MCP

- **Go + Cobra + Viper** — `ep` CLI
- **@modelcontextprotocol/sdk** — MCP 서버

### 학습 알고리즘

- **[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** — TypeScript FSRS 구현

### 도구 체인

- **pnpm** (필수 — `npm`, `yarn` 사용 금지) + **Turborepo** — 모노레포 오케스트레이션
- **Vitest** — 단위 테스트
- **ESLint** + **Prettier** + **Knip**

## 설치 및 실행

```bash
# 저장소 클론
git clone git@github.com:englishpunch/english-punch-app.git
cd english-punch-app

# 의존성 설치 (반드시 pnpm)
pnpm install

# 개발 서버 실행 (웹 + Convex 백엔드)
pnpm run dev
```

## 환경 설정

### 1. Convex 프로젝트 설정

Convex 개발 환경을 초기화합니다:

```bash
npx convex dev
```

이 명령어가 Convex 계정 로그인과 새 프로젝트 생성을 자동으로 처리합니다.

### 2. 환경 변수 설정

`.env.local` 파일을 만들고 아래 값을 설정합니다:

```env
# Convex 설정 (npx convex dev 실행 시 자동 생성됨)
VITE_CONVEX_URL=https://your-project.convex.cloud
```

## 검증 명령어

- `pnpm run check` — lint + knip + test (커밋 전 실행)
- `pnpm run check:all` — 위 항목 + dedupe 체크 (CI 전체 범위)
- `cd cli && ~/go/bin/golangci-lint run` — Go CLI push 전 필수 체크

## 기여하기

프로젝트에 기여하고 싶으시다면 Pull Request를 보내주세요. 모든 기여를 환영합니다!

## 라이선스

[MIT License](LICENSE)

## 참고 자료

- [`ep` CLI 설계 원칙](docs/cli-llm-as-caller.md)
- [FSRS 알고리즘 설명](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS)
- [ts-fsrs 라이브러리](https://github.com/open-spaced-repetition/ts-fsrs)
- [Convex 공식 문서](https://docs.convex.dev/)
- [Convex Auth 가이드](https://docs.convex.dev/auth)
