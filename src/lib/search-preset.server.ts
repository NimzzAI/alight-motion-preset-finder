import { settings } from "../config/settings.server";
import { runBintang } from "./fallback.server";
import { type Found, finishFound, getComments, getProfile, getReplies, makeAdder } from "./finder.server";
import { DESKTOP_UA, mapLimit } from "./http.server";
import { extractLinks, isAm, isFile } from "./links.server";
import { mediaLink } from "./sign.server";
import { tikwmUrl, videoFields } from "./video-src.server";
import type {
  DiscoveredPreset,
  KeywordPresetSearchResult,
  KeywordPresetVideoGroup,
  Preset,
  PresetOriginVideo,
} from "./types";

const QUERY_MODIFIERS = [
  "alight motion 5mb",
  "preset am xml",
  "preset alight motion",
  "5mb dibawah",
  "preset am 5mb",
  "preset xml drive",
];

type RawCandidateVT = {
  id: string;
  url: string;
  kind: "video" | "photo";
  description: string;
  cover: string | null;
  playUrl: string | null;
  images: string[];
  duration: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  author: {
    username: string;
    nickname: string;
    avatar: string | null;
    signature?: string;
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
  const hasPresetWord = /\b(preset|am|alight\s*motion|5mb|xml)\b/i.test(clean);
  const base = hasPresetWord ? clean : `preset ${clean}`;

  const pool: Array<{ keyword: string; cursor: number }> = [
    { keyword: `${base} alight motion`, cursor: 0 },
    { keyword: `${clean} 5mb xml`, cursor: 0 },
    { keyword: `${base} 5mb`, cursor: 12 },
    { keyword: `${base} xml`, cursor: 0 },
    { keyword: base, cursor: 0 },
    { keyword: `${base} alight motion`, cursor: 15 },
    { keyword: `${clean} preset am`, cursor: 10 },
    { keyword: `${base} ${QUERY_MODIFIERS[variationSeed % QUERY_MODIFIERS.length]}`, cursor: 20 },
  ];

  const offset = variationSeed % pool.length;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}

function scoreCandidate(vt: RawCandidateVT, recentlyUsedVideos: Set<string>): number {
  const text = `${vt.description} ${vt.author.signature ?? ""}`.toLowerCase();
  let score = 0;

  if (/alight\.link|alightcreative\.com|drive\.google\.com|mediafire\.com|sfile\.mobi|linktr\.ee|lynk\.id|heylink\.me/i.test(text)) {
    score += 50;
  }
  if (/\b(5mb|xml|preset|am|link|bio|komen|komentar|pin)\b/i.test(text)) {
    score += 25;
  }
  if ((vt.comments ?? 0) >= 5) {
    score += 10;
  }
  if (recentlyUsedVideos.has(vt.id)) {
    score -= 40;
  }
  score += Math.random() * 14;
  return score;
}

async function searchViaGoService(keyword: string, count: number): Promise<RawCandidateVT[]> {
  const { goServiceUrl, goServiceSecret, goTimeoutMs } = settings.downloader;
  if (!goServiceUrl) return [];

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

        return {
          id,
          url,
          kind,
          description: String(v.description ?? v.title ?? ""),
          cover: v.cover || v.dynamic_cover || null,
          playUrl,
          images,
          duration,
          views: typeof v.stats?.plays === "number" ? v.stats.plays : typeof v.stats?.views === "number" ? v.stats.views : null,
          likes: typeof v.stats?.likes === "number" ? v.stats.likes : typeof v.stats?.like === "number" ? v.stats.like : null,
          comments:
            typeof v.stats?.comments === "number" ? v.stats.comments : typeof v.stats?.comment === "number" ? v.stats.comment : null,
          author: {
            username: username || "tiktoker",
            nickname: String(v.author?.nickname ?? username),
            avatar: v.author?.avatar || v.author?.avatar_larger || null,
            signature: typeof v.author?.signature === "string" ? v.author.signature : undefined,
          },
        };
      })
      .filter((x): x is RawCandidateVT => x !== null);
  } catch {
    return [];
  }
}

