// Fits a per-stat dispersion multiplier κ on train box scores (free, no odds):
// variance' = mean + κ (variance - mean), chosen to maximise the mean log
// score of actual outcomes. Train seasons only; writes rules/dispersion.json.
//   node scripts/fit-dispersion.ts [--every 2]
import { writeFileSync } from "node:fs";
import { rosterOnDate, teammatesTonight } from "../lib/board.ts";
import { oracleAvailability } from "../lib/availability.ts";
import { opponentFactors } from "../lib/opponent.ts";
import { loadRule } from "../lib/rule.ts";
import { openHistory } from "../lib/history.ts";
import { predictive, type DispersionParams, type DistParts } from "../lib/dispersion.ts";
import { cdf } from "../lib/negbin.ts";
import { buildPools, project } from "../lib/project.ts";
import { goldenMin, mulberry32 } from "../lib/stats.ts";
import { previousSeason } from "../lib/time.ts";
import { STATS, type Stat } from "../lib/types.ts";

const everyIdx = process.argv.indexOf("--every");
const every = everyIdx >= 0 ? Number(process.argv[everyIdx + 1]) : 2;
const { rule } = loadRule();
const trainSeasons = (rule.seasons as { train: { seasons: string[] } }).train.seasons;
const h = openHistory();
const rows: Record<Stat, { parts: DistParts; y: number }[]> = { pts: [], reb: [], ast: [] };

for (const season of trainSeasons) {
  const lastSeason = previousSeason(season);
  for (const date of h.gameDates(season).filter((_, i) => i % every === 0)) {
    for (const game of h.gamesOn(date)) {
      const actual = new Map(h.logsForGame(game.gameId).map((l) => [l.playerId, l]));
      for (const teamId of [game.home.id, game.away.id]) {
        const logs = h.teamLogsBefore(teamId, [season, lastSeason], date);
        const roster = rosterOnDate(h, teamId, logs, date);
        const avail = oracleAvailability(h, game, roster)(teamId);
        const opp = opponentFactors(h, teamId === game.home.id ? game.away.id : game.home.id, season, date);
        for (const p of roster) {
          const y = actual.get(p.playerId);
          if (!y || y.minutes <= 0) continue;
          const pools = buildPools({
            playerId: p.playerId, teamId, boardDate: date, season, lastSeason, logs,
            ...teammatesTonight(roster, logs, teamId, season, lastSeason, avail, p.playerId),
          });
          if (!pools.ok) continue;
          for (const stat of STATS) {
            const pr = project(pools.pools, stat, { oppFactor: opp[stat] });
            rows[stat].push({ parts: pr, y: y[stat] });
          }
        }
      }
    }
  }
}

const logScore = (rs: typeof rows.pts, p: DispersionParams) => {
  let s = 0;
  for (const r of rs) s -= Math.log(Math.max(1e-12, predictive(r.parts, p).pmf(r.y)));
  return s / rs.length;
};
const rand = mulberry32(5);
const coverage = (rs: typeof rows.pts, p: DispersionParams) => {
  const dec = Array(10).fill(0);
  for (const r of rs) {
    const d = predictive(r.parts, p);
    const u = cdf(d, r.y - 1) + rand() * d.pmf(r.y);
    dec[Math.min(9, Math.floor(u * 10))]++;
  }
  return { in80: dec.slice(1, 9).reduce((a, b) => a + b, 0) / rs.length, deciles: dec.map((c) => +(c / rs.length * 10).toFixed(2)) };
};

const out: Record<string, DispersionParams> = {};
const lines: string[] = [];
for (const stat of STATS) {
  // q on a 0.01 grid; κ by golden section for each q.
  let best = { kappa: 1, q: 0 };
  let bestLs = Infinity;
  for (let q = 0; q <= 0.15 + 1e-9; q += 0.01) {
    const kappa = goldenMin((k) => logScore(rows[stat], { kappa: k, q }), 0.3, 6, 1e-3);
    const ls = logScore(rows[stat], { kappa, q });
    if (ls < bestLs) { bestLs = ls; best = { kappa: +kappa.toFixed(3), q: +q.toFixed(2) }; }
  }
  out[stat] = best;
  const before = coverage(rows[stat], { kappa: 1, q: 0 });
  const after = coverage(rows[stat], best);
  lines.push(`| ${stat} | ${rows[stat].length} | ${best.q} | ${best.kappa} | ${logScore(rows[stat], { kappa: 1, q: 0 }).toFixed(4)} → ${bestLs.toFixed(4)} | ${(before.in80 * 100).toFixed(1)}% → ${(after.in80 * 100).toFixed(1)}% | ${before.deciles.join(" ")} | ${after.deciles.join(" ")} |`);
}
writeFileSync("rules/dispersion.json", JSON.stringify({ ...out, short_fractions: [0.05, 0.15, 0.25, 0.35, 0.45], fitted_on: `${trainSeasons.join(", ")}, every ${every} dates, oracle availability, log score` }, null, 2) + "\n");
const md = `# Dispersion fit (train box scores, no odds)

Predictive = (1 − q) · NB(mean, mean + κ (variance − mean)) + q · short night (minutes at 5–45% of expected).
q and κ by mean log score. Seasons ${trainSeasons.join(", ")}, every ${every} game dates, oracle availability.

| Stat | Rows | q | κ | Log score | In 80% band | PIT deciles before | PIT deciles after |
|---|---|---|---|---|---|---|---|
${lines.join("\n")}
`;
writeFileSync("reports/dispersion-fit.md", md);
console.log(md);
h.close();
