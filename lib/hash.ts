import { createHash } from "node:crypto";

/** JSON with sorted keys, so the hash does not depend on key order. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export const hashOf = (v: unknown) => sha256(canonicalJson(v));
