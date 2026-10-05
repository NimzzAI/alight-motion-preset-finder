import { settings } from "../config/settings.server";
import { finishFound, makeAdder, type Found } from "./finder.server";
import { hostIn } from "./http.server";
import { getInstagramFromSnapsave, getIgPost, igShortcode, resolveIgShare } from "./instagram.server";
import { extractLinks, isAm } from "./links.server";
import { mediaLink } from "./sign.server";
import { collectYoutube, getYtMeta, getYtMp4 } from "./youtube.server";
import type { FindResult } from "./types";

const YT_SKIP = ["youtube.com", "youtu.be", "youtube-nocookie.com", "ytimg.com", "ggpht.com"];

type Src = { url: string; from: string } | null;

const srcFields = (v: Src) => ({ src: v?.url ?? null, proxy: v ? mediaLink(v.url) : null });

const cleanIgUrl = (input: string) => {
  const u = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
  u.search = "";
  u.hash = "";
  return u.href;
};

const asNumber = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);

export async function findInstagram(input: string): Promise<FindResult> {
  const url = await resolveIgShare(cleanIgUrl(input));
  const code = igShortcode(url);
  const [post, d] = await Promise.all([code ? getIgPost(code) : null, getInstagramFromSnapsave(url)]);
  const caption = post?.caption || d?.caption || "";
  if (!d?.url && !d?.cover && !caption) {
    throw new Error("Postingan Instagram-nya nggak bisa diambil, pastikan akunnya nggak privat ya.");
  }

  const found: Found[] = [];
  const seen = new Set<string>();
  const add = makeAdder(found, seen);
  extractLinks(caption).forEach((u) => add(u, "description"));
  const presets = await finishFound(found, seen);

  return {
    engine: "finder",
    platform: "instagram",
    video: {
      id: code ?? "",
      title: null,
      vertical: true,
      kind: d?.kind ?? "video",
      count: d?.count ?? 0,
      duration: null,
      createdAt: null,
      url: code ? `https://www.instagram.com/p/${code}/` : url,
      ...srcFields(d?.url ? { url: d.url, from: "snapsave" } : null),
      cover: d?.cover ?? post?.cover ?? null,
      description: caption.slice(0, 500),
      views: null,
      likes: null,
      comments: null,
    },
    author: { username: post?.user ?? "", nickname: post?.user ?? "", avatar: null },
    scanned: { comments: 0, replies: 0 },
    presets,
  };
}

export async function findYoutube(id: string, shorts: boolean): Promise<FindResult> {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const [meta, y, mp4] = await Promise.all([
    getYtMeta(watchUrl),
    collectYoutube(id, isAm).then(
      (r) => ({ ok: true as const, r }),
      (e: Error) => ({ ok: false as const, error: e.message }),
    ),
    getYtMp4(id),
  ]);

  if (!y.ok && !meta) throw new Error(y.error);

  const links = y.ok
    ? y.r.links
    : extractLinks(String(meta?.description ?? "").replace(/https?:\/\/\S*(?:\.\.\.|…)/g, "")).map((url) => ({
        url,
        kind: "description",
      }));

  const found: Found[] = [];
  const seen = new Set<string>();
  const add = makeAdder(found, seen);
  for (const l of links) {
    if (hostIn(l.url, YT_SKIP)) continue;
    const { url, kind, ...rest } = l;
    add(url, kind, rest);
  }
  const presets = await finishFound(found, seen);

  const r = y.ok ? y.r : null;
  const description = r ? r.description : (meta?.description ?? "");
  const channel = meta?.channel.name ?? r?.channel ?? "YouTube";

  return {
    engine: "finder",
    platform: "youtube",
    video: {
      id,
      title: meta?.title ?? r?.title ?? null,
      vertical: shorts,
      kind: "video",
      count: 0,
      duration: meta?.duration ?? null,
      createdAt: meta?.uploadedDate ?? r?.published ?? null,
      url: watchUrl,
      ...srcFields(mp4 ? { url: mp4, from: "y2" } : null),
      cover: meta?.thumbnails[0]?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      description: String(description).slice(0, 500),
      views: asNumber(meta?.views) ?? r?.views ?? null,
      likes: asNumber(meta?.likes),
      comments: meta && meta.comments !== meta.views ? asNumber(meta.comments) : null,
    },
    author: { username: channel, nickname: channel, avatar: null, subs: meta?.channel.subs ?? null },
    scanned: { comments: r?.commentsScanned ?? 0, replies: r?.repliesScanned ?? 0 },
    presets,
  };
}

const cache = new Map<string, { at: number; value: FindResult }>();

export async function runSocial(input: string, platform: "youtube" | "instagram", id: string | null): Promise<FindResult> {
  const ttl = settings.finder.cacheMinutes * 60_000;
  const hit = cache.get(input);

  if (hit && Date.now() - hit.at < ttl) {
    const v = hit.value;
    if (platform === "youtube" && v.video.id) {
      const mp4 = await getYtMp4(v.video.id);
      return { ...v, video: { ...v.video, ...srcFields(mp4 ? { url: mp4, from: "y2" } : null) } };
    }
    if (platform === "instagram" && v.video.url) {
      const d = await getInstagramFromSnapsave(v.video.url);
      return { ...v, video: { ...v.video, ...srcFields(d?.url ? { url: d.url, from: "snapsave" } : null) } };
    }
    return v;
  }

  const value = platform === "youtube" ? await findYoutube(id as string, /\/shorts\//.test(input)) : await findInstagram(input);
  if (value.presets.length) {
    cache.set(input, { at: Date.now(), value });
    if (cache.size > settings.finder.cacheMax) cache.delete(cache.keys().next().value as string);
  }
  return value;
}
