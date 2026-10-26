import { oracleAvailability, reportAvailability, type ReportAvailabilityStats } from "./availability.ts";
import { rosterOnDate, type TeamAvailability } from "./board.ts";
import type { History } from "./history.ts";
import { normalizeTeam } from "./sources/aliases.ts";
import type { RosterPlayer } from "./sources/crosswalk.ts";
import type { EspnGame } from "./sources/espn.ts";
import { reportBefore, type InjuryReport } from "./sources/injuries.ts";
import type { OddsEvent } from "./sources/odds.ts";
import { addDays, EASTERN, pacificDate, previousSeason, seasonOf, zonedToUtc } from "./time.ts";

/** Matches odds events to ESPN games by both team names and Pacific date. */
export function matchEvents(games: EspnGame[], events: OddsEvent[]) {
  const out: { game: EspnGame; eventId: string }[] = [];
  const missing: string[] = [];
  for (const g of games) {
    const e = events.find(
      (ev) =>
        normalizeTeam(ev.homeTeam) === normalizeTeam(g.home.name) &&
        normalizeTeam(ev.awayTeam) === normalizeTeam(g.away.name) &&
        pacificDate(ev.commenceTime) === g.date,
    );
    if (e) out.push({ game: g, eventId: e.id });
    else missing.push(`${g.away.abbr}@${g.home.abbr}`);
  }
  return { matched: out, missing };
}

export function slateRoster(history: History, games: EspnGame[], boardDate: string): RosterPlayer[] {
  const season = seasonOf(boardDate);
  const roster: RosterPlayer[] = [];
  for (const g of games)
    for (const t of [g.home.id, g.away.id])
      roster.push(...rosterOnDate(history, t, history.teamLogsBefore(t, [season, previousSeason(season)], boardDate), boardDate));
  return roster;
}

export interface InjuryInputs {
  morning: InjuryReport | null;
  fallback: InjuryReport | null;
}

/** The morning report (>= 30 min before the snapshot) and the previous evening's last report. */
export async function injuryInputs(boardDate: string, boardUtc: string): Promise<InjuryInputs> {
  const morning = await reportBefore(boardUtc, { bufferMinutes: 30, earliestHourEt: 5 });
  const prev = addDays(boardDate, -1);
  const fallback = await reportBefore(zonedToUtc(prev, "23:59", EASTERN), { bufferMinutes: 0, earliestHourEt: 17 });
  return { morning, fallback };
}

export function availabilityFor(
  kind: "oracle" | "report",
  history: History,
  boardDate: string,
  roster: RosterPlayer[],
  injuries: InjuryInputs | null,
  stats: ReportAvailabilityStats,
): ((teamId: string, game: EspnGame) => TeamAvailability) | null {
  if (kind === "oracle") {
    return (teamId, game) => oracleAvailability(history, game, roster)(teamId);
  }
  if (!injuries?.morning) return null;
  return reportAvailability(injuries.morning, injuries.fallback, boardDate, roster, stats);
}
