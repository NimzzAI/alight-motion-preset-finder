import { runAmfinder, runBintang } from "./fallback.server";
import { runFinder } from "./finder.server";
import { runSocial } from "./find-social.server";
import { detectPlatform, ytId } from "./platform";
import type { FindResult, Preset } from "./types";

function mergePresets(primary: Preset[], extra: Preset[]): Preset[] {
  const out = [...primary];
  const seen = new Set(primary.map((p) => p.url.replace(/\?source=link$/i, "")));
  for (const p of extra) {
    const norm = p.url.replace(/\?source=link$/i, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(p);
  }
  return out;
}

function mergeMetadata(base: FindResult, fallback: FindResult): FindResult {
  return {
    ...fallback,
    video: {
      ...fallback.video,
      id: base.video.id || fallback.video.id,
      url: base.video.url || fallback.video.url,
      src: base.video.src || fallback.video.src,
      proxy: base.video.proxy || fallback.video.proxy,
      cover: base.video.cover || fallback.video.cover,
      images: base.video.images?.length ? base.video.images : fallback.video.images,
      description: base.video.description || fallback.video.description,
      duration: base.video.duration || fallback.video.duration,
      createdAt: base.video.createdAt ?? fallback.video.createdAt,
      region: base.video.region ?? fallback.video.region,
      views: base.video.views ?? fallback.video.views,
      likes: base.video.likes ?? fallback.video.likes,
      comments: base.video.comments ?? fallback.video.comments,
      shares: base.video.shares ?? fallback.video.shares,
      music: base.video.music ?? fallback.video.music,
    },
    author: {
      ...fallback.author,
      username: base.author.username || fallback.author.username,
      nickname: base.author.nickname || fallback.author.nickname,
      avatar: base.author.avatar || fallback.author.avatar,
      followers: base.author.followers ?? fallback.author.followers,
      likes: base.author.likes ?? fallback.author.likes,
      videos: base.author.videos ?? fallback.author.videos,
      verified: base.author.verified ?? fallback.author.verified,
    },
  };
}

async function findTiktok(input: string): Promise<FindResult> {
  let finderData: FindResult | null = null;
  let firstError: Error | null = null;

  try {
    finderData = await runFinder(input);
  } catch (e) {
    firstError ??= e instanceof Error ? e : new Error(String(e));
  }

  const has5mb = (list: Preset[]) => list.some((p) => p.type === "5mb");
  const hasXml = (list: Preset[]) => list.some((p) => p.type === "xml");

  // If primary finder already found BOTH 5MB and XML presets, return immediately
  if (finderData && has5mb(finderData.presets) && hasXml(finderData.presets)) {
    return finderData;
  }

  // If primary finder found only one type (e.g. only 5mb or only xml), try fast supplement from bintang & amfinder
  if (finderData && finderData.presets.length > 0) {
    try {
      const settled = await Promise.race([
        Promise.allSettled([runBintang(input), runAmfinder(input)]),
        new Promise<null>((r) => setTimeout(() => r(null), 5500)),
      ]);
      if (settled) {
        let merged = finderData.presets;
        for (const item of settled) {
          if (item.status === "fulfilled" && item.value.presets.length > 0) {
            merged = mergePresets(merged, item.value.presets);
          }
        }
        const coverThumb = finderData.video.cover;
        const enriched = merged.map((p) => ({
          ...p,
          thumb: p.thumb ?? coverThumb ?? null,
        }));
        return {
          ...finderData,
          presets: enriched,
        };
      }
    } catch {
      // Return finderData as-is
    }
    return finderData;
  }

  // If primary finder found 0 presets, run fallback engines in parallel and preserve VT metadata
  const fallbackSettled = await Promise.allSettled([runBintang(input), runAmfinder(input)]);
  for (const item of fallbackSettled) {
    if (item.status === "fulfilled") {
      const result = item.value;
      if (result.presets.length) {
        const mergedResult = finderData ? mergeMetadata(finderData, result) : result;
        const coverThumb = mergedResult.video.cover;
        return {
          ...mergedResult,
          presets: mergedResult.presets.map((p) => ({
            ...p,
            thumb: p.thumb ?? coverThumb ?? null,
          })),
        };
      }
      finderData ??= result;
    } else {
      firstError ??= item.reason instanceof Error ? item.reason : new Error(String(item.reason));
    }
  }

  if (finderData) return finderData;
  throw firstError ?? new Error("Semua jalur gagal, coba lagi sebentar lagi.");
}

export async function findPreset(input: string): Promise<FindResult> {
  const platform = detectPlatform(input);
  if (platform === "youtube") return runSocial(input, "youtube", ytId(input));
  if (platform === "instagram") return runSocial(input, "instagram", null);
  return findTiktok(input);
}
