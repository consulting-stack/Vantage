#!/bin/sh
# Regenerates assets/portfolio/files.js from the actual work-*.jpg files.
# Run from repo root after adding or removing photos:
#   sh scripts/gen-portfolio-files.sh
set -e
DIR="assets/portfolio"
OUT="$DIR/files.js"

printf 'window.CIS_PORTFOLIO_FILES = [\n' > "$OUT"
for f in "$DIR"/work-*.jpg; do
  [ -f "$f" ] || continue
  printf '  "%s",\n' "$(basename "$f")" >> "$OUT"
done
printf '];\n' >> "$OUT"

COUNT=$(grep -c '"' "$OUT")
echo "Wrote $OUT with $COUNT files."
