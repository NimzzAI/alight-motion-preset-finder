import { createFileRoute } from "@tanstack/react-router";
import { Status } from "../components/status";
import { TikTokResult } from "../components/tiktok-result";
import { UrlForm } from "../components/url-form";
import { siteConfig as site } from "../config/site";
import { useLookup } from "../hooks/use-lookup";
import { pageHead } from "../lib/seo";
import { isTikTokInput } from "../lib/validate";
import type { TikTokMedia } from "../lib/types";

export const Route = createFileRoute("/tiktok")({
  head: () => pageHead(site.pages.tiktok),
  component: TikTokDownloader,
});

function TikTokDownloader() {
  const { data, error, loading, elapsed, run } = useLookup<TikTokMedia>("/api/tiktok");

  return (
    <div className="page">
      <div className="hero-header stagger-1">
        <div className="hero-pill-badge">
          <i className="fa-brands fa-tiktok hero-pill-icon" aria-hidden="true"></i>
          <span>Pengunduh Media TikTok</span>
        </div>
        <h1>Unduh video TikTok tanpa watermark</h1>
        <p className="lead">Unduh video HD jernih tanpa watermark, audio musik MP3 asli, atau galeri foto slideshow dari postingan TikTok tanpa login.</p>
      </div>

      <UrlForm
        onSubmit={run}
        loading={loading}
        button="Ambil Media"
        validate={isTikTokInput}
        invalid="Itu bukan link TikTok, coba cek lagi."
      />

      {loading && <Status message="Mengambil media" elapsed={elapsed} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && <TikTokResult data={data} />}
    </div>
  );
}
