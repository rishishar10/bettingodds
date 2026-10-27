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
  const tonight = history.logsForGame(game.gameId);
  return (teamId: string): TeamAvailability => {
    const status = new Map<string, TonightStatus>();
    for (const p of roster) if (p.teamId === teamId) status.set(p.playerId, "out");
    // Everyone in tonight's box score for this team, including players new to it.
    for (const l of tonight) if (l.teamId === teamId) status.set(l.playerId, l.minutes > 0 ? "active" : "out");
    const starters = new Set(tonight.filter((l) => l.teamId === teamId && l.starter).map((l) => l.playerId));
    return { source: "oracle", sourceTime: null, status, unresolved: false, starters };
  };
}

const STATUS_MAP: Record<InjuryEntry["status"], TonightStatus> = {
  // Doubtful players almost never play; they are treated as out.
  out: "out", doubtful: "out", questionable: "questionable", probable: "active", available: "active",
};

const addOnce = (xs: string[], x: string) => { if (!xs.includes(x)) xs.push(x); };

export interface ReportAvailabilityStats {
  unmatchedInjuryNames: string[];
  teamsUnresolved: string[];
}

/**
 * Availability from the morning report only. A team marked "not yet
 * submitted" for tonight is unresolved. A team absent from the report has
 * filed with no injuries, but only if its game is in the report (its
 * opponent appears); if neither team appears, the game is unresolved.
 */
export function reportAvailability(
  morning: InjuryReport,
  boardDate: string,
  roster: RosterPlayer[],
  stats: ReportAvailabilityStats,
) {
  const tonight = morning.entries.filter((e) => e.gameDate === boardDate);
  const nys = morning.notYetSubmitted.filter((n) => n.gameDate === boardDate).map((n) => normalizeTeam(n.team));
  const appears = (team: string) => nys.includes(team) || tonight.some((e) => normalizeTeam(e.team) === team);
  return (teamId: string, game: EspnGame): TeamAvailability => {
    const teamName = normalizeTeam(teamId === game.home.id ? game.home.name : game.away.name);
    const opponent = normalizeTeam(teamId === game.home.id ? game.away.name : game.home.name);
    if (nys.includes(teamName) || (!appears(teamName) && !appears(opponent))) {
      addOnce(stats.teamsUnresolved, teamName);
      return { source: "report", sourceTime: null, status: new Map(), unresolved: true };
    }
    const status = new Map<string, TonightStatus>();
    for (const e of tonight.filter((x) => normalizeTeam(x.team) === teamName)) {
      const j = resolvePlayer(e.playerName, roster, [teamId]);
      if (!j.ok) {
        addOnce(stats.unmatchedInjuryNames, `${e.team}: ${e.playerName}`);
        continue;
      }
      status.set(j.playerId, STATUS_MAP[e.status]);
    }
    return { source: "report", sourceTime: morning.reportTimeUtc, status, unresolved: false };
  };
}
