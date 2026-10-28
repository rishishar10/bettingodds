// Live scorecard: every evaluated prop on real-price boards (not just the
// picks), scored against what happened. Compares the model's probability with
// the books' own no-vig probability on the same line, and fits how much weight
// the model deserves next to the price once there is enough data.
//   node scripts/live-scorecard.ts [--dry-run]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { noVigOver } from "../lib/ev.ts";
import { openHistory } from "../lib/history.ts";
import { paths } from "../lib/publish.ts";
import { clusterBootstrap, fitBlendWeight, logLoss } from "../lib/stats.ts";
import { openStore } from "../lib/store.ts";
import type { RawPrice } from "../lib/sources/odds.ts";

const MIN_LINES = 500;
const dryRun = process.argv.includes("--dry-run");
const P = paths(dryRun);
if (!existsSync(P.db)) {
  console.log(`no real-price boards yet (${P.db})`);
  process.exit(0);
}
const store = openStore(P.db);
const h = openHistory();

interface Line { date: string; gameId: string; playerId: string; pModel: number; pRaw: number; pMarket: number; won: 0 | 1 }
const lines: Line[] = [];
const dates = (store.db.prepare("SELECT DISTINCT board_date FROM evaluated_props ORDER BY board_date").all() as { board_date: string }[]).map((r) => r.board_date);

for (const date of dates) {
  const pricesFile = join(P.published, `prices-${date}.json`);
  if (!existsSync(pricesFile)) continue;
  const prices = JSON.parse(readFileSync(pricesFile, "utf8")) as RawPrice[];
  const overs = store.db.prepare("SELECT * FROM evaluated_props WHERE board_date = ? AND side = 'over'").all(date) as any[];
  for (const r of overs) {
    if (Number.isInteger(r.line)) continue; // half-point lines only: two outcomes
    // Market: proportional no-vig per book with both sides on this line, averaged across books.
    const same = prices.filter((p) => p.playerName === r.player_name && p.stat === r.stat && p.line === r.line);
    const books = [...new Set(same.map((p) => p.book))];
    const nv = books.flatMap((b) => {
      const o = same.find((p) => p.book === b && p.side === "over");
      const u = same.find((p) => p.book === b && p.side === "under");
      return o && u ? [noVigOver(o.decimal, u.decimal)] : [];
    });
    if (!nv.length) continue;
    const game = h.db.prepare("SELECT game_id, completed FROM games WHERE date = ? AND season_type = 2 AND game_id IN (SELECT game_id FROM logs WHERE player_id = ?)").get(date, r.player_id) as { game_id: string } | undefined;
    if (!game) continue;
    const log = h.logsForGame(game.game_id).find((l) => l.playerId === r.player_id);
    if (!log || log.minutes <= 0) continue; // void
    const actual = log[r.stat as "pts" | "reb" | "ast"];
    lines.push({
      date, gameId: game.game_id, playerId: r.player_id,
      pModel: r.final_win / (r.final_win + r.final_loss),
      pRaw: r.raw_win / (r.raw_win + r.raw_loss),
      pMarket: nv.reduce((a, b) => a + b, 0) / nv.length,
      won: actual > r.line ? 1 : 0,
    });
  }
}

const ys = lines.map((l) => l.won);
const modelLL = lines.length ? logLoss(lines.map((l) => l.pModel), ys) : NaN;
const marketLL = lines.length ? logLoss(lines.map((l) => l.pMarket), ys) : NaN;
const w = lines.length >= 30
  ? clusterBootstrap(lines, (l) => l.gameId, (rs) => fitBlendWeight(rs.map((l) => ({ pModel: l.pRaw, pMarket: l.pMarket, won: l.won }))), { reps: 300 })
  : null;
const perNight = dates.map((d) => {
  const ls = lines.filter((l) => l.date === d);
  return ls.length ? { date: d, n: ls.length, model: logLoss(ls.map((l) => l.pModel), ls.map((l) => l.won)), market: logLoss(ls.map((l) => l.pMarket), ls.map((l) => l.won)) } : null;
}).filter(Boolean) as { date: string; n: number; model: number; market: number }[];

const ready = lines.length >= MIN_LINES;
const verdict = !lines.length ? "No scored lines yet."
  : !ready ? `${lines.length} of the ${MIN_LINES} lines needed before this says anything. One night is noise.`
  : w && w.lo > 0 ? "The model adds information beyond the books' prices."
  : "No evidence yet that the model adds information beyond the books' prices.";
const out = { updatedAt: new Date().toISOString(), lines: lines.length, minLines: MIN_LINES, modelLogLoss: modelLL, marketLogLoss: marketLL, w, ready, verdict, perNight };
writeFileSync(join(P.published, "scorecard.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ lines: lines.length, modelLL: +modelLL.toFixed(4), marketLL: +marketLL.toFixed(4), w: w && { est: +w.estimate.toFixed(3), lo: +w.lo.toFixed(3), hi: +w.hi.toFixed(3) }, verdict }, null, 1));
h.close();
store.close();
