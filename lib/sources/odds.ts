import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Book, Side, Stat } from "../types.ts";

const BASE = "https://api.the-odds-api.com/v4";
const SPORT = "basketball_nba";
const CACHE = "data/cache/odds";
export const MARKETS: Record<string, Stat> = {
  player_points: "pts",
  player_rebounds: "reb",
  player_assists: "ast",
};
export const BOOK_KEYS: Book[] = ["draftkings", "fanduel", "betmgm"];

export interface OddsEvent {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
}

/** One book's price on one side, before the player is joined to a roster. */
export interface RawPrice {
  eventId: string;
  playerName: string;
  stat: Stat;
  line: number;
  side: Side;
  book: Book;
  decimal: number;
  sourceUpdatedAt: string | null;
}

export interface Usage {
  remaining: number | null;
  last: number | null;
}

let lastUsage: Usage = { remaining: null, last: null };
export const usage = () => lastUsage;

function key(): string {
  const k = process.env.ODDS_API_KEY;
  if (!k) throw new Error("ODDS_API_KEY is not set");
  return k;
}

async function get(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ apiKey: key(), ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  lastUsage = {
    remaining: Number(res.headers.get("x-requests-remaining") ?? NaN) || null,
    last: Number(res.headers.get("x-requests-last") ?? NaN) || null,
  };
  if (!res.ok) throw new Error(`odds api ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Paid historical responses are cached forever; never refetched. */
async function cachedGet(cachePath: string, path: string, params: Record<string, string>): Promise<any> {
  const file = join(CACHE, cachePath);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const body = await get(path, params);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(body));
  return body;
}

const toEvent = (e: any): OddsEvent => ({ id: e.id, commenceTime: e.commence_time, homeTeam: e.home_team, awayTeam: e.away_team });

/** Upcoming events. Costs 0 credits. */
export async function listEvents(): Promise<OddsEvent[]> {
  return (await get(`/sports/${SPORT}/events`, {})).map(toEvent);
}

/** Events as of a historical instant. Costs 1 credit; cached. */
export async function listHistoricalEvents(atUtc: string): Promise<OddsEvent[]> {
  const body = await cachedGet(`events/${atUtc.replaceAll(":", "")}.json`, `/historical/sports/${SPORT}/events`, { date: atUtc });
  return (body.data ?? []).map(toEvent);
}

const oddsParams = {
  regions: "us",
  markets: Object.keys(MARKETS).join(","),
  bookmakers: BOOK_KEYS.join(","),
  oddsFormat: "decimal",
  dateFormat: "iso",
};

/** Parses one event-odds payload into prices. Exported for fixtures. */
export function parseEventOdds(data: any): RawPrice[] {
  const out: RawPrice[] = [];
  for (const b of data?.bookmakers ?? []) {
    if (!BOOK_KEYS.includes(b.key)) continue;
    for (const m of b.markets ?? []) {
      const stat = MARKETS[m.key];
      if (!stat) continue;
      for (const o of m.outcomes ?? []) {
        const side = String(o.name).toLowerCase();
        if ((side !== "over" && side !== "under") || typeof o.point !== "number" || !o.description) continue;
        out.push({
          eventId: data.id,
          playerName: o.description,
          stat,
          line: o.point,
          side,
          book: b.key,
          decimal: Number(o.price),
          // Market-level time first; the bookmaker time is coarser.
          sourceUpdatedAt: m.last_update ?? b.last_update ?? null,
        });
      }
    }
  }
  return out;
}

/** Live: one fetch of every prop on the event. 3 credits (3 markets x 1 region). */
export async function fetchEventOdds(eventId: string): Promise<{ prices: RawPrice[]; raw: any }> {
  const raw = await get(`/sports/${SPORT}/events/${eventId}/odds`, oddsParams);
  return { prices: parseEventOdds(raw), raw };
}

/** Historical snapshot at or before an instant. 30 credits; cached forever. */
export async function fetchHistoricalEventOdds(
  eventId: string,
  atUtc: string,
): Promise<{ prices: RawPrice[]; snapshotUtc: string; raw: any }> {
  const raw = await cachedGet(
    `event-odds/${eventId}/${atUtc.replaceAll(":", "")}.json`,
    `/historical/sports/${SPORT}/events/${eventId}/odds`,
    { ...oddsParams, date: atUtc },
  );
  return { prices: parseEventOdds(raw.data), snapshotUtc: raw.timestamp, raw };
}
