import { createFileRoute } from "@tanstack/react-router";
import { AioResultView } from "../components/aio-result";
import { Status } from "../components/status";
import { UrlForm } from "../components/url-form";
import { siteConfig as site } from "../config/site";
import { useLookup } from "../hooks/use-lookup";
import { isHttpUrl } from "../lib/platform";
import { pageHead } from "../lib/seo";
import type { AioResult } from "../lib/types";

export const Route = createFileRoute("/aio")({
  head: () => pageHead(site.pages.aio),
  component: Aio,
});

function Aio() {
  const { data, error, loading, elapsed, run } = useLookup<AioResult>("/api/aio");

  return (
    <div className="page">
      <h1>Unduh video dan audio dari satu link.</h1>
      <p className="lead">
        Tempel link dari YouTube atau situs lain yang didukung layanan sumber. Pilih kualitasnya, lalu unduh.
      </p>

      <UrlForm
        onSubmit={run}
        loading={loading}
        button="Ambil link"
        validate={isHttpUrl}
        invalid="Itu bukan link yang valid, coba cek lagi."
        label="Link video"
        placeholder="https://youtube.com/watch?v=..."
      />

      {loading && <Status message="Mengambil link unduhan" elapsed={elapsed} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && <AioResultView data={data} />}
    </div>
  );
}
