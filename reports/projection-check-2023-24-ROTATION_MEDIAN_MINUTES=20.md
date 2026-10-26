# Free projection check

Seasons: 2023-24 (every 3 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":200,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":20,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"SENSITIVITY_SIGMA":1.25}`

Players who played: 8425. Supported: 2529 (30.0%).

| Unsupported reason | Count |
|---|---|
| too_few_games | 3874 |
| empty_out_intersection | 1989 |
| no_base_history | 33 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus projected mean.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 2529 | -0.04 | 6.02 | 5.47 | 42.6% | 71.8% | 1.55 0.93 0.84 0.72 0.83 0.84 0.92 1.10 0.99 1.27 |
| reb | 2529 | -0.07 | 2.47 | 2.43 | 49.3% | 79.4% | 1.12 1.04 0.98 0.96 0.98 1.03 0.99 0.98 0.97 0.95 |
| ast | 2529 | 0.07 | 1.85 | 1.86 | 48.6% | 79.8% | 0.89 1.07 0.94 0.89 0.88 1.01 1.06 1.07 1.06 1.13 |
| ast:dispersion_floor | 1484 | 0.06 | 1.84 | 1.74 | 46.9% | 77.9% | 0.96 1.13 0.96 0.86 0.83 0.92 1.11 0.98 1.00 1.25 |
| ast:dispersion_from_base_pool | 1005 | -0.01 | 1.74 | 1.78 | 48.4% | 81.0% | 0.92 1.14 0.95 0.91 0.82 1.00 1.00 1.11 1.17 0.99 |
| ast:dispersion_thin | 45 | -0.24 | 1.36 | 1.37 | 48.9% | 80.0% | 1.11 0.89 1.56 1.11 0.44 0.89 1.56 0.67 0.89 0.89 |
| ast:minutes_prior_season | 103 | 0.29 | 1.83 | 1.80 | 51.5% | 77.7% | 0.87 1.07 0.58 0.78 0.87 1.36 0.97 1.46 0.68 1.36 |
| ast:thin_sample | 1091 | -0.03 | 1.69 | 1.74 | 48.9% | 81.3% | 0.93 1.13 0.93 0.94 0.84 1.00 1.03 1.10 1.16 0.93 |
| pts:dispersion_floor | 128 | 0.91 | 6.46 | 4.44 | 37.5% | 63.3% | 1.64 0.70 0.78 0.78 0.47 0.86 0.94 0.78 1.02 2.03 |
| pts:dispersion_from_base_pool | 1005 | -0.07 | 5.89 | 5.30 | 40.7% | 70.3% | 1.65 0.93 0.97 0.72 0.65 0.69 1.02 1.09 0.98 1.31 |
| pts:dispersion_thin | 45 | 0.16 | 5.06 | 3.32 | 26.7% | 57.8% | 2.67 1.33 1.11 0.44 0.22 0.44 0.44 0.67 1.11 1.56 |
| pts:minutes_prior_season | 103 | 0.14 | 6.36 | 5.79 | 35.0% | 68.0% | 1.46 0.97 1.07 0.49 0.58 0.97 0.58 0.87 1.26 1.75 |
| pts:thin_sample | 1091 | -0.11 | 5.76 | 5.18 | 40.3% | 69.9% | 1.70 0.93 0.96 0.70 0.67 0.69 1.00 1.08 0.97 1.31 |
| reb:dispersion_floor | 1442 | -0.06 | 2.53 | 2.34 | 48.6% | 77.6% | 1.18 1.11 0.96 0.89 1.05 1.00 0.96 0.87 0.90 1.06 |
| reb:dispersion_from_base_pool | 1005 | -0.07 | 2.41 | 2.38 | 48.5% | 78.8% | 1.17 1.10 0.93 1.00 0.79 0.99 1.03 1.07 0.98 0.95 |
| reb:dispersion_thin | 45 | -0.39 | 1.91 | 1.80 | 44.4% | 73.3% | 1.56 1.11 1.11 1.56 0.89 0.22 1.11 0.67 0.67 1.11 |
| reb:minutes_prior_season | 103 | 0.23 | 2.67 | 2.49 | 44.7% | 73.8% | 1.07 0.97 0.97 0.68 1.17 0.78 0.68 1.17 0.97 1.55 |
| reb:thin_sample | 1091 | -0.07 | 2.37 | 2.35 | 48.4% | 78.6% | 1.20 1.12 0.91 0.98 0.80 0.97 1.04 1.09 0.95 0.93 |
