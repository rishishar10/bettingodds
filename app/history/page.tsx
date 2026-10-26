import { listDates, loadBoard, loadGrades, replayInRepo, STAT_NAMES, bookName, american, pct, pacificTime } from "../../lib/view.ts";
import { Footer, Nav } from "../components/Nav.tsx";

const BANDS = [0.5, 0.55, 0.6, 0.65, 0.7, 1.01];

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

  return (
    <main className="page">
      <Nav current="history" />
      <h1 className="date">History</h1>
      <p className="claim">Every published row, graded at its saved line and saved price. Zero minutes voids; overtime counts.</p>

      {s && (
        <dl className="facts">
          <div><dt>Bets</dt><dd>{s.bets}</dd></div>
          <div><dt>Settled</dt><dd>{s.settled}</dd></div>
          <div><dt>Voids</dt><dd>{s.voids}</dd></div>
          <div><dt>Pending</dt><dd>{s.pending}</dd></div>
          {showProfit && <div><dt>Units staked</dt><dd>{s.unitsStaked}</dd></div>}
          {showProfit && <div><dt>Net units</dt><dd>{s.netUnits.toFixed(2)}</dd></div>}
          {showProfit && <div><dt>ROI</dt><dd>{s.roi === null ? "n/a" : pct(s.roi)}</dd></div>}
        </dl>
      )}
      {!showProfit && <p className="fine">No profit number is shown until the test-season replay is in the repo.</p>}

      <h2>Calibration</h2>
      <p className="fine">
        Settled half-point rows from {dates.at(-1) ?? "n/a"} to {dates[0] ?? "n/a"}, probabilities shrunk, model versions{" "}
        {[...new Set(boards.map((b) => b.modelVersion))].join(", ") || "n/a"}. {halfSettled.length} rows, {games} team-games, {players} players.{" "}
        {halfSettled.length < 100
          ? "Under 100 settled rows: too small to read."
          : "Passing 100 rows is not proof of calibration, and ROI is a different number."}
      </p>
      <div className="scroll">
        <table>
          <thead><tr><th>Shrunk probability</th><th className="num">Rows</th><th className="num">Won</th><th className="num">Mean predicted</th></tr></thead>
          <tbody>
            {BANDS.slice(0, -1).map((lo, i) => {
              const inBand = halfSettled.filter((x) => x.r.pWinFinal >= lo && x.r.pWinFinal < BANDS[i + 1]);
              const won = inBand.filter((x) => x.g?.result === "win").length;
              return (
                <tr key={lo}>
                  <td>{pct(lo, 0)}–{BANDS[i + 1] > 1 ? "100%" : pct(BANDS[i + 1], 0)}</td>
                  <td className="num">{inBand.length}</td>
                  <td className="num">{inBand.length ? pct(won / inBand.length) : "—"}</td>
                  <td className="num">{inBand.length ? pct(inBand.reduce((a, x) => a + x.r.pWinFinal, 0) / inBand.length) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Rows</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Date</th><th>Prop</th><th>Saved price</th><th className="num">EV</th><th>Result</th><th>Close</th></tr>
          </thead>
          <tbody>
            {rows.map(({ b, r, g }) => (
              <tr key={`${b.boardDate}${r.key}`}>
                <td>{b.boardDate}</td>
                <td>{r.playerName} {r.side} {r.line} {STAT_NAMES[r.stat]}</td>
                <td>{bookName(r.book)} {american(r.american)}, priced {pacificTime(r.sourceUpdatedAt)}</td>
                <td className="num">+{(r.ev * 100).toFixed(1)}%</td>
                <td className={g?.result === "win" ? "win" : g?.result === "loss" ? "loss" : ""}>
                  {g?.result ? `${g.result}${g.result !== "void" ? ` (${g.actual})` : ""}` : "pending"}
                </td>
                <td>
                  {!g || g.close.kind === "missing_close" ? "missing close"
                    : g.close.kind === "same_line" ? `${g.close.direction}, ${((g.close.movement ?? 0) * 100).toFixed(1)}%`
                    : "different line: comparison unavailable"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer />
    </main>
  );
}
