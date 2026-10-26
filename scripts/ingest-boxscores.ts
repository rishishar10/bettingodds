// Pulls ESPN scoreboards and box scores into data/history.sqlite.
// Usage: node scripts/ingest-boxscores.ts 2022-23 2023-24 ...   (or --recent N days)
import { boxScore, scoreboard } from "../lib/sources/espn.ts";
import { openHistory } from "../lib/history.ts";
import { addDays, pacificDate } from "../lib/time.ts";

const args = process.argv.slice(2);
const h = openHistory();
const today = pacificDate(new Date());

function datesFor(season: string): string[] {
  const start = Number(season.slice(0, 4));
  const out: string[] = [];
  for (let d = `${start}-10-01`; d <= `${start + 1}-04-20` && d < today; d = addDays(d, 1)) out.push(d);
  return out;
}

let dates: string[] = [];
const recentIdx = args.indexOf("--recent");
if (recentIdx >= 0) {
  const n = Number(args[recentIdx + 1] ?? 3);
  for (let i = n; i >= 1; i--) dates.push(addDays(today, -i));
} else {
  for (const s of args) dates.push(...datesFor(s));
}

let games = 0;
let fetched = 0;
for (const d of dates) {
  const ymd = d.replaceAll("-", "");
  // Scoreboards within the last 3 days may still change; refetch those.
  const recent = d >= addDays(today, -3);
  let board;
  try {
    board = await scoreboard(ymd, { useCache: !recent });
  } catch (e) {
    console.error(`scoreboard ${d}: ${(e as Error).message}`);
    continue;
  }
  for (const g of board) {
    h.upsertGame(g);
    if (g.seasonType !== 2 || !g.completed) continue;
    games++;
    if (h.hasLogs(g.gameId) && !recent) continue;
    try {
      h.insertLogs(await boxScore(g, { useCache: !recent }));
      fetched++;
    } catch (e) {
      console.error(`box ${g.gameId}: ${(e as Error).message}`);
    }
  }
  if (d.endsWith("-01")) console.log(`${d}: ${games} games, ${fetched} box scores fetched`);
}
console.log(`done: ${games} completed regular-season games, ${fetched} box scores fetched`);
h.close();
