import { describe, expect, it } from "vitest";
import { boardInstant, nextBoardDate, pacificDate, seasonOf } from "../lib/time.ts";

describe("Pacific board time", () => {
  it("the board snapshot is 9:00am Pacific on the board date, across DST", () => {
    expect(boardInstant("2026-01-15")).toBe("2026-01-15T17:00:00.000Z");
    expect(boardInstant("2026-04-10")).toBe("2026-04-10T16:00:00.000Z");
    expect(boardInstant("2026-11-01")).toBe("2026-11-01T17:00:00.000Z");
  });

  it("a build is for today's Pacific date", () => {
    expect(nextBoardDate("2026-10-27T16:05:00Z")).toBe("2026-10-27"); // 9:05am Oct 27 PDT
    expect(nextBoardDate("2026-10-27T06:05:00Z")).toBe("2026-10-26"); // 11:05pm Oct 26 PDT
  });

  it("a 7pm Pacific tip is still that Pacific date", () => {
    expect(pacificDate("2026-01-16T03:00:00Z")).toBe("2026-01-15");
  });

  it("season labels", () => {
    expect(seasonOf("2025-10-22")).toBe("2025-26");
    expect(seasonOf("2026-04-12")).toBe("2025-26");
  });
});
