import { describe, expect, it } from "vitest";
import { cdf, countDist, sideProbs } from "../lib/negbin.ts";

describe("count distribution", () => {
  it("negative binomial pmf sums to 1 and matches the moments", () => {
    const d = countDist(12, 30);
    expect(d.kind).toBe("negbin");
    let s = 0, m = 0, m2 = 0;
    for (let k = 0; k < 400; k++) { const p = d.pmf(k); s += p; m += k * p; m2 += k * k * p; }
    expect(s).toBeCloseTo(1, 9);
    expect(m).toBeCloseTo(12, 6);
    expect(m2 - m * m).toBeCloseTo(30, 4);
  });

  it("falls back to Poisson when variance does not exceed the mean", () => {
    const d = countDist(5, 5);
    expect(d.kind).toBe("poisson");
    expect(d.pmf(0)).toBeCloseTo(Math.exp(-5), 12);
    expect(countDist(5, 4.2).kind).toBe("poisson");
  });

  it("zero mean puts all mass at zero", () => {
    expect(cdf(countDist(0, 0), 0)).toBe(1);
  });

  it("half-point lines never push; integer lines push on the exact count", () => {
    const d = countDist(20, 45);
    const half = sideProbs(d, 19.5, "over");
    expect(half.push).toBe(0);
    expect(half.win + half.loss).toBeCloseTo(1, 12);

    const int = sideProbs(d, 20, "over");
    expect(int.push).toBeCloseTo(d.pmf(20), 12);
    expect(int.win + int.push + int.loss).toBeCloseTo(1, 12);
    const under = sideProbs(d, 20, "under");
    expect(under.win).toBeCloseTo(int.loss, 12);
    expect(under.push).toBeCloseTo(int.push, 12);
  });
});
