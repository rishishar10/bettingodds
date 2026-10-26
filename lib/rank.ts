import { breakEven, expectedValue, validatePrice, type OddsRejection } from "./ev.ts";
import type { Book, OutcomeProbs, Side, Stat } from "./types.ts";

/** One book's price on one side of one line, as fetched. */
export interface PriceObs {
  eventId: string;
  playerId: string;
  playerName: string;
  stat: Stat;
  line: number;
  side: Side;
  book: Book;
  decimal: number;
  sourceUpdatedAt: string | null;
}

export interface ModelProbs {
  raw: OutcomeProbs;
  final: OutcomeProbs;
}

export type BookStatus = "best" | "lower_price" | "no_market" | OddsRejection;

export interface EvaluatedRow {
  key: string;
  eventId: string;
  playerId: string;
  playerName: string;
  stat: Stat;
  line: number;
  side: Side;
  book: Book;
  decimal: number;
  sourceUpdatedAt: string;
  raw: OutcomeProbs;
  final: OutcomeProbs;
  ev: number;
  books: Record<Book, BookStatus>;
  state: "published" | "below_bar" | "quarantined" | "superseded";
}

export interface Anomaly {
  eventId: string;
  playerId: string;
  stat: Stat;
  line: number;
  sides: {
    side: Side;
    book: Book;
    decimal: number;
    breakEven: number;
    raw: OutcomeProbs;
    final: OutcomeProbs;
    ev: number;
    sourceUpdatedAt: string;
  }[];
  cause: "freshness" | "join" | "pricing" | "unexplained";
}

export interface RankInput {
  observations: PriceObs[];
  books: readonly Book[];
  probsFor: (o: { playerId: string; stat: Stat; line: number; side: Side }) => ModelProbs | null;
  buildTimeUtc: string;
  maxAgeMinutes: number;
  evMin: number;
}

export interface RankResult {
  published: EvaluatedRow[];
  evaluated: EvaluatedRow[];
  anomalies: Anomaly[];
  rejections: { obs: PriceObs; reason: OddsRejection }[];
}

export const marketKey = (o: { eventId: string; playerId: string; stat: Stat; line: number; side: Side }) =>
  `${o.eventId}|${o.playerId}|${o.stat}|${o.line}|${o.side}`;

const lineKey = (o: { eventId: string; playerId: string; stat: Stat; line: number }) =>
  `${o.eventId}|${o.playerId}|${o.stat}|${o.line}`;

const exposureKey = (o: { eventId: string; playerId: string; stat: Stat; side: Side }) =>
  `${o.eventId}|${o.playerId}|${o.stat}|${o.side}`;

function anomalyCause(over: EvaluatedRow, under: EvaluatedRow, maxAgeMinutes: number): Anomaly["cause"] {
  if (1 / over.decimal + 1 / under.decimal < 1) return "pricing";
  const gap = Math.abs(Date.parse(over.sourceUpdatedAt) - Date.parse(under.sourceUpdatedAt)) / 60000;
  if (over.book !== under.book && gap > maxAgeMinutes / 2) return "freshness";
  if (over.playerName !== under.playerName) return "join";
  return "unexplained";
}

/** Rank once: exact key, best price, quarantine, one row per exposure, sort. */
export function rankBoard(input: RankInput): RankResult {
  const rejections: RankResult["rejections"] = [];
  const byKey = new Map<string, { valid: PriceObs[]; status: Partial<Record<Book, BookStatus>> }>();

  for (const o of input.observations) {
    const k = marketKey(o);
    let entry = byKey.get(k);
    if (!entry) byKey.set(k, (entry = { valid: [], status: {} }));
    const reason = validatePrice(o.decimal, o.sourceUpdatedAt, input.buildTimeUtc, input.maxAgeMinutes);
    if (reason) {
      rejections.push({ obs: o, reason });
      entry.status[o.book] = reason;
    } else {
      entry.valid.push(o);
    }
  }

  const evaluated: EvaluatedRow[] = [];
  for (const [key, { valid, status }] of byKey) {
    if (valid.length === 0) continue;
    const best = [...valid].sort((a, b) => b.decimal - a.decimal || a.book.localeCompare(b.book))[0];
    const probs = input.probsFor(best);
    if (!probs) continue;
    const books = {} as Record<Book, BookStatus>;
    for (const b of input.books) books[b] = status[b] ?? "no_market";
    for (const v of valid) books[v.book] = v === best ? "best" : "lower_price";
    const ev = expectedValue(probs.final, best.decimal);
    evaluated.push({
      key,
      eventId: best.eventId,
      playerId: best.playerId,
      playerName: best.playerName,
      stat: best.stat,
      line: best.line,
      side: best.side,
      book: best.book,
      decimal: best.decimal,
      sourceUpdatedAt: best.sourceUpdatedAt as string,
      raw: probs.raw,
      final: probs.final,
      ev,
      books,
      state: ev >= input.evMin ? "published" : "below_bar",
    });
  }

  // Two-sided qualification anomaly: both sides of one line clear the bar.
  const anomalies: Anomaly[] = [];
  const byLine = new Map<string, EvaluatedRow[]>();
  for (const r of evaluated) {
    const k = lineKey(r);
    byLine.set(k, [...(byLine.get(k) ?? []), r]);
  }
  for (const rows of byLine.values()) {
    const over = rows.find((r) => r.side === "over");
    const under = rows.find((r) => r.side === "under");
    if (over && under && over.ev >= input.evMin && under.ev >= input.evMin) {
      over.state = "quarantined";
      under.state = "quarantined";
      anomalies.push({
        eventId: over.eventId,
        playerId: over.playerId,
        stat: over.stat,
        line: over.line,
        sides: [over, under].map((r) => ({
          side: r.side,
          book: r.book,
          decimal: r.decimal,
          breakEven: breakEven(r.decimal),
          raw: r.raw,
          final: r.final,
          ev: r.ev,
          sourceUpdatedAt: r.sourceUpdatedAt,
        })),
        cause: anomalyCause(over, under, input.maxAgeMinutes),
      });
    }
  }

  // One published row per (event, player, stat, side): keep the highest EV.
  const bestExposure = new Map<string, EvaluatedRow>();
  for (const r of evaluated) {
    if (r.state !== "published") continue;
    const k = exposureKey(r);
    const cur = bestExposure.get(k);
    if (!cur || r.ev > cur.ev || (r.ev === cur.ev && r.key < cur.key)) bestExposure.set(k, r);
  }
  for (const r of evaluated) {
    if (r.state === "published" && bestExposure.get(exposureKey(r)) !== r) r.state = "superseded";
  }

  const published = evaluated
    .filter((r) => r.state === "published")
    .sort((a, b) => b.ev - a.ev || a.key.localeCompare(b.key));
  return { published, evaluated, anomalies, rejections };
}
