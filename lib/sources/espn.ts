import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pacificDate, seasonOf } from "../time.ts";
import type { GameLog } from "../types.ts";

// ESPN's public site API. Plain requests, cached on disk, one at a time.
const BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const CACHE = "data/cache/espn";
const DELAY_MS = 700;

let last = 0;
async function politeFetch(url: string): Promise<unknown> {
  const wait = last + DELAY_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 404) throw new Error(`404 ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`failed ${url}`);
}

async function cached(path: string, url: string, useCache: boolean): Promise<any> {
  const file = join(CACHE, path);
  if (useCache && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const body = await politeFetch(url);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(body));
  return body;
}

export interface EspnGame {
  gameId: string;
  tipUtc: string;
  date: string;
  season: string;
  seasonType: number;
  completed: boolean;
  home: { id: string; abbr: string; name: string };
  away: { id: string; abbr: string; name: string };
}

/** Scoreboard for one ESPN date (US Eastern calendar, YYYYMMDD). Past dates are cached. */
export async function scoreboard(yyyymmdd: string, opts: { useCache?: boolean } = {}): Promise<EspnGame[]> {
  const body = await cached(`scoreboard/${yyyymmdd}.json`, `${BASE}/scoreboard?dates=${yyyymmdd}`, opts.useCache ?? true);
  return (body.events ?? []).map((e: any) => {
    const comp = e.competitions[0];
    const team = (side: string) => {
      const c = comp.competitors.find((x: any) => x.homeAway === side);
      return { id: String(c.team.id), abbr: c.team.abbreviation, name: c.team.displayName };
    };
    const tipUtc = new Date(e.date).toISOString();
    const date = pacificDate(tipUtc);
    return {
      gameId: String(e.id),
      tipUtc,
      date,
      season: seasonOf(date),
      seasonType: e.season?.type ?? comp.type?.id,
      completed: Boolean(comp.status?.type?.completed),
      home: team("home"),
      away: team("away"),
    };
  });
}

/** Player box score lines for a completed game; DNPs carry 0 minutes. */
export async function boxScore(game: EspnGame, opts: { useCache?: boolean } = {}): Promise<GameLog[]> {
  const body = await cached(`summary/${game.gameId}.json`, `${BASE}/summary?event=${game.gameId}`, opts.useCache ?? true);
  const out: GameLog[] = [];
  for (const teamBlock of body.boxscore?.players ?? []) {
    const teamId = String(teamBlock.team.id);
    const opponentId = teamId === game.home.id ? game.away.id : game.home.id;
    const s = teamBlock.statistics?.[0];
    if (!s) continue;
    const idx = (label: string) => s.labels.indexOf(label);
    const [iMin, iPts, iReb, iAst] = [idx("MIN"), idx("PTS"), idx("REB"), idx("AST")];
    for (const a of s.athletes ?? []) {
      const stats: string[] = a.stats ?? [];
      const num = (i: number) => {
        const v = Number(stats[i]);
        return Number.isFinite(v) ? v : 0;
      };
      const played = !a.didNotPlay && stats.length > 0;
      out.push({
        gameId: game.gameId,
        date: game.date,
        tipUtc: game.tipUtc,
        season: game.season,
        teamId,
        opponentId,
        playerId: String(a.athlete.id),
        playerName: a.athlete.displayName,
        minutes: played ? num(iMin) : 0,
        pts: played ? num(iPts) : 0,
        reb: played ? num(iReb) : 0,
        ast: played ? num(iAst) : 0,
        starter: Boolean(a.starter),
      });
    }
  }
  return out;
}
