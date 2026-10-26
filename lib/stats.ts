/** Deterministic PRNG so bootstrap intervals are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPS = 1e-12;
const clip = (p: number) => Math.min(1 - EPS, Math.max(EPS, p));
export const logit = (p: number) => Math.log(clip(p) / (1 - clip(p)));
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Mean binary log loss. */
export function logLoss(ps: number[], ys: (0 | 1)[]): number {
  let s = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = clip(ps[i]);
    s -= ys[i] ? Math.log(p) : Math.log(1 - p);
  }
  return s / ps.length;
}

/** Golden-section minimisation of a unimodal function on [lo, hi]. */
export function goldenMin(f: (x: number) => number, lo: number, hi: number, tol = 1e-6): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  while (b - a > tol) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

export interface DecisiveObs {
  /** Raw model conditional win probability. */
  pModel: number;
  /** Proportional no-vig market probability of the same side. */
  pMarket?: number;
  won: 0 | 1;
}

/** SHRINK minimising conditional log loss over decisive outcomes. */
export function fitShrink(obs: DecisiveObs[]): number {
  const ys = obs.map((o) => o.won);
  return goldenMin(
    (s) => logLoss(obs.map((o) => s * o.pModel + (1 - s) * 0.5), ys),
    0,
    1,
  );
}

/** w in logit p = w*logit(model) + (1-w)*logit(market), by log loss. */
export function fitBlendWeight(obs: DecisiveObs[]): number {
  const ys = obs.map((o) => o.won);
  const lm = obs.map((o) => logit(o.pModel));
  const lk = obs.map((o) => logit(o.pMarket as number));
  return goldenMin((w) => logLoss(lm.map((m, i) => sigmoid(w * m + (1 - w) * lk[i])), ys), -1, 2);
}

export interface Interval {
  estimate: number;
  lo: number;
  hi: number;
  clusters: number;
}

/**
 * Cluster bootstrap: resamples whole clusters (games or players) with
 * replacement and keeps every row in each drawn cluster.
 */
export function clusterBootstrap<T>(
  rows: T[],
  clusterOf: (r: T) => string,
  statistic: (rs: T[]) => number,
  opts: { reps?: number; seed?: number; level?: number } = {},
): Interval {
  const reps = opts.reps ?? 2000;
  const level = opts.level ?? 0.95;
  const rand = mulberry32(opts.seed ?? 20251021);
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = clusterOf(r);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(r);
  }
  const keys = [...groups.keys()].sort();
  const estimate = statistic(rows);
  if (keys.length === 0) return { estimate, lo: NaN, hi: NaN, clusters: 0 };
  const stats: number[] = [];
  for (let b = 0; b < reps; b++) {
    const sample: T[] = [];
    for (let i = 0; i < keys.length; i++) {
      const g = groups.get(keys[Math.floor(rand() * keys.length)]) as T[];
      for (const r of g) sample.push(r);
    }
    stats.push(statistic(sample));
  }
  stats.sort((x, y) => x - y);
  const q = (p: number) => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(p * stats.length)))];
  return { estimate, lo: q((1 - level) / 2), hi: q(1 - (1 - level) / 2), clusters: keys.length };
}

/** The wider of two intervals on the same statistic (lowest lo, highest hi). */
export function widerInterval(a: Interval, b: Interval): Interval {
  return { estimate: a.estimate, lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi), clusters: Math.min(a.clusters, b.clusters) };
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
