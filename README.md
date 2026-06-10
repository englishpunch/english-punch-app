# English Punch

A spaced-repetition app for learning English.

## Overview

English Punch is an English learning app built on the [FSRS (Free Spaced Repetition Scheduler)](https://github.com/open-spaced-repetition/ts-fsrs) algorithm. The name "Punch" reflects the idea of practicing English consistently, like going to a boxing gym every day.

The project includes the web app, the **`ep` CLI**, and an **MCP server**. It is designed so LLM agents such as Claude Code can add cards and run reviews directly from conversation context.

## Card Format

Cards use practical fill-in-the-blank English sentences:

```text
Question: I'd like to ___ a table for two at 7 pm. (book in advance)
Answer: reserve
```

## Project Structure

This is a pnpm workspace monorepo orchestrated with Turborepo.

- **`.` (root)** - web app (Vite + React + TanStack Router + Convex)
- **`cli/`** - `ep` Go CLI (Cobra + Viper + Convex HTTP)
- **`mcp-server/`** - MCP server for Claude Code and other MCP clients

### `ep` CLI

- The primary user is the Claude Code skill; human terminal use is secondary.
- Every command provides a `--json` flag, deterministic error tokens, idempotent behavior, and self-describing `--help` output. See [`docs/cli-llm-as-caller.md`](docs/cli-llm-as-caller.md) for the design principles.
- Homebrew install. The formula lives in this repository's `Formula/` directory, so the tap URL must be explicit:

  ```bash
  brew tap englishpunch/cli https://github.com/englishpunch/english-punch-app
  brew install englishpunch/cli/ep
  ep --version
  ```

### Claude Code Skill

- The `english-punch` skill is a thin public wrapper that documents only the minimum `ep` CLI workflow.
- Command behavior should use the installed CLI help output, `ep --help` and `ep <command> --help`, as the source of truth.
- Learning policy such as card sentence style, vocabulary level, and correction style belongs in user-specific skills or project configuration.
- The skill body is in [`skills/english-punch/SKILL.md`](skills/english-punch/SKILL.md). It can be installed for Claude Code, Cursor, Cline, Continue, and 40+ other agents through the [Vercel Labs `skills` CLI](https://github.com/vercel-labs/skills):

  ```bash
  npx -y skills add englishpunch/english-punch-app --global --yes
  ```

  Flag meanings:

  - `npx -y` automatically accepts the package install prompt for `skills`.
  - `--global` (`-g`) installs the skill at the user level, so it is available in every Claude Code session, not only this project.
  - `--yes` (`-y`) skips confirmation prompts from the `skills` CLI itself.

  After installation, the `english-punch` skill is exposed automatically in Claude Code sessions. No separate registration or API key is required. Run the same command again to update it.

## Tech Stack

### Frontend

- **React 19** + **Vite** - UI and bundling
- **TanStack Router** - type-safe routing
- **Tailwind CSS v4** - styling
- **i18next** - localization

### Backend

- **Convex** - reactive backend platform with realtime database, serverless functions, and WebSocket support
- **@convex-dev/auth** - authentication

### CLI / MCP

- **Go + Cobra + Viper** - `ep` CLI
- **@modelcontextprotocol/sdk** - MCP server

### Learning Algorithm

- **[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** - TypeScript FSRS implementation

### Toolchain

- **pnpm** (required; do not use `npm` or `yarn`) + **Turborepo** - monorepo orchestration
- **Vitest** - unit tests
- **ESLint** + **Prettier** + **Knip**

## Install and Run

```bash
# Clone the repository
git clone git@github.com:englishpunch/english-punch-app.git
cd english-punch-app

# Install dependencies. pnpm is required.
pnpm install

# Start the development servers for the web app and Convex backend.
pnpm run dev
```

## Environment Setup

### 1. Configure Convex

Initialize the Convex development environment:

```bash
npx convex dev
```

This command handles Convex account login and new project creation automatically.

### 2. Configure Environment Variables

Create `.env.local` and set the following value:

```env
# Convex config. Generated automatically when running npx convex dev.
VITE_CONVEX_URL=https://your-project.convex.cloud
```

## Verification Commands

- `pnpm run check` - lint + knip + test; run before committing
- `pnpm run check:all` - the above plus dedupe checks; matches the full CI scope
- `cd cli && ~/go/bin/golangci-lint run` - required before pushing Go CLI changes

## Contributing

Pull requests are welcome. The repository is kept in English so contributors from around the world can participate.

## License

[MIT License](LICENSE)

## References

- [`ep` CLI design principles](docs/cli-llm-as-caller.md)
- [FSRS algorithm overview](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS)
- [ts-fsrs library](https://github.com/open-spaced-repetition/ts-fsrs)
- [Convex docs](https://docs.convex.dev/)
- [Convex Auth guide](https://docs.convex.dev/auth)
