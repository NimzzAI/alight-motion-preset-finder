import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="header-shell">
      <div className="wrap header">
        {/* Clean Studio Brand Logo */}
        <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
          <span className="brand-dot" aria-hidden="true" />
          <span className="brand-text">
            Preset <span className="brand-highlight">Finder</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav desktop-nav" aria-label="Navigasi utama">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="nav-link"
          >
            <i className="fa-solid fa-sliders nav-icon" aria-hidden="true"></i>
            <span>Preset Finder</span>
          </Link>
          <Link
            to="/tiktok"
            className="nav-link"
          >
            <i className="fa-brands fa-tiktok nav-icon" aria-hidden="true"></i>
            <span>TikTok</span>
          </Link>
          <Link
            to="/aio"
            className="nav-link"
          >
            <i className="fa-solid fa-photo-film nav-icon" aria-hidden="true"></i>
            <span>All-in-One</span>
          </Link>
        </nav>

        {/* Header Right Actions */}
        <div className="header-right">
          <ThemeToggle />

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            aria-expanded={mobileOpen}
          >
            <span className="mobile-toggle-box" aria-hidden="true">
              {mobileOpen ? (
                <i className="fa-solid fa-xmark mobile-toggle-fa"></i>
              ) : (
                <i className="fa-solid fa-bars mobile-toggle-fa"></i>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileOpen && (
        <div className="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="Menu navigasi mobile">
          <div className="wrap mobile-nav-content">
            <div className="mobile-nav-header">
              <span className="mobile-nav-subtitle">
                <i className="fa-solid fa-compass" aria-hidden="true"></i> Navigasi Menu
              </span>
              <span className="mobile-nav-status">Alight Motion &amp; Media</span>
            </div>
            <nav className="mobile-nav-links">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                className="mobile-nav-link"
                onClick={() => setMobileOpen(false)}
              >
                <i className="fa-solid fa-sliders mobile-nav-fa" aria-hidden="true"></i>
                <div className="mobile-nav-info">
                  <span className="mobile-nav-title">Preset Finder</span>
                  <span className="mobile-nav-desc">Pindai link video atau cari via judul</span>
                </div>
              </Link>
              <Link
                to="/tiktok"
                className="mobile-nav-link"
                onClick={() => setMobileOpen(false)}
              >
                <i className="fa-brands fa-tiktok mobile-nav-fa" aria-hidden="true"></i>
                <div className="mobile-nav-info">
                  <span className="mobile-nav-title">TikTok Downloader</span>
                  <span className="mobile-nav-desc">Unduh HD tanpa watermark &amp; musik</span>
                </div>
              </Link>
              <Link
                to="/aio"
                className="mobile-nav-link"
                onClick={() => setMobileOpen(false)}
              >
                <i className="fa-solid fa-photo-film mobile-nav-fa" aria-hidden="true"></i>
                <div className="mobile-nav-info">
                  <span className="mobile-nav-title">All-in-One Media</span>
                  <span className="mobile-nav-desc">Downloader video &amp; audio multi-format</span>
                </div>
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
