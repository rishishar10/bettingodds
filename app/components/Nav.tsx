import Link from "next/link";

export function Nav({ current }: { current: "board" | "history" }) {
  return (
    <nav className="topbar" aria-label="Pages">
      <div className="topbar-in">
        <span className="brand">
          <span className="brand-mark">MB</span>
          <span className="brand-name">Morning Board</span>
          <span className="brand-tag">NBA</span>
        </span>
        <div className="pills">
          <Link className="pill" href="/" aria-current={current === "board" ? "page" : undefined}>Tonight</Link>
          <Link className="pill" href="/history/" aria-current={current === "history" ? "page" : undefined}>Track record</Link>
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <p className="footer">
      For information only. 21+. This page places no bets, holds no accounts, and is not betting advice.
      Saved prices are labeled with their source time and are not live.
    </p>
  );
}
