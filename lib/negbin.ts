import type { OutcomeProbs, Side } from "./types.ts";

// Lanczos approximation, g = 7.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Count distribution with a given mean and variance: negative binomial when
 * overdispersed, Poisson when variance <= mean. No mass below zero.
 */
export interface CountDist {
  kind: "negbin" | "poisson";
  mean: number;
  variance: number;
  pmf(k: number): number;
}

export function countDist(mean: number, variance: number): CountDist {
  if (!(mean >= 0) || !Number.isFinite(mean)) throw new Error(`invalid mean ${mean}`);
  if (mean === 0) {
    return { kind: "poisson", mean, variance: 0, pmf: (k) => (k === 0 ? 1 : 0) };
  }
  // Relative tolerance so float noise in Var(X) does not flip a Poisson into a huge-size NB.
  if (!(variance > mean * (1 + 1e-9))) {
    const lm = Math.log(mean);
    return {
      kind: "poisson",
      mean,
      variance: mean,
      pmf: (k) => (k < 0 || !Number.isInteger(k) ? 0 : Math.exp(k * lm - mean - logGamma(k + 1))),
    };
  }
  const size = (mean * mean) / (variance - mean);
  const p = size / (size + mean);
  const lp = Math.log(p);
  const lq = Math.log(1 - p);
  const lgSize = logGamma(size);
  return {
    kind: "negbin",
    mean,
    variance,
    pmf: (k) =>
      k < 0 || !Number.isInteger(k)
        ? 0
        : Math.exp(logGamma(k + size) - lgSize - logGamma(k + 1) + size * lp + k * lq),
  };
}

/** P(X <= k). */
export function cdf(dist: CountDist, k: number): number {
  if (k < 0) return 0;
  let s = 0;
  for (let i = 0; i <= Math.floor(k); i++) s += dist.pmf(i);
  return Math.min(1, s);
}

/**
 * Win/push/loss for one side of a line. A half-point line never pushes; an
 * integer line pushes on the exact count.
 */
export function sideProbs(dist: CountDist, line: number, side: Side): OutcomeProbs {
  const isInteger = Number.isInteger(line);
  const below = cdf(dist, isInteger ? line - 1 : Math.floor(line));
  const push = isInteger ? dist.pmf(line) : 0;
  const above = Math.max(0, 1 - below - push);
  return side === "over"
    ? { win: above, push, loss: below }
    : { win: below, push, loss: above };
}
