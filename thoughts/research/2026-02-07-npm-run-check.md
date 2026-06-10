---
date: 2026-02-07T00:00:00+09:00
researcher: th.kim
git_commit: 67a4dd0ea032f965964aafae2d7609b76e0b717c
branch: main
repository: english-punch-app
topic: "npm run check script structure and related settings"
tags: [research, codebase, check, lint, knip, vitest, ci, dedupe]
status: complete
last_updated: 2026-02-07
last_updated_by: th.kim
---

# Research: npm run check

**Date**: 2026-02-07
**Git Commit**: 67a4dd0ea032f965964aafae2d7609b76e0b717c
**Branch**: main
**Repository**: english-punch-app

## Research Question

What does `npm run check` execute, and how are the related settings and CI pipeline configured?

## Summary

`npm run check` executes the `scripts/check-local.sh` shell script. The script runs four checks in sequence: **lint**, **knip**, **test**, and **dedupe**. All checks continue even if one fails, and failures are summarized at the end. The GitHub Actions CI workflow (`.github/workflows/check.yml`) runs the same four checks.

## Detailed Findings

### 1. check-local.sh Script (`scripts/check-local.sh`)

Entry point: `package.json:21` -> `"check": "./scripts/check-local.sh"`

#### Preprocessing (lines 1-17)

- `set -euo pipefail` ensures safer shell execution.
- `corepack enable` pins the package manager version (`npm@11.6.2`, `package.json:85`).
- A warning is printed when the local Node.js version is not 24.x, nudging developers toward the CI version.
- `npm ci` performs a clean install.

#### Check Execution (lines 19-40)

The `run_and_capture` helper executes each check and records failures in the `failures` array.

| Order | Name | Command |
|------|------|---------|
| 1 | lint | `npm run lint` |
| 2 | knip | `npm run knip` |
| 3 | test | `CI=true npm run test` |
| 4 | dedupe | `npm dedupe && git diff --exit-code package-lock.json` |

The script uses `set +e` so it can keep running after a command fails. After all checks finish, it prints the failure list and exits with `1` if any check failed.

---

### 2. Lint (`eslint.config.js`)

Command: `eslint src convex` (`package.json:13`)

#### Target Files

- All TypeScript/TSX files: `**/*.{ts,tsx}`
- Excludes: `dist`, `convex/_generated`, `eslint.config.js`, `postcss.config.js`, `tailwind.config.js`, `vite.config.ts`

#### Plugins

- `@eslint/js` - recommended JavaScript rules
- `typescript-eslint` (`recommendedTypeChecked`) - TypeScript rules with type checking
- `eslint-plugin-react-hooks` - React Hooks rules
- `eslint-plugin-react-refresh` - HMR-related rules
- `eslint-plugin-prettier` - Prettier integration
- `@convex-dev/eslint-plugin` - Convex-specific rules

#### Key Custom Rules

- `@typescript-eslint/no-unused-vars`: warn, ignoring names with `_` prefix
- `@typescript-eslint/ban-ts-comment`: error
- `@typescript-eslint/no-explicit-any`: off, allowing explicit `any`
- `no-restricted-syntax`: blocks `as any` casts with error severity
- `@typescript-eslint/no-unsafe-*`: all off, allowing implicit unsafe `any` patterns
- `@typescript-eslint/require-await`: off for Convex handler compatibility
- `curly`: error, requiring braces for control statements

#### Test File Override (`eslint.config.js:93-110`)

- Applies to `**/*.test.{ts,tsx}`
- Adds Vitest globals

#### tsconfig References for Type Checking

- `tsconfig.node.json`
- `tsconfig.app.json`
- `convex/tsconfig.json`

---

### 3. Knip (`knip.jsonc`)

Command: `knip` (`package.json:19`)

Knip detects unused files, dependencies, and exports.

#### Entry Points

- `src/main.tsx` - app entry point
- `src/scripts/changePassword.ts` - password-change script
- `convex/http.ts` - Convex HTTP endpoints
- `convex/auth.ts` - Convex auth configuration
- `setup.mjs` - project setup script
- `src/lib/deeplink.ts` - deeplink handling
- `src/lib/tauri.ts` - Tauri platform integration
- `src/routes/__root.tsx` - TanStack Router root route

#### Analysis Targets

- `src/**/*.{ts,tsx}`
- `convex/**/*.{ts,tsx}`

