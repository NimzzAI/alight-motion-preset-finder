import { useState } from "react";
import type { FindResult } from "../lib/types";
import { fmtNum } from "../lib/validate";
import { Author } from "./author";
import { PresetRow } from "./preset-row";
import { Stats } from "./stats";
import { VideoBox } from "./video-box";

const ENGINE: Record<FindResult["engine"], string | null> = {
  finder: null,
  bintang: "Hasil ini dilengkapi dari jalur cadangan (bintangapi).",
  amfinder: "Hasil ini dilengkapi dari jalur cadangan (amfinder.web.id).",
};

const SITE: Record<FindResult["platform"], string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" });

function formatCreatedAt(val: string | number | null | undefined): string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number" && val > 0) {
    const ms = val < 10_000_000_000 ? val * 1000 : val;
    try {
      return dateFmt.format(new Date(ms));
    } catch {
      return null;
    }
  }
  return String(val);
}

const withDownloadName = (url: string, name: string) =>
  url.includes("/api/media?") ? `${url}&name=${encodeURIComponent(name)}` : url;

export function FinderResult({ data }: { data: FindResult }) {
  const { video, author, presets, scanned, engine, platform } = data;
  const [filterType, setFilterType] = useState<"all" | "5mb" | "xml">("all");
  const [copiedAll, setCopiedAll] = useState(false);

  const note = ENGINE[engine];
  const baseName = `${author.username || platform}-${video.id || "vt"}`;

  const count5mb = presets.filter((p) => p.type === "5mb").length;
  const countXml = presets.filter((p) => p.type === "xml").length;

  const filteredPresets = presets.filter((p) => {
    if (filterType === "5mb") return p.type === "5mb";
    if (filterType === "xml") return p.type === "xml";
    return true;
  });

  const handleCopyAll = async () => {
    if (!presets.length) return;
    const text = presets
      .map((p) => `[${p.type.toUpperCase()}] ${p.title || "Preset"}: ${p.url}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      setCopiedAll(false);
    }
  };

  const formatSummary =
    count5mb > 0 && countXml > 0
      ? `Lengkap (${count5mb}× 5MB + ${countXml}× XML)`
      : count5mb > 0
        ? `${count5mb}× 5MB Alight Motion`
        : countXml > 0
          ? `${countXml}× File XML`
          : "Tidak ditemukan";

  const metaRows: [string, string | null][] = [
    [
      "Platform & Tipe",
      `${SITE[platform]} · ${video.kind === "image" ? `Slideshow Foto (${video.count || video.images?.length || 1} slide)` : "Video VT"}`,
    ],
    ["Format Preset", formatSummary],
    ["Durasi VT", video.duration],
    ["Diunggah", formatCreatedAt(video.createdAt)],
    ["Wilayah", video.region ?? null],
    [
      "Musik / Sound",
      video.music ? [video.music.title, video.music.author].filter(Boolean).join(" · ") : null,
    ],
    ["Pengikut Kreator", author.followers != null ? fmtNum(author.followers) : author.subs ?? null],
    ["Total Suka Akun", author.likes != null ? fmtNum(author.likes) : null],
    ["Jumlah Video Akun", author.videos != null ? fmtNum(author.videos) : null],
    ["Dibagikan", video.shares != null ? fmtNum(video.shares) : null],
    [
      "Komentar Dipindai",
      scanned.comments > 0 ? `${scanned.comments} komentar · ${scanned.replies} balasan` : null,
    ],
    ["ID VT", video.id],
  ];

  const shownMeta = metaRows.filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <section className="result stagger-1">
      <div className="result-sidebar">
        <VideoBox
          src={video.src}
          fallback={video.proxy}
          cover={video.cover}
          link={video.url}
          wide={!video.vertical}
          site={SITE[platform]}
        />

        {video.cover && (
          <div className="vt-thumb-card">
            <div className="vt-thumb-preview-row">
              <img
                src={video.cover}
                alt={video.description || "Thumbnail VT"}
                className="vt-thumb-mini"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="vt-thumb-info">
                <span className="vt-thumb-badge mono">Thumbnail VT</span>
                <p className="muted vt-thumb-caption">
                  Sampul asli {SITE[platform]} {video.duration ? `· ${video.duration}` : ""}
                </p>
                <div className="vt-thumb-links">
                  <a
                    className="btn small ghost"
                    href={withDownloadName(video.cover, `${baseName}-thumbnail.jpg`)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Unduh Thumbnail
                  </a>
                  {video.url && (
                    <a className="btn small ghost" href={video.url} target="_blank" rel="noopener noreferrer">
                      Buka VT
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="result-main">
        <Author username={author.username} nickname={author.nickname} avatar={author.avatar} />
        {video.title && <p className="video-title">{video.title}</p>}
        {video.description && <p className="caption">{video.description}</p>}

        <Stats
          items={[
            ["tayangan", video.views],
            ["suka", video.likes],
            ["komentar", video.comments],
            ...(video.shares != null ? ([["dibagikan", video.shares]] as [string, number | null][]) : []),
          ]}
        />

        {(video.proxy || video.music?.url || video.cover) && (
          <div className="downloads">
            {video.proxy && (
              <a className="btn small" href={withDownloadName(video.proxy, `${baseName}.mp4`)}>
                Unduh Video VT
              </a>
            )}
            {video.music?.url && (
              <a className="btn small ghost" href={withDownloadName(video.music.url, `${baseName}.mp3`)}>
                Unduh Musik MP3
              </a>
            )}
            {video.cover && (
              <a
                className="btn small ghost"
                href={withDownloadName(video.cover, `${baseName}-thumbnail.jpg`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Unduh Sampul VT
              </a>
            )}
          </div>
        )}

        <div className="preset-section-head">
          <div className="preset-section-title-group">
            <h2 className="section-title">
              {presets.length ? `${presets.length} preset ketemu` : "Presetnya nggak ketemu"}
            </h2>
            {presets.length > 0 && (
              <div className="preset-type-badges">
                <span className={`tag ${count5mb > 0 ? "tag-5mb" : ""}`}>5MB: {count5mb}</span>
                <span className={`tag ${countXml > 0 ? "tag-xml" : ""}`}>XML: {countXml}</span>
              </div>
            )}
          </div>

          {presets.length > 0 && (
            <div className="preset-section-controls">
              {count5mb > 0 && countXml > 0 && (
                <div className="segmented-group" role="group" aria-label="Filter format preset">
                  <button
                    type="button"
                    className={`seg-btn ${filterType === "all" ? "active" : ""}`}
                    onClick={() => setFilterType("all")}
                  >
                    Semua ({presets.length})
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${filterType === "5mb" ? "active" : ""}`}
                    onClick={() => setFilterType("5mb")}
                  >
                    5MB ({count5mb})
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${filterType === "xml" ? "active" : ""}`}
                    onClick={() => setFilterType("xml")}
                  >
                    XML ({countXml})
                  </button>
                </div>
              )}
              <button
                type="button"
                className={`btn small ${copiedAll ? "btn-sage" : "ghost"}`}
                onClick={handleCopyAll}
              >
                {copiedAll ? (
                  <>
                    <i className="fa-solid fa-check" aria-hidden="true"></i> Semua Tersalin
                  </>
                ) : (
                  "Salin Semua Link"
                )}
              </button>
            </div>
          )}
        </div>

        {filteredPresets.length ? (
          <ol className="presets">
            {filteredPresets.map((p) => (
              <PresetRow key={p.url} preset={p} fallbackThumb={video.cover} />
            ))}
          </ol>
        ) : (
          <p className="muted">
            Nggak ada link Alight Motion (5MB maupun XML) di deskripsi, bio, maupun komentar yang bisa dibaca. Bisa
            jadi pembuatnya cuma kasih lewat DM atau saluran tertutup.
          </p>
        )}

        {video.images && video.images.length > 0 && (
          <div>
            <h2 className="section-title">Slideshow Foto VT ({video.images.length})</h2>
            <ul className="photos">
              {video.images.map((src, i) => (
                <li key={src}>
                  <img src={src} alt={`Slide ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" />
                  <a className="btn small ghost" href={withDownloadName(src, `${baseName}-slide-${i + 1}.jpg`)}>
                    Unduh Slide {i + 1}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {shownMeta.length > 0 && (
          <div className="finder-meta-block">
            <h2 className="section-title">Metadata VT &amp; Kreator</h2>
            <dl className="meta">
              {shownMeta.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={label === "ID VT" ? "mono" : undefined}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="muted footnote">
          {scanned.comments > 0 && `${scanned.comments} komentar dan ${scanned.replies} balasan dipindai. `}
          {note}
        </p>
      </div>
    </section>
  );
}
