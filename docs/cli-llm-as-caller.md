# `ep` CLI — LLM-as-Caller Design Rules

## Why this file exists

- The primary consumer of `ep` is a Claude Code skill driving an English-learning loop. A human terminal user is a welcome side-effect, not the design target.
- Every design choice must be re-weighed against: **"Can an LLM agent call this via a Bash tool and reliably parse the result?"**
- If a design choice helps humans but makes LLM consumption harder, the LLM wins.

## The five rules (non-negotiable)

### 1. `--json` on every command, always

- Every command that returns data — including confirmation-only mutations — MUST support `--json`.
- Follow the existing discovery pattern from `cli/internal/ep/common/jsonflag.go`: `--json` with no fields prints available fields; `--json f1,f2` filters.
- For mutations with no server return value, emit `{"ok": true, ...}` via `common.PrintJSONOK`.
- Default (non-`--json`) output is the fallback, not the design target.

### 2. Deterministic exit codes + pattern-matchable error tokens

- Exit codes stay in the existing `common/errors.go` buckets: `0` success, `1` general, `2` auth, `3` connection.
- Every error line written to stderr MUST start with an UPPER_SNAKE_CASE token from the canonical registry in `cli/internal/ep/common/errors.go`, followed by a colon and a human explanation.
- Examples of good tokens: `NOT_LOGGED_IN`, `NO_DEFAULT_BAG`, `BAG_NOT_FOUND`, `REVIEW_ALREADY_PENDING`, `CONTEXT_AND_QUESTION_EXCLUSIVE`.
- Never add a new token in English-prose format; add it to the `const` block and document it here.

### 3. Idempotency where feasible

- Read-only queries are idempotent by construction. No work needed.
- Mutations MUST be safe to retry after a timeout or network blip. Options:
  - Row-existence semantics (e.g., `pendingReviews` — starting a review when one exists returns the existing row instead of creating a second).
  - Client-generated idempotency keys passed to the server.
  - Natural keys (e.g., upsert-by-name).
- If a mutation cannot be made idempotent, document the reason in its command `Long` text so the skill knows to handle it with retry-caution.

### 4. Self-describing `--help`

- Every cobra command MUST set `Short`, `Long`, `Example`, and a description for every flag.
- `Example` is mandatory — show at least one realistic invocation with expected output shape.
- The skill discovers commands via `ep <verb> --help` at runtime; missing help is a broken contract.
- A Go test asserts help completeness; do not merge commands that fail it.

### 5. Minimal chrome in default output

- No ANSI colors, spinners, progress bars, animated dots, or multi-line ASCII tables in the default output path.
- One machine-parseable fact per line, or a small block of `key: value` lines for summaries.
- If color is ever added, it MUST be gated on `term.IsTerminal(int(os.Stdout.Fd()))` AND a `--color=auto|always|never` flag defaulting to `never`.
- Confirmations after mutations should be short and greppable (`Default bag set to <id>`, not `✨ Nice! Your default bag is now set to <id>! ✨`).

## What this forbids

- **Interactive prompts as the only path.** If a command ever prompts (e.g., `ep auth login` password entry), it MUST also accept the same input via flags so the skill can drive it non-interactively, and MUST fail fast with a clear token (`NOT_A_TTY`) when stdin is not a terminal and flags are missing.
- **Free-form error messages as the primary signal.** The English text after the colon is for humans; the token before the colon is the API.
- **Implicit assumptions about terminal width.** Don't wrap, don't truncate — print the full value and let the shell/tool handle display.
- **"See README" gaps in help.** If a flag's behavior is non-obvious, document it inline.
- **Emojis in output.** Stay parseable. (Global rule across the codebase, but especially here.)

## Writing a new command — checklist

Before merging a new `ep` subcommand, confirm:

- [ ] `--json` works and has a documented field list
- [ ] Every error path starts with a registered token from `common/errors.go`
- [ ] Mutation is idempotent OR the `Long` help explains why it is not
- [ ] `Short`, `Long`, `Example`, and every flag description are filled in
- [ ] Default output has no ANSI, no spinners, no progress bars, no emoji
- [ ] The help-text Go test passes (`go test ./internal/ep/cmd/...`)
- [ ] The error-token Go test passes (`go test ./internal/ep/common/...`)
- [ ] `cd cli && ~/go/bin/golangci-lint run` reports **0 issues** — this catches `errcheck` / `staticcheck` violations that plain `go vet` misses. Do not skip: CI runs `golangci-lint` and will fail the push if anything slips through.

## References

- Active migration plan: `thoughts/plans/2026-04-11-cli-llm-as-caller.md`
- Canonical token registry: `cli/internal/ep/common/errors.go`
- JSON flag helper: `cli/internal/ep/common/jsonflag.go`
- Existing commands as reference: `ep bags list` (good `--json` example), `ep auth login` (interactive path, needs work)