#### Exclusions

- Directories: `convex/_generated/**`, `src-tauri/target/**`, `dist/**`, `coverage/**`
- File: `src/routeTree.gen.ts`, which is generated

#### Ignored Dependencies

- `@fabianlars/tauri-plugin-oauth`, used from Rust
- `es-toolkit`
- `tailwindcss`, used through CSS imports
- `@testing-library/*`, used by test utilities

#### Other Settings

- `paths`: `@/*` -> `src/*` to match the Vite alias
- `includeEntryExports`: false

---

### 4. Test (`vitest`)

Command: `vitest run` (`package.json:15`), executed with `CI=true` from check-local.sh.

#### Config (`vite.config.ts:51-59`)

- `globals: true` - global test APIs such as describe, it, and expect
- `environment: "happy-dom"` - DOM simulation
- `setupFiles: "./src/setupTests.ts"` - test setup
- `coverage.provider: "v8"`, `coverage.reporter: ["text", "lcov"]`

#### Setup File (`src/setupTests.ts`)

- Imports `@testing-library/jest-dom/vitest` to enable DOM matchers such as `toBeInTheDocument()`.

#### Test Files, 3 Total

- `src/lib/utils.test.ts` - tests the `cn` utility function, 2 test cases
- `src/scripts/changePassword.test.ts` - tests the password-change script, 4 test cases
- `convex/fsrs.elapsed-days.test.ts` - tests FSRS elapsed-day tracking, 2 test cases

Test files are colocated next to source files rather than placed in a separate directory.

#### Test Dependencies

- `vitest` ^4.0.14
- `@vitest/coverage-v8` ^4.0.14
- `@testing-library/jest-dom` ^6.9.1
- `@testing-library/react` ^16.3.0
- `@testing-library/user-event` ^14.6.1
- `happy-dom` ^20.0.11

---

### 5. Dedupe

Command: `npm dedupe && git diff --exit-code package-lock.json`

Runs `npm dedupe` to flatten duplicate dependencies, then fails if `package-lock.json` changes. This verifies that dependencies are already deduped.

---

### 6. CI Workflow (`.github/workflows/check.yml`)

#### Triggers

- Pushes to `main`
- All pull requests

#### Environment

- `ubuntu-latest`
- Node.js 24
- npm cache

#### Check Steps, Each With `continue-on-error: true`

| Order | Name | Command |
|------|------|---------|
| 1 | Lint | `npm run lint` |
| 2 | Dedupe | `npm dedupe && git diff --exit-code` |
| 3 | Knip | `npm run knip` |
| 4 | Test | `CI=true npm run test` |

#### Failure Handling (lines 47-88)

- Collects each step's outcome.
- Emits failures as `::error::` annotations.
- Writes a failure summary to `$GITHUB_STEP_SUMMARY`.
- Exits with `1` if any step failed.

---

## CI vs Local Comparison

| Item | Local (`check-local.sh`) | CI (`check.yml`) |
|------|--------------------------|------------------|
| Execution order | lint -> knip -> test -> dedupe | lint -> dedupe -> knip -> test |
| Dedupe diff scope | `package-lock.json` only | full `git diff --exit-code` |
| Node.js setup | corepack + version warning | actions/setup-node@v4, 24.x |
| Failure handling | bash array + summary output | `continue-on-error` + step summary |
| Dependency install | `npm ci` | `npm ci` |

No pre-commit hook or Husky setup is configured. `.git/hooks/` only contains sample files.

## Code References

- `package.json:21` - check script definition
- `scripts/check-local.sh` - full local check script
- `eslint.config.js` - full ESLint configuration
- `knip.jsonc` - full Knip configuration
- `vite.config.ts:51-59` - Vitest test configuration
- `src/setupTests.ts` - test setup file
- `.github/workflows/check.yml` - CI workflow

## Architecture Documentation

- **Check execution pattern**: Local and CI both run all checks to completion, then summarize failures.
- **Toolchain**: ESLint for code quality/style -> Knip for unused code detection -> Vitest for unit tests -> npm dedupe for dependency cleanup verification.
- **Type checking**: `npm run check` does not include a separate `tsc` step. ESLint uses `recommendedTypeChecked`, so type-aware lint rules still apply. Full type checking happens through `npm run build` (`tsc && vite build`).
