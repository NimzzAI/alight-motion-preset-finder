import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { settings } from "../config/settings.server";
import { runBintang } from "./fallback.server";
import { type Found, finishFound, getComments, getProfile, getReplies, makeAdder } from "./finder.server";
import { DESKTOP_UA, fetchText, mapLimit } from "./http.server";
import { extractLinks, isAm, isFile } from "./links.server";
import { mediaLink } from "./sign.server";
import { videoFields } from "./video-src.server";
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

let goProc: ChildProcess | null = null;
let goStarting: Promise<boolean> | null = null;

async function ensureGoServiceRunning(): Promise<boolean> {
  const { goServiceUrl } = settings.downloader;
  if (!goServiceUrl) return false;

  try {
    const health = await fetch(`${goServiceUrl}/health`, {
      signal: AbortSignal.timeout(1200),
    });
    if (health.ok) return true;
  } catch {
    // Not listening yet, attempt to spawn local compiled Golang binary
  }

  if (goStarting) return goStarting;

  goStarting = (async () => {
    try {
      const binCandidates = [
        path.resolve(process.cwd(), "services/downloader-go/downloader-bin"),
        "/app/applet/services/downloader-go/downloader-bin",
      ];
      const binPath = binCandidates.find((p) => fs.existsSync(p));
      if (!binPath) return false;

      if (!goProc || goProc.killed) {
        goProc = spawn(binPath, [], {
          env: { ...process.env, PORT: "8090" },
          stdio: "ignore",
          detached: true,
        });
        goProc.unref();
      }

      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 200));
        try {
          const check = await fetch(`${goServiceUrl}/health`, {
            signal: AbortSignal.timeout(800),
          });
          if (check.ok) return true;
        } catch {
          // Wait for startup
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      goStarting = null;
    }
  })();

  return goStarting;
}

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
    { keyword: `${clean} preset am`, cursor: 10 },
    { keyword: `${base} ${QUERY_MODIFIERS[variationSeed % QUERY_MODIFIERS.length]}`, cursor: 20 },
  ];

  const offset = variationSeed % pool.length;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}

function scoreCandidate(vt: RawCandidateVT, recentlyUsedVideos: Set<string>): number {
  const text = `${vt.description} ${vt.author.signature ?? ""} ${vt.author.bioLink ?? ""}`.toLowerCase();
  let score = 0;

  if (/alight\.link|alightcreative\.com|drive\.google\.com|mediafire\.com|sfile\.mobi|linktr\.ee|lynk\.id|heylink\.me/i.test(text)) {
    score += 55;
  }
  if (/\b(5mb|xml|preset|am|link|bio|komen|komentar|pin)\b/i.test(text)) {
    score += 25;
  }
  if ((vt.comments ?? 0) >= 5) {
    score += 12;
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
    const q = encodeURIComponent(`site:tiktok.com ${keyword}`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
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
              cover: struct.video?.cover ?? struct.video?.originCover ?? null,
              playUrl: struct.video?.playAddr ?? struct.video?.downloadAddr ?? null,
              images,
              duration: Number(struct.video?.duration) || null,
              views: Number(struct.stats?.playCount) || null,
              likes: Number(struct.stats?.diggCount) || null,
              comments: Number(struct.stats?.commentCount) || null,
              author: {
                username: String(struct.author?.uniqueId || item.username),
                nickname: String(struct.author?.nickname || item.username),
                avatar: struct.author?.avatarThumb ?? null,
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
        views: null,
        likes: null,
        comments: null,
        author: {
          username: item.username,
          nickname: item.username,
          avatar: null,
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
  if (vt.author.signature) {
    extractLinks(vt.author.signature).forEach((u) => add(u, "bio"));
  }
  if (vt.author.bioLink) {
    add(vt.author.bioLink, "bioLink");
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
      const fb = await Promise.race([
        runBintang(vt.url),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 9000)),
      ]);
      if (fb.presets.length > 0) presets = fb.presets;
    } catch {
      // Ignore fallback timeout during batch scan
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
      return fetchCandidateBatch(plan.keyword);
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
    const extraBatch = await fetchCandidateBatch(extraPlan.keyword);
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
        const more = await fetchCandidateBatch(nextPlan.keyword);
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

    const batchResults = await mapLimit(remainingCandidates, 5, (vt) => extractPresetsFromCandidate(vt));

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
