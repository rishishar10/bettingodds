import { MODEL } from "./constants.ts";
import { dispersionFor, predictive, type DispersionParams } from "./dispersion.ts";
import { sideProbs, type CountDist } from "./negbin.ts";
import { expectedValue, shrink } from "./ev.ts";
import type { GameLog, OutcomeProbs, Side, Stat, TeammateTonight } from "./types.ts";

export type UnsupportedReason =
  | "no_base_history"
  | "too_few_games"
  | "teammate_status_unresolved"
  | "teammate_no_history"
  | "empty_out_intersection";

export interface PoolGame {
  gameId: string;
  date: string;
  season: string;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  shortAppearance: boolean;
}

export interface Pools {
  base: PoolGame[];
  matched: PoolGame[];
  rotation: { playerId: string; status: TeammateTonight["status"] }[];
  season: string;
  lastSeason: string;
}

export type PoolResult =
  | { ok: true; pools: Pools }
  | { ok: false; reason: UnsupportedReason; detail: string; ids?: string[] };

export interface PoolContext {
  playerId: string;
  teamId: string;
  /** Pacific board date. Every log must be strictly earlier. */
  boardDate: string;
  season: string;
  lastSeason: string;
  /** Logs for this team (all players) plus the player's own logs, this season and last. */
  logs: GameLog[];
  teammates: TeammateTonight[];
  startersKnown: boolean;
  /** Override teammates as out, for the if-they-sit card. */
  assumeOut?: string[];
  /** Minimum matched games; the if-they-sit card uses 3. */
  minMatchedGames?: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function byRecent(a: { date: string; gameId: string }, b: { date: string; gameId: string }): number {
  return a.date === b.date ? (a.gameId < b.gameId ? 1 : -1) : a.date < b.date ? 1 : -1;
}

/** Throws when any feature is not strictly before the board. */
export function assertNoLeakage(logs: GameLog[], boardDate: string): void {
  for (const l of logs) {
    if (l.date >= boardDate) {
      throw new Error(`leakage: feature game ${l.gameId} on ${l.date} is not before board ${boardDate}`);
    }
  }
}

export function buildPools(ctx: PoolContext): PoolResult {
  assertNoLeakage(ctx.logs, ctx.boardDate);
  const seasons = new Set([ctx.season, ctx.lastSeason]);
  const teamLogs = ctx.logs.filter((l) => l.teamId === ctx.teamId && seasons.has(l.season));

  // Minutes per (game, player) for this team; absence from a game means 0 minutes.
  const minutesIn = new Map<string, Map<string, number>>();
  for (const l of teamLogs) {
    let m = minutesIn.get(l.gameId);
    if (!m) minutesIn.set(l.gameId, (m = new Map()));
    m.set(l.playerId, l.minutes);
  }
  const teammateMinutes = (gameId: string, pid: string) => minutesIn.get(gameId)?.get(pid) ?? 0;

  const played: PoolGame[] = teamLogs
    .filter((l) => l.playerId === ctx.playerId && l.minutes > 0)
    .map((l) => ({
      gameId: l.gameId,
      date: l.date,
      season: l.season,
      minutes: l.minutes,
      pts: l.pts,
      reb: l.reb,
      ast: l.ast,
      shortAppearance: l.minutes < MODEL.SHORT_APPEARANCE_MINUTES,
    }))
    .sort(byRecent);

  if (played.length === 0) return { ok: false, reason: "no_base_history", detail: "no same-team games" };
  const base = played.slice(0, MODEL.BASE_POOL_CAP);

  // Rotation teammates.
  const rotation: Pools["rotation"] = [];
  for (const t of ctx.teammates) {
    if (t.playerId === ctx.playerId) continue;
    const status = ctx.assumeOut?.includes(t.playerId) ? "out" : t.status;
    const theirGames = teamLogs
      .filter((l) => l.playerId === t.playerId && l.minutes > 0)
      .sort(byRecent);
    if (ctx.startersKnown && t.listedStarter && theirGames.length < MODEL.NEW_STARTER_MIN_GAMES) {
      return {
        ok: false,
        reason: "teammate_no_history",
        detail: `rotation teammate with no team history: ${t.playerId}`,
      };
    }
    const recent = theirGames.slice(0, MODEL.ROTATION_LOOKBACK_GAMES).map((l) => l.minutes);
    if (recent.length > 0 && median(recent) >= MODEL.ROTATION_MEDIAN_MINUTES) {
      rotation.push({ playerId: t.playerId, status });
    }
  }

  const unresolved = rotation.filter((r) => r.status === "questionable" || r.status === "doubtful");
  if (unresolved.length > 0) {
    return {
      ok: false,
      reason: "teammate_status_unresolved",
      detail: `teammate status unresolved: ${unresolved.map((r) => r.playerId).join(",")}`,
      ids: unresolved.map((r) => r.playerId),
    };
  }

  // Active teammates constrain the pool only when returning from a recent absence.
  const recentTeamGames = [...new Set(teamLogs.map((l) => `${l.date}|${l.gameId}`))]
    .sort()
    .reverse()
    .slice(0, MODEL.RETURNING_LOOKBACK)
    .map((k) => k.split("|")[1]);
  const returning = (pid: string) =>
    recentTeamGames.filter((g) => teammateMinutes(g, pid) < MODEL.AVAILABILITY_MINUTES).length >= MODEL.RETURNING_MIN_MISSES;
  const constraints = rotation.filter((r) => r.status === "out" || returning(r.playerId));
  const matchesTonight = (g: PoolGame) =>
    constraints.every((r) => {
      const m = teammateMinutes(g.gameId, r.playerId);
      return r.status === "out" ? m < MODEL.AVAILABILITY_MINUTES : m >= MODEL.AVAILABILITY_MINUTES;
    });
  const matched = played.filter(matchesTonight).slice(0, MODEL.MATCHED_POOL_CAP);

  const outCount = rotation.filter((r) => r.status === "out").length;
  if (matched.length === 0 && outCount >= 2) {
    return {
      ok: false,
      reason: "empty_out_intersection",
      detail: `no game has all ${outCount} out teammates out together`,
    };
  }
  const matchedMinutes = matched.reduce((s, g) => s + g.minutes, 0);
  if (matched.length < (ctx.minMatchedGames ?? MODEL.MIN_MATCHED_GAMES) || matchedMinutes < MODEL.MIN_MATCHED_MINUTES) {
    return {
      ok: false,
      reason: "too_few_games",
      detail: `matched_pool has ${matched.length} games, ${matchedMinutes} minutes`,
    };
  }
  return { ok: true, pools: { base, matched, rotation, season: ctx.season, lastSeason: ctx.lastSeason } };
}

export interface Projection {
  stat: Stat;
  mean: number;
  variance: number;
  alpha: number;
  alphaPositive: boolean;
  overdispersed: boolean;
  distKind: CountDist["kind"];
  expMinutes: number;
  varMinutes: number;
  rateBase: number;
  rateMatched: number;
  rateFinal: number;
  uncertainty: Uncertainty;
  /** The minutes sample behind E[M] and Var(M), one entry per game. */
  minuteSample: number[];
  counts: { rateBase: number; rateMatched: number; alpha: number; minutes: number; matched: number };
  flags: string[];
  matchedGameIds: string[];
}

function rateOf(games: PoolGame[], stat: Stat): { rate: number; statSum: number; minSum: number } {
  let statSum = 0;
  let minSum = 0;
  for (const g of games) {
    statSum += g[stat];
    minSum += g.minutes;
  }
  return { rate: minSum > 0 ? statSum / minSum : 0, statSum, minSum };
}

/**
 * Method-of-moments NB2 overdispersion on a pool with its own rate r.
 * Games with r*m = 0 are skipped.
 */
export function alphaMoM(games: { x: number; m: number }[], r: number): { alpha: number; n: number } {
  const used = games.filter((g) => r * g.m > 0);
  const n = used.length;
  if (n === 0) return { alpha: 0, n: 0 };
  let resid = 0;
  let mu = 0;
  let mu2 = 0;
  for (const g of used) {
    const e = r * g.m;
    resid += (g.x - e) ** 2;
    mu += e;
    mu2 += e * e;
  }
  return { alpha: (resid / n - mu / n) / (mu2 / n), n };
}

/**
 * Estimation uncertainty, so the predictive variance is not just the
 * plug-in variance: Var(rate_final) from the matched sample under the NB
 * model, and Var of the minutes mean, Var(M) / n.
 */
export interface Uncertainty {
  varRate: number;
  varMeanMinutes: number;
}

export function momentsFor(
  rateFinal: number,
  alpha: number,
  expMinutes: number,
  varMinutes: number,
  u: Uncertainty = { varRate: 0, varMeanMinutes: 0 },
): { mean: number; variance: number } {
  const r = rateFinal;
  const eMu = r * expMinutes;
  const eM2 = varMinutes + expMinutes * expMinutes;
  const eMu2 = r * r * eM2;
  const varMu = r * r * varMinutes;
  const estimation = u.varRate * (eM2 + u.varMeanMinutes) + r * r * u.varMeanMinutes;
  return { mean: eMu, variance: eMu + alpha * eMu2 + varMu + estimation };
}

export function project(pools: Pools, stat: Stat): Projection {
  const flags: string[] = [];
  const longBase = pools.base.filter((g) => !g.shortAppearance);
  const longMatched = pools.matched.filter((g) => !g.shortAppearance);

  const base = rateOf(longBase, stat);
  const matched = rateOf(longMatched, stat);
  const rateFinal =
    (matched.statSum + MODEL.PRIOR_MINUTES * base.rate) / (matched.minSum + MODEL.PRIOR_MINUTES);

  const matchedMinutesAll = pools.matched.reduce((s, g) => s + g.minutes, 0);
  if (pools.matched.length < MODEL.THIN_GAMES || matchedMinutesAll < MODEL.THIN_MINUTES) {
    flags.push("thin_sample");
  }

  // Dispersion.
  const toXM = (gs: PoolGame[]) => gs.map((g) => ({ x: g[stat], m: g.minutes }));
  let a = alphaMoM(toXM(longMatched), matched.rate);
  if (a.n < MODEL.ALPHA_MIN_GAMES) {
    a = alphaMoM(toXM(longBase), base.rate);
    flags.push("dispersion_from_base_pool");
  }
  if (a.n < MODEL.ALPHA_MIN_GAMES) flags.push("dispersion_thin");
  const alphaPositive = a.alpha > 0;
  const alpha = alphaPositive ? a.alpha : 0;
  if (!alphaPositive) flags.push("dispersion_floor");

  // Minutes: short appearances stay in (they are graded); seasons never mix.
  let minuteGames = pools.matched.filter((g) => g.season === pools.season);
  if (minuteGames.length < MODEL.MINUTES_MIN_THIS_SEASON) {
    minuteGames = pools.matched.filter((g) => g.season === pools.lastSeason);
    flags.push("minutes_prior_season");
  }
  const mins = minuteGames.map((g) => g.minutes);
  const expMinutes = mins.reduce((s, x) => s + x, 0) / mins.length;
  const varMinutes =
    mins.length > 1 ? mins.reduce((s, x) => s + (x - expMinutes) ** 2, 0) / (mins.length - 1) : 0;

  // Var(sum of matched stat) under the model, divided by the blended exposure squared.
  let varStatSum = 0;
  for (const g of longMatched) {
    const e = rateFinal * g.minutes;
    varStatSum += e + alpha * e * e;
  }
  const uncertainty: Uncertainty = {
    varRate: varStatSum / (matched.minSum + MODEL.PRIOR_MINUTES) ** 2,
    varMeanMinutes: mins.length > 1 ? varMinutes / mins.length : 0,
  };
  const { mean, variance } = momentsFor(rateFinal, alpha, expMinutes, varMinutes, uncertainty);
  const dist = predictive({ mean, variance, rateFinal, alpha, expMinutes }, { kappa: 1, q: 0 });

  return {
    stat,
    mean,
    variance,
    alpha,
    alphaPositive,
    overdispersed: variance > mean,
    distKind: dist.kind,
    expMinutes,
    varMinutes,
    rateBase: base.rate,
    rateMatched: matched.rate,
    rateFinal,
    uncertainty,
    minuteSample: mins,
    counts: {
      rateBase: longBase.length,
      rateMatched: longMatched.length,
      alpha: a.n,
      minutes: mins.length,
      matched: pools.matched.length,
    },
    flags,
    matchedGameIds: pools.matched.map((g) => g.gameId),
  };
}

/** The published predictive distribution: NB moments plus the train-fit dispersion. */
export function projectionDist(p: Projection, params: DispersionParams = dispersionFor(p.stat)): CountDist {
  return predictive(p, params);
}

export interface SensitivityResult {
  minusMinutes: number;
  plusMinutes: number;
  wideVariance: number;
  failing: ("minutes_minus" | "minutes_plus" | "variance_wide")[];
  zeroMinuteCase: boolean;
}

/** Recomputes EV with the line, book, odds, rate and shrinkage fixed. Not a worst case. */
export function sensitivity(
  p: Projection,
  line: number,
  side: Side,
  decimal: number,
  SHRINK: number,
  evMin: number,
): SensitivityResult {
  const evAt = (mean: number, variance: number, expMinutes: number) => {
    const raw: OutcomeProbs = sideProbs(projectionDist({ ...p, mean, variance, expMinutes }), line, side);
    return expectedValue(shrink(raw, SHRINK), decimal);
  };
  const lowMin = Math.max(0, p.expMinutes - MODEL.SENSITIVITY_MINUTES);
  const hiMin = p.expMinutes + MODEL.SENSITIVITY_MINUTES;
  const lo = momentsFor(p.rateFinal, p.alpha, lowMin, p.varMinutes, p.uncertainty);
  const hi = momentsFor(p.rateFinal, p.alpha, hiMin, p.varMinutes, p.uncertainty);
  const minusMinutes = evAt(lo.mean, lo.variance, lowMin);
  const plusMinutes = evAt(hi.mean, hi.variance, hiMin);
  const wideVariance = evAt(p.mean, p.variance * MODEL.SENSITIVITY_SIGMA ** 2, p.expMinutes);
  const failing: SensitivityResult["failing"] = [];
  if (minusMinutes < evMin) failing.push("minutes_minus");
  if (plusMinutes < evMin) failing.push("minutes_plus");
  if (wideVariance < evMin) failing.push("variance_wide");
  return { minusMinutes, plusMinutes, wideVariance, failing, zeroMinuteCase: lowMin === 0 };
}
