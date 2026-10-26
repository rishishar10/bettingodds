import type { Side } from "./types.ts";

/** Primary CLV on the same book, side and line: positive means the morning price was longer. */
export function clvRatio(morningDecimal: number, closingDecimal: number): number {
  return morningDecimal / closingDecimal - 1;
}

/** Secondary CLV: EV of the morning price at the no-vig closing probability. */
export function clvNoVig(morningDecimal: number, pCloseNoVig: number): number {
  return morningDecimal * pCloseNoVig - 1;
}

export type LineMove = "toward" | "away" | "same";

/** Model-free direction of a line move relative to our side. */
export function lineDirection(side: Side, morningLine: number, closingLine: number): LineMove {
  if (closingLine === morningLine) return "same";
  const up = closingLine > morningLine;
  return (side === "over") === up ? "toward" : "away";
}

export type ClosingComparison =
  | { kind: "same_line"; movement: number; direction: "better" | "worse" | "equal" }
  | { kind: "different_line"; move: LineMove }
  | { kind: "missing_close" };

export function compareClose(
  side: Side,
  morning: { line: number; decimal: number },
  close: { line: number; decimal: number } | null,
): ClosingComparison {
  if (!close) return { kind: "missing_close" };
  if (close.line !== morning.line) return { kind: "different_line", move: lineDirection(side, morning.line, close.line) };
  const movement = clvRatio(morning.decimal, close.decimal);
  return { kind: "same_line", movement, direction: movement > 0 ? "better" : movement < 0 ? "worse" : "equal" };
}
