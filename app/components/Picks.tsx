"use client";
import { useState } from "react";
import type { BoardRow } from "../../lib/board.ts";
import { STAT_NAMES } from "../../lib/format.ts";
import type { NewsFile } from "../../lib/view.ts";
import { Slip } from "./Slip.tsx";
import { safestPicks, SAFE_MIN_CHANCE } from "../../lib/safest.ts";

const FILTERS: [string, string][] = [["all", "All"], ["pts", "Points"], ["reb", "Rebounds"], ["ast", "Assists"]];

/** Tonight's rows with a stat filter and a lowest-risk tab. Rank stays the published order. */
export function Picks({ rows, teams, tips, news, emptyReason, title = "Tonight’s picks", update, collapsible = false, safeTab = false }: {
  rows: BoardRow[];
  teams: Record<string, string>;
  tips: Record<string, string>;
  news?: NewsFile["rows"];
  emptyReason: string | null;
  title?: string;
  /** Marks rows on the injury-updated board. */
  update?: { added: string[]; asOf: string };
  collapsible?: boolean;
  /** Adds the lowest-risk tab (most likely first). */
  safeTab?: boolean;
}) {
  const [stat, setStat] = useState("all");
  const filters: [string, string][] = safeTab ? [FILTERS[0], ["safe", "Lowest risk"], ...FILTERS.slice(1)] : FILTERS;
  const shown = stat === "safe" ? safestPicks(rows) : rows.filter((r) => stat === "all" || r.stat === stat);
  return (
    <>
      <div className="section-head">
        <h2>{title} <small>{shown.length} of {rows.length}</small></h2>
        <div className="pills small" role="group" aria-label="Stat">
          {filters.map(([k, label]) => (
            <button key={k} type="button" className="pill" aria-pressed={stat === k} onClick={() => setStat(k)}>{label}</button>
          ))}
        </div>
      </div>
      {stat === "safe" && (
        <p className="fine">
          The picks most likely to hit, most likely first: at least a {Math.round(SAFE_MIN_CHANCE * 100)}% chance in our model, still worth
          it if the player plays more or fewer minutes than expected, one per player. Safer means a higher hit rate, not a sure thing, and
          these usually pay less per win.
        </p>
      )}
      {shown.length ? (
        <ol className="slips">
          {shown.map((r) => (
            <Slip
              key={r.key}
              row={r}
              rank={rows.indexOf(r) + 1}
              teams={teams}
              tipUtc={tips[r.teamId]}
              news={news?.[r.key]}
              update={update ? { isNew: update.added.includes(r.key), asOf: update.asOf } : undefined}
              collapsible={collapsible}
            />
          ))}
        </ol>
      ) : (
        <p className="empty">
          No picks. {stat === "all" ? emptyReason : stat === "safe" ? `Nothing tonight has at least a ${Math.round(SAFE_MIN_CHANCE * 100)}% chance and holds up if minutes change.` : `No ${STAT_NAMES[stat]} picks tonight.`} That doesn’t mean there’s no value out there,
          only that nothing we can project cleared the bar.
        </p>
      )}
    </>
  );
}
