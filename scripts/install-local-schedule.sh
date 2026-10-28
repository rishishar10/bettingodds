#!/bin/zsh
# Installs three user launch agents: the 9:05am board build, the hourly
# status watch, and a static server for out/ on http://localhost:4173.
# Remove with --uninstall.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
MORNING=com.nbaboard.morning
WATCH=com.nbaboard.watch
SERVER=com.nbaboard.server

for label in $MORNING $WATCH $SERVER; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  rm -f "$AGENTS/$label.plist"
done
if [ "${1:-}" = "--uninstall" ]; then echo "removed all agents"; exit 0; fi

mkdir -p "$AGENTS" "$REPO/data"
cat > "$AGENTS/$MORNING.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$MORNING</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$REPO/scripts/morning.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>5</integer></dict>
  <key>StandardOutPath</key><string>$REPO/data/morning.log</string>
  <key>StandardErrorPath</key><string>$REPO/data/morning.log</string>
</dict></plist>
PLIST
HOURS=""
for hr in 9 10 11 12 13 14 15 16 17 18 19; do HOURS="$HOURS<dict><key>Hour</key><integer>$hr</integer><key>Minute</key><integer>15</integer></dict>"; done
cat > "$AGENTS/$WATCH.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$WATCH</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$REPO/scripts/watch.sh</string></array>
  <key>StartCalendarInterval</key><array>$HOURS</array>
  <key>StandardOutPath</key><string>$REPO/data/morning.log</string>
  <key>StandardErrorPath</key><string>$REPO/data/morning.log</string>
</dict></plist>
PLIST
cat > "$AGENTS/$SERVER.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$SERVER</string>
  <key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>$REPO/scripts/serve.py</string><string>4173</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>$REPO/data/server.log</string>
</dict></plist>
PLIST
pkill -f "http.server 4173" 2>/dev/null || true
pkill -f "scripts/serve.py" 2>/dev/null || true
for label in $MORNING $WATCH $SERVER; do launchctl bootstrap "gui/$(id -u)" "$AGENTS/$label.plist"; done
echo "installed: board build at 9:05am, status watch hourly at :15 from 9:15am to 7:15pm (local time; runs on wake if asleep), server on http://localhost:4173"
echo "log: $REPO/data/morning.log · remove with: scripts/install-local-schedule.sh --uninstall"
