import { createFileRoute } from "@tanstack/react-router";
import { runAio } from "../../lib/aio.server";
import { guard } from "../../lib/guard.server";
import { allow, clientIp } from "../../lib/limit.server";
import { isHttpUrl } from "../../lib/platform";
import { json } from "../../lib/respond.server";

export const Route = createFileRoute("/api/aio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = guard(request);
        if (blocked) return blocked;

        const input = new URL(request.url).searchParams.get("url")?.trim() ?? "";
        if (!input) return json({ ok: false, error: "Linknya belum diisi." }, 400);
        if (input.length > 512 || !isHttpUrl(input)) return json({ ok: false, error: "Itu bukan link yang valid." }, 400);
        if (!allow(clientIp(request))) {
          return json({ ok: false, error: "Terlalu banyak permintaan, tunggu sebentar." }, 429);
        }

        try {
          return json({ ok: true, data: await runAio(input) });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "Ada yang error, coba lagi." }, 502);
        }
      },
    },
  },
});