async function searchViaTikwm(keyword: string, count: number, cursor: number): Promise<RawCandidateVT[]> {
  try {
    const q = new URLSearchParams({
      keywords: keyword,
      count: String(count),
      cursor: String(cursor),
    });

    const res = await fetch(`https://www.tikwm.com/api/feed/search?${q.toString()}`, {
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(14_000),
    });
    if (!res.ok) return [];

    const j: any = await res.json();
    const videos: any[] = j?.data?.videos ?? [];
    if (!Array.isArray(videos)) return [];

    return videos
      .map((d): RawCandidateVT | null => {
        const id = String(d.video_id ?? d.aweme_id ?? d.id ?? "").trim();
        if (!id) return null;
        const username = String(d.author?.unique_id ?? "").trim();
        const rawImages = Array.isArray(d.images) ? d.images : [];
        const images = rawImages.map((u: string) => tikwmUrl(u)).filter((u): u is string => Boolean(u));
        const kind: "video" | "photo" = images.length > 0 ? "photo" : "video";
        const playUrl = tikwmUrl(d.play) ?? tikwmUrl(d.wmplay) ?? null;
        const cover = tikwmUrl(d.cover) ?? tikwmUrl(d.origin_cover) ?? null;
        const vtUrl = username
          ? `https://www.tiktok.com/@${username}/${kind === "photo" ? "photo" : "video"}/${id}`
          : `https://www.tiktok.com/@user/video/${id}`;

        return {
          id,
          url: vtUrl,
          kind,
          description: String(d.title ?? ""),
          cover,
          playUrl,
          images,
          duration: typeof d.duration === "number" && d.duration > 0 ? d.duration : null,
          views: typeof d.play_count === "number" ? d.play_count : null,
          likes: typeof d.digg_count === "number" ? d.digg_count : null,
          comments: typeof d.comment_count === "number" ? d.comment_count : null,
          author: {
            username: username || "creator",
            nickname: String(d.author?.nickname ?? username),
            avatar: tikwmUrl(d.author?.avatar) ?? null,
          },
        };
      })
      .filter((x): x is RawCandidateVT => x !== null);
  } catch {
    return [];
  }
}

