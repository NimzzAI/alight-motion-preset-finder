import { useState } from "react";
import type { Preset } from "../lib/types";

const SOURCE: Record<string, string> = {
  description: "deskripsi VT",
  bio: "bio kreator",
  bioLink: "tautan di bio",
  comment: "komentar",
};

type Props = {
  preset: Preset;
  fallbackThumb?: string | null;
};

export function PresetRow({ preset, fallbackThumb = null }: Props) {
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preset.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const thumbUrl = !imgFailed ? preset.thumb ?? fallbackThumb : null;

  const meta = [
    preset.type === "5mb" ? "5MB Alight Motion" : "File XML / Drive",
    SOURCE[preset.source] ?? preset.source,
    preset.detail,
    preset.byAuthor ? "pembuat video" : null,
    preset.pinned ? "disematkan" : null,
    preset.size,
  ].filter(Boolean);

  return (
    <li className="preset">
      {thumbUrl && (
        <img
          className="preset-thumb"
          src={thumbUrl}
          alt={preset.title || "Thumbnail preset"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="preset-body">
        <p className="preset-title">
          <span className={`tag ${preset.type === "5mb" ? "tag-5mb" : "tag-xml"}`}>
            {preset.type === "5mb" ? "5MB" : "XML"}
          </span>
          <span>{preset.title || (preset.type === "5mb" ? "Preset Alight Motion (5MB)" : "File Preset XML")}</span>
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
        <button type="button" className={`btn small ${copied ? "btn-sage" : "ghost"}`} onClick={copy}>
          {copied ? (
            <>
              <i className="fa-solid fa-check" aria-hidden="true"></i> Tersalin
            </>
          ) : (
            "Salin"
          )}
        </button>
      </div>
    </li>
  );
}
