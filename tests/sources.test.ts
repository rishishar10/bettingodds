import { describe, expect, it } from "vitest";
import { normalizeName } from "../lib/sources/aliases.ts";
import { resolvePlayer } from "../lib/sources/crosswalk.ts";
import { parseEventOdds } from "../lib/sources/odds.ts";
import { flipName, headerTimeUtc, parseItems } from "../lib/sources/injuries.ts";

describe("names", () => {
  it("normalizes accents, punctuation and suffixes", () => {
    expect(normalizeName("Nikola Jokić")).toBe("nikola jokic");
    expect(normalizeName("Jaren Jackson Jr.")).toBe("jaren jackson");
    expect(normalizeName("Shai Gilgeous-Alexander")).toBe("shai gilgeous alexander");
    expect(normalizeName("De'Aaron Fox")).toBe("deaaron fox");
    expect(normalizeName("Herb Jones")).toBe("herbert jones");
  });

  it("joins only within the two teams on that date and reports ambiguity", () => {
    const roster = [
      { playerId: "1", playerName: "Jalen Williams", teamId: "OKC" },
      { playerId: "2", playerName: "Jalen Williams", teamId: "DEN" },
      { playerId: "3", playerName: "Kevin Durant", teamId: "HOU" },
    ];
    expect(resolvePlayer("Jalen Williams", roster, ["OKC", "LAL"])).toEqual({ ok: true, playerId: "1", teamId: "OKC" });
    expect(resolvePlayer("Jalen Williams", roster, ["OKC", "DEN"])).toEqual({ ok: false, reason: "ambiguous" });
    expect(resolvePlayer("Kevin Durant", roster, ["PHX", "LAL"])).toEqual({ ok: false, reason: "unmatched" });
  });
});

describe("odds payload", () => {
  it("parses outcomes with market-level source time and skips other books", () => {
    const data = {
      id: "ev1",
      bookmakers: [
        { key: "draftkings", last_update: "2026-01-15T15:50:00Z", markets: [
          { key: "player_points", last_update: "2026-01-15T15:55:00Z", outcomes: [
            { name: "Over", description: "Nikola Jokic", price: 1.87, point: 27.5 },
            { name: "Under", description: "Nikola Jokic", price: 1.95, point: 27.5 },
          ] },
        ] },
        { key: "bovada", markets: [{ key: "player_points", outcomes: [{ name: "Over", description: "X", price: 2, point: 1.5 }] }] },
      ],
    };
    const p = parseEventOdds(data);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ eventId: "ev1", stat: "pts", side: "over", line: 27.5, book: "draftkings", sourceUpdatedAt: "2026-01-15T15:55:00Z" });
  });
});

describe("injury report", () => {
  it("parses header time as Eastern and rows with carried-forward team", () => {
    expect(headerTimeUtc("Injury Report: 01/15/24 10:30 AM")).toBe("2024-01-15T15:30:00.000Z");
    expect(flipName("Jackson Jr., Jaren")).toBe("Jaren Jackson Jr.");
    const items = [
      { x: 288, y: 533, str: "Injury Report: 01/15/24 10:30 AM", page: 1 },
      { x: 24, y: 452, str: "01/15/2024", page: 1 },
      { x: 201, y: 452, str: "HOU@PHI", page: 1 },
      { x: 265, y: 452, str: "Houston Rockets", page: 1 },
      { x: 426, y: 452, str: "Eason, Tari", page: 1 },
      { x: 587, y: 452, str: "Out", page: 1 },
      { x: 667, y: 459, str: "Injury/Illness - Left Lower Leg;", page: 1 },
      { x: 426, y: 430, str: "Hinton, Nate", page: 1 },
      { x: 587, y: 430, str: "Questionable", page: 1 },
      { x: 265, y: 410, str: "Philadelphia 76ers", page: 1 },
      { x: 667, y: 410, str: "NOT YET SUBMITTED", page: 1 },
    ];
    const r = parseItems(items);
    expect(r.entries).toEqual([
      { gameDate: "2024-01-15", matchup: "HOU@PHI", team: "Houston Rockets", playerName: "Tari Eason", status: "out", reason: "Injury/Illness - Left Lower Leg;" },
      { gameDate: "2024-01-15", matchup: "HOU@PHI", team: "Houston Rockets", playerName: "Nate Hinton", status: "questionable", reason: "" },
    ]);
    expect(r.notYetSubmitted).toEqual(["Philadelphia 76ers"]);
  });
});
