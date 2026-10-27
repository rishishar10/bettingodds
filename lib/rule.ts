import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { canonicalJson, hashOf } from "./hash.ts";
import { MODEL, POLICY } from "./constants.ts";
import { loadDispersion } from "./dispersion.ts";

export const RULE_PATH = "rules/gate.json";
export const RULE_HASH_PATH = "rules/gate.sha256";
export const TEST_LOCK_PATH = "reports/test-scored.lock";

export function loadRule(path = RULE_PATH): { rule: Record<string, unknown>; hash: string } {
  const rule = JSON.parse(readFileSync(path, "utf8"));
  return { rule, hash: hashOf(rule) };
}

export interface GuardEnv {
  gitClean: () => boolean;
  committedHash: () => string | null;
  lockExists: () => boolean;
}

export const realGuardEnv: GuardEnv = {
  gitClean: () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "",
  committedHash: () => (existsSync(RULE_HASH_PATH) ? readFileSync(RULE_HASH_PATH, "utf8").trim() : null),
  lockExists: () => existsSync(TEST_LOCK_PATH),
};

/**
 * Refuses to score the test season unless the tree is clean, the rule
 * matches its committed hash, the code constants match the rule, and the
 * season has not been scored. A post-hoc run skips only the lock and can
 * never earn "demonstrated edge".
 */
export function guardTestRun(
  rule: Record<string, unknown>,
  env: GuardEnv,
  opts: { postHoc: boolean },
): { ok: true; hash: string } | { ok: false; reason: string } {
  const hash = hashOf(rule);
  if (!env.gitClean()) return { ok: false, reason: "git tree is not clean" };
  const committed = env.committedHash();
  if (!committed) return { ok: false, reason: "rule hash is not committed" };
  if (committed !== hash) return { ok: false, reason: `rule hash ${hash} != committed ${committed}` };
  if (canonicalJson(rule.model) !== canonicalJson(MODEL)) return { ok: false, reason: "code MODEL constants differ from the rule" };
  if (canonicalJson(rule.policy) !== canonicalJson(POLICY)) return { ok: false, reason: "code POLICY constants differ from the rule" };
  if (rule.dispersion && canonicalJson(rule.dispersion) !== canonicalJson(loadDispersion())) return { ok: false, reason: "rules/dispersion.json differs from the rule" };
  if (env.lockExists() && !opts.postHoc) return { ok: false, reason: "test season already scored; rerun only with --post-hoc" };
  return { ok: true, hash };
}

export const ODDS_NOTE_PATH = "reports/odds-coverage.md";

/** The full pull and the rule hash wait on a filled-in odds-coverage decision. */
export function oddsNoteReady(): { ok: true } | { ok: false; reason: string } {
  if (!existsSync(ODDS_NOTE_PATH)) return { ok: false, reason: `${ODDS_NOTE_PATH} is missing; run scripts/probe-odds.ts first` };
  if (readFileSync(ODDS_NOTE_PATH, "utf8").includes("___")) return { ok: false, reason: `fill in the decision in ${ODDS_NOTE_PATH}` };
  if (!POLICY.ODDS_MAX_AGE_SET) return { ok: false, reason: "set ODDS_MAX_AGE_MINUTES from the note and flip ODDS_MAX_AGE_SET in lib/constants.ts" };
  return { ok: true };
}

export function writeTestLock(info: Record<string, unknown>): void {
  writeFileSync(TEST_LOCK_PATH, JSON.stringify(info, null, 2));
}
