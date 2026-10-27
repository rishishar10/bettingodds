import { describe, expect, it } from "vitest";
import { detectChanges, flagRows, worse, type CurrentStatus } from "../lib/news.ts";

const cur = (status: CurrentStatus["status"], source: CurrentStatus["source"] = "official"): CurrentStatus =>
  ({ status, source, sourceTime: "2026-10-26T21:00:00Z", note: "" });

describe("news watch", () => {
  const built = {
    OKC: { unresolved: false, status: { sorber: "out" as const } },
    PHX: { unresolved: false, status: {} },
  };
  const names = new Map([["jdub", "Jalen Williams"], ["sga", "Shai Gilgeous-Alexander"], ["sorber", "Thomas Sorber"]]);

  it("reports only statuses that got worse since the build", () => {
    const changes = detectChanges(built, { OKC: new Map([["jdub", cur("out")], ["sorber", cur("out")]]) }, names);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ playerId: "jdub", playerName: "Jalen Williams", from: "active", to: "out" });
  });

  it("flags the player's own row and rotation teammates' rows, not other teams", () => {
    const changes = detectChanges(built, { OKC: new Map([["jdub", cur("out")]]) }, names);
    const rows = [
      { key: "jdub-pts", playerId: "jdub", teamId: "OKC" },
      { key: "sga-pts", playerId: "sga", teamId: "OKC" },
      { key: "booker-pts", playerId: "booker", teamId: "PHX" },
    ];
    const flags = flagRows(rows, changes, () => new Set(["jdub", "sga"]));
    expect(flags["jdub-pts"][0].kind).toBe("player");
    expect(flags["sga-pts"][0].kind).toBe("teammate");
    expect(flags["booker-pts"]).toBeUndefined();
  });

  it("keeps the more severe status, preferring the official report on a tie", () => {
    expect(worse(cur("questionable", "official"), cur("out", "espn")).source).toBe("espn");
    expect(worse(cur("out", "official"), cur("out", "espn")).source).toBe("official");
  });
});
