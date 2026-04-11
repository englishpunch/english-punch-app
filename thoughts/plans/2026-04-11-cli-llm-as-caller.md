---
date: 2026-04-11
author: claude
status: draft
topic: Align ep CLI around the LLM-as-caller mindset (JSON, exit codes, idempotency, self-describing)
---

# LLM-as-Caller: Aligning the `ep` CLI

## Overview

The biggest consumer of the `ep` CLI is a Claude Code skill that drives an English-learning loop, not a human terminal user. Every design choice that is ambiguous or human-friendly-first must be re-weighed against the question: **"Can an LLM agent call this via a Bash tool and reliably parse the result?"**

This plan audits the current CLI against that lens and lists the concrete work needed to bring every existing and planned command into line. The enduring version of these principles lives at `docs/cli-llm-as-caller.md` (referenced from `CLAUDE.md`) — this plan is the one-time migration effort.

## Motivation

- `ep` was originally conceived as a power-user CLI with a Homebrew distribution, and some early design reflexes (colored output, friendly English error strings, interactive login prompts) optimized for a human reading the terminal.
- The real primary user is **Claude Code (me)**, invoking commands via Bash tool calls and parsing stdout/stderr to drive the next step in a conversational loop with the human user.
- Human ergonomics are still welcome as a side-effect, but **if a design choice helps humans at the cost of making LLM consumption harder, the LLM wins.**
- Most of the gap is small: adding `--json` everywhere, replacing free-form error strings with stable tokens, documenting every flag, and marking commands idempotent where possible.

## Principles (the five rules the skill depends on)

These are the enduring rules. A short version lives at `docs/cli-llm-as-caller.md` for CLAUDE.md to @-link.

1. **`--json` on everything, always.** The human-readable output is the afterthought. Every command that returns data — including single-value queries and success confirmations for mutations — must support `--json` with the existing field-list discovery / field-filter pattern from `common/jsonflag.go`.

2. **Deterministic exit codes + pattern-matchable error tokens.** Errors should be classified into a small finite set of uppercase tokens that appear at the **start of stderr** so the skill can `grep` / regex them without parsing English. Exit codes stay in the existing `common/errors.go` buckets (`0`, `1`, `2`, `3`) but the stderr message is the real API.

3. **Idempotency where feasible.** If the skill's tool call times out mid-chain and it retries, re-running the same command should not create duplicates or corrupt state. Read-only queries are already idempotent; mutations need explicit support (e.g., a client-generated idempotency key for `cards quick`, the row-existence semantics for `pendingReviews`).

4. **Self-describing `--help` text.** Every command's `Short`, `Long`, flag descriptions, and examples must be complete enough that I can discover the command from `ep <verb> --help` alone, without external docs. No "see README for details" gaps.

5. **Minimal chrome in default output.** No spinners, no colors unless stdout is a TTY, no multi-line ASCII tables, no progress bars, no animated dots. One machine-parseable line per fact. The JSON path is always there if machine consumption is needed, but the default should already be quiet and greppable.

## Current state audit

Command-by-command gaps against the five principles.

### `ep auth login / logout / status` (cli/internal/ep/cmd/auth.go)

- **Principle 1 (JSON)**: `status` prints free-form "Logged in as X / Convex URL: Y" — **no `--json`**. `login` / `logout` are mutations with no return value; `--json` could emit `{"ok": true, "email": "..."}`.
- **Principle 2 (error tokens)**: errors go through `common.NewAuthError(...)` but the tokens are English strings like "not logged in — run 'ep auth login' first" (auth.go:152). Needs prefixes like `NOT_LOGGED_IN:` or `INVALID_CREDENTIALS:`.
- **Principle 3 (idempotency)**: `logout` is already idempotent (`KeychainDelete` succeeds even if no entry). `login` is idempotent in effect (overwrites). No change needed.
- **Principle 4 (help)**: `Short` is set but flags (`--email`, `--password`) need more description on how they interact with interactive prompts and non-TTY stdin.
- **Principle 5 (chrome)**: `login` prints a password prompt — **interactive by design, breaks LLM use.** Need to document that `--email` + `--password` flags are the LLM path, and fail fast on non-TTY input (already partially done at auth.go:40). Also the bare `fmt.Println("Logged out.")` is fine but should not be printed when `--json`.

