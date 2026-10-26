const PACIFIC = "America/Los_Angeles";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(d: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

/** Pacific calendar date (YYYY-MM-DD) of a UTC instant. */
export function pacificDate(utc: string | Date): string {
  const p = parts(typeof utc === "string" ? new Date(utc) : utc);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** UTC ISO instant of a Pacific wall-clock time on a Pacific date; handles DST. */
export function pacificToUtc(date: string, hhmm: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Offset at the guess, then correct once (enough away from the 2am switch).
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(t));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    t += guess - asUtc;
  }
  return new Date(t).toISOString();
}

/** The board snapshot instant: 8:00am Pacific on the board date. */
export function boardInstant(boardDate: string): string {
  return pacificToUtc(boardDate, "08:00");
}

export function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T12:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** NBA season label for a Pacific date: seasons roll over on Aug 1. */
export function seasonOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 8 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function previousSeason(season: string): string {
  const start = Number(season.slice(0, 4)) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function minutesBetween(fromUtc: string, toUtc: string): number {
  return (Date.parse(toUtc) - Date.parse(fromUtc)) / 60000;
}
