# Model stress test

Train seasons only: 2023-24 (fit) and 2024-25 (holdout), every 2 game dates, oracle availability. 2025-26 untouched.
Book-style line: floor(average over the player's last 10 games of 15+ minutes) + 0.5. "Line LL" is the log loss of P(over that line); a constant 50% scores 0.6931; "naive" is a Poisson at the recent average.

## 1. Overall

| Stat | Season | Rows | Log score | In 80% | Bias | Line rows | Over rate | Mean P(over) | Line LL | Naive LL |
|---|---|---|---|---|---|---|---|---|---|---|
| pts | 2023-24 | 6674 | 3.0419 | 78.3% | 0.016 | 6449 | 37.9% | 37.0% | 0.6217 | 0.6819 |
| pts | 2024-25 | 5247 | 3.0617 | 78.5% | 0.065 | 5066 | 38.0% | 36.5% | 0.6309 | 0.6809 |
| reb | 2023-24 | 6674 | 2.1623 | 79.3% | 0.020 | 6449 | 38.5% | 38.3% | 0.6266 | 0.6738 |
| reb | 2024-25 | 5247 | 2.1812 | 79.9% | -0.032 | 5066 | 38.6% | 38.3% | 0.6311 | 0.6732 |
| ast | 2023-24 | 6674 | 1.7837 | 79.3% | -0.011 | 6449 | 37.9% | 38.0% | 0.6211 | 0.6666 |
| ast | 2024-25 | 5247 | 1.7893 | 80.0% | -0.065 | 5066 | 37.7% | 38.8% | 0.6120 | 0.6602 |

## 2. Reliability of P(over line), both seasons

| Stat | Bin | Rows | Mean predicted | Observed |
|---|---|---|---|---|
| pts | 0–10% | 503 | 5.9% | 8.3% |
| pts | 10–20% | 1081 | 15.4% | 16.4% |
| pts | 20–30% | 1829 | 25.7% | 28.4% |
| pts | 30–40% | 3102 | 35.3% | 37.8% |
| pts | 40–50% | 3068 | 44.7% | 45.2% |
| pts | 50–60% | 1453 | 54.1% | 53.0% |
| pts | 60–70% | 413 | 63.7% | 63.4% |
| pts | 70–80% | 56 | 74.0% | 62.5% |
| reb | 0–10% | 490 | 5.9% | 7.8% |
| reb | 10–20% | 902 | 15.4% | 16.2% |
| reb | 20–30% | 1704 | 25.7% | 27.9% |
| reb | 30–40% | 2890 | 35.3% | 37.0% |
| reb | 40–50% | 3041 | 44.8% | 44.2% |
| reb | 50–60% | 1798 | 54.3% | 52.6% |
| reb | 60–70% | 586 | 63.8% | 60.2% |
| reb | 70–80% | 100 | 73.5% | 65.0% |
| ast | 0–10% | 407 | 6.0% | 5.2% |
| ast | 10–20% | 1036 | 15.5% | 15.7% |
| ast | 20–30% | 1885 | 25.5% | 26.9% |
| ast | 30–40% | 2846 | 35.1% | 36.2% |
| ast | 40–50% | 2750 | 44.8% | 42.8% |
| ast | 50–60% | 1677 | 54.5% | 50.7% |
| ast | 60–70% | 716 | 64.0% | 65.4% |
| ast | 70–80% | 183 | 73.7% | 69.4% |

## 3. Slices (both seasons)

Bias is actual minus predicted mean. A slice with steady bias is a missing feature.

| Slice | Group | Stat | Rows | Log score | In 80% | Bias | Line LL |
|---|---|---|---|---|---|---|---|
| expected minutes | 20–28 | pts | 3371 | 3.1007 | 79.2% | 0.091 | 0.6656 |
| expected minutes | 20–28 | reb | 3371 | 2.1947 | 78.9% | -0.001 | 0.6643 |
| expected minutes | 20–28 | ast | 3371 | 1.7969 | 79.5% | -0.000 | 0.6492 |
| expected minutes | 28–34 | pts | 3191 | 3.3173 | 81.6% | 0.341 | 0.6740 |
| expected minutes | 28–34 | reb | 3191 | 2.3251 | 80.9% | 0.063 | 0.6727 |
| expected minutes | 28–34 | ast | 3191 | 2.0187 | 79.0% | -0.006 | 0.6632 |
| expected minutes | 34+ | pts | 1639 | 3.4751 | 84.0% | -0.264 | 0.6624 |
| expected minutes | 34+ | reb | 1639 | 2.4014 | 79.9% | -0.059 | 0.6806 |
| expected minutes | 34+ | ast | 1639 | 2.2378 | 80.5% | -0.101 | 0.6711 |
| expected minutes | <20 | pts | 3720 | 2.5895 | 73.2% | -0.138 | 0.5207 |
| expected minutes | <20 | reb | 3720 | 1.9146 | 78.1% | -0.037 | 0.5242 |
| expected minutes | <20 | ast | 3720 | 1.3780 | 78.3% | -0.061 | 0.5135 |
| matched games | 10–19 | pts | 2865 | 3.0210 | 77.0% | 0.075 | 0.6257 |
| matched games | 10–19 | reb | 2865 | 2.1474 | 79.1% | -0.029 | 0.6304 |
| matched games | 10–19 | ast | 2865 | 1.7611 | 79.0% | -0.034 | 0.6041 |
| matched games | 20+ | pts | 5543 | 3.0466 | 80.5% | -0.049 | 0.6177 |
| matched games | 20+ | reb | 5543 | 2.1728 | 79.2% | 0.016 | 0.6248 |
| matched games | 20+ | ast | 5543 | 1.7929 | 80.5% | -0.060 | 0.6173 |
| matched games | <10 | pts | 3513 | 3.0811 | 76.9% | 0.144 | 0.6390 |
| matched games | <10 | reb | 3513 | 2.1862 | 79.1% | -0.012 | 0.6334 |
| matched games | <10 | ast | 3513 | 1.7961 | 78.1% | 0.005 | 0.6273 |
| season phase | Dec–Jan | pts | 4797 | 3.0683 | 77.2% | -0.005 | 0.6260 |
| season phase | Dec–Jan | reb | 4797 | 2.1682 | 79.7% | -0.006 | 0.6285 |
| season phase | Dec–Jan | ast | 4797 | 1.7860 | 79.2% | -0.043 | 0.6183 |
| season phase | Feb–Apr | pts | 5005 | 3.0270 | 79.3% | 0.092 | 0.6271 |
| season phase | Feb–Apr | reb | 5005 | 2.1613 | 79.1% | 0.002 | 0.6233 |
| season phase | Feb–Apr | ast | 5005 | 1.7698 | 79.7% | -0.043 | 0.6130 |
| season phase | Oct–Nov | pts | 2119 | 3.0666 | 78.6% | 0.004 | 0.6219 |
| season phase | Oct–Nov | reb | 2119 | 2.1981 | 77.7% | -0.008 | 0.6414 |
| season phase | Oct–Nov | ast | 2119 | 1.8255 | 78.2% | 0.003 | 0.6239 |
| rotation teammates out | 0 | pts | 1635 | 2.9768 | 78.7% | -0.278 | 0.5998 |
| rotation teammates out | 0 | reb | 1635 | 2.1098 | 79.6% | -0.039 | 0.6046 |
| rotation teammates out | 0 | ast | 1635 | 1.7368 | 80.3% | -0.089 | 0.5973 |
| rotation teammates out | 1 | pts | 2730 | 3.0220 | 79.2% | 0.083 | 0.6225 |
| rotation teammates out | 1 | reb | 2730 | 2.1682 | 78.8% | -0.015 | 0.6316 |
| rotation teammates out | 1 | ast | 2730 | 1.7691 | 79.3% | -0.050 | 0.6080 |
| rotation teammates out | 2+ | pts | 7556 | 3.0769 | 78.0% | 0.089 | 0.6325 |
| rotation teammates out | 2+ | reb | 7556 | 2.1846 | 79.8% | 0.009 | 0.6327 |
| rotation teammates out | 2+ | ast | 7556 | 1.8030 | 79.1% | -0.017 | 0.6247 |
| back-to-back | no | pts | 10140 | 3.0470 | 78.6% | 0.037 | 0.6254 |
| back-to-back | no | reb | 10140 | 2.1706 | 79.3% | -0.008 | 0.6288 |
| back-to-back | no | ast | 10140 | 1.7850 | 79.4% | -0.035 | 0.6174 |
| back-to-back | yes | pts | 1781 | 3.0712 | 77.1% | 0.039 | 0.6278 |
| back-to-back | yes | reb | 1781 | 2.1708 | 79.4% | 0.027 | 0.6273 |
| back-to-back | yes | ast | 1781 | 1.7930 | 79.5% | -0.034 | 0.6154 |
| home/away | away | pts | 5859 | 3.0534 | 78.1% | -0.030 | 0.6235 |
| home/away | away | reb | 5859 | 2.1756 | 79.1% | -0.012 | 0.6296 |
| home/away | away | ast | 5859 | 1.7865 | 79.0% | -0.089 | 0.6143 |
| home/away | home | pts | 6062 | 3.0479 | 78.9% | 0.103 | 0.6279 |
| home/away | home | reb | 6062 | 2.1658 | 79.8% | 0.006 | 0.6276 |
| home/away | home | ast | 6062 | 1.7859 | 79.5% | 0.018 | 0.6198 |
| opponent allowance | average | pts | 8340 | 3.0440 | 79.0% | 0.024 | 0.6259 |
| opponent allowance | average | reb | 8027 | 2.1724 | 79.4% | 0.016 | 0.6302 |
| opponent allowance | average | ast | 5681 | 1.7848 | 79.9% | -0.018 | 0.6190 |
| opponent allowance | soft (>1.03) | pts | 2024 | 3.0912 | 77.3% | 0.087 | 0.6420 |
| opponent allowance | soft (>1.03) | reb | 1901 | 2.1864 | 81.1% | 0.028 | 0.6339 |
| opponent allowance | soft (>1.03) | ast | 3074 | 1.8231 | 78.9% | -0.030 | 0.6299 |
| opponent allowance | tough (<0.97) | pts | 1557 | 3.0336 | 76.1% | 0.043 | 0.6036 |
| opponent allowance | tough (<0.97) | reb | 1993 | 2.1483 | 78.6% | -0.108 | 0.6170 |
| opponent allowance | tough (<0.97) | ast | 3166 | 1.7528 | 79.9% | -0.068 | 0.6012 |
| thin sample | not thin | pts | 7823 | 3.0964 | 79.4% | 0.014 | 0.6314 |
| thin sample | not thin | reb | 7823 | 2.2003 | 80.1% | 0.007 | 0.6371 |
| thin sample | not thin | ast | 7823 | 1.8273 | 79.8% | -0.046 | 0.6236 |
| thin sample | thin | pts | 4098 | 2.9632 | 76.2% | 0.083 | 0.6138 |
| thin sample | thin | reb | 4098 | 2.1139 | 78.6% | -0.022 | 0.6107 |
| thin sample | thin | ast | 4098 | 1.7076 | 79.0% | -0.012 | 0.6034 |

## 4. Candidate improvements (fit on 2023-24, judged on 2024-25)

Δ is holdout log score minus baseline; negative is better. A candidate is adopted only if it improves the holdout for that stat.

| Candidate | Stat | Fitted value | Fit Δ | Holdout Δ | Adopt |
|---|---|---|---|---|---|
| DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros) | pts | 0.030 | -0.0000 | 0.0002 | no |
| DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros) | reb | 0.044 | -0.0000 | -0.0001 | no |
| DNP-CD zeros in recent minutes (blend weight w toward last-5 rows incl. zeros) | ast | 0.074 | -0.0001 | 0.0001 | no |
| mean scale (× c) | pts | 1.001 | -0.0000 | -0.0000 | no |
| mean scale (× c) | reb | 1.006 | -0.0001 | 0.0002 | no |
| mean scale (× c) | ast | 0.997 | -0.0000 | -0.0002 | yes |
| opponent allowance (mean × factor^β) | pts | 0.005 | -0.0000 | 0.0000 | no |
| opponent allowance (mean × factor^β) | reb | 0.107 | -0.0000 | -0.0001 | yes |
| opponent allowance (mean × factor^β) | ast | 0.076 | -0.0000 | -0.0000 | no |
| home court (× h at home, ÷ h away) | pts | 1.008 | -0.0001 | 0.0000 | no |
| home court (× h at home, ÷ h away) | reb | 1.010 | -0.0002 | 0.0004 | no |
| home court (× h at home, ÷ h away) | ast | 1.018 | -0.0004 | -0.0004 | yes |
| back-to-back (× b) | pts | 1.009 | -0.0000 | -0.0000 | no |
| back-to-back (× b) | reb | 1.004 | -0.0000 | -0.0000 | no |
| back-to-back (× b) | ast | 1.003 | -0.0000 | 0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | pts | 0.000 | 0.0000 | -0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | reb | 0.000 | 0.0000 | 0.0000 | no |
| recency (rate blend weight w on half-life-8 rate) | ast | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | pts | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | reb | 0.000 | 0.0000 | 0.0000 | no |
| minutes trend (E[M] blend weight w on last-5 minutes) | ast | 0.000 | 0.0000 | 0.0000 | no |

