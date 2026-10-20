import type { TikTokMedia } from "../lib/types";

const withName = (url: string, name: string) => `${url}&name=${encodeURIComponent(name)}`;

export function MediaDownloads({ data }: { data: TikTokMedia }) {
  const base = data.author.username || "tiktok";
  const id = data.id ?? "media";

  return (
    <div>
      <h2 className="section-title">Unduh</h2>
      <div className="downloads">
        {data.videoHd && (
          <a className="btn" href={withName(data.videoHd, `${base}-${id}-hd.mp4`)}>
            <i className="fa-solid fa-film" aria-hidden="true"></i> Video HD
          </a>
        )}
        {data.video && (
          <a className={data.videoHd ? "btn ghost" : "btn"} href={withName(data.video, `${base}-${id}.mp4`)}>
            <i className="fa-solid fa-download" aria-hidden="true"></i> Video tanpa watermark
          </a>
        )}
        {data.music && (
          <a className="btn ghost" href={withName(data.music.url, `${base}-${id}.mp3`)}>
            <i className="fa-solid fa-music" aria-hidden="true"></i> Musik
          </a>
        )}
        {data.cover && (
          <a className="btn ghost" href={data.cover} target="_blank" rel="noopener noreferrer">
            <i className="fa-solid fa-image" aria-hidden="true"></i> Sampul
          </a>
        )}
      </div>

      {data.images.length > 0 && (
        <ul className="photos">
          {data.images.map((src, i) => (
            <li key={src}>
              <img src={src} alt={`Foto ${i + 1}`} loading="lazy" />
              <a className="btn small ghost" href={withName(src, `${base}-${id}-${i + 1}.jpg`)}>
                <i className="fa-solid fa-download" aria-hidden="true"></i> Unduh {i + 1}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
