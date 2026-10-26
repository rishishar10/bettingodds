import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { canonicalJson, hashOf } from "./hash.ts";
import { MODEL, POLICY } from "./constants.ts";

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
  if (env.lockExists() && !opts.postHoc) return { ok: false, reason: "test season already scored; rerun only with --post-hoc" };
  return { ok: true, hash };
}

export function writeTestLock(info: Record<string, unknown>): void {
  writeFileSync(TEST_LOCK_PATH, JSON.stringify(info, null, 2));
}
