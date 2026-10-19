import { settings } from "../config/settings.server";
import { runBintang } from "./fallback.server";
import {
  type Found,
  finishFound,
  getComments,
  getProfile,
  getReplies,
  makeAdder,
  scoreReplyParent,
} from "./finder.server";
import { DESKTOP_UA, fetchText, mapLimit } from "./http.server";
import { extractLinks, isAm, isFile } from "./links.server";
import { mediaLink } from "./sign.server";
import { ensureGoServiceRunning } from "./tiktok-page.server";
import { fromTikwm, isSignedWebappUrl, videoFields } from "./video-src.server";
import type {
  DiscoveredPreset,
  KeywordPresetSearchResult,
  KeywordPresetVideoGroup,
  Preset,
  PresetOriginVideo,
} from "./types";

const GENERIC_PRESET_STOP_WORDS = new Set([
  "preset",
  "pereset",
  "presets",
  "prst",
  "am",
  "alight",
  "motion",
  "alightmotion",
  "presetalightmotion",
  "preset5mb",
  "presetxml",
  "5mb",
  "xml",
  "dibawah",
  "di",
  "bawah",
  "link",
  "drive",
  "tiktok",
  "vt",
  "video",
  "cari",
  "buat",
  "bikin",
  "terbaru",
  "viral",
  "fyp",
]);

const TOPIC_SYNONYMS: Record<string, string[]> = {
  gfx: ["gfx", "gfxdesign", "presetgfx", "gfxpreset", "designgfx", "gfxanime", "gfxtutorial"],
  "3d": ["3d", "preset3d", "3dpreset", "3dtransition", "3dtransisi", "3dcamera", "3dshape", "3dedit"],
  transisi: ["transisi", "transition", "transitions"],
  transition: ["transition", "transisi", "transitions"],
  foto: ["foto", "photo", "editfoto", "fotopreset", "presetfoto"],
  photo: ["photo", "foto", "editfoto", "photopreset"],
  jj: ["jj", "jedag", "jedug", "jedagjedug", "jjslowmo"],
  jedag: ["jedag", "jedug", "jj", "jedagjedug"],
  jedug: ["jedug", "jedag", "jj", "jedagjedug"],
  slowmo: ["slowmo", "slow", "jjslowmo"],
  velocity: ["velocity", "velo", "presetvelocity"],
  elitis: ["elitis", "presetelitis", "elitispreset"],
  aesthetic: ["aesthetic", "estetik", "aesthetics"],
};

function stripUrlsFromText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(
      /(?:www\.)?(?:alight\.(?:link|to)|alightcreative\.com|drive\.google\.com|mediafire\.com|sfile\.mobi|vt\.tiktok\.com|tiktok\.com)\/\S+/gi,
      " ",
    );
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractCoreTokens(rawQuery: string): string[] {
  const words = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const core: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (w.length < 2 || GENERIC_PRESET_STOP_WORDS.has(w)) continue;
    if (!seen.has(w)) {
      seen.add(w);
      core.push(w);
    }
  }
  return core;
}

function tokenMatchesText(haystackLower: string, token: string): boolean {
  const cleanHaystack = stripUrlsFromText(haystackLower);
  const variants = TOPIC_SYNONYMS[token] ?? [token];
  return variants.some((v) => {
    const esc = escapeRegExp(v);
    const re = new RegExp(
      `(?:^|[^a-z0-9])(?:preset|pereset|prst|am|edit|transisi|transition|jj)?${esc}(?:preset|pereset|prst|am|edit|design|transisi|transition|anime|tutorial|camera|shape|foto|photo|slowmo|velo|tiktok)?(?=$|[^a-z0-9])`,
      "i",
    );
    return re.test(cleanHaystack);
  });
}

function userExplicitlyWantsJj(coreTokens: string[], rawQuery: string): boolean {
  const q = rawQuery.toLowerCase();
  if (/\b(jj|jedag|jedug|jedagjedug)\b/.test(q)) return true;
  return coreTokens.some((t) => t === "jj" || t === "jedag" || t === "jedug");
}

