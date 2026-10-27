#!/usr/bin/env bash
# Picks how the morning job runs and where the site reads from:
#   live   - the test-season report is in the repo and an odds key is set
#   dryrun - an odds key is set (real prices, labeled development dry run)
#   demo   - no key (real injuries and box scores, made-up prices, labeled)
set -euo pipefail
if [ -n "${ODDS_API_KEY:-}" ] && [ -f reports/test.md ]; then MODE=live; DIR=data/published
elif [ -n "${ODDS_API_KEY:-}" ]; then MODE=dryrun; DIR=data/dev-published
else MODE=demo; DIR=data/demo-published; fi
echo "MODE=$MODE" >> "${GITHUB_ENV:-/dev/stdout}"
echo "BOARD_DIR=$DIR" >> "${GITHUB_ENV:-/dev/stdout}"
echo "mode: $MODE ($DIR)"
