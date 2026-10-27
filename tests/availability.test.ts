import { describe, expect, it } from "vitest";
import { reportAvailability } from "../lib/availability.ts";
import type { EspnGame } from "../lib/sources/espn.ts";
import type { InjuryReport } from "../lib/sources/injuries.ts";

const game = (home: [string, string], away: [string, string]): EspnGame => ({
  gameId: "g", tipUtc: "2026-01-21T03:00:00Z", date: "2026-01-20", season: "2025-26", seasonType: 2, completed: false,
  home: { id: home[0], abbr: home[0], name: home[1] }, away: { id: away[0], abbr: away[0], name: away[1] },
});
const DEN_LAC = game(["LAC", "LA Clippers"], ["DEN", "Denver Nuggets"]);
const MIL_IND = game(["MIL", "Milwaukee Bucks"], ["IND", "Indiana Pacers"]);
const SAS_SAC = game(["SAS", "San Antonio Spurs"], ["SAC", "Sacramento Kings"]);
const roster = [
  { playerId: "1", playerName: "Kawhi Leonard", teamId: "LAC" },
  { playerId: "2", playerName: "Jamal Murray", teamId: "DEN" },
];
const entry = (team: string, playerName: string, status: any, gameDate = "2026-01-20") => ({ gameDate, matchup: "", team, playerName, status, reason: "" });
const report: InjuryReport = {
  url: "m", reportTimeUtc: "2026-01-20T15:30:00Z",
  entries: [
    entry("LA Clippers", "Kawhi Leonard", "questionable"),
    entry("LA Clippers", "Unknown Rookie", "out"),
    entry("Indiana Pacers", "Somebody", "out"),
    entry("Sacramento Kings", "Tomorrow Guy", "out", "2026-01-21"),
  ],
  notYetSubmitted: [{ team: "Denver Nuggets", gameDate: "2026-01-20" }, { team: "Milwaukee Bucks", gameDate: "2026-01-21" }],
};
const stats = () => ({ unmatchedInjuryNames: [] as string[], teamsUnresolved: [] as string[] });

describe("report availability (strict)", () => {
  it("maps statuses across team spellings and records unmatched names", () => {
    const s = stats();
    const a = reportAvailability(report, "2026-01-20", roster, s)("LAC", DEN_LAC);
    expect(a.status.get("1")).toBe("questionable");
    expect(a.sourceTime).toBe("2026-01-20T15:30:00Z");
    expect(s.unmatchedInjuryNames).toEqual(["LA Clippers: Unknown Rookie"]);
  });

  it("a team not yet submitted for tonight is unresolved; there is no fallback", () => {
    const s = stats();
    expect(reportAvailability(report, "2026-01-20", roster, s)("DEN", DEN_LAC).unresolved).toBe(true);
    expect(s.teamsUnresolved).toEqual(["denver nuggets"]);
  });

  it("a team absent from the report filed with no injuries when its game appears; not-submitted for tomorrow does not count", () => {
    const a = reportAvailability(report, "2026-01-20", roster, stats())("MIL", MIL_IND);
    expect(a.unresolved).toBe(false);
    expect(a.status.size).toBe(0);
  });

  it("a game where neither team appears for tonight is unresolved", () => {
    expect(reportAvailability(report, "2026-01-20", roster, stats())("SAS", SAS_SAC).unresolved).toBe(true);
  });
});