**Work items**:
- Add `--json` support to all three subcommands.
- Prefix every returned error with a token (`NOT_LOGGED_IN`, `INVALID_CREDENTIALS`, `KEYCHAIN_UNAVAILABLE`).
- Expand `--help` flag descriptions and add an "Examples" section.
- Gate status-output prints behind `--json`.

### `ep bags list` (cli/internal/ep/cmd/bags.go:24)

- **Principle 1**: already has `--json` with field discovery. ✅
- **Principle 2**: errors wrap Convex failures with `fmt.Errorf("fetch bags: %w", err)` — the underlying Convex error string is not tokenized. Need a `CONVEX_QUERY_FAILED:` prefix or similar.
- **Principle 3**: query, already idempotent. ✅
- **Principle 4**: `Short` only, no `Long` or examples.
- **Principle 5**: default output is already `PrintJSON(bags)` (no table chrome). ✅

**Work items**: error tokenization + help text.

### `ep bags default set / unset / show` (cli/internal/ep/cmd/bags.go, new)

- **Principle 1**: **no `--json`** — prints "Default bag set to X", "No default bag set.", etc. Needs `{"defaultBagId": "..."}` or `{"ok": true}`.
- **Principle 2**: `verifyBagOwnership` returns a free-form `bag %q not found among your bags` error — needs `BAG_NOT_FOUND:` token.
- **Principle 3**: `set` is idempotent (overwrite). `unset` is idempotent (already checks for empty). `show` is read-only. ✅
- **Principle 4**: `Short` only.
- **Principle 5**: default output has minimal chrome. ✅

**Work items**: `--json` on all three + error tokens + `--help` expansion.

### `ep config show` (cli/internal/ep/cmd/config.go)

- **Principle 1**: no `--json`. The field list would be: `configDir`, `configFile`, `convexURL`, `defaultBagId`.
- **Principle 2**: no errors to tokenize (query only).
- **Principle 3**: read-only. ✅
- **Principle 4**: sparse help.
- **Principle 5**: tabular `Config dir: ... / Config file: ... / Convex URL: ...` output — minimal chrome, already fine for humans. Keep it as the default and add `--json` as the parallel path.

**Work items**: `--json` + help expansion.

### `ep doctor` (cli/internal/ep/cmd/doctor.go)

- **Principle 1**: diagnostic output is free-form. Needs `--json` emitting `{"checks": [{"name": "...", "ok": true, "message": "..."}, ...]}`.
- **Principle 2**: errors inline in human-readable checks — not currently a problem because `doctor` is diagnostic, but `--json` should surface per-check status.
- **Principle 3**: read-only. ✅
- **Principle 4**: minimal help.
- **Principle 5**: human-readable checklist output — fine for default, add `--json` parallel.

**Work items**: `--json` with structured check results + help.

### `ep open` (cli/internal/ep/cmd/open.go)

- Side-effect command (launches browser). `--json` could return `{"opened": true, "url": "..."}`. Low priority.

### Planned: `ep cards quick` (2026-04-11-cli-cards-quick.md)

Plan doc already mentions `--json`. Needs to be updated to include:
- Error tokens: `CONTEXT_AND_QUESTION_EXCLUSIVE`, `EMPTY_ANSWER`, `NO_DEFAULT_BAG`, `BAG_NOT_OWNED`, `AI_GENERATION_FAILED`.
- Idempotency: a client-generated `idempotencyKey` (UUID) that the server uses to deduplicate `cards` inserts within a short window. Needs a backend change — flag as open question.
- Example flow in `--help`.

### Planned: `ep review start / reveal / rate / status / abort` (2026-04-11-server-side-review-attempt.md)

Plan doc already has tokens (`NO_PENDING_REVIEW`, `REVIEW_ALREADY_PENDING`, `REVIEW_NOT_REVEALED`) and idempotency (`revealReview` returns cached answer on repeat calls). Needs:
- `--json` explicitly stated as the primary output.
- `rate` should include the remaining due count in structured JSON so the skill can decide whether to loop.
- Help text with examples of the three-step flow.

## Cross-cutting work

