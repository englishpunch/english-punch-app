---
date: 2026-04-11
author: claude
status: draft
topic: `ep cards quick` — one-shot AI-assisted card creation from the CLI
---

# `ep cards quick`

## Overview

A single CLI command that takes an English target word/phrase (the answer), optionally a Korean context OR a user-written question, and produces one card in the target bag via AI generation + `learning:createCard`. No interactive prompts, no multi-step wizard, no local draft file. One command, one server round-trip for generation, one mutation to save.

This is scoped intentionally small: the "advanced" multi-step generation flow (`expressions` → `draft` → `regen-hint` → `create`) is **explicitly out of scope**. If the user wants to edit before saving, they can re-run the command with `--question`.

## Motivation

- The current card creation flow is UI-only (`src/components/` uses `ai:generateCardDraft` then calls `learning:createCard`). From the CLI, creating a card requires either the web app or a hand-written Convex mutation call.
- Users who already know the English word want to punch in a card in one line without leaving the terminal.
- Keeping it to one command avoids the "where does the draft live between steps?" question entirely — there is no intermediate draft.

## Scope

### In scope

- One command: `ep cards quick <answer> [--bag <id>] [--context <text>] [--question <text>]`
- Default bag fallback via `cfg.DefaultBagID` (shipped in the previous change)
- AI action selection based on flag combination (see below)
- Calling `learning:createCard` with the generated + user-provided fields
- Mutual-exclusion validation between `--context` and `--question`
- Clear stdout summary and `--json` output support

### Out of scope

- `ep cards list / get / update / delete / create-batch` — separate future commands
- Multi-expression flow (`generateExpressionCandidates`) — user already knows the answer they want
- Interactive prompts, `$EDITOR` hook, local draft files
- Regenerate-hint-only on an existing card — separate future command if needed
- Tauri/web-app changes — server and web app are untouched

---

## Command shape

```
ep cards quick <answer> [flags]

Flags:
  --bag string          Target bag ID (falls back to default_bag_id in config)
  --context string      Korean scenario/context hint (sent to the AI prompt)
  --question string     User-provided question template (AI then fills hint/explanation only)
  --json [fields]       Print the created card data as JSON (supports field filter)
```

Positional: exactly one argument, the answer (English word/phrase). Enforced with `cobra.ExactArgs(1)`.

### Flag rules

1. **Default bag**: if `--bag` is empty, read `cfg.DefaultBagID` from the viper config. If that is also empty, exit with a clear message — "no bag specified and no default bag set. Run `ep bags default set <id>` or pass `--bag <id>`" — exit code `1` (general error, not auth/connection).
2. **Mutual exclusion**: `--context` and `--question` cannot both be set. If both are non-empty, exit immediately with "use either --context or --question, not both" and exit code `1`. This validation runs before any network call.
3. **Neither is allowed**: if neither `--context` nor `--question` is set, the AI generates everything with no extra hint. This is the default "quick" case.
4. **Answer must be non-empty** after trimming. Enforced client-side before the AI call.

---

## AI action selection

Given the flag combination, exactly one AI path runs:

| `--context` | `--question` | AI action | Why |
|---|---|---|---|
| — | — | `ai:generateCardDraft({ answer })` | Full AI generation, no user hints |
| set | — | `ai:generateCardDraft({ answer, context })` | Context-aware full generation |
| — | set | `ai:regenerateHintAndExplanation({ question, answer })` | User supplied the question; only hint/explanation needed |
| set | set | **rejected** (mutual exclusion) | See flag rule #2 |

Both actions exist in `convex/ai.ts` — no backend changes needed.

### Handling `finalAnswer`

`generateCardDraft` may return `finalAnswer` when the AI decided to inflect the input (e.g., `apply` → `applied`). When present and non-empty after sanitization, use it as the `answer` field passed to `createCard`. The **original** user input is preserved in `sourceWord` so later queries can trace provenance.

When the AI did not set `finalAnswer`, the user's raw input is used for both `answer` and `sourceWord`.

`regenerateHintAndExplanation` has no `finalAnswer` path — the user supplied both question and answer verbatim.

---

## `learning:createCard` mapping

Mutation signature (convex/learning.ts:640):

```
bagId, userId, question, answer,
hint?, explanation?, context?, sourceWord?, expression?
```

Mapping from the CLI state:

| `createCard` field | Source |
|---|---|
| `bagId` | `--bag` flag OR `cfg.DefaultBagID` (resolved helper) |
| `userId` | Signed-in user ID (from `authenticatedClient`) |
| `question` | `--question` value if set, else `draft.question` from `generateCardDraft` |
| `answer` | `draft.finalAnswer` if present and non-empty, else the positional arg |
| `hint` | `draft.hint` (from either AI action) |
| `explanation` | `draft.explanation` (from either AI action) |
| `context` | `--context` value if set, else `undefined` (not stored) |
| `sourceWord` | The **original** positional arg (pre-finalAnswer) |
| `expression` | `undefined` — we are not in the multi-expression flow |

The mutation currently returns `null` (no card ID). That is a known limitation: the CLI prints a success summary based on the fields it already has, without re-querying.

---

## Helper: `resolveBagID`

Shared by all future bag-scoped commands. Lives in `cli/internal/ep/cmd/bags.go` (next to `verifyBagOwnership`).

```go
func resolveBagID(flagValue string) (string, error) {
    if flagValue != "" {
        return flagValue, nil
    }
    cfg, err := config.Load(configDir)
    if err != nil {
        return "", fmt.Errorf("load config: %w", err)
    }
    if cfg.DefaultBagID == "" {
        return "", errors.New(
            "no bag specified and no default bag set — " +
                "run 'ep bags default set <id>' or pass --bag <id>",
        )
    }
    return cfg.DefaultBagID, nil
}
```

