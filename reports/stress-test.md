# Model stress test

Train seasons only: 2023-24 (fit) and 2024-25 (holdout), every 2 game dates, oracle availability. 2025-26 untouched.
Book-style line: floor(average over the player's last 10 games of 15+ minutes) + 0.5. "Line LL" is the log loss of P(over that line); a constant 50% scores 0.6931; "naive" is a Poisson at the recent average.

## 1. Overall

| Stat | Season | Rows | Log score | In 80% | Bias | Line rows | Over rate | Mean P(over) | Line LL | Naive LL |
|---|---|---|---|---|---|---|---|---|---|---|
| pts | 2023-24 | 8283 | 3.0524 | 77.7% | 0.111 | 8028 | 38.4% | 37.0% | 0.6239 | 0.6816 |
| pts | 2024-25 | 6485 | 3.0691 | 78.4% | 0.244 | 6265 | 38.5% | 35.8% | 0.6341 | 0.6818 |
| reb | 2023-24 | 8283 | 2.1757 | 79.1% | -0.007 | 8028 | 38.5% | 38.5% | 0.6278 | 0.6744 |
| reb | 2024-25 | 6485 | 2.1884 | 78.8% | 0.010 | 6265 | 39.3% | 38.2% | 0.6342 | 0.6750 |
| ast | 2023-24 | 8283 | 1.7939 | 78.4% | -0.004 | 8028 | 38.2% | 37.8% | 0.6233 | 0.6681 |
| ast | 2024-25 | 6485 | 1.7924 | 78.8% | -0.049 | 6265 | 37.7% | 38.4% | 0.6142 | 0.6604 |

## 2. Reliability of P(over line), both seasons

| Stat | Bin | Rows | Mean predicted | Observed |
|---|---|---|---|---|
| pts | 0–10% | 693 | 5.9% | 8.5% |
| pts | 10–20% | 1391 | 15.4% | 16.9% |
| pts | 20–30% | 2408 | 25.4% | 29.9% |
| pts | 30–40% | 3781 | 35.2% | 38.9% |
| pts | 40–50% | 3469 | 44.7% | 45.8% |
| pts | 50–60% | 1818 | 54.2% | 53.0% |
| pts | 60–70% | 624 | 63.7% | 62.3% |
| pts | 70–80% | 100 | 73.6% | 66.0% |
| reb | 0–10% | 636 | 5.8% | 8.0% |
| reb | 10–20% | 1198 | 15.5% | 17.7% |
| reb | 20–30% | 2201 | 25.5% | 29.3% |
| reb | 30–40% | 3420 | 35.1% | 37.0% |
| reb | 40–50% | 3572 | 44.8% | 44.3% |
| reb | 50–60% | 2227 | 54.5% | 51.9% |
| reb | 60–70% | 850 | 63.9% | 59.6% |
| reb | 70–80% | 174 | 73.4% | 69.5% |
| ast | 0–10% | 550 | 6.2% | 5.8% |
| ast | 10–20% | 1410 | 15.4% | 16.9% |
| ast | 20–30% | 2424 | 25.4% | 28.3% |
| ast | 30–40% | 3410 | 35.1% | 36.9% |
| ast | 40–50% | 3262 | 44.8% | 42.8% |
| ast | 50–60% | 2033 | 54.5% | 51.1% |
| ast | 60–70% | 900 | 64.2% | 62.0% |
| ast | 70–80% | 276 | 73.8% | 72.8% |

## 3. Slices (both seasons)

Bias is actual minus predicted mean. A slice with steady bias is a missing feature.

| Slice | Group | Stat | Rows | Log score | In 80% | Bias | Line LL |
|---|---|---|---|---|---|---|---|
| expected minutes | 20–28 | pts | 4227 | 3.1061 | 78.8% | 0.237 | 0.6672 |
| expected minutes | 20–28 | reb | 4227 | 2.2082 | 79.1% | 0.012 | 0.6639 |
| expected minutes | 20–28 | ast | 4227 | 1.8108 | 79.4% | 0.010 | 0.6525 |
| expected minutes | 28–34 | pts | 3931 | 3.3257 | 81.1% | 0.452 | 0.6779 |
| expected minutes | 28–34 | reb | 3931 | 2.3330 | 79.8% | 0.039 | 0.6751 |
| expected minutes | 28–34 | ast | 3931 | 2.0285 | 79.1% | -0.007 | 0.6657 |
| expected minutes | 34+ | pts | 1978 | 3.4829 | 83.0% | -0.086 | 0.6661 |
| expected minutes | 34+ | reb | 1978 | 2.4027 | 80.1% | -0.090 | 0.6856 |
| expected minutes | 34+ | ast | 1978 | 2.2471 | 79.0% | -0.064 | 0.6727 |
| expected minutes | <20 | pts | 4632 | 2.6109 | 72.3% | -0.023 | 0.5241 |
| expected minutes | <20 | reb | 4632 | 1.9334 | 77.5% | -0.003 | 0.5286 |
| expected minutes | <20 | ast | 4632 | 1.3838 | 77.8% | -0.051 | 0.5164 |
| matched games | 10–19 | pts | 3039 | 3.0269 | 76.9% | 0.217 | 0.6177 |
| matched games | 10–19 | reb | 3039 | 2.1333 | 79.4% | -0.069 | 0.6276 |
| matched games | 10–19 | ast | 3039 | 1.7471 | 79.0% | -0.024 | 0.6102 |
| matched games | 20+ | pts | 8391 | 3.0563 | 79.7% | 0.083 | 0.6218 |
| matched games | 20+ | reb | 8391 | 2.1919 | 79.6% | 0.011 | 0.6281 |
| matched games | 20+ | ast | 8391 | 1.8014 | 79.7% | -0.040 | 0.6154 |
| matched games | <10 | pts | 3338 | 3.0983 | 75.5% | 0.344 | 0.6554 |
| matched games | <10 | reb | 3338 | 2.1982 | 78.3% | 0.040 | 0.6401 |
| matched games | <10 | ast | 3338 | 1.8148 | 77.0% | 0.019 | 0.6381 |
| season phase | Dec–Jan | pts | 5639 | 3.0703 | 77.2% | 0.120 | 0.6261 |
| season phase | Dec–Jan | reb | 5639 | 2.1721 | 79.6% | -0.028 | 0.6308 |
| season phase | Dec–Jan | ast | 5639 | 1.7873 | 79.0% | -0.036 | 0.6159 |
| season phase | Feb–Apr | pts | 6062 | 3.0432 | 78.3% | 0.239 | 0.6318 |
| season phase | Feb–Apr | reb | 6062 | 2.1734 | 79.3% | 0.009 | 0.6245 |
| season phase | Feb–Apr | ast | 6062 | 1.7841 | 79.3% | -0.024 | 0.6191 |
| season phase | Oct–Nov | pts | 3067 | 3.0729 | 78.9% | 0.123 | 0.6258 |
| season phase | Oct–Nov | reb | 3067 | 2.2137 | 78.3% | 0.038 | 0.6425 |
| season phase | Oct–Nov | ast | 3067 | 1.8224 | 78.7% | 0.000 | 0.6261 |
| rotation teammates out | 0 | pts | 6439 | 2.9795 | 78.8% | -0.100 | 0.6050 |
| rotation teammates out | 0 | reb | 6439 | 2.1366 | 79.5% | -0.028 | 0.6142 |
| rotation teammates out | 0 | ast | 6439 | 1.7519 | 79.8% | -0.101 | 0.6001 |
| rotation teammates out | 1 | pts | 5743 | 3.0990 | 77.7% | 0.222 | 0.6384 |
| rotation teammates out | 1 | reb | 5743 | 2.2070 | 79.0% | -0.016 | 0.6392 |
| rotation teammates out | 1 | ast | 5743 | 1.8050 | 78.5% | -0.002 | 0.6247 |
| rotation teammates out | 2+ | pts | 2586 | 3.1723 | 75.8% | 0.724 | 0.6628 |
| rotation teammates out | 2+ | reb | 2586 | 2.2353 | 78.4% | 0.108 | 0.6513 |
| rotation teammates out | 2+ | ast | 2586 | 1.8703 | 76.8% | 0.122 | 0.6539 |
| back-to-back | no | pts | 12557 | 3.0558 | 78.3% | 0.166 | 0.6279 |
| back-to-back | no | reb | 12557 | 2.1801 | 78.9% | -0.008 | 0.6302 |
| back-to-back | no | ast | 12557 | 1.7906 | 79.1% | -0.026 | 0.6184 |
| back-to-back | yes | pts | 2211 | 3.0818 | 76.6% | 0.187 | 0.6309 |
| back-to-back | yes | reb | 2211 | 2.1878 | 79.3% | 0.053 | 0.6330 |
| back-to-back | yes | ast | 2211 | 1.8082 | 78.0% | -0.009 | 0.6246 |
| home/away | away | pts | 7265 | 3.0643 | 77.8% | 0.082 | 0.6269 |
| home/away | away | reb | 7265 | 2.1874 | 78.7% | -0.007 | 0.6334 |
| home/away | away | ast | 7265 | 1.7913 | 78.3% | -0.075 | 0.6151 |
| home/away | home | pts | 7503 | 3.0553 | 78.2% | 0.254 | 0.6298 |
| home/away | home | reb | 7503 | 2.1753 | 79.5% | 0.008 | 0.6279 |
| home/away | home | ast | 7503 | 1.7951 | 79.7% | 0.027 | 0.6234 |
| opponent allowance | average | pts | 10435 | 3.0515 | 78.7% | 0.144 | 0.6262 |
| opponent allowance | average | reb | 9960 | 2.1822 | 79.1% | 0.022 | 0.6318 |
| opponent allowance | average | ast | 7097 | 1.7926 | 79.3% | -0.011 | 0.6213 |
| opponent allowance | soft (>1.03) | pts | 2410 | 3.0994 | 76.4% | 0.293 | 0.6478 |
| opponent allowance | soft (>1.03) | reb | 2390 | 2.1982 | 79.1% | 0.011 | 0.6378 |
| opponent allowance | soft (>1.03) | ast | 3682 | 1.8310 | 78.7% | -0.013 | 0.6323 |
| opponent allowance | tough (<0.97) | pts | 1923 | 3.0543 | 76.3% | 0.151 | 0.6157 |
| opponent allowance | tough (<0.97) | reb | 2418 | 2.1606 | 78.6% | -0.096 | 0.6185 |
| opponent allowance | tough (<0.97) | ast | 3989 | 1.7596 | 79.1% | -0.055 | 0.6038 |
| thin sample | not thin | pts | 10730 | 3.0978 | 79.3% | 0.138 | 0.6298 |
| thin sample | not thin | reb | 10730 | 2.2080 | 79.6% | -0.004 | 0.6358 |
| thin sample | not thin | ast | 10730 | 1.8264 | 79.5% | -0.031 | 0.6229 |
| thin sample | thin | pts | 4038 | 2.9586 | 74.2% | 0.253 | 0.6241 |
| thin sample | thin | reb | 4038 | 2.1102 | 77.9% | 0.014 | 0.6153 |
| thin sample | thin | ast | 4038 | 1.7051 | 77.5% | -0.005 | 0.6086 |

## 4. Candidate improvements (fit on 2023-24, judged on 2024-25)

Δ is holdout log score minus baseline; negative is better. A candidate is adopted only if it improves the holdout for that stat.

| Candidate | Stat | Fitted value | Fit Δ | Holdout Δ | Adopt |
|---|---|---|---|---|---|
| DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros) | pts | 0.000 | 0.0000 | 0.0000 | no |
| DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros) | reb | 0.020 | -0.0000 | 0.0000 | no |
| DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros) | ast | 0.000 | 0.0000 | -0.0000 | no |
| mean scale (× c) | pts | 1.008 | -0.0001 | -0.0005 | yes |
| mean scale (× c) | reb | 1.000 | -0.0000 | -0.0000 | no |
| mean scale (× c) | ast | 1.001 | -0.0000 | 0.0000 | no |
| opponent allowance (mean × factor^β) | pts | 0.075 | -0.0000 | 0.0000 | no |
| opponent allowance (mean × factor^β) | reb | 0.006 | -0.0000 | -0.0000 | no |
| opponent allowance (mean × factor^β) | ast | 0.058 | -0.0000 | -0.0001 | no |
| home court (× h at home, ÷ h away) | pts | 1.005 | -0.0001 | -0.0001 | no |
| home court (× h at home, ÷ h away) | reb | 1.007 | -0.0001 | 0.0002 | no |
| home court (× h at home, ÷ h away) | ast | 1.018 | -0.0003 | -0.0004 | yes |
| back-to-back (× b) | pts | 1.018 | -0.0001 | -0.0001 | no |
| back-to-back (× b) | reb | 1.002 | -0.0000 | -0.0000 | no |
| back-to-back (× b) | ast | 1.006 | -0.0000 | 0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | pts | 0.000 | 0.0000 | -0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | reb | 0.000 | 0.0000 | 0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | ast | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | pts | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | reb | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | ast | 0.000 | 0.0000 | 0.0000 | no |

