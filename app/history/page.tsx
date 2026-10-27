import { listDates, loadBoard, loadGrades, replayInRepo, STAT_NAMES, bookName, american, pct, pacificTime } from "../../lib/view.ts";
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

export default function History() {
  const dates = listDates();
  const grades = loadGrades();
  const boards = dates.map(loadBoard);
  const rows = boards.flatMap((b) => b.rows.map((r) => ({ b, r, g: grades?.grades[`${b.boardDate}|${r.key}`] })));
  const halfSettled = rows.filter((x) => !Number.isInteger(x.r.line) && (x.g?.result === "win" || x.g?.result === "loss"));
  const s = grades?.summary;
  const showProfit = replayInRepo();
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

        <section>
          <h2>Are the percentages honest?</h2>
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
        </section>

        <section>
          <h2>All picks</h2>
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
        </section>
        <Footer />
      </main>
    </>
  );
}