function evaluateCandidateTopic(
  vt: RawCandidateVT,
  coreTokens: string[],
  rawQuery: string,
  presets: Preset[] = [],
): { matchedCount: number; ratio: number; isOffTopicJj: boolean } {
  if (coreTokens.length === 0) {
    return { matchedCount: 1, ratio: 1, isOffTopicJj: false };
  }

  const presetTitles = presets
    .map((p) => p.title ?? "")
    .filter((t) => !/^proyek baru\s*\d*$/i.test(t.trim()))
    .join(" ");

  // Only fall back to DuckDuckGo snippet if the actual TikTok video description wasn't extracted,
  // because search engine snippets can include unrelated "Related Searches" from the TikTok page footer.
  const hasRealDescription = vt.description.trim().length > 0;
  const fullText = stripUrlsFromText(
    [
      vt.description,
      hasRealDescription ? "" : (vt.snippet ?? ""),
      vt.author.username,
      vt.author.nickname,
      vt.author.signature ?? "",
      presetTitles,
    ]
      .join(" ")
      .toLowerCase(),
  );

  let matchedCount = 0;
  for (const token of coreTokens) {
    if (tokenMatchesText(fullText, token)) {
      matchedCount += 1;
    }
  }

  const ratio = matchedCount / coreTokens.length;
  const wantsJj = userExplicitlyWantsJj(coreTokens, rawQuery);
  const looksLikePureJjOrMeme =
    !wantsJj &&
    matchedCount === 0 &&
    /\b(jj|jedag\s*jedug|jedagjedug|jjmeme|memefb|memestiktok|telolelolet)\b/i.test(fullText);

  return {
    matchedCount,
    ratio,
    isOffTopicJj: looksLikePureJjOrMeme,
  };
}

type RawCandidateVT = {
  id: string;
  url: string;
  kind: "video" | "photo";
  description: string;
  snippet?: string;
  cover: string | null;
  playUrl: string | null;
  images: string[];
  duration: number | null;
  createdAt: number | null;
  region: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  music: { title: string; author: string } | null;
  author: {
    username: string;
    nickname: string;
    avatar: string | null;
    followers: number | null;
    signature?: string;
    bioLink?: string;
  };
};

type QueryHistory = {
  counter: number;
  recentVideoIds: string[];
  recentPresetUrls: string[];
  updatedAt: number;
};

const queryHistoryMap = new Map<string, QueryHistory>();

function getQueryHistory(normalizedQuery: string): QueryHistory {
  const now = Date.now();
  const existing = queryHistoryMap.get(normalizedQuery);
  if (existing && now - existing.updatedAt < 30 * 60_000) {
    return existing;
  }
  const fresh: QueryHistory = {
    counter: 0,
    recentVideoIds: [],
    recentPresetUrls: [],
    updatedAt: now,
  };
  queryHistoryMap.set(normalizedQuery, fresh);
  if (queryHistoryMap.size > 150) {
    const oldestKey = queryHistoryMap.keys().next().value;
    if (oldestKey) queryHistoryMap.delete(oldestKey);
  }
  return fresh;
}

function recordQueryHistory(normalizedQuery: string, videoIds: string[], presetUrls: string[]) {
  const hist = getQueryHistory(normalizedQuery);
  hist.counter += 1;
  hist.updatedAt = Date.now();
  hist.recentVideoIds = [...new Set([...videoIds, ...hist.recentVideoIds])].slice(0, 45);
  hist.recentPresetUrls = [...new Set([...presetUrls, ...hist.recentPresetUrls])].slice(0, 60);
}

