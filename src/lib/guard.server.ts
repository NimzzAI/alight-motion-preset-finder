import { settings } from "../config/settings.server";
import { json } from "./respond.server";

const BAD_UA =
  /(httrack|wget|curl|python|requests|scrapy|aiohttp|go-http|libwww|okhttp|axios|node-fetch|undici|saveweb|webcopier|teleport|offline|downloader|sitesucker|webzip|headless|phantom|puppeteer|selenium)/i;

const hostOf = (value: string | null) => {
  try {
    return value ? new URL(value).host : "";
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
  if (site) {
    if (site === "same-origin" || site === "same-site" || site === "none") return null;
    return json({ ok: false, error: "Akses ditolak." }, 403);
  }

  const self = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host;
  const from = hostOf(h.get("origin")) || hostOf(h.get("referer"));
  if (from && from === self) return null;

  return json({ ok: false, error: "Akses ditolak." }, 403);
}
