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
- Connect every code or documentation change to a relevant GitHub Issue. Before creating a new issue, review the full open issue list, not only a narrow keyword search. If none clearly matches, create one before starting work and assign it to the person doing the work.
- Keep issue bodies simple. Do not include direct code references, file links, or line links. Use `Direction`, `As-is`, and `To-be` to describe the problem and intended direction. If `To-be` is not clear yet, do not invent a solution; add the `TBD` label to the GitHub Issue.
- Every commit message must include the relevant GitHub Issue number. Example: `feat: add card filters #67`. Do not reference an unrelated nearby issue just to satisfy commitlint.
- ALWAYS create a feature branch before editing (`git switch -c <branch>`). To make every change reviewable, NEVER commit or push directly to `main`; ALWAYS open a PR targeting `main`, including documentation and release automation changes.
- ALWAYS put `Closes #<issue-number>` in the PR description for each issue fully completed by the PR, so merging closes the issue automatically. Use `Refs #<issue-number>` for partially addressed issues. NEVER use closing keywords in commit messages; keep their plain issue references.
- ALWAYS wait for required checks to pass before merging a PR. Local hooks block commits and pushes to `main`; repository administrators must also require PRs in GitHub branch protection to enforce this for every client.

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

- ALWAYS release CLI changes through a merged PR first, then push a `v*` tag from clean, synced `main`. `.github/workflows/release-cli.yml` publishes the GitHub Release and darwin binaries and opens a separate PR for `Formula/ep.rb`.

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

- ALWAYS review the generated formula PR, add the appropriate issue reference, and merge it after checks pass before updating Homebrew. NEVER push the formula directly to `main`. GitHub Actions must be permitted to create PRs in the repository settings.
- ALWAYS verify the CLI installed on the current computer against the latest published release after a deployment, even when the deployment only changes the web app. A downloaded binary in `/tmp` does not verify the executable users actually run. Install with `brew install englishpunch/cli/ep` if missing; otherwise upgrade:

```sh
brew update
brew upgrade englishpunch/cli/ep
scripts/verify-local-cli.sh
```

- ALWAYS report the resolved executable path, installed version, and latest release version. NEVER mark local installation verification complete if the versions differ, the executable is missing, or installation fails; report the specific blocker separately from deployment status.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
