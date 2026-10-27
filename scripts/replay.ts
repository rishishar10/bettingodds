// Replay pipeline.
//   node scripts/replay.ts plan  <train|test> [--availability report|oracle]   credits needed (cache misses)
//   node scripts/replay.ts collect <train|test> [--availability ...] [--max-credits N] [--dates a,b]
//   node scripts/replay.ts fit                                              SHRINK, w, grid on train
//   node scripts/replay.ts test [--post-hoc]                                score the test season once
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateSlate } from "../lib/board.ts";
import { POLICY } from "../lib/constants.ts";
import { evaluateGate, type GateReport, type ReplayRow } from "../lib/gate.ts";
import { summarize } from "../lib/grade.ts";
import { hashOf, sha256 } from "../lib/hash.ts";
import { openHistory } from "../lib/history.ts";
import { coverageOf, hasDay, loadDays, saveDay, saveSkip, type Coverage, type ReplayDay } from "../lib/replay-data.ts";
import { scoreDay } from "../lib/replay-score.ts";
import { guardTestRun, loadRule, oddsNoteReady, realGuardEnv, writeTestLock } from "../lib/rule.ts";
import { availabilityFor, injuryInputs, matchEvents, slateRoster } from "../lib/slate-inputs.ts";
import { fetchHistoricalEventOdds, listHistoricalEvents, usage, type RawPrice } from "../lib/sources/odds.ts";
import { clusterBootstrap, fitBlendWeight, fitShrink, mean, widerInterval, type Interval } from "../lib/stats.ts";
import { boardInstant } from "../lib/time.ts";
import type { PriceObs } from "../lib/rank.ts";

const [cmd, modeArg] = process.argv.slice(2);
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const { rule } = loadRule();
const seasons = rule.seasons as { train: { seasons: string[]; every_nth_game_date: number }; test: { season: string } };
const h = openHistory();

/** Dates the rule says a mode covers: train is every nth game date of both prior seasons. */
function ruleDates(mode: "train" | "test"): string[] {
  if (mode === "train")
    return seasons.train.seasons.flatMap((s) => h.gameDates(s).filter((_, i) => i % seasons.train.every_nth_game_date === 0));
  return h.gameDates(seasons.test.season);
}

/** Rule dates with at least one completed game tipping after the 8:00am snapshot. */
function expectedDates(mode: "train" | "test"): string[] {
  return ruleDates(mode).filter((d) => h.gamesOn(d).some((g) => g.completed && Date.parse(g.tipUtc) > Date.parse(boardInstant(d))));
}

function datesFor(mode: "train" | "test"): string[] {
  const only = flag("dates");
  return only ? only.split(",") : expectedDates(mode);
}

function requireCoverage(mode: "train" | "test", availability: string): Coverage {
  const c = coverageOf(mode, availability, expectedDates(mode));
  if (c.missing.length) {
    console.error(`refusing: ${mode}/${availability} is missing ${c.missing.length} of ${c.expected} dates (first: ${c.missing.slice(0, 5).join(", ")}). Run collect until every date is collected or skipped with a reason.`);
    process.exit(1);
  }
  return c;
}

const ODDS_CACHE = "data/cache/odds";
const cachedOdds = (eventId: string, at: string) => existsSync(join(ODDS_CACHE, "event-odds", eventId, `${at.replaceAll(":", "")}.json`));
const cachedEvents = (at: string) => existsSync(join(ODDS_CACHE, "events", `${at.replaceAll(":", "")}.json`));
const closeAt = (tipUtc: string) => new Date(Date.parse(tipUtc) - 10 * 60000).toISOString();

