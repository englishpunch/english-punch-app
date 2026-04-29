---
date: 2026-04-19
author: codex
status: draft
topic: Refactor cli/internal/ep/cmd/review.go into smaller, testable units without changing behavior
---

# Refactor Plan for `cli/internal/ep/cmd/review.go`

## Overview

`cli/internal/ep/cmd/review.go` is carrying too many responsibilities in one file:

- top-level Cobra command registration
- stateless subcommand handlers (`start`, `reveal`, `rate`, `status`, `abort`)
- Convex transport and response parsing
- token-specific error mapping
- the interactive `review auto` state machine
- terminal/output helpers used only by the interactive flow

The file is now over 1000 lines, while nearby command files such as `cards.go` and `bags.go` are closer to 250 lines. The main goal of this refactor is to reduce coupling and make behavior easier to test without changing the existing CLI contract.

## Motivation

- The current file mixes machine-oriented CLI contracts and human-oriented interactive behavior, which makes it harder to reason about changes safely.
- `review auto` already has good unit seams through `reviewAutoService`, but the stateless commands still couple Cobra handlers directly to auth, Convex, payload assembly, and text rendering.
- Existing tests in `cli/internal/ep/cmd/review_test.go` protect the `auto` flow reasonably well, but there is almost no regression coverage for the stateless subcommands. Refactoring without adding those seams first would be risky.
- The repo’s CLI rules in `docs/cli-llm-as-caller.md` make stability of `--json`, tokenized errors, and help text more important than internal cleverness. The refactor should preserve those contracts first and only improve structure second.

## Current pain points

### 1. One file spans unrelated concerns

- `newReviewCmd` and the stateless subcommands live beside the `review auto` orchestration and terminal helper functions.
- The file has multiple conceptual layers interleaved: command construction, transport, rendering, control flow, and TTY detection.

### 2. Stateless command handlers repeat the same structure

Each of `start`, `reveal`, `rate`, `status`, and `abort` repeats some form of:

- bare `--json` field-list handling
- `authenticatedClient(...)`
- a direct call into Convex
- manual payload-map assembly
- inline text rendering

That duplication makes small output or token changes noisy and easy to apply inconsistently.

### 3. Error mapping is spread across multiple local functions

- `reviewStartError`, `revealReview`, and `rateReview` each map tokens differently.
- `nextReviewAutoCard` also depends on token inspection through `hasExitToken`.
- The behavior is reasonable, but the token logic is not centralized enough to read quickly.

### 4. `review auto` contains both the state machine and the presentation layer

- `runReviewAuto` currently handles looping, prompt/quit control flow, due-count completion logic, and direct rendering.
- That makes it testable, but still denser than it needs to be.

### 5. Test coverage is asymmetric

- `review_test.go` exercises `parseReviewAutoRating` and several `runReviewAuto` scenarios.
- There is little or no direct regression coverage for:
  - stateless command validation
  - JSON field-list behavior
  - text output of `start` / `reveal` / `rate` / `status` / `abort`
  - `review auto` rejecting `--json`
  - `review auto` rejecting non-TTY streams

## Refactor goals

1. Preserve current command names, flags, JSON field names, default stdout text, and tokenized error behavior unless a change is explicitly called out.
2. Split the file along clear responsibility boundaries rather than by arbitrary line count.
3. Create test seams for stateless command behavior before moving too much code.
4. Keep the final structure boring and legible. Avoid a generic abstraction that hides the command-specific contracts.

## Non-goals

- Do not redesign the review flow itself.
- Do not change server APIs or Convex mutation/query names.
- Do not rename JSON fields just because the internal structure changes.
- Do not “generalize” all review operations behind one opaque helper if that makes token handling or output contracts harder to follow.

## Proposed target structure

### `cli/internal/ep/cmd/review.go`

Keep only:

- review-related types that are shared across multiple files, if needed
- field-list definitions for `--json`
- `newReviewCmd()`

This file should stay as the entry point and table of contents.

### `cli/internal/ep/cmd/review_commands.go`

Move the stateless Cobra subcommands here:

- `newReviewStartCmd`
- `newReviewRevealCmd`
- `newReviewRateCmd`
- `newReviewStatusCmd`
- `newReviewAbortCmd`

Also move small command-layer helpers that are only about rendering or payload assembly for those commands.

### `cli/internal/ep/cmd/review_service.go`

Move the transport and error-mapping layer here:

- `startReview`
- `revealReview`
- `rateReview`
- `fetchPendingReview`
- `abandonReview`
- token-mapping helpers such as `reviewStartError`
- `convexReviewAutoService`

This file should be the boundary between Cobra handlers and Convex.

### `cli/internal/ep/cmd/review_auto.go`

Move the interactive loop here:

- `newReviewAutoCmd`
- `runReviewAuto`
- `nextReviewAutoCard`
- prompt parsing helpers
- summary/reveal/question/rate rendering helpers
- TTY and terminal-width helpers

This isolates the intentionally interactive path from the LLM-oriented stateless commands.

## Recommended extraction order

### Phase 1: Add missing safety tests

Before moving code, add coverage for the contracts most likely to break during refactor:

