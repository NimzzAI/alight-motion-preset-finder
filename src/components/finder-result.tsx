import type { FindResult } from "../lib/types";
import { Author } from "./author";
import { PresetRow } from "./preset-row";
import { Stats } from "./stats";
import { VideoBox } from "./video-box";

const ENGINE: Record<FindResult["engine"], string | null> = {
  finder: null,
  bintang: "Hasil ini datang dari jalur cadangan (bintangapi).",
  amfinder: "Hasil ini datang dari jalur cadangan (amfinder.web.id).",
};

export function FinderResult({ data }: { data: FindResult }) {
  const { video, author, presets, scanned, engine } = data;
  const note = ENGINE[engine];

  return (
    <section className="result">
      <div>
        <VideoBox src={video.src} fallback={video.proxy} cover={video.cover} link={video.url} />
      </div>
      <div className="result-main">
        <Author {...author} />
        {video.description && <p className="caption">{video.description}</p>}
        <Stats
          items={[
            ["tayangan", video.views],
            ["suka", video.likes],
            ["komentar", video.comments],
          ]}
        />

        <h2 className="section-title">
          {presets.length ? `${presets.length} preset ketemu` : "Presetnya nggak ketemu"}
        </h2>

        {presets.length ? (
          <ol className="presets">
            {presets.map((p) => (
              <PresetRow key={p.url} preset={p} />
            ))}
          </ol>
        ) : (
          <p className="muted">
            Nggak ada link Alight Motion di deskripsi, bio, maupun komentar. Bisa jadi pembuatnya cuma kasih lewat DM.
          </p>
        )}

        <p className="muted footnote">
          {scanned.comments > 0 && `${scanned.comments} komentar dan ${scanned.replies} balasan dipindai. `}
          {note}
        </p>
      </div>
    </section>
  );
}
