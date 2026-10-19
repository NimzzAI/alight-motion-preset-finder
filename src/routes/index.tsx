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
  "preset elitis",
  "preset jj slowmo",
  "preset velocity",
  "preset 3d transisi",
  "preset foto aesthetic",
];

function Finder() {
  const finder = useLookup<FindResult>("/api/find");
  const media = useLookup<TikTokMedia>("/api/tiktok");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialQuery, setModalInitialQuery] = useState("preset elitis");

  const search = (url: string) => {
    finder.run(url);
    if (detectPlatform(url) === "tiktok") media.run(url);
  };

  const openKeywordModal = (kw = "preset elitis") => {
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
      <div className="hero-header">
        <p className="hero-kicker">Catatan &amp; Pencari Preset Alight Motion</p>
        <h1>
          Cari <span className="marker-line">preset Alight Motion</span> dari tautan video atau judul.
        </h1>
        <p className="lead">
          Tempel tautan video TikTok, YouTube, atau Instagram—atau ketik langsung judul preset seperti{" "}
          <span className="mono">preset elitis</span> untuk menelusuri video maupun foto TikTok dan mengumpulkan
          minimal 10 preset unik secara otomatis.
        </p>
      </div>

      <section className="mode-launchpad" aria-labelledby="launchpad-heading">
        <div className="notebook-strip" aria-hidden="true">
          <span className="notebook-holes">
            <i />
            <i />
            <i />
          </span>
          <span className="notebook-caption">Eksplorasi Preset via Kata Kunci</span>
        </div>
        <div className="mode-launchpad-inner">
          <div className="mode-launchpad-head">
            <div>
              <h2 id="launchpad-heading" className="mode-launchpad-title">
                Cari Preset Lewat Judul TikTok (Minimal 10 Preset)
              </h2>
              <p className="muted mode-launchpad-desc">
                Belum punya link videonya? Ketik judul atau gaya preset yang kamu inginkan. Sistem akan mencari VT video
                &amp; foto di TikTok, mengambil link VT-nya, lalu mengumpulkan minimal 10 preset berbeda setiap kali
                dicari.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sage"
              onClick={() => openKeywordModal("preset elitis")}
            >
              Cari Lewat Judul (⌘K)
            </button>
          </div>

          <div className="topic-bar">
            <span className="topic-label">Coba cari langsung:</span>
            <div className="topic-list">
              {FEATURED_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className="topic-btn"
                  onClick={() => openKeywordModal(kw)}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <UrlForm
        onSubmit={search}
        onKeywordSubmit={(kw) => openKeywordModal(kw)}
        loading={finder.loading}
        button="Cari preset"
        validate={isFinderInput}
        invalid="Masukkan link TikTok, YouTube, atau Instagram—atau ketik judul preset (misal: preset elitis)."
        label="Tempel link video atau ketik judul preset"
        placeholder="https://vt.tiktok.com/... atau ketik: preset elitis"
      />

      {finder.loading && <Status message="Memindai video dan komentar" elapsed={finder.elapsed} />}
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
        <ol className="steps">
          <li>
            <span>
              Tempel tautan video dari TikTok, YouTube, atau Instagram—atau tekan tombol{" "}
              <strong>Cari Lewat Judul</strong> untuk mencari lewat kata kunci seperti{" "}
              <span className="mono">preset elitis</span>.
            </span>
          </li>
          <li>
            <span>
              Deskripsi video, bio profil, tautan di bio, komentar yang disematkan, hingga balasan komentar dipindai
              otomatis sampai shortlink terbuka.
            </span>
          </li>
          <li>
            <span>
              Buka preset 5MB atau XML langsung di Alight Motion, salin tautannya, atau unduh video tanpa watermark.
            </span>
          </li>
        </ol>
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
