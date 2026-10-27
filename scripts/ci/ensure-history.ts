// Makes sure history.sqlite holds last season and this season (the model's
// lookback). A fresh runner has nothing; this ingests both once (~30 min),
// after which the data branch carries the file forward.
import { execFileSync } from "node:child_process";
import { openHistory } from "../../lib/history.ts";
import { pacificDate, previousSeason, seasonOf } from "../../lib/time.ts";

const season = seasonOf(pacificDate(new Date()));
const last = previousSeason(season);
const h = openHistory();
const games = (s: string) => (h.db.prepare("SELECT COUNT(DISTINCT game_id) AS n FROM logs WHERE season = ?").get(s) as { n: number }).n;
const have = games(last);
h.close();
if (have >= 1000) {
  console.log(`history has ${have} games for ${last}; ok`);
} else {
  console.log(`history has ${have} games for ${last}; ingesting ${last} and ${season}`);
  execFileSync("node", ["scripts/ingest-boxscores.ts", last, season], { stdio: "inherit" });
}
