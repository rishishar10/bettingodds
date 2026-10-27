import type { BoardRow } from "../../lib/board.ts";
import { american, bookName, pacificTime, pct, STAT_NAMES, type NewsFile } from "../../lib/view.ts";
import { Age } from "./Age.tsx";

const FLAG_TEXT: Record<string, string> = {
  thin_sample: "thin sample",
  dispersion_from_base_pool: "spread from the wider pool",
  dispersion_thin: "spread from few games",
  dispersion_floor: "spread floored at Poisson",
  minutes_prior_season: "minutes from last season",
};
const SENS_TEXT: Record<string, string> = {
  minutes_minus: "3 fewer minutes",
  minutes_plus: "3 more minutes",
  variance_wide: "a 25% wider spread",
};
const BOOK_STATUS: Record<string, string> = {
  lower_price: "lower price",
  no_market: "no market",
  stale: "stale",
  no_source_time: "rejected, no source time",
  invalid_odds: "rejected, invalid odds",
};

const SOURCE: Record<string, string> = { official: "official report", espn: "ESPN" };

export function Slip({ row, teams, news }: { row: BoardRow; teams: Record<string, string>; news?: NewsFile["rows"][string] }) {
  const side = row.side === "over" ? "Over" : "Under";
  const others = Object.entries(row.books).filter(([, s]) => s !== "best");
  const failing = row.sensitivity.failing.map((f) => SENS_TEXT[f]);
  return (
    <li className={news?.length ? "slip stale" : "slip"}>
      <div>
        <p className="line">
          {side} {row.line} {STAT_NAMES[row.stat]}
        </p>
        <p className="who">
          {row.playerName} <span>{teams[row.teamId] ?? ""} vs {teams[row.opponentId] ?? ""}</span>
        </p>
      </div>
      <ul className="reasons">
        {news?.length ? (
          <li className="news">
            <b>News after publish.</b>{" "}
            {news.map((n) => `${n.kind === "player" ? "" : "Teammate "}${n.playerName} now ${n.to} (${SOURCE[n.source] ?? n.source}, ${pacificTime(n.sourceTime)})`).join("; ")}.
            {" "}This row was priced assuming {news.some((n) => n.kind === "player") ? "he plays" : "the morning lineup"}; it is not re-ranked.
          </li>
        ) : null}
        <li>
          <b>Edge.</b> Shrunk model probability {pct(row.pWinFinal)} (raw {pct(row.pWinRaw)}) against a{" "}
          {pct(row.breakEven)} break-even{row.pPush > 0 ? `, push ${pct(row.pPush)}` : ""}. Projected mean {row.mean.toFixed(1)} in{" "}
          {row.expMinutes.toFixed(0)} minutes from {row.matchedGames} matching games.
        </li>
        <li>
          <b>Risk.</b>{" "}
          {failing.length ? `Falls below the bar with ${failing.join(", ")}.` : "Stays above the bar on all three checks."}
          {row.sensitivity.zeroMinuteCase ? " Sensitive to a zero-minute night." : ""}{" "}
          {row.flags.map((f) => (
            <span className="flag" key={f}>{FLAG_TEXT[f] ?? f}</span>
          ))}
        </li>
        <li>
          <b>Market.</b> {bookName(row.book)} {american(row.american)}, priced {pacificTime(row.sourceUpdatedAt)},{" "}
          <Age iso={row.sourceUpdatedAt} />. {others.map(([b, s]) => `${bookName(b)}: ${BOOK_STATUS[s] ?? s}`).join(". ")}.
          {" "}This is model edge against one price, not a market edge.
        </li>
      </ul>
      <div className="ev">
        <strong>+{(row.ev * 100).toFixed(1)}%</strong>
        <span>EV per unit</span>
      </div>
    </li>
  );
}
