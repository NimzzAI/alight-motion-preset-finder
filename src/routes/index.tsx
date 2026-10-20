import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FinderResult } from "../components/finder-result";
import { MediaDownloads } from "../components/media-downloads";
import { MediaMeta } from "../components/media-meta";
import { PresetSearchModal } from "../components/preset-search-modal";
import { Status } from "../components/status";
import { UrlForm } from "../components/url-form";
import { siteConfig as site } from "../config/site";
import { useLookup } from "../hooks/use-lookup";
import { detectPlatform, isFinderInput } from "../lib/platform";
import { pageHead } from "../lib/seo";
import type { FindResult, TikTokMedia } from "../lib/types";

export const Route = createFileRoute("/")({
  head: () => pageHead(site.pages.finder),
  component: Finder,
});

const FEATURED_KEYWORDS = [
  { query: "preset gfx", label: "Preset GFX", icon: "fa-solid fa-palette", desc: "Typography, poster & anime edit" },
  { query: "preset 3d", label: "Preset 3D", icon: "fa-solid fa-cube", desc: "Camera 3D, transisi & shape layer" },
  { query: "preset elitis", label: "Preset Elitis", icon: "fa-solid fa-wand-magic-sparkles", desc: "Transisi smooth & shake modern" },
  { query: "preset velocity", label: "Preset Velocity", icon: "fa-solid fa-bolt", desc: "Time-remap & slowmo beat sync" },
  { query: "preset jj slowmo", label: "Preset JJ Slowmo", icon: "fa-solid fa-headphones", desc: "Jedag jedug halus & color grade" },
  { query: "preset body back", label: "Preset Body Back", icon: "fa-solid fa-fire", desc: "Beat trend & transisi populer" },
  { query: "preset foto aesthetic", label: "Foto Aesthetic", icon: "fa-solid fa-camera", desc: "Color grading & lyrics overlay" },
  { query: "preset transisi", label: "Preset Transisi", icon: "fa-solid fa-arrows-rotate", desc: "Slide, spin & zoom Alight Motion" },
];

