import { describe, expect, it } from "vitest";
import { countConditional, resolveConditional } from "../lib/conditional.ts";

const news = "2026-01-15T22:00:00Z";
const price = (sourceUpdatedAt: string, ev: number, fetchedAt = "2026-01-15T22:30:00Z") => ({ decimal: 2, ev, sourceUpdatedAt, fetchedAt });

describe("if-they-sit cards", () => {
  it("is pulled when no price has a source time after the news, even if fetched after", () => {
    const r = resolveConditional("out", news, [price("2026-01-15T21:50:00Z", 0.2)], 0.08);
    expect(r.state).toBe("pulled");
    expect(r.graded).toBe(false);
  });

  it("grades at the first post-news price only if it still clears the bar", () => {
    const prices = [price("2026-01-15T22:40:00Z", 0.12), price("2026-01-15T22:10:00Z", 0.03)];
    const r = resolveConditional("out", news, prices, 0.08);
    expect(r.state).toBe("moved_past_bar");
    expect(r.price?.sourceUpdatedAt).toBe("2026-01-15T22:10:00Z");
    expect(resolveConditional("out", news, [price("2026-01-15T22:10:00Z", 0.09)], 0.08).state).toBe("still_clearing");
  });

  it("confirmed active and unresolved are not graded", () => {
    expect(resolveConditional("active", news, [], 0.08).state).toBe("confirmed_active");
    expect(resolveConditional(null, null, [], 0.08).state).toBe("expired");
  });

  it("survival keeps pulled cards in the denominator", () => {
    const c = countConditional(["still_clearing", "pulled", "moved_past_bar", "confirmed_active", "expired"]);
    expect(c.confirmedOut).toBe(3);
    expect(c.survival).toBeCloseTo(1 / 3, 12);
    expect(c.initiallyQualifying).toBe(5);
  });
});
