// Free projection check: scores the NB projection against actual stats with
// oracle availability and no odds. Train seasons only; never the test season.
// Usage: node scripts/check-projection.ts 2023-24 [2024-25] [--every 3]
import { writeFileSync } from "node:fs";
import { rosterOnDate, teammatesTonight } from "../lib/board.ts";
import { oracleAvailability } from "../lib/availability.ts";
import { opponentFactors } from "../lib/opponent.ts";
import { MODEL } from "../lib/constants.ts";
import { openHistory } from "../lib/history.ts";
import { cdf } from "../lib/negbin.ts";
import { buildPools, project, projectionDist } from "../lib/project.ts";
import { mulberry32 } from "../lib/stats.ts";
import { previousSeason } from "../lib/time.ts";
import { STATS, type Stat } from "../lib/types.ts";

const TEST_SEASON = "2025-26";
const args = process.argv.slice(2);
const everyIdx = args.indexOf("--every");
const every = everyIdx >= 0 ? Number(args[everyIdx + 1]) : 1;
const seasons = args.filter((a, i) => /^\d{4}-\d{2}$/.test(a) && (everyIdx < 0 || i !== everyIdx + 1));
if (seasons.includes(TEST_SEASON) || seasons.some((s) => s > TEST_SEASON)) {
  console.error(`refusing: ${TEST_SEASON} and later are held out`);
  process.exit(1);
}

// Exploration on train only: MODEL_OVERRIDE='{"ROTATION_MEDIAN_MINUTES":24}'
if (process.env.MODEL_OVERRIDE) Object.assign(MODEL as Record<string, number>, JSON.parse(process.env.MODEL_OVERRIDE));
const tag = process.env.MODEL_OVERRIDE ? `-${Object.entries(JSON.parse(process.env.MODEL_OVERRIDE)).map(([k, v]) => `${k}=${v}`).join("_")}` : "";
const h = openHistory();
const rand = mulberry32(1);

interface Acc { n: number; pit: number[]; bias: number; sq: number; in50: number; in80: number; predVar: number }
const acc = (): Acc => ({ n: 0, pit: Array(10).fill(0), bias: 0, sq: 0, in50: 0, in80: 0, predVar: 0 });
const byStat: Record<Stat, Acc> = { pts: acc(), reb: acc(), ast: acc() };
const byFlag: Record<string, Acc> = {};
const reasons: Record<string, number> = {};
let evaluated = 0;
let propLike = 0;
let propLikeSupported = 0;

for (const season of seasons) {
  const lastSeason = previousSeason(season);
  const dates = h.gameDates(season).filter((_, i) => i % every === 0);
  for (const date of dates) {
    for (const game of h.gamesOn(date)) {
      const actual = new Map(h.logsForGame(game.gameId).map((l) => [l.playerId, l]));
      for (const teamId of [game.home.id, game.away.id]) {
        const logs = h.teamLogsBefore(teamId, [season, lastSeason], date);
        const roster = rosterOnDate(h, teamId, logs, date);
        const avail = oracleAvailability(h, game, roster)(teamId);
        const opp = opponentFactors(h, teamId === game.home.id ? game.away.id : game.home.id, season, date);
        for (const p of roster) {
          const y = actual.get(p.playerId);
          if (!y || y.minutes <= 0) continue; // a DNP voids the prop
          evaluated++;
          // Prop-like: median minutes >= 20 over the player's last 10 games played for this team.
          const recent = logs.filter((l) => l.playerId === p.playerId && l.teamId === teamId && l.minutes > 0)
            .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10).map((l) => l.minutes).sort((a, b) => a - b);
          const isPropLike = recent.length >= 3 && recent[Math.floor(recent.length / 2)] >= 20;
          if (isPropLike) propLike++;
          const pools = buildPools({
            playerId: p.playerId, teamId, boardDate: date, season, lastSeason, logs,
            ...teammatesTonight(roster, logs, teamId, season, lastSeason, avail, p.playerId),
          });
          if (!pools.ok) { reasons[pools.reason] = (reasons[pools.reason] ?? 0) + 1; continue; }
          reasons.supported = (reasons.supported ?? 0) + 1;
          if (isPropLike) propLikeSupported++;
          for (const stat of STATS) {
            const pr = project(pools.pools, stat, { oppFactor: opp[stat] });
            const dist = projectionDist(pr);
            const x = y[stat];
            const u = cdf(dist, x - 1) + rand() * dist.pmf(x);
            for (const a of [byStat[stat], ...pr.flags.map((f) => (byFlag[`${stat}:${f}`] ??= acc()))]) {
              a.n++;
              a.pit[Math.min(9, Math.floor(u * 10))]++;
              a.bias += x - dist.mean;
              a.sq += (x - dist.mean) ** 2;
              a.predVar += dist.variance;
              if (u >= 0.25 && u <= 0.75) a.in50++;
              if (u >= 0.1 && u <= 0.9) a.in80++;
            }
          }
        }
      }
    }
    process.stdout.write(".");
  }
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const row = (name: string, a: Acc) =>
  `| ${name} | ${a.n} | ${(a.bias / a.n).toFixed(2)} | ${Math.sqrt(a.sq / a.n).toFixed(2)} | ${Math.sqrt(a.predVar / a.n).toFixed(2)} | ${pct(a.in50 / a.n)} | ${pct(a.in80 / a.n)} | ${a.pit.map((c) => (c / a.n * 10).toFixed(2)).join(" ")} |`;
const supported = reasons.supported ?? 0;
const md = `# Free projection check

Seasons: ${seasons.join(", ")} (every ${every} game date). Availability: **oracle** (the box score says who played). No odds.
Constants: \`${JSON.stringify(MODEL)}\`

Players who played: ${evaluated}. Supported: ${supported} (${pct(supported / evaluated)}).
Prop-like players (median minutes >= 20 over their last 10 games for the team): ${propLike}; supported ${propLikeSupported} (${pct(propLikeSupported / propLike)}).
The predictive distribution includes the train-fit dispersion in rules/dispersion.json.

| Unsupported reason | Count |
|---|---|
${Object.entries(reasons).filter(([k]) => k !== "supported").map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus the predictive mean; predicted SD is the predictive standard deviation.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
${STATS.map((s) => row(s, byStat[s])).join("\n")}
${Object.entries(byFlag).sort().map(([k, a]) => row(k, a)).join("\n")}
`;
const out = `reports/projection-check-${seasons.join("_")}${tag}.md`;
writeFileSync(out, md);
console.log(`\nwrote ${out}`);
h.close();
