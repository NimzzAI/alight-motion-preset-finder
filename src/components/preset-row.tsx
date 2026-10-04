import { useState } from "react";
import type { Preset } from "../lib/types";

const SOURCE: Record<string, string> = {
  description: "deskripsi",
  bio: "bio",
  bioLink: "link di bio",
  comment: "komentar",
};

export function PresetRow({ preset }: { preset: Preset }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preset.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const meta = [
    SOURCE[preset.source] ?? preset.source,
    preset.detail,
    preset.byAuthor ? "pembuat video" : null,
    preset.pinned ? "disematkan" : null,
    preset.size,
  ].filter(Boolean);

  return (
    <li className="preset">
      {preset.thumb && <img className="preset-thumb" src={preset.thumb} alt="" referrerPolicy="no-referrer" />}
      <div className="preset-body">
        <p className="preset-title">
          <span className="tag">{preset.type === "5mb" ? "5MB" : "XML"}</span>
          {preset.title || (preset.type === "5mb" ? "Link preset" : "File XML")}
        </p>
        <p className="muted preset-meta">{meta.join(" · ")}</p>
        <a className="mono preset-url" href={preset.url} target="_blank" rel="noopener noreferrer">
          {preset.url}
        </a>
      </div>
      <div className="preset-actions">
        <a className="btn small" href={preset.url} target="_blank" rel="noopener noreferrer">
          Buka
        </a>
        <button type="button" className="btn small ghost" onClick={copy}>
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </li>
  );
}