### Shared error-token helper

Add to `cli/internal/ep/common/errors.go`:

```go
// TokenError prefixes msg with a stable uppercase token so callers (the
// Claude Code skill, shell scripts) can pattern-match without parsing
// free-form English. Token should be UPPER_SNAKE_CASE and come from a
// short, closed set documented in docs/cli-llm-as-caller.md.
func TokenError(token, msg string, err error) *ExitError { ... }
```

And a canonical registry of tokens at the top of `errors.go` as a `const` block so future authors (and I, reading it) can grep them.

### Shared `--json` on commands without output

Today `jsonflag.HandleOutput` returns `(false, nil)` when the command produces no data. We need a convention for confirmation-only mutations: when `--json` is set and the mutation succeeds, print `{"ok": true}` (plus any returned fields from the server). Add a helper `common.PrintJSONOK(extra map[string]any) error`.

### Help-text linter

A Go test that reflects over `NewRootCmd()` and fails if any subcommand is missing `Long`, `Example`, or has flags without descriptions. Keeps future commands from slipping.

### Default output should not include ANSI colors on non-TTYs

Cobra does not color by default, but any future `fmt.Println` with manual color codes will break parsing. Add a lint note to `docs/cli-llm-as-caller.md`: "never emit ANSI without first checking `term.IsTerminal(int(os.Stdout.Fd()))`."

---

## Acceptance criteria

- `ep <any command> --help` is self-sufficient (every flag documented, at least one example).
- `ep <any command> --json` produces machine-parseable JSON; default output is human-readable but chrome-free.
- Every error path writes a line to stderr starting with a `TOKEN:` from a documented set in `docs/cli-llm-as-caller.md`, followed by a human explanation.
- A Go test asserts the help-text completeness for all registered commands.
- `cards quick` supports idempotency via a server-side key (requires backend change — see open question).
- The "LLM-as-caller" rules are @-linked from `CLAUDE.md` so future Claude sessions pick them up automatically.

## Out of scope

- Rewriting the Convex backend error messages — backend errors are surfaced as-is, with a `CONVEX_<VERB>_FAILED` wrapper token at the CLI layer.
- Colored or pretty output modes — explicitly not pursued; any color goes in a future separate `--color` flag, off by default.
- A full protobuf/gRPC contract — JSON is fine for the agent-calling use case.

## Open questions

1. **Server-side idempotency for `cards quick`**: needs a new `idempotencyKey` field on `cards` or a separate `cardIdempotency` table. Worth the schema churn, or rely on client-side duplicate detection? My recommendation: rely on the skill to not double-call, and only add server-side idempotency if we observe duplicates in practice.
2. **Should the default output be dropped entirely in favor of JSON-only?** Current lean: no, keep the human path because I (Claude) will sometimes read the raw output directly in a tool result without asking for `--json`, and a greppable minimal-chrome default is the smallest common denominator. But we should measure after a month of skill usage.
3. **Where do tokens live canonically — Go constants, a YAML file, or just the markdown doc?** My recommendation: Go constants in `common/errors.go`, cross-referenced from `docs/cli-llm-as-caller.md` with a "see `errors.go` for the canonical list" line. Code is the source of truth.

## Implementation order

1. **Persistent rules doc** — write `docs/cli-llm-as-caller.md` and @-link it from `CLAUDE.md`. This unblocks all future Claude sessions from following the rules automatically, even before the code is migrated.
2. **Error-token helper** — add `TokenError` + a `const` registry of tokens in `common/errors.go`. Land this before migrating commands so the work has a destination.
3. **`--json` helper for mutations** — add `common.PrintJSONOK` for confirmation-only outputs.
4. **Migrate existing commands** — `auth`, `bags list`, `bags default`, `config show`, `doctor`, `open` — each gets `--json` + error tokens + help expansion.
5. **Help-text test** — reflection-based Go test that fails CI if any command is missing help fields.
6. **Update the two in-flight plans** — `2026-04-11-cli-cards-quick.md` and `2026-04-11-server-side-review-attempt.md` — reference this doc and list their specific tokens so they land already-aligned.
7. **Implement `cards quick` and `review start/reveal/rate`** following the aligned plans.