async function collect(mode: "train" | "test", availability: "oracle" | "report", plan: boolean) {
  if (!plan) {
    const ready = oddsNoteReady();
    if (!ready.ok) {
      console.error(`refusing the historical pull: ${ready.reason}`);
      process.exit(1);
    }
  }
  const maxCredits = Number(flag("max-credits") ?? Infinity);
  let planned = 0;
  let spentEstimate = 0;
  const wantClose = mode === "test";
  for (const date of datesFor(mode)) {
    if (!plan && hasDay(mode, availability, date)) continue;
    const boardUtc = boardInstant(date);
    const games = h.gamesOn(date).filter((g) => g.completed && Date.parse(g.tipUtc) > Date.parse(boardUtc));
    if (games.length === 0) continue;
    if (plan) {
      if (!cachedEvents(boardUtc)) planned += 1;
      // Without the events list, assume one event per game.
      planned += games.length * (wantClose ? 60 : 30);
      continue;
    }
    if (spentEstimate + 1 + games.length * (wantClose ? 60 : 30) > maxCredits) {
      console.log(`stopping before ${date}: --max-credits ${maxCredits} would be exceeded`);
      break;
    }
    if (!cachedEvents(boardUtc)) spentEstimate += 1;
    const events = await listHistoricalEvents(boardUtc);
    const { matched, missing } = matchEvents(games, events);
    if (matched.length === 0) {
      saveSkip(mode, availability, date, `no odds events matched (${missing.join(", ")})`);
      continue;
    }
    const prices: RawPrice[] = [];
    const closesRaw: RawPrice[] = [];
    const missingClose: string[] = [];
    for (const { game, eventId } of matched) {
      if (!cachedOdds(eventId, boardUtc)) spentEstimate += 30;
      const m = await fetchHistoricalEventOdds(eventId, boardUtc);
      if (Date.parse(m.snapshotUtc) > Date.parse(boardUtc)) throw new Error(`price newer than board: ${eventId} ${m.snapshotUtc}`);
      prices.push(...m.prices);
      if (wantClose) {
        const at = closeAt(game.tipUtc);
        if (!cachedOdds(eventId, at)) spentEstimate += 30;
        const c = await fetchHistoricalEventOdds(eventId, at);
        if (c.prices.length === 0) missingClose.push(eventId);
        closesRaw.push(...c.prices);
      }
    }

    const roster = slateRoster(h, matched.map((m) => m.game), date);
    const injuries = availability === "report" ? await injuryInputs(boardUtc) : null;
    const stats = { unmatchedInjuryNames: [], teamsUnresolved: [] };
    const avail = availabilityFor(availability, h, date, roster, injuries, stats);
    if (!avail) {
      console.log(`${date}: no injury report before the snapshot; skipped`);
      saveSkip(mode, availability, date, "no injury report before the snapshot");
      continue;
    }
    const slate = evaluateSlate({
      boardDate: date, buildTimeUtc: boardUtc, games: matched, prices, history: h, availability: avail,
      SHRINK: 1, evMin: POLICY.EV_MIN, maxAgeMinutes: POLICY.ODDS_MAX_AGE_MINUTES,
    });
    const closes: PriceObs[] = [];
    for (const c of closesRaw) {
      const pid = slate.nameToPlayer.get(`${c.eventId}|${c.playerName}`);
      if (pid) closes.push({ ...c, playerId: pid });
    }
    const results: ReplayDay["results"] = {};
    for (const [pid, t] of slate.teamOf) {
      const l = h.logsForGame(t.gameId).find((x) => x.playerId === pid);
      results[pid] = l ? { minutes: l.minutes, pts: l.pts, reb: l.reb, ast: l.ast } : { minutes: 0, pts: 0, reb: 0, ast: 0 };
    }
    const projections: ReplayDay["projections"] = {};
    for (const [k, p] of slate.projections) projections[k] = { mean: p.mean, variance: p.variance, rateFinal: p.rateFinal, alpha: p.alpha, expMinutes: p.expMinutes, flags: p.flags, matched: p.counts.matched };
    saveDay(mode, {
      boardDate: date, boardUtc, availability,
      injuryReport: injuries?.morning ? { url: injuries.morning.url, timeUtc: injuries.morning.reportTimeUtc } : null,
      games: matched.map(({ game, eventId }) => ({ gameId: game.gameId, eventId, tipUtc: game.tipUtc, homeId: game.home.id, awayId: game.away.id })),
      observations: slate.observations, closes, projections,
      teamOf: Object.fromEntries(slate.teamOf), results, coverage: slate.coverage, unmatchedNames: slate.unmatchedNames,
      missingOdds: missing, missingClose,
    });
    console.log(`${date}: ${matched.length} events, ${slate.observations.length} obs, supported ${slate.coverage.supported}, credits≈${spentEstimate}, remaining ${usage().remaining ?? "?"}`);
  }
  if (plan) console.log(`${mode}: about ${planned} credits for uncached snapshots`);
}

