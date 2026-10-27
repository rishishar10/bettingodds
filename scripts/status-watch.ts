// Free news watch for today's board: compares the availability the board was
// built on with the latest official injury report and ESPN's injury feed, and
// flags rows whose player or a rotation teammate got worse. Never re-ranks or
// edits the publication; writes news-<date>.json beside the snapshot.
//   node scripts/status-watch.ts [--dir data/published]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL } from "../lib/constants.ts";
import { openHistory } from "../lib/history.ts";
import { detectChanges, flagRows, worse, type CurrentStatus } from "../lib/news.ts";
import { slateRoster } from "../lib/slate-inputs.ts";
import { normalizeTeam } from "../lib/sources/aliases.ts";
import { resolvePlayer } from "../lib/sources/crosswalk.ts";
import { fetchEspnInjuries } from "../lib/sources/espn-injuries.ts";
import { scoreboard } from "../lib/sources/espn.ts";
import { reportBefore } from "../lib/sources/injuries.ts";
import { pacificDate, previousSeason, seasonOf } from "../lib/time.ts";
import type { TonightStatus } from "../lib/board.ts";
import { dataDir, type BoardSnapshot } from "../lib/view.ts";

const i = process.argv.indexOf("--dir");
const dir = i >= 0 ? process.argv[i + 1] : dataDir();
const now = new Date().toISOString();
const today = pacificDate(now);
const file = join(dir, `${today}.json`);
if (!existsSync(file)) {
  console.log(`no board for ${today} in ${dir}; nothing to watch`);
  process.exit(0);
}
const board: BoardSnapshot = JSON.parse(readFileSync(file, "utf8"));
const built = board.availability ?? {};
const h = openHistory();
// Today's games come from the live schedule; history only holds completed games.
const games = (await scoreboard(today.replaceAll("-", ""), { useCache: false })).filter((g) => board.games.some((b) => b.gameId === g.gameId));
const roster = slateRoster(h, games, today);
const names = new Map(roster.map((r) => [r.playerId, r.playerName]));
const teamIdByName = new Map<string, string>();
for (const g of games) {
  teamIdByName.set(normalizeTeam(g.home.name), g.home.id);
  teamIdByName.set(normalizeTeam(g.away.name), g.away.id);
}

const tipByTeam = new Map<string, number>();
for (const g of games) for (const t of [g.home.id, g.away.id]) tipByTeam.set(t, Date.parse(g.tipUtc));

const current: Record<string, Map<string, CurrentStatus>> = {};
const put = (teamId: string, name: string, c: CurrentStatus) => {
  // News after tip-off (an in-game injury) does not make a pre-game price stale.
  if (Date.parse(c.sourceTime) >= (tipByTeam.get(teamId) ?? Infinity)) return;
  const j = resolvePlayer(name, roster, [teamId]);
  if (!j.ok) return;
  const m = (current[teamId] ??= new Map());
  m.set(j.playerId, worse(m.get(j.playerId), c));
};

const STATUS: Record<string, TonightStatus | null> = { out: "out", doubtful: "doubtful", questionable: "questionable", probable: null, available: null };
// For each game, the latest official report before its tip (or now, if it hasn't tipped).
const reports = new Map<number, Awaited<ReturnType<typeof reportBefore>>>();
for (const tip of new Set(tipByTeam.values())) {
  const at = new Date(Math.min(Date.now(), tip - 60000)).toISOString();
  reports.set(tip, await reportBefore(at, { bufferMinutes: 0, earliestHourEt: 5 }));
}
const report = [...reports.values()].filter(Boolean).sort((a, b) => Date.parse(b!.reportTimeUtc) - Date.parse(a!.reportTimeUtc))[0] ?? null;
for (const [tip, rep] of reports) {
  if (!rep) continue;
  for (const e of rep.entries) {
    const teamId = teamIdByName.get(normalizeTeam(e.team));
    const s = STATUS[e.status];
    if (teamId && tipByTeam.get(teamId) === tip && s && e.gameDate === today)
      put(teamId, e.playerName, { status: s, source: "official", sourceTime: rep.reportTimeUtc, note: e.reason });
  }
}
let espnCount = 0;
try {
  for (const e of await fetchEspnInjuries()) {
    const teamId = teamIdByName.get(e.team);
    // Only notes posted after the board; older notes were knowable to the official report.
    if (!teamId || Date.parse(e.updatedAt) <= Date.parse(board.publishedAt)) continue;
    espnCount++;
    put(teamId, e.playerName, { status: e.status, source: "espn", sourceTime: e.updatedAt, note: e.note });
  }
} catch (err) {
  console.error(`ESPN feed unavailable: ${(err as Error).message}`);
}

// Rotation teammates, by the model's own definition.
const season = seasonOf(today);
const rotationCache = new Map<string, Set<string>>();
const rotation = (teamId: string) => {
  let s = rotationCache.get(teamId);
  if (s) return s;
  const logs = h.teamLogsBefore(teamId, [season, previousSeason(season)], today).filter((l) => l.teamId === teamId && l.minutes > 0);
  s = new Set<string>();
  for (const pid of new Set(logs.map((l) => l.playerId))) {
    const mins = logs.filter((l) => l.playerId === pid).sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, MODEL.ROTATION_LOOKBACK_GAMES).map((l) => l.minutes).sort((a, b) => a - b);
    const n = mins.length;
    const median = n % 2 ? mins[(n - 1) / 2] : (mins[n / 2 - 1] + mins[n / 2]) / 2;
    if (median >= MODEL.ROTATION_MEDIAN_MINUTES) s.add(pid);
  }
  rotationCache.set(teamId, s);
  return s;
};

const changes = detectChanges(built, current, names);
const rows = flagRows(board.rows, changes, rotation);
writeFileSync(join(dir, `news-${today}.json`), JSON.stringify({
  checkedAt: now,
  officialReport: report ? { url: report.url, timeUtc: report.reportTimeUtc } : null,
  espnNotesAfterPublish: espnCount,
  changes,
  rows,
}, null, 1));
console.log(`${today}: ${changes.length} status changes since publish, ${Object.keys(rows).length} of ${board.rows.length} rows flagged (report ${report?.reportTimeUtc ?? "none"}, ${espnCount} ESPN notes after publish)`);
for (const c of changes) console.log(`  ${c.playerName}: ${c.from} → ${c.to} (${c.source} ${c.sourceTime})`);
h.close();