async function fetchCandidateBatch(keyword: string, cursor: number): Promise<RawCandidateVT[]> {
  // Primary Engine: Golang TikTokSearchEngine (services/downloader-go)
  const fromGo = await searchViaGoService(keyword, 24);
  if (fromGo.length > 0) return fromGo;

  // Secondary Fallback if Golang service container is offline
  const fromTikwm = await searchViaTikwm(keyword, 28, cursor);
  const seen = new Set<string>();
  return fromTikwm.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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
  if (vt.author.signature) {
    extractLinks(vt.author.signature).forEach((u) => add(u, "bio"));
  }

  const [profile, comments] = await Promise.all([
    getCachedProfile(vt.author.username),
    getComments(vt.id, vt.author.username, 2),
  ]);

  extractLinks(profile.bio).forEach((u) => add(u, "bio"));
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

  const hasDirectAm = () => found.some((x) => isAm(x.url) || isFile(x.url));
  if (!hasDirectAm()) {
    const parents = comments
      .filter((c) => c.cid && c.replyCount > 0)
      .sort((a, b) => Number(b.byAuthor) - Number(a.byAuthor) || Number(b.pinned) - Number(a.pinned) || b.digg - a.digg)
      .slice(0, 4);

    if (parents.length > 0) {
      const replyBatches = await mapLimit(parents, 2, (p) => getReplies(vt.id, p.cid));
      for (const reply of replyBatches.flat()) {
        extractLinks(reply.text).forEach((u) =>
          add(u, "comment", {
            byAuthor: !!vt.author.username && reply.user === vt.author.username,
            digg: reply.digg,
            detail: `@${reply.user} (balasan)`,
          }),
        );
      }
    }
  }

  let presets = await finishFound(found, seen);

  if (presets.length === 0) {
    try {
      const fb = await runBintang(vt.url);
      if (fb.presets.length > 0) presets = fb.presets;
    } catch {
      // Ignore fallback error during batch scan
    }
  }

  const vFields = videoFields(vt.playUrl ? { url: vt.playUrl, from: "go" } : null);
  const proxiedImages = vt.images.map((img) => mediaLink(img));

  const origin: PresetOriginVideo = {
    id: vt.id,
    url: vt.url,
    kind: vt.kind,
    description: vt.description,
    cover: vt.cover,
    src: vFields.src,
    proxy: vFields.proxy,
    images: proxiedImages,
    duration: vt.duration,
    views: vt.views,
    likes: vt.likes,
    comments: vt.comments ?? comments.length,
    author: {
      username: vt.author.username,
      nickname: vt.author.nickname,
      avatar: vt.author.avatar ?? profile.avatar,
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

  const initialPlans = searchPlans.slice(0, 2);
  const initialBatches = await Promise.all(
    initialPlans.map(async (plan) => {
      effectiveQueries.push(plan.keyword);
      return fetchCandidateBatch(plan.keyword, plan.cursor);
    }),
  );

  for (const batch of initialBatches) {
    for (const vt of batch) {
      if (!candidateMap.has(vt.id)) candidateMap.set(vt.id, vt);
    }
  }

  if (candidateMap.size < 14 && searchPlans.length > 2) {
    const extraPlan = searchPlans[2]!;
    effectiveQueries.push(extraPlan.keyword);
    const extraBatch = await fetchCandidateBatch(extraPlan.keyword, extraPlan.cursor);
    for (const vt of extraBatch) {
      if (!candidateMap.has(vt.id)) candidateMap.set(vt.id, vt);
    }
  }

  const candidates = [...candidateMap.values()].sort(
    (a, b) => scoreCandidate(b, recentlyUsedVideos) - scoreCandidate(a, recentlyUsedVideos),
  );

  const discoveredPresets: DiscoveredPreset[] = [];
  const videoGroups: KeywordPresetVideoGroup[] = [];
  const seenPresetUrls = new Set<string>();
  const scannedVideoIds = new Set<string>();

  const deadline = Date.now() + 45_000;
  let cursorIdx = 0;
  let extraPlanIdx = 3;

  while (discoveredPresets.length < targetMin && Date.now() < deadline) {
    const remainingCandidates = candidates.slice(cursorIdx, cursorIdx + 6);
    if (remainingCandidates.length === 0) {
      if (extraPlanIdx < searchPlans.length) {
        const nextPlan = searchPlans[extraPlanIdx++]!;
        effectiveQueries.push(nextPlan.keyword);
        const more = await fetchCandidateBatch(nextPlan.keyword, nextPlan.cursor);
        const freshCandidates = more.filter((vt) => !candidateMap.has(vt.id));
        for (const vt of freshCandidates) {
          candidateMap.set(vt.id, vt);
        }
        if (freshCandidates.length > 0) {
          candidates.push(
            ...freshCandidates.sort(
              (a, b) => scoreCandidate(b, recentlyUsedVideos) - scoreCandidate(a, recentlyUsedVideos),
            ),
          );
          continue;
        }
      }
      break;
    }

    cursorIdx += remainingCandidates.length;
    for (const vt of remainingCandidates) {
      scannedVideoIds.add(vt.id);
    }

    const batchResults = await mapLimit(remainingCandidates, 4, (vt) => extractPresetsFromCandidate(vt));

    for (const item of batchResults) {
      if (item.presets.length === 0) continue;

      const freshForThisVideo: Preset[] = [];
      for (const p of item.presets) {
        if (seenPresetUrls.has(p.url)) continue;
        seenPresetUrls.add(p.url);
        freshForThisVideo.push(p);
        discoveredPresets.push({
          ...p,
          id: `${item.origin.id}-${discoveredPresets.length + 1}`,
          vt: item.origin,
        });
      }

      if (freshForThisVideo.length > 0) {
        videoGroups.push({
          vt: item.origin,
          presets: freshForThisVideo,
          scannedComments: item.scannedComments,
        });
      }
    }

    if (scannedVideoIds.size >= 22) break;
  }

  discoveredPresets.sort((a, b) => {
    const aRecent = recentlyUsedPresets.has(a.url) ? 1 : 0;
    const bRecent = recentlyUsedPresets.has(b.url) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    if (a.type !== b.type) return a.type === "5mb" ? -1 : 1;
    return Number(b.byAuthor) - Number(a.byAuthor) || Number(b.pinned) - Number(a.pinned);
  });

  recordQueryHistory(
    normalizedQuery,
    videoGroups.map((g) => g.vt.id),
    discoveredPresets.slice(0, 14).map((p) => p.url),
  );

  return {
    query,
    effectiveQueries: [...new Set(effectiveQueries)],
    variation,
    targetMin,
    totalPresets: discoveredPresets.length,
    totalVideosScanned: scannedVideoIds.size,
    totalCandidatesFound: candidateMap.size,
    presets: discoveredPresets,
    videos: videoGroups,
    timestamp: Date.now(),
  };
}
