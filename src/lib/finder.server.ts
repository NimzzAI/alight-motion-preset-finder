import { settings } from "../config/settings.server";
import { fetchText, hostIn, hostOf, http, mapLimit, sleep } from "./http.server";
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
import { getVideoInfo, resolveTiktok } from "./tiktok-page.server";
import { getVideoSrc, videoFields } from "./video-src.server";
import type { FindResult, Preset } from "./types";

type Found = {
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

async function resolveChain(url: string): Promise<string | null> {
  let cur = url;
  let amUrl = isAm(url) ? url : null;

  for (let i = 0; i < 8; i++) {
    let res: Response;
    try {
      res = await http(cur, { redirect: "manual", timeout: 10000 });
    } catch {
      break;
    }
    if (res.status < 300 || res.status >= 400) break;
    const loc = res.headers.get("location");
    if (!loc) break;
    if (loc.startsWith("intent://")) {
      const m = decodeURIComponent(loc).match(/https?:\/\/alightcreative\.com\/am\/share\/[^\s"'<>;]+/i);
      if (m) amUrl = m[0];
      break;
    }
    cur = new URL(loc, cur).href;
    if (isAm(cur)) amUrl = cur;
    if (AM_SHARE_RE.test(cur)) break;
  }

  if (!amUrl) return null;
  return AM_SHARE_RE.test(amUrl) ? amUrl : isAm(cur) ? cur : amUrl;
}

async function getProfile(user: string) {
  const empty = { bio: "", avatar: null as string | null, bioLink: null as string | null, links: [] as string[] };
  if (!user) return empty;
  try {
    const { body } = await fetchText(`https://www.tiktok.com/@${user}`);
    const m = body.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
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
      avatar: (u.avatarMedium as string) ?? null,
      bioLink,
      links: [...new Set([...(bioLink ? [bioLink] : []), ...links])],
    };
  } catch {
    return empty;
  }
}

async function getComments(videoId: string, author: string): Promise<Comment[]> {
  const all: Comment[] = [];
  let cursor = 0;

  for (let page = 0; page < settings.finder.commentPages; page++) {
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
      const res = await http(`https://www.tiktok.com/api/comment/list/?${q}`, { accept: "application/json" });
      const j = JSON.parse(await res.text());
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
      await sleep(250);
    } catch {
      break;
    }
  }

  return all.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.digg - a.digg);
}

async function getReplies(videoId: string, cid: string): Promise<Reply[]> {
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

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(400);
    try {
      const res = await http(`https://api16.tiktokv.com/aweme/v1/comment/list/reply/?${q}`, {
        accept: "application/json",
        ua: REPLY_UA,
      });
      const j = JSON.parse(await res.text());
      if (j.comments?.length) {
        return j.comments.map((c: any) => ({
          text: c.text ?? "",
          user: c.user?.unique_id ?? "",
          digg: c.digg_count ?? 0,
        }));
      }
    } catch {
      continue;
    }
  }
  return [];
}

