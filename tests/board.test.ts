import { describe, expect, it } from "vitest";
import { boardRows, emptyReason, evaluateSlate, type TeamAvailability } from "../lib/board.ts";
import { openHistory } from "../lib/history.ts";
import type { EspnGame } from "../lib/sources/espn.ts";
import type { RawPrice } from "../lib/sources/odds.ts";
import { addDays } from "../lib/time.ts";
import type { GameLog } from "../lib/types.ts";

const BOARD = "2026-01-20";
const game: EspnGame = {
  gameId: "tonight", tipUtc: "2026-01-21T03:00:00.000Z", date: BOARD, season: "2025-26", seasonType: 2, completed: false,
  home: { id: "H", abbr: "HOM", name: "Home Team" }, away: { id: "A", abbr: "AWY", name: "Away Team" },
};

function history() {
  const h = openHistory(":memory:");
  const logs: GameLog[] = [];
  for (let i = 0; i < 30; i++) {
    const date = addDays(BOARD, -(30 - i));
    const add = (teamId: string, playerId: string, name: string, minutes: number, pts: number) =>
      logs.push({ gameId: `${teamId}${i}`, date, tipUtc: `${date}T03:00:00Z`, season: "2025-26", teamId, opponentId: "X", playerId, playerName: name, minutes, pts, reb: 5, ast: 3, starter: true });
    add("H", "star", "Star Player", 34, 20 + (i % 9));
    add("H", "q", "Questionable Guy", 30, 12);
    add("H", "role", "Role Player", 26, 8 + (i % 5));
    add("A", "other", "Other Player", 32, 18 + (i % 7));
  }
  h.insertLogs(logs);
  for (const id of new Set(logs.map((l) => l.gameId))) {
    const l = logs.find((x) => x.gameId === id)!;
    h.upsertGame({ ...game, gameId: id, date: l.date, tipUtc: l.tipUtc, completed: true });
  }
  return h;
}

const fresh = "2026-01-20T15:55:00Z";
const price = (playerName: string, line: number, side: "over" | "under", decimal: number, book: RawPrice["book"] = "draftkings"): RawPrice =>
  ({ eventId: "ev", playerName, stat: "pts", line, side, book, decimal, sourceUpdatedAt: fresh });

const avail = (status: Record<string, TeamAvailability["status"] extends Map<string, infer S> ? S : never>, unresolvedTeam?: string) =>
  (teamId: string): TeamAvailability => ({ source: "report", sourceTime: fresh, status: new Map(Object.entries(status)), unresolved: teamId === unresolvedTeam });

const run = (prices: RawPrice[], availability: (t: string) => TeamAvailability) =>
  evaluateSlate({ boardDate: BOARD, buildTimeUtc: "2026-01-20T16:00:00Z", games: [{ game, eventId: "ev" }], prices, history: history(), availability, SHRINK: 0.6, evMin: 0.08, maxAgeMinutes: 20 });

