import { normalizeTeam } from "./aliases.ts";

// ESPN's public injury feed: one current note per player, with the note's time.
// No history is kept, so it is only usable live, never in a replay.
const URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";

export interface EspnInjury {
  team: string;
  playerName: string;
  status: "out" | "doubtful" | "questionable";
  rawStatus: string;
  updatedAt: string;
  note: string;
}

const STATUS: Record<string, EspnInjury["status"]> = {
  out: "out",
  doubtful: "doubtful",
  questionable: "questionable",
  "day-to-day": "questionable",
};

export function parseEspnInjuries(body: any): EspnInjury[] {
  const out: EspnInjury[] = [];
  for (const t of body?.injuries ?? []) {
    for (const i of t.injuries ?? []) {
      const status = STATUS[String(i.status ?? "").toLowerCase()];
      if (!status || !i.athlete?.displayName || !i.date) continue;
      out.push({
        team: normalizeTeam(t.displayName ?? ""),
        playerName: i.athlete.displayName,
        status,
        rawStatus: i.status,
        updatedAt: new Date(i.date).toISOString(),
        note: i.shortComment ?? "",
      });
    }
  }
  return out;
}

export async function fetchEspnInjuries(): Promise<EspnInjury[]> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`espn injuries ${res.status}`);
  return parseEspnInjuries(await res.json());
}
