import { DESKTOP_UA, UA, fetchText } from "./http.server";
import { mediaLink } from "./sign.server";

export type VideoSrc = { url: string; from: string };

const DOWNR = "https://downr.org";
const DOWNR_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36";

async function downrSession(): Promise<string> {
  const res = await fetch(`${DOWNR}/.netlify/functions/analytics`, {
    headers: { "User-Agent": DOWNR_UA, Referer: `${DOWNR}/` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("downr session " + res.status);
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""].filter(Boolean);
  return raw.map((c) => c.split(";")[0]).join("; ");
}

const downrConvert = (url: string, cookie: string) =>
  fetch(`${DOWNR}/.netlify/functions/bbc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: DOWNR,
      Referer: `${DOWNR}/`,
      "User-Agent": DOWNR_UA,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(12000),
  });

async function fromDownr(url: string): Promise<string | null> {
  try {
    let cookie = await downrSession();
    let res = await downrConvert(url, cookie);
    if (res.status === 403 && (await res.text()).trim() === "user_retry_required") {
      cookie = await downrSession();
      res = await downrConvert(url, cookie);
    }
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j?.error) return null;
    const videos: any[] = (j?.medias ?? []).filter(
      (m: any) => m?.type === "video" && !m.is_audio && typeof m.url === "string" && /^https?:\/\//i.test(m.url),
    );
    const quality = (m: any) => String(m.quality ?? "");
    const pick =
      videos.find((m) => /^no_?watermark$/i.test(quality(m))) ||
      videos.find((m) => /no_?watermark/i.test(quality(m))) ||
      videos.find((m) => !/watermark|wm/i.test(quality(m)));
    return pick ? String(pick.url).replace(/^http:/i, "https:") : null;
  } catch {
    return null;
  }
}

type Candidate = { path: string; url: string };

function walk(node: unknown, path: string, out: Candidate[], depth = 0) {
  if (depth > 6 || node == null) return;
  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node)) out.push({ path, url: node });
    return;
  }
  if (Array.isArray(node)) {
    node.slice(0, 30).forEach((x, i) => walk(x, `${path}[${i}]`, out, depth + 1));
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const hint = ["type", "kind", "mime", "mimeType", "format", "ext", "extension"]
      .map((k) => obj[k])
      .filter((x): x is string => typeof x === "string")
      .join(" ");
    const base = hint ? `${path}<${hint}>` : path;
    for (const [k, v] of Object.entries(obj)) walk(v, base ? `${base}.${k}` : k, out, depth + 1);
  }
}

function score({ path, url }: Candidate): number {
  let s = 0;
  if (/no[_\-. ]?w(ater)?m(ark)?|nowm|without/i.test(path)) s += 10;
  else if (/w(ater)?m(ark)?/i.test(path)) s -= 15;
  if (/video|play|mp4|download|src|link|url/i.test(path)) s += 5;
  if (/<[^>]*(video|mp4)[^>]*>/i.test(path)) s += 4;
  if (/\bhd\b|hd_|_hd|hdplay/i.test(path)) s += 1;
  if (/music|audio|mp3|cover|thumb|avatar|image|photo|poster|origin_cover|dynamic|profile/i.test(path)) s -= 30;
  if (/\.mp4(\?|#|$)/i.test(url)) s += 8;
  if (/\.(jpe?g|png|webp|gif|mp3|m4a|heic|avif)(\?|#|$)/i.test(url)) s -= 30;
  return s;
}

function pickVideoUrl(data: unknown): string | null {
  const found: Candidate[] = [];
  walk(data, "", found);
  const best = found
    .map((c) => ({ ...c, s: score(c) }))
    .filter((c) => c.s > 5)
    .sort((a, b) => b.s - a.s)[0];
  return best ? best.url.replace(/^http:/i, "https:") : null;
}

async function fromSnaptik(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://snaptik.fi/api/tiktok", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": DESKTOP_UA, Referer: "https://snaptik.fi/" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return pickVideoUrl(await res.json());
  } catch {
    return null;
  }
}

export const tikwmUrl = (u: unknown): string | null => {
  if (!u || typeof u !== "string") return null;
  if (/^https?:/i.test(u)) return u.replace(/^http:/i, "https:");
  return "https://www.tikwm.com" + (u.startsWith("/") ? "" : "/") + u;
};

async function fromTikwm(user: string, videoId: string): Promise<string | null> {
  try {
    const q = new URLSearchParams({ url: `https://www.tiktok.com/@${user || "tiktok"}/video/${videoId}`, hd: "1" });
    const res = await fetch("https://www.tikwm.com/api/?" + q, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    const d = ((await res.json()) as any)?.data;
    return tikwmUrl(d?.play || d?.hdplay);
  } catch {
    return null;
  }
}

async function fromPage(user: string, videoId: string): Promise<string | null> {
  if (!user) return null;
  try {
    const { body } = await fetchText(`https://www.tiktok.com/@${user}/video/${videoId}`, { timeout: 8000 });
    const m = body.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
    const video = JSON.parse(m?.[1] ?? "{}")?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.video;
    const candidates = [
      video?.playAddr,
      ...(video?.bitrateInfo ?? []).flatMap((b: any) => b?.PlayAddr?.UrlList ?? []),
      video?.downloadAddr,
    ];
    return candidates.find((u) => typeof u === "string" && /^https:/i.test(u)) ?? null;
  } catch {
    return null;
  }
}

export async function getVideoSrc(
  canonUrl: string,
  user: string,
  videoId: string,
  embedSrc: string | null,
): Promise<VideoSrc | null> {
  let url: string | null;
  if ((url = await fromDownr(canonUrl))) return { url, from: "downr" };
  if ((url = await fromSnaptik(canonUrl))) return { url, from: "snaptik" };
  if ((url = await fromTikwm(user, videoId))) return { url, from: "tikwm" };
  if (embedSrc) return { url: embedSrc, from: "embed" };
  if ((url = await fromPage(user, videoId))) return { url, from: "page" };
  return null;
}

export const videoFields = (v: VideoSrc | null) => ({
  src: v?.url ?? null,
  proxy: v ? mediaLink(v.url) : null,
});
