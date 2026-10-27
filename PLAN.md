# NBA morning board: stress-tested plan

## Context

The repo is empty: no commits and no files. The pasted spec is the design. The user asked me to stress-test it, make my own adjustments, and then build. There is one new constraint: **no paid APIs while building. Paying is fine once the free work shows the idea holds up.** The core of the spec is good: it freezes the model before scoring the test season, measures CLV only on selected rows, uses a game bootstrap, keeps an oracle label until real injury data exists, and launches as "disagreement only" by default. I'm keeping all of that. The changes below fix math or measurement errors, close gaps where the spec never names a source or definition, and reorder the work so that money is spent only at explicit decision points.

---

## Stress-test findings and the adjustments made

### A. Measurement errors (these would have produced wrong numbers)

1. **Short appearances bias overs.** The spec drops games under 8 minutes from the minutes sample, but grading treats any minutes above 0 as action. A player who sometimes plays 4 minutes gets an inflated E[M], so overs are overpriced.
   → **Fix:** Games under 8 minutes stay **in** the E[M] and Var(M) samples whenever minutes are above 0. They are still dropped from the rate and α samples, where per-minute noise is the problem. DNPs (0 minutes) stay out of every sample, because they void the bet.

2. **CLV measured in raw decimal-odds differences isn't comparable across prices.** A move from 3.00 to 2.80 is not the same as a move from 1.91 to 1.71.
   → **Fix:** Primary CLV = `morning_odds / closing_odds − 1` on the same book, side, and line. Secondary CLV = `morning_odds × p_close_novig − 1`, used when both closing sides exist. The gate uses the primary measure.

3. **The spec never says the close must come from the same book.** If the best-price book is compared with a different book's close, the measurement mixes in the spread between books.
   → **Fix:** The close is the **same book**, same line, same side. If that book has no close, the row is "missing close".

4. **Dropping line moves from same-line CLV is selection bias.** The props whose line moved are the ones with the strongest market reaction.
   → **Fix:** The report adds a model-free **line-direction stat**. Among selected rows whose line moved, it counts how many moved toward our side (for example, an over at 24.5 that closes at 25.5) versus away from it, with a game-bootstrap interval, plus the share of selected rows that have a same-line close. This stat doesn't gate the launch, but it is printed next to CLV.

5. **The live close doesn't match the replay close.** The replay can pick tip minus 5 minutes from historical data, which has 5-minute granularity. The live 30-minute grid can leave the "close" 30 minutes before tip, and lineup news lands in that window.
   → **Fix:** Add one schedule-driven capture per game at **tip minus 10 minutes**, costing about 30 credits a day. The replay close is also defined as the last observation at or before tip minus 10 minutes, so live CLV and replay CLV mean the same thing.

6. **Game bootstrap alone ignores player clustering.** The model can be biased on one player who then gets selected 40 times.
   → **Fix:** Also run a player-clustered bootstrap. The gate uses the **wider** of the game interval and the player interval. Both are printed.

7. **Duplicate exposure.** The market key includes the line, so over 24.5 at DraftKings and over 25.5 at FanDuel can both publish.
   → **Fix:** Publish at most one row per (event, player, stat, side), the one with the highest EV. The others are stored as `superseded`. The replay applies the same rule before computing CLV and ROI.

### B. The gate tests the wrong thing

8. **ΔLL ≤ 0.005 over all props is a test of whether the model matches the market. It is not a test of edge.** An independent heuristic NB model will almost certainly lose to sharp prop prices on global log loss, so that gate would fail regardless of whether the selected rows have edge. The spec already contains the right test, the blend weight w, but treats it as an aside.
   → **Fix (revised gate, hashed before scoring):** "Demonstrated edge" requires **all** of these:
   - the lower bound of the w interval is > 0 (the model adds information beyond the price);
   - the lower bound of selected-row CLV is > 0, using the wider of the two cluster intervals, with ≥ 100 unique games;
   - the non-oracle (morning injury report) replay passes the same two conditions.

   ΔLL and its interval are still printed, with the 0.005 margin reported as context. w is fit on the **raw** conditional model probability. Shrinkage is a linear pull toward 0.5 and would confound w. Its interval comes from the same cluster bootstraps. The vague "w upper bound < 0.15" sentence is dropped.

