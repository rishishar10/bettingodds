// Free news watch for today's board. It compares the availability the board
// was built on with the latest official injury report and ESPN's injury feed,
// flags rows whose player or a rotation teammate got worse, and re-runs the
// board for games not yet tipped with the news factored in, at the saved 9am
// prices. The 9am publication is never edited; everything goes to
// news-<date>.json beside the snapshot.
//   node scripts/status-watch.ts [--dir data/published]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openHistory } from "../lib/history.ts";
import { detectChanges, flagRows, worse, type CurrentStatus } from "../lib/news.ts";
import { slateRoster } from "../lib/slate-inputs.ts";
import { isRotation } from "../lib/project.ts";
import { normalizeTeam } from "../lib/sources/aliases.ts";
import { resolvePlayer } from "../lib/sources/crosswalk.ts";
import { fetchEspnInjuries } from "../lib/sources/espn-injuries.ts";
import { scoreboard } from "../lib/sources/espn.ts";
import { reportBefore } from "../lib/sources/injuries.ts";
import { pacificDate, previousSeason, seasonOf } from "../lib/time.ts";
import { boardRows, evaluateSlate, type TeamAvailability, type TonightStatus } from "../lib/board.ts";
import { reportAvailability } from "../lib/availability.ts";
import { POLICY } from "../lib/constants.ts";
import type { EspnGame } from "../lib/sources/espn.ts";
import type { RawPrice } from "../lib/sources/odds.ts";
import { dataDir, type BoardSnapshot } from "../lib/view.ts";

const i = process.argv.indexOf("--dir");
const dir = i >= 0 ? process.argv[i + 1] : dataDir();
// --now replays the watch as of an earlier moment today (testing, backfills).
const n = process.argv.indexOf("--now");
const now = n >= 0 ? new Date(process.argv[n + 1]).toISOString() : new Date().toISOString();
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

// Doubtful is treated as out.
const STATUS: Record<string, TonightStatus | null> = { out: "out", doubtful: "out", questionable: "questionable", probable: null, available: null };
// For each game, the latest official report before its tip (or now, if it hasn't tipped).
const reports = new Map<number, Awaited<ReturnType<typeof reportBefore>>>();
for (const tip of new Set(tipByTeam.values())) {
  const at = new Date(Math.min(Date.parse(now), tip - 60000)).toISOString();
  reports.set(tip, await reportBefore(at, { bufferMinutes: 0 }));
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
    // Only notes posted after the board (and by "now"); older notes were knowable to the official report.
    if (!teamId || Date.parse(e.updatedAt) <= Date.parse(board.publishedAt) || Date.parse(e.updatedAt) > Date.parse(now)) continue;
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
    const mins = logs.filter((l) => l.playerId === pid).sort((a, b) => (a.date < b.date ? 1 : -1)).map((l) => l.minutes);
    if (isRotation(mins)) s.add(pid);
  }
  rotationCache.set(teamId, s);
  return s;
};

const changes = detectChanges(built, current, names);
const rows = flagRows(board.rows, changes, rotation);

// Re-run the board for games not yet tipped: the latest official report, worse
// ESPN notes on top, the same 9am prices and build time.
const pricesFile = join(dir, `prices-${today}.json`);
const untipped = games.filter((g) => Date.parse(g.tipUtc) > Date.parse(now));
let update: Record<string, unknown> | null = null;
const latest = await reportBefore(now, { bufferMinutes: 0 });
if (existsSync(pricesFile) && untipped.length && latest) {
  const eventOf = new Map(board.games.map((g) => [g.gameId, g.eventId ?? null]));
  const slateGames = untipped.flatMap((g) => (eventOf.get(g.gameId) ? [{ game: g, eventId: eventOf.get(g.gameId) as string }] : []));
  const eventIds = new Set(slateGames.map((g) => g.eventId));
  const prices = (JSON.parse(readFileSync(pricesFile, "utf8")) as RawPrice[]).filter((p) => eventIds.has(p.eventId));
  const stats = { unmatchedInjuryNames: [] as string[], teamsUnresolved: [] as string[] };
  const fromReport = reportAvailability(latest, today, roster, stats);
  const availability = (teamId: string, game: EspnGame): TeamAvailability => {
    const a = fromReport(teamId, game);
    if (a.unresolved) return a;
    const status = new Map(a.status);
    for (const [pid, c] of current[teamId] ?? []) {
      if (c.source !== "espn") continue;
      const order = { active: 0, questionable: 1, doubtful: 2, out: 3 } as const;
      if (order[c.status] > order[status.get(pid) ?? "active"]) status.set(pid, c.status);
    }
    return { ...a, status };
  };
  const slate = evaluateSlate({
    boardDate: today, buildTimeUtc: board.buildTimeUtc ?? board.publishedAt, games: slateGames, prices, history: h,
    availability, SHRINK: board.SHRINK, evMin: board.evMin, maxAgeMinutes: POLICY.ODDS_MAX_AGE_MINUTES,
  });
  const updated = boardRows(slate, board.SHRINK, board.evMin);
  const morning = board.rows.filter((r) => untipped.some((g) => g.home.id === r.teamId || g.away.id === r.teamId));
  const updatedKeys = new Set(updated.map((r) => r.key));
  const morningKeys = new Set(morning.map((r) => r.key));
  update = {
    asOf: now,
    reportTimeUtc: latest.reportTimeUtc,
    rows: updated,
    added: updated.filter((r) => !morningKeys.has(r.key)).map((r) => r.key),
    dropped: morning.filter((r) => !updatedKeys.has(r.key)).map((r) => ({
      key: r.key,
      reason: rows[r.key]?.length
        ? rows[r.key].map((f) => `${f.kind === "player" ? "" : "teammate "}${f.playerName} ${f.to}`).join(", ")
        : "no longer clears the bar with the latest report",
    })),
    tippedGames: games.filter((g) => !untipped.includes(g)).map((g) => `${g.away.abbr}@${g.home.abbr}`),
    coverage: slate.coverage,
    conditional: slate.conditional,
    unresolvedTeams: stats.teamsUnresolved,
  };
}
writeFileSync(join(dir, `news-${today}.json`), JSON.stringify({
  checkedAt: now,
  officialReport: report ? { url: report.url, timeUtc: report.reportTimeUtc } : null,
  espnNotesAfterPublish: espnCount,
  changes,
  rows,
  update,
}, null, 1));
console.log(`${today}: ${changes.length} status changes since publish, ${Object.keys(rows).length} of ${board.rows.length} rows flagged (report ${report?.reportTimeUtc ?? "none"}, ${espnCount} ESPN notes after publish)`);
if (update) console.log(`  updated board for untipped games: ${(update.rows as unknown[]).length} rows (${(update.added as unknown[]).length} new, ${(update.dropped as unknown[]).length} dropped), coverage ${JSON.stringify(update.coverage)}`);
else console.log("  no update: every game has tipped, no saved prices, or no report");
for (const c of changes) console.log(`  ${c.playerName}: ${c.from} → ${c.to} (${c.source} ${c.sourceTime})`);
h.close();
