import { existsSync, readFileSync } from "node:fs";
import { countDist, type CountDist } from "./negbin.ts";
import type { Stat } from "./types.ts";

/**
 * Predictive distribution, fit on train box scores (scripts/fit-dispersion.ts):
 * with probability 1 - q a regular night, NB with the projection's mean and
 * excess variance scaled by κ; with probability q a short night (early exit,
 * blowout) at a fraction U of expected minutes, U averaged over SHORT_FRACTIONS.
 */
export interface DispersionParams {
  kappa: number;
  q: number;
}

export const SHORT_FRACTIONS = [0.05, 0.15, 0.25, 0.35, 0.45];
export const DISPERSION_PATH = "rules/dispersion.json";
export const IDENTITY: DispersionParams = { kappa: 1, q: 0 };

export interface DistParts {
  mean: number;
  variance: number;
  rateFinal: number;
  alpha: number;
  expMinutes: number;
}

export function loadDispersion(path = DISPERSION_PATH): Record<Stat, DispersionParams> {
  if (!existsSync(path)) return { pts: IDENTITY, reb: IDENTITY, ast: IDENTITY };
  const j = JSON.parse(readFileSync(path, "utf8"));
  return { pts: j.pts ?? IDENTITY, reb: j.reb ?? IDENTITY, ast: j.ast ?? IDENTITY };
}

let cached: Record<Stat, DispersionParams> | null = null;
export const dispersionFor = (stat: Stat): DispersionParams => (cached ??= loadDispersion())[stat];

export function predictive(parts: DistParts, p: DispersionParams): CountDist {
  const regular = countDist(parts.mean, parts.mean + p.kappa * Math.max(0, parts.variance - parts.mean));
  if (p.q <= 0) return regular;
  const shorts = SHORT_FRACTIONS.map((u) => {
    const mu = parts.rateFinal * u * parts.expMinutes;
    return countDist(mu, mu + parts.alpha * mu * mu);
  });
  const pmf = (k: number) => (1 - p.q) * regular.pmf(k) + (p.q * shorts.reduce((s, c) => s + c.pmf(k), 0)) / shorts.length;
  const shortMean = shorts.reduce((s, c) => s + c.mean, 0) / shorts.length;
  const mean = (1 - p.q) * regular.mean + p.q * shortMean;
  const second = (1 - p.q) * (regular.variance + regular.mean ** 2) +
    (p.q * shorts.reduce((s, c) => s + c.variance + c.mean ** 2, 0)) / shorts.length;
  return { kind: "negbin", mean, variance: second - mean * mean, pmf };
}
