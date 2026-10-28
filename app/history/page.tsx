import { listDates, loadBoard, loadGrades, loadScorecard, practiceDir, replayInRepo, STAT_NAMES, bookName, american, pct, pacificTime, type BoardSnapshot, type GradeFile } from "../../lib/view.ts";
import { Headshot } from "../components/Headshot.tsx";
import { Footer, Nav } from "../components/Nav.tsx";

const BANDS = [0.5, 0.55, 0.6, 0.65, 0.7, 1.01];
const RESULT: Record<string, string> = { win: "Won", loss: "Lost", void: "Void, didn’t play" };

function closeCell(close?: { kind: string; movement?: number; direction?: string }) {
  if (!close || close.kind === "missing_close") return { text: "Not tracked", cls: "move-none" };
  if (close.kind !== "same_line") return { text: "Line changed, can’t compare", cls: "move-none" };
  // lib/clv.ts: positive movement means the saved price was longer than the close (we beat it).
  const m = `${Math.abs((close.movement ?? 0) * 100).toFixed(1)}%`;
  if (close.direction === "equal") return { text: "Closed at the same price", cls: "move-none" };
  const good = close.direction === "better";
  return { text: good ? `Beat the closing price by ${m}` : `Closing price was ${m} better`, cls: good ? "move-good" : "move-bad" };
}

type Graded = { b: BoardSnapshot; r: BoardSnapshot["rows"][number]; g: GradeFile["grades"][string] | undefined };

function gather(dir?: string) {
  const dates = listDates(dir);
  const grades = loadGrades(dir);
  const boards = dates.map((d) => loadBoard(d, dir));
  const rows: Graded[] = boards.flatMap((b) => b.rows.map((r) => ({ b, r, g: grades?.grades[`${b.boardDate}|${r.key}`] })));
  return { dates, grades, boards, rows };
}

