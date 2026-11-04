import { describe, expect, it } from "vitest";
import { safestPicks, SAFE_MAX } from "../lib/safest.ts";

const row = (playerId: string, pWinFinal: number, failing: string[] = []) => ({ playerId, pWinFinal, sensitivity: { failing } });

describe("safestPicks", () => {
  it("keeps high-chance picks that survive the minutes checks, most likely first", () => {
    const out = safestPicks([row("a", 0.64), row("b", 0.7), row("c", 0.61), row("d", 0.8, ["minutes_minus"])]);
    expect(out.map((r) => r.playerId)).toEqual(["b", "a"]);
  });
  it("keeps one pick per player", () => {
    expect(safestPicks([row("a", 0.65), row("a", 0.7)])).toEqual([row("a", 0.7)]);
  });
  it("caps the list", () => {
    expect(safestPicks(Array.from({ length: 20 }, (_, i) => row(String(i), 0.7)))).toHaveLength(SAFE_MAX);
  });
});
