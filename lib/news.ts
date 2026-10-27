import type { TonightStatus } from "./board.ts";

export type StatusSource = "official" | "espn";

export interface CurrentStatus {
  status: TonightStatus;
  source: StatusSource;
  sourceTime: string;
  note: string;
}

export interface StatusChange {
  playerId: string;
  playerName: string;
  teamId: string;
  from: TonightStatus | "unknown";
  to: TonightStatus;
  source: StatusSource;
  sourceTime: string;
  note: string;
}

export interface RowFlag extends StatusChange {
  kind: "player" | "teammate";
}

const SEVERITY: Record<TonightStatus | "unknown", number> = { unknown: 0, active: 0, questionable: 1, doubtful: 2, out: 3 };

/** Keeps the more severe of two statuses; on a tie, the official report. */
export function worse(a: CurrentStatus | undefined, b: CurrentStatus): CurrentStatus {
  if (!a) return b;
  if (SEVERITY[b.status] !== SEVERITY[a.status]) return SEVERITY[b.status] > SEVERITY[a.status] ? b : a;
  return a.source === "official" ? a : b;
}

/** Statuses that got worse since the board was built. */
export function detectChanges(
  built: Record<string, { unresolved: boolean; status: Record<string, TonightStatus> }>,
  current: Record<string, Map<string, CurrentStatus>>,
  names: Map<string, string>,
): StatusChange[] {
  const out: StatusChange[] = [];
  for (const [teamId, now] of Object.entries(current)) {
    const b = built[teamId];
    for (const [playerId, c] of now) {
      const from: TonightStatus | "unknown" = b?.status[playerId] ?? (b?.unresolved ? "unknown" : "active");
      if (SEVERITY[c.status] > SEVERITY[from])
        out.push({ playerId, playerName: names.get(playerId) ?? playerId, teamId, from, to: c.status, ...c });
    }
  }
  return out;
}

/** Flags each published row whose player, or a rotation teammate, changed status. */
export function flagRows(
  rows: { key: string; playerId: string; teamId: string }[],
  changes: StatusChange[],
  rotation: (teamId: string) => Set<string>,
): Record<string, RowFlag[]> {
  const out: Record<string, RowFlag[]> = {};
  for (const r of rows) {
    const flags: RowFlag[] = [];
    for (const c of changes) {
      if (c.teamId !== r.teamId) continue;
      if (c.playerId === r.playerId) flags.push({ ...c, kind: "player" });
      else if (rotation(r.teamId).has(c.playerId)) flags.push({ ...c, kind: "teammate" });
    }
    if (flags.length) out[r.key] = flags;
  }
  return out;
}
