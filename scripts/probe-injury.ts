// Usage: node scripts/probe-injury.ts 2024-01-15 [2025-11-15 ...]
import { reportBefore } from "../lib/sources/injuries.ts";
import { boardInstant } from "../lib/time.ts";

for (const d of process.argv.slice(2)) {
  const rep = await reportBefore(boardInstant(d), { earliestHourEt: 6 });
  if (!rep) { console.log(`${d}: no report before the snapshot`); continue; }
  const by: Record<string, number> = {};
  for (const e of rep.entries) by[e.status] = (by[e.status] ?? 0) + 1;
  console.log(`${d}: ${rep.url.split("_").slice(1).join("_")} at ${rep.reportTimeUtc}, ${rep.entries.length} entries`, by, `not submitted: ${rep.notYetSubmitted.length}`);
  console.log("  e.g.", rep.entries.slice(0, 3).map((e) => `${e.team} | ${e.playerName} | ${e.status}`).join("; "));
}
