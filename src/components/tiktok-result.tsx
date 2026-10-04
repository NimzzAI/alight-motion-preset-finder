import type { TikTokMedia } from "../lib/types";
import { Author } from "./author";
import { MediaDownloads } from "./media-downloads";
import { MediaMeta } from "./media-meta";
import { Stats } from "./stats";
import { VideoBox } from "./video-box";

export function TikTokResult({ data }: { data: TikTokMedia }) {
  return (
    <section className="result">
      <div>
        {data.type === "video" ? (
          <VideoBox src={data.video} cover={data.cover} link={data.url} />
        ) : (
          <div className="frame frame-empty" style={data.cover ? { backgroundImage: `url(${data.cover})` } : undefined}>
            <p>{data.images.length} foto</p>
          </div>
        )}
      </div>
      <div className="result-main">
        <Author username={data.author.username} nickname={data.author.nickname} avatar={data.author.avatar} />
        {data.title && <p className="caption">{data.title}</p>}
        <Stats
          items={[
            ["tayangan", data.stats.views],
            ["suka", data.stats.likes],
            ["komentar", data.stats.comments],
          ]}
        />
        <MediaDownloads data={data} />
        <MediaMeta data={data} />
      </div>
    </section>
  );
}
