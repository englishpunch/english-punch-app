#!/usr/bin/env bash
set -euo pipefail

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

run_vibe_rules() {
  npm run vibe-rules
  git diff --exit-code
}

set +e
run_and_capture "lint" npm run lint
run_and_capture "vibe-rules" run_vibe_rules
run_and_capture "knip" npm run knip
run_and_capture "test" env CI=true npm run test
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
