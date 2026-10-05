import { useState } from "react";

type Props = {
  src: string | null;
  fallback?: string | null;
  cover: string | null;
  link: string | null;
  wide?: boolean;
  site?: string;
};

export function VideoBox({ src, fallback = null, cover, link, wide = false, site = "TikTok" }: Props) {
  const [url, setUrl] = useState(src ?? fallback);
  const [failed, setFailed] = useState(false);

  const onError = () => {
    if (fallback && url !== fallback) setUrl(fallback);
    else setFailed(true);
  };

  if (!url || failed) {
    return (
      <div className={`frame frame-empty${wide ? " frame-wide" : ""}`} style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        <p>Video nggak bisa diputar di sini.</p>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer">
            Buka di {site}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`frame${wide ? " frame-wide" : ""}`}>
      <video
        key={url}
        src={url}
        poster={cover ?? undefined}
        controls
        loop
        playsInline
        preload="metadata"
        {...({ referrerPolicy: "no-referrer" } as React.VideoHTMLAttributes<HTMLVideoElement>)}
        onError={onError}
      />
    </div>
  );
}
