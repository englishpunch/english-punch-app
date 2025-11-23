# Repository Guidelines

## Project Structure & Module Organization
UI code lives in `src/`: screens and atoms in `src/components`, shared logic in `src/lib`, and fonts plus other static bundles under `src/assets`. Convex server actions and schemas sit in `convex/`; generated bindings in `convex/_generated` are overwritten by the Convex CLI and should stay untouched. Desktop wrappers, Rust plugins, and capability manifests belong to `src-tauri/`, with shared reference material in `docs/` and deployable assets in `public/`; keep new feature folders self-contained like the existing FSRS modules.

## Build, Test, and Development Commands
- `npm run dev`: start Vite UI + Convex dev servers.
- `npm run dev:frontend` / `npm run dev:backend`: run the UI or Convex watcher alone.
- `npm run build`: type-check then bundle for production.
- `npm run preview`: serve `dist/` for smoke testing.
- `npm run lint`: ESLint across frontend + Convex code.
- `npm run tauri dev`: desktop shell after a successful web build.

## Coding Style & Naming Conventions
Favor TypeScript functional components in PascalCase files, with hooks/utilities in camelCase. Tailwind v4 utilities are the primary styling surface; compose conditional classes with `clsx`/`tailwind-merge`. Keep indentation at 2 spaces, order imports libs → shared → local, and format via Prettier 3 (`npx prettier --write "src/**/*.ts?(x)"`). ESLint (see `eslint.config.js`) allows `_`-prefixed unused variables but errors on `// @ts-ignore`, so address the underlying types.

## Testing Guidelines
Automated tests are not wired yet. Until Vitest or Convex test helpers are added, describe manual checks in every PR (auth flow, spaced-repetition queue updates, vocabulary CRUD, and Tauri shell when touched) and keep `npm run dev` running long enough to confirm schema updates. When tests arrive, co-locate `*.test.ts[x]`, mock Convex dependencies, and target smoke coverage for every new hook or mutation before merging.

## Commit & Pull Request Guidelines
Commits follow the Korean Conventional Commits profile in `docs/git-commit-guildelines.md`: `<type>(<scope>): <description>` (e.g., `feat(fsrs): 덱 통계 시스템 구현`). Use scoped, present-tense descriptions and keep commits reviewable. Pull requests need a summary, linked issue, manual test notes, UI screenshots or recordings, and any Convex or env updates; request review only after `npm run lint` passes.

## Security & Configuration Tips
Start from `.env.example`, keep real Convex deployment IDs and OAuth secrets in local `.env` or `.env.local`, and never commit them. Call out changes to Tauri capabilities or `convex/auth.config.ts`, and only commit `convex/_generated` updates when they stem from an intentional schema migration.
