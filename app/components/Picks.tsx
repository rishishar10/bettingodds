"use client";
import { useState } from "react";
import type { BoardRow } from "../../lib/board.ts";
import { STAT_NAMES } from "../../lib/format.ts";
import type { NewsFile } from "../../lib/view.ts";
import { Slip } from "./Slip.tsx";

const FILTERS: [string, string][] = [["all", "All"], ["pts", "Points"], ["reb", "Rebounds"], ["ast", "Assists"]];

/** Tonight's rows with a stat filter. Rank stays the published order. */
export function Picks({ rows, teams, tips, news, emptyReason, title = "Tonight’s picks", update, collapsible = false }: {
  rows: BoardRow[];
  teams: Record<string, string>;
  tips: Record<string, string>;
  news?: NewsFile["rows"];
  emptyReason: string | null;
  title?: string;
  /** Marks rows on the injury-updated board. */
  update?: { added: string[]; asOf: string };
  collapsible?: boolean;
}) {
  const [stat, setStat] = useState("all");
  const shown = rows.filter((r) => stat === "all" || r.stat === stat);
  return (
    <>
      <div className="section-head">
        <h2>{title} <small>{shown.length} of {rows.length}</small></h2>
        <div className="pills small" role="group" aria-label="Stat">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" className="pill" aria-pressed={stat === k} onClick={() => setStat(k)}>{label}</button>
          ))}
        </div>
      </div>
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
          No picks. {stat === "all" ? emptyReason : `No ${STAT_NAMES[stat]} picks tonight.`} That doesn’t mean there’s no value out there,
          only that nothing we can project cleared the bar.
        </p>
      )}
    </>
  );
}
