// Model stress test on train seasons only (2025-26 stays held out). No odds:
// besides log score and PIT, each projection is judged against a book-style
// line, the player's recent average rounded to a half point.
//   node scripts/stress-test.ts [--every 2]
// Candidate improvements are fit on 2023-24 and judged on 2024-25.
import { writeFileSync } from "node:fs";
import { oracleAvailability } from "../lib/availability.ts";
import { opponentFactors } from "../lib/opponent.ts";
import { rosterOnDate, teammatesTonight } from "../lib/board.ts";
import { MODEL } from "../lib/constants.ts";
import { dispersionFor, predictive, type DistParts } from "../lib/dispersion.ts";
import { openHistory } from "../lib/history.ts";
import { cdf } from "../lib/negbin.ts";
import { buildPools, project, type Projection } from "../lib/project.ts";
import { goldenMin, mulberry32 } from "../lib/stats.ts";
import { addDays, previousSeason } from "../lib/time.ts";
import { STATS, type Stat } from "../lib/types.ts";

const FIT = "2023-24";
const HOLD = "2024-25";
const everyIdx = process.argv.indexOf("--every");
const every = everyIdx >= 0 ? Number(process.argv[everyIdx + 1]) : 2;
const h = openHistory();

// ---------- opponent allowance: per team, per game, what opponents produced ----------
interface Allowed { date: string; season: string; minutes: number; pts: number; reb: number; ast: number }
const allowedBy = new Map<string, Allowed[]>();
const agg = h.db.prepare(`
  SELECT l.game_id, l.date, l.season, l.team_id, l.opponent_id, SUM(l.minutes) m, SUM(l.pts) pts, SUM(l.reb) reb, SUM(l.ast) ast
  FROM logs l JOIN games g ON g.game_id = l.game_id WHERE g.season_type = 2 GROUP BY l.game_id, l.team_id`).all() as any[];
for (const r of agg) {
  const list = allowedBy.get(r.opponent_id) ?? [];
  list.push({ date: r.date, season: r.season, minutes: r.m, pts: r.pts, reb: r.reb, ast: r.ast });
  allowedBy.set(r.opponent_id, list);
}
for (const l of allowedBy.values()) l.sort((a, b) => (a.date < b.date ? -1 : 1));
const leagueRate = new Map<string, Record<Stat, number>>();
function league(season: string): Record<Stat, number> {
  let v = leagueRate.get(season);
  if (v) return v;
  let m = 0;
  const s = { pts: 0, reb: 0, ast: 0 };
  for (const l of allowedBy.values()) for (const a of l) if (a.season === season) { m += a.minutes; s.pts += a.pts; s.reb += a.reb; s.ast += a.ast; }
  v = { pts: s.pts / m, reb: s.reb / m, ast: s.ast / m };
  leagueRate.set(season, v);
  return v;
}
/** Opponent's allowed per-minute rate over its last 15 games this season, relative to league, shrunk toward 1. */
function oppFactor(opp: string, date: string, season: string, stat: Stat): number {
  const prior = (allowedBy.get(opp) ?? []).filter((a) => a.season === season && a.date < date).slice(-15);
  if (!prior.length) return 1;
  const m = prior.reduce((s, a) => s + a.minutes, 0);
  const r = prior.reduce((s, a) => s + a[stat], 0) / m / league(season)[stat];
  const k = 10;
  return (prior.length * r + k) / (prior.length + k);
}

// ---------- collect rows ----------
interface Row {
  season: string; date: string; stat: Stat; y: number; minutes: number;
  pr: Projection; home: boolean; b2b: boolean; opp: number; recencyRate: number; recentMin: number; recentMinDnp: number;
  line: number | null; avg10: number | null; outTeammates: number; month: string;
}

