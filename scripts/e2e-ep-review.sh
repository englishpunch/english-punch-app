#!/usr/bin/env bash
# e2e-ep-review.sh — real end-to-end test of the ep review flow.
#
# Drives a live `ep` binary against the configured Convex deployment
# and verifies every expected happy-path and error-path outcome for
# `ep review start / reveal / rate / status / abort`, plus a sanity
# call to `ep cards create` and `ep cards delete`.
#
# Pinned to a specific user and bag so it never touches a real
# study collection by accident:
#   - the logged-in account MUST match $E2E_USER_EMAIL
#   - the test bag is looked up by name ($E2E_BAG_NAME, default
#     "123") and passed to every command via --bag explicitly,
#     so the user's `default_bag_id` config is neither read nor
#     written by this script.
#
# Preconditions (the script aborts with a clear message if any
# are missing):
#   - `ep` (>= 0.3.1) on PATH or $EP_BIN
#   - logged in as $E2E_USER_EMAIL: `ep auth login ...`
#   - a bag named $E2E_BAG_NAME exists and has at least one due card
#   - jq on PATH
#
# Required env:
#   E2E_USER_EMAIL  the email of the test account (hard-checked)
#
# Optional env:
#   EP_BIN          path to the ep binary (default: `ep` from PATH)
#   E2E_BAG_NAME    name of the test bag (default: "123")
#
# Usage:
#   E2E_USER_EMAIL=test@example.com scripts/e2e-ep-review.sh
#   E2E_USER_EMAIL=… EP_BIN=./cli/dist/ep scripts/e2e-ep-review.sh
#   E2E_USER_EMAIL=… E2E_BAG_NAME=e2e-tests scripts/e2e-ep-review.sh
#
# Side effects on the live deployment:
#   - inserts one new card into the test bag and soft-deletes it at
#     the end of a successful run via `ep cards delete`. If the
#     script aborts mid-run the test card is left behind for
#     inspection (its answer = "e2e_test_<unix-ts>", greppable).
#   - advances one due card from New/Learning to the next FSRS state
#     (the card `ep review start` happens to pick — not necessarily
#     the seeded test card, since the bag may contain older due
#     cards sorted ahead of it).
#   - appends one row to `reviewLogs`.
#   - leaves no `pendingReviews` row behind (cleaned up on exit).

set -euo pipefail

EP=${EP_BIN:-ep}
E2E_BAG_NAME=${E2E_BAG_NAME:-123}

step() { printf "\n==> %s\n" "$*"; }
pass() { printf "  OK  %s\n" "$*"; }
fail() {
  printf "  ERR %s\n" "$*" >&2
  exit 1
}

