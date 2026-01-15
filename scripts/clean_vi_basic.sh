#!/bin/bash
set -e

INPUT="$1"
OUTPUT="$2"

cat "$INPUT" \
| sed 's/\r//g' \
| sed 's/[[:space:]]\+/ /g' \
| sed 's/^[[:space:]]*//' \
| sed 's/[[:space:]]*$//' \
| sed '/^$/d' \
> "$OUTPUT"