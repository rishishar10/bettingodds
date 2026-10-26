import { MODEL } from "./constants.ts";
import { breakEven, decimalToAmerican, expectedValue, shrink, validatePrice } from "./ev.ts";
import type { History } from "./history.ts";
import { sideProbs } from "./negbin.ts";
import { buildPools, project, projectionDist, sensitivity, type Projection, type SensitivityResult } from "./project.ts";
import { rankBoard, type PriceObs, type RankResult } from "./rank.ts";
import type { EspnGame } from "./sources/espn.ts";
import { resolvePlayer, type RosterPlayer } from "./sources/crosswalk.ts";
import type { RawPrice } from "./sources/odds.ts";
import { previousSeason, seasonOf } from "./time.ts";
import { BOOKS, type GameLog, type Stat, type TeammateTonight } from "./types.ts";

export type TonightStatus = TeammateTonight["status"];

/** Who is on the floor tonight for one team, from one availability source. */
export interface TeamAvailability {
  source: "oracle" | "report";
  sourceTime: string | null;
  /** Listed players by id; anyone not listed is active. */
  status: Map<string, TonightStatus>;
  /** No usable report for this team. */
  unresolved: boolean;
}

export type CoverageReason =
  | "supported"
  | "too_few_games"
  | "unresolved_status"
  | "teammate_role"
  | "unmatched_name"
  | "stale_or_invalid_odds"
  | "player_out"
  | "report_not_submitted";

export interface SlateInput {
  boardDate: string;
  buildTimeUtc: string;
  games: { game: EspnGame; eventId: string }[];
  prices: RawPrice[];
  history: History;
  availability: (teamId: string, game: EspnGame) => TeamAvailability;
  SHRINK: number;
  evMin: number;
  maxAgeMinutes: number;
}

/** If-they-sit card: priced as if one questionable/doubtful teammate sits. */
export interface ConditionalCard {
  subjectPlayerId: string;
  subjectName: string;
  subjectStatus: string;
  playerId: string;
  playerName: string;
  teamId: string;
  stat: Stat | null;
  line: number | null;
  side: "over" | "under" | null;
  book: string | null;
  decimal: number | null;
  sourceUpdatedAt: string | null;
  ev: number | null;
  pWinFinal: number | null;
  pLossFinal: number | null;
  matchedGames: number;
  thin: boolean;
  /** Set when no projection is possible. */
  message: string | null;
}

export interface UnsupportedPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  reason: CoverageReason;
  detail: string;
}

export interface SlateResult {
  rank: RankResult;
  projections: Map<string, Projection>;
  unsupported: UnsupportedPlayer[];
  unmatchedNames: { eventId: string; name: string; reason: string }[];
  coverage: Record<CoverageReason | "prop_market", number>;
  teamOf: Map<string, { teamId: string; opponentId: string; gameId: string }>;
  rosterNames: Map<string, string>;
  /** Joined observations for supported players, before price validation. */
  observations: PriceObs[];
  /** Source name → player id, per event, for joining later captures. */
  nameToPlayer: Map<string, string>;
  conditional: ConditionalCard[];
}

/** Players whose most recent box-score team before the board is this team. */
export function rosterOnDate(history: History, teamId: string, logs: GameLog[], boardDate: string): RosterPlayer[] {
  const seen = new Map<string, RosterPlayer>();
  for (const l of logs) {
    if (seen.has(l.playerId)) continue;
    if (history.teamOnDate(l.playerId, boardDate) === teamId)
      seen.set(l.playerId, { playerId: l.playerId, playerName: l.playerName, teamId });
  }
  return [...seen.values()];
}

/**
 * Tonight's teammates: on this team now, and either seen in this team's box
 * scores in its current season (DNP rows count) or listed by tonight's source.
 * Players who left the league or the roster drop out. Before a team's first
 * game, last season's box scores stand in.
 */
export function currentTeammates(
  roster: RosterPlayer[],
  logs: GameLog[],
  teamId: string,
  season: string,
  lastSeason: string,
  listed: Map<string, TonightStatus>,
): RosterPlayer[] {
  const teamLogs = logs.filter((l) => l.teamId === teamId);
  const rosterSeason = teamLogs.some((l) => l.season === season) ? season : lastSeason;
  const seen = new Set(teamLogs.filter((l) => l.season === rosterSeason).map((l) => l.playerId));
  return roster.filter((r) => r.teamId === teamId && (seen.has(r.playerId) || listed.has(r.playerId)));
}

export const projKey = (playerId: string, stat: Stat) => `${playerId}|${stat}`;

