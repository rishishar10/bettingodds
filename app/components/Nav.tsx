import Link from "next/link";

export function Nav({ current }: { current: "board" | "history" }) {
  return (
    <nav className="nav" aria-label="Pages">
      <Link href="/" aria-current={current === "board" ? "page" : undefined}>Morning board</Link>
      <Link href="/history/" aria-current={current === "history" ? "page" : undefined}>History and calibration</Link>
    </nav>
  );
}

export function Footer() {
  return (
    <p className="fine" style={{ marginTop: 64 }}>
      For information only. 21+. This page places no bets, holds no accounts, and is not betting advice.
      Saved prices are labeled with their source time and are not live.
    </p>
  );
}
