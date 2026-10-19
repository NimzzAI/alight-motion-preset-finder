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
  "catbox.moe",
  "files.catbox.moe",
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
  "saweria.co",
];

export const AM_SHARE_RE = /alightcreative\.com\/am\/share\/u\/[\w-]+\/p\/[\w-]+/i;
const INCOMPLETE_AM_USER_RE = /alightcreative\.com\/am\/share\/u\/([\w-]+)\/?$/i;
const SPLIT_PROJECT_PATH_RE = /(?:^|[\s:()-])\/?p\/([a-zA-Z0-9_-]{10,})/gi;
const INCOMPLETE_DRIVE_RE = /drive\.google\.com\/(?:file\/d|drive\/folders|folderview)\/?$/i;
const SPLIT_DRIVE_ID_WithSuffix_RE = /(?:^|[\s:()])\/?([a-zA-Z0-9_-]{25,45})(?:\/view\b|\?usp=drivesdk\b)/g;
const SPLIT_BARE_DRIVE_ID_RE = /(?:^|[\s:()])\/?([a-zA-Z0-9_-]{28,44})(?=$|[\s.,;!?])/g;

const URL_RE = /https?:\/\/[a-zA-Z0-9._~:/?#[\]@!$&'*+,;=%-]+/gi;
const BARE_AM_RE =
  /(?:^|[\s({[>-])((?:www\.)?(?:alight\.(?:link|to)\/[a-zA-Z0-9_-]+|alight\.page\.link\/[a-zA-Z0-9_-]+|alightcreative\.com\/am\/share\/[a-zA-Z0-9._~:/?#[\]@!$&'*+,;=%-]+))/gi;
const BARE_FILE_OR_TREE_RE =
  /(?:^|[\s({[>-])((?:www\.)?(?:drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/|folderview\?id=)[a-zA-Z0-9._~:/?#[\]@!$&'*+,;=%-]+|mediafire\.com\/(?:file|download)\/[a-zA-Z0-9._~:/?#[\]@!$&'*+,;=%-]+|sfile\.mobi\/[a-zA-Z0-9_-]+|dropbox\.com\/s(?:cl)?\/[a-zA-Z0-9._~:/?#[\]@!$&'*+,;=%-]+|mega\.nz\/(?:file|folder)\/[a-zA-Z0-9._~:/?#[\]@!$&'*+,;=%-]+|(?:linktr\.ee|lynk\.id|heylink\.me|bio\.link|s\.id|bit\.ly|cutt\.ly|tinyurl\.com)\/[a-zA-Z0-9._-]+))/gi;

export const isAm = (url: string) => {
  if (INCOMPLETE_AM_USER_RE.test(url)) return false;
  return AM_SHARE_RE.test(url) || hostIn(url, AM_HOSTS);
};

export const isFile = (url: string) => {
  if (INCOMPLETE_DRIVE_RE.test(url)) return false;
  return hostIn(url, FILE_HOSTS) || /\.(xml|zip|ampreset|json)(\?|$)/i.test(url);
};

export const isNoise = (url: string) =>
  hostIn(url, NOISE_HOSTS) || /\.(png|jpe?g|webp|gif|svg|ico|woff2?|mp4|mp3|css|js)(\?|$)/i.test(url);

export const clean = (url: string) =>
  url
    .replace(/-(?:xml|5mb)\b.*$/i, "")
    .replace(/[.,;:!?)'"»”-]+$/, "")
    .replace(/&amp;/g, "&");

export function extractLinks(text: string | null | undefined): string[] {
  const source = String(text ?? "");
  const out = new Set<string>();
  const halfUserIds: string[] = [];
  let hasHalfDrive = false;

  const processCandidate = (rawUrl: string) => {
    const url = clean(rawUrl);
    if (!url) return;
    const halfMatch = url.match(INCOMPLETE_AM_USER_RE);
    if (halfMatch?.[1]) {
      halfUserIds.push(halfMatch[1]);
      return;
    }
    if (INCOMPLETE_DRIVE_RE.test(url)) {
      hasHalfDrive = true;
      return;
    }
    out.add(url);
  };

  for (const m of source.matchAll(URL_RE)) {
    processCandidate(m[0]);
  }

  for (const m of source.matchAll(BARE_AM_RE)) {
    processCandidate("https://" + m[1]);
  }

  for (const m of source.matchAll(BARE_FILE_OR_TREE_RE)) {
    processCandidate("https://" + m[1]);
  }

  if (halfUserIds.length > 0) {
    const projectIds = [...source.matchAll(SPLIT_PROJECT_PATH_RE)].map((m) => clean(m[1] ?? "")).filter(Boolean);
    for (const uid of halfUserIds) {
      for (const pid of projectIds) {
        out.add(`https://alightcreative.com/am/share/u/${uid}/p/${pid}`);
      }
    }
  }

  if (hasHalfDrive) {
    for (const m of source.matchAll(SPLIT_DRIVE_ID_WithSuffix_RE)) {
      if (m[1]) {
        out.add(`https://drive.google.com/file/d/${m[1]}/view?usp=drivesdk`);
      }
    }
    for (const m of source.matchAll(SPLIT_BARE_DRIVE_ID_RE)) {
      const id = m[1];
      if (id && !halfUserIds.includes(id) && /\d/.test(id) && /[a-zA-Z]/.test(id)) {
        out.add(`https://drive.google.com/file/d/${id}/view?usp=drivesdk`);
      }
    }
  }

  return [...out];
}
