# English Punch App

지시사항 작성 원칙: @.claude/meta-rules.md

## Project Structure

- **pnpm monorepo** with Turborepo orchestration
- 패키지 매니저는 반드시 `pnpm`을 사용할 것. `npm`, `yarn` 절대 사용 금지.
- 워크스페이스 구성 (`pnpm-workspace.yaml`):
  - `.` (루트) — 메인 앱 (Vite + React + TanStack Router + Convex)
  - `cli/` — `ep` Go CLI (Cobra + Viper + Convex HTTP)
  - `mcp-server/` — MCP 서버

## CLI Design

- `ep` CLI의 **1순위 사용자는 AI Agent(eg. Claude Code, Codex)**이다. 사람 터미널 사용자는 부수적.
- 새 `ep` 커맨드를 추가하거나 기존 커맨드를 수정할 때는 반드시 @docs/cli-llm-as-caller.md 의 다섯 가지 규칙(`--json` 필수, 에러 토큰, 멱등성, `--help` 자기기술, 최소 chrome)을 준수할 것.

## Date and Time

- 날짜/시간 처리와 포맷 규칙은 반드시 @docs/date-time-rules.md 를 따를 것.

## Frontend UI Runtime Review

- UI 레이아웃, interaction, state, overlay, dense control 을 변경할 때는 반드시 @docs/ui-runtime-review.md 를 따를 것.
- 코드 diff 만으로 확인하기 어려운 UI 변경은 가능한 경우 실제 브라우저 런타임에서 확인하고, 확인하지 못했다면 최종 응답에 명시할 것.

## Frontend Components

- JSX 일부를 컴포넌트로 분리할 때는 로컬 함수 컴포넌트로 남기지 말고 별도 파일로 분리할 것.

## Check Commands

- `pnpm run check` — 커밋 전에 실행. lint + knip + test. Staged 변경이 있어도 안전.
- `pnpm run check:all` — 커밋 후 또는 clean tree에서 실행. 위 항목 + dedupe 체크 포함. CI에서 실행되는 전체 범위.

### Push 후 CI 확인

- CI는 로컬 `pnpm run check`보다 넓은 범위(`pnpm run check:all` 상당)를 실행하므로, push 직후 실패가 늦게 드러날 수 있다.
- 항상 push 후 GitHub Actions가 완료될 때까지 확인할 것.
- 항상 다음 명령으로 최신 run 상태를 확인하고, 실패하면 로그를 읽고 수정 후 다시 push할 것.

```sh
gh run list --branch "$(git branch --show-current)" --limit 5
gh run watch
gh run view --log-failed
```

### 개별 실행

- `pnpm run lint` — ESLint
- `pnpm run knip` — 미사용 코드/의존성 감지
- `pnpm run test` — Vitest 단위 테스트

### TypeScript 타입 체크

- 개별 파일 수정 시: `getDiagnostics`(IDE LSP 플러그인)를 사용하여 즉시 타입 에러를 확인할 것. `tsc --noEmit` 불필요.
- 프로젝트 전체 체크가 필요한 경우(커밋 전 등): `tsc --noEmit`을 최후 수단으로 실행할 것.

### Go CLI (`cli/`)

- `go vet` 는 `errcheck` / `staticcheck` 같은 엄격한 룰을 못 잡음. CI는 `golangci-lint` 로 돌리므로, Go CLI 쪽을 `push` 하기 전에 반드시 로컬에서 같이 돌릴 것. 그렇지 않으면 CI fail → fix → re-push 의 round-trip 을 겪게 됨.
- **Push 전 체크 (필수)**: `cd cli && ~/go/bin/golangci-lint run`
- 빠른 개발 루프: `cd cli && go vet ./... && go test ./... && go build ./...`
- golangci-lint 설치 (한 번만): `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`

### Go CLI 버전업 / 배포

- `ep` CLI 배포는 `v*` 태그 push 로 시작된다. `.github/workflows/release-cli.yml` 이 GoReleaser 를 실행해서 GitHub Release, darwin 바이너리, `Formula/ep.rb` 를 갱신한다.
- 배포 전에는 `main` 이 clean 하고 원격과 동기화되어 있어야 한다.

```sh
git checkout main
git pull --ff-only origin main

cd cli
go test ./...
~/go/bin/golangci-lint run
cd ..

VERSION=v0.3.3 # 예시: 최신 태그가 v0.3.2 일 때
git tag -a "$VERSION" -m "cli $VERSION"
git push origin "$VERSION"
```

- 태그 번호는 기존 최신 태그를 확인한 뒤 올린다: `git tag --sort=-v:refname | head`.
- 이미 push 된 태그는 재사용하거나 강제로 옮기지 않는다. 문제가 있으면 다음 patch 버전을 새로 태그한다.
- 태그 push 후 릴리스 workflow 완료까지 확인한다:

```sh
gh run list --workflow release-cli.yml --limit 3
gh run watch
gh run view --log-failed
```

- GoReleaser 가 `Formula/ep.rb` 를 main 에 push 할 수 있으므로 릴리스 완료 후 `git pull --ff-only origin main` 으로 로컬을 맞춘다.
- 배포 확인:

```sh
brew update
brew upgrade englishpunch/cli/ep
ep --version
```

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
