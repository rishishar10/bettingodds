import { listDates, loadBoard, loadNews, pacificTime, pct, STAT_NAMES, bookName, american, type BoardSnapshot, type NewsFile } from "../lib/view.ts";
import { decimalToAmerican } from "../lib/ev.ts";
import { Age } from "./components/Age.tsx";
import { Headshot } from "./components/Headshot.tsx";
import { Footer, Nav } from "./components/Nav.tsx";
import { Picks } from "./components/Picks.tsx";
import type { ConditionalCard } from "../lib/board.ts";

const COVERAGE: [string, string][] = [
  ["too_few_games", "haven’t played enough games"],
  ["unresolved_status", "have an unclear injury status"],
  ["teammate_role", "have a role that depends on a teammate"],
  ["report_not_submitted", "are on teams that hadn’t filed an injury report"],
  ["player_out", "are ruled out"],
  ["unmatched_name", "couldn’t be matched by name"],
  ["stale_or_invalid_odds", "had out-of-date or bad odds"],
];

function statusLine(news: NewsFile): string {
  if (!news.changes.length) return "No changes since we published.";
  const flagged = Object.keys(news.rows).length;
  const touching = [...new Set(Object.values(news.rows).flat().map((f) => `${f.playerName} ${f.to}`))];
  const n = news.changes.length;
  return `${n} player${n > 1 ? "s’" : "’s"} status changed since we published. ` +
    (flagged ? `${flagged} pick${flagged > 1 ? "s are" : " is"} affected (${touching.join(", ")}) and marked below.` : "None of them affect tonight’s picks.");
}