9. **SHRINK fit, defined precisely.** SHRINK is fit by conditional (decisive-outcome) log loss on train props. Pushes are excluded from the fit, and half-point and integer lines are both used. The 4/6/8/10% grid also prints **expected published rows per night** from train. If SHRINK fits low, the 8% bar may almost never clear, and the user should see that before paying for live odds.

10. **Make "scored once" mechanical.** `scripts/replay.ts --test` refuses to run unless all of these hold:
    - the git tree is clean;
    - `rules/gate.json` hashes to the committed value;
    - `reports/test-scored.lock` is absent.

    The run writes the lock. If a code bug is found after scoring, a rerun is allowed only as a labeled **post-hoc** run. The original result stays printed, and a post-hoc run can never earn "demonstrated edge".

### C. Model details tightened

11. **Matched pool is too small under the 30-game cap.** Requiring every active rotation teammate to have played at least 10 minutes keeps only about 0.85⁷ ≈ 30% of games, which is roughly 10 matches out of 30.
    → **Fix:**
    - `base_pool` keeps the most recent 30 same-team played games and feeds `rate_base`.
    - `matched_pool` is drawn from **all** same-team games this season and last season, taking the most recent 30 matches.
    - Rotation teammate = median minutes ≥ 15 over that teammate's last 15 games played for this team (minutes > 0).

12. **NB degenerates when Var(X) ≤ mean.** That happens when α = 0 and Var(M) = 0. The code falls back to a Poisson with the same mean, and a test covers it. All timestamps are stored in UTC. The 8:00am board time is converted from America/Los_Angeles, so DST is handled in one function.

13. **The oracle replay and the live board cover different populations.** The oracle replay cannot apply the "teammate questionable/doubtful → unsupported" rule, so it scores players that live would skip. This is printed as a known difference and is another reason the oracle result cannot carry the edge label.

14. **The stale-price threshold depends on what `last_update` means.** If The Odds API's `last_update` marks when a price *changed*, a stable price looks hours old and the 20-minute rule rejects good prices.
    → **Fix:** The coverage sample measures the age distribution and what `last_update` actually means. `ODDS_MAX_AGE_MINUTES` is set from that note and **then** hashed. It is not a pre-chosen 20.

15. **Markets are fixed to main lines only:** `player_points`, `player_rebounds`, `player_assists`, with no alternates, US region, and the books DraftKings, FanDuel, BetMGM.

### D. Gaps the spec never filled

16. **Data sources (no paid API during the build):**

    | Need | Build-phase source (free) | Live source (after proof) |
    |---|---|---|
    | Box scores (minutes, PTS/REB/AST, team on date) | stats.nba.com `leaguegamelog` (PlayerOrTeam=P): **one request per season**, cached to disk, run from the laptop | Same endpoint is often blocked from cloud IPs → paid balldontlie tier |
    | Schedule and tip times | cdn.nba.com static schedule JSON | same |
    | Live injury report | Official NBA injury report PDF (public document, parsed) | same, or paid feed |
    | Historical injury reports | **Probe** the official PDF archive. If it exists back to 2023-24, the non-oracle replay becomes possible for free | n/a |
    | Odds | Odds API free tier (500 credits/mo) for adapter development only | Paid tiers, see the spend ladder |

    These stats endpoints are unofficial JSON APIs, not HTML scraping. The build makes a handful of cached calls, and the live job switches to a keyed API. If you consider this "scraping", veto it and I'll use balldontlie from the start.

17. **The modules the spec left out:** `lib/sources/boxscores.ts`, `lib/sources/schedule.ts`, `lib/sources/injuries.ts`, `lib/time.ts` (Pacific board date and UTC), `rules/gate.json` (the hashed rule), and `scripts/probe-odds.ts` (the coverage sample).

18. **Scheduling on Fly.** Run one Fly machine with supercronic, with SQLite on a Fly volume. The board job, the 30-minute captures, and the per-game tip-minus-10 captures all run on that machine.

19. **The page carries a "for information, 21+, not betting advice" line.**

### E. Odds cost math, corrected

- Historical event odds cost 10 credits per market per region, so 3 markets cost 30 per snapshot. The spec's 60 per game (2 snapshots) is right.
- **Train props don't need the pre-tip snapshot.** CLV is only gated on test, so train needs the morning snapshot alone at 30 per game.
- Revised pull, about 185k credits:
  - 2023-24 and 2024-25 morning only: about 2,460 × 30 ≈ 74k
  - 2025-26 morning plus close: about 1,230 × 60 ≈ 74k
  - historical events lookups plus slack: about 37k
