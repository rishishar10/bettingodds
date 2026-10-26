#!/usr/bin/env bash
# Pull or push the state files kept on the orphan `data` branch.
# The branch is force-pushed as a single commit so binaries never pile up.
set -euo pipefail
FILES="data/board.sqlite data/history.sqlite data/published data/cache/espn data/cache/injury"
case "${1:-}" in
  pull)
    if git ls-remote --exit-code origin data >/dev/null 2>&1; then
      git fetch --depth 1 origin data
      git --work-tree=. checkout FETCH_HEAD -- data || true
      git reset -q
    fi
    ;;
  push)
    tmp=$(mktemp -d)
    mkdir -p "$tmp/data"
    for f in $FILES; do [ -e "$f" ] && cp -R "$f" "$tmp/data/"; done
    cd "$tmp"
    git init -q -b data
    git add -A
    git -c user.name="board-bot" -c user.email="board-bot@users.noreply.github.com" commit -qm "state $(date -u +%FT%TZ)"
    git push -q --force "$REPO_URL" data
    ;;
  *) echo "usage: data-branch.sh pull|push"; exit 1 ;;
esac
