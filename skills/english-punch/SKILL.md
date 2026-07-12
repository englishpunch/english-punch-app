---
name: english-punch
description: Use the English Punch ep CLI from agent workflows; prefer ep help output as the source of truth and keep learning-content policy user-specific.
---

# English Punch Skill

This skill is a thin guide for using `ep`, the English Punch CLI. Treat
the installed CLI help as the source of truth because command behavior
can change independently of this skill.

## Source of Truth

- Run `ep --help` when you need the command map.
- Run `ep <command> --help` or `ep <command> <subcommand> --help` before
  using an unfamiliar command.
- Prefer `--json` with explicit fields for scripted calls. If a command
  supports field discovery, bare `--json` prints the available fields.
- Match errors by their leading `UPPER_SNAKE_CASE` token.

## Setup Checks

Before using card, bag, or review commands:

1. Check the CLI:
   ```bash
   ep --version
   ```
   If it is missing:
   ```bash
   brew tap englishpunch/cli https://github.com/englishpunch/english-punch-app
   brew install englishpunch/cli/ep
   ```

2. Check login state:
   ```bash
   ep auth status --json loggedIn,email,convexUrl
   ```
   If the user is not logged in, ask them to run `ep auth login`
   themselves.

3. For card-scoped commands, check the default bag:
   ```bash
   ep bags default show --json defaultBagId
   ```
   If it is empty, list bags and ask which one to use:
   ```bash
   ep bags list --json _id,name
   ep bags default set <bag-id>
   ```

## Common Flows

- For bags, start with `ep bags --help`.
- For cards, start with `ep cards --help`.
- For auth/config/diagnostics, start with `ep auth --help`,
  `ep config --help`, and `ep doctor --help`.
- For review sessions, start with `ep review --help`. If the installed
  CLI does not support the requested review workflow, direct the user to
  the web app at `https://englishpunch.vercel.app/`.

Use mutations such as create, replace, delete, reserve, or rate only
after the user clearly asks for that change. Inspect existing data with
list/get-style commands before modifying it when that reduces ambiguity.

## Content Policy

The CLI stores caller-provided card content; it does not define the
user's learning style. Do not bake a specific question-writing style,
vocabulary level, collocation policy, correction style, or tutoring
persona into this repo skill. Use the user's explicit request or their
personal/project-specific skill for learning-content policy.

Do not call English Punch server-side AI actions directly from this
skill. Use the public `ep` commands exposed by the CLI.