- 185k exceeds the $59 100K plan, so the spec's budget doesn't cover the pull. It needs one month of the next tier, or two months of 100K. **Verify current pricing on the-odds-api.com before buying.**
- Live use is about 660 + 300 (tip-minus-10) + 30 (morning) ≈ 1k credits a day ≈ 30k a month, which fits the 100K plan.

---

## Kept unchanged from the spec

These carry over exactly as the spec states them:

- the products, books, and markets, and the "no placement / no parlays" list
- the model math:
  - the rate blend with a 200-minute prior
  - the α method-of-moments formula
  - the total-variance formula
  - shrinkage on the conditional split
  - the EV formula and its unit tests
- the availability filter rules, including the unresolved-status rule, the empty-intersection rule, and the new-starter rule
- the conditional "if they sit" card and its states, and the survival definition
- the two-sided quarantine with cause codes
- one fetch → rank once → publish or fail
- grading and ROI accounting
- the copy rules: priced-at labels, no "best available now", coverage split by reason
- storing every evaluated prop
- the two hashes, with the test season scored once

---

## Zero-cost override (user: "only pay if absolutely necessary")

This section replaces the spend ladder, the Fly hosting, and the paid live sources described further down.

- **The only unavoidable cost is historical prop odds.**
  - There's no free dataset with timestamped NBA props by book. My search found only paid APIs or scrapers.
  - The Odds API's free tier (500 credits a month) is used for adapter development.
  - The real gate needs **one month of the 100K plan, $59, once.** I'll cancel it right after the pull.
- **Fit everything into that one 100K month:**
  - **Probe:** about 9k credits. The probe weeks are chosen *inside* the pull ranges, so those credits are reused, not wasted. If the probe looks bad, stop and keep the rest of the credits.
  - **Train:** 2024-25 from Jan 1 onward, morning only, about 650 games × 30 ≈ 20k. 2023-24 is dropped.
  - **Test:** all of 2025-26, morning plus close, about 1,230 × 60 ≈ 74k.
  - **Historical events lookups:** about 300.
  - **Total:** about 95k. If the pull runs short, I'll trim the earliest train weeks, never the test season.
- **Stats stay free in production too:**
  - historical box scores from stats.nba.com `leaguegamelog`, fetched once from the laptop and cached;
  - live box scores and the schedule from the cdn.nba.com liveData/static JSON, which works from cloud runners;
  - injuries from the official NBA injury report PDF.
- **Free hosting replaces Fly:**
  - jobs run as GitHub Actions cron workflows;
  - the SQLite file is committed to a `data` branch after each job;
  - each publication is also written as a JSON snapshot;
  - the pages are a static Next.js export on Vercel Hobby, which works because the pages read published snapshots only.

  GitHub cron can be delayed 5–30 minutes. That's fine for the 8:00am board. Its source times are stored, and the age labels are computed from those times, not from the schedule.
- **The free live mode is a morning board only.** It costs about 30 credits per slate, so 500 credits cover about 16 slates a month, prioritized by game count. There are no 30-minute or tip-minus-10 captures, so there's no live CLV and no if-they-sit grading. Grades still come free from box scores. The page states plainly that close data isn't collected. Captures, at $59 a month, switch on only if the gate passes and you choose to pay.

## Build order and spend decision points

**Phase 1: free, starts now**
1. Scaffold Next.js + TypeScript + SQLite (better-sqlite3) + Vitest. Add `lib/time.ts`.
2. Deterministic tests first (TDD), covering everything in the spec's list plus:
   - the Poisson degenerate case
   - short appearances in E[M] but not in rate or α
   - dedupe to one row per (event, player, stat, side)
   - the ratio CLV and line-direction stats
   - the player-cluster bootstrap
   - the test-scoring lock refusing a second run
