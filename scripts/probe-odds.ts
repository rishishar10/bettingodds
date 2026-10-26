// Odds coverage sample. Weeks are inside the test season so the credits are
// reused by the full pull. Reports coverage only; never scores the model.
//   node scripts/probe-odds.ts [--plan]
import { writeFileSync } from "node:fs";
import { openHistory } from "../lib/history.ts";
import { matchEvents, slateRoster } from "../lib/slate-inputs.ts";
import { resolvePlayer } from "../lib/sources/crosswalk.ts";
import { fetchHistoricalEventOdds, listHistoricalEvents, usage, type RawPrice } from "../lib/sources/odds.ts";
import { addDays, boardInstant } from "../lib/time.ts";

const WEEKS = [
  { name: "early", from: "2025-10-28" },
  { name: "mid", from: "2026-01-12" },
  { name: "late", from: "2026-03-30" },
];
const plan = process.argv.includes("--plan");
const h = openHistory();
const closeAt = (tip: string) => new Date(Date.parse(tip) - 10 * 60000).toISOString();

interface Pair { morning: RawPrice; close: RawPrice | null; closeAny: boolean; bothSides: boolean; snapshotUtc: string }
const pairs: Pair[] = [];
const ages: number[] = [];
const lastUpdateVsSnapshot: number[] = [];
let credits = 0;
let integerLines = 0;
const disappeared: string[] = [];
const unmatched = new Set<string>();
let joinedNames = 0;
const recheck: { changedTime: number; sameTime: number; samePrice: number } = { changedTime: 0, sameTime: 0, samePrice: 0 };
let rechecked = 0;

for (const w of WEEKS) {
  for (let i = 0; i < 7; i++) {
    const date = addDays(w.from, i);
    const boardUtc = boardInstant(date);
    const games = h.gamesOn(date).filter((g) => g.completed && Date.parse(g.tipUtc) > Date.parse(boardUtc));
    if (!games.length) continue;
    if (plan) { credits += 1 + games.length * 60; continue; }
    const { matched } = matchEvents(games, await listHistoricalEvents(boardUtc));
    const roster = slateRoster(h, matched.map((x) => x.game), date);
    for (const { game, eventId } of matched) {
      const m = await fetchHistoricalEventOdds(eventId, boardUtc);
      const c = await fetchHistoricalEventOdds(eventId, closeAt(game.tipUtc));
      for (const name of new Set(m.prices.map((p) => p.playerName))) {
        const j = resolvePlayer(name, roster, [game.home.id, game.away.id]);
        if (j.ok) joinedNames++;
        else unmatched.add(`${date} ${game.away.abbr}@${game.home.abbr}: ${name} (${j.reason})`);
      }
      for (const p of m.prices) {
        if (Number.isInteger(p.line)) integerLines++;
        if (p.sourceUpdatedAt) {
          ages.push((Date.parse(boardUtc) - Date.parse(p.sourceUpdatedAt)) / 60000);
          lastUpdateVsSnapshot.push((Date.parse(m.snapshotUtc) - Date.parse(p.sourceUpdatedAt)) / 60000);
        }
        const same = (q: RawPrice) => q.book === p.book && q.playerName === p.playerName && q.stat === p.stat;
        const close = c.prices.find((q) => same(q) && q.side === p.side && q.line === p.line) ?? null;
        const closeAny = c.prices.some((q) => same(q) && q.side === p.side);
        const bothSides = m.prices.some((q) => same(q) && q.line === p.line && q.side !== p.side);
        if (!closeAny) disappeared.push(`${date} ${p.book} ${p.playerName} ${p.stat} ${p.line} ${p.side}`);
        pairs.push({ morning: p, close, closeAny, bothSides, snapshotUtc: m.snapshotUtc });
      }
      // last_update semantics: one event per day, 5 minutes later (30 credits).
      if (rechecked < 7 && eventId === matched[0].eventId) {
        rechecked++;
        const later = await fetchHistoricalEventOdds(eventId, new Date(Date.parse(boardUtc) + 5 * 60000).toISOString());
        for (const p of m.prices) {
          const q = later.prices.find((x) => x.book === p.book && x.playerName === p.playerName && x.stat === p.stat && x.side === p.side && x.line === p.line);
          if (!q || q.decimal !== p.decimal) continue;
          recheck.samePrice++;
          if (q.sourceUpdatedAt !== p.sourceUpdatedAt) recheck.changedTime++;
          else recheck.sameTime++;
        }
      }
    }
    console.log(`${date}: ${pairs.length} morning prices so far, remaining ${usage().remaining ?? "?"}`);
  }
}
if (plan) {
  console.log(`probe needs about ${credits} credits plus ~210 for the last_update recheck`);
  process.exit(0);
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const share = (f: (p: Pair) => boolean, rows = pairs) => rows.length ? `${(100 * rows.filter(f).length / rows.length).toFixed(1)}%` : "n/a";
const groups: Record<string, Pair[]> = {};
for (const p of pairs) (groups[`${p.morning.book} ${p.morning.stat}`] ??= []).push(p);

const md = `# Odds coverage sample

Weeks: ${WEEKS.map((w) => `${w.name} from ${w.from}`).join(", ")}. Morning = 8:00am Pacific; close = tip minus 10 minutes.

Morning prices: ${pairs.length}. Integer lines: ${integerLines}. Lines with no close at any line for that book/side: ${disappeared.length}.

| Book / stat | Prices | Same-line close | Any close | Both sides at morning |
|---|---|---|---|---|
${Object.entries(groups).sort().map(([k, rs]) => `| ${k} | ${rs.length} | ${share((p) => !!p.close, rs)} | ${share((p) => p.closeAny, rs)} | ${share((p) => p.bothSides, rs)} |`).join("\n")}
| **all** | ${pairs.length} | ${share((p) => !!p.close)} | ${share((p) => p.closeAny)} | ${share((p) => p.bothSides)} |

Player names joined to that date's two rosters: ${joinedNames}; unmatched or ambiguous: ${unmatched.size}.
${[...unmatched].slice(0, 30).map((u) => `- ${u}`).join("\n")}

## What \`last_update\` means

Age at the board time (minutes): p10 ${q(ages, 0.1)?.toFixed(1)}, p50 ${q(ages, 0.5)?.toFixed(1)}, p90 ${q(ages, 0.9)?.toFixed(1)}, p99 ${q(ages, 0.99)?.toFixed(1)}.
Snapshot time minus last_update (minutes): p50 ${q(lastUpdateVsSnapshot, 0.5)?.toFixed(1)}, p90 ${q(lastUpdateVsSnapshot, 0.9)?.toFixed(1)}.

Unchanged prices 5 minutes later: ${recheck.samePrice}; last_update moved on ${recheck.changedTime}, stayed on ${recheck.sameTime}.
${recheck.changedTime > recheck.sameTime ? "→ last_update behaves like a check/retrieval time." : "→ last_update behaves like a change time: a stable price looks old."}

## Decision (fill in, then hash)

- ODDS_MAX_AGE_MINUTES = ___ because ___
- Proceed with the full pull: yes / no

Sample of disappeared lines:
${disappeared.slice(0, 15).map((d) => `- ${d}`).join("\n")}
`;
writeFileSync("reports/odds-coverage.md", md);
console.log(md);
h.close();
