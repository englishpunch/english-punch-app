---
name: english-punch
description: English learning loop driven by the ep CLI. Capture unfamiliar vocabulary as flashcards, generate questions/hints/explanations from conversation context, and (later) run spaced-repetition reviews end-to-end from chat.
---

# English Punch skill

This skill turns a regular Claude Code chat into an English-learning
coach backed by the [English Punch](https://englishpunch.vercel.app/)
flashcard app. It uses the `ep` CLI (a Go binary distributed via
Homebrew) as its tool surface and never calls any AI API directly —
all content generation happens in this conversation, and `ep` is a
thin wrapper around the Convex backend that stores the cards.

## When to use this skill

- The user pastes an English word or phrase they do not know.
- The user says a sentence with an error and wants a correction.
- The user asks for a flashcard review session.
- The user asks "what does X mean" and you want the answer to stick.

## Prerequisites

Before using any `ep` tool, check the environment:

1. **Is `ep` installed?** — run `ep --version`. If missing, tell the
   user to install via:
   ```bash
   brew tap englishpunch/cli https://github.com/englishpunch/english-punch-app
   brew install englishpunch/cli/ep
   ```
2. **Is the user logged in?** — run `ep auth status --json`. If the
   exit code is `2` or the token is `NOT_LOGGED_IN`, ask the user to
   run `ep auth login` themselves (it needs interactive input).
3. **Is there a default bag?** — run
   `ep bags default show --json defaultBagId`. If empty, list the
   user's bags with `ep bags list --json _id,name`, ask them which
   one to use, and set it with `ep bags default set <id>`.

Every `ep` command supports `--json` for machine-readable output and
every error starts with an `UPPER_SNAKE_CASE` token you can
pattern-match on (see `docs/cli-llm-as-caller.md` in the repo for
the full list).

## Creating a flashcard

When the user encounters an unfamiliar word or phrase, you (the
skill, not the server) generate the four card fields directly and
pass them to `ep cards create`. Do not ask the server to generate
them — the CLI has no AI path and the web app's `generateCardDraft`
action is for the web UI only.

### Field rules (mirrors `convex/ai.ts` at 2026-04-11)

- **`answer`** (positional) — the target English word or phrase.
  Keep the form the user will actually study. If the user provided
  the base form but the question reads more naturally with an
  inflected form (`apply` → `applied`), pick the inflected form
  **as the answer** and mention the inflection in the explanation.

- **`--question`** — a fill-in-the-blank example of 1–2 sentences
  with `___` as the only blank. The blank must be the only logical
  completion based on the surrounding text. Keep the language
  simple (CEFR B1–B2). **Vary the speaker's persona significantly**
  — a frustrated mechanic, a hopeful student, a strict grandmother,
  etc. Do not reuse the same persona in a session.

- **`--hint`** — a short definition or synonym under 12 words. Do
  not include the answer itself in the hint.

- **`--explanation`** — 10–70 words total. Specify when the word is
  appropriate (exclude mere situation description). Contrast at
  least two synonyms with nuance, tone, or intensity differences.

### Call shape

```bash
ep cards create "disheartened" \
  --question "I felt ___ after the long rejection letter arrived." \
  --hint "extremely discouraged or low-spirited" \
  --explanation "Stronger than 'sad' but softer than 'devastated'. Use when hope is fading but not extinguished; more formal than 'bummed' and less dramatic than 'crushed'."
```

Pass `--bag <id>` only when the user explicitly names a different
bag. Otherwise rely on the default set above.

On success without `--json` the command prints a short confirmation.
For scripted use add `--json` — success returns
`{"ok": true, "bagId": "...", "question": "...", "answer": "...", "hint": "...", "explanation": "..."}`.

If the call fails with `NOT_LOGGED_IN` or `NO_DEFAULT_BAG`, rerun the
relevant Prerequisites step — do not auto-retry `cards create` on
`NOT_LOGGED_IN`, since only the user can complete `ep auth login`.

## Reviewing flashcards (planned)

The spaced-repetition review loop (`ep review start / reveal / rate`)
is designed in `thoughts/plans/2026-04-11-server-side-review-attempt.md`
but not yet implemented. Until those commands ship, direct the user
to the web app at https://englishpunch.vercel.app/ for review
sessions.

## Conversation style

- Evaluate the user's English on every message (0–100 scale:
  clarity, grammar, naturalness, correctness). Skip the correction
  if the score exceeds 90.
- Offer two rewrites — casual and formal — for the user's own
  sentences, not for the flashcard content you generate.
- Include IPA pronunciation for words the user is likely to
  mispronounce.
- When the user asks to save a word as a card, do not lecture on
  meaning before saving. Generate the card, call `ep cards create`,
  then briefly explain what you captured.

## What this skill deliberately does not do

- **Call any AI action on the server.** Question and explanation
  generation happens in this chat using the rules above. The
  `convex/ai.ts` actions exist for the web app, not for the CLI.
- **Store cards without the user noticing.** Always confirm the card
  was created by printing the question and answer after the mutation
  succeeds.
- **Run interactive prompts in `ep`.** Every command supports
  non-interactive flag-based invocation, which is the only mode this
  skill uses.

## References

- CLI rule set: `docs/cli-llm-as-caller.md`
- `ep` source: https://github.com/englishpunch/english-punch-app/tree/main/cli
- Server-side AI rules we mirror: `convex/ai.ts`
