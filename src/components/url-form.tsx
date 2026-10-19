import { useState, type FormEvent } from "react";
import { RecentSearches, useRecentSearches } from "./recent-searches";

type Props = {
  onSubmit: (url: string) => void;
  onKeywordSubmit?: (keyword: string) => void;
  loading: boolean;
  button: string;
  validate: (value: string) => boolean;
  invalid: string;
  label?: string;
  placeholder?: string;
};

export function UrlForm({
  onSubmit,
  onKeywordSubmit,
  loading,
  button,
  validate,
  invalid,
  label = "Link video TikTok",
  placeholder = "https://vt.tiktok.com/...",
}: Props) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");
  const { addRecent } = useRecentSearches();

  const trimmed = value.trim();
  const isUrlInput = /^https?:\/\//i.test(trimmed) || /^(?:www\.|vt\.|vm\.)?(?:tiktok|youtube|youtu|instagram)\./i.test(trimmed);
  const isKeywordMode = Boolean(onKeywordSubmit && trimmed.length >= 2 && !isUrlInput);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) {
      setHint(invalid);
      return;
    }
    if (validate(raw) && isUrlInput) {
      setHint("");
      addRecent(raw);
      onSubmit(raw);
      return;
    }
    if (onKeywordSubmit && raw.length >= 2 && !isUrlInput) {
      setHint("");
      addRecent(raw);
      onKeywordSubmit(raw);
      return;
    }
    if (validate(raw)) {
      setHint("");
      addRecent(raw);
      onSubmit(raw);
      return;
    }
    setHint(invalid);
  };

  const selectRecent = (item: string) => {
    setValue(item);
    setHint("");
    addRecent(item);
    const itemIsUrl = /^https?:\/\//i.test(item.trim());
    if (validate(item) && itemIsUrl) {
      onSubmit(item);
    } else if (onKeywordSubmit && !itemIsUrl) {
      onKeywordSubmit(item);
    } else if (validate(item)) {
      onSubmit(item);
    }
  };

  const paste = async () => {
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      setValue(clip);
      setHint("");
    } catch {
      setHint("Izin clipboard ditolak, tempel manual aja.");
    }
  };

  const clearInput = () => {
    setValue("");
    setHint("");
  };

  return (
    <div className="form-container stagger-3">
      <form className="form" onSubmit={submit}>
        <div className="form-label-row">
          <label htmlFor="url" className="label">
            {label}
          </label>
          {trimmed.length >= 2 && (
            <span className={`input-mode-indicator ${isKeywordMode ? "mode-keyword" : "mode-url"}`}>
              <span className="mode-dot" aria-hidden="true" />
              {isKeywordMode ? "Mode Judul: Cari 10+ Preset TikTok" : "Mode Tautan: Pindai Video Langsung"}
            </span>
          )}
        </div>
        <div className={`input-wrap ${loading ? "is-loading" : ""}`}>
          <input
            id="url"
            className="input has-clear"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {value && !loading && (
            <button
              type="button"
              className="input-clear-btn"
              onClick={clearInput}
              aria-label="Bersihkan teks"
              title="Bersihkan"
            >
              ×
            </button>
          )}
          {loading && <span className="input-scan-bar" aria-hidden="true" />}
        </div>
        <div className="form-actions">
          <button type="submit" className={`btn ${isKeywordMode ? "btn-sage" : ""}`} disabled={loading}>
            {loading ? (
              <span className="btn-loading-content">
                <svg
                  className="btn-spinner"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Memproses...
              </span>
            ) : isKeywordMode ? (
              `Cari 10+ Preset "${trimmed.slice(0, 22)}${trimmed.length > 22 ? "…" : ""}"`
            ) : (
              button
            )}
          </button>
          <button type="button" className="btn ghost" onClick={paste} disabled={loading}>
            Tempel Clipboard
          </button>
        </div>
        {hint && <p className="hint">{hint}</p>}
      </form>
      <RecentSearches onSelect={selectRecent} activeUrl={value} loading={loading} />
    </div>
  );
}
