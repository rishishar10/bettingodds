const BOOK_NAMES: Record<string, string> = { draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM" };
export const bookName = (b: string) => BOOK_NAMES[b] ?? b;
export const STAT_NAMES: Record<string, string> = { pts: "points", reb: "rebounds", ast: "assists" };
export const american = (a: number) => (a > 0 ? `+${a}` : String(a));
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export function pacificTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
}

export function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