function collect(seasons: string[], step: number): Row[] {
  const rows: Row[] = [];
  for (const season of seasons) {
    const lastSeason = previousSeason(season);
    for (const date of h.gameDates(season).filter((_, i) => i % step === 0)) {
      for (const game of h.gamesOn(date)) {
        for (const teamId of [game.home.id, game.away.id]) {
          const logs = h.teamLogsBefore(teamId, [season, lastSeason], date);
          const roster = rosterOnDate(h, teamId, logs, date);
          const avail = oracleAvailability(h, game, roster)(teamId);
        const opp = opponentFactors(h, teamId === game.home.id ? game.away.id : game.home.id, season, date);
          const tonight = new Map(h.logsForGame(game.gameId).map((l) => [l.playerId, l]));
          const b2b = logs.some((l) => l.teamId === teamId && l.date === addDays(date, -1));
          const opponent = teamId === game.home.id ? game.away.id : game.home.id;
          for (const p of roster) {
            const y = tonight.get(p.playerId);
            if (!y || y.minutes <= 0) continue;
            const tt = teammatesTonight(roster, logs, teamId, season, lastSeason, avail, p.playerId);
            const pools = buildPools({ playerId: p.playerId, teamId, boardDate: date, season, lastSeason, logs, ...tt });
            if (!pools.ok) continue;
            const own = logs.filter((l) => l.playerId === p.playerId && l.teamId === teamId && l.minutes > 0).sort((a, b) => (a.date < b.date ? 1 : -1));
            const recentMin = own.slice(0, 5).reduce((s, l) => s + l.minutes, 0) / Math.min(5, own.length);
            // Last 5 box-score rows for the team including DNP-CD zeros (injured players have no row).
            const rowsAll = logs.filter((l) => l.playerId === p.playerId && l.teamId === teamId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
            const recentMinDnp = rowsAll.reduce((s, l) => s + l.minutes, 0) / Math.max(1, rowsAll.length);
            const longGames = own.filter((l) => l.minutes >= 15).slice(0, 10);
            const outTeammates = pools.pools.rotation.filter((r) => r.status === "out").length;
            for (const stat of STATS) {
              const pr = project(pools.pools, stat, { oppFactor: opp[stat] });
              // Exponentially weighted per-minute rate over matched long games (half-life 8 games).
              let ws = 0, wm = 0;
              pools.pools.matched.filter((g) => !g.shortAppearance).forEach((g, i) => { const w = 0.5 ** (i / 8); ws += w * g[stat]; wm += w * g.minutes; });
              const avg10 = longGames.length >= 5 ? longGames.reduce((s, l) => s + l[stat], 0) / longGames.length : null;
              rows.push({
                season, date, stat, y: y[stat], minutes: y.minutes, pr, home: teamId === game.home.id, b2b,
                opp: oppFactor(opponent, date, season, stat), recencyRate: wm > 0 ? ws / wm : pr.rateFinal, recentMin, recentMinDnp,
                line: avg10 !== null ? Math.floor(avg10) + 0.5 : null, avg10, outTeammates, month: date.slice(0, 7),
              });
            }
          }
        }
      }
    }
  }
  return rows;
}

// ---------- scoring ----------
type Adjust = (r: Row) => { c: number; cMin: number };
const NONE: Adjust = () => ({ c: 1, cMin: 1 });
function parts(r: Row, adj: Adjust): DistParts {
  const raw = adj(r);
  const c = Number.isFinite(raw.c) && raw.c > 0 ? raw.c : 1;
  const cMin = Number.isFinite(raw.cMin) && raw.cMin > 0 ? raw.cMin : 1;
  const mean = r.pr.mean * c;
  return {
    mean,
    variance: mean + (r.pr.variance - r.pr.mean) * c * c,
    rateFinal: r.pr.rateFinal * (c / cMin),
    alpha: r.pr.alpha,
    expMinutes: r.pr.expMinutes * cMin,
  };
}
const logScore = (rows: Row[], adj: Adjust) => {
  let s = 0;
  for (const r of rows) s -= Math.log(Math.max(1e-12, predictive(parts(r, adj), dispersionFor(r.stat)).pmf(r.y)));
  return s / rows.length;
};
const rand = mulberry32(11);
function summary(rows: Row[], adj: Adjust = NONE) {
  let ls = 0, in80 = 0, bias = 0, lineLL = 0, lineN = 0, lineHit = 0, lineP = 0, naiveLL = 0;
  const rel = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  for (const r of rows) {
    const d = predictive(parts(r, adj), dispersionFor(r.stat));
    ls -= Math.log(Math.max(1e-12, d.pmf(r.y)));
    const u = cdf(d, r.y - 1) + rand() * d.pmf(r.y);
    if (u >= 0.1 && u <= 0.9) in80++;
    bias += r.y - d.mean;
    if (r.line !== null) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, 1 - cdf(d, Math.floor(r.line))));
      const o = r.y > r.line ? 1 : 0;
      lineLL -= o ? Math.log(p) : Math.log(1 - p);
      lineN++; lineHit += o; lineP += p;
      const b = rel[Math.min(9, Math.floor(p * 10))];
      b.n++; b.p += p; b.y += o;
      // Naive comparator: Poisson at the player's recent average.
      const lam = r.avg10 as number;
      let c = 0, t = Math.exp(-lam);
      for (let k = 0; k <= Math.floor(r.line); k++) { c += t; t *= lam / (k + 1); }
      const pn = Math.min(1 - 1e-9, Math.max(1e-9, 1 - c));
      naiveLL -= o ? Math.log(pn) : Math.log(1 - pn);
    }
  }
  const n = rows.length;
  return {
    n, ls: ls / n, in80: in80 / n, bias: bias / n,
    lineN, lineLL: lineLL / lineN, naiveLL: naiveLL / lineN, overRate: lineHit / lineN, meanP: lineP / lineN, rel,
  };
}