- `review rate` invalid rating returns `MISSING_REQUIRED_FIELD`
- `review auto --json` returns `INTERACTIVE_ONLY`
- `review auto` on non-TTY streams returns `NOT_A_TTY`
- at least one stateless command output path
- at least one stateless `--json` field-discovery path

Reason: once code is split, these tests let us refactor structure with less fear of subtle contract drift.

### Phase 2: Extract the service/transport layer

Move the Convex calls and token mapping into `review_service.go` without changing behavior. This is the cleanest first extraction because:

- function inputs/outputs are already concrete
- most logic is pure response parsing and token translation
- both stateless commands and `review auto` depend on the same service behavior

### Phase 3: Extract the interactive flow

Move `review auto` and its private helpers into `review_auto.go`. Keep `runReviewAuto` as the top-level state machine, but make sure the file groups helpers by purpose:

- input parsing
- card acquisition/resume
- rendering
- terminal helpers

### Phase 4: Extract stateless command handlers

Move the Cobra subcommands into `review_commands.go`, then trim handler bodies so each one reads roughly as:

1. validate args / resolve local flags
2. authenticate
3. call service
4. render JSON or text

### Phase 5: Clean up remaining duplication

After the split, look for low-risk helper extraction:

- payload builders for JSON output
- repeated optional-string handling
- repeated text-print patterns

Only do this after the split. Avoid mixing structural refactor and helper refactor in one large patch unless the tests are already in place.

## Detailed design notes

### Stateless command rendering

The stateless commands should keep distinct render helpers rather than a single generic renderer. The contracts differ enough that local explicitness is better:

- `start` prints `cardId`, `bagId`, `question`, optional `hint`
- `reveal` prints `cardId`, raw question line, `answer`, optional extras
- `rate` prints `nextReviewDate`, `newState`, `dueCount`
- `status` prints `pending=false` as JSON, but text mode prints either “No pending review.” or a summary block
- `abort` uses `HandleOKOutput(...)` rather than a free-form payload

The shared pattern is structure, not identical content.

### Error handling

Keep token translation close to the transport layer, not inside Cobra handlers. The command layer should receive already-normalized errors whenever possible.

That means:

- token inspection for server failures belongs in `review_service.go`
- command handlers should usually only return the error
- `review auto` may still need `hasExitToken(...)` when branching on retry/resume behavior

### `review auto` state machine

`runReviewAuto` is already the right seam for unit tests. Keep that seam intact. Refactor internally only enough to make the loop easier to scan:

- fetch/resume/start card
- show question
- reveal or quit
- show reveal
- rate or quit
- show result / finish

Do not over-engineer this into a new framework or generic session runner.

### Shared types

Types such as:

- `reviewStartResult`
- `reviewRevealResult`
- `reviewRateResult`
- `reviewStatusResult`
- `reviewAbandonResult`
- `reviewAutoCard`
- `reviewAutoService`

can stay in `review.go` if that makes cross-file usage simpler, or move to `review_service.go` if most of them are transport-facing. The main rule is consistency: keep shared types in one obvious place.

## Test plan

Minimum regression suite to have before or during refactor:

- existing `runReviewAuto` tests continue to pass
- new unit test for invalid `review rate` argument
- new unit test for `review auto --json`
- new unit test for `review auto` non-TTY rejection
- new unit test for one stateless command’s `--json` discovery output
- new unit test for one stateless command’s default text output

Verification commands:

```bash
cd cli && go test ./internal/ep/cmd/...
cd cli && go test ./internal/ep/common/...
cd cli && ~/go/bin/golangci-lint run
```

## Acceptance criteria

- `review.go` is no longer a 1000+ line mixed-responsibility file.
- The review command code is split into files that match real responsibility boundaries.
- Existing behavior for flags, JSON fields, text output, and error tokens remains stable.
- `review auto` keeps its current behavior, including pending-review resume semantics and quit/discard behavior.
- Refactor is protected by broader tests than the current `auto`-only emphasis.

## Suggested implementation sequence

1. Add tests for stateless-command contract points and `review auto` guardrails.
2. Extract Convex transport and token mapping into `review_service.go`.
3. Extract `review auto` into `review_auto.go`.
4. Extract stateless command builders into `review_commands.go`.
5. Run `go test` and `golangci-lint`.
6. Do a final pass for small helper cleanup only if it improves readability without changing behavior.

## Risks

### Risk: accidental CLI contract drift

- The easiest thing to break is text output formatting or JSON field names.
- Mitigation: add regression tests before moving handlers.

### Risk: over-abstraction

- A generic “review operation” helper could hide command-specific behavior and make future changes harder.
- Mitigation: prefer explicit per-command render helpers over one giant abstraction.

### Risk: mixing structural and behavioral edits

- Large moves plus behavior tweaks are hard to review.
- Mitigation: keep the refactor behavior-preserving; do behavioral cleanup in a separate follow-up if needed.

## Follow-up opportunities

After the structural refactor lands safely, the next worthwhile cleanup would be a smaller pass focused only on stateless command test coverage and render-helper consistency. That should be a separate change from the file split itself.
