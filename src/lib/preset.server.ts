import { runAmfinder, runBintang } from "./fallback.server";
import { runFinder } from "./finder.server";
import { runSocial } from "./find-social.server";
import { detectPlatform, ytId } from "./platform";
import type { FindResult } from "./types";

const engines = [runFinder, runBintang, runAmfinder];

async function findTiktok(input: string): Promise<FindResult> {
  let empty: FindResult | null = null;
  let firstError: Error | null = null;

  for (const run of engines) {
    try {
      const result = await run(input);
      if (result.presets.length) return result;
      empty ??= result;
    } catch (e) {
      firstError ??= e instanceof Error ? e : new Error(String(e));
    }
  }

  if (empty) return empty;
  throw firstError ?? new Error("Semua jalur gagal, coba lagi sebentar lagi.");
}

export async function findPreset(input: string): Promise<FindResult> {
  const platform = detectPlatform(input);
  if (platform === "youtube") return runSocial(input, "youtube", ytId(input));
  if (platform === "instagram") return runSocial(input, "instagram", null);
  return findTiktok(input);
}
