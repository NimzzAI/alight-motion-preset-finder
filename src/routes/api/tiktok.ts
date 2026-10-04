import { createFileRoute } from "@tanstack/react-router";
import { allow, clientIp } from "../../lib/limit.server";
import { json } from "../../lib/respond.server";
import { runTikTok } from "../../lib/tiktok.server";
import { isTikTokInput } from "../../lib/validate";

export const Route = createFileRoute("/api/tiktok")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const input = new URL(request.url).searchParams.get("url")?.trim() ?? "";
        if (!input) return json({ ok: false, error: "Linknya belum diisi." }, 400);
        if (!isTikTokInput(input)) return json({ ok: false, error: "Itu bukan link TikTok." }, 400);
        if (!allow(clientIp(request))) {
          return json({ ok: false, error: "Terlalu banyak permintaan, tunggu sebentar." }, 429);
        }

        try {
          return json({ ok: true, data: await runTikTok(input) });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "Ada yang error, coba lagi." }, 502);
        }
      },
    },
  },
});
