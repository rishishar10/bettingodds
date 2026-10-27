import { shrink } from "./ev.ts";
import type { ReplayRow } from "./gate.ts";
import { gradeProp } from "./grade.ts";
import { dispersionFor, predictive } from "./dispersion.ts";
import { sideProbs } from "./negbin.ts";
import { rankBoard, type PriceObs } from "./rank.ts";
import { resultFor, type ReplayDay } from "./replay-data.ts";
import { BOOKS } from "./types.ts";

const sameBookLine = (o: PriceObs, p: PriceObs) =>
  o.eventId === p.eventId && o.playerId === p.playerId && o.stat === p.stat && o.book === p.book;

/**
 * Same book, same side. The same line if still posted; otherwise the book's
 * main closing line: both sides posted, no-vig over closest to 50%. With no
 * two-sided line the close is missing rather than a stray alternate.
 */
export function closingLine(day: ReplayDay, r: PriceObs): PriceObs | undefined {
  const book = day.closes.filter((c) => sameBookLine(c, r));
  const same = book.find((c) => c.line === r.line && c.side === r.side);
  if (same) return same;
  let best: { obs: PriceObs; gap: number } | undefined;
  for (const c of book) {
    if (c.side !== r.side) continue;
    const other = book.find((o) => o.line === c.line && o.side !== c.side);
    if (!other) continue;
    const over = c.side === "over" ? c : other;
    const under = c.side === "over" ? other : c;
    const gap = Math.abs((1 / over.decimal) / (1 / over.decimal + 1 / under.decimal) - 0.5);
    if (!best || gap < best.gap) best = { obs: c, gap };
  }
  return best?.obs;
}

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
      const raw = sideProbs(predictive(pr, dispersionFor(stat)), line, side);
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
    const close = closingLine(day, r as unknown as PriceObs);
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
