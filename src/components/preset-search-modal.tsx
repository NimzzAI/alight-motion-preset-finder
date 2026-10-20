import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { fmtNum } from "../lib/validate";
import type { ApiResponse, DiscoveredPreset, KeywordPresetSearchResult, PresetOriginVideo } from "../lib/types";

const QUICK_TOPICS = [
  "preset gfx",
  "preset 3d",
  "preset elitis",
  "preset body back",
  "preset jj slowmo",
  "preset velocity",
  "preset foto aesthetic",
  "preset jedag jedug",
];

const SOURCE_LABEL: Record<string, string> = {
  description: "deskripsi VT",
  bio: "bio kreator",
  bioLink: "tautan bio",
  comment: "komentar",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

function formatUnixDate(ts: number | null | undefined): string | null {
  if (!ts || ts <= 0) return null;
  const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
  try {
    return dateFmt.format(new Date(ms));
  } catch {
    return null;
  }
}

const withDownloadName = (url: string, name: string) =>
  url.includes("/api/media?") ? `${url}&name=${encodeURIComponent(name)}` : url;

type Props = {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onInspectVt?: (vtUrl: string) => void;
};

export function PresetSearchModal({ open, initialQuery = "", onClose, onInspectVt }: Props) {
  const [query, setQuery] = useState(initialQuery || "preset elitis");
  const [variation, setVariation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KeywordPresetSearchResult | null>(null);
  const [filterType, setFilterType] = useState<"all" | "5mb" | "xml">("all");
  const [viewMode, setViewMode] = useState<"presets" | "videos">("presets");
  const [activeVtPreview, setActiveVtPreview] = useState<PresetOriginVideo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoQueryRef = useRef<string>("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, []);

  const executeSearch = useCallback(async (searchQuery: string, nextVariation: number) => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setError("Masukkan judul preset minimal 2 karakter (contoh: preset body back).");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setActiveVtPreview(null);

    try {
      const params = new URLSearchParams({
        q: clean,
        variation: String(nextVariation),
        min: "10",
      });
      const res = await fetch(`/api/search?${params.toString()}`, { signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as ApiResponse<KeywordPresetSearchResult> | null;
      if (!body) throw new Error("Respons server tidak terbaca, silakan coba lagi.");
      if (!body.ok) throw new Error(body.error);
      setResult(body.data);
      setVariation(body.data.variation);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "Gagal memuat pencarian preset.");
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open && initialQuery && initialQuery.trim() !== lastAutoQueryRef.current) {
      lastAutoQueryRef.current = initialQuery.trim();
      setQuery(initialQuery.trim());
      executeSearch(initialQuery.trim(), 0);
    }
  }, [open, initialQuery, executeSearch]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextVar = result && result.query.toLowerCase() === query.trim().toLowerCase() ? variation + 1 : 0;
    executeSearch(query, nextVar);
  };

  const handleShuffleVariation = () => {
    const nextVar = variation + 1;
    setVariation(nextVar);
    executeSearch(query, nextVar);
  };

  const handleSelectTopic = (topic: string) => {
    setQuery(topic);
    const nextVar = result && result.query.toLowerCase() === topic.toLowerCase() ? variation + 1 : 0;
    executeSearch(topic, nextVar);
  };

  const copyText = async (text: string, label: string, key?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (key) {
        setCopiedId(key);
        setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1600);
      }
      showToast(`${label} disalin ke clipboard`);
    } catch {
      showToast("Gagal menyalin tautan");
    }
  };

  const allPresets = result?.presets ?? [];
  const count5mb = allPresets.filter((p) => p.type === "5mb").length;
  const countXml = allPresets.filter((p) => p.type === "xml").length;

  const filteredPresets: DiscoveredPreset[] = allPresets.filter((p) => {
    if (filterType === "5mb") return p.type === "5mb";
    if (filterType === "xml") return p.type === "xml";
    return true;
  });

  const stepIndex = elapsed < 3 ? 1 : elapsed < 8 ? 2 : 3;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-preset-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet">
        <div className="modal-topbar">
          <div className="modal-topbar-left">
            <span className="modal-index-label">
              <span className="kicker-dot" aria-hidden="true" />
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Preset Discovery
            </span>
            <h2 id="modal-preset-title" className="modal-heading">
              Cari Preset Lewat Judul
            </h2>
          </div>
          <button type="button" className="btn small ghost modal-close-btn" onClick={onClose} aria-label="Tutup modal">
            Tutup (Esc)
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Ketik tema atau judul preset (contoh: <span className="mono">preset gfx</span>, <span className="mono">preset 3d</span>, atau{" "}
            <span className="mono">preset elitis</span>). Sistem mencari video dan foto di TikTok, mengambil link VT beserta
            thumbnail &amp; metadatanya, lalu mengekstrak preset <strong>5MB &amp; XML</strong> dari deskripsi, bio, dan komentar secara santai.
          </p>

          <form className="modal-search-form" onSubmit={handleSubmit}>
            <div className={`input-wrap ${loading ? "is-loading" : ""}`}>
              <input
                ref={inputRef}
                type="text"
                className="input modal-input has-clear"
                placeholder="Contoh: preset gfx, preset 3d, preset elitis, preset jj slowmo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {query && !loading && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Bersihkan kata kunci"
                  title="Bersihkan"
                >
                  ×
                </button>
              )}
              {loading && <span className="input-scan-bar" aria-hidden="true" />}
            </div>
            <div className="modal-form-actions">
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
                    Memindai VT ({elapsed}d)...
                  </span>
                ) : (
                  <>
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Cari 10+ Preset
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={handleShuffleVariation}
                disabled={loading || !query.trim()}
                title="Cari dari kumpulan video TikTok yang berbeda agar hasil selalu baru"
              >
                <i className="fa-solid fa-shuffle" aria-hidden="true"></i> Acak Variasi VT {variation > 0 ? `(#${variation + 1})` : ""}
              </button>
            </div>
          </form>

          <div className="topic-bar">
            <span className="topic-label">Kata kunci populer:</span>
            <div className="topic-list">
              {QUICK_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`topic-btn ${query.trim().toLowerCase() === t ? "active" : ""}`}
                  onClick={() => handleSelectTopic(t)}
                  disabled={loading}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="pipeline-box" role="status" aria-live="polite">
              <div className="bar" />
              <ol className="pipeline-steps">
                <li className={stepIndex >= 1 ? "active" : ""}>
                  <span className="step-pulse-dot" aria-hidden="true" />
                  <span>
                    <strong className="mono">01.</strong> Mencari kandidat video &amp; slideshow foto TikTok via Golang
                    untuk &ldquo;{query}&rdquo; (Variasi #{variation + 1})
                  </span>
                </li>
                <li className={stepIndex >= 2 ? "active" : ""}>
                  <span className="step-pulse-dot" aria-hidden="true" />
                  <span>
                    <strong className="mono">02.</strong> Mengambil thumbnail VT, metadata, serta memindai deskripsi,
                    bio, link-in-bio, komentar &amp; balasan kreator
                  </span>
                </li>
                <li className={stepIndex >= 3 ? "active" : ""}>
                  <span className="step-pulse-dot" aria-hidden="true" />
                  <span>
                    <strong className="mono">03.</strong> Membuka shortlink 5MB &amp; XML Google Drive/MediaFire dan
                    menyatukan minimal 10 preset unik (<span className="mono tabular-nums">{elapsed} detik</span>)
                  </span>
                </li>
              </ol>

              <div className="skeleton-grid" aria-hidden="true">
                <div className="skeleton-card" />
                <div className="skeleton-card" />
                <div className="skeleton-card" />
              </div>
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {result && !loading && (
            <div className="modal-results-area">
              <div className="results-summary-bar">
                <div className="summary-metrics">
                  <span>
                    <strong className="mono tabular-nums">{result.totalPresets}</strong> preset ditemukan
                  </span>
                  <span className="tag tag-5mb">5MB: {count5mb}</span>
                  <span className="tag tag-xml">XML: {countXml}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    dari <strong className="mono tabular-nums">{result.videos.length}</strong> VT aktif (
                    <span className="mono tabular-nums">{result.totalVideosScanned}</span> dipindai)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="mono">Variasi #{result.variation + 1}</span>
                </div>

                <div className="results-controls">
                  <div className="segmented-group" role="group" aria-label="Filter tipe preset">
                    <button
                      type="button"
                      className={`seg-btn ${filterType === "all" ? "active" : ""}`}
                      onClick={() => setFilterType("all")}
                    >
                      Semua ({allPresets.length})
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

                  <div className="segmented-group" role="group" aria-label="Mode tampilan">
                    <button
                      type="button"
                      className={`seg-btn ${viewMode === "presets" ? "active" : ""}`}
                      onClick={() => setViewMode("presets")}
                    >
                      Daftar Preset
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${viewMode === "videos" ? "active" : ""}`}
                      onClick={() => setViewMode("videos")}
                    >
                      Per Video VT ({result.videos.length})
                    </button>
                  </div>
                </div>
              </div>

              {activeVtPreview && (
                <div className="vt-preview-drawer">
                  <div className="vt-preview-header">
                    <div>
                      <span className="modal-index-label">
                        Pratinjau &amp; Metadata VT Asal ·{" "}
                        {activeVtPreview.kind === "photo" ? "Slideshow Foto" : "Video TikTok"}
                      </span>
                      <p className="vt-preview-author">
                        @{activeVtPreview.author.username}
                        {activeVtPreview.author.nickname ? ` · ${activeVtPreview.author.nickname}` : ""}
                      </p>
                    </div>
                    <div className="vt-preview-actions">
                      {activeVtPreview.cover && (
                        <a
                          href={withDownloadName(
                            activeVtPreview.cover,
                            `${activeVtPreview.author.username}-${activeVtPreview.id}-thumb.jpg`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn small ghost"
                        >
                          Unduh Thumbnail VT
                        </a>
                      )}
                      {activeVtPreview.proxy && (
                        <a
                          href={withDownloadName(
                            activeVtPreview.proxy,
                            `${activeVtPreview.author.username}-${activeVtPreview.id}.mp4`,
                          )}
                          className="btn small ghost"
                        >
                          Unduh Video VT
                        </a>
                      )}
                      <a
                        href={activeVtPreview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn small ghost"
                      >
                        Buka di TikTok
                      </a>
                      {onInspectVt && (
                        <button
                          type="button"
                          className="btn small btn-sage"
                          onClick={() => {
                            onInspectVt(activeVtPreview.url);
                            onClose();
                          }}
                        >
                          Inspect Lengkap di Halaman Utama
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => setActiveVtPreview(null)}
                      >
                        Tutup Pratinjau
                      </button>
                    </div>
                  </div>

                  <div className="vt-preview-grid">
                    <div className="vt-preview-media">
                      {activeVtPreview.kind === "photo" && activeVtPreview.images.length > 0 ? (
                        <div className="vt-photo-strip">
                          {activeVtPreview.images.slice(0, 4).map((img, i) => (
                            <img
                              key={img}
                              src={img}
                              alt={`Slide ${i + 1}`}
                              referrerPolicy="no-referrer"
                              className="vt-slide-img"
                            />
                          ))}
                        </div>
                      ) : activeVtPreview.src || activeVtPreview.proxy ? (
                        <video
                          className="vt-video-player"
                          src={activeVtPreview.src ?? activeVtPreview.proxy ?? undefined}
                          poster={activeVtPreview.cover ?? undefined}
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : activeVtPreview.cover ? (
                        <img
                          src={activeVtPreview.cover}
                          alt={activeVtPreview.description}
                          referrerPolicy="no-referrer"
                          className="vt-cover-fallback"
                        />
                      ) : (
                        <div className="vt-no-media">Pratinjau langsung tidak tersedia</div>
                      )}
                    </div>
                    <div className="vt-preview-info">
                      <p className="vt-preview-caption">{activeVtPreview.description || "Tanpa deskripsi"}</p>

                      <dl className="vt-preview-meta-dl">
                        <div>
                          <dt>ID VT</dt>
                          <dd className="mono">{activeVtPreview.id}</dd>
                        </div>
                        {activeVtPreview.duration != null && activeVtPreview.duration > 0 && (
                          <div>
                            <dt>Durasi</dt>
                            <dd>{activeVtPreview.duration} detik</dd>
                          </div>
                        )}
                        {activeVtPreview.createdAt != null && activeVtPreview.createdAt > 0 && (
                          <div>
                            <dt>Diunggah</dt>
                            <dd>{formatUnixDate(activeVtPreview.createdAt)}</dd>
                          </div>
                        )}
                        {activeVtPreview.region && (
                          <div>
                            <dt>Wilayah</dt>
                            <dd>{activeVtPreview.region}</dd>
                          </div>
                        )}
                        {activeVtPreview.views != null && (
                          <div>
                            <dt>Tayangan</dt>
                            <dd className="mono">{fmtNum(activeVtPreview.views)}</dd>
                          </div>
                        )}
                        {activeVtPreview.likes != null && (
                          <div>
                            <dt>Suka</dt>
                            <dd className="mono">{fmtNum(activeVtPreview.likes)}</dd>
                          </div>
                        )}
                        {activeVtPreview.comments != null && (
                          <div>
                            <dt>Komentar</dt>
                            <dd className="mono">{fmtNum(activeVtPreview.comments)}</dd>
                          </div>
                        )}
                        {activeVtPreview.shares != null && (
                          <div>
                            <dt>Dibagikan</dt>
                            <dd className="mono">{fmtNum(activeVtPreview.shares)}</dd>
                          </div>
                        )}
                        {activeVtPreview.author.followers != null && (
                          <div>
                            <dt>Pengikut</dt>
                            <dd className="mono">{fmtNum(activeVtPreview.author.followers)}</dd>
                          </div>
                        )}
                        {activeVtPreview.music?.title && (
                          <div>
                            <dt>Musik</dt>
                            <dd>
                              {[activeVtPreview.music.title, activeVtPreview.music.author].filter(Boolean).join(" · ")}
                            </dd>
                          </div>
                        )}
                      </dl>

                      <div className="vt-url-box">
                        <span className="mono vt-url-text">{activeVtPreview.url}</span>
                        <button
                          type="button"
                          className={`btn small ${copiedId === `vt-${activeVtPreview.id}` ? "btn-sage" : "ghost"}`}
                          onClick={() => copyText(activeVtPreview.url, "Link VT", `vt-${activeVtPreview.id}`)}
                        >
                          {copiedId === `vt-${activeVtPreview.id}` ? (
                            <>
                              <i className="fa-solid fa-check" aria-hidden="true"></i> Tersalin
                            </>
                          ) : (
                            "Salin Link VT"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {filteredPresets.length === 0 ? (
                <div className="empty-search-box">
                  <p>
                    {allPresets.length === 0
                      ? `Belum menemukan preset dari kumpulan VT saat ini untuk "${result.query}". Coba acak variasi VT lain atau gunakan kata kunci yang lebih spesifik.`
                      : "Tidak ada preset untuk filter tipe ini pada kumpulan VT saat ini."}
                  </p>
                  <button type="button" className="btn small btn-sage" onClick={handleShuffleVariation}>
                    Coba Variasi VT Lain
                  </button>
                </div>
              ) : viewMode === "presets" ? (
                <ol className="modal-preset-list">
                  {filteredPresets.map((item, idx) => {
                    const num = String(idx + 1).padStart(2, "0");
                    const metaParts = [
                      item.type === "5mb" ? "5MB Alight Motion" : "File XML / Drive",
                      SOURCE_LABEL[item.source] ?? item.source,
                      item.detail,
                      item.byAuthor ? "kreator VT" : null,
                      item.pinned ? "komentar disematkan" : null,
                      item.size,
                    ].filter(Boolean);

                    const vtStatsParts = [
                      item.vt.views != null ? `${fmtNum(item.vt.views)} tayangan` : null,
                      item.vt.likes != null ? `${fmtNum(item.vt.likes)} suka` : null,
                      item.vt.comments != null ? `${fmtNum(item.vt.comments)} komentar` : null,
                      item.vt.duration ? `${item.vt.duration}d` : null,
                      item.vt.region ? item.vt.region : null,
                    ].filter(Boolean);

                    const thumbSrc = item.vt.cover ?? item.thumb;
                    const isCopied = copiedId === item.id;

                    return (
                      <li
                        key={item.id}
                        className="modal-preset-item stagger-item"
                        style={{ "--stagger-i": Math.min(idx, 14) } as CSSProperties}
                      >
                        <div className="modal-preset-left-col">
                          <div className="modal-preset-index mono tabular-nums">{num}</div>
                          {thumbSrc && (
                            <button
                              type="button"
                              className="modal-vt-thumb-btn"
                              onClick={() => setActiveVtPreview(item.vt)}
                              title="Klik untuk pratinjau VT & metadata"
                            >
                              <img
                                src={thumbSrc}
                                alt={item.vt.description || "Thumbnail VT"}
                                className="modal-vt-thumb-img"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                              <span className="modal-vt-thumb-tag mono">
                                {item.vt.kind === "photo"
                                  ? "FOTO"
                                  : item.vt.duration
                                    ? `${item.vt.duration}d`
                                    : "VT"}
                              </span>
                            </button>
                          )}
                        </div>

                        <div className="modal-preset-main">
                          <div className="modal-preset-header">
                            <span className={`tag ${item.type === "5mb" ? "tag-5mb" : "tag-xml"}`}>
                              {item.type === "5mb" ? "5MB" : "XML"}
                            </span>
                            <span className="modal-preset-name">
                              {item.title || (item.type === "5mb" ? "Preset Alight Motion (5MB)" : "File Preset XML")}
                            </span>
                          </div>

                          <p className="muted modal-preset-meta">{metaParts.join(" · ")}</p>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono preset-url"
                          >
                            {item.url}
                          </a>

                          <div className="vt-origin-bar">
                            <span className="vt-origin-author">
                              VT {item.vt.kind === "photo" ? "Foto" : "Video"} · @{item.vt.author.username}
                            </span>
                            {vtStatsParts.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="mono muted">{vtStatsParts.join(" · ")}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <a
                              href={item.vt.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mono vt-origin-link"
                              title="Link VT TikTok asal"
                            >
                              {item.vt.url}
                            </a>
                          </div>
                        </div>

                        <div className="modal-preset-actions">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn small"
                          >
                            Buka Preset
                          </a>
                          <button
                            type="button"
                            className={`btn small ${isCopied ? "btn-sage" : "ghost"}`}
                            onClick={() => copyText(item.url, "Link preset", item.id)}
                          >
                            {isCopied ? (
                              <>
                                <i className="fa-solid fa-check" aria-hidden="true"></i> Tersalin
                              </>
                            ) : (
                              "Salin"
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => setActiveVtPreview(item.vt)}
                          >
                            Lihat VT &amp; Meta
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="vt-groups-list">
                  {result.videos.map((group, gIdx) => {
                    const num = String(gIdx + 1).padStart(2, "0");
                    const grp5mb = group.presets.filter((p) => p.type === "5mb").length;
                    const grpXml = group.presets.filter((p) => p.type === "xml").length;
                    return (
                      <article
                        key={group.vt.id}
                        className="vt-group-card stagger-item"
                        style={{ "--stagger-i": Math.min(gIdx, 12) } as CSSProperties}
                      >
                        <div className="vt-group-header-grid">
                          {group.vt.cover && (
                            <button
                              type="button"
                              className="vt-group-thumb-btn"
                              onClick={() => setActiveVtPreview(group.vt)}
                              title="Pratinjau VT & Metadata"
                            >
                              <img
                                src={group.vt.cover}
                                alt={group.vt.description || "Thumbnail VT"}
                                className="vt-group-thumb-img"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                              <span className="modal-vt-thumb-tag mono">
                                {group.vt.kind === "photo"
                                  ? `${group.vt.images.length || 1} Foto`
                                  : group.vt.duration
                                    ? `${group.vt.duration}d`
                                    : "VT"}
                              </span>
                            </button>
                          )}

                          <div className="vt-group-body-col">
                            <div className="vt-group-top">
                              <div className="vt-group-meta">
                                <span className="mono tabular-nums vt-group-num">VT {num}</span>
                                <strong>@{group.vt.author.username}</strong>
                                {group.vt.author.nickname && (
                                  <span className="muted">({group.vt.author.nickname})</span>
                                )}
                                {grp5mb > 0 && <span className="tag tag-5mb">5MB: {grp5mb}</span>}
                                {grpXml > 0 && <span className="tag tag-xml">XML: {grpXml}</span>}
                              </div>
                              <div className="vt-group-btns">
                                <button
                                  type="button"
                                  className="btn small ghost"
                                  onClick={() => setActiveVtPreview(group.vt)}
                                >
                                  Pratinjau &amp; Meta
                                </button>
                                <button
                                  type="button"
                                  className={`btn small ${copiedId === `grp-${group.vt.id}` ? "btn-sage" : "ghost"}`}
                                  onClick={() => copyText(group.vt.url, "Link VT", `grp-${group.vt.id}`)}
                                >
                                  {copiedId === `grp-${group.vt.id}` ? (
                                    <>
                                      <i className="fa-solid fa-check" aria-hidden="true"></i> Tersalin
                                    </>
                                  ) : (
                                    "Salin Link VT"
                                  )}
                                </button>
                                <a
                                  href={group.vt.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn small ghost"
                                >
                                  Buka VT
                                </a>
                              </div>
                            </div>

                            {group.vt.description && <p className="vt-group-desc">{group.vt.description}</p>}

                            <p className="mono muted vt-group-stats-line">
                              {[
                                group.vt.kind === "photo" ? "Slideshow Foto" : "Video TikTok",
                                group.vt.duration ? `${group.vt.duration} detik` : null,
                                group.vt.views !== null ? `${fmtNum(group.vt.views)} tayangan` : null,
                                group.vt.likes !== null ? `${fmtNum(group.vt.likes)} suka` : null,
                                group.vt.comments !== null ? `${fmtNum(group.vt.comments)} komentar` : null,
                                group.vt.region ? `Wilayah ${group.vt.region}` : null,
                                group.vt.music?.title ? `Musik: ${group.vt.music.title}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>

                            <p className="mono muted vt-group-link-line">{group.vt.url}</p>
                          </div>
                        </div>

                        <ol className="vt-group-presets">
                          {group.presets.map((p) => {
                            const subKey = `${group.vt.id}-${p.url}`;
                            return (
                              <li key={p.url} className="vt-sub-preset">
                                <div className="vt-sub-preset-info">
                                  <span className={`tag ${p.type === "5mb" ? "tag-5mb" : "tag-xml"}`}>
                                    {p.type === "5mb" ? "5MB" : "XML"}
                                  </span>
                                  <span className="vt-sub-preset-title">
                                    {p.title || (p.type === "5mb" ? "Link Preset AM (5MB)" : "File XML")}
                                  </span>
                                  <span className="muted">
                                    · {SOURCE_LABEL[p.source] ?? p.source}
                                    {p.detail ? ` (${p.detail})` : ""}
                                    {p.size ? ` · ${p.size}` : ""}
                                  </span>
                                </div>
                                <div className="vt-sub-preset-actions">
                                  <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn small"
                                  >
                                    Buka
                                  </a>
                                  <button
                                    type="button"
                                    className={`btn small ${copiedId === subKey ? "btn-sage" : "ghost"}`}
                                    onClick={() => copyText(p.url, "Link preset", subKey)}
                                  >
                                    {copiedId === subKey ? (
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
                          })}
                        </ol>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {toast && (
          <div className="toast-banner mono" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
