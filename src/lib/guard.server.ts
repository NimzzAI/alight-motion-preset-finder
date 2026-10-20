import { settings } from "../config/settings.server";
import { json } from "./respond.server";

const BAD_UA =
  /(httrack|wget|curl|python|requests|scrapy|aiohttp|libwww|okhttp|undici|saveweb|webcopier|teleport|offline|downloader|sitesucker|webzip|headless|phantom|puppeteer|selenium)/i;

const hostOf = (value: string | null) => {
  if (!value) return "";
  try {
    const raw = value.includes("://") ? new URL(value).host : value;
    return raw.split(",")[0]!.trim().toLowerCase().replace(/:\d+$/, "");
  } catch {
    return "";
  }
};

export function guard(request: Request): Response | null {
  const { enabled, botKey } = settings.guard;
  if (!enabled) return null;

  const h = request.headers;
  if (botKey && h.get("x-am-key") === botKey) return null;

  const ua = h.get("user-agent") ?? "";
  if (!ua || BAD_UA.test(ua)) return json({ ok: false, error: "Akses ditolak." }, 403);

  const site = h.get("sec-fetch-site");
  if (site === "same-origin" || site === "same-site" || site === "none") {
    return null;
  }

  const rawHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const self = hostOf(rawHost) || hostOf(request.url);
  const from = hostOf(h.get("origin")) || hostOf(h.get("referer"));

  if (!from || from === self) return null;
  if (self.endsWith(".vercel.app") && from.endsWith(".vercel.app")) return null;
  if (from.includes("localhost") || from.includes("127.0.0.1") || from.includes("run.app")) return null;

  return null;
}

