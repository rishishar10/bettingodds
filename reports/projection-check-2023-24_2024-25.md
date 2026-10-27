# Free projection check

Seasons: 2023-24, 2024-25 (every 1 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":200,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":24,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"RETURNING_MIN_MISSES":3,"RETURNING_LOOKBACK":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"SENSITIVITY_SIGMA":1.25}`

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
| pts | 27149 | 0.17 | 6.13 | 6.56 | 48.1% | 78.1% | 1.15 0.93 0.87 0.88 0.96 1.00 1.03 1.06 1.09 1.04 |
| reb | 27149 | -0.07 | 2.54 | 2.59 | 49.7% | 79.6% | 1.04 1.03 1.03 0.99 1.00 0.98 0.98 0.98 0.96 1.00 |
| ast | 27149 | -0.02 | 1.87 | 1.86 | 49.1% | 79.1% | 1.03 1.03 1.02 0.99 0.99 0.99 0.94 0.98 0.97 1.06 |
| ast:dispersion_floor | 15645 | -0.01 | 1.85 | 1.78 | 48.5% | 78.0% | 1.07 1.03 1.03 0.99 0.99 0.96 0.93 0.93 0.94 1.13 |
| ast:dispersion_from_base_pool | 7251 | -0.02 | 1.79 | 1.75 | 47.6% | 77.8% | 1.09 1.03 0.98 0.90 1.01 0.95 0.95 0.97 1.00 1.13 |
| ast:dispersion_thin | 1088 | 0.03 | 1.39 | 1.28 | 46.2% | 76.3% | 1.15 0.97 0.90 0.93 1.03 0.83 0.98 0.90 1.08 1.22 |
| ast:minutes_prior_season | 4448 | -0.06 | 1.98 | 1.91 | 47.9% | 77.2% | 1.14 1.01 0.95 0.96 1.01 0.96 0.92 0.95 0.96 1.13 |
| ast:thin_sample | 7540 | -0.02 | 1.77 | 1.73 | 47.5% | 78.0% | 1.08 1.04 0.98 0.89 1.01 0.95 0.94 0.96 1.01 1.12 |
| pts:dispersion_floor | 1414 | 0.15 | 5.80 | 5.05 | 41.8% | 69.5% | 1.62 1.13 0.80 0.69 0.83 0.89 0.88 0.83 0.90 1.43 |
| pts:dispersion_from_base_pool | 7251 | 0.28 | 5.98 | 6.27 | 45.8% | 75.8% | 1.27 0.91 0.77 0.85 0.87 0.95 1.03 1.03 1.18 1.15 |
| pts:dispersion_thin | 1088 | -0.09 | 4.27 | 4.35 | 42.7% | 72.6% | 1.52 1.06 0.76 0.74 0.82 0.95 0.90 1.01 1.03 1.22 |
| pts:minutes_prior_season | 4448 | 0.07 | 6.70 | 6.95 | 45.8% | 76.5% | 1.28 0.96 0.84 0.88 0.87 0.92 0.96 1.06 1.14 1.08 |
| pts:thin_sample | 7540 | 0.26 | 5.91 | 6.17 | 45.5% | 75.7% | 1.29 0.92 0.77 0.84 0.86 0.95 1.03 1.04 1.16 1.14 |
| reb:dispersion_floor | 15277 | -0.07 | 2.52 | 2.47 | 48.5% | 78.3% | 1.11 1.08 1.01 1.00 0.97 0.95 0.93 0.94 0.95 1.06 |
| reb:dispersion_from_base_pool | 7251 | -0.07 | 2.51 | 2.53 | 48.8% | 78.3% | 1.07 1.05 0.97 1.02 0.98 0.99 0.95 0.89 0.98 1.10 |
| reb:dispersion_thin | 1088 | -0.08 | 1.99 | 1.96 | 47.5% | 75.6% | 1.19 0.97 1.08 1.03 0.84 0.97 0.95 0.79 0.93 1.26 |
| reb:minutes_prior_season | 4448 | -0.19 | 2.73 | 2.74 | 48.2% | 78.0% | 1.22 1.05 0.99 0.95 1.00 0.92 0.96 0.97 0.97 0.98 |
| reb:thin_sample | 7540 | -0.08 | 2.49 | 2.51 | 48.7% | 78.2% | 1.07 1.05 0.98 1.01 0.98 0.97 0.96 0.89 0.97 1.10 |