function buildSearchQueries(rawQuery: string, variationSeed: number): Array<{ keyword: string; cursor: number }> {
  const clean = rawQuery.trim().replace(/\s+/g, " ");
  const coreTokens = extractCoreTokens(clean);

  const pool: Array<{ keyword: string; cursor: number }> = [];
  const addPlan = (keyword: string, cursor = 0) => {
    if (!pool.some((p) => p.keyword.toLowerCase() === keyword.toLowerCase())) {
      pool.push({ keyword, cursor });
    }
  };

  if (coreTokens.length > 0) {
    const mandatoryTopic = coreTokens.map((t) => `+${t}`).join(" ");
    const compactTopic = coreTokens.join("");

    if (coreTokens.includes("gfx")) {
      addPlan(`tiktok.com #presetgfx`, 0);
      addPlan(`tiktok.com #gfxpreset`, 0);
      addPlan(`tiktok.com +gfx preset alight motion`, 0);
      addPlan(`tiktok.com #gfxdesign preset`, 0);
      addPlan(`tiktok.com +gfx +preset 5mb`, 10);
      addPlan(`tiktok.com +gfx +preset xml`, 10);
    } else if (coreTokens.includes("3d")) {
      addPlan(`tiktok.com #preset3d`, 0);
      addPlan(`tiktok.com #3dpreset`, 0);
      addPlan(`tiktok.com +3d preset alight motion`, 0);
      addPlan(`tiktok.com #3dtransition preset`, 0);
      addPlan(`tiktok.com +3d +preset 5mb`, 10);
      addPlan(`tiktok.com +3d +preset xml`, 10);
    } else {
      addPlan(`tiktok.com #preset${compactTopic}`, 0);
      addPlan(`tiktok.com ${mandatoryTopic} preset alight motion`, 0);
      addPlan(`tiktok.com #${compactTopic}preset`, 0);
      addPlan(`tiktok.com ${mandatoryTopic} +preset 5mb`, 10);
      addPlan(`tiktok.com ${mandatoryTopic} +preset xml`, 10);
    }
  } else {
    const hasPresetWord = /\b(preset|am|alight\s*motion|5mb|xml)\b/i.test(clean);
    const base = hasPresetWord ? clean : `preset ${clean}`;
    addPlan(`tiktok.com ${base} #presetalightmotion`, 0);
    addPlan(`tiktok.com #presetalightmotion #preset5mb`, 0);
    addPlan(`tiktok.com #presetalightmotion #presetxml`, 10);
  }

  const offset = variationSeed % pool.length;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}

function scoreCandidate(
  vt: RawCandidateVT,
  coreTokens: string[],
  rawQuery: string,
  recentlyUsedVideos: Set<string>,
): number {
  const text = `${vt.description} ${vt.snippet ?? ""} ${vt.author.signature ?? ""} ${vt.author.bioLink ?? ""}`.toLowerCase();
  const topicEval = evaluateCandidateTopic(vt, coreTokens, rawQuery);

  let score = 0;

  // Topic relevance is the #1 priority so searches for "gfx" or "3D" never rank generic Jedag Jedug higher
  if (coreTokens.length > 0) {
    if (topicEval.matchedCount === coreTokens.length) {
      score += 140;
    } else if (topicEval.matchedCount > 0) {
      score += 85 * topicEval.ratio;
    } else {
      score -= 180;
    }
    if (topicEval.isOffTopicJj) {
      score -= 300;
    }
  }

  if (/alight\.link|alightcreative\.com|drive\.google\.com|mediafire\.com|sfile\.mobi|linktr\.ee|lynk\.id|heylink\.me/i.test(text)) {
    score += 65;
  }
  if (/\b(5mb|xml|preset|pereset|am|link|bio|komen|komentar|pin)\b/i.test(text)) {
    score += 28;
  }
  if ((vt.comments ?? 0) >= 3) {
    score += 14;
  }
  if (recentlyUsedVideos.has(vt.id)) {
    score -= 40;
  }
  score += Math.random() * 10;
  return score;
}

const proxiedUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? mediaLink(u) : u ?? null);

