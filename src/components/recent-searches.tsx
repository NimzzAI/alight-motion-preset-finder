import { useEffect, useState } from "react";

type Props = {
  onSelect: (url: string) => void;
  activeUrl?: string;
  loading?: boolean;
};

const STORAGE_KEY = "recent_queries";
const MAX_ITEMS = 6;

export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          setRecents(parsed.filter((item): item is string => typeof item === "string" && Boolean(item)));
        }
      }
    } catch {}
  }, []);

  const addRecent = (url: string) => {
    try {
      const trimmed = url.trim();
      if (!trimmed) return;
      setRecents((prev) => {
        const next = [trimmed, ...prev.filter((u) => u !== trimmed)].slice(0, MAX_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch {}
  };

  const removeRecent = (url: string) => {
    try {
      setRecents((prev) => {
        const next = prev.filter((u) => u !== url);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch {}
  };

  const clearRecents = () => {
    try {
      setRecents([]);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return { recents, addRecent, removeRecent, clearRecents };
}

function formatUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.length > 24 ? parsed.pathname.slice(0, 22) + "…" : parsed.pathname;
    return `${host}${path}`;
  } catch {
    return raw.length > 30 ? raw.slice(0, 28) + "…" : raw;
  }
}

export function RecentSearches({ onSelect, activeUrl, loading }: Props) {
  const { recents, removeRecent, clearRecents } = useRecentSearches();

  if (recents.length === 0) return null;

  return (
    <div className="recent-searches">
      <div className="recent-header">
        <span className="label">Pencarian Terakhir</span>
        <button
          type="button"
          className="recent-clear-btn"
          onClick={clearRecents}
          disabled={loading}
        >
          Hapus Semua
        </button>
      </div>
      <ul className="recent-list">
        {recents.map((url) => {
          const isActive = activeUrl === url && loading;
          return (
            <li key={url} className={`recent-item ${isActive ? "active" : ""}`}>
              <button
                type="button"
                className="recent-chip"
                onClick={() => onSelect(url)}
                disabled={loading}
                title={url}
              >
                <svg
                  className="recent-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="recent-text">{formatUrl(url)}</span>
              </button>
              <button
                type="button"
                className="recent-remove-btn"
                onClick={() => removeRecent(url)}
                disabled={loading}
                aria-label={`Hapus ${url}`}
                title="Hapus"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
