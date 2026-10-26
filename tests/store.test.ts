import { describe, expect, it } from "vitest";
import { openStore } from "../lib/store.ts";
import type { EvaluatedRow } from "../lib/rank.ts";

const row = (key: string): EvaluatedRow => ({
  key, eventId: "e", playerId: "p", playerName: "P", stat: "pts", line: 20.5, side: "over", book: "draftkings",
  decimal: 2, sourceUpdatedAt: "2026-01-15T15:55:00Z", raw: { win: 0.6, push: 0, loss: 0.4 },
  final: { win: 0.55, push: 0, loss: 0.45 }, ev: 0.1, books: { draftkings: "best", fanduel: "no_market", betmgm: "no_market" },
  state: "published",
});
const pub = (boardDate: string) => ({ boardDate, publishedAt: "2026-01-15T16:01:00Z", modelVersion: "heuristic-v1", ruleHash: null, payload: { rows: 1 } });

describe("store", () => {
  it("keeps one publication per date; a failed second publish writes nothing", () => {
    const s = openStore(":memory:");
    s.publish(pub("2026-01-15"), [row("a"), { ...row("b"), state: "below_bar" }], [{ playerId: "x", reason: "too_few_games", detail: "" }]);
    expect(() => s.publish(pub("2026-01-15"), [row("c")], [])).toThrow(/already published/);
    expect(s.listPublications()).toHaveLength(1);
    expect(s.evaluatedFor("2026-01-15")).toHaveLength(2);
    expect(s.evaluatedFor("2026-01-15", "published")).toHaveLength(1);
  });

  it("a correction appends an event and updates the current grade", () => {
    const s = openStore(":memory:");
    s.recordGrade("2026-01-15", "a", "loss", 30, 19, "t1");
    s.recordGrade("2026-01-15", "a", "loss", 30, 19, "t2");
    s.recordGrade("2026-01-15", "a", "win", 30, 21, "t3");
    const events = s.db.prepare("SELECT kind FROM grade_events").all() as { kind: string }[];
    expect(events.map((e) => e.kind)).toEqual(["grade", "correction"]);
    expect(s.currentGrade("2026-01-15", "a")?.result).toBe("win");
  });

  it("stores pulled and moved_past_bar conditional states separately", () => {
    const s = openStore(":memory:");
    const base = { boardDate: "2026-01-15", subjectPlayerId: "q", stat: "pts", line: 20.5, side: "over" };
    s.setConditionalState({ ...base, playerId: "a", state: "pulled" });
    s.setConditionalState({ ...base, playerId: "b", state: "moved_past_bar", decimal: 1.7, ev: 0.02 });
    s.setConditionalState({ ...base, playerId: "c", state: "still_clearing", decimal: 2.0, ev: 0.12 });
    expect(s.conditionalCounts()).toEqual({ pulled: 1, moved_past_bar: 1, still_clearing: 1 });
  });
});
