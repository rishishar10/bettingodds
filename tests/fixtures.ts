import type { GameLog } from "../lib/types.ts";
import { addDays } from "../lib/time.ts";

export const TEAM = "T";
export const P = "P";

/** Builds n team games ending the day before `lastDate`, one log per (game, player). */
export function teamGames(
  n: number,
  opts: {
    lastDate?: string;
    season?: string;
    prefix?: string;
    players: Record<string, (i: number) => { min: number; pts?: number; reb?: number; ast?: number }>;
  },
): GameLog[] {
  const last = opts.lastDate ?? "2026-01-20";
  const logs: GameLog[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(last, -(n - i));
    const gameId = `${opts.prefix ?? "g"}${String(i).padStart(3, "0")}`;
    for (const [pid, f] of Object.entries(opts.players)) {
      const s = f(i);
      logs.push({
        gameId,
        date,
        tipUtc: `${date}T03:00:00Z`,
        season: opts.season ?? "2025-26",
        teamId: TEAM,
        opponentId: "O",
        playerId: pid,
        playerName: pid,
        minutes: s.min,
        pts: s.pts ?? 0,
        reb: s.reb ?? 0,
        ast: s.ast ?? 0,
        starter: false,
      });
    }
  }
  return logs;
}
