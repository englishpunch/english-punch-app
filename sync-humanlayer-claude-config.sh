#!/bin/bash
# humanlayer/humanlayer 레포의 .claude 폴더를 로컬로 동기화
# 기존 로컬 전용 파일은 삭제하지 않음

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

# 루트 파일 동기화
for item in $(gh api "repos/$REPO/contents/$BASE" --jq '.[] | select(.type=="file") | .name'); do
  sync_file "$BASE/$item" "$BASE/$item"
done

# 하위 디렉토리 동기화
for dir in $(gh api "repos/$REPO/contents/$BASE" --jq '.[] | select(.type=="dir") | .name'); do
  sync_dir "$dir"
done

echo "=== Done ==="
