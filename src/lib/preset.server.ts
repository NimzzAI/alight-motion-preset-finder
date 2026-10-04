import { runAmfinder, runBintang } from "./fallback.server";
import { runFinder } from "./finder.server";
import type { FindResult } from "./types";

const engines = [runFinder, runBintang, runAmfinder];

export async function findPreset(input: string): Promise<FindResult> {
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
