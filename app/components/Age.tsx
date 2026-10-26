"use client";
import { useEffect, useState } from "react";

/** Age of a saved price at the moment of viewing. */
export function Age({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  const text = m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
  return <>{text}</>;
}
