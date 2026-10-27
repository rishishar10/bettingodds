import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coverageOf, saveDay, saveSkip, type ReplayDay } from "../lib/replay-data.ts";

describe("replay coverage", () => {
  const cwd = process.cwd();
  let dir = "";
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), "cov-")); process.chdir(dir); });
  afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }); });

  it("counts collected and skipped dates and lists the missing ones", () => {
    saveDay("test", { boardDate: "2025-10-22", availability: "report" } as ReplayDay);
    saveSkip("test", "report", "2025-10-23", "no injury report before the snapshot");
    const c = coverageOf("test", "report", ["2025-10-22", "2025-10-23", "2025-10-24"]);
    expect(c).toEqual({ expected: 3, collected: 1, skipped: { "2025-10-23": "no injury report before the snapshot" }, missing: ["2025-10-24"] });
  });
});
