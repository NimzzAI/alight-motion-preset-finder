import { settings } from "../config/settings.server";
import { DESKTOP_UA, fetchText, hostIn, hostOf, http, mapLimit, sleep } from "./http.server";
import {
  AM_SHARE_RE,
  NOISE_HOSTS,
  TREE_HOSTS,
  clean,
  extractLinks,
  isAm,
  isFile,
  isNoise,
} from "./links.server";
import { mediaLink } from "./sign.server";
import { getVideoInfo, resolveTiktok } from "./tiktok-page.server";
import { getVideoSrc, isSignedWebappUrl, videoFields } from "./video-src.server";
import type { FindResult, Preset } from "./types";

export type Found = {
  url: string;
  kind: string;
  detail: string | null;
  pinned: boolean;
  byAuthor: boolean;
  digg: number;
  origin?: string;
};

type Item = Found & {
  type: "5mb" | "xml";
  title?: string | null;
  size?: string | null;
  thumb?: string | null;
};

type Comment = {
  text: string;
  user: string;
  pinned: boolean;
  digg: number;
  cid: string;
  replyCount: number;
  byAuthor: boolean;
};

type Reply = { text: string; user: string; digg: number };

const REPLY_UA =
  "com.zhiliaoapp.musically/300000 (Linux; U; Android 13; id_ID; M2101K6G; Build/TKQ1.220829.002; Cronet/TTNetVersion:b4d74d55 2023-02-16 QuicVersion:41928d6a 2023-01-30)";