describe("slate evaluation", () => {
  it("publishes a disagreement, counts coverage by reason, and leaves unmatched names out", () => {
    const s = run([
      price("Star Player", 15.5, "over", 1.9), price("Star Player", 15.5, "under", 1.9),
      price("Nobody Known", 10.5, "over", 1.9),
      price("Other Player", 21.5, "over", 1.9, "fanduel"),
    ], avail({}));
    expect(s.rank.published.map((r) => [r.playerId, r.side])).toContainEqual(["star", "over"]);
    expect(s.coverage.unmatched_name).toBe(1);
    expect(s.coverage.supported).toBe(2);
    expect(s.coverage.prop_market).toBe(3);
    const rows = boardRows(s, 0.6, 0.08);
    expect(rows[0].sensitivity.failing).toBeInstanceOf(Array);
    expect(rows[0].books.draftkings).toBe("best");
    expect(emptyReason(s, 1)).toBeNull();
  });

  it("a questionable rotation teammate makes the player unsupported and produces an if-they-sit card", () => {
    const s = run([price("Star Player", 15.5, "over", 1.9)], avail({ q: "questionable" }));
    expect(s.unsupported.find((u) => u.playerId === "star")?.reason).toBe("unresolved_status");
    expect(s.unsupported.find((u) => u.playerId === "q")).toBeUndefined();
    // Q never sat, so no matching games: the card says so instead of inventing a split.
    expect(s.conditional[0]).toMatchObject({ subjectPlayerId: "q", playerId: "star", message: "Role change detected. Projection unavailable." });
    expect(s.rank.published).toHaveLength(0);
  });

  it("questionable players themselves stay off; unresolved teams are counted apart", () => {
    const s = run([price("Questionable Guy", 10.5, "over", 2.5), price("Other Player", 21.5, "over", 1.9)], avail({ q: "questionable" }, "A"));
    expect(s.unsupported.map((u) => [u.playerId, u.reason]).sort()).toEqual([["other", "report_not_submitted"], ["q", "unresolved_status"]]);
    expect(emptyReason(s, 1)).toBe("No supported player had a prop.");
  });

  it("a source that knows starters fires the new-starter rule for a starter with no team history", () => {
    const withStarters = (teamId: string): TeamAvailability => ({
      source: "oracle", sourceTime: null, unresolved: false,
      status: new Map([["star", "active"], ["q", "active"], ["role", "active"], ["newguy", "active"]]),
      starters: teamId === "H" ? new Set(["star", "q", "newguy"]) : new Set(),
    });
    const s = run([price("Star Player", 15.5, "over", 1.9)], withStarters);
    expect(s.unsupported.find((u) => u.playerId === "star")).toMatchObject({ reason: "teammate_role" });
    expect(s.unsupported.find((u) => u.playerId === "star")?.detail).toMatch(/no team history/);
  });

  it("two unresolved teammates produce one joint if-they-sit scenario", () => {
    const s = run([price("Star Player", 15.5, "over", 1.9)], avail({ q: "questionable", role: "doubtful" }));
    expect(s.conditional).toHaveLength(1);
    expect(s.conditional[0].subjectPlayerIds.sort()).toEqual(["q", "role"]);
    expect(s.conditional[0].subjectName).toMatch(/ and /);
  });

  it("a rotation player who left the team counts as out, so the pool uses games he sat", () => {
    const h = history();
    // "gone" played 30 minutes for H in all but the last 6 games, then left (no longer on any roster here).
    const extra: GameLog[] = [];
    for (let i = 0; i < 30; i++) {
      const date = addDays(BOARD, -(30 - i));
      extra.push({ gameId: `H${i}`, date, tipUtc: `${date}T03:00:00Z`, season: "2025-26", teamId: i < 24 ? "H" : "Z", opponentId: "X",
        playerId: "gone", playerName: "Gone Player", minutes: i < 24 ? 30 : 0, pts: 20, reb: 5, ast: 3, starter: true });
    }
    h.insertLogs(extra);
    const s = evaluateSlate({ boardDate: BOARD, buildTimeUtc: "2026-01-20T16:00:00Z", games: [{ game, eventId: "ev" }],
      prices: [price("Star Player", 15.5, "over", 1.9)], history: h, availability: avail({}), SHRINK: 0.6, evMin: 0.08, maxAgeMinutes: 20 });
    // Only the 6 games after he left match; that is enough to support, and the pool excludes the games with him.
    const pr = s.projections.get("star|pts");
    expect(pr?.counts.matched).toBe(6);
  });

  it("stale prices for supported players are their own empty-board reason", () => {
    const s = run([{ ...price("Star Player", 15.5, "over", 1.9), sourceUpdatedAt: "2026-01-20T12:00:00Z" }], avail({}));
    expect(s.coverage.stale_or_invalid_odds).toBe(1);
    expect(emptyReason(s, 1)).toBe("Every price for a supported player was stale or invalid.");
  });
});
