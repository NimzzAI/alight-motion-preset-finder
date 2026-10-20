import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={toggle}
      aria-label={theme === "light" ? "Beralih ke mode gelap" : "Beralih ke mode terang"}
      title={theme === "light" ? "Mode Gelap" : "Mode Terang"}
    >
      <span className="theme-icon-wrap" aria-hidden="true">
        {mounted && theme === "dark" ? (
          <i className="fa-solid fa-moon theme-fa-icon"></i>
        ) : (
          <i className="fa-solid fa-sun theme-fa-icon"></i>
        )}
      </span>
      <span className="theme-label">{mounted && theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
