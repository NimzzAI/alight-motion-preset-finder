import { createHash } from "node:crypto";
import { settings } from "../config/settings.server";
import { mediaLink } from "./sign.server";
import type { AioResult } from "./types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://j2download.com";

type Bootstrap = {
  nonce: string;
  powChallenge: string;
  powDifficulty?: number;
  challengeType?: string;
};

function hasLeadingZeroNibbles(bytes: Uint8Array, difficulty: number): boolean {
  const fullBytes = (difficulty / 2) | 0;
  const hasHalfByte = (difficulty & 1) === 1;
  for (let i = 0; i < fullBytes; i++) {
    if (bytes[i] !== 0) return false;
  }
  if (hasHalfByte && ((bytes[fullBytes] as number) & 0xf0) !== 0) return false;
  return true;
}

function solvePow(challenge: string, nonce: string, difficulty: number, challengeType: string): string | null {
  const alt = challengeType === "alt";
  const prefix = alt ? `pow:${nonce}:` : `pow:${challenge}:`;
  const suffix = alt ? `:${challenge}` : `:${nonce}:${challenge.length}`;

  for (let n = 0; n < settings.aio.maxPowIterations; n++) {
    const hash = createHash("sha256").update(`${prefix}${n}${suffix}`).digest();
    if (hasLeadingZeroNibbles(hash, difficulty)) return String(n);
  }
  return null;
}

async function scrape(url: string): Promise<AioResult> {
  const homeRes = await fetch(BASE, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: `${BASE}/`,
      Origin: BASE,
    },
    signal: AbortSignal.timeout(15000),
  });
  const headers = homeRes.headers as Headers & { getSetCookie?: () => string[] };
  const rawCookies = headers.getSetCookie?.() ?? [homeRes.headers.get("set-cookie") ?? ""].filter(Boolean);
  const cookie = rawCookies.map((c) => c.split(";")[0]).join("; ");
  const html = await homeRes.text();

  const match = html.match(/window\.__BOOTSTRAP__\s*=\s*(\{.*?\});/);
  if (!match) throw new Error("Layanan sumber berubah, bootstrap tidak ditemukan.");
  const bootstrap = JSON.parse(match[1] as string) as Bootstrap;

  const solution = solvePow(
    bootstrap.powChallenge,
    bootstrap.nonce,
    bootstrap.powDifficulty || 3,
    bootstrap.challengeType || "classic",
  );
  if (!solution) throw new Error("Verifikasi layanan sumber gagal diselesaikan.");

  const authRes = await fetch(`${BASE}/api/auth/issue`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Referer: `${BASE}/`,
      Origin: BASE,
      Cookie: cookie,
      "X-Page-Nonce": bootstrap.nonce,
      "X-Pow-Solution": solution,
      Accept: "application/json, text/plain, */*",
    },
    signal: AbortSignal.timeout(15000),
  });
  const authData: any = await authRes.json().catch(() => null);
  const token = authData?.accessToken;
  if (!token) throw new Error(authData?.message ?? "Token akses dari layanan sumber tidak keluar.");

  const autoRes = await fetch(`${BASE}/api/autolink`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Referer: `${BASE}/`,
      Origin: BASE,
      Cookie: cookie,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
    },
    body: JSON.stringify({ data: { url, unlock: true } }),
    signal: AbortSignal.timeout(settings.aio.timeoutMs),
  });
  const result: any = await autoRes.json().catch(() => null);
  if (!result) throw new Error("Respons layanan sumber tidak terbaca.");
  if (result.error) throw new Error(result.message ?? "Layanan sumber mengembalikan error.");

  const medias = ((result.medias ?? []) as any[])
    .filter((m) => typeof m?.url === "string" && /^https?:\/\//i.test(m.url))
    .map((m) => {
      const direct = String(m.url).replace(/^http:/i, "https:");
      return {
        quality: String(m.quality ?? ""),
        label: String(m.label ?? m.quality ?? ""),
        extension: String(m.extension ?? (m.type === "audio" ? "mp3" : "mp4")).replace(/^\./, ""),
        type: (m.type === "audio" ? "audio" : "video") as "audio" | "video",
        direct,
        proxy: mediaLink(direct),
      };
    });

  if (!medias.length) throw new Error("Link unduhan nggak ketemu untuk tautan ini.");

  return {
    videoId: result.videoId ?? null,
    title: result.title ?? "",
    author: result.author ?? "",
    duration: result.duration || result.lengthSeconds ? String(result.duration ?? result.lengthSeconds) : null,
    thumbnail: result.thumbnail ?? null,
    viewCount: result.viewCount != null ? String(result.viewCount) : null,
    medias,
  };
}

const cache = new Map<string, { at: number; value: AioResult }>();

export async function runAio(url: string): Promise<AioResult> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;

  let lastError: Error | null = null;
  for (let i = 0; i < settings.aio.attempts; i++) {
    try {
      const value = await scrape(url);
      cache.set(url, { at: Date.now(), value });
      if (cache.size > 200) cache.delete(cache.keys().next().value as string);
      return value;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Gagal mengambil link unduhan.");
}