export function evaluateSlate(input: SlateInput): SlateResult {
  const season = seasonOf(input.boardDate);
  const lastSeason = previousSeason(season);
  const projections = new Map<string, Projection>();
  const unsupported: UnsupportedPlayer[] = [];
  const unmatchedNames: SlateResult["unmatchedNames"] = [];
  const teamOf = new Map<string, { teamId: string; opponentId: string; gameId: string }>();
  const rosterNames = new Map<string, string>();
  const joined: PriceObs[] = [];
  const supportedPlayers = new Set<string>();
  const nameToPlayer = new Map<string, string>();
  const conditional: ConditionalCard[] = [];

  for (const { game, eventId } of input.games) {
    const teams = [game.home.id, game.away.id];
    const logsBy = new Map<string, GameLog[]>();
    const roster: RosterPlayer[] = [];
    for (const t of teams) {
      const logs = input.history.teamLogsBefore(t, [season, lastSeason], input.boardDate);
      logsBy.set(t, logs);
      roster.push(...rosterOnDate(input.history, t, logs, input.boardDate));
    }
    for (const p of roster) rosterNames.set(p.playerId, p.playerName);

    const eventPrices = input.prices.filter((p) => p.eventId === eventId);
    const byPlayer = new Map<string, RawPrice[]>();
    for (const p of eventPrices) byPlayer.set(p.playerName, [...(byPlayer.get(p.playerName) ?? []), p]);

    for (const [name, prices] of byPlayer) {
      const j = resolvePlayer(name, roster, teams);
      if (!j.ok) {
        unmatchedNames.push({ eventId, name, reason: j.reason });
        continue;
      }
      const { playerId, teamId } = j;
      nameToPlayer.set(`${eventId}|${name}`, playerId);
      const opponentId = teamId === game.home.id ? game.away.id : game.home.id;
      teamOf.set(playerId, { teamId, opponentId, gameId: game.gameId });
      for (const p of prices) joined.push({ ...p, playerId });

      const avail = input.availability(teamId, game);
      const base = { playerId, playerName: rosterNames.get(playerId) ?? name, teamId };
      if (avail.unresolved) {
        unsupported.push({ ...base, reason: "report_not_submitted", detail: "injury report not submitted" });
        continue;
      }
      const own = avail.status.get(playerId) ?? "active";
      if (own === "out") {
        unsupported.push({ ...base, reason: "player_out", detail: "listed out" });
        continue;
      }
      if (own === "questionable" || own === "doubtful") {
        unsupported.push({ ...base, reason: "unresolved_status", detail: `player ${own}` });
        continue;
      }
      // Report: anyone listed. Oracle: anyone who plays tonight (a season-long absentee returning).
      const listed = avail.source === "report" ? avail.status
        : new Map([...avail.status].filter(([, st]) => st === "active"));
      const teammates: TeammateTonight[] = currentTeammates(roster, logsBy.get(teamId) as GameLog[], teamId, season, lastSeason, listed)
        .filter((r) => r.playerId !== playerId)
        .map((r) => ({ playerId: r.playerId, status: avail.status.get(r.playerId) ?? "active" }));
      const pools = buildPools({
        playerId, teamId, boardDate: input.boardDate, season, lastSeason,
        logs: logsBy.get(teamId) as GameLog[], teammates, startersKnown: false,
      });
      if (!pools.ok && pools.reason === "teammate_status_unresolved" && pools.ids?.length === 1) {
        const subject = pools.ids[0];
        const card = { subjectPlayerId: subject, subjectName: rosterNames.get(subject) ?? subject, subjectStatus: avail.status.get(subject) ?? "", playerId, playerName: base.playerName, teamId };
        const cond = buildPools({
          playerId, teamId, boardDate: input.boardDate, season, lastSeason, logs: logsBy.get(teamId) as GameLog[],
          teammates, startersKnown: false, assumeOut: subject, minMatchedGames: MODEL.CONDITIONAL_MIN_GAMES,
        });
        if (!cond.ok) {
          conditional.push({ ...card, stat: null, line: null, side: null, book: null, decimal: null, sourceUpdatedAt: null, ev: null, pWinFinal: null, pLossFinal: null, matchedGames: 0, thin: true, message: "Role change detected. Projection unavailable." });
        } else {
          for (const stat of new Set(prices.map((p) => p.stat))) {
            const pr = project(cond.pools, stat);
            const dist = projectionDist(pr);
            let best: ConditionalCard | null = null;
            for (const p of prices) {
              if (p.stat !== stat || validatePrice(p.decimal, p.sourceUpdatedAt, input.buildTimeUtc, input.maxAgeMinutes)) continue;
              const fin = shrink(sideProbs(dist, p.line, p.side), input.SHRINK);
              const ev = expectedValue(fin, p.decimal);
              if (ev >= input.evMin && (!best || ev > (best.ev as number)))
                best = { ...card, stat, line: p.line, side: p.side, book: p.book, decimal: p.decimal, sourceUpdatedAt: p.sourceUpdatedAt, ev, pWinFinal: fin.win, pLossFinal: fin.loss, matchedGames: pr.counts.matched, thin: pr.flags.includes("thin_sample"), message: null };
            }
            if (best) conditional.push(best);
          }
        }
      }
      if (!pools.ok) {
        const reason: CoverageReason =
          pools.reason === "teammate_status_unresolved" ? "unresolved_status"
          : pools.reason === "teammate_no_history" || pools.reason === "empty_out_intersection" ? "teammate_role"
          : "too_few_games";
        unsupported.push({ ...base, reason, detail: pools.detail });
        continue;
      }
      supportedPlayers.add(playerId);
      for (const stat of new Set(prices.map((p) => p.stat))) {
        projections.set(projKey(playerId, stat), project(pools.pools, stat));
      }
    }
  }

  const observations = joined.filter((o) => supportedPlayers.has(o.playerId));
  const rank = rankBoard({
    observations,
    books: BOOKS,
    probsFor: ({ playerId, stat, line, side }) => {
      const pr = projections.get(projKey(playerId, stat));
      if (!pr) return null;
      const raw = sideProbs(projectionDist(pr), line, side);
      return { raw, final: shrink(raw, input.SHRINK) };
    },
    buildTimeUtc: input.buildTimeUtc,
    maxAgeMinutes: input.maxAgeMinutes,
    evMin: input.evMin,
  });

  // Supported players whose every price was rejected count as stale/invalid.
  const evaluatedPlayers = new Set(rank.evaluated.map((r) => r.playerId));
  const coverage: SlateResult["coverage"] = {
    prop_market: teamOf.size + unmatchedNames.length,
    supported: 0, too_few_games: 0, unresolved_status: 0, teammate_role: 0, unmatched_name: unmatchedNames.length,
    stale_or_invalid_odds: 0, player_out: 0, report_not_submitted: 0,
  };
  for (const u of unsupported) coverage[u.reason]++;
  for (const p of supportedPlayers) {
    if (evaluatedPlayers.has(p)) coverage.supported++;
    else coverage.stale_or_invalid_odds++;
  }
  return { rank, projections, unsupported, unmatchedNames, coverage, teamOf, rosterNames, observations, nameToPlayer, conditional };
}

