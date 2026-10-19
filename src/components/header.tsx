import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="wrap header">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Preset Finder
      </Link>
      <nav className="nav" aria-label="Navigasi utama">
        <Link to="/" activeOptions={{ exact: true }}>
          Preset
        </Link>
        <Link to="/tiktok">TikTok</Link>
        <Link to="/aio">Downloader AIO</Link>
      </nav>
      <div className="header-right">
        <ThemeToggle />
      </div>
    </header>
  );
}
