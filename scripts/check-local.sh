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
pnpm install --frozen-lockfile

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
run_and_capture "lint" pnpm run lint
run_and_capture "knip" pnpm run knip
run_and_capture "test" env CI=true pnpm run test

# --- Post-commit checks (require clean working tree) ---
if [[ "${run_all}" == "true" ]]; then
  run_and_capture "dedupe" bash -c "pnpm dedupe && git diff --exit-code pnpm-lock.yaml"
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
