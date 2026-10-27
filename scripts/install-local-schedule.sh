#!/bin/zsh
# Installs two user launch agents: the 8:05am morning reset (local time) and a
# static server for out/ on http://localhost:4173. Remove with --uninstall.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
MORNING=com.nbaboard.morning
SERVER=com.nbaboard.server

for label in $MORNING $SERVER; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  rm -f "$AGENTS/$label.plist"
done
if [ "${1:-}" = "--uninstall" ]; then echo "removed both agents"; exit 0; fi

mkdir -p "$AGENTS" "$REPO/data"
cat > "$AGENTS/$MORNING.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$MORNING</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$REPO/scripts/morning.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>5</integer></dict>
  <key>StandardOutPath</key><string>$REPO/data/morning.log</string>
  <key>StandardErrorPath</key><string>$REPO/data/morning.log</string>
</dict></plist>
PLIST
cat > "$AGENTS/$SERVER.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$SERVER</string>
  <key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>-m</string><string>http.server</string><string>4173</string><string>--bind</string><string>127.0.0.1</string><string>-d</string><string>$REPO/out</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>$REPO/data/server.log</string>
</dict></plist>
PLIST
pkill -f "http.server 4173" 2>/dev/null || true
for label in $MORNING $SERVER; do launchctl bootstrap "gui/$(id -u)" "$AGENTS/$label.plist"; done
echo "installed: morning reset at 8:05am local time (runs on wake if the Mac was asleep); server on http://localhost:4173"
echo "log: $REPO/data/morning.log · remove with: scripts/install-local-schedule.sh --uninstall"
