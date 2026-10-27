#!/bin/zsh
# Hourly news watch: flags rows on today's board whose player or a rotation
# teammate changed status since publish, then rebuilds the site. Free.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
[ -f .env ] && set -a && source .env && set +a
DIR=$([ -n "${ODDS_API_KEY:-}" ] && echo data/dev-published || echo data/demo-published)
echo "=== status watch $(date '+%F %T %Z') ==="
node scripts/status-watch.ts --dir "$DIR" 2>&1 | grep -v Warning
BOARD_DATA_DIR=$DIR npx next build >/dev/null
echo "site rebuilt from $DIR"
