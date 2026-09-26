#!/usr/bin/env bash
set -euo pipefail

latest_tag="$(gh release view --repo englishpunch/english-punch-app --json tagName --jq .tagName)"
latest_version="${latest_tag#v}"
echo "Latest release: $latest_tag"

ep_path="$(command -v ep || true)"
if [[ -z "$ep_path" ]]; then
  echo "Verification failed: ep is not installed on PATH." >&2
  exit 1
fi

echo "Executable: $ep_path"
installed_output="$("$ep_path" --version)"
echo "Installed: $installed_output"
if [[ "$installed_output" != "ep version $latest_version" ]]; then
  echo "Verification failed: the ep executable on PATH does not match the latest release." >&2
  exit 1
fi

echo "Verified: the ep executable on PATH matches the latest release."
