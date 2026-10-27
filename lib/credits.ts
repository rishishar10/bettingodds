import { FREE_PLAN } from "./constants.ts";

/**
 * Free-plan pacing: keep the biggest slates the remaining credits can cover
 * through the end of the credit cycle, and build tonight only if tonight is
 * one of them. Slates under MIN_SLATE_GAMES are never built. Ties go to the
 * earlier date, so tonight wins a tie.
 */
export function shouldBuildTonight(
  tonightGames: number,
  upcomingGames: number[],
  remainingCredits: number,
  perGame: number = FREE_PLAN.CREDITS_PER_GAME,
  minGames: number = FREE_PLAN.MIN_SLATE_GAMES,
): { build: boolean; reason: string } {
  if (tonightGames < minGames)
    return { build: false, reason: `Light slate (${tonightGames} game${tonightGames === 1 ? "" : "s"}) skipped to save free-plan odds credits.` };
  const slates = [tonightGames, ...upcomingGames]
    .map((n, i) => ({ n, i }))
    .filter((s) => s.n >= minGames)
    .sort((a, b) => b.n - a.n || a.i - b.i);
  let left = remainingCredits;
  const chosen = new Set<number>();
  for (const s of slates) {
    if (s.n * perGame <= left) {
      left -= s.n * perGame;
      chosen.add(s.i);
    }
  }
  if (chosen.has(0)) return { build: true, reason: "" };
  return {
    build: false,
    reason: `Skipped to save free-plan odds credits for bigger slates before they reset (${remainingCredits} left, ${chosen.size} bigger slates still to cover).`,
  };
}

/** Dates from tomorrow up to the day before the next reset, YYYY-MM-DD. */
export function datesUntilReset(today: string, resetDay: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const reset = d < resetDay ? new Date(Date.UTC(y, m - 1, resetDay)) : new Date(Date.UTC(y, m, resetDay));
  const out: string[] = [];
  for (let t = Date.UTC(y, m - 1, d + 1); t < reset.getTime(); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