export function decodeHtmlEntities(input: string | null | undefined): string | null {
  if (!input) return null;
  return input
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

export async function resolveChain(url: string): Promise<string | null> {
  let cur = url;
  let resolvedPresetUrl: string | null = isAm(url) || isFile(url) ? url : null;

  for (let i = 0; i < 8; i++) {
    let res: Response;
    try {
      res = await http(cur, { redirect: "manual", timeout: 10000, ua: DESKTOP_UA });
    } catch {
      break;
    }
    if (res.status < 300 || res.status >= 400) break;
    const loc = res.headers.get("location");
    if (!loc) break;
    if (loc.startsWith("intent://")) {
      const dec = decodeURIComponent(loc);
      const m =
        dec.match(/https?:\/\/alightcreative\.com\/am\/share\/[^\s"'<>;]+/i) ??
        dec.match(/[?&]url=(https?:\/\/[^\s"'<>&;]+)/i);
      if (m) {
        const extracted = clean(m[1] ?? m[0]);
        if (isAm(extracted) || isFile(extracted)) resolvedPresetUrl = extracted;
      }
      break;
    }
    try {
      cur = new URL(loc, cur).href;
    } catch {
      break;
    }
    if (isAm(cur) || isFile(cur)) resolvedPresetUrl = cur;
    if (AM_SHARE_RE.test(cur) || isFile(cur)) break;
  }

  return resolvedPresetUrl;
}

export async function getProfile(user: string) {
  const empty = { bio: "", avatar: null as string | null, bioLink: null as string | null, links: [] as string[] };
  if (!user) return empty;
  try {
    const { body } = await fetchText(`https://www.tiktok.com/@${user}`, { ua: DESKTOP_UA });
    const m = body.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    let u: any = {};
    try {
      u = JSON.parse(m?.[1] ?? "{}")?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user ?? {};
    } catch {
      u = {};
    }
    const bm = body.match(/"bioLink":\{"link":"([^"]+)"/);
    const bioLink = bm ? (bm[1] as string).replace(/\\u002F/g, "/") : null;
    const links = extractLinks(body).filter((x) => !isNoise(x));
    return {
      bio: (u.signature as string) ?? "",
      avatar: (u.avatarMedium as string) ?? (u.avatarThumb as string) ?? null,
      bioLink,
      links: [...new Set([...(bioLink ? [bioLink] : []), ...links])],
    };
  } catch {
    return empty;
  }
}

export async function getComments(videoId: string, author: string, maxPages: number = settings.finder.commentPages): Promise<Comment[]> {
  const all: Comment[] = [];
  let cursor = 0;

  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({
      device_id: "7000000000000000001",
      aweme_id: videoId,
      count: "50",
      cursor: String(cursor),
      aid: "1233",
      app_language: "en",
      device_platform: "android",
      os_version: "29",
      region: "ID",
    });
    try {
      const res = await http(`https://www.tiktok.com/api/comment/list/?${q}`, {
        accept: "application/json",
        timeout: 1800,
      });
      const text = await res.text();
      const j = text ? JSON.parse(text) : {};
      const list: any[] = j.comments ?? [];
      for (const c of list) {
        const user = c.user?.unique_id ?? "";
        all.push({
          text: c.text ?? "",
          user,
          pinned: c.author_pin === true,
          digg: c.digg_count ?? 0,
          cid: c.cid ?? "",
          replyCount: c.reply_comment_total ?? 0,
          byAuthor: !!author && user === author,
        });
      }
      if (!j.has_more || !list.length) break;
      cursor = j.cursor ?? cursor + 50;
      await sleep(100);
    } catch {
      break;
    }
  }

  // When deployed to Vercel/serverless where TikTok blocks direct mobile endpoints,
  // fall back to TikWM public comment API to ensure comments (and pinned preset links) are recovered
  if (all.length === 0) {
    try {
      const targetUrl = author
        ? `https://www.tiktok.com/@${author}/video/${videoId}`
        : `https://www.tiktok.com/@user/video/${videoId}`;
      const res = await fetch(`https://www.tikwm.com/api/comment/list?url=${encodeURIComponent(targetUrl)}&count=50`, {
        headers: { "User-Agent": DESKTOP_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(2800),
      });
      if (res.ok) {
        const j = (await res.json()) as any;
        const list: any[] = j?.data?.comments ?? [];
        for (const c of list) {
          const user = c.user?.unique_id ?? "";
          all.push({
            text: c.text ?? "",
            user,
            pinned: c.author_pin === true || c.pinned === true,
            digg: c.digg_count ?? 0,
            cid: c.id ?? "",
            replyCount: c.reply_total ?? c.reply_count ?? 0,
            byAuthor: !!author && user === author,
          });
        }
      }
    } catch {
      // Ignore fallback errors
    }
  }

  return all.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.digg - a.digg);
}

export async function getReplies(videoId: string, cid: string): Promise<Reply[]> {
  const q = new URLSearchParams({
    device_id: "7185643774736387594",
    iid: "7129847366169418245",
    version_code: "300000",
    aid: "1180",
    device_platform: "android",
    channel: "googleplay",
    app_name: "musically",
    os_api: "33",
    os_version: "13",
    os_name: "Android",
    device_type: "Redmi Note 10",
    resolution: "1080*2400",
    language: "en",
    aweme_id: videoId,
    comment_id: cid,
    cursor: "0",
    count: "20",
  });

    try {
      const res = await http(`https://api16.tiktokv.com/aweme/v1/comment/list/reply/?${q}`, {
        accept: "application/json",
        ua: REPLY_UA,
        timeout: 1500,
      });
      const text = await res.text();
      const j = text ? JSON.parse(text) : {};
      if (j.comments?.length) {
        return j.comments.map((c: any) => ({
          text: c.text ?? "",
          user: c.user?.unique_id ?? "",
          digg: c.digg_count ?? 0,
        }));
      }
    } catch {
      return [];
    }
    return [];
}

async function getShareInfo(
  url: string,
): Promise<{ resolvedUrl: string; title: string | null; thumb: string | null; dead?: boolean }> {
  let targetUrl = url;
  if (!AM_SHARE_RE.test(targetUrl)) {
    const resolved = await resolveChain(targetUrl);
    if (resolved && isAm(resolved)) targetUrl = resolved;
  }

  try {
    const { status, body, finalUrl } = await fetchText(targetUrl, { ua: DESKTOP_UA, timeout: 10000 });
    if (finalUrl && AM_SHARE_RE.test(finalUrl)) {
      targetUrl = finalUrl;
    }
    if (status === 404 || status === 410) {
      return { resolvedUrl: targetUrl, title: null, thumb: null, dead: true };
    }
    const t = body.match(/<title>([\s\S]*?)<\/title>/i);
    const thumbs = [
      ...new Set(
        [...body.matchAll(/https:\/\/firebasestorage\.googleapis\.com\/[^\s"'<>]+thumb-\w+\.jpg[^\s"'<>]*/gi)].map((x) =>
          x[0].replace(/&amp;/g, "&"),
        ),
      ),
    ];
    thumbs.sort((a, b) => (/thumb-med/i.test(a) ? 0 : 1) - (/thumb-med/i.test(b) ? 0 : 1));
    const rawTitle = t
      ? decodeHtmlEntities((t[1] as string).replace(/\s+/g, " ").trim().replace(/ - Alight Motion Project$/i, ""))
      : null;
    if (rawTitle && /^(page not found|404|not found|error)/i.test(rawTitle)) {
      return { resolvedUrl: targetUrl, title: null, thumb: null, dead: true };
    }
    const validTitle = rawTitle && !/^alight motion$/i.test(rawTitle) ? rawTitle : null;
    const isDeadAmShare = AM_SHARE_RE.test(targetUrl) && !validTitle && thumbs.length === 0;
    return {
      resolvedUrl: targetUrl,
      title: validTitle,
      thumb: thumbs[0] ?? null,
      dead: isDeadAmShare,
    };
  } catch {
    return { resolvedUrl: targetUrl, title: null, thumb: null };
  }
}

function humanSize(bytes: number): string | null {
  if (!bytes) return null;
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < 3) {
    bytes /= 1024;
    i++;
  }
  return i ? `${bytes.toFixed(1)} ${units[i]}` : `${bytes} B`;
}

async function getFileInfo(url: string): Promise<{ title?: string | null; size?: string | null; dead?: boolean }> {
  const id = url.match(/\/file\/d\/([\w-]{10,})/)?.[1] ?? url.match(/[?&]id=([\w-]{10,})/)?.[1];
  const out: { title?: string | null; size?: string | null; dead?: boolean } = {};

  if (id) {
    try {
      const res = await http(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, {
        accept: "*/*",
        timeout: 12000,
        referer: "https://drive.google.com/",
        ua: DESKTOP_UA,
      });
      if (res.status === 404) {
        out.dead = true;
        return out;
      }
      if (res.ok && !(res.headers.get("content-type") ?? "").includes("text/html")) {
        const len = Number(res.headers.get("content-length") ?? 0);
        out.size = humanSize(len);
        if (len <= 8 * 1024 * 1024) {
          const head = Buffer.from(await res.arrayBuffer()).subarray(0, 8192).toString("utf8");
          const rawXmlTitle = head.match(/<scene[^>]*\stitle="([^"]*)"/)?.[1] ?? null;
          out.title = decodeHtmlEntities(rawXmlTitle);
        } else {
          await res.body?.cancel();
        }
      }
    } catch {
      out.title ??= null;
    }
  }

  if (!out.title) {
    try {
      const { body } = await fetchText(url, { ua: DESKTOP_UA, timeout: 8000 });
      const m = body.match(/<title>([\s\S]*?)<\/title>/i);
      const raw = m
        ? decodeHtmlEntities(
            (m[1] as string)
              .replace(/\s+/g, " ")
              .trim()
              .replace(/\s+-\s+(Google Drive|MediaFire|Dropbox|Mega)\s*$/i, ""),
          )
        : null;
      if (raw && /^(page not found|404|file not found|error 404)/i.test(raw)) {
        out.dead = true;
        out.title = null;
      } else {
        out.title = raw && !/^(google drive|error|sign in|404|page not found)/i.test(raw) ? raw : null;
      }
    } catch {
      out.title = null;
    }
  }

  return out;
}

async function harvestTree(url: string): Promise<string[]> {
  try {
    const { body } = await fetchText(url, { ua: DESKTOP_UA, timeout: 10000 });
    const host = hostOf(url);
    return extractLinks(body).filter((u) => u !== url && !isNoise(u) && hostOf(u) && !hostOf(u).endsWith(host));
  } catch {
    return [];
  }
}

const isDefaultTitle = (t: unknown) => /^proyek baru\s*\d+$/i.test(String(t ?? "").trim());

const trust = (p: Item) =>
  p.kind === "description"
    ? 100
    : p.byAuthor
      ? 90
      : p.kind === "bio"
        ? 85
        : p.kind === "bioLink"
          ? 80
          : p.pinned
            ? 70
            : 20 + Math.min(p.digg, 50) / 5;

export function scoreReplyParent(c: Comment): number {
  let score = 0;
  if (c.byAuthor) score += 1000;
  if (c.pinned) score += 800;
  if (/\b(preset|pleset|5mb|xml|link|drive|am|alight|bawah|bagi|minta|mana)\b|👇|⬇️/i.test(c.text)) {
    score += 500;
  }
  score += Math.min(c.digg, 200);
  return score;
}

export function makeAdder(found: Found[], seen: Set<string>) {
  return (raw: string, kind: string, x: Partial<Found> = {}) => {
    const url = clean(raw);
    if (!url || (isNoise(url) && !isAm(url) && !isFile(url))) return;
    if (seen.has(url)) {
      const existing = found.find((item) => item.url === url);
      if (existing) {
        if (x.byAuthor && !existing.byAuthor) {
          existing.byAuthor = true;
          if (x.detail) existing.detail = x.detail;
        }
        if (x.pinned && !existing.pinned) {
          existing.pinned = true;
        }
        if ((x.digg ?? 0) > existing.digg) {
          existing.digg = x.digg ?? existing.digg;
        }
      }
      return;
    }
    seen.add(url);
    found.push({
      url,
      kind,
      detail: x.detail ?? null,
      pinned: !!x.pinned,
      byAuthor: !!x.byAuthor,
      digg: x.digg ?? 0,
    });
  };
}

export async function finishFound(found: Found[], seen: Set<string>, fallbackThumb: string | null = null): Promise<Preset[]> {
  const add = makeAdder(found, seen);

  // Harvest bio link trees so we capture both 5MB and XML links inside Linktree/Lynk.id/Heylink/s.id
  const trees = found.filter((x) => hostIn(x.url, TREE_HOSTS)).map((x) => x.url);
  if (trees.length) {
    (await mapLimit(trees.slice(0, 4), 4, harvestTree)).flat().slice(0, 40).forEach((u) => add(u, "bioLink"));
  }

  // Resolve shortlinks to either 5MB (Alight Motion) or XML (Google Drive / MediaFire / etc.)
  const targets = found.filter((x) => !isAm(x.url) && !isFile(x.url) && !hostIn(x.url, NOISE_HOSTS)).slice(0, 15);
  const resolved = await mapLimit(targets, 5, async (x) => ({ x, presetUrl: await resolveChain(x.url) }));
  for (const r of resolved) {
    if (r.presetUrl && !seen.has(r.presetUrl)) {
      seen.add(r.presetUrl);
      found.push({ ...r.x, url: r.presetUrl, origin: r.x.url });
    }
  }

  const items: (Item & { dead?: boolean })[] = found
    .filter((x) => isAm(x.url) || isFile(x.url))
    .map((x) => ({ ...x, type: isAm(x.url) ? "5mb" : "xml" }));

  await mapLimit(items, 5, async (p) => {
    if (p.type === "5mb") {
      const s = await getShareInfo(p.url);
      p.url = s.resolvedUrl || p.url;
      p.title = s.title;
      p.thumb = s.thumb;
      p.dead = s.dead;
    } else {
      Object.assign(p, await getFileInfo(p.url));
    }
  });

  // Deduplicate in case an alight.link shortlink resolved to the same canonical alightcreative.com URL
  const uniqueItems: Item[] = [];
  const finalSeenUrls = new Set<string>();
  for (const p of items) {
    if (p.dead) continue;
    const normUrl = p.url.replace(/\?source=link$/i, "");
    if (finalSeenUrls.has(normUrl)) continue;
    finalSeenUrls.add(normUrl);
    uniqueItems.push(p);
  }

  for (const p of uniqueItems) {
    if (!p.title || isDefaultTitle(p.title)) {
      const twin = uniqueItems.find(
        (o) => o !== p && o.title && !isDefaultTitle(o.title) && (o.detail === p.detail || o.byAuthor === p.byAuthor),
      );
      if (twin && !p.title) p.title = twin.title;
    }
    if (!p.thumb) {
      const thumbTwin = uniqueItems.find((o) => o !== p && o.thumb);
      p.thumb = thumbTwin?.thumb ?? fallbackThumb ?? null;
    }
  }

  uniqueItems.sort((a, b) => trust(b) - trust(a) || (a.type === b.type ? 0 : a.type === "5mb" ? -1 : 1));

  return uniqueItems.map((p) => ({
    type: p.type,
    url: p.url,
    title: p.title ?? null,
    size: p.size ?? null,
    thumb: p.thumb ?? null,
    source: p.kind,
    detail: p.detail,
    byAuthor: p.byAuthor,
    pinned: p.pinned,
  }));
}

const proxiedMedia = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? mediaLink(u) : u ?? null);

async function scan(input: string): Promise<FindResult> {
  const { videoId, user: urlUser, kind: urlKind } = await resolveTiktok(input);
  const info = await getVideoInfo(videoId, urlUser);
  const user = info.user || urlUser;
  const kind = info.kind ?? urlKind;
  const canon = user ? `https://www.tiktok.com/@${user}/${kind === "photo" ? "photo" : "video"}/${videoId}` : input;

  const [profile, comments, videoSrc] = await Promise.all([
    getProfile(user),
    getComments(videoId, user),
    info.src && !isSignedWebappUrl(info.src)
      ? Promise.resolve({ url: info.src, from: "go" })
      : getVideoSrc(canon, user, videoId, info.src ?? null),
  ]);

  const found: Found[] = [];
  const seen = new Set<string>();
  const hasAm = () => found.some((x) => isAm(x.url));
  const hasXml = () => found.some((x) => isFile(x.url));
  const add = makeAdder(found, seen);

  extractLinks(info.description).forEach((u) => add(u, "description"));
  extractLinks(info.bio || profile.bio).forEach((u) => add(u, "bio"));
  profile.links.forEach((u) => add(u, "bioLink"));
  for (const c of comments) {
    extractLinks(c.text).forEach((u) =>
      add(u, "comment", { pinned: c.pinned, byAuthor: c.byAuthor, digg: c.digg, detail: "@" + c.user }),
    );
  }

  // Stitch split links posted across multiple comments in the same thread
  if (comments.length > 1) {
    const combinedComments = comments.map((c) => c.text).join("\n");
    extractLinks(combinedComments).forEach((u) =>
      add(u, "comment", {
        pinned: comments.some((c) => c.pinned),
        byAuthor: comments.some((c) => c.byAuthor),
        digg: Math.max(0, ...comments.map((c) => c.digg)),
        detail: user ? `@${user}` : null,
      }),
    );
  }

  // Scan comment replies if either 5MB or XML is still missing
  let replyCount = 0;
  if (!hasAm() || !hasXml()) {
    const parents = comments
      .filter((c) => c.cid && c.replyCount > 0)
      .sort((a, b) => scoreReplyParent(b) - scoreReplyParent(a))
      .slice(0, 12);

    const allRepliesCollected: Reply[] = [];
    for (let i = 0; i < parents.length; i += 3) {
      const batch = await mapLimit(parents.slice(i, i + 3), 3, (p) => getReplies(videoId, p.cid));
      for (const c of batch.flat()) {
        replyCount++;
        allRepliesCollected.push(c);
        extractLinks(c.text).forEach((u) =>
          add(u, "comment", { byAuthor: !!user && c.user === user, digg: c.digg, detail: `@${c.user} (balasan)` }),
        );
      }
      if (hasAm() && hasXml()) break;
    }

    if (allRepliesCollected.length > 0) {
      const combinedThread = [...comments.map((c) => c.text), ...allRepliesCollected.map((r) => r.text)].join("\n");
      extractLinks(combinedThread).forEach((u) =>
        add(u, "comment", {
          byAuthor: true,
          digg: 10,
          detail: user ? `@${user} (balasan)` : "balasan",
        }),
      );
    }
  }

  const proxiedImages = (info.images ?? []).map((img) => proxiedMedia(img)).filter((x): x is string => Boolean(x));
  const proxiedCover = proxiedMedia(info.cover) ?? proxiedImages[0] ?? null;
  const presets = await finishFound(found, seen, proxiedCover);

  return {
    engine: "finder",
    platform: "tiktok",
    video: {
      id: videoId,
      title: null,
      vertical: true,
      kind: kind === "photo" || proxiedImages.length > 0 ? "image" : "video",
      count: proxiedImages.length,
      duration: info.duration ?? null,
      createdAt: info.createdAt ?? null,
      region: info.region ?? null,
      url: user ? `https://www.tiktok.com/@${user}/${kind === "photo" ? "photo" : "video"}/${videoId}` : input,
      ...videoFields(videoSrc),
      cover: proxiedCover,
      images: proxiedImages,
      description: info.description ?? "",
      views: info.views ?? null,
      likes: info.likes ?? null,
      comments: info.comments ?? comments.length,
      shares: info.shares ?? null,
      music: info.music
        ? {
            title: info.music.title,
            author: info.music.author,
            url: proxiedMedia(info.music.url),
          }
        : null,
    },
    author: {
      username: user,
      nickname: info.nickname ?? "",
      avatar: proxiedMedia(info.avatar ?? profile.avatar),
      followers: info.followers ?? null,
      likes: info.authorLikes ?? null,
      videos: info.authorVideos ?? null,
      verified: info.verified ?? false,
    },
    scanned: { comments: comments.length, replies: replyCount },
    presets,
  };
}

const cache = new Map<string, { at: number; value: FindResult }>();
const TTL = settings.finder.cacheMinutes * 60_000;

export async function runFinder(input: string): Promise<FindResult> {
  const hit = cache.get(input);
  if (hit && Date.now() - hit.at < TTL) {
    const { video, author } = hit.value;
    if (video.src) return hit.value;
    const fresh = await getVideoSrc(video.url ?? input, author.username, video.id ?? "", null);
    return { ...hit.value, video: { ...video, ...videoFields(fresh) } };
  }

  const value = await scan(input);
  if (value.presets.length) {
    cache.set(input, { at: Date.now(), value });
    if (cache.size > settings.finder.cacheMax) cache.delete(cache.keys().next().value as string);
  }
  return value;
}
