import { describe, expect, it } from "vitest";
import { scoreDay } from "../lib/replay-score.ts";
import type { ReplayDay } from "../lib/replay-data.ts";
import type { PriceObs } from "../lib/rank.ts";

const o = (p: Partial<PriceObs>): PriceObs => ({
  eventId: "e", playerId: "p", playerName: "P", stat: "pts", line: 20.5, side: "over", book: "draftkings",
  decimal: 1.91, sourceUpdatedAt: "2026-01-15T15:55:00Z", ...p,
});

const day = (overrides: Partial<ReplayDay> = {}): ReplayDay => ({
  boardDate: "2026-01-15", boardUtc: "2026-01-15T16:00:00Z", availability: "report", injuryReport: null,
  games: [], observations: [o({}), o({ side: "under" })],
  closes: [o({ decimal: 1.7, sourceUpdatedAt: "2026-01-16T02:50:00Z" }), o({ side: "under", decimal: 2.15 }), o({ book: "fanduel", decimal: 1.5 })],
  projections: { "p|pts": { mean: 25, variance: 40, flags: [], matched: 20 } },
  teamOf: { p: { teamId: "T", opponentId: "O", gameId: "g" } },
  results: { p: { minutes: 30, pts: 24, reb: 0, ast: 0 } },
  coverage: {} as ReplayDay["coverage"], unmatchedNames: [], missingOdds: [], missingClose: [],
  ...overrides,
});

describe("replay scoring", () => {
  it("uses the same book's close and the same book's opposing side", () => {
    const rows = scoreDay(day(), 0.8, 0.08, 20);
    const over = rows.find((r) => r.side === "over")!;
    expect(over.selected).toBe(true);
    expect(over.result).toBe("win");
    expect(over.opposingDecimal).toBe(1.91);
    expect(over.close).toEqual({ line: 20.5, decimal: 1.7, opposingDecimal: 2.15 });
    expect(rows.find((r) => r.side === "under")!.result).toBe("loss");
  });

  it("falls back to the nearest closing line and voids a DNP", () => {
    const rows = scoreDay(
      day({ closes: [o({ line: 22.5, decimal: 1.9 })], results: { p: { minutes: 0, pts: 0, reb: 0, ast: 0 } } }),
      0.8, 0.08, 20,
    );
    const over = rows.find((r) => r.side === "over")!;
    expect(over.close?.line).toBe(22.5);
    expect(over.result).toBe("void");
  });
});
