import { sleep } from "./http.server";
import { extractLinks } from "./links.server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FALLBACK_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const FALLBACK_VER = "2.20261002.01.00";

type Cfg = { key: string; ver: string; visitor: string };
type YtLink = { url: string; kind: string; pinned?: boolean; byAuthor?: boolean; digg?: number; detail?: string };
type YtComment = {
  text: string;
  user: string;
  creator: boolean;
  pinned: boolean;
  likes: string;
  urls: string[];
  replyToken?: string | null;
};

export type YtCollected = {
  links: YtLink[];
  commentsScanned: number;
  repliesScanned: number;
  title: string;
  channel: string;
  views: number | null;
  description: string;
  published: string | null;
};

function unwrapRedirect(u: string): string {
  try {
    const x = new URL(u);
    if (/(^|\.)youtube\.com$/.test(x.hostname) && x.pathname === "/redirect") return x.searchParams.get("q") ?? u;
  } catch {
    return u;
  }
  return u;
}

function* walk(n: any, depth = 0): Generator<any> {
  if (!n || typeof n !== "object" || depth > 40) return;
  yield n;
  if (Array.isArray(n)) for (const x of n) yield* walk(x, depth + 1);
  else for (const v of Object.values(n)) yield* walk(v, depth + 1);
}

function urlsIn(node: any): string[] {
  const out = new Set<string>();
  for (const n of walk(node)) {
    if (Array.isArray(n)) continue;
    for (const k of ["url", "href"]) if (typeof n[k] === "string" && /^https?:\/\//i.test(n[k])) out.add(n[k]);
  }
  return [...out];
}

function extractJson(html: string, markers: string[]): any {
  for (const marker of markers) {
    let i = html.indexOf(marker);
    if (i < 0) continue;
    i = html.indexOf("{", i + marker.length);
    if (i < 0) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < html.length; j++) {
      const c = html[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

const yhttp = (url: string, o: { method?: string; body?: string; accept?: string; headers?: Record<string, string>; timeout?: number } = {}) =>
  fetch(url, {
    method: o.method ?? "GET",
    redirect: "follow",
    body: o.body,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: o.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8",
      Cookie: "SOCS=CAI; CONSENT=YES+1",
      ...(o.headers ?? {}),
    },
    signal: AbortSignal.timeout(o.timeout ?? 15000),
  });

async function tube(endpoint: string, body: object, cfg: Cfg): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Youtube-Client-Name": "1",
    "X-Youtube-Client-Version": cfg.ver,
    Origin: "https://www.youtube.com",
  };
  if (cfg.visitor) headers["X-Goog-Visitor-Id"] = cfg.visitor;
  const res = await yhttp(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false&key=${cfg.key}`, {
    method: "POST",
    accept: "application/json",
    headers,
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: cfg.ver, hl: "en", gl: "US", visitorData: cfg.visitor || undefined } },
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`youtubei/${endpoint} status ${res.status}`);
  return res.json();
}

async function getWatch(id: string) {
  const res = await yhttp(`https://www.youtube.com/watch?v=${id}&hl=en&bpctr=9999999999&has_verified=1`);
  const html = await res.text();
  const cfg: Cfg = {
    key: html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ?? FALLBACK_KEY,
    ver: html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1] ?? FALLBACK_VER,
    visitor: html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1] ?? "",
  };
  let player = extractJson(html, ["var ytInitialPlayerResponse = ", "ytInitialPlayerResponse = "]);
  const data = extractJson(html, ["var ytInitialData = ", 'window["ytInitialData"] = ', "ytInitialData = "]);
  if (!player?.videoDetails) {
    try {
      player = await tube("player", { videoId: id }, cfg);
    } catch {
      player = player ?? null;
    }
  }
  return { player, data, cfg };
}

function findCommentToken(data: any): string | null {
  for (const n of walk(data)) {
    if (n.sectionIdentifier === "comment-item-section") {
      for (const m of walk(n)) {
        const t = m.continuationCommand?.token;
        if (t) return t;
      }
    }
  }
  return null;
}