async function searchViaGoService(keyword: string, count: number): Promise<RawCandidateVT[]> {
  const { goServiceUrl, goServiceSecret, goTimeoutMs } = settings.downloader;
  if (!goServiceUrl) return [];

  const isUp = await ensureGoServiceRunning();
  if (!isUp) return [];

  try {
    const res = await fetch(`${goServiceUrl}/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(goServiceSecret ? { "x-api-secret": goServiceSecret } : {}),
      },
      body: JSON.stringify({ keyword, count }),
      signal: AbortSignal.timeout(goTimeoutMs),
    });
    if (!res.ok) return [];
    const j: any = await res.json();
    const videos: any[] = j?.data?.videos ?? [];
    return videos
      .map((v): RawCandidateVT | null => {
        const id = String(v.id ?? "").trim();
        const username = String(v.author?.unique_id ?? v.author?.username ?? "").trim();
        if (!id) return null;
        const images = Array.isArray(v.images) ? v.images.filter((x: unknown): x is string => typeof x === "string") : [];
        const kind: "video" | "photo" = v.type === "photo" || images.length > 0 ? "photo" : "video";
        const url =
          v.canonical_url ||
          v.canonicalUrl ||
          (username ? `https://www.tiktok.com/@${username}/${kind}/${id}` : `https://www.tiktok.com/@user/video/${id}`);

        const playUrl =
          typeof v.video === "string"
            ? v.video
            : v.video?.no_watermark_url ||
              v.video?.watermark_url ||
              v.video?.adaptive_bitrates?.[0]?.url ||
              null;

        const duration =
          typeof v.video?.duration_seconds === "number"
            ? v.video.duration_seconds
            : typeof v.duration === "number"
              ? v.duration
              : parseInt(String(v.duration ?? "0"), 10) || null;

        const createdAt =
          typeof v.created_at === "number" && v.created_at > 0
            ? v.created_at
            : typeof v.createTime === "number" && v.createTime > 0
              ? v.createTime
              : null;

        const followers =
          typeof v.author?.stats?.follower_count === "number"
            ? v.author.stats.follower_count
            : typeof v.author?.followers === "number"
              ? v.author.followers
              : null;

        return {
          id,
          url,
          kind,
          description: String(v.description ?? v.title ?? ""),
          snippet: typeof v.snippet === "string" ? v.snippet : undefined,
          cover: v.cover || v.dynamic_cover || images[0] || null,
          playUrl,
          images,
          duration,
          createdAt,
          region: typeof v.region === "string" && v.region ? v.region : null,
          views: typeof v.stats?.plays === "number" ? v.stats.plays : typeof v.stats?.views === "number" ? v.stats.views : null,
          likes: typeof v.stats?.likes === "number" ? v.stats.likes : typeof v.stats?.like === "number" ? v.stats.like : null,
          comments:
            typeof v.stats?.comments === "number" ? v.stats.comments : typeof v.stats?.comment === "number" ? v.stats.comment : null,
          shares:
            typeof v.stats?.shares === "number" ? v.stats.shares : typeof v.stats?.share === "number" ? v.stats.share : null,
          music: v.music?.title
            ? {
                title: String(v.music.title),
                author: String(v.music.author ?? ""),
              }
            : null,
          author: {
            username: username || "tiktoker",
            nickname: String(v.author?.nickname ?? username),
            avatar: v.author?.avatar || v.author?.avatar_larger || null,
            followers,
            signature: typeof v.author?.signature === "string" ? v.author.signature : undefined,
            bioLink: typeof v.author?.bio_link === "string" ? v.author.bio_link : undefined,
          },
        };
      })
      .filter((x): x is RawCandidateVT => x !== null);
  } catch {
    return [];
  }
}

