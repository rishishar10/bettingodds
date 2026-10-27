# Free projection check

Seasons: 2023-24, 2024-25 (every 1 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":400,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":24,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"RETURNING_MIN_MISSES":3,"RETURNING_LOOKBACK":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"RECENT_MINUTES_GAMES":5,"RECENT_MINUTES_WEIGHT":0.55,"OPP_LOOKBACK_GAMES":15,"OPP_SHRINK_GAMES":10,"OPP_BETA_PTS":0.97,"OPP_BETA_REB":0.54,"OPP_BETA_AST":0.81,"PTS_MEAN_SCALE":1.012,"SENSITIVITY_SIGMA":1.25}`

Players who played: 52055. Supported: 27149 (52.2%).
Prop-like players (median minutes >= 20 over their last 10 games for the team): 32963; supported 19406 (58.9%).
The predictive distribution includes the train-fit dispersion in rules/dispersion.json.

| Unsupported reason | Count |
|---|---|
| too_few_games | 16149 |
| teammate_no_history | 2084 |
| empty_out_intersection | 6447 |
| no_base_history | 226 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus the predictive mean; predicted SD is the predictive standard deviation.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 27149 | 0.14 | 6.01 | 6.46 | 48.1% | 78.4% | 1.13 0.96 0.88 0.90 0.95 1.00 1.02 1.06 1.07 1.03 |
| reb | 27149 | -0.05 | 2.49 | 2.51 | 49.4% | 79.4% | 1.05 1.04 1.01 0.99 1.02 0.94 0.99 0.99 0.97 1.01 |
| ast | 27149 | -0.00 | 1.84 | 1.83 | 49.3% | 79.2% | 1.02 1.02 1.01 1.01 0.97 0.99 0.96 1.00 0.95 1.06 |
| ast:dispersion_floor | 15645 | 0.01 | 1.82 | 1.76 | 48.7% | 78.2% | 1.06 1.03 1.02 1.01 0.97 0.95 0.93 0.98 0.93 1.12 |
| ast:dispersion_from_base_pool | 7251 | 0.01 | 1.75 | 1.71 | 48.2% | 77.9% | 1.06 1.02 0.97 0.94 0.96 0.99 0.97 0.97 0.97 1.15 |
| ast:dispersion_thin | 1088 | 0.04 | 1.38 | 1.25 | 46.6% | 75.8% | 1.11 0.97 0.97 0.95 0.95 0.87 1.00 0.84 1.05 1.31 |
| ast:minutes_prior_season | 4448 | 0.04 | 1.89 | 1.84 | 49.1% | 78.1% | 1.02 0.99 0.92 0.93 1.05 0.95 1.02 0.99 0.96 1.17 |
| ast:thin_sample | 7540 | 0.01 | 1.72 | 1.69 | 48.1% | 78.0% | 1.06 1.04 0.97 0.95 0.96 0.99 0.96 0.97 0.97 1.13 |
| pts:dispersion_floor | 1414 | 0.16 | 5.73 | 5.00 | 40.6% | 70.2% | 1.58 1.17 0.80 0.76 0.76 0.86 0.86 0.93 0.87 1.41 |
| pts:dispersion_from_base_pool | 7251 | 0.31 | 5.82 | 6.10 | 46.0% | 75.8% | 1.25 0.94 0.78 0.88 0.85 0.95 1.02 1.02 1.14 1.17 |
| pts:dispersion_thin | 1088 | -0.08 | 4.25 | 4.27 | 42.3% | 71.6% | 1.55 1.04 0.75 0.76 0.88 0.87 0.85 0.90 1.10 1.29 |
| pts:minutes_prior_season | 4448 | 0.34 | 6.37 | 6.72 | 46.6% | 78.1% | 1.09 0.97 0.89 0.86 0.83 1.04 1.02 1.07 1.13 1.10 |
| pts:thin_sample | 7540 | 0.28 | 5.75 | 6.01 | 46.0% | 75.7% | 1.27 0.94 0.79 0.88 0.85 0.95 1.02 1.00 1.14 1.16 |
| reb:dispersion_floor | 15277 | -0.04 | 2.47 | 2.40 | 48.3% | 78.3% | 1.10 1.09 1.00 1.00 1.00 0.91 0.95 0.95 0.94 1.07 |
| reb:dispersion_from_base_pool | 7251 | -0.04 | 2.43 | 2.44 | 49.3% | 78.4% | 1.05 1.04 1.01 1.06 0.98 0.94 0.94 0.95 0.93 1.11 |
| reb:dispersion_thin | 1088 | -0.07 | 1.97 | 1.89 | 46.4% | 75.6% | 1.19 1.01 1.12 0.94 0.81 0.97 1.00 0.73 0.98 1.25 |
| reb:minutes_prior_season | 4448 | -0.04 | 2.57 | 2.61 | 49.8% | 78.9% | 1.14 0.93 0.97 0.98 1.01 0.92 1.02 1.04 1.01 0.98 |
| reb:thin_sample | 7540 | -0.05 | 2.41 | 2.42 | 49.3% | 78.3% | 1.06 1.04 1.02 1.06 0.98 0.92 0.94 0.95 0.92 1.11 |
