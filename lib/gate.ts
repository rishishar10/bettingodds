import { clvNoVig, clvRatio, lineDirection } from "./clv.ts";
import { noVigOver } from "./ev.ts";
import { profit, type Result } from "./grade.ts";
import { clusterBootstrap, fitBlendWeight, logLoss, mean, widerInterval, type Interval } from "./stats.ts";
import type { OutcomeProbs, Side, Stat } from "./types.ts";

/** One evaluated prop in a replay, at the morning snapshot. */
export interface ReplayRow {
  boardDate: string;
  gameId: string;
  playerId: string;
  teamId: string;
  stat: Stat;
  line: number;
  side: Side;
  book: string;
  decimal: number;
  /** Same book, same line, other side, at the morning snapshot. */
  opposingDecimal: number | null;
  /** Raw model conditional win probability for this side. */
  pRawConditional: number;
  final: OutcomeProbs;
  ev: number;
  /** Published at the policy threshold after quarantine and dedupe. */
  selected: boolean;
  result: Result;
  /** Same book, same side; the line may differ. */
  close: { line: number; decimal: number; opposingDecimal: number | null } | null;
}

export interface GateReport {
  halfPointRows: number;
  excludedFromLogLoss: number;
  modelLogLoss: number;
  marketLogLoss: number;
  deltaLL: Interval;
  w: Interval;
  selectedRows: number;
  sameLineCloseRows: number;
  sameLineShare: number;
  clv: Interval;
  clvNoVig: Interval | null;
  lineMoves: { toward: number; away: number; towardShare: Interval | null };
  roi: Interval;
  concentration: {
    uniquePlayers: number;
    uniqueTeams: number;
    uniqueGames: number;
    clvGames: number;
    gamesWithMany: number;
    byMonth: Record<string, number>;
    byStat: Record<string, number>;
  };
  pass: { wAboveZero: boolean; clvAboveZero: boolean; enoughGames: boolean; demonstratedEdge: boolean };
}

const bothClusters = <T extends { gameId: string; playerId: string }>(
  rows: T[],
  f: (rs: T[]) => number,
  reps: number,
): Interval =>
  widerInterval(
    clusterBootstrap(rows, (r) => r.gameId, f, { reps }),
    clusterBootstrap(rows, (r) => r.playerId, f, { reps, seed: 7 }),
  );

export function evaluateGate(rows: ReplayRow[], opts: { minClvGames: number; reps?: number }): GateReport {
  const reps = opts.reps ?? 2000;

  // Log-loss set: half-point lines, both sides present, decisive, counted once (over side).
  const overs = rows.filter((r) => r.side === "over" && !Number.isInteger(r.line) && r.result !== "void");
  const ll = overs.filter((r) => r.opposingDecimal !== null && (r.result === "win" || r.result === "loss"));
  const excludedFromLogLoss = overs.length - ll.length;
  const llRows = ll.map((r) => ({
    gameId: r.gameId,
    playerId: r.playerId,
    pModel: r.final.win / (r.final.win + r.final.loss),
    pRaw: r.pRawConditional,
    pMarket: noVigOver(r.decimal, r.opposingDecimal as number),
    y: (r.result === "win" ? 1 : 0) as 0 | 1,
  }));
  const dll = (rs: typeof llRows) =>
    logLoss(rs.map((r) => r.pModel), rs.map((r) => r.y)) - logLoss(rs.map((r) => r.pMarket), rs.map((r) => r.y));
  const wFit = (rs: typeof llRows) =>
    fitBlendWeight(rs.map((r) => ({ pModel: r.pRaw, pMarket: r.pMarket, won: r.y })));

  const selected = rows.filter((r) => r.selected);
  const sameLine = selected.filter((r) => r.close && r.close.line === r.line);
  const clvRows = sameLine.map((r) => ({ ...r, clv: clvRatio(r.decimal, (r.close as { decimal: number }).decimal) }));
  const noVigRows = sameLine
    .filter((r) => r.close?.opposingDecimal)
    .map((r) => {
      const c = r.close as { decimal: number; opposingDecimal: number };
      const pOver = noVigOver(c.decimal, c.opposingDecimal);
      return { ...r, clv: clvNoVig(r.decimal, pOver) };
    });
  const moved = selected
    .filter((r) => r.close && r.close.line !== r.line)
    .map((r) => ({ ...r, toward: lineDirection(r.side, r.line, (r.close as { line: number }).line) === "toward" ? 1 : 0 }));
  const settled = selected
    .filter((r) => r.result !== "void")
    .map((r) => ({ ...r, pnl: profit(r.result, r.decimal) }));

  const clvMean = (rs: { clv: number }[]) => mean(rs.map((r) => r.clv));
  const clv = bothClusters(clvRows, clvMean, reps);
  const clvGames = new Set(clvRows.map((r) => r.gameId)).size;

  const w = bothClusters(llRows, wFit, Math.min(reps, 500));
  const deltaLL = bothClusters(llRows, dll, reps);

  const perGame = new Map<string, number>();
  for (const r of selected) perGame.set(r.gameId, (perGame.get(r.gameId) ?? 0) + 1);
  const tally = (f: (r: ReplayRow) => string) => {
    const o: Record<string, number> = {};
    for (const r of selected) o[f(r)] = (o[f(r)] ?? 0) + 1;
    return o;
  };

  const pass = {
    wAboveZero: w.lo > 0,
    clvAboveZero: clv.lo > 0,
    enoughGames: clvGames >= opts.minClvGames,
    demonstratedEdge: false,
  };
  pass.demonstratedEdge = pass.wAboveZero && pass.clvAboveZero && pass.enoughGames;

  return {
    halfPointRows: llRows.length,
    excludedFromLogLoss,
    modelLogLoss: logLoss(llRows.map((r) => r.pModel), llRows.map((r) => r.y)),
    marketLogLoss: logLoss(llRows.map((r) => r.pMarket), llRows.map((r) => r.y)),
    deltaLL,
    w,
    selectedRows: selected.length,
    sameLineCloseRows: clvRows.length,
    sameLineShare: selected.length ? clvRows.length / selected.length : 0,
    clv,
    clvNoVig: noVigRows.length ? bothClusters(noVigRows, clvMean, reps) : null,
    lineMoves: {
      toward: moved.filter((r) => r.toward).length,
      away: moved.filter((r) => !r.toward).length,
      towardShare: moved.length ? bothClusters(moved, (rs) => mean(rs.map((r) => r.toward)), reps) : null,
    },
    roi: bothClusters(settled, (rs) => mean(rs.map((r) => r.pnl)), reps),
    concentration: {
      uniquePlayers: new Set(selected.map((r) => r.playerId)).size,
      uniqueTeams: new Set(selected.map((r) => r.teamId)).size,
      uniqueGames: perGame.size,
      clvGames,
      gamesWithMany: [...perGame.values()].filter((n) => n >= 3).length,
      byMonth: tally((r) => r.boardDate.slice(0, 7)),
      byStat: tally((r) => r.stat),
    },
    pass,
  };
}