No ownership verification here — that costs a round-trip on every command. `createCard` will fail server-side if the bag does not belong to the user, and the CLI surfaces that error as-is.

---

## Output

### Default (human-readable)

```
Generated card (bag: k17abc...):
  Q: I felt ___ after the rejection.
  A: disheartened
  Hint: extremely discouraged or low-spirited
Created.
```

### With `--json` (no fields)

Print the field list for discovery, matching the existing `--json` pattern in `bags.go`.

### With `--json field1,field2,...`

Print a JSON object containing the selected fields. Available fields for `cards quick`:

```
question      string
answer        string
hint          string
explanation   string
context       string
sourceWord    string
bagId         string
```

(No `_id` — the mutation does not return it.)

---

## Error cases

| Condition | Exit code | Message |
|---|---|---|
| Both `--context` and `--question` set | 1 | "use either --context or --question, not both" |
| Empty answer after trim | 1 | "answer must not be empty" |
| No `--bag` and no default bag | 1 | "no bag specified and no default bag set — run 'ep bags default set <id>' or pass --bag <id>" |
| Not logged in | 2 | (existing `authenticatedClient` error) |
| AI action failure (e.g., GEMINI_API_KEY missing on server) | 1 | propagate Convex error message |
| Bag not owned by user | 1 | propagate Convex mutation error |
| Convex unreachable | 3 | (existing connection error) |

The AI call has no retry — one-shot. A later enhancement could add `--retry N` if Gemini is flaky.

---

## File layout

New file: `cli/internal/ep/cmd/cards.go`

```go
package cmd

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "strings"

    "github.com/echoja/english-punch-app/cli/internal/ep/common"
    "github.com/echoja/english-punch-app/cli/internal/ep/convex"
    "github.com/spf13/cobra"
)

func newCardsCmd() *cobra.Command { /* parent */ }
func newCardsQuickCmd() *cobra.Command { /* quick subcommand */ }

// Inline types (not code-generated yet):
type cardDraft struct {
    Question    string `json:"question"`
    Hint        string `json:"hint"`
    Explanation string `json:"explanation"`
    FinalAnswer string `json:"finalAnswer,omitempty"`
}
type hintAndExplanation struct {
    Hint        string `json:"hint"`
    Explanation string `json:"explanation"`
}
```

Registered in `root.go` alongside the existing subcommands.

`resolveBagID` helper is added to `bags.go` (next to `verifyBagOwnership`). `bags default set` keeps its own explicit validation — it still calls `verifyBagOwnership`.

---

## Testing

1. **Unit test** for flag mutual exclusion and default-bag fallback — using `cobra.Command.SetArgs` + captured stdout, no network. Skip full network tests since they need Gemini.
2. **Manual smoke tests** after `make build`:
   - `ep cards quick "disheartened" --bag <real id>` — happy path
   - `ep cards quick "disheartened" --context "친구에게 조언하는 상황"` — context path
   - `ep cards quick "disheartened" --question "I felt ___ after the failure."` — question path
   - `ep cards quick "disheartened" --context "..." --question "..."` — expect rejection
   - `ep cards quick "disheartened"` with no default bag set — expect the "no bag" error
   - `ep cards quick "disheartened"` with default bag set — expect it to use the default
   - `ep cards quick "disheartened" --bag <id> --json` — field list
   - `ep cards quick "disheartened" --bag <id> --json question,answer,hint` — filtered output
3. **No need for the types_gen.go codegen** in v1 — the two AI response types are small and stable. If a third command starts needing them we can add them to `codegen/generate.mjs`.

---

## Implementation Order

1. **`resolveBagID` helper** in `cli/internal/ep/cmd/bags.go`.
2. **Flag validation** — new `cards.go` with command scaffolding, mutual-exclusion check, empty-answer check. Wire `newCardsCmd()` into `root.go`.
3. **AI action call** — switch on flags, call `client.Action("ai:generateCardDraft", …)` or `client.Action("ai:regenerateHintAndExplanation", …)`. Unmarshal into `cardDraft` / `hintAndExplanation`.
4. **`createCard` call** — build the args map, handle `finalAnswer` substitution, call `client.Mutation("learning:createCard", …)`.
5. **Output** — default human summary + `--json` support matching `bags.go` style.
6. **Tests** — unit test for flag rules and bag resolution.
7. **Run** `cd cli && go vet ./... && go test ./... && go build ./...`.
8. **Smoke test** the command paths listed above.

---

## Open Questions

1. **Should `--json` on success print the created card fields, or just `{"ok": true}`?** → Current plan: print the fields (more useful, and the CLI already knows them locally).
2. **Should we cap answer length?** The AI prompt passes it verbatim. If a user pastes a sentence, the card will be weird but not broken. Leave uncapped for v1.
3. **Should we support `--dry-run` to print the generated draft without saving?** → Not in scope. If someone asks later, add it as a flag on `quick`.
4. **Do we care about the order of AI call vs bag-ownership check?** AI is expensive (LLM call, costs money). If the bag is invalid, we should reject before calling AI. Since we do not pre-verify ownership (to save a round-trip), the bag error surfaces after the AI call. Acceptable tradeoff: the `--bag` flag is usually copy-pasted correctly or pulled from config. A typo is rare. If users hit this, we can add an upfront `verifyBagOwnership` call at the cost of one extra query.