const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "n/a");
const f4 = (x: number) => (Number.isFinite(x) ? x.toFixed(4) : "n/a");
const pc = (x: number) => `${(100 * x).toFixed(1)}%`;

// ---------- run ----------
const sensSeason = process.argv.includes("--sens-holdout") ? HOLD : FIT;
const quick = process.argv.includes("--quick");
const t0 = Date.now();
const rows = collect([FIT, HOLD], every);
console.log(`collected ${rows.length} stat-rows in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
const md: string[] = [];
md.push(`# Model stress test\n\nTrain seasons only: ${FIT} (fit) and ${HOLD} (holdout), every ${every} game dates, oracle availability. 2025-26 untouched.`);
md.push(`Book-style line: floor(average over the player's last 10 games of 15+ minutes) + 0.5. "Line LL" is the log loss of P(over that line); a constant 50% scores 0.6931; "naive" is a Poisson at the recent average.\n`);

// 1. Overall by stat and season
md.push(`## 1. Overall\n\n| Stat | Season | Rows | Log score | In 80% | Bias | Line rows | Over rate | Mean P(over) | Line LL | Naive LL |\n|---|---|---|---|---|---|---|---|---|---|---|`);
for (const stat of STATS) for (const season of [FIT, HOLD]) {
  const s = summary(rows.filter((r) => r.stat === stat && r.season === season));
  md.push(`| ${stat} | ${season} | ${s.n} | ${f4(s.ls)} | ${pc(s.in80)} | ${f3(s.bias)} | ${s.lineN} | ${pc(s.overRate)} | ${pc(s.meanP)} | ${f4(s.lineLL)} | ${f4(s.naiveLL)} |`);
}

// 2. Reliability against the book-style line
md.push(`\n## 2. Reliability of P(over line), both seasons\n\n| Stat | Bin | Rows | Mean predicted | Observed |\n|---|---|---|---|---|`);
for (const stat of STATS) {
  const s = summary(rows.filter((r) => r.stat === stat));
  s.rel.forEach((b, i) => { if (b.n >= 30) md.push(`| ${stat} | ${i * 10}–${i * 10 + 10}% | ${b.n} | ${pc(b.p / b.n)} | ${pc(b.y / b.n)} |`); });
}

// 3. Slices
const slices: [string, (r: Row) => string][] = [
  ["expected minutes", (r) => (r.pr.expMinutes < 20 ? "<20" : r.pr.expMinutes < 28 ? "20–28" : r.pr.expMinutes < 34 ? "28–34" : "34+")],
  ["matched games", (r) => (r.pr.counts.matched < 10 ? "<10" : r.pr.counts.matched < 20 ? "10–19" : "20+")],
  ["season phase", (r) => (["10", "11"].includes(r.date.slice(5, 7)) ? "Oct–Nov" : ["12", "01"].includes(r.date.slice(5, 7)) ? "Dec–Jan" : "Feb–Apr")],
  ["rotation teammates out", (r) => (r.outTeammates >= 2 ? "2+" : String(r.outTeammates))],
  ["back-to-back", (r) => (r.b2b ? "yes" : "no")],
  ["home/away", (r) => (r.home ? "home" : "away")],
  ["opponent allowance", (r) => (r.opp < 0.97 ? "tough (<0.97)" : r.opp > 1.03 ? "soft (>1.03)" : "average")],
  ["thin sample", (r) => (r.pr.flags.includes("thin_sample") ? "thin" : "not thin")],
];
md.push(`\n## 3. Slices (both seasons)\n\nBias is actual minus predicted mean. A slice with steady bias is a missing feature.\n\n| Slice | Group | Stat | Rows | Log score | In 80% | Bias | Line LL |\n|---|---|---|---|---|---|---|---|`);
for (const [name, key] of slices) {
  const groups = [...new Set(rows.map(key))].sort();
  for (const g of groups) for (const stat of STATS) {
    const s = summary(rows.filter((r) => r.stat === stat && key(r) === g));
    if (s.n >= 200) md.push(`| ${name} | ${g} | ${stat} | ${s.n} | ${f4(s.ls)} | ${pc(s.in80)} | ${f3(s.bias)} | ${f4(s.lineLL)} |`);
  }
}

// 4. Candidate improvements: fit on FIT, judge on HOLD
const fitRows = rows.filter((r) => r.season === FIT);
const holdRows = rows.filter((r) => r.season === HOLD);
const perStat = <T,>(f: (stat: Stat) => T) => Object.fromEntries(STATS.map((s) => [s, f(s)])) as Record<Stat, T>;
interface Candidate { name: string; make: (p: Record<Stat, number>) => Adjust; lo: number; hi: number; neutral: number }
const candidates: Candidate[] = [
  { name: "DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros)", make: (p) => (r) => { const m = p[r.stat] * r.recentMinDnp + (1 - p[r.stat]) * r.pr.expMinutes; const c = Math.max(0.05, m) / r.pr.expMinutes; return { c, cMin: c }; }, lo: 0, hi: 1, neutral: 0 },
  { name: "mean scale (× c)", make: (p) => (r) => ({ c: p[r.stat], cMin: 1 }), lo: 0.9, hi: 1.1, neutral: 1 },
  { name: "opponent allowance (mean × factor^β)", make: (p) => (r) => ({ c: r.opp ** p[r.stat], cMin: 1 }), lo: 0, hi: 2, neutral: 0 },
  { name: "home court (× h at home, ÷ h away)", make: (p) => (r) => ({ c: r.home ? p[r.stat] : 1 / p[r.stat], cMin: 1 }), lo: 0.9, hi: 1.1, neutral: 1 },
  { name: "back-to-back (× b)", make: (p) => (r) => ({ c: r.b2b ? p[r.stat] : 1, cMin: r.b2b ? p[r.stat] : 1 }), lo: 0.85, hi: 1.1, neutral: 1 },
  { name: "recency (rate blend weight w on half-life-8 rate)", make: (p) => (r) => ({ c: (p[r.stat] * r.recencyRate + (1 - p[r.stat]) * r.pr.rateFinal) / r.pr.rateFinal, cMin: 1 }), lo: 0, hi: 1, neutral: 0 },
  { name: "minutes trend (E[M] blend weight w on last-5 minutes)", make: (p) => (r) => { const m = p[r.stat] * r.recentMin + (1 - p[r.stat]) * r.pr.expMinutes; const c = m / r.pr.expMinutes; return { c, cMin: c }; }, lo: 0, hi: 1, neutral: 0 },
];
md.push(`\n## 4. Candidate improvements (fit on ${FIT}, judged on ${HOLD})\n\nΔ is holdout log score minus baseline; negative is better. A candidate is adopted only if it improves the holdout for that stat.\n\n| Candidate | Stat | Fitted value | Fit Δ | Holdout Δ | Adopt |\n|---|---|---|---|---|---|`);
const adopted: { cand: Candidate; params: Record<Stat, number>; use: Record<Stat, boolean> }[] = [];
for (const cand of candidates) {
  const params = perStat((stat) => {
    const rs = fitRows.filter((r) => r.stat === stat);
    return goldenMin((x) => logScore(rs, cand.make({ pts: x, reb: x, ast: x } as Record<Stat, number>)), cand.lo, cand.hi, 1e-3);
  });
  const use = perStat(() => false);
  for (const stat of STATS) {
    const fr = fitRows.filter((r) => r.stat === stat);
    const hr = holdRows.filter((r) => r.stat === stat);
    const adj = cand.make(params);
    const fitD = logScore(fr, adj) - logScore(fr, NONE);
    const holdD = logScore(hr, adj) - logScore(hr, NONE);
    use[stat] = holdD < -1e-4;
    md.push(`| ${cand.name} | ${stat} | ${f3(params[stat])} | ${f4(fitD)} | ${f4(holdD)} | ${use[stat] ? "yes" : "no"} |`);
  }
  adopted.push({ cand, params, use });
}
const combined: Adjust = (r) => {
  let c = 1, cMin = 1;
  for (const a of adopted) {
    if (!a.use[r.stat]) continue;
    const x = a.cand.make(a.params)(r);
    c *= x.c; cMin *= x.cMin;
  }
  return { c, cMin };
};
md.push(`\n### Combined adopted candidates on the ${HOLD} holdout\n\n| Stat | Baseline log score | Combined | Δ | Baseline line LL | Combined line LL | In 80% |\n|---|---|---|---|---|---|---|`);
for (const stat of STATS) {
  const hr = holdRows.filter((r) => r.stat === stat);
  const b = summary(hr), c = summary(hr, combined);
  md.push(`| ${stat} | ${f4(b.ls)} | ${f4(c.ls)} | ${f4(c.ls - b.ls)} | ${f4(b.lineLL)} | ${f4(c.lineLL)} | ${pc(c.in80)} |`);
}
writeFileSync("reports/stress-adopted.json", JSON.stringify(Object.fromEntries(adopted.map((a) => [a.cand.name, { params: a.params, use: a.use }])), null, 2));

// 6. Provisional shrinkage against the book-style line (fit on FIT, judged on HOLD)
const lineObs = (rs: Row[]) => rs.filter((r) => r.line !== null).map((r) => {
  const d = predictive(parts(r, NONE), dispersionFor(r.stat));
  return { p: Math.min(1 - 1e-9, Math.max(1e-9, 1 - cdf(d, Math.floor(r.line as number)))), y: (r.y > (r.line as number) ? 1 : 0) as 0 | 1 };
});
const ll = (os: { p: number; y: 0 | 1 }[], k: number) => os.reduce((t, o) => { const q = k * o.p + (1 - k) * 0.5; return t - (o.y ? Math.log(q) : Math.log(1 - q)); }, 0) / os.length;
const fitObs = lineObs(fitRows), holdObs = lineObs(holdRows);
const shrinkFit = goldenMin((k) => ll(fitObs, k), 0, 1, 1e-4);
md.push(`\n## 6. Provisional shrinkage against the book-style line\n\nSHRINK fit on ${FIT} = **${f3(shrinkFit)}** (until the odds replay fits the real one). Holdout line log loss: no shrink ${f4(ll(holdObs, 1))}, 0.5 placeholder ${f4(ll(holdObs, 0.5))}, fitted ${f4(ll(holdObs, shrinkFit))}.\n\n| Bin (shrunk) | Rows | Mean predicted | Observed |\n|---|---|---|---|`);
const relS = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
for (const o of holdObs) { const q = shrinkFit * o.p + (1 - shrinkFit) * 0.5; const b = relS[Math.min(9, Math.floor(q * 10))]; b.n++; b.p += q; b.y += o.y; }
relS.forEach((b, i) => { if (b.n >= 30) md.push(`| ${i * 10}–${i * 10 + 10}% | ${b.n} | ${pc(b.p / b.n)} | ${pc(b.y / b.n)} |`); });
writeFileSync("rules/provisional-shrink.json", JSON.stringify({ SHRINK: +shrinkFit.toFixed(4), fitted_on: `${FIT} book-style lines (floor of last-10 average + 0.5), box scores only`, holdout_line_ll: { none: ll(holdObs, 1), placeholder: ll(holdObs, 0.5), fitted: ll(holdObs, shrinkFit) } }, null, 2) + "\n");

// 5. Constant sensitivity (one at a time, fit season, every 4th date)
md.push(`\n## 5. Constant sensitivity (${sensSeason}, every 4th date, one change at a time)\n\n| Change | Supported rows | pts log score | reb log score | ast log score |\n|---|---|---|---|---|`);
const base = MODEL as Record<string, number>;
const variants: [string, Record<string, number>][] = quick ? [] : [
  ["baseline", {}],
  ["PRIOR_MINUTES 100", { PRIOR_MINUTES: 100 }], ["PRIOR_MINUTES 400", { PRIOR_MINUTES: 400 }],
  ["MATCHED_POOL_CAP 20", { MATCHED_POOL_CAP: 20 }], ["MATCHED_POOL_CAP 50", { MATCHED_POOL_CAP: 50 }],
  ["ROTATION_MEDIAN_MINUTES 20", { ROTATION_MEDIAN_MINUTES: 20 }], ["ROTATION_MEDIAN_MINUTES 28", { ROTATION_MEDIAN_MINUTES: 28 }],
  ["RETURNING_MIN_MISSES 2", { RETURNING_MIN_MISSES: 2 }], ["RETURNING_MIN_MISSES 5", { RETURNING_MIN_MISSES: 5 }],
  ["MIN_MATCHED_GAMES 3", { MIN_MATCHED_GAMES: 3 }], ["MIN_MATCHED_GAMES 8", { MIN_MATCHED_GAMES: 8 }],
];
const saved = { ...base };
for (const [name, change] of variants) {
  Object.assign(base, saved, change);
  const vr = collect([sensSeason], 4);
  const ls = perStat((stat) => logScore(vr.filter((r) => r.stat === stat), NONE));
  md.push(`| ${name} | ${vr.length / 3} | ${f4(ls.pts)} | ${f4(ls.reb)} | ${f4(ls.ast)} |`);
  console.log(`sensitivity ${name} done`);
}
Object.assign(base, saved);

writeFileSync("reports/stress-test.md", md.join("\n") + "\n");
console.log(`wrote reports/stress-test.md in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
h.close();
