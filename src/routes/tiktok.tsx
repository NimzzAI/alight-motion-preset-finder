import { createFileRoute } from "@tanstack/react-router";
import { Status } from "../components/status";
import { TikTokResult } from "../components/tiktok-result";
import { UrlForm } from "../components/url-form";
import { siteConfig as site } from "../config/site";
import { useLookup } from "../hooks/use-lookup";
import { pageHead } from "../lib/seo";
import type { TikTokMedia } from "../lib/types";

export const Route = createFileRoute("/tiktok")({
  head: () => pageHead(site.pages.tiktok),
  component: TikTokDownloader,
});

function TikTokDownloader() {
  const { data, error, loading, elapsed, run } = useLookup<TikTokMedia>("/api/tiktok");

  return (
    <div className="page">
      <h1>Unduh video TikTok tanpa watermark.</h1>
      <p className="lead">Bisa video, musiknya saja, atau foto dari postingan slideshow. Tanpa login.</p>

      <UrlForm onSubmit={run} loading={loading} button="Ambil media" />

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
