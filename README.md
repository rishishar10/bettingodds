# NBA morning board

The board flags a disagreement between a supported projection and one book's price, states the assumption behind it, and keeps the record. It covers points, rebounds and assists at DraftKings, FanDuel and BetMGM. It places no bets, scrapes nothing, offers no parlays, holds no accounts, and has no chat-written picks. The full design, with the stress-test changes, is in `PLAN.md`.

## Status and spend

| Step | Cost | State |
|---|---|---|
| Model, ranking, store, gate, tests | free | done (`npm test`) |
| Box scores, 2022-23 → now (ESPN public JSON) | free | `node scripts/ingest-boxscores.ts 2022-23 2023-24 2024-25 2025-26 2026-27` |
| Injury reports (official NBA PDFs, archive back to 2023-24) | free | wired; enables the non-oracle replay |
| Free projection check, train seasons only | free | `node scripts/check-projection.ts 2023-24 2024-25` |
| Odds coverage probe + full historical pull | **one month of The Odds API 100K plan, $59** | `probe-odds.ts`, then `replay.ts collect` |
| Live morning board | free tier (500 credits ≈ 16 slates/mo) | starts only after `reports/test.md` exists |
| 30-minute captures, CLV, if-they-sit grading | $59/mo, optional | set repo variable `CAPTURES_ENABLED=1` |

## The paid month, in order

```sh
export ODDS_API_KEY=...
node scripts/probe-odds.ts --plan          # credits needed
node scripts/probe-odds.ts                 # writes reports/odds-coverage.md
# Read it. Set ODDS_MAX_AGE_MINUTES in lib/constants.ts from the last_update finding, then:
node scripts/write-rule.ts --commit        # rules/gate.json + rules/gate.sha256
git add rules lib/constants.ts reports/odds-coverage.md && git commit -m "Hash the pass/fail rule"
node scripts/replay.ts plan train && node scripts/replay.ts plan test
node scripts/replay.ts collect train --max-credits 22000
node scripts/replay.ts collect test --max-credits 76000
node scripts/replay.ts collect test --availability oracle   # cached odds, no credits
node scripts/replay.ts fit                 # rules/fitted.json, reports/train.md
git add rules/fitted.json reports/train.md && git commit -m "Train fit"
node scripts/replay.ts test                # scores 2025-26 once; refuses a second run
```

`replay.ts test` refuses to run if the tree is dirty, the rule hash doesn't match the committed one, the code constants have drifted from the rule, or the season has already been scored. A rerun after a bug fix needs `--post-hoc`, is labeled as such, and can never earn "demonstrated edge".

## Live (free)

1. Push to GitHub. Add the secret `ODDS_API_KEY`. Under Settings → Pages, set the source to GitHub Actions. A private repo needs a paid GitHub plan for Pages; otherwise deploy `out/` to Vercel Hobby.
2. `.github/workflows/board.yml` runs at 8:00am Pacific. It refreshes box scores, builds the board, grades earlier boards, saves state to the force-pushed `data` branch, and deploys the static site.
3. To preview the board without publishing, run it manually with "dry run" checked, or locally with `node scripts/run-board.ts --dry-run`.

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
