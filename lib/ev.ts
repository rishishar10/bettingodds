import type { OutcomeProbs } from "./types.ts";

export const MIN_DECIMAL = 1.01;
export const MAX_DECIMAL = 101;

export function americanToDecimal(american: number): number | null {
  if (!Number.isFinite(american) || Math.abs(american) < 100) return null;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number): number {
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export type OddsRejection = "invalid_odds" | "no_source_time" | "stale";

/** Validates a price and its source time against the build time. */
export function validatePrice(
  decimal: number,
  sourceUpdatedAt: string | null | undefined,
  buildTimeUtc: string,
  maxAgeMinutes: number,
): OddsRejection | null {
  if (!Number.isFinite(decimal) || decimal < MIN_DECIMAL || decimal > MAX_DECIMAL) return "invalid_odds";
  if (!sourceUpdatedAt) return "no_source_time";
  const age = (Date.parse(buildTimeUtc) - Date.parse(sourceUpdatedAt)) / 60000;
  if (!Number.isFinite(age)) return "no_source_time";
  if (age > maxAgeMinutes) return "stale";
  return null;
}

/**
 * Shrinks the conditional (decisive) win rate toward 0.5. The push
 * probability is unchanged.
 */
export function shrink(p: OutcomeProbs, SHRINK: number): OutcomeProbs {
  const decisive = p.win + p.loss;
  if (decisive <= 0) return { ...p };
  const conditional = p.win / decisive;
  const conditionalFinal = SHRINK * conditional + (1 - SHRINK) * 0.5;
  const win = decisive * conditionalFinal;
  return { win, push: p.push, loss: decisive - win };
}

/** EV at a flat stake of 1. */
export function expectedValue(p: OutcomeProbs, decimal: number): number {
  return p.win * (decimal - 1) - p.loss;
}

export function breakEven(decimal: number): number {
  return 1 / decimal;
}

/** Proportional no-vig probability of the over. Nothing else is used. */
export function noVigOver(decimalOver: number, decimalUnder: number): number {
  const a = 1 / decimalOver;
  const b = 1 / decimalUnder;
  return a / (a + b);
}
