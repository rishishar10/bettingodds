export type Stat = "pts" | "reb" | "ast";
export type Side = "over" | "under";
export type Book = "draftkings" | "fanduel" | "betmgm";

export const STATS: readonly Stat[] = ["pts", "reb", "ast"];
export const BOOKS: readonly Book[] = ["draftkings", "fanduel", "betmgm"];

/** One player's line in one game. Players who did not play have minutes 0. */
export interface GameLog {
  gameId: string;
  /** Pacific calendar date of the game, YYYY-MM-DD. */
  date: string;
  tipUtc: string;
  /** Season label, e.g. "2024-25". */
  season: string;
  teamId: string;
  opponentId: string;
  playerId: string;
  playerName: string;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  starter: boolean;
}

export type InjuryStatus = "out" | "doubtful" | "questionable" | "probable" | "available";

/** A teammate's state for tonight, as known at build time. */
export interface TeammateTonight {
  playerId: string;
  status: "out" | "active" | "questionable" | "doubtful";
  /** True only when tonight's starters are known and this player is listed. */
  listedStarter?: boolean;
}

export interface OutcomeProbs {
  win: number;
  push: number;
  loss: number;
}