async function searchViaWebIndexFallback(keyword: string, count: number): Promise<RawCandidateVT[]> {
  try {
    const cleanQ = keyword.toLowerCase().startsWith("tiktok.com ") ? keyword : `tiktok.com ${keyword}`;
    const q = encodeURIComponent(cleanQ);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status !== 200) return [];
    const rawHtml = await res.text();
    let decoded = rawHtml;
    try {
      decoded = decodeURIComponent(rawHtml);
    } catch {
      decoded = rawHtml;
    }

    const matches = [
      ...decoded.matchAll(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/(video|photo)\/(\d{15,22})/gi),
    ];

    const unique: Array<{ username: string; kind: "video" | "photo"; id: string; url: string }> = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const username = m[1]!;
      const kind = (m[2]!.toLowerCase() === "photo" ? "photo" : "video") as "video" | "photo";
      const id = m[3]!;
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push({
        username,
        kind,
        id,
        url: `https://www.tiktok.com/@${username}/${kind}/${id}`,
      });
      if (unique.length >= count) break;
    }

    const enriched = await mapLimit(unique, 5, async (item): Promise<RawCandidateVT> => {
      try {
        const { body } = await fetchText(item.url, { ua: DESKTOP_UA, timeout: 10_000 });
        const m = body.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
        if (m) {
          const scope = JSON.parse(m[1]!)?.__DEFAULT_SCOPE__;
          const struct =
            scope?.["webapp.video-detail"]?.itemInfo?.itemStruct ??
            scope?.["webapp.reflow.video.detail"]?.itemInfo?.itemStruct;
          if (struct) {
            const images = Array.isArray(struct.imagePost?.images)
              ? (struct.imagePost.images as any[])
                  .map((img) => img?.imageURL?.urlList?.[0] ?? img?.displayImage?.urlList?.[0])
                  .filter(Boolean)
              : [];
            return {
              id: String(struct.id || item.id),
              url: item.url,
              kind: images.length > 0 ? "photo" : item.kind,
              description: String(struct.desc ?? ""),
              cover: struct.video?.cover ?? struct.video?.originCover ?? images[0] ?? null,
              playUrl: struct.video?.playAddr ?? struct.video?.downloadAddr ?? null,
              images,
              duration: Number(struct.video?.duration) || null,
              createdAt: Number(struct.createTime) || null,
              region: struct.locationCreated || null,
              views: Number(struct.stats?.playCount) || null,
              likes: Number(struct.stats?.diggCount) || null,
              comments: Number(struct.stats?.commentCount) || null,
              shares: Number(struct.stats?.shareCount) || null,
              music: struct.music?.title
                ? {
                    title: String(struct.music.title),
                    author: String(struct.music.authorName ?? ""),
                  }
                : null,
              author: {
                username: String(struct.author?.uniqueId || item.username),
                nickname: String(struct.author?.nickname || item.username),
                avatar: struct.author?.avatarThumb ?? null,
                followers: Number(struct.authorStats?.followerCount) || null,
                signature: struct.author?.signature ?? undefined,
                bioLink: struct.author?.bioLink?.link ?? undefined,
              },
            };
          }
        }
      } catch {
        // Return basic VT descriptor if SSR timed out
      }
      return {
        id: item.id,
        url: item.url,
        kind: item.kind,
        description: "",
        cover: null,
        playUrl: null,
        images: [],
        duration: null,
        createdAt: null,
        region: null,
        views: null,
        likes: null,
        comments: null,
        shares: null,
        music: null,
        author: {
          username: item.username,
          nickname: item.username,
          avatar: null,
          followers: null,
        },
      };
    });

    return enriched;
  } catch {
    return [];
  }
}

async function fetchCandidateBatch(keyword: string): Promise<RawCandidateVT[]> {
  // Primary Engine: Golang TikTokSearchEngine (services/downloader-go)
  const fromGo = await searchViaGoService(keyword, 18);
  if (fromGo.length > 0) return fromGo;

  // Serverless Fallback if Go binary cannot be spawned
  return searchViaWebIndexFallback(keyword, 18);
}

const profileCache = new Map<string, { at: number; data: Awaited<ReturnType<typeof getProfile>> }>();

