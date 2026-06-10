# English Punch App

Instruction writing principles: @.claude/meta-rules.md

## Project Structure

- **pnpm monorepo** with Turborepo orchestration
- Always use `pnpm` as the package manager. Do not use `npm` or `yarn`.
- Workspace layout (`pnpm-workspace.yaml`):
  - `.` (root) - main app (Vite + React + TanStack Router + Convex)
  - `cli/` - `ep` Go CLI (Cobra + Viper + Convex HTTP)
  - `mcp-server/` - MCP server

## CLI Design

- The **primary user of the `ep` CLI is an AI agent such as Claude Code or Codex**. Human terminal use is secondary.
- When adding a new `ep` command or modifying an existing one, follow the five rules in @docs/cli-llm-as-caller.md: required `--json`, deterministic error tokens, idempotency, self-describing `--help`, and minimal chrome.

## Date and Time

- Always follow @docs/date-time-rules.md for date/time handling and formatting.

## Convex Rules

- Before editing Convex code, always read @docs/convex_rules.mdc.
- Treat @docs/convex_rules.mdc as a generated file fetched from https://convex.link/convex_rules.mdc. Do not edit it manually.
- Record the refresh date in `updatedAt` in @docs/convex_rules.meta.json.
- When starting Convex work, run the following command. If `updatedAt` is more than 7 days old or metadata is missing, it automatically overwrites the file with the latest version.

```sh
scripts/update-convex-rules.sh
```

- To force an immediate refresh, run:

```sh
scripts/update-convex-rules.sh --force
```

## Frontend UI Runtime Review

- When changing UI layout, interactions, state, overlays, or dense controls, always follow @docs/ui-runtime-review.md.
- For UI changes that are hard to verify from the code diff alone, check the real browser runtime when possible. If runtime verification was not possible, state that in the final response.

## Frontend Components

- When splitting JSX into components, move the component to a separate file instead of leaving it as a local function component.

## Check Commands

- `pnpm run check` - run before committing. It runs lint + knip + test and is safe with staged changes.
- `pnpm run check:all` - run after committing or from a clean tree. It includes the above checks plus dedupe checks and matches the full CI scope.

## Work Tracking

- Start every task from the latest `main`. Before work, run `git status -sb` to inspect uncommitted changes, then from `main` run `git fetch origin --tags` and `git pull --ff-only`. If uncommitted changes exist, inspect their scope before doing anything that could overwrite them.
- Connect every code or documentation change to a GitHub Issue. If no related issue exists, create one before starting work.
- Assign the working issue to the person doing the work.
- Keep issue bodies simple. Do not include direct code references, file links, or line links. Use `Direction`, `As-is`, and `To-be` to describe the problem and intended direction. If `To-be` is not clear yet, do not invent a solution; add the `TBD` label to the GitHub Issue.
- Every commit message must include a GitHub Issue number. Example: `feat: add card filters #67`.
- Do not auto-close issues from commit messages. Avoid keywords such as `Closes #67`, `Fixes #67`, and `Resolves #67`. Close issues manually or through a separate audit skill/workflow.

### Check CI After Push

- CI runs a wider scope than local `pnpm run check`, roughly equivalent to `pnpm run check:all`, so failures may appear only after push.
- Always wait for GitHub Actions to complete after pushing.
- Always check the latest run status with the following commands. If a run fails, read the logs, fix the issue, and push again.

```sh
gh run list --branch "$(git branch --show-current)" --limit 5
gh run watch
gh run view --log-failed
```

### Individual Commands

- `pnpm run lint` - ESLint
- `pnpm run knip` - detect unused code and dependencies
- `pnpm run test` - Vitest unit tests

### TypeScript Type Checking

- For individual file edits, use `getDiagnostics` from the IDE LSP plugin to check type errors immediately. `tsc --noEmit` is not needed.
- When a whole-project check is required, such as before a commit, use `tsc --noEmit` only as a last resort.

### Go CLI (`cli/`)

- `go vet` does not catch stricter rules from tools such as `errcheck` or `staticcheck`. CI runs `golangci-lint`, so run it locally before pushing Go CLI changes. Otherwise the workflow becomes CI fail, fix, re-push.
- **Required before push**: `cd cli && ~/go/bin/golangci-lint run`
- Fast development loop: `cd cli && go vet ./... && go test ./... && go build ./...`
- Install golangci-lint once: `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`

### Go CLI Versioning and Release

- `ep` CLI releases start by pushing a `v*` tag. `.github/workflows/release-cli.yml` runs GoReleaser and updates the GitHub Release, darwin binaries, and `Formula/ep.rb`.
- Before releasing, `main` must be clean and synced with the remote.

```sh
git checkout main
git pull --ff-only

cd cli
go test ./...
~/go/bin/golangci-lint run
cd ..

VERSION=v0.3.3 # Example: when the latest tag is v0.3.2.
git tag -a "$VERSION" -m "cli $VERSION"
git push origin "$VERSION"
```

- Check the latest existing tag before choosing a new tag number: `git tag --sort=-v:refname | head`.
- Do not reuse or force-move a tag that has already been pushed. If there is a problem, create the next patch version tag.
- After pushing the tag, wait for the release workflow to finish:

```sh
gh run list --workflow release-cli.yml --limit 3
gh run watch
gh run view --log-failed
```

- GoReleaser can push `Formula/ep.rb` back to `main`, so after the release completes, run `git pull --ff-only` to sync local state.
- Verify the release:

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