const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const iv = (i: Interval | null, d = 3) => (i ? `${fmt(i.estimate, d)} [${fmt(i.lo, d)}, ${fmt(i.hi, d)}]` : "n/a");

function scoreAll(days: ReplayDay[], SHRINK: number, evMin: number): ReplayRow[] {
  return days.flatMap((d) => scoreDay(d, SHRINK, evMin, POLICY.ODDS_MAX_AGE_MINUTES));
}

function fit() {
  const availability = loadDays("train", "report").length ? "report" : "oracle";
  const coverage = requireCoverage("train", availability);
  const days = loadDays("train", availability);
  if (!days.length) throw new Error("no train days collected");
  const rows = scoreAll(days, 1, POLICY.EV_MIN);
  const decisive = rows.filter((r) => r.side === "over" && (r.result === "win" || r.result === "loss"));
  const SHRINK = fitShrink(decisive.map((r) => ({ pModel: r.pRawConditional, won: r.result === "win" ? 1 : 0 })));
  const wRows = rows.filter((r) => r.side === "over" && !Number.isInteger(r.line) && r.opposingDecimal && (r.result === "win" || r.result === "loss"))
    .map((r) => ({ gameId: r.gameId, playerId: r.playerId, pModel: r.pRawConditional, pMarket: (1 / r.decimal) / (1 / r.decimal + 1 / (r.opposingDecimal as number)), won: (r.result === "win" ? 1 : 0) as 0 | 1 }));
  const w = widerInterval(
    clusterBootstrap(wRows, (r) => r.gameId, fitBlendWeight, { reps: 500 }),
    clusterBootstrap(wRows, (r) => r.playerId, fitBlendWeight, { reps: 500, seed: 7 }),
  );
  const nights = new Set(days.map((d) => d.boardDate)).size;
  const grid = POLICY.EV_GRID.map((t) => {
    const sel = scoreAll(days, SHRINK, t).filter((r) => r.selected);
    const s = summarize(sel.map((r) => ({ result: r.result, decimal: r.decimal })));
    const settled = sel.filter((r) => r.result !== "void").map((r) => ({ ...r, pnl: r.result === "win" ? r.decimal - 1 : r.result === "loss" ? -1 : 0 }));
    const roi = clusterBootstrap(settled, (r) => r.gameId, (rs) => mean(rs.map((r) => r.pnl)), { reps: 1000 });
    return `| ${(t * 100).toFixed(0)}% | ${sel.length} | ${(sel.length / nights).toFixed(2)} | ${s.settled} | ${s.voids} | ${iv(roi)} |`;
  });
  writeFileSync("rules/fitted.json", JSON.stringify({ SHRINK, fitted_on: `train ${seasons.train.seasons.join(", ")} every ${seasons.train.every_nth_game_date} game dates, ${availability} availability`, rows: decisive.length }, null, 2) + "\n");
  const md = `# Train fit

Rule hash: \`${hashOf(rule)}\`  ·  availability: **${availability}**  ·  nights: ${nights}
Coverage: ${coverage.collected} collected, ${Object.keys(coverage.skipped).length} skipped with a reason, of ${coverage.expected} expected train dates.

SHRINK = **${fmt(SHRINK, 4)}**, fit on conditional log loss over ${decisive.length} decisive over-side props.

Blend weight w (raw model vs no-vig, ${wRows.length} half-point props, wider of game/player cluster bootstrap): **${iv(w)}**.
${w.lo > 0 ? "The model adds information beyond the price on train." : "On train the interval includes 0: no evidence the model adds information beyond the price."}

Train has no closing snapshots, so CLV is test-only. ROI here is the weakest number and is in-sample for SHRINK.

| EV bar | Rows | Rows/night | Settled | Voids | ROI per unit [95% game bootstrap] |
|---|---|---|---|---|---|
${grid.join("\n")}

The live bar stays ${POLICY.EV_MIN * 100}% by policy regardless of this grid.
`;
  writeFileSync("reports/train.md", md);
  console.log(md);
}