### Combined adopted candidates on the 2024-25 holdout

| Stat | Baseline log score | Combined | Δ | Baseline line LL | Combined line LL | In 80% |
|---|---|---|---|---|---|---|
| pts | 3.0691 | 3.0686 | -0.0005 | 0.6341 | 0.6336 | 78.4% |
| reb | 2.1884 | 2.1884 | 0.0000 | 0.6342 | 0.6342 | 78.7% |
| ast | 1.7924 | 1.7920 | -0.0004 | 0.6142 | 0.6141 | 79.7% |

## 6. Provisional shrinkage against the book-style line

SHRINK fit on 2023-24 = **0.927** (until the odds replay fits the real one). Holdout line log loss: no shrink 0.6275, 0.5 placeholder 0.6419, fitted 0.6265.

| Bin (shrunk) | Rows | Mean predicted | Observed |
|---|---|---|---|
| 0–10% | 410 | 7.4% | 6.1% |
| 10–20% | 1639 | 15.6% | 15.1% |
| 20–30% | 3065 | 25.5% | 27.4% |
| 30–40% | 4869 | 35.2% | 36.5% |
| 40–50% | 4982 | 44.7% | 44.0% |
| 50–60% | 2691 | 54.3% | 52.8% |
| 60–70% | 932 | 63.8% | 62.3% |
| 70–80% | 200 | 73.2% | 72.5% |

## 5. Constant sensitivity (2023-24, every 4th date, one change at a time)

| Change | Supported rows | pts log score | reb log score | ast log score |
|---|---|---|---|---|
