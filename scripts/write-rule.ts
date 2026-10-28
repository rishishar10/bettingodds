// Writes rules/gate.json from the code constants. With --commit, also writes
// rules/gate.sha256; commit both before the test season is scored.
import { writeFileSync } from "node:fs";
import { MODEL, POLICY } from "../lib/constants.ts";
import { hashOf } from "../lib/hash.ts";
import { oddsNoteReady, RULE_HASH_PATH, RULE_PATH } from "../lib/rule.ts";
import { loadDispersion } from "../lib/dispersion.ts";

export const RULE = {
  version: 1,
  model_version_on_fit: "fitted-v1",
  seasons: {
    regular_season_only: true,
    train: { seasons: ["2023-24", "2024-25"], every_nth_game_date: 4, snapshots: ["morning"] },
    test: { season: "2025-26", snapshots: ["morning", "close"] },
  },
  snapshots: {
    morning: "09:00 America/Los_Angeles on the board date; games tipping at or before it are excluded",
    close: "last observation at or before tip minus 10 minutes, same book, same side",
  },
  features: {
    code: "lib/project.ts",
    base_pool: "most recent 30 same-team played games (minutes > 0), this season and last, before the board date",
    matched_pool: "most recent 30 same-team played games matching every rotation teammate: out => teammate under 10 min; active => 10+ min",
    rotation: "median minutes >= 24 over the teammate's last 15 games played for this team",
    rate: "(matched stat + 400 * rate_base) / (matched minutes + 200); games under 8 minutes excluded from rates and alpha",
    minutes: "E[M], Var(M) (n-1) from this season's matched games (minutes > 0, short appearances included) if >= 3, else last season's",
    distribution: "negative binomial with Var = E[mu] + alpha E[mu^2] + Var(mu) + estimation (Var(rate_final) from the matched sample under the model, Var(M)/n); Poisson when Var <= mean",
    minutes_blend: "E[M] = 0.55 * last 5 games played for the team + 0.45 * matched E[M]",
    opponent: "rate * factor^beta (pts 0.97, reb 0.54, ast 0.81), factor = opponent's allowed per-minute rate over its last 15 games vs league to date, shrunk with 10 games; points also * 1.012",
    teammates: "on this team now and seen in its box scores this season (DNP rows count) or listed tonight; last season stands in before a team's first game",
  },
  shrink_fit: "conditional log loss over decisive outcomes, over side, all evaluated train props, report availability; golden section on [0,1]",
  blend_w: "logit p = w logit(raw model conditional) + (1-w) logit(no-vig), half-point props with both sides at the same book; log loss",
  no_vig: "proportional",
  bootstrap: { clusters: ["game", "player"], interval: "wider of the two", reps: 2000, w_reps: 500, level: 0.95, seed: 20251021 },
  missing_data: [
    "a prop with one side missing, stale, or unmatched is dropped from both log-loss scores and counted",
    "selected rows without a same-book same-line close are excluded from CLV and counted; line moves reported separately",
    "zero minutes voids; players absent from the box score are not graded",
  ],
  injury: "latest official report printed >= 30 minutes before the snapshot; a team marked not yet submitted for tonight, or a game where neither team appears, is unresolved and its players are unsupported; a team absent while its opponent appears filed with no injuries",
  clv: "morning decimal / closing decimal - 1, same book, side and line",
  gate: {
    demonstrated_edge_requires: [
      "report-availability replay: lower bound of w interval > 0",
      "report-availability replay: lower bound of selected-row CLV interval > 0",
      "report-availability replay: >= MIN_CLV_GAMES unique games with a same-line close",
    ],
    oracle: "printed as an upper bound; never sufficient",
    delta_ll: "printed with the DLL_MARGIN; not gating",
    post_hoc: "a rerun after a code fix is labeled post-hoc and cannot earn demonstrated edge",
  },
  dispersion_fit: "per stat, (1 - q) NB(mean, mean + kappa (var - mean)) + q short night; q on a 0.01 grid, kappa by golden section; mean log score on train box scores (scripts/fit-dispersion.ts)",
  dispersion: loadDispersion(),
  model: MODEL,
  policy: POLICY,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(RULE_PATH, JSON.stringify(RULE, null, 2) + "\n");
  const hash = hashOf(RULE);
  console.log(`rule hash ${hash}`);
  if (process.argv.includes("--commit")) {
    const ready = oddsNoteReady();
    if (!ready.ok) {
      console.error(`not hashing: ${ready.reason}`);
      process.exit(1);
    }
    writeFileSync(RULE_HASH_PATH, hash + "\n");
    console.log(`wrote ${RULE_HASH_PATH}; commit both files before scoring the test season`);
  }
}
