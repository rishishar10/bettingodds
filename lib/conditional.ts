/** If-they-sit card resolution. Conditional cards never look like morning-board rows. */

export type ConditionalState = "confirmed_active" | "expired" | "still_clearing" | "moved_past_bar" | "pulled";

export interface ConditionalPrice {
  decimal: number;
  ev: number;
  sourceUpdatedAt: string;
  fetchedAt: string;
}

export interface ConditionalResolution {
  state: ConditionalState;
  /** The grade price: first observation whose source time is after the status change. */
  price: ConditionalPrice | null;
  graded: boolean;
}

export function resolveConditional(
  finalStatus: "out" | "active" | null,
  statusChangedAt: string | null,
  prices: ConditionalPrice[],
  evMin: number,
): ConditionalResolution {
  if (finalStatus === "active") return { state: "confirmed_active", price: null, graded: false };
  if (finalStatus === null || !statusChangedAt) return { state: "expired", price: null, graded: false };
  const changed = Date.parse(statusChangedAt);
  // Source time must be after the news; being fetched after it is not enough.
  const after = prices
    .filter((p) => Date.parse(p.sourceUpdatedAt) > changed)
    .sort((a, b) => Date.parse(a.sourceUpdatedAt) - Date.parse(b.sourceUpdatedAt));
  if (after.length === 0) return { state: "pulled", price: null, graded: false };
  const first = after[0];
  return first.ev >= evMin
    ? { state: "still_clearing", price: first, graded: true }
    : { state: "moved_past_bar", price: first, graded: false };
}

export interface ConditionalCounts {
  initiallyQualifying: number;
  confirmedOut: number;
  confirmedActive: number;
  expired: number;
  postNewsPriceObserved: number;
  stillClearing: number;
  movedPastBar: number;
  pulled: number;
  /** still clearing / initially qualifying among confirmed-out scenarios; a missing price stays in the denominator. */
  survival: number | null;
}

export function countConditional(states: ConditionalState[]): ConditionalCounts {
  const n = (s: ConditionalState) => states.filter((x) => x === s).length;
  const stillClearing = n("still_clearing");
  const movedPastBar = n("moved_past_bar");
  const pulled = n("pulled");
  const confirmedOut = stillClearing + movedPastBar + pulled;
  return {
    initiallyQualifying: states.length,
    confirmedOut,
    confirmedActive: n("confirmed_active"),
    expired: n("expired"),
    postNewsPriceObserved: stillClearing + movedPastBar,
    stillClearing,
    movedPastBar,
    pulled,
    survival: confirmedOut > 0 ? stillClearing / confirmedOut : null,
  };
}
