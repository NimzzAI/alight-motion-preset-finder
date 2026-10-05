const IG_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const DOC_ID = "27128499623469141";

export const igShortcode = (u: string) => String(u).match(/\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

export async function resolveIgShare(url: string): Promise<string> {
  if (!/instagram\.com\/share\//i.test(url)) return url;
  try {
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": IG_UA }, signal: AbortSignal.timeout(8000) });
    const loc = r.headers.get("location");
    if (loc) return new URL(loc, url).href;
  } catch {
    return url;
  }
  return url;
}

export async function getIgPost(shortcode: string): Promise<{ caption: string; user: string; cover: string | null } | null> {
  try {
    const home = await fetch("https://www.instagram.com/", {
      headers: {
        "User-Agent": IG_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    const headers = home.headers as Headers & { getSetCookie?: () => string[] };
    const raw = headers.getSetCookie?.() ?? [];
    const cookie = raw.map((c) => c.split(";")[0]).join("; ");
    const csrf = cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";

    const r = await fetch("https://www.instagram.com/graphql/query", {
      method: "POST",
      headers: {
        "User-Agent": IG_UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRFToken": csrf,
        "X-IG-App-ID": "936619743392459",
        Cookie: cookie,
        Referer: `https://www.instagram.com/p/${shortcode}/`,
      },
      body: new URLSearchParams({
        variables: JSON.stringify({ shortcode, __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: false }),
        doc_id: DOC_ID,
        server_timestamps: "true",
      }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await r.json();
    const item = j?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0];
    if (!item) return null;
    return {
      caption: item.caption?.text ?? "",
      user: item.user?.username ?? "",
      cover: item.image_versions2?.candidates?.[0]?.url ?? null,
    };
  } catch {
    return null;
  }
}

const SNAP = "https://snapsave.app";
const SNAP_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36";
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

function toBase(d: string, e: number, f: number): number {
  const from = ALPHABET.slice(0, e).split("");
  const to = ALPHABET.slice(0, f).split("");
  let j = d
    .split("")
    .reverse()
    .reduce((a, b, c) => {
      const idx = from.indexOf(b);
      return idx !== -1 ? a + idx * Math.pow(e, c) : a;
    }, 0);
  let k = "";
  while (j > 0) {
    k = to[j % f] + k;
    j = (j - (j % f)) / f;
  }
  return parseInt(k || "0", 10);
}

function unpack(js: string): string | null {
  const m = js.match(/\(\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!m) return null;
  const h = m[1] as string;
  const n = m[3] as string;
  const t = parseInt(m[4] as string, 10);
  const e = parseInt(m[5] as string, 10);
  let r = "";
  for (let i = 0; i < h.length; i++) {
    let s = "";
    while (i < h.length && h[i] !== n[e]) {
      s += h[i];
      i++;
    }
    for (let j = 0; j < n.length; j++) s = s.replace(new RegExp(n[j] as string, "g"), String(j));
    r += String.fromCharCode(toBase(s, e, 10) - t);
  }
  return Buffer.from(r, "latin1").toString("utf8");
}

async function getScript(url: string): Promise<string> {
  const form = new FormData();
  form.append("url", url);
  const res = await fetch(`${SNAP}/action.php?lang=id`, {
    method: "POST",
    headers: { "User-Agent": SNAP_UA, Origin: SNAP, Referer: `${SNAP}/id/download-video-instagram` },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`snapsave ${res.status}`);
  let js = text;
  for (let i = 0; i < 3 && /function\s*\(h,u,n,t,e,r\)/.test(js); i++) {
    const out = unpack(js);
    if (!out) break;
    js = out;
  }
  return js;
}

function extractHtml(js: string): string | null {
  const patterns = [
    /getElementById\("download-section"\)\.innerHTML\s*=\s*"((?:\\.|[^"\\])*)"/,
    /innerHTML\s*=\s*"((?:\\.|[^"\\])*)"/,
  ];
  for (const p of patterns) {
    const m = js.match(p);
    if (m) {
      try {
        return JSON.parse(`"${m[1]}"`);
      } catch {
        return (m[1] as string).replace(/\\(.)/g, "$1");
      }
    }
  }
  return null;
}

const abs = (u: string) => (u.startsWith("http") ? u : SNAP + (u.startsWith("/") ? "" : "/") + u);

type SnapItem = { type: "image" | "video"; quality: string | null; thumbnail: string | null; url: string };

async function parseSnap(html: string): Promise<SnapItem[]> {
  const { load } = await import("cheerio");
  const $ = load(html);
  const items: SnapItem[] = [];
  const seen = new Set<string>();

  const push = (a: any, thumb: string | undefined | null) => {
    const $a = $(a);
    const onclick = $a.attr("onclick") ?? "";
    const viaRender = onclick.match(/get_progressApi\('([^']+)'\)/);
    const link = viaRender ? (viaRender[1] as string) : $a.attr("href");
    if (!link || link.startsWith("#") || link.startsWith("javascript")) return;
    const url = abs(link);
    if (seen.has(url)) return;
    seen.add(url);
    const label = $a.text().replace(/\s+/g, " ").trim();
    const isImage = /\.(jpe?g|png|webp)(\?|$)/i.test(url) || /foto|photo|image|gambar/i.test(label);
    items.push({ type: isImage ? "image" : "video", quality: label || null, thumbnail: thumb ?? null, url });
  };

  const blocks = $(".download-items");
  if (blocks.length) {
    blocks.each((_, el) => {
      const thumb = $(el).find("img").first().attr("src");
      $(el)
        .find("a")
        .each((__, a) => push(a, thumb));
    });
  } else {
    $("a").each((_, a) => push(a, null));
  }
  return items;
}

async function resolveRender(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": SNAP_UA, Referer: SNAP }, signal: AbortSignal.timeout(10000) });
  const j: any = await r.json();
  if (!j.task_id) throw new Error("task_id tidak ada");
  for (let i = 0; i < 9; i++) {
    const t = await fetch(`${SNAP}/task.php?token=${j.task_id}`, {
      headers: { "User-Agent": SNAP_UA, Referer: SNAP },
      signal: AbortSignal.timeout(8000),
    });
    const obj: any = await t.json();
    if (obj.status === -1) throw new Error("Render gagal");
    if (obj.progress === 100 && obj.download_url) return obj.download_url;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("Render timeout");
}

export async function getInstagramFromSnapsave(
  url: string,
): Promise<{ url: string | null; cover: string | null; caption: string; kind: "video" | "image"; count: number } | null> {
  try {
    const html = extractHtml(await getScript(url));
    if (!html) throw new Error("html kosong");
    const results = await parseSnap(html);
    if (!results.length) throw new Error("link kosong");
    const videos = results.filter((x) => x.type === "video");
    const images = results.filter((x) => x.type === "image");
    let vid = videos.find((x) => !/render\.php/.test(x.url))?.url ?? null;
    if (!vid) {
      const r = videos.find((x) => /render\.php/.test(x.url));
      if (r) {
        try {
          vid = await resolveRender(r.url);
        } catch {
          vid = null;
        }
      }
    }
    const cover = results.find((x) => x.thumbnail)?.thumbnail ?? images[0]?.url ?? null;
    return { url: vid, cover, caption: "", kind: !vid && images.length ? "image" : "video", count: images.length };
  } catch {
    return null;
  }
}