function Calibration({ rows, dates, boards }: { rows: Graded[]; dates: string[]; boards: BoardSnapshot[] }) {
  const halfSettled = rows.filter((x) => !Number.isInteger(x.r.line) && (x.g?.result === "win" || x.g?.result === "loss"));
  const games = new Set(halfSettled.map((x) => `${x.b.boardDate}|${x.r.teamId}`)).size;
  const players = new Set(halfSettled.map((x) => x.r.playerId)).size;
  const bands = BANDS.slice(0, -1).map((lo, i) => {
    const inBand = halfSettled.filter((x) => x.r.pWinFinal >= lo && x.r.pWinFinal < BANDS[i + 1]);
    const won = inBand.filter((x) => x.g?.result === "win").length;
    const mean = inBand.length ? inBand.reduce((a, x) => a + x.r.pWinFinal, 0) / inBand.length : 0;
    return { lo, hi: BANDS[i + 1], n: inBand.length, rate: inBand.length ? won / inBand.length : 0, mean };
  });
  return (
    <>
      <p className="fine">
        Settled half-point rows from {dates.at(-1) ?? "n/a"} to {dates[0] ?? "n/a"}, probabilities shrunk, model versions{" "}
        {[...new Set(boards.map((b) => b.modelVersion))].join(", ") || "n/a"}. {halfSettled.length} rows, {games} team-games, {players} players.{" "}
        {halfSettled.length < 100
          ? "Under 100 settled rows: too small to read."
          : "Passing 100 rows is not proof of calibration, and ROI is a different number."}
      </p>
      <div className="cal">
        <div className="box">
          <table>
            <thead><tr><th>Our probability</th><th className="num">Picks</th><th className="num">Hit rate</th><th className="num">Avg. predicted</th></tr></thead>
            <tbody>
              {bands.map((x) => (
                <tr key={x.lo}>
                  <td style={{ fontWeight: 600 }}>{pct(x.lo, 0)}–{x.hi > 1 ? "100%" : pct(x.hi, 0)}</td>
                  <td className="num mono">{x.n}</td>
                  <td className="num mono hi">{x.n ? pct(x.rate) : "—"}</td>
                  <td className="num mono">{x.n ? pct(x.mean) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figure>
          <svg viewBox="0 0 300 220" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Predicted chance against actual hit rate">
            <line x1="40" y1="190" x2="290" y2="190" stroke="rgba(255,255,255,0.14)" />
            <line x1="40" y1="10" x2="40" y2="190" stroke="rgba(255,255,255,0.14)" />
            <line x1="40" y1="100" x2="290" y2="10" stroke="rgba(242,243,238,0.45)" strokeDasharray="3 4" />
            <text x="40" y="208" fontSize="10" fill="#a0a7b0" textAnchor="middle" fontFamily="DM Mono, monospace">50%</text>
            <text x="290" y="208" fontSize="10" fill="#a0a7b0" textAnchor="end" fontFamily="DM Mono, monospace">100%</text>
            <text x="32" y="193" fontSize="10" fill="#a0a7b0" textAnchor="end" fontFamily="DM Mono, monospace">0%</text>
            <text x="32" y="14" fontSize="10" fill="#a0a7b0" textAnchor="end" fontFamily="DM Mono, monospace">100%</text>
            {bands.filter((x) => x.n).map((x) => (
              <circle key={x.lo} cx={40 + ((x.mean - 0.5) / 0.5) * 250} cy={190 - x.rate * 180} r={Math.min(4 + x.n * 2, 22)} fill="rgba(212,255,58,0.18)" stroke="#d4ff3a" strokeWidth="1.5" />
            ))}
          </svg>
          <figcaption>Each circle is a probability band, sized by its number of picks. Circles on the dashed line mean the model’s percentages match what happened.</figcaption>
        </figure>
      </div>
    </>
  );
}

function PickTable({ rows }: { rows: Graded[] }) {
  return (
    <div className="box">
      <table style={{ minWidth: 820 }}>
        <thead>
          <tr><th>Date</th><th>Pick</th><th>Price we saved</th><th className="num">Expected return</th><th>Result</th><th>Line movement</th></tr>
        </thead>
        <tbody>
          {rows.map(({ b, r, g }) => {
            const close = closeCell(g?.close);
            return (
              <tr key={`${b.boardDate}${r.key}`}>
                <td className="date-cell">{b.boardDate}</td>
                <td>
                  <span className="prop">
                    <Headshot playerId={r.playerId} name={r.playerName} size={36} />
                    {r.playerName} {r.side} {r.line} {STAT_NAMES[r.stat]}
                  </span>
                </td>
                <td style={{ color: "#c4c9cf" }}>{bookName(r.book)} {american(r.american)}, priced {pacificTime(r.sourceUpdatedAt)}</td>
                <td className="num mono ev-cell">+{(r.ev * 100).toFixed(1)}%</td>
                <td>
                  <span className={`res ${g?.result ?? ""}`}>
                    {g?.result ? `${RESULT[g.result] ?? g.result}${g.result !== "void" ? ` (${g.actual})` : ""}` : "Pending"}
                  </span>
                </td>
                <td className={close.cls}>{close.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Flat 1-unit stakes on every real pick: totals and a running line by board date. */
function UnitTracker({ rows }: { rows: Graded[] }) {
  const settled = rows.filter((x) => x.g?.result && x.g.result !== "void");
  if (!settled.length) return <p className="fine">Nothing graded yet. The running total starts once the first games finish.</p>;
  const byDate = new Map<string, { net: number; w: number; l: number; p: number; v: number }>();
  for (const x of rows) {
    const d = byDate.get(x.b.boardDate) ?? { net: 0, w: 0, l: 0, p: 0, v: 0 };
    if (x.g?.result === "win") { d.w++; d.net += x.r.decimal - 1; }
    else if (x.g?.result === "loss") { d.l++; d.net -= 1; }
    else if (x.g?.result === "push") d.p++;
    else if (x.g?.result === "void") d.v++;
    byDate.set(x.b.boardDate, d);
  }
  const days = [...byDate.entries()].filter(([, d]) => d.w + d.l + d.p > 0).sort(([a], [b]) => (a < b ? -1 : 1));
  let run = 0;
  const points = days.map(([date, d]) => ({ date, ...d, run: (run += d.net) }));
  const w = points.reduce((a, x) => a + x.w, 0), l = points.reduce((a, x) => a + x.l, 0), p = points.reduce((a, x) => a + x.p, 0);
  const staked = w + l + p;
  const lo = Math.min(0, ...points.map((x) => x.run)), hi = Math.max(0, ...points.map((x) => x.run));
  const span = hi - lo || 1;
  const X = (i: number) => 40 + (points.length > 1 ? (i / (points.length - 1)) * 250 : 125);
  const Y = (v: number) => 190 - ((v - lo) / span) * 170;
  return (
    <>
      <dl className="facts">
        <div><dt>Record</dt><dd>{w}–{l}{p ? `–${p}` : ""}</dd></div>
        <div><dt>Units bet</dt><dd>{staked}</dd></div>
        <div><dt>Net units</dt><dd>{run >= 0 ? "+" : ""}{run.toFixed(2)}</dd></div>
        <div><dt>Return</dt><dd>{run >= 0 ? "+" : ""}{((run / staked) * 100).toFixed(1)}%</dd></div>
      </dl>
      <div className="cal">
        <div className="box">
          <table>
            <thead><tr><th>Board</th><th className="num">Record</th><th className="num">Day</th><th className="num">Running</th></tr></thead>
            <tbody>
              {[...points].reverse().map((x) => (
                <tr key={x.date}>
                  <td className="date-cell">{x.date}</td>
                  <td className="num mono">{x.w}–{x.l}{x.p ? `–${x.p}` : ""}</td>
                  <td className="num mono">{x.net >= 0 ? "+" : ""}{x.net.toFixed(2)}</td>
                  <td className="num mono hi">{x.run >= 0 ? "+" : ""}{x.run.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figure>
          <svg viewBox="0 0 300 220" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Running units by board">
            <line x1="40" y1={Y(0)} x2="290" y2={Y(0)} stroke="rgba(242,243,238,0.45)" strokeDasharray="3 4" />
            <line x1="40" y1="10" x2="40" y2="190" stroke="rgba(255,255,255,0.14)" />
            <text x="32" y={Y(0) + 3} fontSize="10" fill="#a0a7b0" textAnchor="end" fontFamily="DM Mono, monospace">0</text>
            {hi > 0 && <text x="32" y={Y(hi) + 3} fontSize="10" fill="#a0a7b0" textAnchor="end" fontFamily="DM Mono, monospace">+{hi.toFixed(1)}</text>}
            {lo < 0 && <text x="32" y={Y(lo) + 3} fontSize="10" fill="#a0a7b0" textAnchor="end" fontFamily="DM Mono, monospace">{lo.toFixed(1)}</text>}
            <polyline fill="none" stroke="#d4ff3a" strokeWidth="2" points={points.map((x, i) => `${X(i)},${Y(x.run)}`).join(" ")} />
            {points.map((x, i) => <circle key={x.date} cx={X(i)} cy={Y(x.run)} r="3.5" fill="#d4ff3a" />)}
          </svg>
          <figcaption>Running units if you bet 1 unit on every pick at the saved price. A win pays the odds, a loss costs 1, pushes and voids pay nothing.</figcaption>
        </figure>
      </div>
      <p className="fine">
        {staked < 200
          ? `Only ${staked} bets so far. A few hundred are needed before this says whether the model beats the books.`
          : "Hundreds of bets in, but a run of results is still not proof of an edge on its own."}
        {" "}The model has not yet passed its test on a full past season.
      </p>
    </>
  );
}

export default function History() {
  const real = gather();
  const s = real.grades?.summary;
  const showProfit = replayInRepo();
  const pdir = practiceDir();
  const practice = pdir ? gather(pdir) : null;
  const ps = practice?.grades?.summary;
  const pDecided = practice ? practice.rows.filter((x) => x.g?.result === "win" || x.g?.result === "loss") : [];
  const pWins = pDecided.filter((x) => x.g?.result === "win").length;
  const realSettled = real.rows.some((x) => x.g?.result === "win" || x.g?.result === "loss");
  const scorecard = loadScorecard();

  return (
    <>
      <Nav current="history" />
      <main className="page">
        <header className="hero">
          <h1 className="date"><span><span className="hi">Track</span> record</span></h1>
          <p className="claim">Every pick we’ve published, graded at the line and price we saved. If the player doesn’t play, the pick is voided. Overtime counts.</p>
          {s && (
            <dl className="facts">
              <div><dt>Picks</dt><dd>{s.bets}</dd></div>
              <div><dt>Graded</dt><dd>{s.settled}</dd></div>
              <div><dt>Voided</dt><dd>{s.voids}</dd></div>
              <div><dt>Pending</dt><dd>{s.pending}</dd></div>
              {showProfit && <div><dt>Units staked</dt><dd>{s.unitsStaked}</dd></div>}
              {showProfit && <div><dt>Net units</dt><dd>{s.netUnits.toFixed(2)}</dd></div>}
              {showProfit && <div><dt>ROI</dt><dd>{s.roi === null ? "n/a" : pct(s.roi)}</dd></div>}
            </dl>
          )}
          {!showProfit && <p className="fine">Profit isn’t shown until the model has been tested on a full past season.</p>}
        </header>

        {realSettled && (
          <section>
            <h2>Are the percentages honest?</h2>
            <Calibration rows={real.rows} dates={real.dates} boards={real.boards} />
          </section>
        )}

        <section>
          <h2>If you bet 1 unit on every pick</h2>
          <UnitTracker rows={real.rows} />
        </section>

        {scorecard && (
          <section>
            <h2>Model vs the books</h2>
            <p className="fine">
              Every line on our real-price boards, not just the picks: {scorecard.lines} lines scored. Model log loss{" "}
              {scorecard.modelLogLoss.toFixed(3)} against the books’ own no-vig odds at {scorecard.marketLogLoss.toFixed(3)} (lower is better).{" "}
              {scorecard.verdict}
            </p>
          </section>
        )}

        <section>
          <h2>All picks</h2>
          {real.rows.length ? <PickTable rows={real.rows} /> : <p className="fine">No picks with real prices yet.</p>}
          {real.rows.length > 0 && !realSettled && <p className="fine">These are graded the morning after the games, when the box scores are in.</p>}
        </section>

        {practice && pDecided.length > 0 && (
          <section>
            <h2>Model check on past nights</h2>
            <p className="fine">
              Practice boards for {practice.dates.at(-1)} to {practice.dates[0]}: real injury reports and real box scores, but made-up prices
              (each line set at the player’s recent average, -110 both sides). They test whether the model’s percentages come true.
              They are not picks, and their prices are far softer than any sportsbook’s, so their record says nothing about profit.
              {ps ? ` ${ps.settled} graded, ${ps.voids} voided, ${pWins} of ${pDecided.length} hit (${pct(pWins / pDecided.length)}).` : ""}
            </p>
            <Calibration rows={practice.rows} dates={practice.dates} boards={practice.boards} />
            <details className="fine" style={{ marginTop: 16 }}>
              <summary>Every practice row</summary>
              <PickTable rows={practice.rows} />
            </details>
          </section>
        )}
        <Footer />
      </main>
    </>
  );
}
