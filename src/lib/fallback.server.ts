import { settings } from "../config/settings.server";
import { DESKTOP_UA } from "./http.server";
import { isAm } from "./links.server";
import { extractVideoId } from "./tiktok-page.server";
import { videoFields } from "./video-src.server";
import type { FindResult, Preset } from "./types";

const tiktokUrl = (user: string, id: string | null) => (user && id ? `https://www.tiktok.com/@${user}/video/${id}` : null);

const asNumber = (v: unknown) => (typeof v === "number" ? v : v == null ? null : Number(v) || null);

export async function runBintang(input: string): Promise<FindResult> {
  const res = await fetch(`${settings.finder.fallbacks.bintang}?url=${encodeURIComponent(input)}`, {
    headers: { "User-Agent": DESKTOP_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`bintang ${res.status}`);

  const j: any = await res.json();
  if (!j?.success || !j.data) throw new Error(j?.message ?? "bintang gagal");

  const d = j.data;
  const id = extractVideoId(input);
  const username: string = d.user?.username ?? "";
  const play: string | null = d.video?.play_url || d.video?.play_wm_url || null;
  const finder: string = d.preset?.username ? `@${d.preset.username}` : "";

  const presets: Preset[] = ((d.preset?.items ?? []) as any[])
    .filter((it) => typeof it?.url === "string" && /^https?:\/\//i.test(it.url))
    .map((it) => ({
      type: isAm(it.url) ? "5mb" : "xml",
      url: it.url,
      title: it.label ?? null,
      size: null,
      thumb: null,
      source: "comment",
      detail: finder || null,
      byAuthor: !!d.preset?.username && d.preset.username === username,
      pinned: false,
    }));

  return {
    engine: "bintang",
    video: {
      id,
      url: tiktokUrl(username, id),
      ...videoFields(play ? { url: play, from: "bintang" } : null),
      cover: d.video?.thumbnail ?? null,
      description: d.video?.caption ?? "",
      views: asNumber(d.video?.views),
      likes: asNumber(d.video?.likes),
      comments: asNumber(d.video?.comments),
    },
    author: { username, nickname: d.user?.display_name ?? "", avatar: d.user?.avatar ?? null },
    scanned: { comments: Number(d.total_comments_scanned) || 0, replies: 0 },
    presets,
  };
}

async function readSse(res: Response): Promise<any> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("amfinder tanpa body");
  const decoder = new TextDecoder();
  let buffer = "";
  let event: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (event === "result") {
        await reader.cancel();
        return JSON.parse(data);
      }
      if (event === "error") {
        await reader.cancel();
        let message = "amfinder error";
        try {
          message = JSON.parse(data).message ?? message;
        } catch {
          message = "amfinder error";
        }
        throw new Error(message);
      }
    }
  }
  throw new Error("amfinder terputus");
}

export async function runAmfinder(input: string): Promise<FindResult> {
  const res = await fetch(`${settings.finder.fallbacks.amfinder}?url=${encodeURIComponent(input)}`, {
    headers: { Accept: "text/event-stream", "User-Agent": "Mozilla/5.0 (compatible; AMFinderScraper/1.0)" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`amfinder ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) throw new Error("amfinder format aneh");

  const r = await readSse(res);
  if (r.ok === false) throw new Error(r.error ?? "amfinder gagal");

  const id = extractVideoId(input);
  const username: string = typeof r.author === "string" ? r.author : (r.author?.uniqueId ?? r.author?.username ?? "");
  const play: string | null = r.video?.playUrlNoWm || r.video?.playUrl || null;

  const presets: Preset[] = ((r.presetLinks ?? []) as any[])
    .filter((p) => typeof p?.url === "string")
    .map((p) => ({
      type: p.type === "5mb" ? "5mb" : "xml",
      url: p.url,
      title: p.title ?? null,
      size: p.size ?? null,
      thumb: p.thumb ?? null,
      source: p.pinned || p.byAuthor ? "comment" : "description",
      detail: p.detail ?? null,
      byAuthor: !!p.byAuthor,
      pinned: !!p.pinned,
    }));

  return {
    engine: "amfinder",
    video: {
      id,
      url: tiktokUrl(username, id),
      ...videoFields(play ? { url: play, from: "amfinder" } : null),
      cover: r.video?.cover ?? null,
      description: String(r.video?.description ?? "").trim(),
      views: asNumber(r.video?.stats?.views),
      likes: asNumber(r.video?.stats?.likes),
      comments: asNumber(r.video?.stats?.comments),
    },
    author: { username, nickname: "", avatar: r.authorDetail?.avatar ?? r.avatar ?? null },
    scanned: { comments: 0, replies: 0 },
    presets,
  };
}
