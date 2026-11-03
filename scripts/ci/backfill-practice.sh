#!/usr/bin/env bash
# Practice boards for any of the last 7 days that has none (a failed run skips a
# night). Built as of 9am that day from box scores and the injury report, so free.
set -uo pipefail
DIR=${1:-data/demo-published}
for i in 7 6 5 4 3 2 1; do
  d=$(TZ=America/Los_Angeles date -d "-$i day" +%F 2>/dev/null || TZ=America/Los_Angeles date -v-${i}d +%F)
  if [ ! -f "$DIR/$d.json" ]; then
    echo "practice backfill $d"
    node scripts/demo-snapshot.ts "$DIR" "$d" || echo "backfill $d failed"
  fi
done
