// Model constants. These are part of the hashed pass/fail rule; changing any
// of them after rules/gate.json is committed changes the rule hash.
export const MODEL = {
  BASE_POOL_CAP: 30,
  MATCHED_POOL_CAP: 30,
  MIN_MATCHED_GAMES: 5,
  MIN_MATCHED_MINUTES: 50,
  THIN_GAMES: 10,
  THIN_MINUTES: 200,
  /** 200 in the original spec; 400 scored better on both train seasons (reports/stress-test.md). */
  PRIOR_MINUTES: 400,
  SHORT_APPEARANCE_MINUTES: 8,
  ALPHA_MIN_GAMES: 10,
  MINUTES_MIN_THIS_SEASON: 3,
  ROTATION_MEDIAN_MINUTES: 24,
  ROTATION_LOOKBACK_GAMES: 15,
  NEW_STARTER_MIN_GAMES: 3,
  AVAILABILITY_MINUTES: 10,
  /** An active teammate constrains the pool only if returning: missed this many of the team's last RETURNING_LOOKBACK games. */
  RETURNING_MIN_MISSES: 3,
  RETURNING_LOOKBACK: 10,
  CONDITIONAL_MIN_GAMES: 3,
  SENSITIVITY_MINUTES: 3,
  /** Minutes blend: E[M] = w * (last RECENT_MINUTES_GAMES played) + (1 - w) * matched E[M]; w fit on 2023-24 (0.54-0.57). */
  RECENT_MINUTES_GAMES: 5,
  RECENT_MINUTES_WEIGHT: 0.55,
  /** Opponent: rate * factor^beta, factor = opponent's allowed per-minute rate over its last 15 games vs league, shrunk with 10 games. Betas fit on 2023-24. */
  OPP_LOOKBACK_GAMES: 15,
  OPP_SHRINK_GAMES: 10,
  OPP_BETA_PTS: 0.97,
  OPP_BETA_REB: 0.54,
  OPP_BETA_AST: 0.81,
  /** Points ran ~1% low on 2023-24 (the base-rate prior lags league scoring); fit there, confirmed on 2024-25. */
  PTS_MEAN_SCALE: 1.012,
  SENSITIVITY_SIGMA: 1.25,
} as const;

export const POLICY = {
  EV_MIN: 0.08,
  EV_GRID: [0.04, 0.06, 0.08, 0.1],
  /** Placeholder until the odds-coverage note sets it; see reports/odds-coverage.md. */
  ODDS_MAX_AGE_MINUTES: 20,
  /** Flip to true only after reports/odds-coverage.md records the decision. */
  ODDS_MAX_AGE_SET: false,
  MIN_CLV_GAMES: 100,
  DLL_MARGIN: 0.005,
} as const;

/**
 * Free-plan credit policy (not part of the model): skip the odds fetch on
 * slates with fewer games than this, and whenever this month's remaining
 * credits cannot cover the slate. A paid plan sets ODDS_PAID_PLAN=1.
 */
export const FREE_PLAN = {
  MIN_SLATE_GAMES: 4,
  CREDITS_PER_GAME: 3,
  /** Day of the month the free credits reset (the signup day). Override with ODDS_CYCLE_DAY. */
  CYCLE_RESET_DAY: 26,
} as const;

/** Fallback shrinkage if no fitted value exists (rules/provisional-shrink.json, then rules/fitted.json). */
export const HEURISTIC_SHRINK = 0.5;
