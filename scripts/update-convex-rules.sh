#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_URL="${CONVEX_RULES_URL:-https://convex.link/convex_rules.mdc}"
TARGET_FILE="${ROOT_DIR}/docs/convex_rules.mdc"
META_FILE="${ROOT_DIR}/docs/convex_rules.meta.json"
MAX_AGE_DAYS="${CONVEX_RULES_MAX_AGE_DAYS:-7}"
FORCE=false

for arg in "$@"; do
  case "${arg}" in
    --force) FORCE=true ;;
    *) echo "Unknown option: ${arg}" >&2; exit 1 ;;
  esac
done

age_days() {
  node - "${META_FILE}" <<'NODE'
const fs = require("fs");

const metaPath = process.argv[2];
try {
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const updatedAt = new Date(meta.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    console.log("999999");
    process.exit(0);
  }
  const ageMs = Date.now() - updatedAt.getTime();
  console.log(Math.floor(ageMs / (24 * 60 * 60 * 1000)));
} catch {
  console.log("999999");
}
NODE
}

if [[ "${FORCE}" != "true" && -f "${TARGET_FILE}" && -f "${META_FILE}" ]]; then
  current_age_days="$(age_days)"
  if [[ "${current_age_days}" -lt "${MAX_AGE_DAYS}" ]]; then
    echo "Convex rules are fresh (${current_age_days}d old, threshold ${MAX_AGE_DAYS}d)."
    exit 0
  fi
fi

tmp_file="$(mktemp)"
cleanup() {
  rm -f "${tmp_file}"
}
trap cleanup EXIT

curl -fsSL "${SOURCE_URL}" -o "${tmp_file}"
test -s "${tmp_file}"
mv "${tmp_file}" "${TARGET_FILE}"

sha256="$(shasum -a 256 "${TARGET_FILE}" | awk '{print $1}')"
updated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

node - "${META_FILE}" "${SOURCE_URL}" "${updated_at}" "${MAX_AGE_DAYS}" "${sha256}" <<'NODE'
const fs = require("fs");

const [metaPath, sourceUrl, updatedAt, maxAgeDays, sha256] = process.argv.slice(2);
const meta = {
  sourceUrl,
  updatedAt,
  maxAgeDays: Number(maxAgeDays),
  sha256,
};

fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
NODE

echo "Updated docs/convex_rules.mdc from ${SOURCE_URL}"
echo "Updated at ${updated_at}"
