# Free projection check

Seasons: 2023-24 (every 3 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":200,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":24,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"SENSITIVITY_SIGMA":1.25}`

Players who played: 8425. Supported: 3348 (39.7%).

| Unsupported reason | Count |
|---|---|
| too_few_games | 3649 |
| empty_out_intersection | 1395 |
| no_base_history | 33 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus projected mean.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 3348 | 0.01 | 6.03 | 5.63 | 42.8% | 72.6% | 1.48 0.92 0.84 0.74 0.86 0.85 0.90 1.10 1.05 1.25 |
| reb | 3348 | -0.05 | 2.50 | 2.50 | 50.0% | 79.6% | 1.09 0.99 0.97 0.95 1.04 0.98 1.04 1.04 0.95 0.95 |
| ast | 3348 | 0.07 | 1.89 | 1.90 | 48.2% | 78.8% | 0.99 0.93 0.93 0.98 0.88 0.95 1.02 1.11 1.09 1.13 |
| ast:dispersion_floor | 1958 | 0.08 | 1.90 | 1.80 | 46.8% | 77.1% | 1.08 1.00 0.87 0.99 0.91 0.85 0.93 1.10 1.05 1.22 |
| ast:dispersion_from_base_pool | 1230 | 0.00 | 1.81 | 1.80 | 47.6% | 78.4% | 1.06 1.05 0.92 0.95 0.83 0.98 0.93 1.19 0.99 1.11 |
| ast:dispersion_thin | 77 | -0.14 | 1.38 | 1.42 | 46.8% | 81.8% | 0.91 1.30 0.78 1.17 1.17 0.52 1.04 0.91 1.30 0.91 |
| ast:minutes_prior_season | 238 | 0.08 | 1.99 | 1.93 | 49.2% | 79.0% | 0.97 0.88 0.97 0.97 0.76 0.84 1.22 1.30 0.97 1.13 |
| ast:thin_sample | 1330 | -0.00 | 1.77 | 1.76 | 47.6% | 78.5% | 1.06 1.05 0.90 0.96 0.86 0.97 0.94 1.14 1.02 1.09 |
| pts:dispersion_floor | 175 | -0.03 | 6.87 | 4.58 | 34.3% | 60.0% | 2.06 1.03 0.63 0.74 0.74 0.69 0.63 0.80 0.74 1.94 |
| pts:dispersion_from_base_pool | 1230 | -0.01 | 5.76 | 5.40 | 40.5% | 70.3% | 1.63 1.00 0.86 0.72 0.71 0.79 0.93 1.03 0.99 1.34 |
| pts:dispersion_thin | 77 | -0.18 | 5.09 | 3.76 | 31.2% | 54.5% | 2.73 1.04 0.65 1.30 0.13 0.39 0.65 0.39 0.91 1.82 |
| pts:minutes_prior_season | 238 | 0.05 | 6.25 | 5.88 | 39.5% | 69.3% | 1.55 0.67 1.18 0.71 0.88 0.50 0.71 1.30 0.97 1.51 |
| pts:thin_sample | 1330 | 0.01 | 5.67 | 5.28 | 40.2% | 70.2% | 1.62 1.00 0.86 0.73 0.73 0.75 0.90 1.04 1.00 1.36 |
| reb:dispersion_floor | 1899 | -0.01 | 2.56 | 2.42 | 48.3% | 78.0% | 1.16 1.00 1.00 0.98 0.96 1.02 0.94 0.99 0.91 1.04 |
| reb:dispersion_from_base_pool | 1230 | 0.00 | 2.44 | 2.44 | 49.7% | 77.4% | 1.19 0.99 0.89 0.94 1.03 0.86 1.09 0.99 0.93 1.07 |
| reb:dispersion_thin | 77 | -0.04 | 2.16 | 1.79 | 41.6% | 67.5% | 1.43 0.78 1.17 1.17 0.91 0.65 0.52 0.65 0.91 1.82 |
| reb:minutes_prior_season | 238 | 0.25 | 2.97 | 2.58 | 48.3% | 76.9% | 1.13 0.88 0.84 0.80 1.18 1.01 0.92 1.18 0.88 1.18 |
| reb:thin_sample | 1330 | 0.01 | 2.40 | 2.42 | 49.5% | 77.9% | 1.16 1.00 0.89 0.91 1.05 0.88 1.07 1.05 0.94 1.05 |
