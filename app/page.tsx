import { listDates, loadBoard, loadNews, longDate, pacificTime, pct, STAT_NAMES, bookName, american, type BoardSnapshot, type NewsFile } from "../lib/view.ts";
import { decimalToAmerican } from "../lib/ev.ts";
import { Age } from "./components/Age.tsx";
import { Footer, Nav } from "./components/Nav.tsx";
import { Slip } from "./components/Slip.tsx";

const COVERAGE: [string, string][] = [
  ["supported", "supported"],
  ["too_few_games", "too few games"],
  ["unresolved_status", "unresolved status"],
  ["teammate_role", "teammate role"],
  ["report_not_submitted", "injury report not submitted"],
  ["player_out", "listed out"],
  ["unmatched_name", "unmatched name"],
  ["stale_or_invalid_odds", "stale or invalid odds"],
];

function statusLine(news: NewsFile): string {
  if (!news.changes.length) return "no changes since publish.";
  const flagged = Object.keys(news.rows).length;
  const touching = [...new Set(Object.values(news.rows).flat().map((f) => `${f.playerName} ${f.to}`))];
  return `${news.changes.length} status change${news.changes.length > 1 ? "s" : ""} before tip-off since publish` +
    (flagged ? `; ${flagged} row${flagged > 1 ? "s" : ""} affected (${touching.join(", ")}), marked below.` : "; none affect a published row.");
}

function Header({ b, news }: { b: BoardSnapshot; news: NewsFile | null }) {
  return (
    <header>
      <h1 className="date">{longDate(b.boardDate)}</h1>
      <p className="claim">
        These are the qualifying props among players the model can support, not the best props of the night.{" "}
        <span className="label">Label: {b.label}.</span>
      </p>
      <p className="fine">
        Each row is a disagreement between a shrunk negative-binomial projection ({b.modelVersion}, shrink {b.SHRINK.toFixed(2)}) and one
        book&rsquo;s price, kept only when expected value is at least {pct(b.evMin, 0)}.
        {b.dryRun ? " Development dry run, not a published board." : ""}
      </p>
      <dl className="facts">
        <div><dt>Published</dt><dd>{pacificTime(b.publishedAt)}</dd></div>
        <div><dt>Prices age</dt><dd><Age iso={b.publishedAt} /></dd></div>
        <div><dt>Injury report</dt><dd>{b.injury ? pacificTime(b.injury.timeUtc) : "none"}</dd></div>
        <div><dt>Games</dt><dd>{b.games.length}</dd></div>
        <div><dt>Rows</dt><dd>{b.rows.length}</dd></div>
      </dl>
      <p className="coverage">
        Of <b>{b.coverage.prop_market ?? 0}</b> players with a prop market:{" "}
        {COVERAGE.filter(([k]) => (b.coverage[k] ?? 0) > 0)
          .map(([k, label]) => `${b.coverage[k]} ${label}`)
          .join(", ")}
        . An unsupported player is one whose role cannot be estimated yet, not an uninteresting one.
        {b.closeCollected ? "" : " Closing prices are not collected on the free plan."}
      </p>
      <p className={news?.changes.length ? "coverage news" : "coverage"}>
        {news
          ? `Injury status checked ${pacificTime(news.checkedAt)}: ${statusLine(news)}`
          : "Injury status has not been rechecked since publish."}
      </p>
    </header>
  );
}