### Combined adopted candidates on the 2024-25 holdout

| Stat | Baseline log score | Combined | Δ | Baseline line LL | Combined line LL | In 80% |
|---|---|---|---|---|---|---|
| pts | 3.0617 | 3.0617 | 0.0000 | 0.6309 | 0.6309 | 79.0% |
| reb | 2.1812 | 2.1810 | -0.0001 | 0.6311 | 0.6310 | 79.6% |
| ast | 1.7893 | 1.7887 | -0.0006 | 0.6120 | 0.6117 | 80.3% |

## 6. Provisional shrinkage against the book-style line

SHRINK fit on 2023-24 = **0.949** (until the odds replay fits the real one). Holdout line log loss: no shrink 0.6247, 0.5 placeholder 0.6420, fitted 0.6243.

| Bin (shrunk) | Rows | Mean predicted | Observed |
|---|---|---|---|
| 0–10% | 366 | 7.1% | 4.1% |
| 10–20% | 1298 | 15.6% | 16.0% |
| 20–30% | 2366 | 25.6% | 26.5% |
| 30–40% | 3942 | 35.3% | 36.0% |
| 40–50% | 4169 | 44.8% | 43.4% |
| 50–60% | 2189 | 54.4% | 52.9% |
| 60–70% | 713 | 63.7% | 62.8% |
| 70–80% | 149 | 73.3% | 69.8% |

## 5. Constant sensitivity (2023-24, every 4th date, one change at a time)

| Change | Supported rows | pts log score | reb log score | ast log score |
|---|---|---|---|---|
