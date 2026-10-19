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
  { query: "preset gfx", label: "Preset GFX", desc: "Typography, poster & anime edit" },
  { query: "preset 3d", label: "Preset 3D", desc: "Camera 3D, transisi & shape layer" },
  { query: "preset elitis", label: "Preset Elitis", desc: "Transisi smooth & shake modern" },
  { query: "preset velocity", label: "Preset Velocity", desc: "Time-remap & slowmo beat sync" },
  { query: "preset jj slowmo", label: "Preset JJ Slowmo", desc: "Jedag jedug halus & color grade" },
  { query: "preset body back", label: "Preset Body Back", desc: "Beat trend & transisi populer" },
  { query: "preset foto aesthetic", label: "Foto Aesthetic", desc: "Color grading & lyrics overlay" },
  { query: "preset transisi", label: "Preset Transisi", desc: "Slide, spin & zoom Alight Motion" },
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
          <p className="hero-kicker">Alight Motion Preset &amp; Media Studio · 5MB &amp; XML</p>
          <h1>
            Ekstrak <span className="marker-line">preset Alight Motion</span> dari tautan VT atau cari lewat judul.
          </h1>
          <p className="lead">
            Tempel tautan video TikTok, YouTube, atau Instagram untuk memindai preset{" "}
            <span className="mono">5MB</span> &amp; <span className="mono">XML</span> beserta thumbnail VT dan
            metadata lengkap—atau ketik topik seperti <span className="mono">preset gfx</span> dan{" "}
            <span className="mono">preset 3d</span> untuk mengumpulkan minimal 10 preset yang relevan.
          </p>

          <UrlForm
            onSubmit={search}
            onKeywordSubmit={(kw) => openKeywordModal(kw)}
            loading={finder.loading}
            button="Pindai Preset & VT"
            validate={isFinderInput}
            invalid="Masukkan link TikTok, YouTube, atau Instagram—atau ketik judul preset (misal: preset gfx, preset 3d)."
            label="Konsol Pencarian Tautan VT & Kata Kunci Preset"
            placeholder="Tempel https://vt.tiktok.com/... atau ketik: preset gfx / preset 3d"
          />
        </div>

        <aside className="mode-launchpad stagger-2" aria-labelledby="launchpad-heading">
          <div className="notebook-strip">
            <span className="notebook-caption">Katalog Pencarian Topik · Mesin Pencari Golang</span>
            <span className="mono muted" style={{ fontSize: "0.75rem" }}>
              Pintasan ⌘K
            </span>
          </div>
          <div className="mode-launchpad-inner">
            <div className="mode-launchpad-head">
              <div>
                <h2 id="launchpad-heading" className="mode-launchpad-title">
                  Eksplorasi Katalog Preset per Kategori
                </h2>
                <p className="muted mode-launchpad-desc">
                  Pilih kategori di bawah atau buka jendela eksplorasi untuk mencari VT TikTok yang sesuai topik,
                  memvalidasi kecocokan kata kunci, dan mengekstrak tautan 5MB maupun XML secara langsung.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sage"
                onClick={() => openKeywordModal("preset gfx")}
              >
                Buka Pencari Judul (⌘K)
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
                  <span className="topic-card-title">{item.label}</span>
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
                <h3 className="step-title">Deteksi Tautan Video &amp; Filter Topik Presisi</h3>
                <p className="muted">
                  Tempel link VT TikTok, YouTube, atau Instagram untuk pemindaian langsung, atau ketik kata kunci
                  spesifik seperti <span className="mono">preset gfx</span> dan <span className="mono">preset 3d</span>{" "}
                  dengan pemfilteran relevansi ketat agar bebas dari hasil yang melenceng.
                </p>
              </div>
            </li>
            <li>
              <div className="step-content">
                <h3 className="step-title">Ekstraksi Multi-Jalur 5MB &amp; XML</h3>
                <p className="muted">
                  Memindai deskripsi video, bio kreator, tautan pohon bio (Linktree, Lynk.id, Heylink), komentar yang
                  disematkan, hingga balasan komentar untuk menangkap paket <span className="mono">5MB</span>{" "}
                  (Alight Motion) sekaligus file <span className="mono">XML</span> (Google Drive / MediaFire).
                </p>
              </div>
            </li>
            <li>
              <div className="step-content">
                <h3 className="step-title">Pratinjau VT, Thumbnail &amp; Metadata Lengkap</h3>
                <p className="muted">
                  Tampilkan pemutar video VT asal beserta thumbnail sampul, statistik tayangan, suka, komentar, audio
                  musik latar, dan tombol unduh video tanpa watermark dalam satu tampilan terpadu.
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