function gateSection(name: string, r: GateReport, postHoc: boolean): string {
  return `## ${name}

- Half-point props in log loss: ${r.halfPointRows} (excluded for a missing/stale/unmatched side: ${r.excludedFromLogLoss})
- Model log loss ${fmt(r.modelLogLoss, 4)} vs no-vig market ${fmt(r.marketLogLoss, 4)}; ΔLL ${iv(r.deltaLL, 4)} (margin ${POLICY.DLL_MARGIN}, not gating)
- Blend weight w: ${iv(r.w)} → ${r.pass.wAboveZero ? "**above 0**" : "not above 0"}
- Selected rows at ${POLICY.EV_MIN * 100}%: ${r.selectedRows}; with a same-line close: ${r.sameLineCloseRows} (${(r.sameLineShare * 100).toFixed(1)}%)
- Same-line CLV (ratio): ${iv(r.clv, 4)} over ${r.concentration.clvGames} games → ${r.pass.clvAboveZero ? "**lower bound above 0**" : "lower bound not above 0"}${r.pass.enoughGames ? "" : ` · **fewer than ${POLICY.MIN_CLV_GAMES} games: fails**`}
- No-vig CLV (both closing sides): ${iv(r.clvNoVig, 4)}
- Line moves on selected rows: toward ${r.lineMoves.toward}, away ${r.lineMoves.away}, toward share ${iv(r.lineMoves.towardShare)}
- ROI per unit (weakest): ${iv(r.roi)}
- Concentration: ${r.concentration.uniquePlayers} players, ${r.concentration.uniqueTeams} teams, ${r.concentration.uniqueGames} games with a selected row, ${r.concentration.gamesWithMany} games with 3+
- By month: ${JSON.stringify(r.concentration.byMonth)} · by stat: ${JSON.stringify(r.concentration.byStat)}
- Gate conditions: w ${r.pass.wAboveZero ? "pass" : "fail"}, CLV ${r.pass.clvAboveZero ? "pass" : "fail"}, games ${r.pass.enoughGames ? "pass" : "fail"}${postHoc ? " · post-hoc run: cannot earn demonstrated edge" : ""}
`;
}

function dataHash(trainDays: ReplayDay[], testByAvail: Record<string, ReplayDay[]>): { hash: string; parts: Record<string, string> } {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const logsHash = (season: string) => {
    const rows = h.db.prepare("SELECT game_id, player_id, minutes, pts, reb, ast FROM logs WHERE season = ? ORDER BY game_id, player_id").all(season);
    return sha256(JSON.stringify(rows));
  };
  const parts: Record<string, string> = {
    odds_dataset: hashOf([...trainDays, ...Object.values(testByAvail).flat()].map((d) => [d.boardDate, d.availability, d.observations.length, d.closes.length])),
    coverage: hashOf([...trainDays, ...Object.values(testByAvail).flat()].map((d) => [d.boardDate, d.coverage, d.missingOdds, d.missingClose])),
    boxscores_train: sha256(seasons.train.seasons.map(logsHash).join()),
    boxscores_test: logsHash(seasons.test.season),
    injury_archive: hashOf((testByAvail.report ?? []).map((d) => d.injuryReport)),
    aliases: sha256(readFileSync("lib/sources/aliases.ts", "utf8")),
    train_features: hashOf(trainDays.map((d) => d.projections)),
    test_features: hashOf(Object.values(testByAvail).flat().map((d) => d.projections)),
    test_outcomes: hashOf(Object.values(testByAvail).flat().map((d) => d.results)),
    code_commit: commit,
  };
  return { hash: hashOf(parts), parts };
}

