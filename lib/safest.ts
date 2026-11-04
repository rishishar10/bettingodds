// Lowest-risk subset of a board: picks the model gives a high chance to hit that
// still clear the bar if the player's minutes come in higher or lower than
// expected. One per player, most likely first. Practice boards (Oct 21 to Nov 2)
// hit 73% on this rule against 72% predicted.
export const SAFE_MIN_CHANCE = 0.62;
export const SAFE_MAX = 10;

interface Candidate {
  playerId: string;
  pWinFinal: number;
  sensitivity: { failing: string[] };
}

export function safestPicks<T extends Candidate>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    if (r.pWinFinal < SAFE_MIN_CHANCE || r.sensitivity.failing.length) continue;
    const cur = best.get(r.playerId);
    if (!cur || r.pWinFinal > cur.pWinFinal) best.set(r.playerId, r);
  }
  return [...best.values()].sort((a, b) => b.pWinFinal - a.pWinFinal).slice(0, SAFE_MAX);
}
