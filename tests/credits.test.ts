import { describe, expect, it } from "vitest";
import { datesUntilReset, shouldBuildTonight } from "../lib/credits.ts";

describe("free-plan credit pacing", () => {
  it("always skips slates under 4 games", () => {
    expect(shouldBuildTonight(3, [], 500).build).toBe(false);
  });

  it("builds when credits cover every remaining slate", () => {
    expect(shouldBuildTonight(8, [10, 6, 7], 500).build).toBe(true);
  });

  it("drops the lightest nights when credits run short", () => {
    // 60 credits cover 20 games: keep 10 + 9 (57 credits); tonight's 5 is the lightest.
    expect(shouldBuildTonight(5, [10, 9, 6], 60).build).toBe(false);
    expect(shouldBuildTonight(10, [5, 9, 6], 60).build).toBe(true);
  });

  it("tonight wins a tie with a later slate", () => {
    expect(shouldBuildTonight(8, [8], 24).build).toBe(true);
  });

  it("lists the days up to the reset", () => {
    expect(datesUntilReset("2026-10-27", 26)[0]).toBe("2026-10-28");
    expect(datesUntilReset("2026-10-27", 26).at(-1)).toBe("2026-11-25");
    expect(datesUntilReset("2026-11-24", 26)).toEqual(["2026-11-25"]);
    expect(datesUntilReset("2026-11-25", 26)).toEqual([]);
  });
});
