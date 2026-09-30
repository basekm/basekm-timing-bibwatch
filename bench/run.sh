#!/usr/bin/env bash
# Accuracy benchmark: scans two hand-checked Chubb clips both ways (whole frame, people only)
# and scores them against bench/keys. Frame reads are reused between runs with the same
# settings, so after a change to how sightings are decided this takes seconds; after a change
# to how frames are read, pass --fresh (about 5 minutes).
#
#   bench/run.sh [--fresh]
#
# Videos (not in the repo): set CHUBB_TRIMMED and GX021737 if they aren't at the paths below.
set -euo pipefail
cd "$(dirname "$0")/.."
CHUBB_TRIMMED=${CHUBB_TRIMMED:-"$HOME/Desktop/Run Fur Fun Year 4/Chubb - Trimmed.mp4"}
GX021737=${GX021737:-"$HOME/Desktop/Chubb/GX021737.MP4"}
OUT=out/bench-score
if ! build=$(swift build -c release 2>&1); then echo "$build" | grep -E "error:"; exit 1; fi
B=.build/release/bibwatch

scan() {   # name video segments extra-args…
  local name=$1 video=$2 segments=$3; shift 3
  local t0=$SECONDS
  $B scan "$video" "$OUT/$name" --segments "$segments" --max-bib 9999 --no-color "$@" ${FRESH:+--fresh} > "$OUT/$name.log" 2>&1
  printf '  %-14s %4ds\n' "$name" $((SECONDS - t0))
}

[[ "${1:-}" == "--fresh" ]] && FRESH=1
mkdir -p "$OUT"
echo "scanning${FRESH:+ (fresh)}:"
scan trim-whole  "$CHUBB_TRIMMED" bench/segments/chubb-trimmed.json
scan trim-people "$CHUBB_TRIMMED" bench/segments/chubb-trimmed.json --people-first
scan gx-whole    "$GX021737" bench/segments/gx021737.json --start 2:30 --end 3:00
scan gx-people   "$GX021737" bench/segments/gx021737.json --start 2:30 --end 3:00 --people-first
echo
$B score bench/keys/chubb-trimmed.txt "$OUT/trim-whole" "$OUT/trim-people" ${BRIEF---brief}
echo
$B score bench/keys/gx021737-2m30.txt "$OUT/gx-whole" "$OUT/gx-people" ${BRIEF---brief}
echo
node bench/parity.mjs
