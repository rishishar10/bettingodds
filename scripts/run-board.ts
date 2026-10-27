// The 8:00am Pacific job: one fetch of every prop per event, rank once,
// publish that ranking or fail. A failed run leaves the previous board up.
//   node scripts/run-board.ts [--date YYYY-MM-DD] [--dry-run]
import { existsSync } from "node:fs";
import { availabilitySnapshot, boardRows, emptyReason, evaluateSlate } from "../lib/board.ts";
import { FREE_PLAN, POLICY } from "../lib/constants.ts";
import { datesUntilReset, shouldBuildTonight } from "../lib/credits.ts";
import { openHistory } from "../lib/history.ts";
import { modelState, paths, writePrices, writeSnapshot } from "../lib/publish.ts";
import { availabilityFor, injuryInputs, matchEvents, slateRoster } from "../lib/slate-inputs.ts";
import { scoreboard } from "../lib/sources/espn.ts";
import { fetchEventOdds, listEvents, usage, type RawPrice } from "../lib/sources/odds.ts";
import { openStore } from "../lib/store.ts";
import { boardInstant, pacificDate } from "../lib/time.ts";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const dryRun = process.argv.includes("--dry-run");
const buildTimeUtc = new Date().toISOString();
const boardDate = arg("date") ?? pacificDate(buildTimeUtc);
const P = paths(dryRun);

if (!dryRun && !existsSync("reports/test.md")) {
  console.error("The live board does not start until the test-season report (reports/test.md) is in the repo. Use --dry-run.");
  process.exit(1);
}

if (!arg("date") && Date.parse(buildTimeUtc) < Date.parse(boardInstant(boardDate))) {
  console.log(`before 8:00am Pacific on ${boardDate}; nothing to do`);
  process.exit(0);
}

const store = openStore(P.db);
if (store.getPublication(boardDate)) {
  console.log(`board for ${boardDate} already published; nothing to do`);
  store.logRun(boardDate, buildTimeUtc, "skipped", "already published");
  process.exit(0);
}

