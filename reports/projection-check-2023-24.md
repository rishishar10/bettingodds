# Free projection check

Seasons: 2023-24 (every 3 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":200,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":15,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"SENSITIVITY_SIGMA":1.25}`

Players who played: 8425. Supported: 1444 (17.1%).

| Unsupported reason | Count |
|---|---|
| empty_out_intersection | 2893 |
| too_few_games | 4055 |
| no_base_history | 33 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus projected mean.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 1444 | 0.22 | 6.05 | 5.44 | 42.0% | 71.8% | 1.50 0.94 0.73 0.66 0.85 0.87 0.96 1.12 1.05 1.32 |
| reb | 1444 | -0.04 | 2.50 | 2.44 | 47.7% | 79.1% | 1.09 1.03 1.11 0.96 0.87 0.94 0.97 1.09 0.93 1.00 |
| ast | 1444 | 0.12 | 1.91 | 1.85 | 45.8% | 77.6% | 1.04 1.00 0.95 0.83 0.79 0.88 1.02 1.11 1.16 1.20 |
| ast:dispersion_floor | 833 | 0.13 | 1.87 | 1.74 | 44.9% | 76.8% | 1.03 1.04 1.00 0.80 0.85 0.76 1.00 1.08 1.15 1.28 |
| ast:dispersion_from_base_pool | 784 | 0.03 | 1.75 | 1.79 | 44.8% | 78.8% | 1.06 1.01 1.01 0.94 0.65 0.82 1.03 1.21 1.21 1.06 |
| ast:dispersion_thin | 11 | -0.20 | 0.83 | 1.18 | 45.5% | 72.7% | 0.91 0.91 1.82 1.82 0.00 0.91 0.91 0.00 0.91 1.82 |
| ast:minutes_prior_season | 70 | 0.35 | 2.06 | 1.86 | 38.6% | 72.9% | 1.43 0.71 0.71 0.29 0.43 1.14 0.86 1.57 1.57 1.29 |
| ast:thin_sample | 848 | 0.03 | 1.73 | 1.76 | 44.3% | 78.7% | 1.08 1.03 1.01 0.92 0.66 0.81 1.03 1.20 1.20 1.05 |
| pts:dispersion_floor | 75 | 1.33 | 6.26 | 4.46 | 38.7% | 62.7% | 1.73 0.27 0.53 0.67 0.53 0.67 0.80 1.33 1.47 2.00 |
| pts:dispersion_from_base_pool | 784 | 0.17 | 5.93 | 5.33 | 39.8% | 71.4% | 1.53 0.94 0.89 0.65 0.73 0.84 0.85 1.21 1.02 1.33 |
| pts:dispersion_thin | 11 | 0.31 | 4.97 | 3.22 | 9.1% | 63.6% | 1.82 3.64 0.91 0.00 0.00 0.00 0.91 0.00 0.91 1.82 |
| pts:minutes_prior_season | 70 | 0.74 | 6.03 | 5.78 | 48.6% | 77.1% | 1.00 0.71 0.71 0.71 0.86 1.29 1.00 1.57 0.86 1.29 |
| pts:thin_sample | 848 | 0.12 | 5.80 | 5.21 | 39.7% | 70.5% | 1.59 0.99 0.85 0.61 0.73 0.88 0.86 1.16 0.97 1.36 |
| reb:dispersion_floor | 803 | 0.05 | 2.59 | 2.32 | 44.1% | 76.0% | 1.17 1.06 1.16 0.88 0.76 0.81 0.92 1.07 0.93 1.23 |
| reb:dispersion_from_base_pool | 784 | -0.04 | 2.39 | 2.40 | 46.6% | 78.7% | 1.19 1.02 1.10 0.80 0.91 0.89 1.03 1.11 1.01 0.94 |
| reb:dispersion_thin | 11 | -0.04 | 2.04 | 2.04 | 45.5% | 63.6% | 1.82 0.91 1.82 0.91 0.91 0.91 0.00 0.00 0.91 1.82 |
| reb:minutes_prior_season | 70 | -0.06 | 2.39 | 2.53 | 51.4% | 80.0% | 1.00 1.29 1.14 1.14 0.86 0.43 1.00 1.14 1.00 1.00 |
| reb:thin_sample | 848 | -0.08 | 2.35 | 2.36 | 47.1% | 78.3% | 1.25 1.03 1.11 0.83 0.91 0.90 1.00 1.10 0.97 0.92 |
