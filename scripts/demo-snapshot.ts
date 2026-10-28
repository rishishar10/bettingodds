// UI preview only: real box scores and injury report, made-up prices set
// near the projection. Writes to a scratch directory, never to data/published.
//   node scripts/demo-snapshot.ts <out-dir> [YYYY-MM-DD]
import { availabilitySnapshot, boardRows, currentTeammates, emptyReason, evaluateSlate } from "../lib/board.ts";
import { POLICY } from "../lib/constants.ts";
import { openHistory } from "../lib/history.ts";
import { modelState, writePrices, writeSnapshot } from "../lib/publish.ts";
import { availabilityFor, injuryInputs, slateRoster } from "../lib/slate-inputs.ts";
import { scoreboard } from "../lib/sources/espn.ts";
import type { RawPrice } from "../lib/sources/odds.ts";
import { boardInstant, nextBoardDate, previousSeason, seasonOf } from "../lib/time.ts";
import { STATS } from "../lib/types.ts";

const [outDir, dateArg] = process.argv.slice(2);
if (!outDir || outDir.includes("data/published")) throw new Error("pass a scratch output directory");
const boardDate = dateArg ?? nextBoardDate(new Date().toISOString());
if (!dateArg && Date.now() < Date.parse(boardInstant(boardDate))) {
  console.log(`before the 9:00am Pacific build for ${boardDate}; nothing to do`);
  process.exit(0);
}
const h = openHistory();
const boardUtc = boardInstant(boardDate);
const games = (await scoreboard(boardDate.replaceAll("-", ""), { useCache: false })).filter((g) => g.seasonType === 2);
const matched = games.map((g) => ({ game: g, eventId: `demo-${g.gameId}` }));
const roster = slateRoster(h, games, boardDate);
const injuries = await injuryInputs(boardUtc);
const stats = { unmatchedInjuryNames: [] as string[], teamsUnresolved: [] as string[] };
const avail = availabilityFor("report", h, boardDate, roster, injuries, stats)!;

// Made-up lines, one book per player and stat, at -110 both sides: the nearest half point to the
// player's last 10 games of 15+ minutes before the board date. Only players on a current roster
// (seen in the team's box scores this season, or last season before the team's first game).
const src = new Date(Date.parse(boardUtc) - 6 * 60000).toISOString();
const prices: RawPrice[] = [];
const season = seasonOf(boardDate);
let k = 0;
for (const { game, eventId } of matched) {
  for (const teamId of [game.home.id, game.away.id]) {
    const teamLogs = h.teamLogsBefore(teamId, [season, previousSeason(season)], boardDate);
    for (const p of currentTeammates(roster, teamLogs, teamId, season, previousSeason(season), new Map())) {
      // Books post props for players in the rotation now: 15+ minutes in 3 of the last 5 team games.
      const recentRows = teamLogs.filter((l) => l.playerId === p.playerId && l.teamId === teamId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
      if (recentRows.filter((l) => l.minutes >= 15).length < 3) continue;
      const last = h.db.prepare("SELECT pts, reb, ast FROM logs WHERE player_id = ? AND minutes >= 15 AND date < ? ORDER BY date DESC LIMIT 10").all(p.playerId, boardDate) as any[];
      if (last.length < 5) continue;
      for (const stat of STATS) {
        const avg = last.reduce((s, x) => s + x[stat], 0) / last.length;
        if (avg < 2) continue;
        const line = Math.round(avg - 0.5) + 0.5;
        const book = (["draftkings", "fanduel", "betmgm"] as const)[k++ % 3];
        for (const side of ["over", "under"] as const)
          prices.push({ eventId, playerName: p.playerName, stat, line, side, book, decimal: 1.91, sourceUpdatedAt: src });
      }
    }
  }
}
const model = modelState();
const slate = evaluateSlate({ boardDate, buildTimeUtc: boardUtc, games: matched, prices, history: h, availability: avail, SHRINK: model.SHRINK, evMin: POLICY.EV_MIN, maxAgeMinutes: POLICY.ODDS_MAX_AGE_MINUTES });
const teams: Record<string, string> = {};
for (const g of games) { teams[g.home.id] = g.home.abbr; teams[g.away.id] = g.away.abbr; }
writePrices(outDir, boardDate, prices);
writeSnapshot(outDir, boardDate, {
  boardDate, publishedAt: boardUtc, buildTimeUtc: boardUtc, modelVersion: model.modelVersion,
  label: "DEMO PRICES, not a real board", shrunk: true, SHRINK: model.SHRINK, ruleHash: null, evMin: POLICY.EV_MIN,
  injury: injuries.morning ? { url: injuries.morning.url, timeUtc: injuries.morning.reportTimeUtc, ...stats } : null,
  games: games.map((g) => ({ gameId: g.gameId, tipUtc: g.tipUtc, home: g.home.abbr, away: g.away.abbr, hasOdds: true, eventId: `demo-${g.gameId}` })),
  teams, rows: boardRows(slate, model.SHRINK, POLICY.EV_MIN), conditional: slate.conditional, coverage: slate.coverage,
  availability: availabilitySnapshot(matched, avail),
  unmatchedNames: slate.unmatchedNames.length, anomalies: slate.rank.anomalies, emptyReason: emptyReason(slate, games.length),
  closeCollected: false, dryRun: true,
});
console.log(`demo: ${games.length} games, coverage ${JSON.stringify(slate.coverage)}, rows ${slate.rank.published.length}, cards ${slate.conditional.length}, unresolved ${stats.teamsUnresolved.length}, unmatched injury names ${new Set(stats.unmatchedInjuryNames).size}: ${[...new Set(stats.unmatchedInjuryNames)].slice(0, 25).join("; ")}`);
h.close();