async function getCachedProfile(username: string) {
  if (!username || username === "user" || username === "creator" || username === "tiktoker") {
    return { bio: "", avatar: null, bioLink: null, links: [] as string[] };
  }
  const hit = profileCache.get(username);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;
  const data = await getProfile(username);
  profileCache.set(username, { at: Date.now(), data });
  if (profileCache.size > 300) {
    const first = profileCache.keys().next().value;
    if (first) profileCache.delete(first);
  }
  return data;
}

async function extractPresetsFromCandidate(
  vt: RawCandidateVT,
): Promise<{ origin: PresetOriginVideo; presets: Preset[]; scannedComments: number }> {
  const found: Found[] = [];
  const seen = new Set<string>();
  const add = makeAdder(found, seen);

  extractLinks(vt.description).forEach((u) => add(u, "description"));
  if (vt.snippet) {
    extractLinks(vt.snippet).forEach((u) => add(u, "description"));
  }
  if (vt.author.signature) {
    extractLinks(vt.author.signature).forEach((u) => add(u, "bio"));
  }
  if (vt.author.bioLink) {
    add(vt.author.bioLink, "bioLink");
  }

  const needProfile = vt.author.signature === undefined && !vt.author.bioLink;
  const [profile, comments] = await Promise.all([
    needProfile
      ? getCachedProfile(vt.author.username)
      : Promise.resolve({ bio: "", avatar: null, bioLink: null, links: [] as string[] }),
    getComments(vt.id, vt.author.username, 2),
  ]);

  if (profile.bio) {
    extractLinks(profile.bio).forEach((u) => add(u, "bio"));
  }
  profile.links.forEach((u) => add(u, "bioLink"));

  for (const c of comments) {
    extractLinks(c.text).forEach((u) =>
      add(u, "comment", {
        pinned: c.pinned,
        byAuthor: c.byAuthor,
        digg: c.digg,
        detail: `@${c.user}`,
      }),
    );
  }

  // Also stitch split /u/<uid> + /p/<pid> or Drive links posted across multiple comments in the same thread
  if (comments.length > 1) {
    const combinedCommentText = comments.map((c) => c.text).join("\n");
    extractLinks(combinedCommentText).forEach((u) =>
      add(u, "comment", {
        byAuthor: comments.some((c) => c.byAuthor),
        pinned: comments.some((c) => c.pinned),
        digg: Math.max(0, ...comments.map((c) => c.digg)),
        detail: `@${vt.author.username}`,
      }),
    );
  }

  // Scan comment replies if either 5MB or XML is still missing so we capture BOTH 5MB and XML presets
  const hasBoth5mbAndXml = () => found.some((x) => isAm(x.url)) && found.some((x) => isFile(x.url));
  if (!hasBoth5mbAndXml()) {
    const parents = comments
      .filter((c) => c.cid && c.replyCount > 0)
      .sort((a, b) => scoreReplyParent(b) - scoreReplyParent(a))
      .slice(0, 4);

    if (parents.length > 0) {
      const replyBatches = await mapLimit(parents, 4, (p) => getReplies(vt.id, p.cid));
      const allReplies = replyBatches.flat();
      for (const reply of allReplies) {
        extractLinks(reply.text).forEach((u) =>
          add(u, "comment", {
            byAuthor: !!vt.author.username && reply.user === vt.author.username,
            digg: reply.digg,
            detail: `@${reply.user} (balasan)`,
          }),
        );
      }
      if (allReplies.length > 0) {
        const combinedThread = [...comments.map((c) => c.text), ...allReplies.map((r) => r.text)].join("\n");
        extractLinks(combinedThread).forEach((u) =>
          add(u, "comment", {
            byAuthor: true,
            digg: 10,
            detail: `@${vt.author.username} (balasan)`,
          }),
        );
      }
    }
  }

  const proxiedImages = vt.images.map((img) => mediaLink(img));
  const proxiedCover = proxiedUrl(vt.cover) ?? proxiedImages[0] ?? null;

  const presets = await finishFound(found, seen, proxiedCover);

  let effectivePlayUrl = vt.playUrl;
  if (presets.length > 0 && vt.kind === "video" && (!effectivePlayUrl || isSignedWebappUrl(effectivePlayUrl))) {
    const tikwmStream = await fromTikwm(vt.author.username, vt.id);
    if (tikwmStream) effectivePlayUrl = tikwmStream;
  }

  const vFields = videoFields(effectivePlayUrl ? { url: effectivePlayUrl, from: "go" } : null);

  const origin: PresetOriginVideo = {
    id: vt.id,
    url: vt.url,
    kind: vt.kind,
    description: vt.description,
    cover: proxiedCover,
    src: vFields.src,
    proxy: vFields.proxy,
    images: proxiedImages,
    duration: vt.duration,
    createdAt: vt.createdAt,
    region: vt.region,
    views: vt.views,
    likes: vt.likes,
    comments: vt.comments ?? comments.length,
    shares: vt.shares,
    music: vt.music,
    author: {
      username: vt.author.username,
      nickname: vt.author.nickname,
      avatar: proxiedUrl(vt.author.avatar ?? profile.avatar),
      followers: vt.author.followers,
    },
  };

  return {
    origin,
    presets,
    scannedComments: comments.length,
  };
}

