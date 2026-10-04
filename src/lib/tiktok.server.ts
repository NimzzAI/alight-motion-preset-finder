import { settings } from "../config/settings.server";
import { UA, fetchText } from "./http.server";
import { mediaLink } from "./sign.server";
import { getVideoSrc, tikwmUrl } from "./video-src.server";
import type { TikTokMedia } from "./types";

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

const proxied = (u: string | null | undefined) => (u ? mediaLink(u) : null);
const seconds = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const nz = (v: unknown) => (typeof v === "number" ? v : null);

async function fromGo(input: string): Promise<TikTokMedia | null> {
  const { goServiceUrl, goServiceSecret, goTimeoutMs } = settings.downloader;
  if (!goServiceUrl) return null;

  const res = await fetch(`${goServiceUrl}/extract`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(goServiceSecret ? { "x-api-secret": goServiceSecret } : {}),
    },
    body: JSON.stringify({ url: input }),
    signal: AbortSignal.timeout(goTimeoutMs),
  });
  if (!res.ok) throw new Error(`go service ${res.status}`);

  const d = ((await res.json()) as any)?.data;
  if (!d) return null;

  const images = ((d.images ?? []) as string[]).map((u) => proxied(u) as string);
  const username: string = d.author?.username ?? "";

  return {
    id: d.id ?? null,
    type: d.type === "photo" ? "photo" : "video",
    title: d.title ?? "",
    cover: d.cover || null,
    url: username && d.id ? `https://www.tiktok.com/@${username}/video/${d.id}` : null,
    video: proxied(d.video),
    videoHd: null,
    duration: seconds(d.duration),
    region: d.region || null,
    createdAt: nz(d.createTime) || null,
    music: d.music?.url
      ? { title: d.music.title || "Musik", author: d.music.author ?? "", url: proxied(d.music.url) as string }
      : null,
    images,
    author: {
      username,
      nickname: d.author?.nickname ?? "",
      avatar: d.author?.avatar || null,
      verified: !!d.author?.verified,
      followers: nz(d.author?.followers),
      likes: nz(d.author?.like),
      videos: nz(d.author?.videoCount),
    },
    stats: {
      views: nz(d.stats?.views),
      likes: nz(d.stats?.like),
      comments: nz(d.stats?.comment),
      shares: nz(d.stats?.share),
    },
    source: "go",
  };
}

async function fromTikwm(input: string): Promise<TikTokMedia | null> {
  const q = new URLSearchParams({ url: input, hd: "1" });
  const res = await fetch("https://www.tikwm.com/api/?" + q, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await res.json();
  if (j?.code !== 0 || !j.data) throw new Error(j?.msg ?? "tikwm gagal");

  const d = j.data;
  const play = tikwmUrl(d.play);
  const hd = tikwmUrl(d.hdplay);
  const music = tikwmUrl(d.music_info?.play ?? d.music);
  const images = ((d.images ?? []) as string[]).map((u) => proxied(tikwmUrl(u))).filter(Boolean) as string[];

  return {
    id: d.id ?? null,
    type: images.length ? "photo" : "video",
    title: d.title ?? "",
    cover: tikwmUrl(d.cover),
    url: d.author?.unique_id && d.id ? `https://www.tiktok.com/@${d.author.unique_id}/video/${d.id}` : null,
    video: proxied(play ?? hd),
    videoHd: hd && hd !== play ? proxied(hd) : null,
    duration: seconds(d.duration),
    region: d.region || null,
    createdAt: nz(d.create_time),
    music: music
      ? { title: d.music_info?.title ?? "Musik", author: d.music_info?.author ?? "", url: proxied(music) as string }
      : null,
    images,
    author: {
      username: d.author?.unique_id ?? "",
      nickname: d.author?.nickname ?? "",
      avatar: tikwmUrl(d.author?.avatar),
      verified: false,
      followers: null,
      likes: null,
      videos: null,
    },
    stats: {
      views: nz(d.play_count),
      likes: nz(d.digg_count),
      comments: nz(d.comment_count),
      shares: nz(d.share_count),
    },
    source: "tikwm",
  };
}

async function fromPage(input: string): Promise<TikTokMedia | null> {
  const { body } = await fetchText(input, { ua: MOBILE_UA, timeout: 20000 });
  const m = body.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;

  const scope = JSON.parse(m[1] as string)?.__DEFAULT_SCOPE__;
  const d =
    scope?.["webapp.reflow.video.detail"]?.itemInfo?.itemStruct ?? scope?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!d) return null;

  const username: string = d.author?.uniqueId ?? "";
  const isPhoto = !!d.imagePost;
  let video: string | null = null;
  let images: string[] = [];

  if (isPhoto) {
    images = [
      ...new Set(
        ((d.imagePost.images ?? []) as any[])
          .map((img) => img?.imageURL?.urlList?.[0] ?? img?.displayImage?.urlList?.[0])
          .filter(Boolean) as string[],
      ),
    ];
  } else {
    try {
      const res = await fetch(`https://www.tiktok.com/player/api/v1/items?item_ids=${encodeURIComponent(d.id)}`, {
        signal: AbortSignal.timeout(15000),
      });
      video = ((await res.json()) as any)?.items?.[0]?.video_info?.url_list?.[0] ?? null;
    } catch {
      video = null;
    }
    video ??= d.video?.playAddr || d.video?.downloadAddr || d.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] || null;
    if (!video) {
      const canon = username ? `https://www.tiktok.com/@${username}/video/${d.id}` : input;
      video = (await getVideoSrc(canon, username, d.id, null))?.url ?? null;
    }
  }

  return {
    id: d.id ?? null,
    type: isPhoto ? "photo" : "video",
    title: d.desc ?? "",
    cover: d.video?.cover ?? d.video?.originCover ?? null,
    url: username ? `https://www.tiktok.com/@${username}/video/${d.id}` : null,
    video: proxied(video),
    videoHd: null,
    duration: seconds(d.video?.duration),
    region: d.locationCreated || null,
    createdAt: seconds(d.createTime),
    music: d.music?.playUrl
      ? { title: d.music.title ?? "Musik", author: d.music.authorName ?? "", url: proxied(d.music.playUrl) as string }
      : null,
    images: images.map((u) => proxied(u) as string),
    author: {
      username,
      nickname: d.author?.nickname ?? "",
      avatar: d.author?.avatarThumb ?? null,
      verified: !!d.author?.verified,
      followers: nz(d.authorStats?.followerCount),
      likes: nz(d.authorStats?.heartCount),
      videos: nz(d.authorStats?.videoCount),
    },
    stats: {
      views: nz(d.stats?.playCount),
      likes: nz(d.stats?.diggCount),
      comments: nz(d.stats?.commentCount),
      shares: nz(d.stats?.shareCount),
    },
    source: "page",
  };
}

const cache = new Map<string, { at: number; value: TikTokMedia }>();

export async function runTikTok(input: string): Promise<TikTokMedia> {
  const key = input.split("?")[0] as string;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;

  let firstError: Error | null = null;
  for (const run of [fromGo, fromTikwm, fromPage]) {
    try {
      const result = await run(input);
      if (result && (result.video || result.images.length)) {
        cache.set(key, { at: Date.now(), value: result });
        if (cache.size > 200) cache.delete(cache.keys().next().value as string);
        return result;
      }
    } catch (e) {
      firstError ??= e instanceof Error ? e : new Error(String(e));
    }
  }
  throw firstError ?? new Error("Videonya nggak ketemu atau akunnya privat.");
}
