"use client";
import { useEffect, useState } from "react";
import { STAT_NAMES } from "../../lib/format.ts";

// Live check on tonight's picks, straight from ESPN's public JSON in the browser
// (it allows cross-origin reads). Polls every 30 seconds while any game is live.
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const POLL_MS = 30000;

export interface TrackedPick {
  key: string;
  playerId: string;
  playerName: string;
  stat: "pts" | "reb" | "ast";
  line: number;
  side: "over" | "under";
  /** Team abbreviations of the game, to find it on ESPN's scoreboard. */
  home: string;
  away: string;
  tipUtc: string;
}

interface GameState {
  state: "pre" | "in" | "post";
  detail: string;
  /** Regulation-scaled share of the game played, 0 to 1. */
  elapsed: number;
}

interface PlayerLine {
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  dnp: boolean;
}

function elapsedShare(period: number, clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  const left = (m || 0) + (s || 0) / 60;
  const played = period <= 4 ? (period - 1) * 12 + (12 - left) : 48;
  return Math.max(0, Math.min(1, played / 48));
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function LiveTracker({ picks, boardDate }: { picks: TrackedPick[]; boardDate: string }) {
  const [games, setGames] = useState<Record<string, GameState & { id: string }>>({});
  const [players, setPlayers] = useState<Record<string, PlayerLine>>({});
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      try {
        const board = await getJson(`${ESPN}/scoreboard?dates=${boardDate.replaceAll("-", "")}`);
        const g: Record<string, GameState & { id: string }> = {};
        for (const e of board.events ?? []) {
          const comp = e.competitions[0];
          const abbr = (side: string) => comp.competitors.find((c: any) => c.homeAway === side)?.team?.abbreviation;
          const st = comp.status ?? e.status;
          g[`${abbr("away")}@${abbr("home")}`] = {
            id: String(e.id),
            state: st.type.state,
            detail: st.type.shortDetail ?? st.type.detail,
            elapsed: st.type.state === "post" ? 1 : st.type.state === "in" ? elapsedShare(st.period, st.displayClock ?? "12:00") : 0,
          };
        }
        const p: Record<string, PlayerLine> = {};
        for (const game of Object.values(g)) {
          if (game.state === "pre") continue;
          const sum = await getJson(`${ESPN}/summary?event=${game.id}`);
          for (const team of sum.boxscore?.players ?? []) {
            const s = team.statistics?.[0];
            if (!s) continue;
            const i = (l: string) => s.labels.indexOf(l);
            for (const a of s.athletes ?? []) {
              const n = (k: number) => Number(a.stats?.[k]) || 0;
              const played = !a.didNotPlay && (a.stats?.length ?? 0) > 0;
              p[String(a.athlete.id)] = { minutes: played ? n(i("MIN")) : 0, pts: n(i("PTS")), reb: n(i("REB")), ast: n(i("AST")), dnp: !played };
            }
          }
        }
        if (stop) return;
        setGames(g);
        setPlayers(p);
        setUpdated(new Date());
        setError(false);
        const live = Object.values(g).some((x) => x.state === "in");
        const pending = Object.values(g).some((x) => x.state === "pre");
        if (live || pending) timer = setTimeout(tick, live ? POLL_MS : POLL_MS * 4);
      } catch {
        if (stop) return;
        setError(true);
        timer = setTimeout(tick, POLL_MS * 2);
      }
    }
    tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [boardDate]);

  if (!picks.length) return null;
  const rows = picks.map((pk) => {
    const game = games[`${pk.away}@${pk.home}`];
    const pl = players[pk.playerId];
    const now = pl ? pl[pk.stat] : 0;
    let status: "pre" | "live" | "win" | "loss" | "push" | "void" = "pre";
    let note = "";
    if (game?.state === "post") {
      if (!pl || pl.minutes === 0) status = "void";
      else if (now === pk.line) status = "push";
      else status = (now > pk.line) === (pk.side === "over") ? "win" : "loss";
    } else if (game?.state === "in") {
      status = "live";
      const pace = game.elapsed > 0.05 ? now / game.elapsed : null;
      const need = pk.side === "over" ? Math.max(0, Math.floor(pk.line) + 1 - now) : null;
      const cleared = pk.side === "over" ? now > pk.line : now > pk.line ? "dead" : null;
      note = pk.side === "over"
        ? (need === 0 ? "Over already hit" : `needs ${need} more`) + (pace !== null ? `, on pace for ${pace.toFixed(0)}` : "")
        : (cleared === "dead" ? "Under already lost" : `${(pk.line - now).toFixed(1)} of room left`) + (pace !== null ? `, on pace for ${pace.toFixed(0)}` : "");
    }
    return { pk, game, pl, now, status, note };
  });
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const decided = count("win") + count("loss");

  return (
    <section>
      <div className="section-head">
        <h2>Live tracker <small>{updated ? `updated ${updated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "loading"}</small></h2>
      </div>
      <p className="fine">
        {count("win")} won, {count("loss")} lost{count("push") ? `, ${count("push")} pushed` : ""}{count("void") ? `, ${count("void")} void` : ""}, {count("live")} live,{" "}
        {count("pre")} not started{decided ? `. Hit rate so far ${((count("win") / decided) * 100).toFixed(0)}%.` : "."}{" "}
        Live numbers come from ESPN and refresh every 30 seconds; the official grade is posted after the games.
        {error ? " ESPN didn’t respond on the last try; retrying." : ""}
      </p>
      <div className="box">
        <table>
          <thead><tr><th>Pick</th><th className="num">Now</th><th>Game</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(({ pk, game, pl, now, status, note }) => (
              <tr key={pk.key}>
                <td>{pk.playerName} {pk.side} {pk.line} {STAT_NAMES[pk.stat]}</td>
                <td className="num mono">{game && game.state !== "pre" ? `${now}${pl ? ` (${pl.minutes} min)` : ""}` : "—"}</td>
                <td>{game ? game.detail : new Date(pk.tipUtc).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                <td>
                  <span className={`res ${status === "win" ? "win" : status === "loss" ? "loss" : status === "void" ? "void" : ""}`}>
                    {status === "pre" ? "Not started" : status === "live" ? `Live: ${note}` : status === "win" ? "Won" : status === "loss" ? "Lost" : status === "push" ? "Push" : "Void, didn’t play"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
