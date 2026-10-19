import { createFileRoute } from "@tanstack/react-router";
import { guard } from "../../lib/guard.server";
import { allow, clientIp } from "../../lib/limit.server";
import { json } from "../../lib/respond.server";
import { searchPresetsByKeyword } from "../../lib/search-preset.server";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = guard(request);
        if (blocked) return blocked;

        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const variationRaw = url.searchParams.get("variation");
        const minRaw = url.searchParams.get("min");

        if (!q || q.length < 2) {
          return json({ ok: false, error: "Masukkan judul atau kata kunci preset (minimal 2 karakter)." }, 400);
        }
        if (q.length > 120) {
          return json({ ok: false, error: "Kata kunci terlalu panjang (maksimal 120 karakter)." }, 400);
        }
        if (!allow(clientIp(request))) {
          return json({ ok: false, error: "Terlalu banyak permintaan, tunggu sebentar." }, 429);
        }

        const variation = variationRaw !== null ? parseInt(variationRaw, 10) : undefined;
        const minPresets = minRaw !== null ? parseInt(minRaw, 10) : 10;

        try {
          const data = await searchPresetsByKeyword(q, {
            variation: Number.isFinite(variation) ? variation : undefined,
            minPresets: Number.isFinite(minPresets) ? minPresets : 10,
          });
          return json({ ok: true, data });
        } catch (e) {
          return json(
            {
              ok: false,
              error: e instanceof Error ? e.message : "Gagal mencari preset dari judul tersebut, coba lagi.",
            },
            502,
          );
        }
      },
    },
  },
});