function Header({ b, news }: { b: BoardSnapshot; news: NewsFile | null }) {
  const d = new Date(`${b.boardDate}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const skipped = COVERAGE.filter(([k]) => (b.coverage[k] ?? 0) > 0);
  return (
    <header className="hero">
      <div className="meta">
        <span className="live" aria-hidden="true" />
        <b>Published {pacificTime(b.publishedAt)}</b>
        <span>·</span>
        <span>{b.games.length} games</span>
        <span className="badge-warn">Model {b.label}</span>
      </div>
      <h1 className="date"><span className="hi">{weekday}</span><span>{monthDay}</span></h1>
      <p className="claim">
        Tonight’s player props where our model disagrees with a sportsbook’s price. It only covers players it has enough data on,
        so this isn’t a list of every good bet.
      </p>
      <p className="fine">
        Each pick compares our projection for a player with one sportsbook’s line. We only show it when the model expects at least
        an {pct(b.evMin, 0)} return on every $1 bet over the long run.
        {b.dryRun ? " Development dry run, not a published board." : ""}
      </p>

      <dl className="facts">
        <div><dt>Published</dt><dd>{pacificTime(b.publishedAt)}</dd></div>
        <div><dt>Prices from</dt><dd><Age iso={b.publishedAt} /></dd></div>
        <div><dt>Injury report</dt><dd>{b.injury ? pacificTime(b.injury.timeUtc) : "none"}</dd></div>
        <div><dt>Games</dt><dd>{b.games.length}</dd></div>
        <div><dt>Picks</dt><dd>{b.rows.length}</dd></div>
      </dl>

      <div className="duo">
        <div className="panel">
          <span className="kicker">Who we covered</span>
          <span className="big-num"><b>{b.coverage.supported ?? 0}</b> of {b.coverage.prop_market ?? 0} players with lines</span>
          <div className="covbar">
            <span style={{ flex: b.coverage.supported ?? 0 }} />
            {skipped.map(([k, label]) => <span key={k} title={`${b.coverage[k]} ${label}`} style={{ flex: b.coverage[k] }} />)}
          </div>
          <p>
            Skipped: {skipped.map(([k, label]) => `${b.coverage[k]} ${label}`).join(", ")}. Being skipped doesn’t make a player a bad bet;
            it means we can’t estimate his role yet.{b.closeCollected ? "" : " Closing prices aren’t tracked on the free plan."}
          </p>
        </div>
        <div className="panel warn">
          <span className="kicker">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            Injury updates
          </span>
          <p>{news ? `Last checked ${pacificTime(news.checkedAt)}. ${statusLine(news)}` : "Injuries haven’t been rechecked since we published."}</p>
        </div>
      </div>
    </header>
  );
}

function IfTheySit({ cards }: { cards: ConditionalCard[] }) {
  if (!cards.length) return null;
  const priced = cards.filter((c) => !c.message);
  const unpriced = new Map<string, number>();
  for (const c of cards) if (c.message) unpriced.set(c.subjectName, (unpriced.get(c.subjectName) ?? 0) + 1);
  const sits = (c: ConditionalCard) => ((c.subjectPlayerIds?.length ?? 1) > 1 ? "" : "s");
  return (
    <section>
      <h2>If a player sits out</h2>
      <p className="fine">
        What changes if a questionable or doubtful player is ruled out. These aren’t picks yet. One only counts if the first price
        posted after the news still clears the bar.
      </p>
      {priced.length ? (
        <ul className="cards">
          {priced.map((c, i) => (
            <li className="card" key={i}>
              <span className="kicker"><span className="ring" />If {c.subjectName} ({c.subjectStatus}) sit{sits(c)}</span>
              <div className="card-head">
                <Headshot playerId={c.playerId} name={c.playerName} size={56} />
                <span className="card-title">{c.playerName} {c.side} {c.line} {STAT_NAMES[c.stat ?? ""]}</span>
              </div>
              <p>
                {bookName(c.book ?? "")} {american(decimalToAmerican(c.decimal!))}. {pct(c.pWinFinal ?? 0)} chance to hit, +{((c.ev ?? 0) * 100).toFixed(1)}% expected return. Based on {c.matchedGames} games without him{c.thin ? " (small sample)" : ""}. Price from {pacificTime(c.sourceUpdatedAt!)}.
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fine">No scenario clears the bar.</p>
      )}
      {unpriced.size > 0 && (
        <details className="fine">
          <summary>
            {[...unpriced.values()].reduce((a, b) => a + b, 0)} more players have a role change with no matching games to price it
          </summary>
          <ul className="dropped">
            {[...unpriced].map(([who, n]) => (
              <li key={who}>If {who} sit{who.includes(" and ") ? "" : "s"}: {n} player{n > 1 ? "s" : ""}, projection unavailable.</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default function Page() {
  const dates = listDates();
  if (!dates.length) {
    return (
      <>
        <Nav current="board" />
        <main className="page">
          <h1 className="date">No board yet</h1>
          <p className="claim">The first board publishes after the test-season replay is in the repo. Run the 11pm job with --dry-run to preview one.</p>
          <Footer />
        </main>
      </>
    );
  }
  const b = loadBoard(dates[0]);
  const news = loadNews(b.boardDate);
  const tips: Record<string, string> = {};
  for (const g of b.games) { tips[g.home] = g.tipUtc; tips[g.away] = g.tipUtc; }
  const update = news?.update;

  return (
    <>
      <Nav current="board" />
      <main className="page">
        <Header b={b} news={news} />

        {update && (
          <section>
            <p className="fine">
              The board re-run at {pacificTime(update.asOf)} with the official report from {pacificTime(update.reportTimeUtc)}
              {news.espnNotesAfterPublish ? " and later ESPN injury notes" : ""}, for games not yet started
              {update.tippedGames.length ? ` (already started: ${update.tippedGames.join(", ")})` : ""}. Prices are from last night’s 11pm build. This view is
              not graded; last night’s board below is the record.
            </p>
            {update.rows.length ? (
              <Picks
                title="Updated for injury news"
                rows={update.rows}
                teams={b.teams}
                tips={tips}
                emptyReason="Nothing clears the bar with the latest injury information."
                update={{ added: update.added, asOf: update.asOf }}
              />
            ) : (
              <p className="empty">Nothing clears the bar with the latest injury information.</p>
            )}
            {update.dropped.length > 0 && (
              <>
                <p className="fine">Dropped from last night’s board:</p>
                <ul className="dropped">
                  {update.dropped.map((d) => {
                    const r = b.rows.find((x) => x.key === d.key);
                    return <li key={d.key}>{r ? `${r.playerName} ${r.side} ${r.line} ${STAT_NAMES[r.stat]}` : d.key}: {d.reason}.</li>;
                  })}
                </ul>
              </>
            )}
          </section>
        )}

        <Picks
          title={update ? "Last night’s board" : "Tonight’s picks"}
          rows={b.rows}
          teams={b.teams}
          tips={tips}
          news={news?.rows}
          emptyReason={b.emptyReason}
        />

        <IfTheySit cards={update?.conditional ?? b.conditional} />

        {b.anomalies.length > 0 && (
          <p className="fine" style={{ marginTop: 32 }}>
            {b.anomalies.length} line{b.anomalies.length > 1 ? "s" : ""} where both sides cleared the bar {b.anomalies.length > 1 ? "were" : "was"} held off the board for diagnosis.
          </p>
        )}
        <Footer />
      </main>
    </>
  );
}
