---
date: 2026-02-07
author: claude
status: completed
topic: Split npm run check into pre-commit and post-commit scripts
---

# Split npm run check: Pre-commit / Post-commit

## Overview

Fix the problem where `npm run check` fails when staged changes exist. The dedupe check uses `git diff --exit-code`, so it fails in a dirty working tree. Split the workflow so AI agents can clearly choose the right command before and after committing.

## Current State Analysis

- `npm run check` runs `scripts/check-local.sh`, which runs lint + knip + test + dedupe.
- Dedupe check: `npm dedupe && git diff --exit-code package-lock.json`; this requires a clean working tree.
- CI (`.github/workflows/check.yml`) also runs the same four checks as separate steps.
- There is no `CLAUDE.md`, so AI agents do not have project-specific guidance.

### Key Discoveries

- `scripts/check-local.sh:39` uses `git diff --exit-code` for dedupe.
- `package.json:21` defines `"check": "./scripts/check-local.sh"`.
- `.github/workflows/check.yml:28-33` defines the CI dedupe step.
- No pre-commit hook or Husky setup exists.

## Desired End State

- `npm run check` runs only lint + knip + test and is safe with staged changes.
- `npm run check:all` runs lint + knip + test + dedupe and is intended for a clean tree or CI.
- CI documents the pre/post distinction while still running the full set.
- `CLAUDE.md` documents the commands for AI agents.

### Verification

1. Confirm `npm run check` succeeds when files are staged.
2. Confirm `npm run check:all` succeeds from a clean tree.
3. Confirm CI still runs every check.

## What We're Not Doing

- Adding a pre-commit hook such as Husky.
- Changing the checks themselves, such as lint rules or knip config.
- Adding or removing CI check categories.

## Implementation Approach

Do not split the shell script into separate files. Add a parameter to the existing `check-local.sh` and use a `--all` option to control whether dedupe runs. Keeping one script is easier to maintain.

## Phase 1: Update check-local.sh and package.json

### Changes Required

#### 1. Update `scripts/check-local.sh`

**File**: `scripts/check-local.sh`
**Changes**: Add a `--all` flag. Without the flag, run only pre-commit checks. With `--all`, include dedupe.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Parse flags
run_all=false
for arg in "$@"; do
  case "${arg}" in
    --all) run_all=true ;;
    *) echo "Unknown option: ${arg}" >&2; exit 1 ;;
  esac
done

corepack enable

if command -v node >/dev/null 2>&1; then
  node_version="$(node -p "process.versions.node" 2>/dev/null || true)"
  if [[ -n "${node_version}" ]]; then
    node_major="${node_version%%.*}"
    if [[ "${node_major}" != "24" ]]; then
      echo "Warning: CI uses Node.js 24.x; local is ${node_version}" >&2
    fi
  fi
fi

echo "==> Install dependencies"
npm ci

failures=()

run_and_capture() {
  local name="$1"
  shift
  local display="$*"

  echo "==> ${name}"
  "$@"
  local status=$?
  if [[ "${status}" -ne 0 ]]; then
    failures+=("${name}"$'\t'"${display}")
  fi
  return 0
}

set +e

# --- Pre-commit checks (safe with staged changes) ---
run_and_capture "lint" npm run lint
run_and_capture "knip" npm run knip
run_and_capture "test" env CI=true npm run test

# --- Post-commit checks (require clean working tree) ---
if [[ "${run_all}" == "true" ]]; then
  run_and_capture "dedupe" bash -c "npm dedupe && git diff --exit-code package-lock.json"
fi

set -e

if [[ "${#failures[@]}" -ne 0 ]]; then
  echo ""
  echo "Some checks failed:"
  for entry in "${failures[@]}"; do
    IFS=$'\t' read -r step_name step_command <<< "${entry}"
    if [[ -n "${step_command}" ]]; then
      echo " - ${step_name}: ${step_command}"
    else
      echo " - ${step_name}"
    fi
  done
  exit 1
fi

echo "All checks passed."
```

#### 2. Update package.json scripts

**File**: `package.json`
**Changes**: Add a `check:all` script.

```json
"check": "./scripts/check-local.sh",
"check:all": "./scripts/check-local.sh --all"
```

### Success Criteria

#### Automated Verification

- [x] `npm run check` runs lint, knip, and test, and skips dedupe.
- [x] `npm run check:all` runs lint, knip, test, and dedupe.
- [x] `npm run check` succeeds with a staged file.

#### Manual Verification

- [ ] Confirm the output includes `==> dedupe` only for `check:all`, not for `check`.

---

## Phase 2: Update CI Workflow

### Changes Required

#### 1. Update `.github/workflows/check.yml`

**File**: `.github/workflows/check.yml`
**Changes**: Add comments that mark pre-commit and post-commit groups while preserving the existing structure.

```yaml
      # --- Pre-commit checks (safe with staged changes) ---
      - name: Lint
        id: lint
        run: npm run lint
        continue-on-error: true

      - name: Knip (dead code/deps)
        id: knip
        run: npm run knip
        continue-on-error: true

      - name: Test
        id: test
        env:
          CI: true
        run: npm run test
        continue-on-error: true

      # --- Post-commit checks (require clean working tree) ---
      - name: package dedupe
        id: dedupe
        run: |
          npm dedupe
          git diff --exit-code
        continue-on-error: true
```

### Success Criteria

#### Automated Verification

- [x] CI YAML syntax is valid, either through `yamllint .github/workflows/check.yml` or a GitHub Actions trigger.

#### Manual Verification

- [ ] After opening a PR, confirm CI runs all checks normally.

---

## Phase 3: Add CLAUDE.md

### Changes Required

#### 1. Create `CLAUDE.md`

**File**: `CLAUDE.md`
**Changes**: Add project guidance for AI agents and document the distinction between check commands.

```markdown
# English Punch App

## Check Commands

- `npm run check` - run before committing. It runs lint + knip + test and is safe with staged changes.
- `npm run check:all` - run after committing or from a clean tree. It includes the above checks plus dedupe and matches the full CI scope.

### Individual Commands

- `npm run lint` - ESLint
- `npm run knip` - detect unused code and dependencies
- `npm run test` - Vitest unit tests
```

### Success Criteria

#### Automated Verification

- [x] `CLAUDE.md` exists.

#### Manual Verification

- [ ] Confirm AI agents understand the difference between `npm run check` and `npm run check:all` and use them appropriately.

---

## References

- Research: `thoughts/shared/research/2026-02-07-npm-run-check.md`
- `scripts/check-local.sh` - current check script
- `.github/workflows/check.yml` - CI workflow
- `package.json:21` - check script definition
