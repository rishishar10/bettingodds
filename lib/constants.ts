// Model constants. These are part of the hashed pass/fail rule; changing any
// of them after rules/gate.json is committed changes the rule hash.
export const MODEL = {
  BASE_POOL_CAP: 30,
  MATCHED_POOL_CAP: 30,
  MIN_MATCHED_GAMES: 5,
  MIN_MATCHED_MINUTES: 50,
  THIN_GAMES: 10,
  THIN_MINUTES: 200,
  PRIOR_MINUTES: 200,
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

/** Shrinkage before the train fit. Replaced by the fitted value in rules/fitted.json. */
export const HEURISTIC_SHRINK = 0.5;
