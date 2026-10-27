"use client";
import { useState } from "react";

/** playerId is the ESPN athlete id the box-score ingest already stores. */
export const headshotUrl = (playerId: string) =>
  `https://a.espncdn.com/i/headshots/nba/players/full/${playerId}.png`;

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** Player photo with an initials fallback when the image is missing. */
export function Headshot({ playerId, name, size, tile = false }: { playerId: string; name: string; size: number; tile?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={tile ? "shot tile" : "shot"} style={{ width: size, height: size, fontSize: size }}>
      <span className="ini" aria-hidden="true">{initials(name)}</span>
      {!failed && <img src={headshotUrl(playerId)} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </span>
  );
}
