import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EASTERN, zonedToUtc } from "../time.ts";
import type { InjuryStatus } from "../types.ts";

// Official NBA injury report PDFs. The URL time format changed during 2025-26
// from "10AM" to "10_00AM"; both are tried.
const BASE = "https://ak-static.cms.nba.com/referee/injury/Injury-Report_";
const CACHE = "data/cache/injury";

export interface InjuryEntry {
  gameDate: string;
  matchup: string;
  team: string;
  /** "First Last", converted from the report's "Last, First". */
  playerName: string;
  status: InjuryStatus;
  reason: string;
}

export interface InjuryReport {
  url: string;
  /** Report time printed in the header, as UTC. This is the source time. */
  reportTimeUtc: string;
  entries: InjuryEntry[];
  notYetSubmitted: string[];
}

const COLS = { time: 110, matchup: 195, team: 260, player: 420, status: 580, reason: 660 } as const;
type Col = "date" | "time" | "matchup" | "team" | "player" | "status" | "reason";
const colOf = (x: number): Col =>
  x >= COLS.reason ? "reason" : x >= COLS.status ? "status" : x >= COLS.player ? "player" :
  x >= COLS.team ? "team" : x >= COLS.matchup ? "matchup" : x >= COLS.time ? "time" : "date";

const STATUSES: Record<string, InjuryStatus> = {
  out: "out", doubtful: "doubtful", questionable: "questionable", probable: "probable", available: "available",
};

export function flipName(s: string): string {
  const i = s.indexOf(",");
  return i < 0 ? s.trim() : `${s.slice(i + 1).trim()} ${s.slice(0, i).trim()}`;
}

interface Item { x: number; y: number; str: string; page: number }

/** Parses positioned text items from the PDF into entries. Exported for fixtures. */
export function parseItems(items: Item[]): { header: string | null; entries: InjuryEntry[]; notYetSubmitted: string[] } {
  let header: string | null = null;
  const body: Item[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    if (it.y > 520) { header = header ? `${header} ${it.str}` : it.str; continue; }
    if (it.y < 60 || it.y >= 475) continue; // footer and column titles
    body.push(it);
  }
  // Rows: top to bottom per page; tokens within 3pt of y share a row per column.
  body.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: { page: number; y: number; cells: Partial<Record<Col, string>> }[] = [];
  for (const it of body) {
    const col = colOf(it.x);
    let row = rows.find((r) => r.page === it.page && Math.abs(r.y - it.y) <= 3);
    if (!row) rows.push((row = { page: it.page, y: it.y, cells: {} }));
    row.cells[col] = row.cells[col] ? `${row.cells[col]} ${it.str}` : it.str;
  }
  rows.sort((a, b) => a.page - b.page || b.y - a.y);

  const entries: InjuryEntry[] = [];
  const at: { page: number; y: number }[] = [];
  const notYetSubmitted: string[] = [];
  const looseReasons: { page: number; y: number; text: string }[] = [];
  let gameDate = "", matchup = "", team = "";
  for (const r of rows) {
    if (r.cells.date && /\d{2}\/\d{2}\/\d{4}/.test(r.cells.date)) {
      const [m, d, y] = r.cells.date.match(/\d+/g)!.map(Number);
      gameDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    if (r.cells.matchup) matchup = r.cells.matchup.trim();
    if (r.cells.team) team = r.cells.team.trim();
    const status = r.cells.status ? STATUSES[r.cells.status.trim().toLowerCase()] : undefined;
    if (r.cells.player && status) {
      entries.push({ gameDate, matchup, team, playerName: flipName(r.cells.player), status, reason: (r.cells.reason ?? "").trim() });
      at.push({ page: r.page, y: r.y });
    } else if (r.cells.reason && /not yet submitted/i.test(r.cells.reason)) {
      notYetSubmitted.push(team);
    } else if (r.cells.reason) {
      looseReasons.push({ page: r.page, y: r.y, text: r.cells.reason.trim() });
    }
  }
  // Wrapped reason lines sit above and below their row; attach each to the nearest entry.
  for (const lr of looseReasons) {
    let best = -1;
    for (let i = 0; i < entries.length; i++) {
      if (at[i].page !== lr.page || Math.abs(at[i].y - lr.y) > 12) continue;
      if (best < 0 || Math.abs(at[i].y - lr.y) < Math.abs(at[best].y - lr.y)) best = i;
    }
    if (best >= 0) {
      const e = entries[best];
      e.reason = (lr.y > at[best].y ? `${lr.text} ${e.reason}` : `${e.reason} ${lr.text}`).trim();
    }
  }
  return { header, entries, notYetSubmitted };
}

async function pdfItems(data: Uint8Array): Promise<Item[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data, verbosity: 0 }).promise;
  const items: Item[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items as { str: string; transform: number[] }[])
      items.push({ x: it.transform[4], y: it.transform[5], str: it.str, page: p });
  }
  return items;
}

