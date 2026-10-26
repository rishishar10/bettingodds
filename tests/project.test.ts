import { describe, expect, it } from "vitest";
import { alphaMoM, buildPools, project, sensitivity, type PoolContext } from "../lib/project.ts";
import { P, TEAM, teamGames } from "./fixtures.ts";

const ctx = (logs: PoolContext["logs"], extra: Partial<PoolContext> = {}): PoolContext => ({
  playerId: P,
  teamId: TEAM,
  boardDate: "2026-01-20",
  season: "2025-26",
  lastSeason: "2024-25",
  logs,
  teammates: [],
  startersKnown: false,
  ...extra,
});

function ok(r: ReturnType<typeof buildPools>) {
  if (!r.ok) throw new Error(`unsupported: ${r.reason}`);
  return r.pools;
}

describe("pools and availability", () => {
  it("fails the run when a feature is not before the board", () => {
    const logs = teamGames(10, { lastDate: "2026-01-22", players: { [P]: () => ({ min: 30, pts: 15 }) } });
    expect(() => buildPools(ctx(logs))).toThrow(/leakage/);
  });

  it("keeps games a teammate missed when he is out tonight, drops them when he is active", () => {
    // A plays 34 minutes in even games, sits (0) in odd games.
    const logs = teamGames(20, {
      players: { [P]: (i) => ({ min: 30, pts: i % 2 ? 25 : 15 }), A: (i) => ({ min: i % 2 ? 0 : 34 }) },
    });
    const out = ok(buildPools(ctx(logs, { teammates: [{ playerId: "A", status: "out" }] })));
    expect(out.matched.length).toBe(10);
    expect(out.matched.every((g) => Number(g.gameId.slice(1)) % 2 === 1)).toBe(true);

    const active = ok(buildPools(ctx(logs, { teammates: [{ playerId: "A", status: "active" }] })));
    expect(active.matched.length).toBe(10);
    expect(active.matched.every((g) => Number(g.gameId.slice(1)) % 2 === 0)).toBe(true);
  });

  it("two out teammates with no shared absence is unsupported with its own reason", () => {
    const logs = teamGames(20, {
      players: {
        [P]: () => ({ min: 30, pts: 15 }),
        A: (i) => ({ min: i % 2 ? 0 : 30 }),
        B: (i) => ({ min: i % 2 ? 30 : 0 }),
      },
    });
    const r = buildPools(ctx(logs, { teammates: [{ playerId: "A", status: "out" }, { playerId: "B", status: "out" }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_out_intersection");
  });

  it("a questionable rotation teammate leaves the player unsupported", () => {
    const logs = teamGames(20, { players: { [P]: () => ({ min: 30 }), A: () => ({ min: 30 }) } });
    const r = buildPools(ctx(logs, { teammates: [{ playerId: "A", status: "questionable" }] }));
    expect(!r.ok && r.reason).toBe("teammate_status_unresolved");
  });

  it("a questionable bench player does not enter the filter", () => {
    const logs = teamGames(20, { players: { [P]: () => ({ min: 30 }), Z: () => ({ min: 6 }) } });
    expect(buildPools(ctx(logs, { teammates: [{ playerId: "Z", status: "questionable" }] })).ok).toBe(true);
  });

  it("a listed starter with under 3 team games makes teammates unsupported only when starters are known", () => {
    const logs = teamGames(20, { players: { [P]: () => ({ min: 30 }), N: (i) => ({ min: i >= 18 ? 30 : 0 }) } });
    const t = [{ playerId: "N", status: "active" as const, listedStarter: true }];
    const r = buildPools(ctx(logs, { teammates: t, startersKnown: true }));
    expect(!r.ok && r.reason).toBe("teammate_no_history");
    // Without known starters the rule does not fire; his 2 active games still leave too few matches.
    const r2 = buildPools(ctx(logs, { teammates: t, startersKnown: false }));
    expect(!r2.ok && r2.reason).toBe("too_few_games");
  });

  it("fewer than 5 matched games is too few", () => {
    const logs = teamGames(4, { players: { [P]: () => ({ min: 30 }) } });
    expect(!buildPools(ctx(logs)).ok).toBe(true);
  });

  it("excludes games on another team", () => {
    const logs = teamGames(12, { players: { [P]: () => ({ min: 30, pts: 10 }) } }).map((l, i) =>
      i < 6 ? { ...l, teamId: "OTHER" } : l,
    );
    expect(ok(buildPools(ctx(logs))).base.length).toBe(6);
  });

  it("matched_pool draws past the 30-game base cap", () => {
    // A sits only in the oldest 12 of 50 games; with A out, matches come from beyond the recent 30.
    const logs = teamGames(50, { players: { [P]: () => ({ min: 30 }), A: (i) => ({ min: i < 12 ? 0 : 30 }) } });
    const pools = ok(buildPools(ctx(logs, { teammates: [{ playerId: "A", status: "out" }] })));
    expect(pools.base.length).toBe(30);
    expect(pools.matched.length).toBe(12);
  });
});

describe("projection", () => {
  it("blends the matched rate toward the base rate with a 200-minute prior", () => {
    // Base: 30 games of 0.5 pts/min. Matched (A out): 6 games at 1.0 pts/min.
    const logs = teamGames(30, {
      players: {
        [P]: (i) => (i >= 24 ? { min: 30, pts: 30 } : { min: 30, pts: 15 }),
        A: (i) => ({ min: i >= 24 ? 0 : 30 }),
      },
    });
    const pools = ok(buildPools(ctx(logs, { teammates: [{ playerId: "A", status: "out" }] })));
    const pr = project(pools, "pts");
    const rateBase = (6 * 30 + 24 * 15) / (30 * 30);
    expect(pr.rateBase).toBeCloseTo(rateBase, 12);
    expect(pr.rateMatched).toBeCloseTo(1, 12);
    expect(pr.rateFinal).toBeCloseTo((180 + 200 * rateBase) / (180 + 200), 12);
    expect(pr.flags).toContain("thin_sample");
    expect(pr.flags).toContain("dispersion_from_base_pool");
  });

  it("short appearances stay in the minutes sample but not in rate or alpha", () => {
    const logs = teamGames(20, { players: { [P]: (i) => (i % 5 === 0 ? { min: 4, pts: 0 } : { min: 30, pts: 15 }) } });
    const pools = ok(buildPools(ctx(logs)));
    const pr = project(pools, "pts");
    expect(pr.rateMatched).toBeCloseTo(0.5, 12);
    expect(pr.counts.rateMatched).toBe(16);
    expect(pr.counts.minutes).toBe(20);
    expect(pr.expMinutes).toBeCloseTo((16 * 30 + 4 * 4) / 20, 12);
    expect(pools.matched.filter((g) => g.shortAppearance).length).toBe(4);
  });

  it("underdispersed history floors alpha to 0 and degenerates to Poisson with constant minutes", () => {
    const logs = teamGames(20, { players: { [P]: () => ({ min: 30, pts: 15 }) } });
    const pr = project(ok(buildPools(ctx(logs))), "pts");
    expect(pr.alpha).toBe(0);
    expect(pr.alphaPositive).toBe(false);
    expect(pr.flags).toContain("dispersion_floor");
    expect(pr.distKind).toBe("poisson");
    expect(pr.variance).toBeCloseTo(pr.mean, 9);
  });

  it("uses last season's minutes only when this season has under 3 matched games", () => {
    const last = teamGames(10, { season: "2024-25", lastDate: "2025-04-10", prefix: "L", players: { [P]: () => ({ min: 20, pts: 10 }) } });
    const now = teamGames(2, { players: { [P]: () => ({ min: 36, pts: 18 }) } });
    const pr = project(ok(buildPools(ctx([...last, ...now]))), "pts");
    expect(pr.flags).toContain("minutes_prior_season");
    expect(pr.expMinutes).toBe(20);
    expect(pr.varMinutes).toBe(0);
  });

  it("method-of-moments alpha recovers the NB2 formula", () => {
    const games = [{ x: 10, m: 20 }, { x: 20, m: 20 }, { x: 0, m: 0 }];
    const r = 0.75;
    const { alpha, n } = alphaMoM(games, r);
    expect(n).toBe(2);
    expect(alpha).toBeCloseTo((((10 - 15) ** 2 + (20 - 15) ** 2) / 2 - 15) / 225, 12);
  });

  it("sensitivity names each test that falls below the bar", () => {
    const logs = teamGames(20, { players: { [P]: (i) => ({ min: 28 + (i % 5), pts: 12 + (i % 7) }) } });
    const pr = project(ok(buildPools(ctx(logs))), "pts");
    const s = sensitivity(pr, Math.floor(pr.mean) - 3.5, "over", 1.91, 1, 0.08);
    expect(s.minusMinutes).toBeLessThan(s.plusMinutes);
    const tight = sensitivity(pr, Math.floor(pr.mean) - 3.5, "over", 1.91, 1, 10);
    expect(tight.failing).toEqual(["minutes_minus", "minutes_plus", "variance_wide"]);
  });
});
