import type { Platform } from "./types";

const IG_RE = /^(?:https?:\/\/)?(?:[\w-]+\.)?(?:instagram\.com|instagr\.am)\/(?:[^/?#]+\/)?(?:(?:p|reels?|tv)|share(?:\/(?:p|reel))?)\/[\w-]+/i;
const TT_RE = /tiktok\.com\/|^\d{15,}$/i;
const YT_ID = /^[\w-]{11}$/;

export function ytId(input: string): string | null {
  const s = input.trim();
  if (YT_ID.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.split("/")[1] ?? "";
    return YT_ID.test(id) ? id : null;
  }
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = u.searchParams.get("v");
    if (v && YT_ID.test(v)) return v;
    return u.pathname.match(/^\/(?:shorts|live|embed|v|e)\/([\w-]{11})/)?.[1] ?? null;
  }
  return null;
}

export function detectPlatform(input: string): Platform | null {
  const s = input.trim();
  if (!s) return null;
  if (IG_RE.test(s)) return "instagram";
  if (TT_RE.test(s)) return "tiktok";
  if (/youtu|^[\w-]{11}$/i.test(s) && ytId(s)) return "youtube";
  return null;
}

export const isFinderInput = (value: string) => detectPlatform(value) !== null;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (h === "localhost" || /^[\d.]+$/.test(h) || h.includes(":") || /\.(local|internal|localhost)$/.test(h)) return false;
    return h.includes(".");
  } catch {
    return false;
  }
}
