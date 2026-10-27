import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { EvaluatedRow } from "./rank.ts";
import type { Result } from "./grade.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS publications (
  board_date TEXT PRIMARY KEY,
  published_at TEXT NOT NULL,
  model_version TEXT NOT NULL,
  rule_hash TEXT,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  board_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS evaluated_props (
  board_date TEXT NOT NULL,
  key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  stat TEXT NOT NULL,
  line REAL NOT NULL,
  side TEXT NOT NULL,
  book TEXT NOT NULL,
  decimal REAL NOT NULL,
  source_updated_at TEXT NOT NULL,
  raw_win REAL, raw_push REAL, raw_loss REAL,
  final_win REAL, final_push REAL, final_loss REAL,
  ev REAL NOT NULL,
  state TEXT NOT NULL,
  books TEXT NOT NULL,
  detail TEXT,
  PRIMARY KEY (board_date, key)
);
CREATE TABLE IF NOT EXISTS unsupported (
  board_date TEXT NOT NULL,
  player_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  PRIMARY KEY (board_date, player_id)
);
CREATE TABLE IF NOT EXISTS grade_events (
  id INTEGER PRIMARY KEY,
  board_date TEXT NOT NULL,
  key TEXT NOT NULL,
  result TEXT NOT NULL,
  minutes REAL NOT NULL,
  actual REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('grade', 'correction'))
);
CREATE TABLE IF NOT EXISTS odds_observations (
  id INTEGER PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  event_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  stat TEXT NOT NULL,
  line REAL NOT NULL,
  side TEXT NOT NULL,
  book TEXT NOT NULL,
  decimal REAL NOT NULL,
  source_updated_at TEXT
);
CREATE TABLE IF NOT EXISTS conditional_states (
  board_date TEXT NOT NULL,
  subject_player_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  stat TEXT NOT NULL,
  line REAL NOT NULL,
  side TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'initially_qualifying', 'confirmed_out', 'confirmed_active', 'expired',
    'still_clearing', 'moved_past_bar', 'pulled')),
  status_changed_at TEXT,
  injury_source_time TEXT,
  odds_source_time TEXT,
  fetched_at TEXT,
  decimal REAL,
  ev REAL,
  PRIMARY KEY (board_date, subject_player_id, player_id, stat, line, side)
);
`;

export type Store = ReturnType<typeof openStore>;

export interface Publication {
  boardDate: string;
  publishedAt: string;
  modelVersion: string;
  ruleHash: string | null;
  payload: unknown;
}

export function openStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);

  const tx = <T>(f: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = f();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };

  return {
    db,
    close: () => db.close(),

    getPublication(boardDate: string): Publication | null {
      const r = db.prepare("SELECT * FROM publications WHERE board_date = ?").get(boardDate) as
        | Record<string, string>
        | undefined;
      return r
        ? {
            boardDate: r.board_date,
            publishedAt: r.published_at,
            modelVersion: r.model_version,
            ruleHash: r.rule_hash,
            payload: JSON.parse(r.payload),
          }
        : null;
    },

    listPublications(): Publication[] {
      return (db.prepare("SELECT * FROM publications ORDER BY board_date DESC").all() as Record<string, string>[]).map(
        (r) => ({
          boardDate: r.board_date,
          publishedAt: r.published_at,
          modelVersion: r.model_version,
          ruleHash: r.rule_hash,
          payload: JSON.parse(r.payload),
        }),
      );
    },

    logRun(boardDate: string, startedAt: string, status: "published" | "failed" | "skipped", detail?: string) {
      db.prepare("INSERT INTO runs (board_date, started_at, status, detail) VALUES (?, ?, ?, ?)").run(
        boardDate,
        startedAt,
        status,
        detail ?? null,
      );
    },

    /**
     * Writes the one publication for a date together with every evaluated
     * prop and every unsupported player. A second publish for the same date
     * throws and changes nothing.
     */
    publish(
      pub: Publication,
      evaluated: EvaluatedRow[],
      unsupported: { playerId: string; reason: string; detail: string }[],
    ): void {
      tx(() => {
        if (this.getPublication(pub.boardDate)) {
          throw new Error(`board for ${pub.boardDate} already published`);
        }
        db.prepare(
          "INSERT INTO publications (board_date, published_at, model_version, rule_hash, payload) VALUES (?, ?, ?, ?, ?)",
        ).run(pub.boardDate, pub.publishedAt, pub.modelVersion, pub.ruleHash, JSON.stringify(pub.payload));
        const ins = db.prepare(`INSERT INTO evaluated_props VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const r of evaluated) {
          ins.run(
            pub.boardDate, r.key, r.eventId, r.playerId, r.playerName, r.stat, r.line, r.side, r.book,
            r.decimal, r.sourceUpdatedAt, r.raw.win, r.raw.push, r.raw.loss, r.final.win, r.final.push,
            r.final.loss, r.ev, r.state, JSON.stringify(r.books), null,
          );
        }
        const insU = db.prepare("INSERT INTO unsupported VALUES (?, ?, ?, ?)");
        for (const u of unsupported) insU.run(pub.boardDate, u.playerId, u.reason, u.detail);
      });
    },

    evaluatedFor(boardDate: string, state?: string) {
      const sql = state
        ? "SELECT * FROM evaluated_props WHERE board_date = ? AND state = ?"
        : "SELECT * FROM evaluated_props WHERE board_date = ?";
      return (state ? db.prepare(sql).all(boardDate, state) : db.prepare(sql).all(boardDate)) as Record<
        string,
        unknown
      >[];
    },

    /** A first grade, or a correction appended as an event. Never a second bet. */
    recordGrade(boardDate: string, key: string, result: Result, minutes: number, actual: number, at: string) {
      const prior = db.prepare("SELECT COUNT(*) AS n FROM grade_events WHERE board_date = ? AND key = ?").get(
        boardDate,
        key,
      ) as { n: number };
      const current = this.currentGrade(boardDate, key);
      if (current && current.result === result && current.actual === actual && current.minutes === minutes) return;
      db.prepare(
        "INSERT INTO grade_events (board_date, key, result, minutes, actual, recorded_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(boardDate, key, result, minutes, actual, at, prior.n > 0 ? "correction" : "grade");
    },

    currentGrade(boardDate: string, key: string) {
      return (db
        .prepare("SELECT * FROM grade_events WHERE board_date = ? AND key = ? ORDER BY id DESC LIMIT 1")
        .get(boardDate, key) ?? null) as { result: Result; minutes: number; actual: number } | null;
    },

    saveObservations(rows: {
      fetchedAt: string; eventId: string; playerName: string; stat: string; line: number; side: string;
      book: string; decimal: number; sourceUpdatedAt: string | null;
    }[]) {
      tx(() => {
        const ins = db.prepare(
          "INSERT INTO odds_observations (fetched_at, event_id, player_name, stat, line, side, book, decimal, source_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );
        for (const r of rows)
          ins.run(r.fetchedAt, r.eventId, r.playerName, r.stat, r.line, r.side, r.book, r.decimal, r.sourceUpdatedAt);
      });
    },

    setConditionalState(row: {
      boardDate: string; subjectPlayerId: string; playerId: string; stat: string; line: number; side: string;
      state: string; statusChangedAt?: string | null; injurySourceTime?: string | null;
      oddsSourceTime?: string | null; fetchedAt?: string | null; decimal?: number | null; ev?: number | null;
    }) {
      db.prepare(`INSERT INTO conditional_states VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (board_date, subject_player_id, player_id, stat, line, side) DO UPDATE SET
          state = excluded.state, status_changed_at = excluded.status_changed_at,
          injury_source_time = excluded.injury_source_time, odds_source_time = excluded.odds_source_time,
          fetched_at = excluded.fetched_at, decimal = excluded.decimal, ev = excluded.ev`).run(
        row.boardDate, row.subjectPlayerId, row.playerId, row.stat, row.line, row.side, row.state,
        row.statusChangedAt ?? null, row.injurySourceTime ?? null, row.oddsSourceTime ?? null,
        row.fetchedAt ?? null, row.decimal ?? null, row.ev ?? null,
      );
    },

    conditionalCounts(): Record<string, number> {
      const rows = db.prepare("SELECT state, COUNT(*) AS n FROM conditional_states GROUP BY state").all() as {
        state: string;
        n: number;
      }[];
      return Object.fromEntries(rows.map((r) => [r.state, r.n]));
    },
  };
}