function parseBatch(j: any) {
  const nodes: any[] = [];
  let next: string | null = null;
  for (const a of j.onResponseReceivedEndpoints ?? []) {
    const items = a.reloadContinuationItemsCommand?.continuationItems ?? a.appendContinuationItemsAction?.continuationItems ?? [];
    for (const it of items) {
      if (it.commentThreadRenderer) nodes.push(it.commentThreadRenderer);
      else if (it.commentViewModel || it.commentRenderer) nodes.push(it);
      else if (it.continuationItemRenderer) {
        next =
          it.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token ??
          it.continuationItemRenderer.button?.buttonRenderer?.command?.continuationCommand?.token ??
          next;
      }
    }
  }
  const ents = new Map<string, any>();
  for (const m of j.frameworkUpdates?.entityBatchUpdate?.mutations ?? []) {
    const p = m.payload?.commentEntityPayload;
    if (p && m.entityKey) ents.set(m.entityKey, p);
  }
  return { nodes, next, ents };
}

function readComment(node: any, ents: Map<string, any>): YtComment | null {
  const vm = node.commentViewModel?.commentViewModel ?? node.commentViewModel;
  const pinned = /"pinnedText"|"pinnedCommentBadge"/.test(JSON.stringify(node));
  const e = vm?.commentKey ? ents.get(vm.commentKey) : null;
  if (e) {
    const content = e.properties?.content;
    return {
      text: content?.content ?? "",
      user: e.author?.displayName ?? "",
      creator: !!e.author?.isCreator,
      pinned,
      likes: e.toolbar?.likeCountNotliked ?? "",
      urls: urlsIn(content),
    };
  }
  const r = node.comment?.commentRenderer ?? node.commentRenderer;
  if (!r) return null;
  const text = ((r.contentText?.runs ?? []) as any[])
    .map((x) => (x.navigationEndpoint?.urlEndpoint?.url ? ` ${x.navigationEndpoint.urlEndpoint.url} ` : (x.text ?? "")))
    .join("");
  return {
    text,
    user: r.authorText?.simpleText ?? "",
    creator: !!r.authorIsChannelOwner,
    pinned,
    likes: r.voteCount?.simpleText ?? "",
    urls: urlsIn(r.contentText),
  };
}

function replyToken(node: any): string | null {
  for (const m of walk(node.replies)) {
    const t = m.continuationCommand?.token;
    if (t) return t;
  }
  return null;
}

async function getComments(token: string, cfg: Cfg, pages: number): Promise<YtComment[]> {
  const out: YtComment[] = [];
  let tok: string | null = token;
  for (let p = 0; p < pages && tok; p++) {
    let j: any;
    try {
      j = await tube("next", { continuation: tok }, cfg);
    } catch (e) {
      if (!out.length) throw e;
      break;
    }
    const { nodes, next, ents } = parseBatch(j);
    for (const n of nodes) {
      const c = readComment(n, ents);
      if (c) out.push({ ...c, replyToken: replyToken(n) });
    }
    tok = next;
    if (tok) await sleep(250);
  }
  return out;
}

async function getReplies(parents: YtComment[], cfg: Cfg, max = 15): Promise<YtComment[]> {
  const pick = parents
    .filter((c) => c.replyToken)
    .sort((a, b) => Number(b.creator) - Number(a.creator) || Number(b.pinned) - Number(a.pinned))
    .slice(0, max);
  const out: YtComment[] = [];
  for (const c of pick) {
    try {
      const { nodes, ents } = parseBatch(await tube("next", { continuation: c.replyToken }, cfg));
      for (const n of nodes) {
        const r = readComment(n, ents);
        if (r) out.push(r);
      }
    } catch {
      continue;
    }
    await sleep(200);
  }
  return out;
}

const likeNum = (s: string) => {
  const m = String(s || "").replace(/,/g, "").match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return 0;
  const mult: Record<string, number> = { k: 1e3, m: 1e6 };
  return Math.round(Number(m[1]) * (mult[(m[2] ?? "").toLowerCase()] ?? 1));
};

