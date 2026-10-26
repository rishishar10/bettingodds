import { describe, expect, it } from "vitest";
import { compareClose, lineDirection } from "../lib/clv.ts";
import { evaluateGate, type ReplayRow } from "../lib/gate.ts";
import { guardTestRun } from "../lib/rule.ts";
import { MODEL, POLICY } from "../lib/constants.ts";
import { clusterBootstrap } from "../lib/stats.ts";
import { summarize } from "../lib/grade.ts";
import { hashOf } from "../lib/hash.ts";

describe("CLV", () => {
  it("is a same-book ratio; different lines are not favourable", () => {
    expect(compareClose("over", { line: 20.5, decimal: 2.0 }, { line: 20.5, decimal: 1.8 })).toEqual({ kind: "same_line", movement: 2 / 1.8 - 1, direction: "better" });
    expect(compareClose("over", { line: 20.5, decimal: 2.0 }, { line: 21.5, decimal: 1.9 })).toEqual({ kind: "different_line", move: "toward" });
    expect(compareClose("over", { line: 20.5, decimal: 2.0 }, null).kind).toBe("missing_close");
    expect(lineDirection("under", 20.5, 21.5)).toBe("away");
  });
});

describe("cluster bootstrap", () => {
  it("resamples whole clusters", () => {
    // Two clusters with constant values: every resample mean is a mix of whole clusters.
    const rows = [...Array(5)].map(() => ({ g: "a", v: 0 })).concat([...Array(5)].map(() => ({ g: "b", v: 1 })));
    const iv = clusterBootstrap(rows, (r) => r.g, (rs) => rs.reduce((s, r) => s + r.v, 0) / rs.length, { reps: 500 });
    expect(iv.clusters).toBe(2);
    expect([0, 0.5, 1]).toContain(iv.lo);
    expect([0, 0.5, 1]).toContain(iv.hi);
  });
});

describe("ROI accounting", () => {
  it("voids leave the denominator, pushes settle at 0, pending is in neither", () => {
    const s = summarize([
      { result: "win", decimal: 2 }, { result: "loss", decimal: 2 }, { result: "push", decimal: 2 },
      { result: "void", decimal: 2 }, { result: null, decimal: 2 },
    ]);
    expect(s).toEqual({ bets: 5, settled: 3, voids: 1, pending: 1, unitsStaked: 3, netUnits: 0, roi: 0 });
  });
});

function syntheticRows(nGames: number, clvEdge: number): ReplayRow[] {
  const rows: ReplayRow[] = [];
  for (let g = 0; g < nGames; g++) {
    const pTrue = 0.4 + 0.2 * ((g * 37) % 10) / 10;
    const won = ((g * 7919) % 100) / 100 < pTrue;
    rows.push({
      boardDate: `2026-0${1 + (g % 3)}-10`, gameId: `g${g}`, playerId: `p${g % 40}`, teamId: `t${g % 30}`, stat: "pts",
      line: 20.5, side: "over", book: "draftkings", decimal: 1.95, opposingDecimal: 1.87,
      pRawConditional: pTrue, final: { win: pTrue, push: 0, loss: 1 - pTrue }, ev: 0.1, selected: true,
      result: won ? "win" : "loss",
      close: { line: 20.5, decimal: 1.95 / (1 + clvEdge + ((g % 5) - 2) * 0.01), opposingDecimal: 1.87 },
    });
  }
  return rows;
}

describe("gate", () => {
  it("fails with fewer than 100 CLV games even with positive CLV", () => {
    const r = evaluateGate(syntheticRows(60, 0.05), { minClvGames: 100, reps: 200 });
    expect(r.clv.lo).toBeGreaterThan(0);
    expect(r.pass.enoughGames).toBe(false);
    expect(r.pass.demonstratedEdge).toBe(false);
  });

  it("an informative model gets w above 0; positive CLV over enough games passes", () => {
    const r = evaluateGate(syntheticRows(400, 0.04), { minClvGames: 100, reps: 200 });
    expect(r.w.estimate).toBeGreaterThan(0);
    expect(r.pass.clvAboveZero).toBe(true);
    expect(r.concentration.clvGames).toBe(400);
  });

  it("zero CLV does not pass", () => {
    const r = evaluateGate(syntheticRows(400, 0), { minClvGames: 100, reps: 200 });
    expect(r.pass.clvAboveZero).toBe(false);
  });
});

describe("test-season guard", () => {
  const rule = { model: MODEL, policy: POLICY };
  const env = (o: Partial<{ clean: boolean; hash: string | null; lock: boolean }>) => ({
    gitClean: () => o.clean ?? true,
    committedHash: () => (o.hash === undefined ? hashOf(rule) : o.hash),
    lockExists: () => o.lock ?? false,
  });

  it("refuses a dirty tree, a missing or mismatched hash, and a second run", () => {
    expect(guardTestRun(rule, env({ clean: false }), { postHoc: false }).ok).toBe(false);
    expect(guardTestRun(rule, env({ hash: null }), { postHoc: false }).ok).toBe(false);
    expect(guardTestRun(rule, env({ hash: "deadbeef" }), { postHoc: false }).ok).toBe(false);
    expect(guardTestRun(rule, env({}), { postHoc: false }).ok).toBe(true);
    const second = guardTestRun(rule, env({ lock: true }), { postHoc: false });
    expect(second.ok).toBe(false);
    expect(guardTestRun(rule, env({ lock: true }), { postHoc: true }).ok).toBe(true);
  });

  it("refuses when code constants drift from the rule", () => {
    const drift = { model: { ...MODEL, PRIOR_MINUTES: 150 }, policy: POLICY };
    const r = guardTestRun(drift, { gitClean: () => true, committedHash: () => null, lockExists: () => false }, { postHoc: false });
    expect(r.ok).toBe(false);
  });
});
