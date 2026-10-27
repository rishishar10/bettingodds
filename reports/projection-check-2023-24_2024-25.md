# Free projection check

Seasons: 2023-24, 2024-25 (every 1 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":400,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":24,"ROTATION_LOOKBACK_GAMES":15,"ROTATION_MIN_GAMES":8,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"RETURNING_MIN_MISSES":3,"RETURNING_LOOKBACK":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"RECENT_MINUTES_GAMES":5,"RECENT_MINUTES_WEIGHT":0.55,"DNP_RECENT_WEIGHT":0.17,"OPP_LOOKBACK_GAMES":15,"OPP_SHRINK_GAMES":10,"OPP_BETA_PTS":0.97,"OPP_BETA_REB":0.54,"OPP_BETA_AST":0.81,"PTS_MEAN_SCALE":1.012,"SENSITIVITY_SIGMA":1.25}`

Players who played: 52055. Supported: 23323 (44.8%).
Prop-like players (median minutes >= 20 over their last 10 games for the team): 32963; supported 16814 (51.0%).
The predictive distribution includes the train-fit dispersion in rules/dispersion.json.

| Unsupported reason | Count |
|---|---|
| too_few_games | 17024 |
| teammate_no_history | 2084 |
| empty_out_intersection | 9398 |
| no_base_history | 226 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus the predictive mean; predicted SD is the predictive standard deviation.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 23323 | 0.10 | 5.98 | 6.49 | 48.7% | 78.4% | 1.14 0.92 0.89 0.91 0.97 1.00 1.03 1.07 1.06 1.02 |
| reb | 23323 | -0.02 | 2.48 | 2.47 | 49.2% | 79.6% | 1.02 1.03 1.02 0.99 0.98 0.98 0.98 0.99 0.99 1.02 |
| ast | 23323 | -0.01 | 1.82 | 1.82 | 49.4% | 79.4% | 1.03 1.00 1.03 1.04 0.99 0.95 1.01 0.97 0.95 1.03 |
| ast:dispersion_floor | 13491 | 0.00 | 1.82 | 1.75 | 48.5% | 78.3% | 1.05 1.02 1.03 1.05 0.96 0.92 0.97 0.93 0.95 1.11 |
| ast:dispersion_from_base_pool | 7788 | -0.00 | 1.76 | 1.73 | 47.9% | 78.8% | 1.02 1.04 1.02 0.99 0.92 0.95 0.95 0.99 1.01 1.10 |
| ast:dispersion_thin | 988 | 0.06 | 1.39 | 1.26 | 45.1% | 76.2% | 1.05 0.94 0.99 1.00 0.93 0.84 0.93 0.93 1.05 1.33 |
| ast:minutes_prior_season | 1835 | -0.03 | 1.85 | 1.81 | 49.8% | 78.3% | 1.12 0.90 1.04 1.21 0.84 0.97 1.00 0.94 0.93 1.05 |
| ast:thin_sample | 8081 | -0.01 | 1.75 | 1.71 | 47.8% | 78.6% | 1.05 1.02 1.02 1.00 0.93 0.95 0.95 0.98 1.02 1.09 |
| pts:dispersion_floor | 1334 | 0.09 | 5.70 | 5.16 | 41.2% | 68.5% | 1.69 1.06 0.76 0.78 0.90 0.79 0.82 0.81 0.92 1.45 |
| pts:dispersion_from_base_pool | 7788 | 0.20 | 5.84 | 6.27 | 46.9% | 76.3% | 1.28 0.86 0.81 0.88 0.87 0.99 1.01 1.11 1.09 1.10 |
| pts:dispersion_thin | 988 | 0.03 | 4.35 | 4.39 | 41.5% | 71.1% | 1.55 0.95 0.61 0.84 0.96 0.70 0.91 1.04 1.09 1.35 |
| pts:minutes_prior_season | 1835 | -0.13 | 6.32 | 6.77 | 47.3% | 77.5% | 1.32 0.92 0.95 0.94 0.76 1.04 1.05 1.02 1.07 0.93 |
| pts:thin_sample | 8081 | 0.19 | 5.78 | 6.18 | 46.9% | 76.1% | 1.29 0.86 0.82 0.88 0.86 0.99 1.01 1.10 1.08 1.10 |
| reb:dispersion_floor | 13283 | -0.02 | 2.47 | 2.40 | 48.3% | 78.3% | 1.07 1.07 1.03 0.97 0.98 0.95 0.93 0.97 0.93 1.09 |
| reb:dispersion_from_base_pool | 7788 | -0.02 | 2.42 | 2.42 | 48.6% | 79.0% | 1.02 1.06 1.02 0.97 0.96 0.96 0.97 0.98 0.98 1.08 |
| reb:dispersion_thin | 988 | -0.02 | 2.03 | 1.91 | 48.1% | 78.2% | 0.89 1.23 0.89 1.10 0.88 0.88 1.02 0.83 0.98 1.29 |
| reb:minutes_prior_season | 1835 | -0.10 | 2.50 | 2.54 | 48.9% | 79.1% | 1.18 1.00 0.92 0.96 0.99 0.94 1.05 0.97 1.08 0.91 |
| reb:thin_sample | 8081 | -0.02 | 2.41 | 2.41 | 48.8% | 79.0% | 1.01 1.06 1.02 0.99 0.95 0.97 0.97 0.97 0.97 1.08 |
