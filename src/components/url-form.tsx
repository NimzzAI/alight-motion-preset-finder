import { useState, type FormEvent } from "react";
import { isTikTokInput } from "../lib/validate";

type Props = {
  onSubmit: (url: string) => void;
  loading: boolean;
  button: string;
};

export function UrlForm({ onSubmit, loading, button }: Props) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!isTikTokInput(url)) {
      setHint("Itu bukan link TikTok, coba cek lagi.");
      return;
    }
    setHint("");
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
    <form className="form" onSubmit={submit}>
      <label htmlFor="url" className="label">
        Link video TikTok
      </label>
      <input
        id="url"
        className="input"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://vt.tiktok.com/..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="form-actions">
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Memproses..." : button}
        </button>
        <button type="button" className="btn ghost" onClick={paste} disabled={loading}>
          Tempel
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </form>
  );
}