function test() {
  const postHoc = process.argv.includes("--post-hoc");
  const guard = guardTestRun(rule, realGuardEnv, { postHoc });
  if (!guard.ok) {
    console.error(`refusing to score the test season: ${guard.reason}`);
    process.exit(1);
  }
  if (!existsSync("rules/fitted.json")) throw new Error("run fit first and commit rules/fitted.json");
  // Both replays must cover the whole test season before anything is scored or locked.
  const cov = { report: requireCoverage("test", "report"), oracle: requireCoverage("test", "oracle") };
  const { SHRINK } = JSON.parse(readFileSync("rules/fitted.json", "utf8"));
  const testByAvail: Record<string, ReplayDay[]> = { report: loadDays("test", "report"), oracle: loadDays("test", "oracle") };
  const results: Record<string, GateReport> = {};
  const grids: string[] = [];
  for (const [avail, days] of Object.entries(testByAvail)) {
    if (!days.length) continue;
    results[avail] = evaluateGate(scoreAll(days, SHRINK, POLICY.EV_MIN), { minClvGames: POLICY.MIN_CLV_GAMES });
    for (const t of POLICY.EV_GRID) {
      const g = evaluateGate(scoreAll(days, SHRINK, t), { minClvGames: POLICY.MIN_CLV_GAMES, reps: 1000 });
      grids.push(`| ${avail} | ${(t * 100).toFixed(0)}% | ${g.selectedRows} | ${iv(g.clv, 4)} | ${iv(g.roi)} |`);
    }
  }
  const trainDays = loadDays("train", "report").length ? loadDays("train", "report") : loadDays("train", "oracle");
  const data = dataHash(trainDays, testByAvail);
  const report = results.report;
  const demonstratedEdge = !postHoc && Boolean(report?.pass.demonstratedEdge);
  const label = demonstratedEdge ? "demonstrated edge" : "disagreement only, no demonstrated edge";
  const md = `# Test season ${seasons.test.season}${postHoc ? " (POST-HOC)" : ""}

Rule hash: \`${guard.hash}\`
Data hash: \`${data.hash}\`
SHRINK: ${fmt(SHRINK, 4)} · EV bar ${POLICY.EV_MIN * 100}% · scored ${new Date().toISOString()}

**Launch label: ${label}.**
${report ? "" : "No report-availability replay exists, so the oracle result is an upper bound only and the label cannot be demonstrated edge."}

${report ? gateSection("Morning injury report availability (gating)", report, postHoc) : ""}
${results.oracle ? gateSection("Oracle availability: an upper bound (not gating)", results.oracle, postHoc) : ""}
The oracle replay scores players whose teammates were questionable or doubtful, which the live board skips; the two populations differ.

## Threshold grid (reported; the live bar stays ${POLICY.EV_MIN * 100}%)

| Availability | EV bar | Selected | CLV | ROI |
|---|---|---|---|---|
${grids.join("\n")}

## Coverage

${Object.entries(cov).map(([k, c]) => `- ${k}: ${c.collected} collected, ${Object.keys(c.skipped).length} skipped of ${c.expected} expected dates${Object.keys(c.skipped).length ? ` (${Object.entries(c.skipped).slice(0, 10).map(([d, r]) => `${d}: ${r}`).join("; ")})` : ""}`).join("\n")}

## Data hash parts

${Object.entries(data.parts).map(([k, v]) => `- ${k}: \`${v}\``).join("\n")}
`;
  const out = postHoc ? `reports/test-posthoc-${Date.now()}.md` : "reports/test.md";
  writeFileSync(out, md);
  writeFileSync("reports/gate-result.json", JSON.stringify({ label, demonstratedEdge, ruleHash: guard.hash, dataHash: data.hash, SHRINK, postHoc }, null, 2) + "\n");
  if (!postHoc) writeTestLock({ scoredAt: new Date().toISOString(), ruleHash: guard.hash, dataHash: data.hash });
  console.log(md);
}

if (cmd === "plan" || cmd === "collect") {
  const mode = modeArg as "train" | "test";
  if (mode !== "train" && mode !== "test") throw new Error("mode must be train or test");
  await collect(mode, (flag("availability") ?? "report") as "oracle" | "report", cmd === "plan");
} else if (cmd === "fit") fit();
else if (cmd === "test") test();
else console.log("usage: replay.ts plan|collect <train|test> | fit | test [--post-hoc]");
h.close();
