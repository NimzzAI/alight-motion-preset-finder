import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="header-shell">
      <div className="wrap header">
        <Link to="/" className="brand">
          Preset Finder
        </Link>
        <nav className="nav" aria-label="Navigasi utama">
          <Link to="/" activeOptions={{ exact: true }}>
            Preset Finder
          </Link>
          <Link to="/tiktok">TikTok Downloader</Link>
          <Link to="/aio">All-in-One Media</Link>
        </nav>
        <div className="header-right">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

