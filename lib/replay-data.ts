import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CoverageReason, SlateResult } from "./board.ts";
import type { PriceObs } from "./rank.ts";
import type { Stat } from "./types.ts";

/** Everything a replay needs from one board date, frozen at stage 1. */
export interface ReplayDay {
  boardDate: string;
  boardUtc: string;
  availability: "oracle" | "report";
  injuryReport: { url: string; timeUtc: string } | null;
  games: { gameId: string; eventId: string; tipUtc: string; homeId: string; awayId: string }[];
  /** Morning observations joined to players, all books, before validation. */
  observations: PriceObs[];
  /** Same-book closing observations (last at or before tip minus 10 minutes). */
  closes: PriceObs[];
  projections: Record<string, { mean: number; variance: number; flags: string[]; matched: number }>;
  teamOf: Record<string, { teamId: string; opponentId: string; gameId: string }>;
  results: Record<string, { minutes: number; pts: number; reb: number; ast: number }>;
  coverage: Record<CoverageReason | "prop_market", number>;
  unmatchedNames: SlateResult["unmatchedNames"];
  missingOdds: string[];
  missingClose: string[];
}

export const replayDir = (mode: string, availability: string) => join("data", "replay", mode, availability);

export function saveDay(mode: string, day: ReplayDay): void {
  const dir = replayDir(mode, day.availability);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${day.boardDate}.json`), JSON.stringify(day));
}

export function hasDay(mode: string, availability: string, date: string): boolean {
  return existsSync(join(replayDir(mode, availability), `${date}.json`));
}

export function loadDays(mode: string, availability: string): ReplayDay[] {
  const dir = replayDir(mode, availability);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

export const resultFor = (day: ReplayDay, playerId: string, stat: Stat) => {
  const r = day.results[playerId];
  return r ? { minutes: r.minutes, actual: r[stat] } : null;
};
