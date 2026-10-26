// Grades published rows from box scores and writes grades.json for the pages.
// Uses the saved line and price. Corrections append events; never a second bet.
//   node scripts/grade.ts [--dry-run]
import { compareClose } from "../lib/clv.ts";
import { gradeProp, profit, summarize, type Result } from "../lib/grade.ts";
import { openHistory } from "../lib/history.ts";
import { paths } from "../lib/publish.ts";
import { openStore } from "../lib/store.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const P = paths(dryRun);
const store = openStore(P.db);
const h = openHistory();
const now = new Date().toISOString();

const grades: Record<string, unknown> = {};
const all: { result: Result | null; decimal: number }[] = [];
for (const pub of store.listPublications()) {
  const payload = pub.payload as { rows: any[]; games: { gameId: string; tipUtc: string }[] };
  for (const row of payload.rows) {
    const game = h.db.prepare(
      "SELECT g.game_id, g.completed, g.tip_utc FROM games g WHERE g.date = ? AND (g.home_id = ? OR g.away_id = ?)",
    ).get(pub.boardDate, row.teamId, row.teamId) as { game_id: string; completed: number; tip_utc: string } | undefined;
    let result: Result | null = null;
    let minutes = 0;
    let actual = 0;
    if (game?.completed) {
      const log = h.logsForGame(game.game_id).find((l) => l.playerId === row.playerId);
      minutes = log?.minutes ?? 0;
      actual = log ? log[row.stat as "pts" | "reb" | "ast"] : 0;
      result = gradeProp(row.line, row.side, minutes, actual);
      store.recordGrade(pub.boardDate, row.key, result, minutes, actual, now);
    }
    // Close: last source-timestamped observation before tip, same book, side; any line.
    const close = game ? (store.db.prepare(
      `SELECT line, decimal, source_updated_at FROM odds_observations
       WHERE player_name = ? AND stat = ? AND side = ? AND book = ? AND source_updated_at IS NOT NULL AND source_updated_at < ?
       ORDER BY source_updated_at DESC, line = ? DESC LIMIT 1`,
    ).get(row.playerName, row.stat, row.side, row.book, game.tip_utc, row.line) as { line: number; decimal: number } | undefined) : undefined;
    const events = store.db.prepare("SELECT kind, result, recorded_at FROM grade_events WHERE board_date = ? AND key = ? ORDER BY id").all(pub.boardDate, row.key);
    grades[`${pub.boardDate}|${row.key}`] = {
      result, minutes, actual, profit: result ? profit(result, row.decimal) : null,
      close: close ? compareClose(row.side, row, close) : { kind: "missing_close" },
      events,
    };
    all.push({ result, decimal: row.decimal });
  }
}
mkdirSync(P.published, { recursive: true });
writeFileSync(join(P.published, "grades.json"), JSON.stringify({ updatedAt: now, summary: summarize(all), grades }, null, 1));
console.log(JSON.stringify(summarize(all)));
h.close();
store.close();
