import { describe, expect, it } from "vitest";
import { rankBoard, type PriceObs } from "../lib/rank.ts";
import { BOOKS } from "../lib/types.ts";

const build = "2026-01-15T16:00:00Z";
const fresh = "2026-01-15T15:55:00Z";
const obs = (o: Partial<PriceObs>): PriceObs => ({
  eventId: "e1", playerId: "p1", playerName: "Player One", stat: "pts", line: 20.5, side: "over",
  book: "draftkings", decimal: 1.91, sourceUpdatedAt: fresh, ...o,
});
const fixedProbs = (pOver: number) => (o: { side: string }) => {
  const win = o.side === "over" ? pOver : 1 - pOver;
  const p = { win, push: 0, loss: 1 - win };
  return { raw: p, final: p };
};
const run = (observations: PriceObs[], pOver: number) =>
  rankBoard({ observations, books: BOOKS, probsFor: fixedProbs(pOver), buildTimeUtc: build, maxAgeMinutes: 20, evMin: 0.08 });

describe("ranking", () => {
  it("takes the best price inside the exact key and labels the other books", () => {
    const r = run([obs({ decimal: 1.91 }), obs({ book: "fanduel", decimal: 2.0 }), obs({ book: "betmgm", decimal: 2.2, sourceUpdatedAt: null })], 0.6);
    expect(r.published).toHaveLength(1);
    expect(r.published[0].book).toBe("fanduel");
    expect(r.published[0].books).toEqual({ fanduel: "best", draftkings: "lower_price", betmgm: "no_source_time" });
  });

  it("quarantines a line where both sides clear the bar", () => {
    const r = run([obs({ decimal: 2.3 }), obs({ side: "under", book: "fanduel", decimal: 2.3 })], 0.5);
    expect(r.published).toHaveLength(0);
    expect(r.anomalies).toHaveLength(1);
    expect(r.anomalies[0].cause).toBe("pricing");
    expect(r.anomalies[0].sides.map((s) => s.side).sort()).toEqual(["over", "under"]);
    expect(r.evaluated.every((e) => e.state === "quarantined")).toBe(true);
  });

  it("publishes one row per event, player, stat and side", () => {
    const r = run([obs({ line: 20.5, decimal: 2.0 }), obs({ line: 21.5, book: "fanduel", decimal: 2.1 })], 0.62);
    expect(r.published).toHaveLength(1);
    expect(r.published[0].line).toBe(21.5);
    expect(r.evaluated.find((e) => e.line === 20.5)?.state).toBe("superseded");
  });

  it("rejects stale prices before ranking", () => {
    const r = run([obs({ sourceUpdatedAt: "2026-01-15T15:00:00Z", decimal: 3 })], 0.6);
    expect(r.evaluated).toHaveLength(0);
    expect(r.rejections[0].reason).toBe("stale");
  });
});
