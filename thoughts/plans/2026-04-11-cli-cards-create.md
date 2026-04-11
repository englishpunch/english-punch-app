---
date: 2026-04-11
author: claude
status: draft
topic: `ep cards create` — thin card creation command with all fields provided by the caller
---

# `ep cards create`

## Overview

One-shot CLI command to create a flashcard. The caller (a Claude Code
skill in the primary use case) provides **every field** — question,
answer, hint, explanation — and `ep` only validates and stores. No AI
calls happen at the CLI layer. The command is a thin wrapper around
the existing `learning:createCard` Convex mutation.

## Motivation

- The biggest consumer of `ep` is a Claude Code skill driving an
  English-learning loop (see `thoughts/plans/2026-04-11-cli-llm-as-caller.md`).
- The skill has richer conversation context than any server-side
  Gemini call: it already knows which word the user struggled with,
  what the user was reading, and the tone the user wants. Asking
  Gemini to re-derive that context server-side is wasteful and often
  produces a worse result than having the skill generate the card
  fields directly, following the rules mirrored from `convex/ai.ts`.
- Pushing generation into the skill saves roughly 100% of Gemini
  tokens per CLI-initiated card and reduces the CLI code path to a
  single Convex mutation call — no AI action, no flag-combination
  branching, no `finalAnswer` substitution.
- `convex/ai.ts` continues to exist. The web app still calls
  `generateCardDraft` / `regenerateHintAndExplanation` because it has
  no LLM in the loop the way the CLI does. This plan makes **zero
  backend changes**.

## Scope

### In scope

- One command: `ep cards create <answer> --question <q> --hint <h> --explanation <e> [--bag <id>]`
- Default bag fallback via `cfg.DefaultBagID`
- Client-side validation of every required field before the network
  call (fail fast, save round-trips)
- Tokenized errors following `docs/cli-llm-as-caller.md`
- `--json` confirmation output via `HandleOKOutput`

### Out of scope

- Other card verbs (`list`, `get`, `update`, `delete`, `create-batch`)
- AI generation in the CLI — deliberately excluded
- Interactive prompts — deliberately excluded
- Backend schema changes
- The Claude Code skill file itself — this plan describes the CLI
  contract, not the skill
- `--context` and `--source-word` flags — noted under open questions

---

## Command shape

```
ep cards create <answer> [flags]

Required flags:
  --question string      Fill-in-the-blank question with ___ for the answer
  --hint string          Short definition or synonym, under 12 words
  --explanation string   Usage/scenario/nuance note, 10-70 words

Optional flags:
  --bag string           Target bag ID (falls back to default_bag_id)
  --json [fields]        Machine-readable output with field selector

Positional: exactly one argument — the answer (English word/phrase).
Enforced with cobra.ExactArgs(1).
```

### Flag rules (client-side, before any network call)

1. **Answer**: positional arg, must be non-empty after trim. Exit
   `MISSING_REQUIRED_FIELD: answer is required`.
2. **--question**: must be non-empty after trim. Exit
   `MISSING_REQUIRED_FIELD: --question is required`.
3. **--hint**: must be non-empty after trim. Exit
   `MISSING_REQUIRED_FIELD: --hint is required`.
4. **--explanation**: must be non-empty after trim. Exit
   `MISSING_REQUIRED_FIELD: --explanation is required`.
5. **Bag**: if `--bag` is empty, read `cfg.DefaultBagID`. If also
   empty, exit `NO_DEFAULT_BAG: --bag <id> or 'ep bags default set'`.

Validation runs **in the order above** so the first missing field is
the one reported. This keeps the skill's retry loop deterministic.

---

## Mutation mapping

Server mutation: `learning:createCard` (`convex/learning.ts:640`).

| `createCard` field | Source                                    |
|---|---|
| `bagId`            | `resolveBagID(flag, cfg)`                 |
| `userId`           | authenticated user from `authenticatedClient` |
| `question`         | `--question` flag                         |
| `answer`           | positional arg                            |
| `hint`             | `--hint` flag                             |
| `explanation`      | `--explanation` flag                      |
| `context`          | `undefined` (not passed)                  |
| `sourceWord`       | `undefined` (see open questions)          |
| `expression`       | `undefined`                               |

No `finalAnswer` logic — the skill already chose the final form
before calling. No AI call.

---

## `--json` output

Success emits via `HandleOKOutput` with these extra fields (in
addition to the automatic `ok: true`):

| Field         | Type    |
|---|---|
| `bagId`       | string  |
| `question`    | string  |
| `answer`      | string  |
| `hint`        | string  |
| `explanation` | string  |

Standard `--json` behavior:
- Bare `--json` → field list (including `ok` plus the five above)
- `--json f1,f2` → filtered output
- `--json` on success after the mutation → `{"ok": true, "bagId": "...", ...}`

Since `learning:createCard` currently returns `null`, the CLI does not
echo back a card ID. This is a known limitation shared with the web
app and is called out in the cross-cutting work section of
`2026-04-11-cli-llm-as-caller.md`.

---

## Error cases

