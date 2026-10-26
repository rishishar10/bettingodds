import { normalizeName, normalizeTeam } from "./aliases.ts";

export interface RosterPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
}

export type JoinResult = { ok: true; playerId: string; teamId: string } | { ok: false; reason: "unmatched" | "ambiguous" };

/**
 * Resolves a source name against the two teams' rosters on that date. A
 * current roster cannot validate an old game; callers pass the date's roster.
 */
export function resolvePlayer(name: string, roster: RosterPlayer[], teamIds: string[]): JoinResult {
  const n = normalizeName(name);
  const hits = roster.filter((p) => teamIds.includes(p.teamId) && normalizeName(p.playerName) === n);
  const unique = new Map(hits.map((h) => [h.playerId, h]));
  if (unique.size === 1) {
    const h = [...unique.values()][0];
    return { ok: true, playerId: h.playerId, teamId: h.teamId };
  }
  return { ok: false, reason: unique.size === 0 ? "unmatched" : "ambiguous" };
}

export function teamKey(name: string): string {
  return normalizeTeam(name);
}
