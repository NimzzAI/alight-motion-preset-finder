import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { fmtNum } from "../lib/validate";
import type { ApiResponse, DiscoveredPreset, KeywordPresetSearchResult, PresetOriginVideo } from "../lib/types";

const QUICK_TOPICS = [
  "preset elitis",
  "preset jj slowmo",
  "preset velocity",
  "preset 3d transisi",
  "preset foto aesthetic",
  "preset jedag jedug",
];

const SOURCE_LABEL: Record<string, string> = {
  description: "deskripsi VT",
  bio: "bio kreator",
  bioLink: "tautan bio",
  comment: "komentar",
};

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
      setError("Masukkan judul preset minimal 2 karakter (contoh: preset elitis).");
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

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
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

  const stepIndex = elapsed < 4 ? 1 : elapsed < 10 ? 2 : 3;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-preset-title">
      <div className="modal-sheet">
        <div className="modal-topbar">
          <div className="modal-topbar-left">
            <span className="modal-index-label">Pencarian Katalog VT TikTok</span>
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
            Ketik nama atau gaya preset (contoh: <span className="mono">preset elitis</span>). Sistem akan mencari
            video maupun slideshow foto di TikTok, mengambil link VT-nya, lalu mengekstrak minimal 10 preset berbeda dari
            deskripsi, bio, dan komentar.
          </p>

          <form className="modal-search-form" onSubmit={handleSubmit}>
            <div className={`input-wrap ${loading ? "is-loading" : ""}`}>
              <input
                ref={inputRef}
                type="text"
                className="input modal-input"
                placeholder="Contoh: preset elitis, preset jj slowmo, preset velocity..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <span className="input-scan-bar" aria-hidden="true" />}
            </div>
            <div className="modal-form-actions">
              <button type="submit" className="btn" disabled={loading}>
                {loading ? `Memindai VT (${elapsed}d)...` : "Cari 10+ Preset"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={handleShuffleVariation}
                disabled={loading || !query.trim()}
                title="Cari dari kumpulan video TikTok yang berbeda agar hasil selalu baru"
              >
                Acak Variasi VT {variation > 0 ? `(#${variation + 1})` : ""}
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
                  className={`topic-btn ${query.toLowerCase() === t ? "active" : ""}`}
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
                  <span className="mono">01.</span> Mencari kandidat video &amp; slideshow foto TikTok untuk &ldquo;{query}
                  &rdquo; (Variasi #{variation + 1})
                </li>
                <li className={stepIndex >= 2 ? "active" : ""}>
                  <span className="mono">02.</span> Mengambil link VT dan memindai deskripsi, bio, link-in-bio, serta
                  komentar kreator
                </li>
                <li className={stepIndex >= 3 ? "active" : ""}>
                  <span className="mono">03.</span> Membuka redirect shortlink dan mengumpulkan minimal 10 preset unik (
                  <span className="mono tabular-nums">{elapsed} detik</span>)
                </li>
              </ol>
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
                        Pratinjau VT Asal · {activeVtPreview.kind === "photo" ? "Slideshow Foto" : "Video TikTok"}
                      </span>
                      <p className="vt-preview-author">
                        @{activeVtPreview.author.username}
                        {activeVtPreview.author.nickname ? ` · ${activeVtPreview.author.nickname}` : ""}
                      </p>
                    </div>
                    <div className="vt-preview-actions">
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
                          Buka di Halaman Utama
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
                      <p className="muted mono vt-preview-stats">
                        {[
                          activeVtPreview.views !== null ? `${fmtNum(activeVtPreview.views)} tayangan` : null,
                          activeVtPreview.likes !== null ? `${fmtNum(activeVtPreview.likes)} suka` : null,
                          activeVtPreview.comments !== null ? `${fmtNum(activeVtPreview.comments)} komentar` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="vt-url-box">
                        <span className="mono vt-url-text">{activeVtPreview.url}</span>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => copyText(activeVtPreview.url, "Link VT")}
                        >
                          Salin Link VT
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {filteredPresets.length === 0 ? (
                <div className="empty-search-box">
                  <p>Tidak ada preset untuk filter ini pada kumpulan VT saat ini.</p>
                  <button type="button" className="btn small" onClick={handleShuffleVariation}>
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

                    return (
                      <li key={item.id} className="modal-preset-item">
                        <div className="modal-preset-index mono tabular-nums">{num}</div>

                        <div className="modal-preset-main">
                          <div className="modal-preset-header">
                            <span className="tag">{item.type === "5mb" ? "5MB" : "XML"}</span>
                            <span className="modal-preset-name">
                              {item.title || (item.type === "5mb" ? "Preset Alight Motion" : "File Preset XML")}
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
                            className="btn small ghost"
                            onClick={() => copyText(item.url, "Link preset")}
                          >
                            Salin
                          </button>
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => setActiveVtPreview(item.vt)}
                          >
                            Lihat VT
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
                    return (
                      <article key={group.vt.id} className="vt-group-card">
                        <div className="vt-group-top">
                          <div className="vt-group-meta">
                            <span className="mono tabular-nums vt-group-num">VT {num}</span>
                            <strong>@{group.vt.author.username}</strong>
                            <span aria-hidden="true">·</span>
                            <span>{group.vt.kind === "photo" ? "Slideshow Foto" : "Video TikTok"}</span>
                            {group.vt.views !== null && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="mono tabular-nums">{fmtNum(group.vt.views)} tayangan</span>
                              </>
                            )}
                          </div>
                          <div className="vt-group-btns">
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => setActiveVtPreview(group.vt)}
                            >
                              Pratinjau VT
                            </button>
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => copyText(group.vt.url, "Link VT")}
                            >
                              Salin Link VT
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

                        <p className="mono muted vt-group-link-line">{group.vt.url}</p>

                        <ol className="vt-group-presets">
                          {group.presets.map((p) => (
                            <li key={p.url} className="vt-sub-preset">
                              <div className="vt-sub-preset-info">
                                <span className="tag">{p.type === "5mb" ? "5MB" : "XML"}</span>
                                <span className="vt-sub-preset-title">
                                  {p.title || (p.type === "5mb" ? "Link Preset AM" : "File XML")}
                                </span>
                                <span className="muted">
                                  · {SOURCE_LABEL[p.source] ?? p.source}
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
                                  className="btn small ghost"
                                  onClick={() => copyText(p.url, "Link preset")}
                                >
                                  Salin
                                </button>
                              </div>
                            </li>
                          ))}
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
