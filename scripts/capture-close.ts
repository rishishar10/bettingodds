// 30-minute capture (paid mode only): one fetch per event still to tip,
// saved with source times, then if-they-sit cards are resolved.
//   CAPTURES_ENABLED=1 node scripts/capture-close.ts [--dry-run]
import { resolveConditional } from "../lib/conditional.ts";
import { POLICY } from "../lib/constants.ts";
import { expectedValue } from "../lib/ev.ts";
import { openHistory } from "../lib/history.ts";
import { paths } from "../lib/publish.ts";
import { matchEvents } from "../lib/slate-inputs.ts";
import { normalizeName } from "../lib/sources/aliases.ts";
import { reportBefore } from "../lib/sources/injuries.ts";
import { fetchEventOdds, listEvents, usage } from "../lib/sources/odds.ts";
import { openStore } from "../lib/store.ts";
import { pacificDate } from "../lib/time.ts";

if (process.env.CAPTURES_ENABLED !== "1") {
  console.log("captures are off (free mode); set CAPTURES_ENABLED=1 on a paid plan");
  process.exit(0);
}
const dryRun = process.argv.includes("--dry-run");
const store = openStore(paths(dryRun).db);
const h = openHistory();
const now = new Date().toISOString();
const boardDate = pacificDate(now);
const pub = store.getPublication(boardDate);
if (!pub) { console.log(`no board for ${boardDate}`); process.exit(0); }

const payload = pub.payload as { conditional: any[]; games: { gameId: string; tipUtc: string }[] };
const upcoming = h.gamesOn(boardDate).filter((g) => Date.parse(g.tipUtc) > Date.parse(now));
const { matched } = matchEvents(upcoming, await listEvents());
for (const { eventId } of matched) {
  const { prices } = await fetchEventOdds(eventId);
  const fetchedAt = new Date().toISOString();
  store.saveObservations(prices.map((p) => ({ ...p, fetchedAt })));
}

// Status changes: the first report time at which the subject is listed out.
const report = await reportBefore(now, { bufferMinutes: 0, earliestHourEt: 5 });
for (const c of payload.conditional.filter((x) => x.stat)) {
  const game = h.db.prepare("SELECT game_id, tip_utc, completed FROM games WHERE date = ? AND (home_id = ? OR away_id = ?)").get(boardDate, c.teamId, c.teamId) as any;
  const row = store.db.prepare("SELECT * FROM conditional_states WHERE board_date = ? AND subject_player_id = ? AND player_id = ? AND stat = ? AND line = ? AND side = ?")
    .get(boardDate, c.subjectPlayerId, c.playerId, c.stat, c.line, c.side) as any;
  // The scenario needs every subject out; the change time is when the last one is listed out.
  let statusChangedAt: string | null = row?.status_changed_at ?? null;
  const subjects: string[] = c.subjectPlayerIds;
  const names = subjects.map((id) => h.db.prepare("SELECT player_name FROM logs WHERE player_id = ? LIMIT 1").get(id) as { player_name: string } | undefined);
  const allOut = names.every((n) => n && report?.entries.some((e) => normalizeName(e.playerName) === normalizeName(n.player_name) && e.status === "out"));
  if (!statusChangedAt && allOut) statusChangedAt = report!.reportTimeUtc;
  const tipped = game && Date.parse(game.tip_utc) <= Date.parse(now);
  let finalStatus: "out" | "active" | null = null;
  if (tipped && game.completed) {
    const tonight = h.logsForGame(game.game_id);
    const anyPlayed = subjects.some((id) => (tonight.find((l) => l.playerId === id)?.minutes ?? 0) > 0);
    finalStatus = anyPlayed ? "active" : "out";
  } else if (statusChangedAt) {
    finalStatus = "out";
  }
  if (!finalStatus && !tipped) {
    store.setConditionalState({ boardDate, subjectPlayerId: c.subjectPlayerId, playerId: c.playerId, stat: c.stat, line: c.line, side: c.side, state: "initially_qualifying", statusChangedAt, injurySourceTime: report?.reportTimeUtc ?? null, oddsSourceTime: c.sourceUpdatedAt, fetchedAt: now, decimal: c.decimal, ev: c.ev });
    continue;
  }
  const obs = store.db.prepare("SELECT decimal, source_updated_at, fetched_at FROM odds_observations WHERE player_name = ? AND stat = ? AND line = ? AND side = ? AND book = ? AND source_updated_at IS NOT NULL")
    .all(c.playerName, c.stat, c.line, c.side, c.book) as any[];
  const prices = obs.map((o) => ({ decimal: o.decimal, sourceUpdatedAt: o.source_updated_at, fetchedAt: o.fetched_at, ev: expectedValue({ win: c.pWinFinal, push: 1 - c.pWinFinal - c.pLossFinal, loss: c.pLossFinal }, o.decimal) }));
  const r = resolveConditional(finalStatus, statusChangedAt, prices, POLICY.EV_MIN);
  // Waiting for a post-news price is not "pulled" until the game tips.
  if (r.state === "pulled" && !tipped) continue;
  store.setConditionalState({ boardDate, subjectPlayerId: c.subjectPlayerId, playerId: c.playerId, stat: c.stat, line: c.line, side: c.side, state: r.state, statusChangedAt, injurySourceTime: report?.reportTimeUtc ?? null, oddsSourceTime: r.price?.sourceUpdatedAt ?? null, fetchedAt: r.price?.fetchedAt ?? now, decimal: r.price?.decimal ?? null, ev: r.price?.ev ?? null });
}
console.log(`captured ${matched.length} events; credits remaining ${usage().remaining ?? "?"}; conditional ${JSON.stringify(store.conditionalCounts())}`);
h.close();
store.close();