export interface BoardRow {
  key: string;
  playerId: string;
  playerName: string;
  teamId: string;
  opponentId: string;
  stat: Stat;
  line: number;
  side: "over" | "under";
  book: string;
  decimal: number;
  american: number;
  sourceUpdatedAt: string;
  ev: number;
  pWinFinal: number;
  pWinRaw: number;
  pPush: number;
  breakEven: number;
  mean: number;
  expMinutes: number;
  flags: string[];
  matchedGames: number;
  matchedGameIds: string[];
  sensitivity: SensitivityResult;
  books: Record<string, string>;
}

export function boardRows(slate: SlateResult, SHRINK: number, evMin: number): BoardRow[] {
  return slate.rank.published.map((r) => {
    const pr = slate.projections.get(projKey(r.playerId, r.stat)) as Projection;
    const t = slate.teamOf.get(r.playerId)!;
    return {
      key: r.key,
      playerId: r.playerId,
      playerName: slate.rosterNames.get(r.playerId) ?? r.playerName,
      teamId: t.teamId,
      opponentId: t.opponentId,
      stat: r.stat,
      line: r.line,
      side: r.side,
      book: r.book,
      decimal: r.decimal,
      american: decimalToAmerican(r.decimal),
      sourceUpdatedAt: r.sourceUpdatedAt,
      ev: r.ev,
      pWinFinal: r.final.win,
      pWinRaw: r.raw.win,
      pPush: r.final.push,
      breakEven: breakEven(r.decimal),
      mean: pr.mean,
      expMinutes: pr.expMinutes,
      flags: pr.flags,
      matchedGames: pr.counts.matched,
      matchedGameIds: pr.matchedGameIds,
      sensitivity: sensitivity(pr, r.line, r.side, r.decimal, SHRINK, evMin),
      books: r.books,
    };
  });
}

export function emptyReason(slate: SlateResult, gameCount: number): string | null {
  if (slate.rank.published.length > 0) return null;
  if (gameCount === 0) return "The slate was empty.";
  if (slate.coverage.prop_market === 0) return "No player props were posted at the build time.";
  if (slate.coverage.prop_market === slate.coverage.unmatched_name) return "Player names could not be joined to rosters.";
  if (slate.coverage.supported === 0 && slate.coverage.stale_or_invalid_odds > 0) return "Every price for a supported player was stale or invalid.";
  if (slate.coverage.supported === 0) return "No supported player had a prop.";
  return "Nothing cleared the bar.";
}
