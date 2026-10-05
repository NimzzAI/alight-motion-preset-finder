import { useState } from "react";
import type { AioMedia, AioResult } from "../lib/types";
import { fmtNum } from "../lib/validate";

function MediaRow({ media, name }: { media: AioMedia; name: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(media.direct);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const file = `${name}-${media.quality || media.type}.${media.extension}`;

  return (
    <li className="aio-row">
      <div>
        <p className="preset-title">
          <span className="tag">{media.extension.toUpperCase()}</span>
          {media.label || media.quality || media.type}
        </p>
      </div>
      <div className="preset-actions">
        <a className="btn small" href={`${media.proxy}&name=${encodeURIComponent(file)}`}>
          Unduh
        </a>
        <button type="button" className="btn small ghost" onClick={copy}>
          {copied ? "Tersalin" : "Salin link"}
        </button>
      </div>
    </li>
  );
}

export function AioResultView({ data }: { data: AioResult }) {
  const videos = data.medias.filter((m) => m.type === "video");
  const audios = data.medias.filter((m) => m.type === "audio");
  const name = (data.title || data.videoId || "media").replace(/[^\w-]+/g, "-").slice(0, 40);
  const views = data.viewCount && /^\d+$/.test(data.viewCount) ? fmtNum(Number(data.viewCount)) : data.viewCount;

  return (
    <section className="result aio-result">
      <div>
        {data.thumbnail ? (
          <img className="aio-thumb" src={data.thumbnail} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="aio-thumb aio-thumb-empty" />
        )}
      </div>
      <div className="result-main">
        <p className="video-title">{data.title || "Tanpa judul"}</p>
        <p className="muted">
          {[data.author, data.duration && `${data.duration}`, views && `${views} tayangan`].filter(Boolean).join(" · ")}
        </p>

        {videos.length > 0 && (
          <div>
            <h2 className="section-title">Video</h2>
            <ul className="presets">
              {videos.map((m) => (
                <MediaRow key={m.direct} media={m} name={name} />
              ))}
            </ul>
          </div>
        )}

        {audios.length > 0 && (
          <div>
            <h2 className="section-title">Audio</h2>
            <ul className="presets">
              {audios.map((m) => (
                <MediaRow key={m.direct} media={m} name={name} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
