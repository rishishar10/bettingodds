import { describe, expect, it } from "vitest";
import { reportAvailability } from "../lib/availability.ts";
import type { EspnGame } from "../lib/sources/espn.ts";
import type { InjuryReport } from "../lib/sources/injuries.ts";

const game: EspnGame = {
  gameId: "g", tipUtc: "2026-01-21T03:00:00Z", date: "2026-01-20", season: "2025-26", seasonType: 2, completed: false,
  home: { id: "LAC", abbr: "LAC", name: "LA Clippers" }, away: { id: "DEN", abbr: "DEN", name: "Denver Nuggets" },
};
const roster = [
  { playerId: "1", playerName: "Kawhi Leonard", teamId: "LAC" },
  { playerId: "2", playerName: "Jamal Murray", teamId: "DEN" },
  { playerId: "3", playerName: "Aaron Gordon", teamId: "DEN" },
];
const entry = (team: string, playerName: string, status: any, gameDate = "2026-01-20") => ({ gameDate, matchup: "DEN@LAC", team, playerName, status, reason: "" });

describe("report availability", () => {
  const morning: InjuryReport = {
    url: "m", reportTimeUtc: "2026-01-20T15:30:00Z",
    entries: [entry("LA Clippers", "Kawhi Leonard", "questionable"), entry("LA Clippers", "Unknown Rookie", "out")],
    notYetSubmitted: ["Denver Nuggets"],
  };
  const evening: InjuryReport = {
    url: "e", reportTimeUtc: "2026-01-20T01:00:00Z",
    entries: [entry("Denver Nuggets", "Jamal Murray", "out"), entry("Denver Nuggets", "Aaron Gordon", "probable"), entry("Denver Nuggets", "Aaron Gordon", "out", "2026-01-19")],
    notYetSubmitted: [],
  };

  it("matches LA Clippers across spellings and maps statuses", () => {
    const stats = { unmatchedInjuryNames: [], teamsFromFallback: [], teamsUnresolved: [] };
    const a = reportAvailability(morning, evening, "2026-01-20", roster, stats)("LAC", game);
    expect(a.status.get("1")).toBe("questionable");
    expect(a.sourceTime).toBe("2026-01-20T15:30:00Z");
    expect(stats.unmatchedInjuryNames).toEqual(["LA Clippers: Unknown Rookie"]);
  });

  it("a team not yet submitted uses last evening's entries for tonight only", () => {
    const stats = { unmatchedInjuryNames: [], teamsFromFallback: [] as string[], teamsUnresolved: [] };
    const a = reportAvailability(morning, evening, "2026-01-20", roster, stats)("DEN", game);
    expect(a.unresolved).toBe(false);
    expect(a.status.get("2")).toBe("out");
    expect(a.status.get("3")).toBe("active");
    expect(a.sourceTime).toBe("2026-01-20T01:00:00Z");
    expect(stats.teamsFromFallback).toEqual(["denver nuggets"]);
  });

  it("is unresolved when neither report covers tonight", () => {
    const stats = { unmatchedInjuryNames: [], teamsFromFallback: [], teamsUnresolved: [] as string[] };
    const a = reportAvailability(morning, null, "2026-01-20", roster, stats)("DEN", game);
    expect(a.unresolved).toBe(true);
  });
});