cleanup() {
  "$EP" review abort >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ─── preflight ────────────────────────────────────────────────────────────

command -v jq >/dev/null 2>&1 || fail "missing dependency: jq"
command -v "$EP" >/dev/null 2>&1 || fail "ep not found (set EP_BIN): $EP"

[[ -n "${E2E_USER_EMAIL:-}" ]] \
  || fail "E2E_USER_EMAIL is not set — refusing to run against an arbitrary account"

step "preflight"
"$EP" --version >/dev/null
pass "ep runs: $("$EP" --version)"

auth_json=$("$EP" auth status --json loggedIn,email)
[[ $(jq -r '.loggedIn' <<<"$auth_json") == "true" ]] \
  || fail "not logged in — run 'ep auth login --email $E2E_USER_EMAIL ...'"
auth_email=$(jq -r '.email' <<<"$auth_json")
[[ "$auth_email" == "$E2E_USER_EMAIL" ]] \
  || fail "logged in as $auth_email, expected $E2E_USER_EMAIL — refusing to run against the wrong account"
pass "authenticated as $auth_email"

bag_id=$("$EP" bags list --json _id,name \
  | jq -r --arg n "$E2E_BAG_NAME" '.[] | select(.name == $n) | ._id' \
  | head -n1)
[[ -n "$bag_id" ]] \
  || fail "no bag named '$E2E_BAG_NAME' found for $auth_email — create one or set E2E_BAG_NAME"
pass "test bag '$E2E_BAG_NAME': $bag_id"

# Clean up any pending row left behind by a previous interrupted run.
cleanup

# ─── seed: create a fresh test card ───────────────────────────────────────
#
# The new card will not necessarily be the one `ep review start` picks
# (the bag already contains older due cards sorted ahead of it) — the
# goal here is just to exercise `ep cards create` in the same script.

step "seed: create a test card"
ts=$(date +%s)
answer="e2e_test_${ts}"
create_json=$("$EP" cards create "$answer" \
  --bag "$bag_id" \
  --question "The e2e harness inserted this card at ___ for a one-shot check." \
  --hint "a placeholder token for an automated test" \
  --explanation "This card is inserted by scripts/e2e-ep-review.sh to verify that ep cards create still round-trips. The answer embeds a Unix timestamp so reruns do not collide on a unique index." \
  --json ok,cardId)
test_card_id=$(jq -r '.cardId' <<<"$create_json")
[[ -n "$test_card_id" && "$test_card_id" != "null" ]] || fail "create did not return a cardId"
pass "created card $test_card_id with answer=$answer"

# ─── happy path ───────────────────────────────────────────────────────────

step "happy path: start → status → reveal → status → reveal (idempotent) → rate → status"

start_json=$("$EP" review start --bag "$bag_id" --json cardId,question)
start_card=$(jq -r '.cardId' <<<"$start_json")
[[ -n "$start_card" && "$start_card" != "null" ]] || fail "start did not return a cardId"
pass "start → $start_card"

status_json=$("$EP" review status --json pending,revealed,cardId)
[[ $(jq -r '.pending'  <<<"$status_json") == "true"  ]] || fail "status should be pending after start"
[[ $(jq -r '.revealed' <<<"$status_json") == "false" ]] || fail "status should be not-revealed after start"
[[ $(jq -r '.cardId'   <<<"$status_json") == "$start_card" ]] || fail "status cardId mismatch"
pass "status: pending=true, revealed=false"

reveal_json=$("$EP" review reveal --json cardId,answer)
[[ $(jq -r '.cardId' <<<"$reveal_json") == "$start_card" ]] || fail "reveal cardId mismatch"
answer_txt=$(jq -r '.answer' <<<"$reveal_json")
[[ -n "$answer_txt" && "$answer_txt" != "null" ]] || fail "reveal returned no answer"
pass "reveal → answer present"

revealed_status=$("$EP" review status --json revealed)
[[ $(jq -r '.revealed' <<<"$revealed_status") == "true" ]] || fail "status should be revealed after reveal"
pass "status: revealed=true"

reveal2_json=$("$EP" review reveal --json cardId,answer)
[[ $(jq -r '.answer' <<<"$reveal2_json") == "$answer_txt" ]] || fail "reveal is not idempotent"
pass "reveal is idempotent"

rate_json=$("$EP" review rate 3 --json nextReviewDate,newState,dueCount)
next_date=$(jq -r '.nextReviewDate' <<<"$rate_json")
new_state=$(jq -r '.newState'       <<<"$rate_json")
[[ -n "$next_date" && "$next_date" != "null" ]] || fail "rate returned no nextReviewDate"
[[ "$new_state" =~ ^[0-9]+$ ]] || fail "rate returned non-numeric newState"
pass "rate 3 → nextReviewDate=$next_date, newState=$new_state"

post_rate_status=$("$EP" review status --json pending)
[[ $(jq -r '.pending' <<<"$post_rate_status") == "false" ]] || fail "status should not be pending after rate"
pass "status: pending=false"

# ─── error paths ──────────────────────────────────────────────────────────

assert_token() {
  local expected=$1 stderr=$2
  echo "$stderr" | head -n1 | grep -q "^${expected}:" \
    || fail "expected token $expected at start of stderr, got: $stderr"
}

step "error: reveal without pending → NO_PENDING_REVIEW"
if err=$("$EP" review reveal 2>&1 >/dev/null); then
  fail "reveal without pending should have failed"
fi
assert_token "NO_PENDING_REVIEW" "$err"
pass "NO_PENDING_REVIEW"

step "error: rate without pending → NO_PENDING_REVIEW"
if err=$("$EP" review rate 3 2>&1 >/dev/null); then
  fail "rate without pending should have failed"
fi
assert_token "NO_PENDING_REVIEW" "$err"
pass "NO_PENDING_REVIEW"

step "error: rate before reveal → REVIEW_NOT_REVEALED"
"$EP" review start --bag "$bag_id" --json cardId >/dev/null
if err=$("$EP" review rate 3 2>&1 >/dev/null); then
  fail "rate before reveal should have failed"
fi
assert_token "REVIEW_NOT_REVEALED" "$err"
pass "REVIEW_NOT_REVEALED"

step "error: start while pending → REVIEW_ALREADY_PENDING"
if err=$("$EP" review start --bag "$bag_id" 2>&1 >/dev/null); then
  fail "start while pending should have failed"
fi
assert_token "REVIEW_ALREADY_PENDING" "$err"
pass "REVIEW_ALREADY_PENDING"

step "abort + idempotency"
abort1=$("$EP" review abort --json ok,existed)
[[ $(jq -r '.existed' <<<"$abort1") == "true" ]] || fail "first abort should have existed=true"
pass "abort 1: existed=true"

abort2=$("$EP" review abort --json ok,existed)
[[ $(jq -r '.existed' <<<"$abort2") == "false" ]] || fail "second abort should have existed=false"
pass "abort 2: existed=false (idempotent)"

step "cleanup: delete the test card"
delete_json=$("$EP" cards delete "$test_card_id" --bag "$bag_id" --json ok,cardId)
[[ $(jq -r '.ok'     <<<"$delete_json") == "true"          ]] || fail "delete should have ok=true"
[[ $(jq -r '.cardId' <<<"$delete_json") == "$test_card_id" ]] || fail "delete cardId mismatch"
pass "deleted test card $test_card_id"

# Idempotent re-delete to lock in the contract.
redelete_json=$("$EP" cards delete "$test_card_id" --bag "$bag_id" --json ok)
[[ $(jq -r '.ok' <<<"$redelete_json") == "true" ]] || fail "re-delete should also succeed"
pass "delete is idempotent"

printf "\nALL CHECKS PASSED\n"
