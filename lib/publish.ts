import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HEURISTIC_SHRINK } from "./constants.ts";

export const paths = (dryRun: boolean) => ({
  db: dryRun ? "data/dev-board.sqlite" : "data/board.sqlite",
  published: dryRun ? "data/dev-published" : "data/published",
});

export function modelState(): { SHRINK: number; modelVersion: string; label: string; ruleHash: string | null } {
  const fitted = existsSync("rules/fitted.json") ? JSON.parse(readFileSync("rules/fitted.json", "utf8")) : null;
  const gate = existsSync("reports/gate-result.json") ? JSON.parse(readFileSync("reports/gate-result.json", "utf8")) : null;
  return {
    SHRINK: fitted?.SHRINK ?? HEURISTIC_SHRINK,
    modelVersion: fitted && gate ? "fitted-v1" : "heuristic-v1",
    label: gate?.demonstratedEdge ? "demonstrated edge" : "disagreement only, no demonstrated edge",
    ruleHash: gate?.ruleHash ?? null,
  };
}

/** Writes the snapshot the static pages read, plus an index of dates. */
export function writeSnapshot(dir: string, boardDate: string, payload: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${boardDate}.json`), JSON.stringify(payload, null, 1));
  const indexFile = join(dir, "index.json");
  const index: string[] = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : [];
  if (!index.includes(boardDate)) index.push(boardDate);
  index.sort().reverse();
  writeFileSync(indexFile, JSON.stringify(index));
}
