import { useState, type FormEvent } from "react";
import { RecentSearches, useRecentSearches } from "./recent-searches";

type Props = {
  onSubmit: (url: string) => void;
  loading: boolean;
  button: string;
  validate: (value: string) => boolean;
  invalid: string;
  label?: string;
  placeholder?: string;
};

export function UrlForm({
  onSubmit,
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!validate(url)) {
      setHint(invalid);
      return;
    }
    setHint("");
    addRecent(url);
    onSubmit(url);
  };

  const selectRecent = (url: string) => {
    setValue(url);
    setHint("");
    addRecent(url);
    onSubmit(url);
  };

  const paste = async () => {
    try {
      setValue((await navigator.clipboard.readText()).trim());
      setHint("");
    } catch {
      setHint("Izin clipboard ditolak, tempel manual aja.");
    }
  };

  return (
    <div className="form-container">
      <form className="form" onSubmit={submit}>
        <label htmlFor="url" className="label">
          {label}
        </label>
        <div className={`input-wrap ${loading ? "is-loading" : ""}`}>
          <input
            id="url"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {loading && <span className="input-scan-bar" aria-hidden="true" />}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={loading}>
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
            ) : (
              button
            )}
          </button>
          <button type="button" className="btn ghost" onClick={paste} disabled={loading}>
            Tempel
          </button>
        </div>
        {hint && <p className="hint">{hint}</p>}
      </form>
      <RecentSearches onSelect={selectRecent} activeUrl={value} loading={loading} />
    </div>
  );
}
