#!/bin/bash
# Sync the .claude folder from the humanlayer/humanlayer repository locally.
# Do not delete existing local-only files.

REPO="humanlayer/humanlayer"
BASE=".claude"

sync_file() {
  local remote_path="$1"
  local local_path="$2"
  echo ">>> Syncing $local_path"
  gh api "repos/$REPO/contents/$remote_path" --jq '.content' | base64 -d > "$local_path"
}

sync_dir() {
  local dir="$1"
  mkdir -p "$BASE/$dir"
  for f in $(gh api "repos/$REPO/contents/$BASE/$dir" --jq '.[].name'); do
    sync_file "$BASE/$dir/$f" "$BASE/$dir/$f"
  done
}

# Sync root files, excluding settings.json.
for item in $(gh api "repos/$REPO/contents/$BASE" --jq '.[] | select(.type=="file") | select(.name!="settings.json") | .name'); do
  sync_file "$BASE/$item" "$BASE/$item"
done

# Sync subdirectories.
for dir in $(gh api "repos/$REPO/contents/$BASE" --jq '.[] | select(.type=="dir") | .name'); do
  sync_dir "$dir"
done

echo "=== Done ==="
