import type { TeamAvailability, TonightStatus } from "./board.ts";
import type { History } from "./history.ts";
import { normalizeTeam } from "./sources/aliases.ts";
import { resolvePlayer, type RosterPlayer } from "./sources/crosswalk.ts";
import type { EspnGame } from "./sources/espn.ts";
import type { InjuryEntry, InjuryReport } from "./sources/injuries.ts";

/**
 * Oracle availability: the box score of the game itself says who played.
 * An upper bound; live knows only the morning report.
 */
export function oracleAvailability(history: History, game: EspnGame, roster: RosterPlayer[]) {
  const played = new Map(history.logsForGame(game.gameId).map((l) => [l.playerId, l.minutes]));
  return (teamId: string): TeamAvailability => {
    const status = new Map<string, TonightStatus>();
    for (const p of roster) if (p.teamId === teamId) status.set(p.playerId, (played.get(p.playerId) ?? 0) > 0 ? "active" : "out");
    return { source: "oracle", sourceTime: null, status, unresolved: false };
  };
}

const STATUS_MAP: Record<InjuryEntry["status"], TonightStatus> = {
  out: "out", doubtful: "doubtful", questionable: "questionable", probable: "active", available: "active",
};

export interface ReportAvailabilityStats {
  unmatchedInjuryNames: string[];
  teamsFromFallback: string[];
  teamsUnresolved: string[];
}

/**
 * Availability from the morning report. A team marked "not yet submitted"
 * uses the previous evening's entries for tonight's game when it appears
 * there; otherwise the team is unresolved.
 */
export function reportAvailability(
  morning: InjuryReport,
  fallback: InjuryReport | null,
  boardDate: string,
  roster: RosterPlayer[],
  stats: ReportAvailabilityStats,
) {
  return (teamId: string, game: EspnGame): TeamAvailability => {
    const teamName = normalizeTeam(teamId === game.home.id ? game.home.name : game.away.name);
    const isTeam = (e: { team: string }) => normalizeTeam(e.team) === teamName;
    const nys = morning.notYetSubmitted.some((t) => normalizeTeam(t) === teamName);
    let entries: InjuryEntry[];
    let sourceTime = morning.reportTimeUtc;
    if (!nys) {
      entries = morning.entries.filter((e) => isTeam(e) && e.gameDate === boardDate);
    } else {
      const fb = fallback?.entries.filter((e) => isTeam(e) && e.gameDate === boardDate) ?? [];
      if (fb.length === 0) {
        // Not submitted this morning and no entries for tonight last evening: nothing known.
        stats.teamsUnresolved.push(teamName);
        return { source: "report", sourceTime: null, status: new Map(), unresolved: true };
      }
      entries = fb;
      sourceTime = (fallback as InjuryReport).reportTimeUtc;
      stats.teamsFromFallback.push(teamName);
    }
    const status = new Map<string, TonightStatus>();
    for (const e of entries) {
      const j = resolvePlayer(e.playerName, roster, [teamId]);
      if (!j.ok) {
        stats.unmatchedInjuryNames.push(`${e.team}: ${e.playerName}`);
        continue;
      }
      status.set(j.playerId, STATUS_MAP[e.status]);
    }
    return { source: "report", sourceTime, status, unresolved: false };
  };
}
