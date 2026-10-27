import { describe, expect, it } from "vitest";
import { boardInstant, nextBoardDate, pacificDate, seasonOf } from "../lib/time.ts";

describe("Pacific board time", () => {
  it("the board snapshot is 11:00pm Pacific the evening before, across DST", () => {
    expect(boardInstant("2026-01-15")).toBe("2026-01-15T07:00:00.000Z");
    expect(boardInstant("2026-04-10")).toBe("2026-04-10T06:00:00.000Z");
    // The night of the November DST change: Nov 1 11pm is PST.
    expect(boardInstant("2026-11-02")).toBe("2026-11-02T07:00:00.000Z");
  });

  it("a build from 8pm Pacific on is for tomorrow", () => {
    expect(nextBoardDate("2026-10-27T06:05:00Z")).toBe("2026-10-27"); // 11:05pm Oct 26 PDT
    expect(nextBoardDate("2026-10-27T07:05:00Z")).toBe("2026-10-27"); // 12:05am Oct 27 PDT
    expect(nextBoardDate("2026-10-26T18:00:00Z")).toBe("2026-10-26"); // 11am Oct 26
  });

  it("a 7pm Pacific tip is still that Pacific date", () => {
    expect(pacificDate("2026-01-16T03:00:00Z")).toBe("2026-01-15");
  });

  it("season labels", () => {
    expect(seasonOf("2025-10-22")).toBe("2025-26");
    expect(seasonOf("2026-04-12")).toBe("2025-26");
  });
});
