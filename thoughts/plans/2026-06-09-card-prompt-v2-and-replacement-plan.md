---
date: 2026-06-09
author: codex
status: draft
topic: Card prompt v2 and reset-based replacement workflow
---

# Card Prompt v2 and Replacement Plan

## Goal

Replace existing English Punch cards whose questions or hints are too long or unfocused with a shorter, more targeted format.

Core direction:

- `question` should be a simple single sentence where the target word or expression fits most naturally.
- Prefer sentences learners can read and memorize as a whole.
- `hint` should provide only 2-3 high-priority synonyms or paraphrases instead of a long definition.
- Preserve the existing card `context` when possible.
- When a question changes, reset the card for relearning instead of preserving existing FSRS values.

## Current Findings

- The web card creation form calls `api.ai.generateCardDraft` from `src/components/CardForm.tsx` to generate `question`, `hint`, `explanation`, and optional `finalAnswer`.
- The AI generation action lives in `convex/ai.ts`, and the current prompt focuses on longer explanations and persona diversity.
- Card editing currently uses `api.learning.updateCard`.
- `updateCard` overwrites FSRS state with `initialSchedule(now)` on the server.
- However, `initialSchedule` does not include `elapsed_days`, so an old value can remain.
- CLI `ep cards create` does not call AI. It stores caller-provided `question`, `hint`, and `explanation` as-is.
- The CLI currently does not have enough card-editing surface to inspect and replace existing cards.

## Product Decisions

- Question edits do not preserve learning state.
- Changing card content is treated as close to creating a new card.
- Deprecate the existing `updateCard` and move callers to a new API whose name makes the reset behavior explicit.
- To reduce cost, allow the Codex skill to generate `question` and `hint` directly from v2 rules.
- API-based generation and skill-based generation should share the same v2 rules.
- Do not add a separate `generateCardDraftV2` action. Extend the existing action as `generateCardDraft({ promptVersion: "v2" })`.
- `skills/english-punch/SKILL.md` should replace the old generation rules with the new rules directly, without exposing separate v1/v2 modes.

## Prompt v2 Rules

### Question

- Generate only one sentence.
- Include exactly one `___` blank.
- The target word or expression must be the most natural completion for the blank.
- Keep the sentence simple. Do not enforce a strict length limit, but avoid unnecessary subordinate clauses and background setup.
- Default to CEFR B1-B2.
- The sentence should be easy for a learner to read and memorize as a whole.
- If `context` exists, reflect the situation, tone, and use case.
- Do not explain the `context` at length inside the sentence.
- If the answer needs an inflected verb, noun, or adjective form, use the actual study form as `answer`.

### Hint

- Avoid long definitions.
- Provide the 2-3 highest-priority synonyms or paraphrases.
- Prefer comma-separated format.
- Do not include the answer itself.
- Keep it under 12 words.

### Explanation

- During the initial migration, preserving the existing explanation is the default.
- For new card creation, keep the existing rule or shorten it to match v2.
- Treat explanation v2 as a separate commit.

## Proposed API

Candidate mutation name:

```ts
api.learning.replaceCardContentAndResetSchedule
```

The name is long, but it clearly communicates two things:

- It replaces an existing card's content.
- It resets FSRS schedule/state as if the card were new.

Reset fields:

- `due = now`
- `stability = 0`
- `difficulty = 0`
- `elapsed_days = undefined`
- `scheduled_days = 0`
- `learning_steps = 0`
- `reps = 0`
- `lapses = 0`
- `state = 0`
- `last_review = undefined`
- `suspended = false`

Handling existing `updateCard`:

- Add `/** @deprecated use replaceCardContentAndResetSchedule */`.
- Keep it as a wrapper for now to preserve compatibility.
- Decide whether to delete it after web, MCP, and CLI callers move to the new API.

## Commit Plan

### 1. Add v2 prompt plan document

- Add this document.
- Lock in the high-level direction and commit order before implementation.

### 2. Add reset-explicit Convex mutation

- Add `replaceCardContentAndResetSchedule`.
- Ensure `elapsed_days` is reset too.
- Convert `updateCard` into a deprecated wrapper.
- Add related unit tests if practical.

### 3. Move web and MCP callers

- Update `CardEditPage` to call the new mutation.
- Update the MCP `update-card` tool to call the new mutation.
- Expose the FSRS reset meaning in UI/tool descriptions.

### 4. Add CLI card read/replace commands

Minimum required commands:

```bash
ep cards get <card-id> --bag <bag-id> --json
ep cards replace <card-id> --bag <bag-id> \
  --question "..." \
  --answer "..." \
  --hint "..." \
  --explanation "..." \
  --context "..." \
  --json
```

CLI help should state that `replace` resets the FSRS schedule.

### 5. Add AI prompt v2

Implementation shape:

```ts
generateCardDraft({ answer, context, promptVersion: "v2" })
```

- Keep v1 and v2 side by side.
- Switch the web default in a separate commit.
- Strengthen v2 output validation.

### 6. Replace skill generation rules

- Replace the existing question/hint generation rules in `skills/english-punch/SKILL.md` with the new rules.
- Do not expose separate v1/v2 modes inside the skill.
- Document the flow where Codex directly creates `question`/`hint` without Gemini API and saves them with `ep cards replace`.
- Define the verification format before and after saving cards.

### 7. Migrate selected existing cards

1. Query candidates.
2. Prioritize long questions, multi-sentence questions, and long hints.
3. Preserve existing `context`.
4. Generate v2 candidates for only 10-20 sample cards first.
5. Create diffs that are easy for a human to review.
6. Provide a web edit link for each candidate.
7. Apply only user-reviewed and approved cards with `ep cards replace`.

## Migration Candidate Rules

High-priority candidates:

- Cards whose `question` has two or more sentences.
- Cards whose `question` is too long to focus on the target word.
- Cards whose `hint` reads like a definition or mixes multiple meanings.
- Cards whose `hint` includes the answer.
- Cards whose `question` blank does not sufficiently guide the answer.
- Cards with `context` where the question does not reflect that context well.

## Validation

For each implementation commit, run what is practical from the following:

- `pnpm run test`
- `pnpm run lint`
- `pnpm run check`
- `cd cli && go test ./...`
- `cd cli && ~/go/bin/golangci-lint run`

Before replacing cards, run a dry-run that confirms:

- existing card id
- bag id
- existing question/hint/context
- new question/hint
- whether the answer changes
- whether reset is planned
- web edit link

Web edit link format:

```text
https://englishpunch.vercel.app/plans/{bagId}/cards/{cardId}/edit
```

For local development, replace only the origin with the local address.

```text
http://localhost:5173/plans/{bagId}/cards/{cardId}/edit
```

Sample dry-run output should use these columns by default:

```text
cardId | answer | oldQuestion | newQuestion | oldHint | newHint | context | editUrl
```

## Open Questions

- Should v2 become the default prompt for new card creation immediately, or should users choose it?
- Should explanation also be shortened for v2, or should the existing explanation rules stay?
- How many cards should be reviewed/applied at once during bulk replacement?
- Should `reviewLogs` and `activities` record content replacement events?