export async function collectYoutube(id: string, isAm: (u: string) => boolean, pages = 3): Promise<YtCollected> {
  const w = await getWatch(id);
  const vd = w.player?.videoDetails;
  if (!vd) throw new Error(w.player?.playabilityStatus?.reason ?? "Video YouTube nggak bisa dibuka (mungkin dibatasi atau diprivat).");

  const links: YtLink[] = [];
  const push = (url: string, kind: string, x: Partial<YtLink> = {}) => {
    const u = unwrapRedirect(url);
    if (u) links.push({ url: u, kind, ...x });
  };

  extractLinks(vd.shortDescription ?? "").forEach((u) => push(u, "description"));
  for (const n of walk(w.data)) if (n.attributedDescription) urlsIn(n.attributedDescription).forEach((u) => push(u, "description"));

  const who = (c: YtComment) => "@" + String(c.user).replace(/^@/, "");
  const addC = (c: YtComment, tail = "") =>
    [...extractLinks(c.text), ...c.urls].forEach((u) =>
      push(u, "comment", { pinned: c.pinned, byAuthor: c.creator, digg: likeNum(c.likes), detail: who(c) + tail }),
    );

  let comments: YtComment[] = [];
  let repliesScanned = 0;
  const token = findCommentToken(w.data);
  if (token) {
    try {
      comments = await getComments(token, w.cfg, pages);
      comments.forEach((c) => addC(c));
    } catch {
      comments = [];
    }
    if (comments.length && !links.some((l) => isAm(l.url))) {
      const replies = await getReplies(comments, w.cfg);
      repliesScanned = replies.length;
      replies.forEach((c) => addC(c, " (balasan)"));
    }
  }

  return {
    links,
    commentsScanned: comments.length,
    repliesScanned,
    title: vd.title ?? "",
    channel: vd.author ?? "",
    views: Number(vd.viewCount) || null,
    description: vd.shortDescription ?? "",
    published: w.player?.microformat?.playerMicroformatRenderer?.publishDate ?? null,
  };
}

export type YtMeta = {
  title: string;
  uploadedDate: string | null;
  duration: string | null;
  views: number;
  likes: number;
  comments: number;
  description: string | null;
  thumbnails: { quality: string; url: string }[];
  channel: { name: string | null; id: string | null; subs: string | null };
};

export async function getYtMeta(youtubeUrl: string): Promise<YtMeta | null> {
  try {
    const cheerio = await import("cheerio");
    const res = await fetch("https://tubepilot.ai/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://tubepilot.ai",
        Referer: "https://tubepilot.ai/tools/youtube-data-viewer/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: new URLSearchParams({ action: "yt_data_viewer", yt_url: youtubeUrl }).toString(),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());

    const field = (label: string): string | null => {
      let value: string | null = null;
      $("b").each((_, el) => {
        if ($(el).text().trim().toLowerCase() === label.toLowerCase() + ":") {
          const nextNode = el.nextSibling as any;
          value = nextNode && nextNode.type === "text" ? String(nextNode.data).trim() : $(el).next().text().trim();
        }
      });
      return value || null;
    };
    const int = (label: string) => parseInt((field(label) ?? "").replace(/,/g, ""), 10) || 0;

    const title = field("Video Title");
    if (!title) return null;
    const thumbnails: { quality: string; url: string }[] = [];
    $(".ytimg-item").each((_, el) => {
      const url = $(el).find("a").first().attr("href");
      if (url) thumbnails.push({ quality: $(el).find("span").first().text().replace("✦", "").trim(), url });
    });

    return {
      title,
      uploadedDate: field("Video Uploaded Date"),
      duration: field("Duration"),
      views: int("Views Count"),
      likes: int("Likes Count"),
      comments: int("Comments Count"),
      description: $(".ytdesc .ytdesc-txt").text().trim() || null,
      thumbnails,
      channel: { name: field("Channel Name"), id: field("Channel ID"), subs: field("Subscribers Count") },
    };
  } catch {
    return null;
  }
}

const CNV = "https://cnv.cx/v2";
const FRAME = "https://frame.y2meta-uk.com";
const Y2_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Referer: FRAME + "/",
  Origin: FRAME,
};

export async function getYtMp4(id: string): Promise<string | null> {
  try {
    const keyRes = await fetch(`${CNV}/sanity/key?id=${id}`, { headers: Y2_HEADERS, signal: AbortSignal.timeout(10000) });
    const k: any = await keyRes.json();
    if (!k?.key) return null;
    for (const q of [360, 240, 720, 144]) {
      try {
        const r = await fetch(`${CNV}/converter`, {
          method: "POST",
          headers: { ...Y2_HEADERS, "Content-Type": "application/x-www-form-urlencoded", accept: "*/*", key: k.key },
          body: new URLSearchParams({
            link: `https://youtu.be/${id}`,
            format: "mp4",
            audioBitrate: "128",
            videoQuality: String(q),
            filenameStyle: "pretty",
            vCodec: "h264",
          }).toString(),
          signal: AbortSignal.timeout(20000),
        });
        const j: any = await r.json().catch(() => null);
        if (j?.url && /^https:\/\//i.test(j.url)) return j.url;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}