3. Implement `lib/project.ts`, `lib/ev.ts`, and `lib/rank.ts` against those tests.
4. Box-score ingest for 2022-23 through 2025-26 into a local cache, plus the alias/crosswalk tables.
5. **Free projection check (train seasons only, never 2025-26 outcomes):** score the NB projection against actual stats with no odds. Report the PIT histogram, coverage of the 50% and 80% intervals, and the share of unsupported players by reason. If the PIT is badly non-uniform, fix the model here, because changing constants on train data is legitimate.
6. Probe whether the archive of official injury report PDFs exists, then write the injury parser.
7. Odds adapter and the `run-board` dry run on the Odds API free tier (a few slates). Store, render both pages, and confirm that a failed publish leaves the previous board up.

**Phase 1 ends only after the free projection check (step 5) looks sane. Then comes the single paid month ($59, 100K): probe → pull → gate, all inside that month.**

**Decision point 1 (inside the $59 month, no extra cost).** Run `probe-odds.ts` on the spec's cheap sample: three weeks, all books and markets, a traded player, an integer line, a disappeared line. Write `reports/odds-coverage.md` covering:
- the morning→close match share
- the both-sides share
- what `last_update` means and the age distribution

Then set `ODDS_MAX_AGE_MINUTES`, fill and commit `rules/gate.json`, and print its hash.

**Decision point 2 (same month): if the probe is good, run the remaining about 86k-credit pull from the zero-cost section, then:**
1. fit SHRINK and w on train;
2. write the threshold grid with rows per night;
3. score 2025-26 once with the oracle replay, plus the non-oracle replay if the archive exists.

The report prints both hashes and both replays.

**Decision point 3: free live.** Deploy GitHub Actions and the Vercel static site with the frozen constants and the free-tier morning board. It's labeled "disagreement only" unless the revised gate passed. Paying $59 a month for captures is optional, and only worth it after a pass.

---

## Verification

- `npx vitest run`: every deterministic test passes, including the spec's list and the new tests above.
- The free projection check report is in `reports/` before any money is spent.
- `run-board` dry run against the free tier writes one publication. Running it twice for the same date does not create a second board. A forced fetch failure leaves the prior board.
- Leakage guard: a deliberately injected future-dated feature makes `replay.ts` fail.
- `replay.ts --test` refuses to run with a dirty tree, a mismatched rule hash, or an existing lock file.
- Start the app (`npm run dev`) and check that `/` and `/history` render published snapshots with priced-at labels and the coverage split.

## Open risks (stated, not solved)

- A heuristic NB model may simply have no edge against prop prices. The plan is built to say so cheaply. The free projection check and the $30 coverage probe are the two places to stop early.
- stats.nba.com may rate-limit or change shape. Ingest is cached, so a failure only blocks refreshes.
- The injury PDF format changes from season to season, so the parser needs fixtures from each season.

---

## Build log: what the free work changed (2026-10-25)

- **Sources.** stats.nba.com needs browser-spoofed headers, so it's out. Box scores come from ESPN's public JSON instead: plain requests, every game for 2022-23 → 2026-27 is ingested, and DNP rows are kept. The **official NBA injury-report PDF archive exists back to 2023-24**. Its URL format changed mid-2025-26 from `10AM` to `10_00AM`. That makes the non-oracle replay possible for free, so the "demonstrated edge" gate is evaluable.
- **Injury rule.** About 18 teams show "NOT YET SUBMITTED" at 10:30 ET. Those teams use the previous evening's entries for tonight's game. Otherwise their players are unsupported, with reason "injury report not submitted".
- **Free projection check** (2023-24 and 2024-25, oracle availability, 52,055 player-games; `reports/projection-check-2023-24_2024-25.md`):
  - Phantom teammates. Players who had left the league counted as rotation teammates. Teammates now must appear in this team's box scores this season or be listed tonight.
  - The rotation threshold of 15 minutes made about 8 teammates binding, and support was 17%. It's now **24 minutes**; support is 37% of all players who played, which is higher among players with posted props. The sweep reports are in `reports/`.
  - Predictive variance was plug-in only, and points were overconfident. It now adds **estimation uncertainty**: Var(rate_final) under the model, plus Var(M)/n. This is not a tuned floor.
  - Result: rebounds 49.0% / 79.2%, assists 49.8% / 79.8% in the 50% / 80% bands. Points are 43.5% / 72.4%, still slightly overconfident with a heavy left tail from in-game exits. SHRINK, fit on log loss, absorbs that.
- **Hosting.** GitHub Actions cron, a force-pushed `data` branch for state, and a GitHub Pages static export.

## Review fixes (2026-10-26)

