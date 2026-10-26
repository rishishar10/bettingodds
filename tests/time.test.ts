import { describe, expect, it } from "vitest";
import { boardInstant, pacificDate, seasonOf } from "../lib/time.ts";

describe("Pacific board time", () => {
  it("8:00am Pacific is 16:00Z in winter and 15:00Z in summer", () => {
    expect(boardInstant("2026-01-15")).toBe("2026-01-15T16:00:00.000Z");
    expect(boardInstant("2026-04-10")).toBe("2026-04-10T15:00:00.000Z");
    expect(boardInstant("2025-11-02")).toBe("2025-11-02T16:00:00.000Z");
  });

  it("a 7pm Pacific tip is still that Pacific date", () => {
    expect(pacificDate("2026-01-16T03:00:00Z")).toBe("2026-01-15");
  });

  it("season labels", () => {
    expect(seasonOf("2025-10-22")).toBe("2025-26");
    expect(seasonOf("2026-04-12")).toBe("2025-26");
  });
});
