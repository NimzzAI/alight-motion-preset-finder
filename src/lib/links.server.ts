import { hostIn } from "./http.server";

const AM_HOSTS = ["alight.link", "alight.to", "alight.page.link", "alightcreative.page.link", "alightmotion.page.link"];
const FILE_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "mediafire.com",
  "dropbox.com",
  "mega.nz",
  "sfile.mobi",
  "github.com",
  "gitlab.com",
];

export const TREE_HOSTS = [
  "lynk.id",
  "linktr.ee",
  "bio.link",
  "heylink.me",
  "stan.store",
  "s.id",
  "cutt.ly",
  "bit.ly",
  "tinyurl.com",
  "taplink.cc",
  "soc12.my.id",
];

export const NOISE_HOSTS = [
  "tiktok.com",
  "tiktokcdn.com",
  "ttwstatic.com",
  "tiktokv.com",
  "snssdk.com",
  "bytedance.com",
  "byteimg.com",
  "googleapis.com",
  "gstatic.com",
  "apple.com",
  "w3.org",
  "schema.org",
  "cloudflare.com",
  "amazonaws.com",
  "instagram.com",
  "facebook.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "t.me",
  "wa.me",
  "whatsapp.com",
];

export const AM_SHARE_RE = /alightcreative\.com\/am\/share\//i;
const URL_RE = /https?:\/\/[^\s"'<>()[\]{}\\]+/gi;
const BARE_AM_RE =
  /(?:^|[\s({[>])((?:www\.)?(?:alight\.(?:link|to)\/[\w-]+|alightcreative\.com\/am\/share\/[^\s"'<>]+))/gi;

export const isAm = (url: string) => AM_SHARE_RE.test(url) || hostIn(url, AM_HOSTS);

export const isFile = (url: string) => hostIn(url, FILE_HOSTS) || /\.(xml|zip|ampreset|json)(\?|$)/i.test(url);

export const isNoise = (url: string) =>
  hostIn(url, NOISE_HOSTS) || /\.(png|jpe?g|webp|gif|svg|ico|woff2?|mp4|mp3|css|js)(\?|$)/i.test(url);

export const clean = (url: string) => url.replace(/[.,;:!?)'"»”]+$/, "").replace(/&amp;/g, "&");

export function extractLinks(text: string | null | undefined): string[] {
  const source = String(text ?? "");
  const out = new Set<string>();
  for (const m of source.matchAll(URL_RE)) {
    const url = clean(m[0]);
    if (url) out.add(url);
  }
  for (const m of source.matchAll(BARE_AM_RE)) out.add(clean("https://" + m[1]));
  return [...out];
}