export async function searchPresetsByKeyword(
  rawQuery: string,
  options?: { variation?: number; minPresets?: number },
): Promise<KeywordPresetSearchResult> {
  const query = rawQuery.trim();
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ");
  const coreTokens = extractCoreTokens(query);
  const history = getQueryHistory(normalizedQuery);

  const variation =
    typeof options?.variation === "number" && Number.isFinite(options.variation) && options.variation >= 0
      ? options.variation
      : history.counter;

  const targetMin = Math.min(Math.max(options?.minPresets ?? 10, 10), 25);
  const searchPlans = buildSearchQueries(query, variation);

  const recentlyUsedVideos = new Set(history.recentVideoIds);
  const recentlyUsedPresets = new Set(history.recentPresetUrls);

  const candidateMap = new Map<string, RawCandidateVT>();
  const effectiveQueries: string[] = [];

  for (let i = 0; i < Math.min(2, searchPlans.length); i++) {
    const plan = searchPlans[i]!;
    effectiveQueries.push(plan.keyword);
    const batch = await fetchCandidateBatch(plan.keyword);
    for (const vt of batch) {
      const topicEval = evaluateCandidateTopic(vt, coreTokens, query);
      // Drop pure Jedag Jedug / meme videos when the user searched for a different topic like GFX or 3D
      if (topicEval.isOffTopicJj) continue;
      if (!candidateMap.has(vt.id)) candidateMap.set(vt.id, vt);
    }
    const matchingCount = [...candidateMap.values()].filter(
      (vt) => evaluateCandidateTopic(vt, coreTokens, query).matchedCount > 0,
    ).length;
    if (matchingCount >= 14) break;
  }

  const candidates = [...candidateMap.values()].sort(
    (a, b) =>
      scoreCandidate(b, coreTokens, query, recentlyUsedVideos) -
      scoreCandidate(a, coreTokens, query, recentlyUsedVideos),
  );

  const discoveredPresets: Array<DiscoveredPreset & { _topicScore: number }> = [];
  const videoGroups: Array<KeywordPresetVideoGroup & { _topicScore: number }> = [];
  const seenPresetUrls = new Set<string>();
  const scannedVideoIds = new Set<string>();

  const deadline = Date.now() + 45_000;
  let cursorIdx = 0;
  let extraPlanIdx = 2;

  while (discoveredPresets.length < targetMin && Date.now() < deadline) {
    const remainingCandidates = candidates.slice(cursorIdx, cursorIdx + 7);
    if (remainingCandidates.length === 0) {
      let addedNew = false;
      while (extraPlanIdx < searchPlans.length && Date.now() < deadline) {
        const nextPlan = searchPlans[extraPlanIdx++]!;
        effectiveQueries.push(nextPlan.keyword);
        const more = await fetchCandidateBatch(nextPlan.keyword);
        const freshCandidates = more.filter((vt) => {
          if (candidateMap.has(vt.id)) return false;
          const topicEval = evaluateCandidateTopic(vt, coreTokens, query);
          return !topicEval.isOffTopicJj;
        });
        for (const vt of freshCandidates) {
          candidateMap.set(vt.id, vt);
        }
        if (freshCandidates.length > 0) {
          candidates.push(
            ...freshCandidates.sort(
              (a, b) =>
                scoreCandidate(b, coreTokens, query, recentlyUsedVideos) -
                scoreCandidate(a, coreTokens, query, recentlyUsedVideos),
            ),
          );
          addedNew = true;
          break;
        }
      }
      if (addedNew) continue;
      break;
    }

    cursorIdx += remainingCandidates.length;
    for (const vt of remainingCandidates) {
      scannedVideoIds.add(vt.id);
    }

    const batchResults = await mapLimit(remainingCandidates, 6, async (vt) => ({
      rawVt: vt,
      ...(await extractPresetsFromCandidate(vt)),
    }));

    for (const item of batchResults) {
      if (item.presets.length === 0) continue;

      const postEval = evaluateCandidateTopic(item.rawVt, coreTokens, query, item.presets);
      if (postEval.isOffTopicJj) continue;

      // If user searched a specific topic (e.g. "gfx", "3d"), require at least 1 core token match
      // in either the VT description/hashtags/author/snippet or the extracted preset title!
      if (coreTokens.length > 0 && postEval.matchedCount === 0) {
        continue;
      }

      const freshForThisVideo: Preset[] = [];
      for (const p of item.presets) {
        const normUrl = p.url.replace(/\?source=link$/i, "");
        if (seenPresetUrls.has(normUrl)) continue;
        seenPresetUrls.add(normUrl);
        freshForThisVideo.push(p);
        discoveredPresets.push({
          ...p,
          id: `${item.origin.id}-${discoveredPresets.length + 1}`,
          vt: item.origin,
          _topicScore: postEval.matchedCount,
        });
      }

      if (freshForThisVideo.length > 0) {
        videoGroups.push({
          vt: item.origin,
          presets: freshForThisVideo,
          scannedComments: item.scannedComments,
          _topicScore: postEval.matchedCount,
        });
      }
    }

    if (scannedVideoIds.size >= 24) break;
  }

  discoveredPresets.sort((a, b) => {
    if (b._topicScore !== a._topicScore) return b._topicScore - a._topicScore;
    const aRecent = recentlyUsedPresets.has(a.url) ? 1 : 0;
    const bRecent = recentlyUsedPresets.has(b.url) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return Number(b.byAuthor) - Number(a.byAuthor) || Number(b.pinned) - Number(a.pinned);
  });

  videoGroups.sort((a, b) => b._topicScore - a._topicScore);

  const cleanPresets: DiscoveredPreset[] = discoveredPresets.map(({ _topicScore, ...rest }, idx) => ({
    ...rest,
    id: `${rest.vt.id}-${idx + 1}`,
  }));

  const cleanVideos: KeywordPresetVideoGroup[] = videoGroups.map(({ _topicScore, ...rest }) => rest);

  recordQueryHistory(
    normalizedQuery,
    cleanVideos.map((g) => g.vt.id),
    cleanPresets.slice(0, 14).map((p) => p.url),
  );

  return {
    query,
    effectiveQueries: [...new Set(effectiveQueries)],
    variation,
    targetMin,
    totalPresets: cleanPresets.length,
    totalVideosScanned: scannedVideoIds.size,
    totalCandidatesFound: candidateMap.size,
    presets: cleanPresets,
    videos: cleanVideos,
    timestamp: Date.now(),
  };
}
