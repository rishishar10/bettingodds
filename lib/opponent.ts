import { MODEL } from "./constants.ts";
import type { History } from "./history.ts";
import { STATS, type Stat } from "./types.ts";

/**
 * How much an opponent allows per minute relative to the league, season to
 * date: its last OPP_LOOKBACK_GAMES games, shrunk toward 1 with
 * OPP_SHRINK_GAMES of league-average weight. 1 when there is no history yet.
 */
export function opponentFactors(history: History, opponentId: string, season: string, date: string): Record<Stat, number> {
  const games = history.allowedBefore(opponentId, season, date, MODEL.OPP_LOOKBACK_GAMES);
  const league = history.leagueBefore(season, date);
  const out = { pts: 1, reb: 1, ast: 1 };
  if (!games.length || !league.m) return out;
  const m = games.reduce((s, g) => s + g.m, 0);
  for (const stat of STATS) {
    const ratio = games.reduce((s, g) => s + g[stat], 0) / m / (league[stat] / league.m);
    out[stat] = (games.length * ratio + MODEL.OPP_SHRINK_GAMES) / (games.length + MODEL.OPP_SHRINK_GAMES);
  }
  return out;
}

export const oppBeta = (stat: Stat): number =>
  stat === "pts" ? MODEL.OPP_BETA_PTS : stat === "reb" ? MODEL.OPP_BETA_REB : MODEL.OPP_BETA_AST;