async function getShareInfo(url: string): Promise<{ title: string | null; thumb: string | null }> {
  try {
    const { body } = await fetchText(url);
    const t = body.match(/<title>([\s\S]*?)<\/title>/i);
    const thumbs = [
      ...new Set(
        [...body.matchAll(/https:\/\/firebasestorage\.googleapis\.com\/[^\s"'<>]+thumb-\w+\.jpg[^\s"'<>]*/gi)].map((x) =>
          x[0].replace(/&amp;/g, "&"),
        ),
      ),
    ];
    thumbs.sort((a, b) => (/thumb-med/i.test(a) ? 0 : 1) - (/thumb-med/i.test(b) ? 0 : 1));
    return {
      title: t ? (t[1] as string).replace(/\s+/g, " ").trim().replace(/ - Alight Motion Project$/i, "") : null,
      thumb: thumbs[0] ?? null,
    };
  } catch {
    return { title: null, thumb: null };
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

async function getFileInfo(url: string): Promise<{ title?: string | null; size?: string | null }> {
  const id = url.match(/\/file\/d\/([\w-]{10,})/)?.[1];
  const out: { title?: string | null; size?: string | null } = {};

  if (id) {
    try {
      const res = await http(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, {
        accept: "*/*",
        timeout: 20000,
        referer: "https://drive.google.com/",
      });
      if (res.ok && !(res.headers.get("content-type") ?? "").includes("text/html")) {
        const len = Number(res.headers.get("content-length") ?? 0);
        out.size = humanSize(len);
        if (len <= 8 * 1024 * 1024) {
          const head = Buffer.from(await res.arrayBuffer()).subarray(0, 8192).toString("utf8");
          out.title = head.match(/<scene[^>]*\stitle="([^"]*)"/)?.[1] ?? null;
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
      const { body } = await fetchText(url, { timeout: 10000 });
      const m = body.match(/<title>([\s\S]*?)<\/title>/i);
      out.title = m
        ? (m[1] as string)
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\s+-\s+(Google Drive|MediaFire|Dropbox|Mega)\s*$/i, "")
        : null;
    } catch {
      out.title = null;
    }
  }

  return out;
}

async function harvestTree(url: string): Promise<string[]> {
  try {
    const { body } = await fetchText(url);
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

async function scan(input: string): Promise<FindResult> {
  const { videoId, user: urlUser } = await resolveTiktok(input);
  const info = await getVideoInfo(videoId);
  const user = info.user || urlUser;
  const canon = user ? `https://www.tiktok.com/@${user}/video/${videoId}` : input;

  const [profile, comments, videoSrc] = await Promise.all([
    getProfile(user),
    getComments(videoId, user),
    getVideoSrc(canon, user, videoId, info.src ?? null),
  ]);

  const found: Found[] = [];
  const seen = new Set<string>();
  const hasAm = () => found.some((x) => isAm(x.url));

  const add = (raw: string, kind: string, x: Partial<Found> = {}) => {
    const url = clean(raw);
    if (!url || seen.has(url) || (isNoise(url) && !isAm(url) && !isFile(url))) return;
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

  extractLinks(info.description).forEach((u) => add(u, "description"));
  extractLinks(info.bio || profile.bio).forEach((u) => add(u, "bio"));
  profile.links.forEach((u) => add(u, "bioLink"));
  for (const c of comments) {
    extractLinks(c.text).forEach((u) =>
      add(u, "comment", { pinned: c.pinned, byAuthor: c.byAuthor, digg: c.digg, detail: "@" + c.user }),
    );
  }

  let replyCount = 0;
  if (!hasAm()) {
    const parents = comments
      .filter((c) => c.cid && c.replyCount > 0)
      .sort((a, b) => Number(b.byAuthor) - Number(a.byAuthor) || Number(b.pinned) - Number(a.pinned) || b.digg - a.digg)
      .slice(0, 12);

    for (let i = 0; i < parents.length; i += 3) {
      const batch = await mapLimit(parents.slice(i, i + 3), 3, (p) => getReplies(videoId, p.cid));
      for (const c of batch.flat()) {
        replyCount++;
        extractLinks(c.text).forEach((u) =>
          add(u, "comment", { byAuthor: !!user && c.user === user, digg: c.digg, detail: `@${c.user} (balasan)` }),
        );
      }
      if (hasAm() || (found.some((x) => isFile(x.url)) && i >= 6)) break;
    }
  }

  if (!hasAm()) {
    const trees = found.filter((x) => hostIn(x.url, TREE_HOSTS)).map((x) => x.url);
    if (trees.length) {
      (await mapLimit(trees, 4, harvestTree)).flat().slice(0, 40).forEach((u) => add(u, "bioLink"));
    }
  }

  const targets = found.filter((x) => !isAm(x.url) && !isFile(x.url) && !hostIn(x.url, NOISE_HOSTS)).slice(0, 15);
  const resolved = await mapLimit(targets, 5, async (x) => ({ x, amUrl: await resolveChain(x.url) }));
  for (const r of resolved) {
    if (r.amUrl && !seen.has(r.amUrl)) {
      seen.add(r.amUrl);
      found.push({ ...r.x, url: r.amUrl, origin: r.x.url });
    }
  }

  const items: Item[] = found
    .filter((x) => isAm(x.url) || isFile(x.url))
    .map((x) => ({ ...x, type: isAm(x.url) ? "5mb" : "xml" }));

  await mapLimit(items, 4, async (p) => {
    if (p.type === "5mb") {
      const s = await getShareInfo(p.url);
      p.title = s.title;
      p.thumb = s.thumb;
    } else {
      Object.assign(p, await getFileInfo(p.url));
    }
  });

  for (const p of items) {
    if (!isDefaultTitle(p.title)) continue;
    const twin = items.find((o) => o !== p && o.detail && o.detail === p.detail && o.title && !isDefaultTitle(o.title));
    if (twin) p.title = twin.title;
  }

  items.sort((a, b) => trust(b) - trust(a) || (a.type === b.type ? 0 : a.type === "5mb" ? -1 : 1));

  const presets: Preset[] = items.map((p) => ({
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

  return {
    engine: "finder",
    video: {
      id: videoId,
      url: `https://www.tiktok.com/@${user}/video/${videoId}`,
      ...videoFields(videoSrc),
      cover: info.cover ?? null,
      description: info.description ?? "",
      views: info.views ?? null,
      likes: info.likes ?? null,
      comments: info.comments ?? comments.length,
    },
    author: {
      username: user,
      nickname: info.nickname ?? "",
      avatar: info.avatar ?? profile.avatar,
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

