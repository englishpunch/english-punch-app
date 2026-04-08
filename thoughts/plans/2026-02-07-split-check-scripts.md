# npm run check 스크립트 분리: Pre-commit / Post-commit

## Overview

`npm run check`가 staged 변경사항이 있을 때 실패하는 문제를 해결한다. dedupe 체크가 `git diff --exit-code`를 사용하기 때문에 dirty working tree에서 실패한다. AI agent가 커밋 전/후 어떤 명령어를 실행해야 하는지 명확히 구분할 수 있도록 스크립트를 분리한다.

## Current State Analysis

- `npm run check` → `scripts/check-local.sh` (lint + knip + test + dedupe 모두 실행)
- dedupe 체크: `npm dedupe && git diff --exit-code package-lock.json` — clean working tree 필요
- CI(`.github/workflows/check.yml`)도 동일한 4가지 체크를 개별 step으로 실행
- CLAUDE.md 없음 — AI agent를 위한 가이드 부재

### Key Discoveries:
- `scripts/check-local.sh:39` — dedupe 체크가 `git diff --exit-code` 사용
- `package.json:21` — `"check": "./scripts/check-local.sh"`
- `.github/workflows/check.yml:28-33` — CI dedupe step
- Pre-commit hook/Husky 미설정

## Desired End State

- `npm run check` = lint + knip + test만 실행 (staged 변경 있어도 안전)
- `npm run check:all` = lint + knip + test + dedupe (clean tree 필요, CI용)
- CI 워크플로우에 pre/post 구분 반영
- CLAUDE.md에 AI agent용 가이드 추가

### 검증 방법:
1. 파일을 stage한 상태에서 `npm run check` 성공 확인
2. Clean tree에서 `npm run check:all` 성공 확인
3. CI 워크플로우가 모든 체크를 수행하는지 확인

## What We're NOT Doing

- Pre-commit hook (Husky 등) 설정
- 체크 항목 자체의 변경 (lint rule, knip config 등)
- CI 체크 항목 추가/제거

## Implementation Approach

셸 스크립트를 분리하지 않고, 기존 `check-local.sh`에 파라미터를 추가하여 `--all` 옵션으로 dedupe 포함 여부를 제어한다. 스크립트 하나로 관리하는 것이 유지보수에 유리하다.

## Phase 1: check-local.sh 수정 및 package.json 스크립트 추가

### Changes Required:

#### 1. `scripts/check-local.sh` 수정

**File**: `scripts/check-local.sh`
**Changes**: `--all` 플래그 추가. 플래그 없으면 pre-commit 체크만, `--all`이면 dedupe 포함.

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

#### 2. `package.json` scripts 수정

**File**: `package.json`
**Changes**: `check:all` 스크립트 추가

```json
"check": "./scripts/check-local.sh",
"check:all": "./scripts/check-local.sh --all",
```

### Success Criteria:

#### Automated Verification:
- [x] `npm run check` 실행 시 lint, knip, test만 실행되고 dedupe는 건너뜀 확인
- [x] `npm run check:all` 실행 시 lint, knip, test, dedupe 모두 실행 확인
- [x] 파일을 stage한 상태에서 `npm run check` 성공

#### Manual Verification:
- [ ] 스크립트 출력에서 `==> dedupe`가 `check`에서는 안 나오고 `check:all`에서만 나오는지 확인

---

## Phase 2: CI 워크플로우 수정

### Changes Required:

#### 1. `.github/workflows/check.yml` 수정

**File**: `.github/workflows/check.yml`
**Changes**: step에 주석으로 pre/post 구분 추가, 구조적 일관성 유지

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

### Success Criteria:

#### Automated Verification:
- [x] CI YAML 문법 유효성: `yamllint .github/workflows/check.yml` 또는 GitHub Actions 트리거 확인

#### Manual Verification:
- [ ] PR 생성 후 CI가 정상적으로 모든 체크를 실행하는지 확인

---

## Phase 3: CLAUDE.md 추가

### Changes Required:

#### 1. `CLAUDE.md` 생성

**File**: `CLAUDE.md`
**Changes**: AI agent를 위한 프로젝트 가이드 작성. 체크 명령어 구분을 명시.

```markdown
# English Punch App

## Check Commands

- `npm run check` — 커밋 전에 실행. lint + knip + test. Staged 변경이 있어도 안전.
- `npm run check:all` — 커밋 후 또는 clean tree에서 실행. 위 항목 + dedupe 체크 포함. CI에서 실행되는 전체 범위.

### 개별 실행

- `npm run lint` — ESLint
- `npm run knip` — 미사용 코드/의존성 감지
- `npm run test` — Vitest 단위 테스트
```

### Success Criteria:

#### Automated Verification:
- [x] `CLAUDE.md` 파일 존재 확인

#### Manual Verification:
- [ ] AI agent가 `npm run check`와 `npm run check:all`의 차이를 이해하고 적절히 사용하는지 확인

---

## References

- Research: `thoughts/shared/research/2026-02-07-npm-run-check.md`
- `scripts/check-local.sh` — 현재 체크 스크립트
- `.github/workflows/check.yml` — CI 워크플로우
- `package.json:21` — check 스크립트 정의
