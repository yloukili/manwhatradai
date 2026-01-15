#!/usr/bin/env bash
# Extract clean text lines from WikiExtractor JSON output
# Usage: extract_wiki_text.sh < input.jsonl > output.txt

set -euo pipefail

MIN_LEN=20

jq -r '
  .text // empty
' \
| tr '\r' '\n' \
| sed 's/^[[:space:]]\+//; s/[[:space:]]\+$//' \
| awk -v minlen="$MIN_LEN" 'length($0) >= minlen'