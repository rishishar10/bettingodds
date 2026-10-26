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
  injury: { url: string; timeUtc: string; teamsFromFallback: string[]; teamsUnresolved: string[] } | null;
  games: { gameId: string; tipUtc: string; home: string; away: string; hasOdds: boolean }[];
  teams: Record<string, string>;
  rows: BoardRow[];
  conditional: ConditionalCard[];
  coverage: Record<string, number>;
  unmatchedNames: number;
  anomalies: unknown[];
  emptyReason: string | null;
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

const BOOK_NAMES: Record<string, string> = { draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM" };
export const bookName = (b: string) => BOOK_NAMES[b] ?? b;
export const STAT_NAMES: Record<string, string> = { pts: "points", reb: "rebounds", ast: "assists" };
export const american = (a: number) => (a > 0 ? `+${a}` : String(a));
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export function pacificTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
}

export function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