- **Points distribution.** I decomposed the miss: minutes were 76% inside their 80% band, and points given actual minutes were 75%.
  - A mixture over the player's own minutes was worse on log score, and a discretized normal fixed the tails but not the body.
  - What fits is a **short-night component**: the predictive distribution is (1 − q)·NB(mean, mean + κ·excess) + q·(night at 5–45% of expected minutes).
  - q and κ are fit per stat by log score on train box scores (`rules/dispersion.json`, now part of the rule hash). The fit chose q = 0.07, 0.03, 0.03 and κ = 1.20, 0.88, 0.61 for points, rebounds, assists.
  - Train results (27,149 player-games):
    - points: 48.1% / 78.1% in the 50% / 80% bands, outer deciles 1.15 / 1.04 (were 1.69 / 1.04);
    - rebounds: 49.7% / 79.6%;
    - assists: 49.1% / 79.1%.
  - Points' lower body is still slightly heavy (deciles 0.87–0.88).
- **Coverage.** An active teammate now constrains the pool only when *returning*: active tonight after missing 3+ of the team's last 10 games. Out teammates always constrain it.
  - Support is now 52.2% of all players who played (was 36.7%), and 58.9% of prop-like players.
  - The remaining failures are mostly early-season or new-team thinness and empty out-intersections, which the spec intends.
- **New-starter rule.** It runs wherever starters are known. The oracle replay and the train fits take starters from the box score and include starters new to the team. The 8am report has no lineups, so on the live board and the report replay the rule stays inert. That is stated, not hidden.
- **If-they-sit with several unresolved teammates.** One joint scenario is priced with all of them out, and it resolves only if all of them sit.
- **Partial replay can't lock.** `fit` and `test` require every expected date to be collected or skipped with a recorded reason (both availabilities for test).
- **Train window** is every 4th game date of both 2023-24 and 2024-25, about 19.7k credits; the test season is about 74.3k. That fits one 100K month.
- **Line moves** use the same line if it's still posted, otherwise the book's two-sided main closing line (no-vig nearest 50%), otherwise no close. A stray alternate is never used.
- **Odds note.** `replay.ts collect` and `write-rule.ts --commit` refuse until `reports/odds-coverage.md` exists with its decision filled in and `ODDS_MAX_AGE_SET` is true.

## Availability after the Jalen Williams miss (2026-10-26)

- **What happened.** OKC had not filed by the 10:30 ET report. The evening fallback treated OKC as resolved with only its long-term absences, so the board priced Jalen Williams as active. He was listed out at 5:00pm ET.
- **Strict availability.**
  - The evening fallback is removed.
  - A team marked "not yet submitted" for tonight is unresolved, and so is a game where neither team appears.
  - A team absent while its opponent appears has filed with no injuries.
  - Not-yet-submitted rows now carry their game date, so tomorrow's pending filing doesn't block tonight.
- **Parser fix.** On pages after the first, the table starts higher, and the first rows of every later page were being dropped (for example, the Suns and Grizzlies blocks). The column-title row is now found per page. The Jan 15, 2024 report goes from 95 to 105 entries.
- **News watch.** It runs hourly and costs nothing.
  - It compares each board's saved availability with, for each game, the latest official report before tip, plus ESPN notes posted after publish and before tip.
  - Rows are flagged "news after publish" when their player or a rotation teammate got worse. They are never re-ranked, and the publication is unchanged.
  - The ESPN feed has no archive, so it is live-only and never part of a replay.

## Injury news re-runs the board (2026-10-26)

Each hourly watch re-runs the board for games not yet tipped:
- **Inputs:** the latest official report, worse ESPN notes after publish layered on top, and the same 8am prices and build time.
- **Output:** an "Updated for injury news" view, shown first. It lists rows new since 8am and rows dropped with the reason, and every row states that its price is the 8am price and has likely moved. The view also has its own if-they-sit cards.
- **Unchanged:** the 8am board stays the graded record. Updated rows are not graded, because their prices are stale. With paid captures, the same re-run could be priced at post-news odds.

GitHub workflows pick a mode on their own:
- **live:** a key is set and the test report exists;
- **dryrun:** a key is set;
- **demo:** no key.

The first run ingests the last two seasons of box scores. The data branch keeps `history.sqlite` and the published snapshots, but not the raw API caches. Pages deploys only when the repo variable `PAGES_ENABLED` is `1`.
