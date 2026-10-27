# Free projection check

Seasons: 2023-24, 2024-25 (every 1 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":400,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":24,"ROTATION_LOOKBACK_GAMES":15,"ROTATION_MIN_GAMES":8,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"RETURNING_MIN_MISSES":3,"RETURNING_LOOKBACK":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"RECENT_MINUTES_GAMES":5,"RECENT_MINUTES_WEIGHT":0.55,"DNP_RECENT_WEIGHT":0.17,"OPP_LOOKBACK_GAMES":15,"OPP_SHRINK_GAMES":10,"OPP_BETA_PTS":0.97,"OPP_BETA_REB":0.54,"OPP_BETA_AST":0.81,"PTS_MEAN_SCALE":1.012,"SENSITIVITY_SIGMA":1.25}`

Players who played: 52055. Supported: 28897 (55.5%).
Prop-like players (median minutes >= 20 over their last 10 games for the team): 32963; supported 20737 (62.9%).
The predictive distribution includes the train-fit dispersion in rules/dispersion.json.

| Unsupported reason | Count |
|---|---|
| too_few_games | 14977 |
| teammate_no_history | 2084 |
| empty_out_intersection | 5871 |
| no_base_history | 226 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus the predictive mean; predicted SD is the predictive standard deviation.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 28897 | 0.22 | 6.01 | 6.43 | 48.0% | 78.2% | 1.11 0.94 0.88 0.88 0.95 0.98 1.02 1.08 1.08 1.07 |
| reb | 28897 | -0.02 | 2.49 | 2.48 | 49.1% | 79.1% | 1.04 1.01 1.01 0.98 0.99 0.97 0.96 1.01 0.98 1.05 |
| ast | 28897 | -0.00 | 1.84 | 1.82 | 49.1% | 78.8% | 1.05 1.01 0.99 0.99 0.96 0.98 0.98 1.00 0.96 1.08 |
| ast:dispersion_floor | 16677 | 0.01 | 1.82 | 1.75 | 48.3% | 77.6% | 1.10 0.99 1.01 0.99 0.94 0.95 0.96 0.97 0.95 1.14 |
| ast:dispersion_from_base_pool | 7480 | 0.01 | 1.74 | 1.69 | 47.9% | 78.2% | 1.02 1.03 0.97 0.92 0.94 0.96 1.00 0.99 1.01 1.16 |
| ast:dispersion_thin | 1165 | 0.05 | 1.37 | 1.24 | 44.8% | 77.3% | 1.02 1.14 0.87 0.94 0.88 0.82 0.92 1.06 1.10 1.25 |
| ast:minutes_prior_season | 4981 | 0.06 | 1.89 | 1.82 | 48.8% | 77.6% | 1.03 0.89 0.98 0.95 0.94 0.95 1.02 1.06 0.96 1.21 |
| ast:thin_sample | 7778 | 0.01 | 1.72 | 1.67 | 47.8% | 78.1% | 1.04 1.03 0.97 0.94 0.94 0.96 0.98 0.99 1.01 1.15 |
| pts:dispersion_floor | 1524 | 0.24 | 5.78 | 5.03 | 40.8% | 69.2% | 1.54 1.08 0.82 0.74 0.79 0.86 0.82 0.96 0.85 1.54 |
| pts:dispersion_from_base_pool | 7480 | 0.37 | 5.82 | 6.03 | 45.1% | 75.0% | 1.26 0.94 0.77 0.80 0.85 0.93 1.03 1.05 1.13 1.24 |
| pts:dispersion_thin | 1165 | -0.01 | 4.27 | 4.28 | 40.9% | 70.6% | 1.55 1.08 0.70 0.72 0.84 0.75 0.91 0.98 1.09 1.38 |
| pts:minutes_prior_season | 4981 | 0.45 | 6.31 | 6.64 | 46.9% | 78.0% | 1.08 0.92 0.87 0.85 0.87 0.95 1.10 1.10 1.15 1.12 |
| pts:thin_sample | 7778 | 0.34 | 5.75 | 5.94 | 45.2% | 74.7% | 1.29 0.94 0.77 0.80 0.84 0.92 1.04 1.04 1.12 1.23 |
| reb:dispersion_floor | 16287 | -0.01 | 2.46 | 2.38 | 47.7% | 78.2% | 1.07 1.05 1.03 0.96 0.96 0.93 0.92 1.00 0.98 1.10 |
| reb:dispersion_from_base_pool | 7480 | 0.00 | 2.41 | 2.40 | 48.8% | 78.5% | 1.02 1.02 1.00 1.02 0.98 0.91 0.95 0.99 0.98 1.13 |
| reb:dispersion_thin | 1165 | -0.01 | 1.98 | 1.88 | 47.9% | 76.7% | 1.00 1.05 1.00 0.97 1.06 0.73 0.87 1.03 0.97 1.33 |
| reb:minutes_prior_season | 4981 | 0.02 | 2.57 | 2.57 | 49.0% | 78.6% | 1.04 0.95 0.94 0.93 0.95 1.05 0.99 1.05 1.01 1.10 |
| reb:thin_sample | 7778 | -0.01 | 2.40 | 2.38 | 48.8% | 78.4% | 1.04 1.02 1.00 1.03 0.98 0.90 0.95 0.97 0.98 1.12 |
