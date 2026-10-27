"use client";
import { useState } from "react";
import type { BoardRow } from "../../lib/board.ts";
import { american, bookName, pacificTime, pct, STAT_NAMES } from "../../lib/format.ts";
import type { NewsFile } from "../../lib/view.ts";
import { Age } from "./Age.tsx";
import { Headshot } from "./Headshot.tsx";

const FLAG_TEXT: Record<string, string> = {
  thin_sample: "Small sample",
  dispersion_from_base_pool: "Variability estimated from all his games",
  dispersion_thin: "Variability from few games",
  dispersion_floor: "Minimum variability assumed",
  minutes_prior_season: "Minutes based on last season",
};
const SENS_TEXT: Record<string, string> = {
  minutes_minus: "plays 3 fewer minutes",
  minutes_plus: "plays 3 more minutes",
  variance_wide: "has a more unpredictable night than usual",
};
const BOOK_STATUS: Record<string, string> = {
  lower_price: "worse price",
  no_market: "doesn’t offer this line",
  stale: "price is out of date",
  no_source_time: "skipped, no timestamp",
  invalid_odds: "skipped, bad odds data",
};
const SOURCE: Record<string, string> = { official: "official report", espn: "ESPN" };

export function Slip({ row, rank, teams, tipUtc, news, update, collapsible = false }: {
  row: BoardRow;
  rank: number;
  teams: Record<string, string>;
  tipUtc?: string;
  news?: NewsFile["rows"][string];
  /** Set on rows of the injury-updated board. */
  update?: { isNew: boolean; asOf: string };
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const stale = Boolean(news?.length);
  const others = Object.entries(row.books).filter(([, s]) => s !== "best");
  const failing = row.sensitivity.failing.map((f) => SENS_TEXT[f] ?? f);
  const edge = Math.max(0, row.pWinFinal - row.breakEven);
  const cls = ["slip", stale ? "stale" : rank === 1 ? "top" : ""].filter(Boolean).join(" ");

  return (
    <li className={cls}>
      {update && (
        <div className="slip-update">
          <span>
            <b>{update.isNew ? "New since 8am." : "Still qualifies."}</b> Re-projected with the injury news as of {pacificTime(update.asOf)}, at the 8:00am price.
            {" "}That price has likely moved since the news; check it before acting.
          </span>
        </div>
      )}
      {stale && (
        <div className="slip-news">
          <WarnIcon />
          <span>
            <b>Injury update since we published.</b>{" "}
            {news!.map((n) => `${n.kind === "player" ? "" : "Teammate "}${n.playerName} is now ${n.to} (${SOURCE[n.source] ?? n.source}, ${pacificTime(n.sourceTime)})`).join("; ")}.
            {" "}This pick assumed {news!.some((n) => n.kind === "player") ? "he plays" : "the morning lineup"} and hasn’t been updated, so treat it with caution.
          </span>
        </div>
      )}

      <div className="slip-main">
        <div className="slip-photo dimmable">
          <span className="rank">{String(rank).padStart(2, "0")}</span>
          <Headshot playerId={row.playerId} name={row.playerName} size={120} tile />
        </div>

        <div className="slip-what dimmable">
          <div className="matchup">
            <span className="team">{teams[row.teamId] ?? row.teamId}</span>
            <span>vs</span>
            <span className="opp">{teams[row.opponentId] ?? row.opponentId}</span>
            {tipUtc && <span>· Tip {pacificTime(tipUtc)}</span>}
          </div>
          <p className="line">
            <span className={row.side === "over" ? "side" : "side under"}>{row.side === "over" ? "Over" : "Under"}</span>
            <span className="num">{row.line}</span>
            <span className="stat">{STAT_NAMES[row.stat]}</span>
          </p>
          <p className="who">{row.playerName}</p>
        </div>

        <div className="meter dimmable">
          <div className="meter-labels">
            <span className="ours">Our chance <b>{pct(row.pWinFinal)}</b></span>
            <span>Break-even <b>{pct(row.breakEven)}</b></span>
          </div>
          <div className="track" role="img" aria-label={`Our chance ${pct(row.pWinFinal)} against a ${pct(row.breakEven)} break-even`}>
            <span className="be" style={{ width: `${row.breakEven * 100}%` }} />
            <span className="edge" style={{ left: `${row.breakEven * 100}%`, width: `${edge * 100}%` }} />
            <span className="tick" style={{ left: `${row.breakEven * 100}%` }} />
          </div>
          <small>The lit section is the gap between what the price implies and what we expect.</small>
        </div>

        <div className="ev">
          <strong className="dimmable">+{(row.ev * 100).toFixed(1)}%</strong>
          <span>expected return per $1</span>
          <span className="price">{bookName(row.book)} <b>{american(row.american)}</b></span>
          <span className="age">checked <Age iso={row.sourceUpdatedAt} /></span>
        </div>
      </div>

      {collapsible && (
        <button type="button" className="toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide details" : "Why this pick?"}
        </button>
      )}

      {open && (
        <ul className="reasons">
          <li>
            <span className="kicker">Why</span>
            <p>
              We give this a {pct(row.pWinFinal)} chance to hit. At this price it only needs {pct(row.breakEven)} to break even
              {row.pPush > 0 ? ` (push ${pct(row.pPush)})` : ""}. We expect about {row.mean.toFixed(1)} {STAT_NAMES[row.stat]} in{" "}
              {row.expMinutes.toFixed(0)} minutes, based on {row.matchedGames} similar games.
            </p>
          </li>
          <li className="risk">
            <span className="kicker">Risk</span>
            <p>
              {failing.length ? `The edge disappears if he ${failing.join(" or ")}.` : "The edge holds up even if his minutes or the game swing a bit."}
              {row.sensitivity.zeroMinuteCase ? " Hurt badly if he doesn’t play at all." : ""}
            </p>
            {row.flags.length > 0 && (
              <span className="flags">{row.flags.map((f) => <span className="flag" key={f}>{FLAG_TEXT[f] ?? f}</span>)}</span>
            )}
          </li>
          <li className="mkt">
            <span className="kicker">Price</span>
            <p>
              Best price is {bookName(row.book)} {american(row.american)}, checked at {pacificTime(row.sourceUpdatedAt)} (<Age iso={row.sourceUpdatedAt} />).{" "}
              {others.map(([b, s]) => `${bookName(b)}: ${BOOK_STATUS[s] ?? s}`).join(". ")}
              {others.length ? ". " : ""}This is our model against one book’s price, not proof the whole market is wrong.
            </p>
          </li>
        </ul>
      )}
    </li>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffb547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }} aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}
