// Grades published rows from box scores and writes grades.json beside the
// snapshots the pages read. Uses the saved line and price; zero minutes voids.
// Live and dry-run boards also record grade events (corrections append, never
// a second bet). Demo boards are graded too: their prices are made up, so only
// calibration means anything, and the pages hide profit.
//   node scripts/grade.ts [--dry-run | --dir data/demo-published]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareClose } from "../lib/clv.ts";
import { gradeProp, profit, summarize, type Result } from "../lib/grade.ts";
import { openHistory } from "../lib/history.ts";
import { paths } from "../lib/publish.ts";
import { openStore } from "../lib/store.ts";

const dryRun = process.argv.includes("--dry-run");
const dirIdx = process.argv.indexOf("--dir");
const P = paths(dryRun);
const dir = dirIdx >= 0 ? process.argv[dirIdx + 1] : P.published;
// Only the live and dry-run folders have a store behind them.
const store = dir === P.published && existsSync(P.db) ? openStore(P.db) : null;
const h = openHistory();
const now = new Date().toISOString();

const indexFile = join(dir, "index.json");
const dates: string[] = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : [];
const grades: Record<string, unknown> = {};
const all: { result: Result | null; decimal: number }[] = [];

for (const boardDate of dates) {
  const board = JSON.parse(readFileSync(join(dir, `${boardDate}.json`), "utf8")) as { rows: any[] };
  for (const row of board.rows) {
    const game = h.db.prepare(
      "SELECT g.game_id, g.completed, g.tip_utc FROM games g WHERE g.date = ? AND g.season_type = 2 AND (g.home_id = ? OR g.away_id = ?)",
    ).get(boardDate, row.teamId, row.teamId) as { game_id: string; completed: number; tip_utc: string } | undefined;
    let result: Result | null = null;
    let minutes = 0;
    let actual = 0;
    if (game?.completed && h.hasLogs(game.game_id)) {
      const log = h.logsForGame(game.game_id).find((l) => l.playerId === row.playerId);
      minutes = log?.minutes ?? 0;
      actual = log ? log[row.stat as "pts" | "reb" | "ast"] : 0;
      result = gradeProp(row.line, row.side, minutes, actual);
      store?.recordGrade(boardDate, row.key, result, minutes, actual, now);
    }
    // Close: last source-timestamped observation before tip, same book and side; any line.
    const close = store && game ? (store.db.prepare(
      `SELECT line, decimal, source_updated_at FROM odds_observations
       WHERE player_name = ? AND stat = ? AND side = ? AND book = ? AND source_updated_at IS NOT NULL AND source_updated_at < ?
       ORDER BY source_updated_at DESC, line = ? DESC LIMIT 1`,
    ).get(row.playerName, row.stat, row.side, row.book, game.tip_utc, row.line) as { line: number; decimal: number } | undefined) : undefined;
    const events = store
      ? store.db.prepare("SELECT kind, result, recorded_at FROM grade_events WHERE board_date = ? AND key = ? ORDER BY id").all(boardDate, row.key)
      : [];
    grades[`${boardDate}|${row.key}`] = {
      result, minutes, actual, profit: result ? profit(result, row.decimal) : null,
      close: close ? compareClose(row.side, row, close) : { kind: "missing_close" },
      events,
    };
    all.push({ result, decimal: row.decimal });
  }
}
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "grades.json"), JSON.stringify({ updatedAt: now, summary: summarize(all), grades }, null, 1));
console.log(`${dir}: ${dates.length} boards, ${JSON.stringify(summarize(all))}`);
h.close();
store?.close();
