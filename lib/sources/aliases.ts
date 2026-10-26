// Curated aliases: source spelling (normalized) → canonical normalized name.
// Add entries when the validation report lists an unmatched name.
export const PLAYER_ALIASES: Record<string, string> = {
  "nicolas claxton": "nic claxton",
  "herb jones": "herbert jones",
  "cam johnson": "cameron johnson",
  "moe wagner": "moritz wagner",
  "kenyon martin": "kj martin",
  "gg jackson": "gregory jackson",
  "alexandre sarr": "alex sarr",
  "carlton carrington": "bub carrington",
};

export const TEAM_ALIASES: Record<string, string> = {
  "la clippers": "los angeles clippers",
  "la lakers": "los angeles lakers",
};

const SUFFIX = /\b(jr|sr|ii|iii|iv|v)\b/g;

export function normalizeName(s: string): string {
  const n = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’`-]/g, (c) => (c === "-" ? " " : ""))
    .replace(SUFFIX, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return PLAYER_ALIASES[n] ?? n;
}

export function normalizeTeam(s: string): string {
  const n = s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return TEAM_ALIASES[n] ?? n;
}
