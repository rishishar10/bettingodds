# Free projection check

Seasons: 2023-24, 2024-25 (every 1 game date). Availability: **oracle** (the box score says who played). No odds.
Constants: `{"BASE_POOL_CAP":30,"MATCHED_POOL_CAP":30,"MIN_MATCHED_GAMES":5,"MIN_MATCHED_MINUTES":50,"THIN_GAMES":10,"THIN_MINUTES":200,"PRIOR_MINUTES":200,"SHORT_APPEARANCE_MINUTES":8,"ALPHA_MIN_GAMES":10,"MINUTES_MIN_THIS_SEASON":3,"ROTATION_MEDIAN_MINUTES":24,"ROTATION_LOOKBACK_GAMES":15,"NEW_STARTER_MIN_GAMES":3,"AVAILABILITY_MINUTES":10,"CONDITIONAL_MIN_GAMES":3,"SENSITIVITY_MINUTES":3,"SENSITIVITY_SIGMA":1.25}`

Players who played: 52055. Supported: 19127 (36.7%).

| Unsupported reason | Count |
|---|---|
| too_few_games | 23317 |
| empty_out_intersection | 9385 |
| no_base_history | 226 |

PIT is randomized for counts; a calibrated model has 50% inside [0.25, 0.75], 80% inside [0.1, 0.9], and every decile density near 1.00.
Bias is actual minus projected mean.

| Slice | n | Bias | RMSE | Predicted SD | In 50% | In 80% | PIT decile densities |
|---|---|---|---|---|---|---|---|
| pts | 19127 | -0.02 | 6.11 | 5.65 | 43.5% | 72.4% | 1.53 0.88 0.81 0.82 0.85 0.88 0.94 0.99 1.08 1.23 |
| reb | 19127 | 0.01 | 2.53 | 2.51 | 49.0% | 79.2% | 1.02 0.98 0.95 0.97 0.99 0.97 1.01 1.02 1.03 1.06 |
| ast | 19127 | 0.02 | 1.89 | 1.91 | 49.8% | 79.8% | 0.97 0.96 1.00 0.92 1.00 1.02 1.02 1.03 1.02 1.05 |
| ast:dispersion_floor | 11124 | 0.02 | 1.88 | 1.81 | 48.7% | 78.1% | 1.05 0.99 0.99 0.92 1.00 1.00 0.97 0.97 0.97 1.14 |
| ast:dispersion_from_base_pool | 7795 | 0.01 | 1.83 | 1.84 | 48.9% | 79.7% | 0.97 1.00 1.02 0.92 0.95 1.00 0.99 1.02 1.06 1.06 |
| ast:dispersion_thin | 566 | 0.11 | 1.57 | 1.48 | 45.2% | 76.5% | 1.02 0.80 0.88 1.06 0.92 0.88 0.95 0.87 1.29 1.33 |
| ast:minutes_prior_season | 1758 | 0.08 | 1.98 | 1.96 | 50.7% | 79.8% | 0.84 0.88 0.92 1.00 1.00 1.01 1.00 1.14 1.02 1.18 |
| ast:thin_sample | 8256 | 0.00 | 1.80 | 1.81 | 48.7% | 79.4% | 0.99 1.01 1.01 0.92 0.94 0.99 0.99 1.02 1.06 1.07 |
| pts:dispersion_floor | 1147 | -0.18 | 5.97 | 4.52 | 37.8% | 63.2% | 2.07 0.87 0.65 0.74 0.89 0.78 0.72 0.73 0.92 1.60 |
| pts:dispersion_from_base_pool | 7795 | -0.00 | 5.90 | 5.49 | 42.7% | 71.5% | 1.59 0.89 0.79 0.79 0.84 0.88 0.92 0.97 1.07 1.26 |
| pts:dispersion_thin | 566 | -0.06 | 4.87 | 4.11 | 37.8% | 67.0% | 1.86 0.95 0.64 0.69 0.67 0.92 0.80 0.97 1.06 1.45 |
| pts:minutes_prior_season | 1758 | 0.36 | 6.63 | 5.96 | 42.0% | 70.4% | 1.46 0.85 0.88 0.82 0.81 0.84 0.75 1.01 1.08 1.51 |
| pts:thin_sample | 8256 | 0.00 | 5.82 | 5.41 | 42.6% | 71.2% | 1.61 0.89 0.79 0.78 0.84 0.87 0.91 0.96 1.07 1.27 |
| reb:dispersion_floor | 10780 | 0.02 | 2.54 | 2.41 | 47.5% | 77.3% | 1.10 1.03 0.93 0.98 0.98 0.91 0.94 0.97 0.99 1.17 |
| reb:dispersion_from_base_pool | 7795 | 0.04 | 2.51 | 2.47 | 47.7% | 78.0% | 1.03 0.98 0.92 0.95 0.98 0.97 0.94 1.03 1.02 1.18 |
| reb:dispersion_thin | 566 | 0.11 | 2.22 | 2.05 | 43.5% | 77.4% | 0.81 1.20 0.99 1.02 0.83 0.57 1.02 0.94 1.17 1.45 |
| reb:minutes_prior_season | 1758 | 0.20 | 2.69 | 2.61 | 47.3% | 77.8% | 0.98 0.92 0.90 0.84 1.01 0.78 1.08 1.06 1.18 1.24 |
| reb:thin_sample | 8256 | 0.05 | 2.49 | 2.44 | 47.5% | 78.1% | 1.02 0.99 0.92 0.95 0.98 0.96 0.96 1.03 1.03 1.17 |
