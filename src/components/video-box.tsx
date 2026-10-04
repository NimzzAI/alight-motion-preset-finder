import { useState } from "react";

type Props = {
  src: string | null;
  fallback?: string | null;
  cover: string | null;
  link: string | null;
};

export function VideoBox({ src, fallback = null, cover, link }: Props) {
  const [url, setUrl] = useState(src ?? fallback);
  const [failed, setFailed] = useState(false);

  const onError = () => {
    if (fallback && url !== fallback) setUrl(fallback);
    else setFailed(true);
  };

  if (!url || failed) {
    return (
      <div className="frame frame-empty" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        <p>Video nggak bisa diputar di sini.</p>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer">
            Buka di TikTok
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="frame">
      <video
        key={url}
        src={url}
        poster={cover ?? undefined}
        controls
        loop
        playsInline
        preload="metadata"
        referrerPolicy="no-referrer"
        onError={onError}
      />
    </div>
  );
}