const h = openHistory();
try {
  const boardUtc = boardInstant(boardDate);
  const games = (await scoreboard(boardDate.replaceAll("-", ""), { useCache: false }))
    .filter((g) => g.seasonType === 2 && g.date === boardDate && Date.parse(g.tipUtc) > Date.parse(boardUtc));
  for (const g of games) h.upsertGame(g);

  const { matched, missing } = games.length ? matchEvents(games, await listEvents()) : { matched: [], missing: [] };

  // Free plan: keep credits for fuller slates. The events list above is free and reports remaining credits.
  const paid = process.env.ODDS_PAID_PLAN === "1";
  let skipReason: string | null = null;
  if (!paid && matched.length) {
    const remaining = usage().remaining ?? 0;
    const resetDay = Number(process.env.ODDS_CYCLE_DAY ?? FREE_PLAN.CYCLE_RESET_DAY);
    const upcoming: number[] = [];
    for (const d of datesUntilReset(boardDate, resetDay)) {
      upcoming.push((await scoreboard(d.replaceAll("-", ""), { useCache: false })).filter((g) => g.seasonType === 2).length);
    }
    const plan = shouldBuildTonight(matched.length, upcoming, remaining);
    if (!plan.build) skipReason = plan.reason;
    else console.log(`credit plan: build tonight (${matched.length} games, ${remaining} credits left, ${upcoming.length} more days in the cycle)`);
  }
  if (skipReason) {
    const model = modelState();
    const teams: Record<string, string> = {};
    for (const g of games) { teams[g.home.id] = g.home.abbr; teams[g.away.id] = g.away.abbr; }
    const payload = {
      boardDate, publishedAt: new Date().toISOString(), buildTimeUtc, modelVersion: model.modelVersion, label: model.label,
      shrunk: true, SHRINK: model.SHRINK, ruleHash: model.ruleHash, evMin: POLICY.EV_MIN, injury: null,
      games: games.map((g) => ({ gameId: g.gameId, tipUtc: g.tipUtc, home: g.home.abbr, away: g.away.abbr, hasOdds: false, eventId: null })),
      teams, rows: [], conditional: [], coverage: {}, unmatchedNames: 0, anomalies: [], emptyReason: skipReason,
      availability: {}, missingEvents: missing, closeCollected: false, dryRun, skipped: true,
    };
    store.publish({ boardDate, publishedAt: payload.publishedAt, modelVersion: model.modelVersion, ruleHash: model.ruleHash, payload }, [], []);
    writeSnapshot(P.published, boardDate, payload);
    store.logRun(boardDate, buildTimeUtc, "skipped", skipReason);
    console.log(`skipped ${boardDate}: ${skipReason}`);
    process.exit(0);
  }

  const prices: RawPrice[] = [];
  for (const { eventId } of matched) {
    const { prices: p } = await fetchEventOdds(eventId); // any failure fails the run
    prices.push(...p);
  }
  const fetchedAt = new Date().toISOString();
  store.saveObservations(prices.map((p) => ({ ...p, fetchedAt })));

  const injuries = await injuryInputs(buildTimeUtc);
  if (games.length && !injuries.morning) throw new Error("no injury report available before the build");
  const roster = slateRoster(h, matched.map((m) => m.game), boardDate);
  const stats = { unmatchedInjuryNames: [] as string[], teamsUnresolved: [] as string[] };
  const avail = games.length ? availabilityFor("report", h, boardDate, roster, injuries, stats) : () => { throw new Error("no games"); };
  const model = modelState();
  const slate = evaluateSlate({
    boardDate, buildTimeUtc: fetchedAt, games: matched, prices, history: h, availability: avail!,
    SHRINK: model.SHRINK, evMin: POLICY.EV_MIN, maxAgeMinutes: POLICY.ODDS_MAX_AGE_MINUTES,
  });
  const rows = boardRows(slate, model.SHRINK, POLICY.EV_MIN);
  const teams: Record<string, string> = {};
  for (const g of games) { teams[g.home.id] = g.home.abbr; teams[g.away.id] = g.away.abbr; }

  const payload = {
    boardDate,
    publishedAt: new Date().toISOString(),
    buildTimeUtc: fetchedAt,
    modelVersion: model.modelVersion,
    label: model.label,
    shrunk: true,
    SHRINK: model.SHRINK,
    ruleHash: model.ruleHash,
    evMin: POLICY.EV_MIN,
    injury: injuries.morning ? { url: injuries.morning.url, timeUtc: injuries.morning.reportTimeUtc, teamsUnresolved: stats.teamsUnresolved } : null,
    games: games.map((g) => ({ gameId: g.gameId, tipUtc: g.tipUtc, home: g.home.abbr, away: g.away.abbr, hasOdds: matched.some((m) => m.game.gameId === g.gameId), eventId: matched.find((m) => m.game.gameId === g.gameId)?.eventId ?? null })),
    teams,
    rows,
    conditional: slate.conditional,
    availability: games.length ? availabilitySnapshot(matched, avail!) : {},
    coverage: slate.coverage,
    unmatchedNames: slate.unmatchedNames.length,
    anomalies: slate.rank.anomalies,
    emptyReason: emptyReason(slate, games.length),
    missingEvents: missing,
    closeCollected: process.env.CAPTURES_ENABLED === "1",
    dryRun,
  };
  store.publish(
    { boardDate, publishedAt: payload.publishedAt, modelVersion: model.modelVersion, ruleHash: model.ruleHash, payload },
    slate.rank.evaluated,
    slate.unsupported.map((u) => ({ playerId: u.playerId, reason: u.reason, detail: u.detail })),
  );
  for (const c of slate.conditional) {
    if (c.stat && c.line !== null && c.side)
      store.setConditionalState({ boardDate, subjectPlayerId: c.subjectPlayerId, playerId: c.playerId, stat: c.stat, line: c.line, side: c.side, state: "initially_qualifying", oddsSourceTime: c.sourceUpdatedAt, fetchedAt, decimal: c.decimal, ev: c.ev });
  }
  writePrices(P.published, boardDate, prices);
  writeSnapshot(P.published, boardDate, payload);
  store.logRun(boardDate, buildTimeUtc, "published", `${rows.length} rows`);
  console.log(`published ${boardDate}: ${rows.length} rows, ${slate.rank.evaluated.length} evaluated, ${slate.conditional.length} if-they-sit cards, coverage ${JSON.stringify(slate.coverage)}, credits remaining ${usage().remaining ?? "?"}`);
  if (payload.emptyReason) console.log(`empty board: ${payload.emptyReason}`);
} catch (e) {
  store.logRun(boardDate, buildTimeUtc, "failed", (e as Error).message);
  console.error(`run failed; previous board stays up: ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  h.close();
  store.close();
}