function IfTheySit({ cards }: { cards: BoardSnapshot["conditional"] }) {
  if (!cards.length) return null;
  const priced = cards.filter((c) => !c.message);
  const unpriced = new Map<string, number>();
  for (const c of cards) if (c.message) unpriced.set(c.subjectName, (unpriced.get(c.subjectName) ?? 0) + 1);
  return (
    <section>
      <h2>If they sit</h2>
      <p className="fine">
        Priced as if questionable or doubtful teammates are out, using the same matched games. These are not board rows and are not
        called an edge. They are graded only at the first price posted after the news, and only if it still clears the bar.
      </p>
      {priced.length ? (
        <ul className="cards">
          {priced.map((c, i) => (
            <li className="card" key={i}>
              <b>If {c.subjectName} ({c.subjectStatus}) sit{c.subjectPlayerIds.length > 1 ? "" : "s"}:</b> {c.playerName} {c.side} {c.line}{" "}
              {STAT_NAMES[c.stat ?? ""]}, {bookName(c.book ?? "")} {american(decimalToAmerican(c.decimal!))}, shrunk probability{" "}
              {pct(c.pWinFinal ?? 0)}, EV +{((c.ev ?? 0) * 100).toFixed(1)}%, {c.matchedGames} matching games{c.thin ? ", thin sample" : ""}.
              Priced {pacificTime(c.sourceUpdatedAt!)}.
            </li>
          ))}
        </ul>
      ) : (
        <p className="fine">No scenario clears the bar.</p>
      )}
      {unpriced.size > 0 && (
        <details className="fine" style={{ marginTop: 12 }}>
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
      <main className="page">
        <Nav current="board" />
        <h1 className="date">No board yet</h1>
        <p className="claim">The first board publishes after the test-season replay is in the repo. Run the 8:00am job with --dry-run to preview one.</p>
        <Footer />
      </main>
    );
  }
  const b = loadBoard(dates[0]);
  const news = loadNews(b.boardDate);
  return (
    <main className="page">
      <Nav current="board" />
      <Header b={b} news={news} />
      {news?.update && (
        <section>
          <h2>Updated for injury news</h2>
          <p className="fine">
            The board re-run at {pacificTime(news.update.asOf)} with the official report from {pacificTime(news.update.reportTimeUtc)}
            {news.espnNotesAfterPublish ? " and later ESPN injury notes" : ""}, for games not yet started
            {news.update.tippedGames.length ? ` (already started: ${news.update.tippedGames.join(", ")})` : ""}. Prices are the 8:00am prices. This view is
            not graded; the 8:00am board below is the record.
          </p>
          {news.update.rows.length ? (
            <ol className="slips">
              {news.update.rows.map((r) => (
                <Slip key={r.key} row={r} teams={b.teams} update={{ isNew: news.update!.added.includes(r.key), asOf: news.update!.asOf }} />
              ))}
            </ol>
          ) : (
            <p className="empty">Nothing clears the bar with the latest injury information.</p>
          )}
          {news.update.dropped.length > 0 && (
            <>
              <p className="fine" style={{ marginTop: 20 }}>Dropped from the 8:00am board:</p>
              <ul className="dropped">
                {news.update.dropped.map((d) => {
                  const r = b.rows.find((x) => x.key === d.key);
                  return <li key={d.key}>{r ? `${r.playerName} ${r.side} ${r.line} ${STAT_NAMES[r.stat]}` : d.key}: {d.reason}.</li>;
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <section className={news?.update ? "record" : undefined}>
        {news?.update && <h2>8:00am board (the graded record)</h2>}
        {b.rows.length ? (
          <ol className="slips">
            {b.rows.map((r) => <Slip key={r.key} row={r} teams={b.teams} news={news?.rows[r.key]} />)}
          </ol>
        ) : (
          <p className="empty">Empty board. {b.emptyReason} A sparse board is not a night with no edges; it is a night where nothing the model can support cleared the bar.</p>
        )}
      </section>

      <IfTheySit cards={news?.update?.conditional ?? b.conditional} />

      {b.anomalies.length > 0 && (
        <p className="fine" style={{ marginTop: 32 }}>
          {b.anomalies.length} line{b.anomalies.length > 1 ? "s" : ""} where both sides cleared the bar {b.anomalies.length > 1 ? "were" : "was"} held off the board for diagnosis.
        </p>
      )}
      <Footer />
    </main>
  );
}