function Finder() {
  const finder = useLookup<FindResult>("/api/find");
  const media = useLookup<TikTokMedia>("/api/tiktok");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialQuery, setModalInitialQuery] = useState("preset gfx");

  const search = (url: string) => {
    finder.run(url);
    if (detectPlatform(url) === "tiktok") media.run(url);
  };

  const openKeywordModal = (kw = "preset gfx") => {
    setModalInitialQuery(kw);
    setModalOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showMedia = finder.data?.platform === "tiktok";

  return (
    <div className="page">
      <div className="studio-hero-grid">
        <div className="studio-hero-main stagger-1">
          <div className="hero-pill-badge">
            <i className="fa-solid fa-sliders hero-pill-icon" aria-hidden="true"></i>
            <span>Ekstraktor Preset Alight Motion &amp; Media Downloader</span>
          </div>
          <h1>
            Cari <span className="marker-line">preset Alight Motion</span> dari video &amp; judul
          </h1>
          <p className="lead">
            Tempel link video TikTok, YouTube, atau Instagram untuk mengekstrak preset{" "}
            <span className="mono">5MB</span> &amp; <span className="mono">XML</span> secara otomatis—atau ketik judul
            seperti <span className="mono">preset gfx</span> dan <span className="mono">preset 3d</span> untuk
            menemukan preset terbaik dari ratusan video.
          </p>

          <UrlForm
            onSubmit={search}
            onKeywordSubmit={(kw) => openKeywordModal(kw)}
            loading={finder.loading}
            button="Pindai Preset & VT"
            validate={isFinderInput}
            invalid="Masukkan link TikTok, YouTube, atau Instagram—atau ketik judul preset (misal: preset gfx, preset 3d)."
            label="Pencarian Preset: Link Video atau Judul"
            placeholder="Tempel https://vt.tiktok.com/... atau ketik: preset gfx / preset 3d"
          />
        </div>

        <aside className="mode-launchpad stagger-2" aria-labelledby="launchpad-heading">
          <div className="notebook-strip">
            <span className="notebook-caption">
              <i className="fa-solid fa-layer-group" aria-hidden="true"></i> Katalog Preset · Topik Populer
            </span>
            <span className="mono muted" style={{ fontSize: "0.75rem" }}>
              Pintasan ⌘K
            </span>
          </div>
          <div className="mode-launchpad-inner">
            <div className="mode-launchpad-head">
              <div>
                <h2 id="launchpad-heading" className="mode-launchpad-title">
                  Kategori Preset Populer
                </h2>
                <p className="muted mode-launchpad-desc">
                  Pilih kategori preset di bawah atau buka modal pencarian untuk menemukan video TikTok terkait,
                  lengkap dengan tautan 5MB dan XML Google Drive yang sudah diverifikasi.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sage"
                onClick={() => openKeywordModal("preset gfx")}
              >
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Buka Pencari Judul (⌘K)
              </button>
            </div>

            <div className="topic-grid">
              {FEATURED_KEYWORDS.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  className="topic-card-btn"
                  onClick={() => openKeywordModal(item.query)}
                >
                  <span className="topic-card-title">
                    <i className={`${item.icon} topic-card-icon`} aria-hidden="true"></i> {item.label}
                  </span>
                  <span className="topic-card-sub">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {finder.loading && <Status message="Memindai video, komentar, dan tautan preset" elapsed={finder.elapsed} />}
      {finder.error && (
        <p className="error" role="alert">
          {finder.error}
        </p>
      )}

      {finder.data && (
        <>
          <FinderResult data={finder.data} />
          {showMedia && (
            <section className="extra">
              {media.loading && <p className="muted">Mengambil media dan metadata...</p>}
              {media.error && <p className="muted">Media nggak bisa diambil: {media.error}</p>}
              {media.data && (
                <>
                  <MediaDownloads data={media.data} />
                  <MediaMeta data={media.data} />
                </>
              )}
            </section>
          )}
        </>
      )}

      {!finder.data && !finder.loading && !finder.error && (
        <section className="studio-specs-section stagger-4" aria-label="Cara kerja ekstraksi preset">
          <ol className="steps">
            <li>
              <div className="step-content">
                <h3 className="step-title"><i className="fa-solid fa-link" aria-hidden="true"></i> 1. Masukkan Link atau Judul</h3>
                <p className="muted">
                  Tempel URL TikTok, YouTube, atau Instagram untuk pemindaian langsung, atau ketik kata kunci
                  seperti <span className="mono">preset gfx</span> dan <span className="mono">preset 3d</span> untuk
                  mencari VT relevan dengan cepat.
                </p>
              </div>
            </li>
            <li>
              <div className="step-content">
                <h3 className="step-title"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> 2. Ekstrak Otomatis</h3>
                <p className="muted">
                  Sistem langsung menelusuri deskripsi video, bio kreator, tautan bio (Linktree, Lynk.id), komentar
                  teratas, dan komentar disematkan untuk menemukan tautan <span className="mono">5MB</span> &amp;{" "}
                  <span className="mono">XML</span>.
                </p>
              </div>
            </li>
            <li>
              <div className="step-content">
                <h3 className="step-title"><i className="fa-solid fa-box-archive" aria-hidden="true"></i> 3. Siap Pakai di Alight Motion</h3>
                <p className="muted">
                  Buka proyek 5MB langsung ke aplikasi Alight Motion atau unduh file XML dari Google Drive/MediaFire,
                  lengkap dengan preview video tanpa watermark.
                </p>
              </div>
            </li>
          </ol>
        </section>
      )}

      <PresetSearchModal
        open={modalOpen}
        initialQuery={modalInitialQuery}
        onClose={() => setModalOpen(false)}
        onInspectVt={(vtUrl) => search(vtUrl)}
      />
    </div>
  );
}

