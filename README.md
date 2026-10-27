# NBA morning board

The board flags a disagreement between a supported projection and one book's price, states the assumption behind it, and keeps the record. It covers points, rebounds and assists at DraftKings, FanDuel and BetMGM. It places no bets, scrapes nothing, offers no parlays, holds no accounts, and has no chat-written picks. The full design, with the stress-test changes, is in `PLAN.md`.

## Status and spend

| Step | Cost | State |
|---|---|---|
| Model, ranking, store, gate, tests | free | done (`npm test`) |
| Box scores, 2022-23 → now (ESPN public JSON) | free | `node scripts/ingest-boxscores.ts 2022-23 2023-24 2024-25 2025-26 2026-27` |
| Injury reports (official NBA PDFs, archive back to 2023-24) | free | wired; enables the non-oracle replay |
| Free projection check, train seasons only | free | `node scripts/check-projection.ts 2023-24 2024-25` |
| Dispersion fit (q, κ per stat), train box scores | free | `node scripts/fit-dispersion.ts`, which writes `rules/dispersion.json` |
| Odds coverage probe + full historical pull | **one month of The Odds API 100K plan, $59** | `probe-odds.ts`, then `replay.ts collect` |
| Live morning board | free tier (500 credits ≈ 16 slates/mo) | starts only after `reports/test.md` exists |
| 30-minute captures, CLV, if-they-sit grading | $59/mo, optional | set repo variable `CAPTURES_ENABLED=1` |

## The paid month, in order

```sh
export ODDS_API_KEY=...
node scripts/probe-odds.ts --plan          # credits needed
node scripts/probe-odds.ts                 # writes reports/odds-coverage.md
# Read it, fill in its decision lines, set ODDS_MAX_AGE_MINUTES and flip ODDS_MAX_AGE_SET
# in lib/constants.ts. The pull and the rule hash refuse to run until then.
node scripts/write-rule.ts --commit        # rules/gate.json + rules/gate.sha256
git add rules lib/constants.ts reports/odds-coverage.md && git commit -m "Hash the pass/fail rule"
node scripts/replay.ts plan train && node scripts/replay.ts plan test
node scripts/replay.ts collect train --max-credits 20500   # every 4th game date of 2023-24 and 2024-25, ~19.7k
node scripts/replay.ts collect test --max-credits 75000    # all of 2025-26, morning + close, ~74.3k
node scripts/replay.ts collect test --availability oracle   # cached odds, no credits
node scripts/replay.ts fit                 # rules/fitted.json, reports/train.md
git add rules/fitted.json reports/train.md && git commit -m "Train fit"
node scripts/replay.ts test                # scores 2025-26 once; refuses a second run
```

`replay.ts fit` and `replay.ts test` refuse to run until every expected date is either collected or skipped with a recorded reason. For the test, that applies to both the report and oracle replays. A partial pull can't lock the season. `replay.ts test` also refuses to run if the tree is dirty, the rule hash doesn't match the committed one, the code constants have drifted from the rule, or the season has already been scored. A rerun after a bug fix needs `--post-hoc`, is labeled as such, and can never earn "demonstrated edge".

## Live (free)

1. Push to GitHub. Add the secret `ODDS_API_KEY`. Under Settings → Pages, set the source to GitHub Actions. A private repo needs a paid GitHub plan for Pages; otherwise deploy `out/` to Vercel Hobby.
2. `.github/workflows/board.yml` runs at 8:00am Pacific. It refreshes box scores, builds the board, grades earlier boards, saves state to the force-pushed `data` branch, and deploys the static site.
3. To preview the board without publishing, run it manually with "dry run" checked, or locally with `node scripts/run-board.ts --dry-run`.

## Local morning reset (no GitHub needed)

`scripts/morning.sh` pulls the last three days of box scores and builds today's board. With `ODDS_API_KEY` in `.env` it's a real dry run, costing about 30 free-tier credits. Otherwise it's the labeled demo. It then grades and rebuilds the site. To run it every morning at 8:05 and keep http://localhost:4173 serving the latest build:

```sh
scripts/install-local-schedule.sh              # installs two user launch agents
scripts/install-local-schedule.sh --uninstall  # removes them
```

The installer also adds an hourly status watch at :15, from 9:15am to 7:15pm (`scripts/watch.sh`). It compares the availability each board was built on with the latest pre-tip official report and ESPN's injury feed. It then marks any row whose player or a rotation teammate got worse, without re-ranking or editing the publication. GitHub Actions runs the same watch in `.github/workflows/status.yml`.

The log is `data/morning.log`. If the Mac is asleep at 8:05, the job runs when it wakes.

## Layout

- `lib/project.ts`: pools, availability matching, the rate blend, α, the negative binomial, and sensitivity.
- `lib/ev.ts`: odds validation, shrinkage, and EV.
- `lib/rank.ts`: exact-key best price, the two-sided quarantine, and one row per exposure.
- `lib/board.ts`: the shared slate evaluator, used by live and both replays, plus the if-they-sit cards.
- `lib/gate.ts`, `lib/rule.ts`: the gate report and the test-season guard.
- `lib/sources/`: `espn.ts`, `injuries.ts`, `odds.ts`, `aliases.ts`, `crosswalk.ts`.
- `lib/store.ts`: `data/board.sqlite`, with one publication per date, every evaluated prop, grade events, and conditional states.
- `scripts/`: `run-board`, `grade`, `capture-close`, `replay`, `probe-odds`, `check-projection`, `ingest-boxscores`, `write-rule`, `demo-snapshot`.
- `app/`: static pages that read published snapshots only.
