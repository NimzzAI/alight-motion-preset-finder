import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="wrap header">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        preset finder
      </Link>
      <div className="header-right">
        <nav className="nav">
          <Link to="/" activeOptions={{ exact: true }}>
            Preset
          </Link>
          <Link to="/tiktok">TikTok</Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
