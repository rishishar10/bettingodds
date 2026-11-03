// Free key check (the sports list costs no credits). Fails the job with a clear
// message before any paid call when the saved key is wrong. Prints credits left.
import { cleanKey } from "../../lib/sources/odds.ts";

const k = cleanKey(process.env.ODDS_API_KEY);
if (!k) {
  console.log("no ODDS_API_KEY: demo mode");
  process.exit(0);
}
const res = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${k}`);
if (!res.ok) {
  console.error(`odds key rejected (HTTP ${res.status}, ${k.length} characters). Re-paste the ODDS_API_KEY secret: the 32-character key only.`);
  process.exit(1);
}
console.log(`odds key ok, ${res.headers.get("x-requests-remaining")} credits left this month`);
