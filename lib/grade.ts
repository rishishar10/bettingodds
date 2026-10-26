import type { Side } from "./types.ts";

export type Result = "win" | "loss" | "push" | "void";

/** Grades a saved line: zero minutes voids; any minutes use the actual stat, overtime included. */
export function gradeProp(line: number, side: Side, minutes: number, actual: number): Result {
  if (minutes <= 0) return "void";
  if (actual === line) return "push";
  return (actual > line) === (side === "over") ? "win" : "loss";
}

export function profit(result: Result, decimal: number): number {
  return result === "win" ? decimal - 1 : result === "loss" ? -1 : 0;
}

export interface RoiSummary {
  bets: number;
  settled: number;
  voids: number;
  pending: number;
  unitsStaked: number;
  netUnits: number;
  roi: number | null;
}

/** Flat stake of 1. Voids leave the denominator; pending is in neither. */
export function summarize(rows: { result: Result | null; decimal: number }[]): RoiSummary {
  let settled = 0;
  let voids = 0;
  let pending = 0;
  let net = 0;
  for (const r of rows) {
    if (r.result === null) pending++;
    else if (r.result === "void") voids++;
    else {
      settled++;
      net += profit(r.result, r.decimal);
    }
  }
  return {
    bets: rows.length,
    settled,
    voids,
    pending,
    unitsStaked: settled,
    netUnits: net,
    roi: settled > 0 ? net / settled : null,
  };
}
