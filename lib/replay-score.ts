import { shrink } from "./ev.ts";
import type { ReplayRow } from "./gate.ts";
import { gradeProp } from "./grade.ts";
import { countDist, sideProbs } from "./negbin.ts";
import { rankBoard, type PriceObs } from "./rank.ts";
import { resultFor, type ReplayDay } from "./replay-data.ts";
import { BOOKS } from "./types.ts";

const sameBookLine = (o: PriceObs, p: PriceObs) =>
  o.eventId === p.eventId && o.playerId === p.playerId && o.stat === p.stat && o.book === p.book;

/**
 * Re-ranks one frozen day with a given SHRINK and threshold and returns
 * every evaluated row with its outcome and same-book close.
 */
export function scoreDay(day: ReplayDay, SHRINK: number, evMin: number, maxAgeMinutes: number): ReplayRow[] {
  const rank = rankBoard({
    observations: day.observations,
    books: BOOKS,
    probsFor: ({ playerId, stat, line, side }) => {
      const pr = day.projections[`${playerId}|${stat}`];
      if (!pr) return null;
      const raw = sideProbs(countDist(pr.mean, pr.variance), line, side);
      return { raw, final: shrink(raw, SHRINK) };
    },
    buildTimeUtc: day.boardUtc,
    maxAgeMinutes,
    evMin,
  });

  const rows: ReplayRow[] = [];
  for (const r of rank.evaluated) {
    if (r.state === "quarantined") continue;
    const res = resultFor(day, r.playerId, r.stat);
    if (!res) continue; // player missing from the box score: cannot grade
    const opposing = day.observations.find(
      (o) => sameBookLine(o, r as unknown as PriceObs) && o.line === r.line && o.side !== r.side,
    );
    // Close: same book and side; same line if posted, else the nearest line.
    const closes = day.closes.filter((c) => sameBookLine(c, r as unknown as PriceObs) && c.side === r.side);
    const close = closes.find((c) => c.line === r.line) ??
      [...closes].sort((a, b) => Math.abs(a.line - r.line) - Math.abs(b.line - r.line))[0];
    const closeOpp = close
      ? day.closes.find((c) => sameBookLine(c, close) && c.line === close.line && c.side !== close.side)
      : undefined;
    const t = day.teamOf[r.playerId];
    rows.push({
      boardDate: day.boardDate,
      gameId: t.gameId,
      playerId: r.playerId,
      teamId: t.teamId,
      stat: r.stat,
      line: r.line,
      side: r.side,
      book: r.book,
      decimal: r.decimal,
      opposingDecimal: opposing?.decimal ?? null,
      pRawConditional: r.raw.win / (r.raw.win + r.raw.loss),
      final: r.final,
      ev: r.ev,
      selected: r.state === "published",
      result: gradeProp(r.line, r.side, res.minutes, res.actual),
      close: close ? { line: close.line, decimal: close.decimal, opposingDecimal: closeOpp?.decimal ?? null } : null,
    });
  }
  return rows;
}
