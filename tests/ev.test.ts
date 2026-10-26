import { describe, expect, it } from "vitest";
import { americanToDecimal, expectedValue, noVigOver, shrink, validatePrice } from "../lib/ev.ts";

describe("shrinkage and EV", () => {
  it("keeps the three probabilities summing to 1 and the push unchanged", () => {
    const p = shrink({ win: 0.5, push: 0.1, loss: 0.4 }, 0.6);
    expect(p.win + p.push + p.loss).toBeCloseTo(1, 12);
    expect(p.push).toBe(0.1);
  });

  it("a 50% conditional split stays 50%", () => {
    const p = shrink({ win: 0.45, push: 0.1, loss: 0.45 }, 0.3);
    expect(p.win).toBeCloseTo(0.45, 12);
    expect(p.loss).toBeCloseTo(0.45, 12);
  });

  it("equal decisive probabilities at even money have EV 0", () => {
    expect(expectedValue({ win: 0.47, push: 0.06, loss: 0.47 }, 2.0)).toBeCloseTo(0, 12);
  });

  it("EV = p_win*(d-1) - p_loss", () => {
    expect(expectedValue({ win: 0.6, push: 0, loss: 0.4 }, 1.909)).toBeCloseTo(0.6 * 0.909 - 0.4, 12);
  });

  it("converts American odds and rejects the dead zone", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.90909, 4);
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(-50)).toBeNull();
  });

  it("proportional no-vig", () => {
    expect(noVigOver(1.909, 1.909)).toBeCloseTo(0.5, 12);
    expect(noVigOver(1.8, 2.05)).toBeCloseTo((1 / 1.8) / (1 / 1.8 + 1 / 2.05), 12);
  });

  it("rejects prices without a source time, stale prices, and invalid odds", () => {
    const build = "2026-01-10T16:00:00Z";
    expect(validatePrice(1.9, null, build, 20)).toBe("no_source_time");
    expect(validatePrice(1.9, "2026-01-10T15:39:00Z", build, 20)).toBe("stale");
    expect(validatePrice(1.0, "2026-01-10T15:59:00Z", build, 20)).toBe("invalid_odds");
    expect(validatePrice(1.9, "2026-01-10T15:41:00Z", build, 20)).toBeNull();
  });
});
