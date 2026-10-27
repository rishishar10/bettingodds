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
      {b.rows.length ? (
        <ol className="slips">
          {b.rows.map((r) => <Slip key={r.key} row={r} teams={b.teams} news={news?.rows[r.key]} />)}
        </ol>
      ) : (
        <p className="empty">Empty board. {b.emptyReason} A sparse board is not a night with no edges; it is a night where nothing the model can support cleared the bar.</p>
      )}

      {b.conditional.length > 0 && (
        <section>
          <h2>If they sit</h2>
          <p className="fine">
            Priced as if a questionable or doubtful teammate is out, using the same matched games. These are not morning-board rows and
            are not called an edge. They are graded only at the first price posted after the news, and only if it still clears the bar.
          </p>
          <ul className="cards">
            {b.conditional.map((c, i) => (
              <li className="card" key={i}>
                <b>If {c.subjectName} ({c.subjectStatus}) sits:</b>{" "}
                {c.message ?? (
                  <>
                    {c.playerName} {c.side} {c.line} {STAT_NAMES[c.stat ?? ""]}, {bookName(c.book ?? "")} {american(decimalToAmerican(c.decimal!))},
                    shrunk probability {pct(c.pWinFinal ?? 0)}, EV +{((c.ev ?? 0) * 100).toFixed(1)}%, {c.matchedGames} matching games
                    {c.thin ? ", thin sample" : ""}. Priced {pacificTime(c.sourceUpdatedAt!)}.
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {b.anomalies.length > 0 && (
        <p className="fine" style={{ marginTop: 32 }}>
          {b.anomalies.length} line{b.anomalies.length > 1 ? "s" : ""} where both sides cleared the bar {b.anomalies.length > 1 ? "were" : "was"} held off the board for diagnosis.
        </p>
      )}
      <Footer />
    </main>
  );
}
