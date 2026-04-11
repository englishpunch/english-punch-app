---
date: 2026-04-11
author: claude
status: draft
topic: `english-punch` Claude Code skill — content design and delivery via the Vercel Labs `skills` CLI
---

# English Punch Claude Code skill

## Overview

Ship the English Punch Claude Code skill as `skills/english-punch/SKILL.md` at the repo root. Users install it with:

```bash
npx skills add englishpunch/english-punch-app
```

The [Vercel Labs `skills` CLI](https://github.com/vercel-labs/skills) handles discovery, installation, and uninstallation across 40+ AI coding agents (Claude Code, Cursor, Cline, Continue, GitHub Copilot, Windsurf, …). We write zero Go or TypeScript — the file is plain markdown with YAML frontmatter.

**This plan is about the content, not the plumbing.** The plumbing is an off-the-shelf CLI from Vercel Labs. The Homebrew formula only needs a one-line `caveats` update.

## Motivation

- The earlier `thoughts/plans/2026-04-11-ep-skill-install.md` planned an embedded `ep skill install/uninstall/status` command tree. That was ~800 lines of Go we would have had to write and maintain.
- Vercel Labs ships `skills` — a CLI that does exactly that install/uninstall/discovery job — for free, across every agent tool. Writing our own is duplicated work.
- The `skills` CLI expects `SKILL.md` files at conventional repo locations (root, `skills/`, `skills/.curated/`, etc.). Putting the file at `skills/english-punch/SKILL.md` satisfies the convention and makes the file easy to find for human contributors.
- The actual value of English Punch is the **loop prompt**, not the installer. Writing a thoughtful skill file is the work that matters.

## Scope

### In scope

- **File location**: `skills/english-punch/SKILL.md` at the repo root so `npx skills add englishpunch/english-punch-app` finds it automatically.
- **Frontmatter**: `name`, `description` (required by `skills` CLI).
- **Prerequisites section**: how the skill checks `ep` installation, login state, and default bag before doing anything.
- **Card-creation flow**: how the skill generates `--question`, `--hint`, `--explanation` in-chat and calls `ep cards create`, mirroring the rules in `convex/ai.ts`.
- **Error token handling**: a table mapping every error token the skill may receive to a user-visible recovery step.
- **Conversation-style notes**: English scoring, two-version rewrites, IPA, when to correct.
- **Delete `thoughts/plans/2026-04-11-ep-skill-install.md`** — superseded by this plan.
- **Flag the Homebrew caveats update** as a follow-up (separate repo).

### Out of scope

- **The review loop.** `ep review start/reveal/rate` is designed in `2026-04-11-server-side-review-attempt.md` but not implemented. The skill points users at the web app for review until those commands ship.
- **Server-side AI changes.** `convex/ai.ts` continues to exist for the web app.
- **A native `ep skill` command tree.** Deleted from scope — `skills` CLI handles installation.
- **Cross-tool testing.** `skills` CLI claims Claude Code / Cursor / Cline / 40+ work out of the box; we verify Claude Code only in v1.
- **Skill content updates via `ep`.** Users re-run `npx skills add englishpunch/english-punch-app` to get updates. No `ep skill update` needed.

## Delivery mechanism

Users install:

```bash
npx skills add englishpunch/english-punch-app
```

This copies `skills/english-punch/SKILL.md` from the repo into the user's `~/.claude/skills/english-punch/` (global) or `./.claude/skills/english-punch/` (project-scoped). The `skills` CLI prompts the user to pick which agents to install to when multiple are detected.

**Users uninstall**: `skills` supports a remove command (verify exact flag in its docs), or the user deletes the directory directly.

**Users update**: re-run `npx skills add englishpunch/english-punch-app` after `brew upgrade ep` (or any pull). The `skills` CLI overwrites the installed copy.

## File structure

```
english-punch-app/
├── skills/
│   └── english-punch/
│       └── SKILL.md          # ← the content
├── cli/                       # Go CLI, unchanged
├── convex/                    # Backend, unchanged
└── thoughts/
    └── plans/
        └── 2026-04-11-english-punch-skill-content.md  # ← this plan
```

## SKILL.md content outline

Already drafted in `skills/english-punch/SKILL.md`. Section-by-section:

### Frontmatter

```yaml
---
name: english-punch
description: English learning loop driven by the ep CLI. …
---
```

### Body sections

1. **Overview** — one paragraph on what the skill does and why it exists.
2. **When to use this skill** — trigger conditions so Claude Code knows when to activate it.
3. **Prerequisites** — how to check `ep` installation, login, and default bag. Explicit about which errors require the user to act (interactive login) vs. which Claude can handle (bag selection flow).
4. **Creating a flashcard** — the core flow.
   - **Field rules** mirroring `convex/ai.ts`: CEFR B1–B2 vocabulary, fill-in-the-blank with `___`, diverse personas, hint under 12 words, explanation 10–70 words with synonym contrast.
   - **Call shape** with a concrete example (`disheartened`).
   - **Error tokens table** — mapping of every token the skill may receive to a recovery step.
5. **Reviewing flashcards (planned)** — forward pointer to the review-attempt plan, with a fallback to the web app.
6. **Conversation style** — English scoring, casual/formal rewrites, IPA, no lecturing before saving a card.
7. **What this skill deliberately does not do** — an explicit non-goals list (no server-side AI calls, no silent saves, no interactive prompts in `ep`).
8. **References** — links to `docs/cli-llm-as-caller.md`, the GitHub repo, and `convex/ai.ts`.

## Prompt drift between SKILL.md and `convex/ai.ts`

The question-generation rules in `SKILL.md` are copied from `convex/ai.ts` at the time of writing (2026-04-11). The two will drift over time — the web app's server-side rules are the source of truth for the web app; the skill's copy is the source of truth for CLI-initiated card creation.

**Decision**: accept the drift for v1. Revisit if we ship a third caller with its own copy, at which point the rules should move to a shared location (e.g., `docs/card-content-rules.md`) that both the server and the skill reference.

**Mitigation**: the SKILL.md body includes a dated note "mirrors `convex/ai.ts` at 2026-04-11" so future editors know where to re-sync.

## Homebrew caveats update (follow-up, separate repo)

Update the ep formula in `echoja/homebrew-tap`:

```ruby
def caveats
  <<~EOS
    English Punch Claude Code skill:
      npx skills add englishpunch/english-punch-app

    Requires Node.js. See https://github.com/vercel-labs/skills
    for details and alternative agents (Cursor, Cline, …).
  EOS
end
```

**Not done in this plan** — the formula lives in the `echoja/homebrew-tap` repo. Flagged here so it is not forgotten when the next ep release cuts.

## Verification

After writing `SKILL.md`, smoke-test the install flow on your own machine:

```bash
# From a fresh machine (or a different user)
npx skills add englishpunch/english-punch-app

# Verify it landed
ls ~/.claude/skills/english-punch/SKILL.md

# Start a new Claude Code session, mention a word you don't know,
# confirm the skill activates and walks through the create flow.
```

There is no unit test for this — it is a markdown file. Review happens on human read-through.

## Files touched

### New

- `skills/english-punch/SKILL.md` — the skill content
- `thoughts/plans/2026-04-11-english-punch-skill-content.md` — this plan

### Deleted

- `thoughts/plans/2026-04-11-ep-skill-install.md` — superseded

### Unchanged

- Everything in `cli/`, `convex/`, and the rest of the repo

## Open questions

1. **Should the skill include a "migration log" section pointing at when `convex/ai.ts` was last synced?** Current plan: yes, via a short dated note inside the field-rules subsection. Makes drift visible without forcing a sync tool.
2. **Should the skill expose any hidden state beyond what `ep` returns?** For example, "remember the last bag the user selected in this chat" so Claude does not have to re-ask. Current plan: no — rely on `ep bags default set` which is already persistent at the CLI level.
3. **Do we want a separate `skills/english-punch-review/SKILL.md` for the review loop?** Maybe later. For v1 the single skill file covers both "create cards" and "point at the web app for review" without splitting.

## Implementation order

1. Write `skills/english-punch/SKILL.md` with the outline above. (Done — file already created alongside this plan.)
2. Delete `thoughts/plans/2026-04-11-ep-skill-install.md`. (Done.)
3. Write this plan doc (`2026-04-11-english-punch-skill-content.md`). (Done.)
4. Commit and push all three changes as a single atomic commit.
5. Follow-up (separate repo): update `echoja/homebrew-tap` caveats to recommend `npx skills add englishpunch/english-punch-app`. Not part of this commit.
6. After commit + push, run `npx skills add englishpunch/english-punch-app` locally to verify the skill appears at `~/.claude/skills/english-punch/SKILL.md`.
7. Iterate on content based on real usage — this plan is version 0, not final.
