import type { TikTokMedia } from "../lib/types";
import { fmtNum } from "../lib/validate";

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" });

export function MediaMeta({ data }: { data: TikTokMedia }) {
  const rows: [string, string | null][] = [
    ["Tipe", data.type === "photo" ? `Foto (${data.images.length})` : "Video"],
    ["Durasi", data.duration ? `${data.duration} detik` : null],
    ["Diunggah", data.createdAt ? dateFmt.format(new Date(data.createdAt * 1000)) : null],
    ["Wilayah", data.region],
    ["Musik", data.music ? [data.music.title, data.music.author].filter(Boolean).join(" · ") : null],
    ["Pengikut", data.author.followers != null ? fmtNum(data.author.followers) : null],
    ["Total suka akun", data.author.likes != null ? fmtNum(data.author.likes) : null],
    ["Jumlah video akun", data.author.videos != null ? fmtNum(data.author.videos) : null],
    ["Dibagikan", data.stats.shares != null ? fmtNum(data.stats.shares) : null],
    ["ID video", data.id],
  ];

  const shown = rows.filter((r): r is [string, string] => !!r[1]);

  return (
    <div>
      <h2 className="section-title">Metadata</h2>
      <dl className="meta">
        {shown.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={label === "ID video" ? "mono" : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      {data.url && (
        <p className="footnote">
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            Buka postingan asli di TikTok
          </a>
        </p>
      )}
    </div>
  );
}
