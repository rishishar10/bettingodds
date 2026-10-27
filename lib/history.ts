import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { EspnGame } from "./sources/espn.ts";
import type { GameLog } from "./types.ts";

/** Box-score history: games and player lines. Separate from the board store. */
export function openHistory(path = "data/history.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 30000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY, date TEXT NOT NULL, tip_utc TEXT NOT NULL, season TEXT NOT NULL,
      season_type INTEGER NOT NULL, completed INTEGER NOT NULL,
      home_id TEXT, home_abbr TEXT, home_name TEXT, away_id TEXT, away_abbr TEXT, away_name TEXT
    );
    CREATE TABLE IF NOT EXISTS logs (
      game_id TEXT NOT NULL, date TEXT NOT NULL, tip_utc TEXT NOT NULL, season TEXT NOT NULL,
      team_id TEXT NOT NULL, opponent_id TEXT NOT NULL, player_id TEXT NOT NULL, player_name TEXT NOT NULL,
      minutes REAL NOT NULL, pts REAL NOT NULL, reb REAL NOT NULL, ast REAL NOT NULL, starter INTEGER NOT NULL,
      PRIMARY KEY (game_id, player_id)
    );
    CREATE INDEX IF NOT EXISTS logs_team ON logs (team_id, date);
    CREATE INDEX IF NOT EXISTS logs_player ON logs (player_id, date);
    CREATE INDEX IF NOT EXISTS games_date ON games (date);
  `);

  const toLog = (r: any): GameLog => ({
    gameId: r.game_id, date: r.date, tipUtc: r.tip_utc, season: r.season, teamId: r.team_id,
    opponentId: r.opponent_id, playerId: r.player_id, playerName: r.player_name, minutes: r.minutes,
    pts: r.pts, reb: r.reb, ast: r.ast, starter: Boolean(r.starter),
  });
  const toGame = (r: any): EspnGame => ({
    gameId: r.game_id, tipUtc: r.tip_utc, date: r.date, season: r.season, seasonType: r.season_type,
    completed: Boolean(r.completed),
    home: { id: r.home_id, abbr: r.home_abbr, name: r.home_name },
    away: { id: r.away_id, abbr: r.away_abbr, name: r.away_name },
  });

  return {
    db,
    close: () => db.close(),
    upsertGame(g: EspnGame) {
      db.prepare(`INSERT OR REPLACE INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        g.gameId, g.date, g.tipUtc, g.season, g.seasonType, g.completed ? 1 : 0,
        g.home.id, g.home.abbr, g.home.name, g.away.id, g.away.abbr, g.away.name,
      );
    },
    hasLogs(gameId: string): boolean {
      return Boolean(db.prepare("SELECT 1 FROM logs WHERE game_id = ? LIMIT 1").get(gameId));
    },
    insertLogs(logs: GameLog[]) {
      // IMMEDIATE takes the write lock up front so concurrent ingests wait instead of deadlocking.
      db.exec("BEGIN IMMEDIATE");
      try {
        const ins = db.prepare(`INSERT OR REPLACE INTO logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const l of logs)
          ins.run(l.gameId, l.date, l.tipUtc, l.season, l.teamId, l.opponentId, l.playerId, l.playerName,
            l.minutes, l.pts, l.reb, l.ast, l.starter ? 1 : 0);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    gamesOn(date: string, seasonType = 2): EspnGame[] {
      return (db.prepare("SELECT * FROM games WHERE date = ? AND season_type = ? ORDER BY tip_utc").all(date, seasonType) as any[]).map(toGame);
    },
    gameDates(season: string, seasonType = 2): string[] {
      return (db.prepare("SELECT DISTINCT date FROM games WHERE season = ? AND season_type = ? AND completed = 1 ORDER BY date").all(season, seasonType) as any[]).map((r) => r.date);
    },
    /** Regular-season logs for a team in the given seasons, strictly before a date. */
    teamLogsBefore(teamId: string, seasons: string[], beforeDate: string): GameLog[] {
      const q = `SELECT l.* FROM logs l JOIN games g ON g.game_id = l.game_id
        WHERE l.team_id = ? AND g.season_type = 2 AND l.season IN (${seasons.map(() => "?").join(",")}) AND l.date < ?`;
      return (db.prepare(q).all(teamId, ...seasons, beforeDate) as any[]).map(toLog);
    },
    logsForGame(gameId: string): GameLog[] {
      return (db.prepare("SELECT * FROM logs WHERE game_id = ?").all(gameId) as any[]).map(toLog);
    },
    /** The team a player was on most recently before a date, from box scores. */
    teamOnDate(playerId: string, beforeDate: string): string | null {
      const r = db.prepare("SELECT team_id FROM logs WHERE player_id = ? AND date < ? ORDER BY date DESC LIMIT 1").get(playerId, beforeDate) as any;
      return r?.team_id ?? null;
    },
  };
}
export type History = ReturnType<typeof openHistory>;
