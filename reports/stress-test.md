# Model stress test

Train seasons only: 2023-24 (fit) and 2024-25 (holdout), every 2 game dates, oracle availability. 2025-26 untouched.
Book-style line: floor(average over the player's last 10 games of 15+ minutes) + 0.5. "Line LL" is the log loss of P(over that line); a constant 50% scores 0.6931; "naive" is a Poisson at the recent average.

## 1. Overall

| Stat | Season | Rows | Log score | In 80% | Bias | Line rows | Over rate | Mean P(over) | Line LL | Naive LL |
|---|---|---|---|---|---|---|---|---|---|---|
| pts | 2023-24 | 7708 | 3.0498 | 78.5% | 0.038 | 7468 | 38.6% | 37.6% | 0.6224 | 0.6815 |
| pts | 2024-25 | 6079 | 3.0715 | 79.0% | 0.173 | 5880 | 38.8% | 36.5% | 0.6358 | 0.6823 |
| reb | 2023-24 | 7708 | 2.1762 | 79.5% | -0.038 | 7468 | 38.8% | 39.1% | 0.6288 | 0.6741 |
| reb | 2024-25 | 6079 | 2.1879 | 79.5% | -0.031 | 5880 | 39.5% | 38.9% | 0.6351 | 0.6756 |
| ast | 2023-24 | 7708 | 1.7934 | 78.8% | -0.013 | 7468 | 38.2% | 38.2% | 0.6221 | 0.6681 |
| ast | 2024-25 | 6079 | 1.7888 | 79.4% | -0.044 | 5880 | 37.9% | 38.6% | 0.6134 | 0.6605 |

## 2. Reliability of P(over line), both seasons

| Stat | Bin | Rows | Mean predicted | Observed |
|---|---|---|---|---|
| pts | 0–10% | 548 | 5.9% | 7.8% |
| pts | 10–20% | 1232 | 15.5% | 16.6% |
| pts | 20–30% | 2204 | 25.4% | 28.8% |
| pts | 30–40% | 3509 | 35.2% | 38.5% |
| pts | 40–50% | 3355 | 44.7% | 45.5% |
| pts | 50–60% | 1771 | 54.3% | 53.0% |
| pts | 60–70% | 612 | 63.8% | 62.7% |
| pts | 70–80% | 106 | 73.8% | 66.0% |
| reb | 0–10% | 481 | 5.8% | 6.7% |
| reb | 10–20% | 1069 | 15.6% | 17.4% |
| reb | 20–30% | 2036 | 25.6% | 29.3% |
| reb | 30–40% | 3186 | 35.2% | 36.1% |
| reb | 40–50% | 3398 | 44.8% | 43.9% |
| reb | 50–60% | 2182 | 54.5% | 52.4% |
| reb | 60–70% | 807 | 63.9% | 60.8% |
| reb | 70–80% | 174 | 73.6% | 67.2% |
| ast | 0–10% | 452 | 6.2% | 4.9% |
| ast | 10–20% | 1252 | 15.5% | 15.3% |
| ast | 20–30% | 2266 | 25.4% | 27.7% |
| ast | 30–40% | 3221 | 35.1% | 36.9% |
| ast | 40–50% | 3085 | 44.8% | 42.8% |
| ast | 50–60% | 1942 | 54.5% | 51.2% |
| ast | 60–70% | 850 | 64.3% | 63.4% |
| ast | 70–80% | 253 | 73.9% | 72.3% |

## 3. Slices (both seasons)

Bias is actual minus predicted mean. A slice with steady bias is a missing feature.

| Slice | Group | Stat | Rows | Log score | In 80% | Bias | Line LL |
|---|---|---|---|---|---|---|---|
| expected minutes | 20–28 | pts | 3906 | 3.0978 | 78.8% | 0.142 | 0.6662 |
| expected minutes | 20–28 | reb | 3906 | 2.2092 | 79.6% | 0.002 | 0.6679 |
| expected minutes | 20–28 | ast | 3906 | 1.8080 | 79.0% | 0.003 | 0.6523 |
| expected minutes | 28–34 | pts | 3710 | 3.3275 | 81.0% | 0.470 | 0.6806 |
| expected minutes | 28–34 | reb | 3710 | 2.3381 | 79.7% | 0.008 | 0.6726 |
| expected minutes | 28–34 | ast | 3710 | 2.0276 | 79.4% | 0.006 | 0.6640 |
| expected minutes | 34+ | pts | 1895 | 3.4677 | 83.4% | -0.172 | 0.6612 |
| expected minutes | 34+ | reb | 1895 | 2.3922 | 80.9% | -0.114 | 0.6843 |
| expected minutes | 34+ | ast | 1895 | 2.2355 | 81.2% | -0.048 | 0.6673 |
| expected minutes | <20 | pts | 4276 | 2.6107 | 72.9% | -0.146 | 0.5230 |
| expected minutes | <20 | reb | 4276 | 1.9266 | 78.1% | -0.070 | 0.5289 |
| expected minutes | <20 | ast | 4276 | 1.3744 | 78.4% | -0.072 | 0.5152 |
| matched games | 10–19 | pts | 2773 | 3.0289 | 77.2% | 0.067 | 0.6144 |
| matched games | 10–19 | reb | 2773 | 2.1335 | 80.0% | -0.108 | 0.6290 |
| matched games | 10–19 | ast | 2773 | 1.7507 | 78.8% | -0.038 | 0.6120 |
| matched games | 20+ | pts | 7783 | 3.0573 | 79.5% | 0.011 | 0.6216 |
| matched games | 20+ | reb | 7783 | 2.1884 | 79.8% | -0.028 | 0.6274 |
| matched games | 20+ | ast | 7783 | 1.7967 | 80.0% | -0.040 | 0.6128 |
| matched games | <10 | pts | 3231 | 3.0906 | 76.4% | 0.334 | 0.6573 |
| matched games | <10 | reb | 3231 | 2.2055 | 78.9% | 0.012 | 0.6443 |
| matched games | <10 | ast | 3231 | 1.8134 | 77.6% | 0.015 | 0.6374 |
| season phase | Dec–Jan | pts | 5536 | 3.0704 | 77.6% | 0.022 | 0.6256 |
| season phase | Dec–Jan | reb | 5536 | 2.1729 | 79.6% | -0.068 | 0.6314 |
| season phase | Dec–Jan | ast | 5536 | 1.7863 | 78.8% | -0.046 | 0.6158 |
| season phase | Feb–Apr | pts | 5763 | 3.0470 | 78.1% | 0.182 | 0.6330 |
| season phase | Feb–Apr | reb | 5763 | 2.1757 | 79.6% | -0.016 | 0.6258 |
| season phase | Feb–Apr | ast | 5763 | 1.7854 | 79.7% | -0.017 | 0.6187 |
| season phase | Oct–Nov | pts | 2488 | 3.0636 | 79.0% | 0.071 | 0.6234 |
| season phase | Oct–Nov | reb | 2488 | 2.2134 | 78.4% | -0.004 | 0.6452 |
| season phase | Oct–Nov | ast | 2488 | 1.8165 | 79.8% | -0.005 | 0.6226 |
| rotation teammates out | 0 | pts | 5832 | 2.9821 | 79.6% | -0.167 | 0.6062 |
| rotation teammates out | 0 | reb | 5832 | 2.1352 | 79.3% | -0.068 | 0.6142 |
| rotation teammates out | 0 | ast | 5832 | 1.7498 | 80.8% | -0.093 | 0.5984 |
| rotation teammates out | 1 | pts | 5435 | 3.0853 | 78.2% | 0.110 | 0.6356 |
| rotation teammates out | 1 | reb | 5435 | 2.2032 | 79.5% | -0.037 | 0.6397 |
| rotation teammates out | 1 | ast | 5435 | 1.8002 | 78.4% | -0.022 | 0.6248 |
| rotation teammates out | 2+ | pts | 2520 | 3.1823 | 76.3% | 0.685 | 0.6622 |
| rotation teammates out | 2+ | reb | 2520 | 2.2412 | 79.1% | 0.047 | 0.6530 |
| rotation teammates out | 2+ | ast | 2520 | 1.8685 | 77.6% | 0.118 | 0.6488 |
| back-to-back | no | pts | 11748 | 3.0548 | 78.4% | 0.090 | 0.6272 |
| back-to-back | no | reb | 11748 | 2.1798 | 79.6% | -0.044 | 0.6310 |
| back-to-back | no | ast | 11748 | 1.7881 | 79.8% | -0.030 | 0.6170 |
| back-to-back | yes | pts | 2039 | 3.0856 | 77.0% | 0.141 | 0.6346 |
| back-to-back | yes | reb | 2039 | 2.1904 | 79.2% | 0.021 | 0.6347 |
| back-to-back | yes | ast | 2039 | 1.8105 | 77.7% | -0.008 | 0.6255 |
| home/away | away | pts | 6780 | 3.0617 | 78.5% | 0.016 | 0.6269 |
| home/away | away | reb | 6780 | 2.1849 | 79.3% | -0.040 | 0.6343 |
| home/away | away | ast | 6780 | 1.7915 | 79.0% | -0.073 | 0.6161 |
| home/away | home | pts | 7007 | 3.0571 | 78.3% | 0.177 | 0.6296 |
| home/away | home | reb | 7007 | 2.1780 | 79.6% | -0.029 | 0.6289 |
| home/away | home | ast | 7007 | 1.7913 | 79.4% | 0.018 | 0.6203 |
| opponent allowance | average | pts | 9642 | 3.0520 | 78.8% | 0.078 | 0.6255 |
| opponent allowance | average | reb | 9239 | 2.1816 | 79.2% | -0.020 | 0.6335 |
| opponent allowance | average | ast | 6604 | 1.7922 | 79.6% | -0.012 | 0.6193 |
| opponent allowance | soft (>1.03) | pts | 2331 | 3.0988 | 77.7% | 0.175 | 0.6494 |
| opponent allowance | soft (>1.03) | reb | 2221 | 2.1973 | 80.3% | 0.002 | 0.6361 |
| opponent allowance | soft (>1.03) | ast | 3545 | 1.8317 | 78.6% | -0.020 | 0.6324 |
| opponent allowance | tough (<0.97) | pts | 1814 | 3.0481 | 76.1% | 0.106 | 0.6157 |
| opponent allowance | tough (<0.97) | reb | 2327 | 2.1652 | 78.5% | -0.129 | 0.6195 |
| opponent allowance | tough (<0.97) | ast | 3638 | 1.7505 | 79.7% | -0.060 | 0.6024 |
| thin sample | not thin | pts | 9914 | 3.0989 | 79.3% | 0.044 | 0.6288 |
| thin sample | not thin | reb | 9914 | 2.2058 | 79.6% | -0.041 | 0.6359 |
| thin sample | not thin | ast | 9914 | 1.8258 | 79.8% | -0.034 | 0.6213 |
| thin sample | thin | pts | 3873 | 2.9583 | 76.0% | 0.236 | 0.6269 |
| thin sample | thin | reb | 3873 | 2.1188 | 78.4% | -0.018 | 0.6192 |
| thin sample | thin | ast | 3873 | 1.7032 | 78.4% | -0.008 | 0.6097 |

## 4. Candidate improvements (fit on 2023-24, judged on 2024-25)

Δ is holdout log score minus baseline; negative is better. A candidate is adopted only if it improves the holdout for that stat.

| Candidate | Stat | Fitted value | Fit Δ | Holdout Δ | Adopt |
|---|---|---|---|---|---|
| mean scale (× c) | pts | 1.001 | -0.0000 | -0.0001 | no |
| mean scale (× c) | reb | 0.994 | -0.0001 | -0.0000 | no |
| mean scale (× c) | ast | 0.996 | -0.0000 | -0.0001 | yes |
| opponent allowance (mean × factor^β) | pts | 0.024 | -0.0000 | 0.0000 | no |
| opponent allowance (mean × factor^β) | reb | 0.021 | -0.0000 | -0.0000 | no |
| opponent allowance (mean × factor^β) | ast | 0.025 | -0.0000 | -0.0000 | no |
| home court (× h at home, ÷ h away) | pts | 1.007 | -0.0001 | -0.0001 | no |
| home court (× h at home, ÷ h away) | reb | 1.007 | -0.0001 | 0.0002 | no |
| home court (× h at home, ÷ h away) | ast | 1.015 | -0.0003 | -0.0003 | yes |
| back-to-back (× b) | pts | 1.016 | -0.0001 | -0.0000 | no |
| back-to-back (× b) | reb | 0.991 | -0.0000 | 0.0001 | no |
| back-to-back (× b) | ast | 1.001 | -0.0000 | 0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | pts | 0.000 | 0.0000 | -0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | reb | 0.000 | 0.0000 | 0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | ast | 0.000 | 0.0000 | -0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | pts | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | reb | 0.032 | -0.0000 | -0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | ast | 0.000 | 0.0000 | -0.0000 | no |

### Combined adopted candidates on the 2024-25 holdout

| Stat | Baseline log score | Combined | Δ | Baseline line LL | Combined line LL | In 80% |
|---|---|---|---|---|---|---|
| pts | 3.0715 | 3.0715 | 0.0000 | 0.6358 | 0.6358 | 78.5% |
| reb | 2.1879 | 2.1879 | 0.0000 | 0.6351 | 0.6351 | 79.6% |
| ast | 1.7888 | 1.7883 | -0.0005 | 0.6134 | 0.6132 | 79.7% |

## 6. Provisional shrinkage against the book-style line

SHRINK fit on 2023-24 = **0.950** (until the odds replay fits the real one). Holdout line log loss: no shrink 0.6281, 0.5 placeholder 0.6432, fitted 0.6275.

| Bin (shrunk) | Rows | Mean predicted | Observed |
|---|---|---|---|
| 0–10% | 409 | 7.0% | 5.9% |
| 10–20% | 1528 | 15.8% | 16.0% |
| 20–30% | 2845 | 25.5% | 27.4% |
| 30–40% | 4485 | 35.2% | 36.7% |
| 40–50% | 4623 | 44.7% | 43.7% |
| 50–60% | 2598 | 54.3% | 52.3% |
| 60–70% | 930 | 63.8% | 63.9% |
| 70–80% | 215 | 73.4% | 72.1% |

## 5. Constant sensitivity (2023-24, every 4th date, one change at a time)

| Change | Supported rows | pts log score | reb log score | ast log score |
|---|---|---|---|---|
