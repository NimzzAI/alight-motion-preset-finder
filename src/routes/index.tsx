import { createFileRoute } from "@tanstack/react-router";
import { FinderResult } from "../components/finder-result";
import { MediaDownloads } from "../components/media-downloads";
import { MediaMeta } from "../components/media-meta";
import { Status } from "../components/status";
import { UrlForm } from "../components/url-form";
import { siteConfig as site } from "../config/site";
import { useLookup } from "../hooks/use-lookup";
import type { FindResult, TikTokMedia } from "../lib/types";
import { pageHead } from "../lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead(site.pages.finder),
  component: Finder,
});

function Finder() {
  const finder = useLookup<FindResult>("/api/find");
  const media = useLookup<TikTokMedia>("/api/tiktok");

  const search = (url: string) => {
    finder.run(url);
    media.run(url);
  };

  return (
    <div className="page">
      <h1>Cari preset Alight Motion dari video TikTok.</h1>
      <p className="lead">
        Tempel link videonya. Deskripsi, bio, link di bio, komentar, sampai balasan komentar ikut dipindai. Videonya
        bisa sekalian diunduh.
      </p>

      <UrlForm onSubmit={search} loading={finder.loading} button="Cari preset" />

      {finder.loading && <Status message="Memindai video dan komentar" elapsed={finder.elapsed} />}
      {finder.error && (
        <p className="error" role="alert">
          {finder.error}
        </p>
      )}

      {finder.data && (
        <>
          <FinderResult data={finder.data} />
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
        </>
      )}

      {!finder.data && !finder.loading && !finder.error && (
        <ol className="steps">
          <li>Buka video edit di TikTok, tekan Bagikan, lalu Salin tautan.</li>
          <li>Tempel di kolom di atas dan tekan Cari preset.</li>
          <li>Buka link yang muncul langsung di Alight Motion, atau salin dulu.</li>
        </ol>
      )}
    </div>
  );
}