/** "Injury Report: 01/15/24 10:30 AM" → UTC. */
export function headerTimeUtc(header: string): string | null {
  const m = header.match(/(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  let h = Number(m[4]) % 12;
  if (m[6].toUpperCase() === "PM") h += 12;
  return zonedToUtc(`${year}-${m[1]}-${m[2]}`, `${String(h).padStart(2, "0")}:${m[5]}`, EASTERN);
}

function urlCandidates(etDate: string, h24: number, minute: number): string[] {
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = String(h24 % 12 === 0 ? 12 : h24 % 12).padStart(2, "0");
  const out = [`${BASE}${etDate}_${h12}_${String(minute).padStart(2, "0")}${ampm}.pdf`];
  if (minute === 0) out.push(`${BASE}${etDate}_${h12}${ampm}.pdf`);
  return out;
}

async function fetchPdf(url: string): Promise<Uint8Array | null> {
  const file = join(CACHE, url.slice(BASE.length));
  if (existsSync(file)) return new Uint8Array(readFileSync(file));
  if (existsSync(`${file}.missing`)) return null;
  mkdirSync(CACHE, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) {
    // Only remember misses for past dates; today's report may appear later.
    if (url.slice(BASE.length, BASE.length + 10) < new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))
      writeFileSync(`${file}.missing`, String(res.status));
    return null;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf;
}

export async function loadReport(url: string): Promise<InjuryReport | null> {
  const data = await fetchPdf(url);
  if (!data) return null;
  const { header, entries, notYetSubmitted } = parseItems(await pdfItems(data));
  const reportTimeUtc = header ? headerTimeUtc(header) : null;
  if (!reportTimeUtc) throw new Error(`no report time in ${url}`);
  return { url, reportTimeUtc, entries, notYetSubmitted };
}

/**
 * The latest report whose printed time is at least `bufferMinutes` before
 * the snapshot. Walks back in 15-minute steps from the snapshot, ET.
 */
export async function reportBefore(
  snapshotUtc: string,
  opts: { bufferMinutes?: number; earliestHourEt?: number } = {},
): Promise<InjuryReport | null> {
  const deadline = Date.parse(snapshotUtc) - (opts.bufferMinutes ?? 30) * 60000;
  const et = new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(deadline));
  const get = (t: string) => et.find((p) => p.type === t)!.value;
  const etDate = `${get("year")}-${get("month")}-${get("day")}`;
  let minutes = Number(get("hour")) * 60 + Math.floor(Number(get("minute")) / 15) * 15;
  const earliest = (opts.earliestHourEt ?? 0) * 60;
  for (; minutes >= earliest; minutes -= 15) {
    for (const url of urlCandidates(etDate, Math.floor(minutes / 60), minutes % 60)) {
      const rep = await loadReport(url);
      if (rep && Date.parse(rep.reportTimeUtc) <= deadline) return rep;
    }
  }
  return null;
}
