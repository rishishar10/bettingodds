import { describe, expect, it } from "vitest";
import { cleanKey } from "../lib/sources/odds.ts";

describe("cleanKey", () => {
  const k = "0123456789abcdef0123456789abcdef";
  it("strips the junk a pasted secret picks up", () => {
    for (const raw of [k, ` ${k}\n`, `"${k}"`, `'${k}'`, `ODDS_API_KEY=${k}`, `ODDS_API_KEY = "${k}"\r\n`]) expect(cleanKey(raw)).toBe(k);
  });
  it("is empty when unset", () => expect(cleanKey(undefined)).toBe(""));
});
