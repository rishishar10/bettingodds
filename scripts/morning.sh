#!/bin/zsh
# Local nightly build (11:05pm): box scores through today, tomorrow's board,
# grades for earlier boards, rebuilt site.
# With ODDS_API_KEY in .env it builds a real dry-run board (about 30 free-tier
# credits a slate); without one it builds the labeled demo board.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
[ -f .env ] && set -a && source .env && set +a

echo "=== nightly build $(date '+%F %T %Z') ==="
node scripts/ingest-boxscores.ts --recent 3

if [ -n "${ODDS_API_KEY:-}" ]; then
  node scripts/run-board.ts --dry-run || true
  node scripts/grade.ts --dry-run
  DIR=data/dev-published
else
  DIR=data/demo-published
fi
# Practice board every night: free, and it keeps the model check growing.
node scripts/demo-snapshot.ts data/demo-published 2>&1 | grep -v Warning || true
node scripts/grade.ts --dir data/demo-published

BOARD_DATA_DIR=$DIR npx next build >/dev/null
echo "site rebuilt from $DIR"
