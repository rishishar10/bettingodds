# Free projection check

Seasons: 2023-24 (every 3 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":200,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":28,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"SENSITIVITY_SIGMA":1.25}`

Players who played: 8425. Supported: 4373 (51.9%).

| Unsupported reason | Count |
|---|---|
| too_few_games | 3295 |
| empty_out_intersection | 724 |
| no_base_history | 33 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus projected mean.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 4373 | 0.01 | 6.10 | 5.53 | 42.5% | 71.8% | 1.55 0.89 0.80 0.81 0.83 0.86 0.91 1.00 1.09 1.26 |
| reb | 4373 | -0.05 | 2.52 | 2.46 | 48.6% | 78.3% | 1.15 1.02 0.93 0.95 1.02 0.96 0.98 1.03 0.93 1.02 |
| ast | 4373 | 0.09 | 1.88 | 1.85 | 47.7% | 78.3% | 1.02 0.88 0.91 0.98 0.96 0.89 0.97 1.09 1.14 1.15 |
| ast:dispersion_floor | 2570 | 0.11 | 1.93 | 1.78 | 45.8% | 76.9% | 1.08 0.91 0.89 0.94 0.95 0.86 0.91 1.05 1.19 1.23 |
| ast:dispersion_from_base_pool | 1317 | 0.07 | 1.79 | 1.71 | 46.6% | 78.5% | 1.04 0.98 0.87 1.03 1.03 0.74 0.91 1.18 1.12 1.11 |
| ast:dispersion_thin | 143 | -0.13 | 1.49 | 1.43 | 45.5% | 78.3% | 1.26 0.98 0.98 0.63 0.70 0.56 1.26 1.61 1.12 0.91 |
| ast:minutes_prior_season | 369 | 0.15 | 1.98 | 1.85 | 47.4% | 78.6% | 0.89 1.00 0.87 1.00 0.70 0.92 1.17 1.27 0.92 1.25 |
| ast:thin_sample | 1437 | 0.07 | 1.75 | 1.67 | 46.6% | 78.2% | 1.04 0.95 0.89 1.03 0.98 0.76 0.95 1.16 1.10 1.14 |
| pts:dispersion_floor | 237 | -0.36 | 6.54 | 4.54 | 35.9% | 64.1% | 2.15 1.05 0.80 0.68 0.80 0.68 0.68 0.97 0.76 1.43 |
| pts:dispersion_from_base_pool | 1317 | -0.01 | 5.89 | 5.14 | 39.5% | 68.6% | 1.72 0.97 0.80 0.83 0.66 0.77 0.93 0.81 1.09 1.42 |
| pts:dispersion_thin | 143 | 0.02 | 5.00 | 3.95 | 34.3% | 67.1% | 1.82 1.12 0.98 0.56 0.70 0.49 0.98 0.84 1.05 1.47 |
| pts:minutes_prior_season | 369 | 0.30 | 6.74 | 5.80 | 39.8% | 68.3% | 1.71 0.79 0.76 0.76 0.79 0.62 0.87 1.06 1.19 1.46 |
| pts:thin_sample | 1437 | 0.01 | 5.78 | 5.03 | 38.9% | 68.3% | 1.73 0.97 0.78 0.84 0.67 0.74 0.88 0.87 1.08 1.44 |
| reb:dispersion_floor | 2503 | 0.04 | 2.55 | 2.36 | 47.4% | 76.6% | 1.19 1.00 0.96 0.94 0.97 0.88 1.00 0.99 0.90 1.15 |
| reb:dispersion_from_base_pool | 1317 | -0.01 | 2.50 | 2.37 | 43.4% | 76.5% | 1.18 1.17 0.97 0.88 0.75 0.96 0.90 1.06 0.96 1.18 |
| reb:dispersion_thin | 143 | -0.03 | 2.24 | 2.06 | 39.9% | 70.6% | 1.61 1.19 0.84 0.56 0.77 0.98 0.70 1.05 0.98 1.33 |
| reb:minutes_prior_season | 369 | 0.19 | 2.98 | 2.53 | 45.8% | 74.0% | 1.22 0.81 0.89 1.06 0.87 1.00 0.81 1.14 0.81 1.38 |
| reb:thin_sample | 1437 | -0.03 | 2.46 | 2.35 | 44.5% | 76.4% | 1.21 1.12 0.98 0.88 0.80 0.93 0.91 1.07 0.94 1.15 |
