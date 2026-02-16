#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only lint ts/tsx/js/jsx files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

OUTPUT=$(npx eslint "$FILE_PATH" 2>&1)
if [ $? -ne 0 ]; then
  echo "$OUTPUT" >&2
  exit 2
fi

exit 0
