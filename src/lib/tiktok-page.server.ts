import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { settings } from "../config/settings.server";
import { DESKTOP_UA, fetchText, http, sleep } from "./http.server";

let goProc: ChildProcess | null = null;
let goStarting: Promise<boolean> | null = null;

export async function ensureGoServiceRunning(): Promise<boolean> {
  const { goServiceUrl } = settings.downloader;
  if (!goServiceUrl) return false;

  try {
    const health = await fetch(`${goServiceUrl}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (health.ok) return true;
  } catch {
    // Attempt to spawn local Golang binary
  }

  if (goStarting) return goStarting;

  goStarting = (async () => {
    try {
      const binCandidates = [
        path.resolve(process.cwd(), "services/downloader-go/downloader-bin"),
        "/app/applet/services/downloader-go/downloader-bin",
      ];
      const binPath = binCandidates.find((p) => fs.existsSync(p));
      if (!binPath) return false;

      try {
        fs.chmodSync(binPath, 0o755);
      } catch {
        // Ignore if read-only filesystem
      }

      if (!goProc || goProc.killed) {
        goProc = spawn(binPath, [], {
          env: { ...process.env, GO_PORT: "8090", PORT: "8090" },
          stdio: "ignore",
          detached: true,
        });
        goProc.unref();
      }

      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 180));
        try {
          const check = await fetch(`${goServiceUrl}/health`, {
            signal: AbortSignal.timeout(800),
          });
          if (check.ok) return true;
        } catch {
          // Wait for startup
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      goStarting = null;
    }
  })();

  return goStarting;
}

export function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^\d{15,}$/.test(s)) return s;
  const patterns = [
    /\/(?:video|photo)\/(\d{15,})/,
    /\/v\/(\d{15,})/,
    /[?&](?:item_id|share_item_id|aweme_id)=(\d{15,})/,
    /\/(\d{15,})(?:\?|$)/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1] as string;
  }
  return null;
}

export async function resolveTiktok(input: string): Promise<{ videoId: string; user: string; kind: "video" | "photo" }> {
  let cur = /^https?:\/\//i.test(input) ? input : "https://" + input;
  const userOf = (u: string) => u.match(/\/@([^/?#]+)\//)?.[1] ?? "";
  const kindOf = (u: string): "video" | "photo" => (/\/photo\//i.test(u) ? "photo" : "video");

  for (let i = 0; i < 6; i++) {
    const id = extractVideoId(cur);
    if (id && /tiktok\.com/i.test(cur)) return { videoId: id, user: userOf(cur), kind: kindOf(cur) };
    let res: Response;
    try {
      res = await http(cur, { redirect: "manual", timeout: 12000 });
    } catch {
      break;
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      cur = new URL(loc, cur).href;
      continue;
    }
    break;
  }

  const id = extractVideoId(cur);
  if (!id) throw new Error("Link TikTok-nya nggak valid atau nggak bisa dibuka.");
  return { videoId: id, user: userOf(cur), kind: kindOf(cur) };
}

export type VideoInfo = {
  description: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  cover: string | null;
  src: string | null;
  images: string[];
  kind: "video" | "photo";
  duration: string | null;
  createdAt: number | null;
  region: string | null;
  music: { title: string; author: string; url: string | null } | null;
  user: string;
  nickname: string;
  avatar: string | null;
  bio: string;
  followers: number | null;
  authorLikes: number | null;
  authorVideos: number | null;
  verified: boolean;
};

const normTikwmUrl = (u: unknown): string | null => {
  if (!u || typeof u !== "string") return null;
  if (/^https?:/i.test(u)) return u.replace(/^http:/i, "https:");
  return "https://www.tikwm.com" + (u.startsWith("/") ? "" : "/") + u;
};

export async function getVideoInfo(videoId: string, userHint = ""): Promise<Partial<VideoInfo>> {
  const targetUrl = `https://www.tiktok.com/@${userHint || "user"}/video/${videoId}`;

  // 1. Primary: Golang Extractor Service (Slardar + Mobile Aweme Feed + SSR)
  const { goServiceUrl, goServiceSecret } = settings.downloader;
  if (goServiceUrl && (await ensureGoServiceRunning())) {
    try {
      const res = await fetch(`${goServiceUrl}/extract`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(goServiceSecret ? { "x-api-secret": goServiceSecret } : {}),
        },
        body: JSON.stringify({ url: targetUrl }),
        signal: AbortSignal.timeout(14_000),
      });
      if (res.ok) {
        const d = ((await res.json()) as any)?.data;
        if (d && d.id) {
          const images = Array.isArray(d.images) ? d.images.filter((x: unknown): x is string => typeof x === "string") : [];
          return {
            description: d.title ?? "",
            views: typeof d.stats?.views === "number" ? d.stats.views : null,
            likes: typeof d.stats?.like === "number" ? d.stats.like : null,
            comments: typeof d.stats?.comment === "number" ? d.stats.comment : null,
            shares: typeof d.stats?.share === "number" ? d.stats.share : null,
            cover: d.cover || images[0] || null,
            src: d.video || null,
            images,
            kind: d.type === "photo" || images.length > 0 ? "photo" : "video",
            duration: d.duration && d.duration !== "0 detik" ? String(d.duration) : null,
            createdAt: typeof d.createTime === "number" && d.createTime > 0 ? d.createTime : null,
            region: d.region || null,
            music: d.music?.title
              ? {
                  title: d.music.title,
                  author: d.music.author ?? "",
                  url: d.music.url || null,
                }
              : null,
            user: d.author?.username || userHint,
            nickname: d.author?.nickname ?? "",
            avatar: d.author?.avatar || null,
            bio: d.author?.signature ?? "",
            followers: typeof d.author?.followers === "number" ? d.author.followers : null,
            authorLikes: typeof d.author?.like === "number" ? d.author.like : null,
            authorVideos: typeof d.author?.videoCount === "number" ? d.author.videoCount : null,
            verified: !!d.author?.verified,
          };
        }
      }
    } catch {
      // Fall through to SSR rehydration
    }
  }

  // 2. Fallback: Direct SSR Rehydration Script
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(400);
    try {
      const { body } = await fetchText(targetUrl, { ua: DESKTOP_UA, timeout: 9000 });
      const m = body.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) continue;
      const scope = JSON.parse(m[1] as string)?.__DEFAULT_SCOPE__;
      const struct =
        scope?.["webapp.video-detail"]?.itemInfo?.itemStruct ??
        scope?.["webapp.reflow.video.detail"]?.itemInfo?.itemStruct;
      if (!struct) continue;

      const images = Array.isArray(struct.imagePost?.images)
        ? (struct.imagePost.images as any[])
            .map((img) => img?.imageURL?.urlList?.[0] ?? img?.displayImage?.urlList?.[0])
            .filter(Boolean)
        : [];
      const durNum = Number(struct.video?.duration) || 0;

      return {
        description: struct.desc ?? "",
        views: Number(struct.stats?.playCount) || null,
        likes: Number(struct.stats?.diggCount) || null,
        comments: Number(struct.stats?.commentCount) || null,
        shares: Number(struct.stats?.shareCount) || null,
        cover: struct.video?.cover ?? struct.video?.originCover ?? images[0] ?? null,
        src: struct.video?.playAddr ?? struct.video?.downloadAddr ?? null,
        images,
        kind: images.length > 0 ? "photo" : "video",
        duration: durNum > 0 ? `${durNum} detik` : null,
        createdAt: Number(struct.createTime) || null,
        region: struct.locationCreated || null,
        music: struct.music?.title
          ? {
              title: struct.music.title,
              author: struct.music.authorName ?? "",
              url: struct.music.playUrl || null,
            }
          : null,
        user: struct.author?.uniqueId || userHint,
        nickname: struct.author?.nickname ?? "",
        avatar: struct.author?.avatarThumb ?? struct.author?.avatarMedium ?? null,
        bio: struct.author?.signature ?? "",
        followers: Number(struct.authorStats?.followerCount) || null,
        authorLikes: Number(struct.authorStats?.heartCount) || null,
        authorVideos: Number(struct.authorStats?.videoCount) || null,
        verified: !!struct.author?.verified,
      };
    } catch {
      continue;
    }
  }

  // 3. Secondary Fallback: TikWM API for Cover, Stream, and Metadata
  try {
    const q = new URLSearchParams({ url: targetUrl, hd: "1" });
    const res = await fetch("https://www.tikwm.com/api/?" + q, {
      headers: { "User-Agent": DESKTOP_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await res.json();
    const d = j?.data;
    if (j?.code === 0 && d) {
      const images = Array.isArray(d.images)
        ? (d.images as string[]).map((u) => normTikwmUrl(u)).filter((x): x is string => Boolean(x))
        : [];
      const durNum = Number(d.duration) || 0;
      return {
        description: d.title ?? "",
        views: typeof d.play_count === "number" ? d.play_count : null,
        likes: typeof d.digg_count === "number" ? d.digg_count : null,
        comments: typeof d.comment_count === "number" ? d.comment_count : null,
        shares: typeof d.share_count === "number" ? d.share_count : null,
        cover: normTikwmUrl(d.cover || d.origin_cover) ?? images[0] ?? null,
        src: normTikwmUrl(d.play || d.hdplay),
        images,
        kind: images.length > 0 ? "photo" : "video",
        duration: durNum > 0 ? `${durNum} detik` : null,
        createdAt: typeof d.create_time === "number" ? d.create_time : null,
        region: d.region || null,
        music: d.music_info?.title
          ? {
              title: d.music_info.title,
              author: d.music_info.author ?? "",
              url: normTikwmUrl(d.music_info.play ?? d.music),
            }
          : null,
        user: d.author?.unique_id || userHint,
        nickname: d.author?.nickname ?? "",
        avatar: normTikwmUrl(d.author?.avatar),
        bio: "",
        followers: null,
        authorLikes: null,
        authorVideos: null,
        verified: false,
      };
    }
  } catch {
    // Ignore
  }

  return {};
}