| Condition                              | Token                    | Exit code |
|---|---|---|
| Missing positional arg                 | (cobra-native message)   | 1         |
| Empty answer / question / hint / explanation | `MISSING_REQUIRED_FIELD` | 1 |
| No `--bag` and no default bag set      | `NO_DEFAULT_BAG`         | 1         |
| Not logged in                          | `NOT_LOGGED_IN`          | 2         |
| Convex unreachable                     | `CONVEX_UNREACHABLE`     | 3         |
| Convex returns a non-200 HTTP status   | `CONVEX_HTTP_ERROR`      | 3         |
| Server rejection (e.g. invalid bag id) | `CONVEX_API_ERROR`       | 1         |

The `MISSING_REQUIRED_FIELD` token's message MUST contain the field
name so the skill can pattern-match and ask the user for exactly
that field: `MISSING_REQUIRED_FIELD: --question is required`.

The cobra-native "accepts 1 arg(s), received 0" is a rare case (the
skill will construct the call correctly) and is left unaddressed in
v1 — noted as a minor gap.

---

## Files touched

- `cli/internal/ep/common/errors.go` — new token `MISSING_REQUIRED_FIELD`
- `cli/internal/ep/cmd/bags.go` — new helper `resolveBagID(flagValue string) (string, error)`
- `cli/internal/ep/cmd/cards.go` — **new file** with `newCardsCmd()` + `newCardsCreateCmd()`
- `cli/internal/ep/cmd/root.go` — register `newCardsCmd()`
- `cli/internal/ep/cmd/cards_test.go` — **new file** with flag validation tests (no network)

---

## Gates the commit must clear

- `cd cli && go vet ./... && go test ./... && go build ./...`
- `cd cli && ~/go/bin/golangci-lint run` reports **0 issues**
- `TestErrorTokens_Lint` — new token + call sites must be recognized
- `TestErrorTokens_ConstRegistryDrift` — new token must be in both places
- `TestCommands_HaveCompleteHelp` — `cards` and `cards create` must have `Short`, `Long`, `Example`, and every flag must have a non-empty `Usage`

---

## Testing

### Unit tests (cards_test.go, no network)

1. Missing answer (empty positional) → cobra's built-in `ExactArgs(1)` error
2. Empty answer (whitespace only) → `MISSING_REQUIRED_FIELD: answer`
3. Empty `--question` → `MISSING_REQUIRED_FIELD: --question`
4. Empty `--hint` → `MISSING_REQUIRED_FIELD: --hint`
5. Empty `--explanation` → `MISSING_REQUIRED_FIELD: --explanation`
6. Field validation order: when multiple fields missing, first one (answer) is reported

Use `cobra.Command.SetArgs` + a captured stderr via the test helper
pattern already used in `common/jsonflag_test.go` (`captureStdout` →
adapted for stderr).

### Manual smoke tests (after `make build`)

```bash
# Happy path
ep cards create "disheartened" \
  --question "I felt ___ after the rejection." \
  --hint "extremely discouraged or low-spirited" \
  --explanation "Stronger than 'sad' but softer than 'devastated'; …" \
  --bag k17abc...

# Default bag (requires prior 'ep bags default set')
ep cards create "disheartened" --question "..." --hint "..." --explanation "..."

# --json happy path
ep cards create "disheartened" --question "..." --hint "..." --explanation "..." --json

# --json field discovery
ep cards create x --question x --hint x --explanation x --json

# --json field filter
ep cards create "disheartened" --question "..." --hint "..." --explanation "..." --json ok,bagId

# Missing field error (each of the four)
ep cards create "disheartened" --hint "..." --explanation "..."
#   → MISSING_REQUIRED_FIELD: --question is required
```

---

## Implementation order

1. **Token**: add `TokenMissingRequiredField = "MISSING_REQUIRED_FIELD"` to `errors.go` const block and `CanonicalTokens`.
2. **Helper**: add `resolveBagID` to `bags.go`.
3. **Command**: create `cards.go` with `newCardsCmd()` (parent) and `newCardsCreateCmd()` (leaf) including `Long`, `Example`, and flag descriptions.
4. **Register**: add `cmd.AddCommand(newCardsCmd())` in `root.go`.
5. **Unit tests**: `cards_test.go` covering the six validation cases.
6. **Gates**: run `go vet`, `go test`, `go build`, `golangci-lint run` — all must be green.
7. **Smoke test** the command paths listed above.
8. **Commit + push**.

---

## Open questions

1. **`sourceWord`**: should the positional answer arg be stored as
   `sourceWord` so the web app's stats can differentiate CLI-created
   cards from web-created cards? Current plan: leave unset for
   simplicity; add a `--source-word` flag later if needed.
2. **Client-generated idempotency key**: a second invocation with the
   same flags would create a duplicate card. Noted as future work in
   `2026-04-11-cli-llm-as-caller.md` (cross-cutting section on
   idempotency). Not in scope for v1 — the skill will be careful not
   to double-call.
3. **Prompt-rule drift between skill and `convex/ai.ts`**: the skill
   will copy the question-generation rules from `convex/ai.ts`. When
   those change, the skill must be updated manually. Decision: accept
   the drift for v1; revisit if we ship a third caller.
