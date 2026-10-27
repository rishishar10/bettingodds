import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardRow, ConditionalCard } from "./board.ts";

export interface BoardSnapshot {
  boardDate: string;
  publishedAt: string;
  modelVersion: string;
  label: string;
  shrunk: boolean;
  SHRINK: number;
  evMin: number;
  ruleHash: string | null;
  injury: { url: string; timeUtc: string; teamsUnresolved: string[] } | null;
  games: { gameId: string; tipUtc: string; home: string; away: string; hasOdds: boolean; eventId?: string | null }[];
  buildTimeUtc?: string;
  teams: Record<string, string>;
  rows: BoardRow[];
  conditional: ConditionalCard[];
  coverage: Record<string, number>;
  unmatchedNames: number;
  anomalies: unknown[];
  emptyReason: string | null;
  availability?: Record<string, { unresolved: boolean; status: Record<string, "out" | "active" | "questionable" | "doubtful"> }>;
  closeCollected: boolean;
  dryRun: boolean;
}

/** Published snapshots only. Falls back to dry-run output during development. */
export function dataDir(): string {
  if (process.env.BOARD_DATA_DIR) return process.env.BOARD_DATA_DIR;
  return existsSync("data/published/index.json") ? "data/published" : "data/dev-published";
}

export function listDates(): string[] {
  const f = join(dataDir(), "index.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
}

export function loadBoard(date: string): BoardSnapshot {
  return JSON.parse(readFileSync(join(dataDir(), `${date}.json`), "utf8"));
}

export interface NewsFile {
  checkedAt: string;
  officialReport: { url: string; timeUtc: string } | null;
  espnNotesAfterPublish: number;
  changes: { playerName: string; teamId: string; from: string; to: string; source: string; sourceTime: string; note: string }[];
  rows: Record<string, { kind: "player" | "teammate"; playerName: string; to: string; source: string; sourceTime: string; note: string }[]>;
  update: {
    asOf: string;
    reportTimeUtc: string;
    rows: BoardRow[];
    added: string[];
    dropped: { key: string; reason: string }[];
    tippedGames: string[];
    coverage: Record<string, number>;
    conditional: ConditionalCard[];
    unresolvedTeams: string[];
  } | null;
}

export function loadNews(date: string): NewsFile | null {
  const f = join(dataDir(), `news-${date}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

export interface GradeFile {
  updatedAt: string;
  summary: { bets: number; settled: number; voids: number; pending: number; unitsStaked: number; netUnits: number; roi: number | null };
  grades: Record<string, { result: string | null; minutes: number; actual: number; profit: number | null; close: { kind: string; movement?: number; direction?: string; move?: string } }>;
}

export function loadGrades(): GradeFile | null {
  const f = join(dataDir(), "grades.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

/** The page shows no profit number until the test-season replay is in the repo. */
export const replayInRepo = () => existsSync("reports/test.md");

export { american, bookName, longDate, pacificTime, pct, STAT_NAMES } from "./format.ts";
