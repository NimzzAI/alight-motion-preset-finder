import { createFileRoute } from "@tanstack/react-router";
import { settings } from "../../config/settings.server";
import { UA } from "../../lib/http.server";
import { verify } from "../../lib/sign.server";

const text = (body: string, status: number) => new Response(body, { status });

const isPrivateHost = (h: string) =>
  h === "localhost" || /^[\d.]+$/.test(h) || h.includes(":") || /\.(local|internal|localhost)$/.test(h);

const refererFor = (host: string, origin: string) => {
  if (/tiktok|byte|ibyted/.test(host)) return "https://www.tiktok.com/";
  if (host.endsWith("snaptik.fi")) return "https://snaptik.fi/";
  if (/yt-dl\.click|cnv\.cx|y2meta/.test(host)) return "https://frame.y2meta-uk.com/";
  if (/rapidcdn\.app|snapsave\.app/.test(host)) return "https://snapsave.app/";
  return origin + "/";
};

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const raw = q.get("u") ?? "";
        if (!verify(raw, q.get("s"))) return text("bad signature", 403);

        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return text("bad url", 400);
        }
        const host = target.hostname.toLowerCase();
        if (target.protocol !== "https:" || isPrivateHost(host)) return text("host not allowed", 403);

        const headers: Record<string, string> = {
          "User-Agent": UA,
          Referer: refererFor(host, target.origin),
          Accept: "*/*",
        };
        const range = request.headers.get("range");
        if (range) headers["Range"] = range;

        try {
          const open = (referer: string) =>
            fetch(target, {
              headers: { ...headers, Referer: referer },
              redirect: "follow",
              signal: AbortSignal.timeout(settings.limits.mediaProxyTimeoutMs),
            });
          let upstream = await open(headers["Referer"] as string);
          if (upstream.status === 403) upstream = await open("https://j2download.com/");
          if (!upstream.ok && upstream.status !== 206) return text(`upstream ${upstream.status}`, 502);

          const type = upstream.headers.get("content-type") ?? "application/octet-stream";
          if (!/^(video|audio|image)\/|^application\/octet-stream/i.test(type)) return text("not media", 502);

          const out = new Headers({
            "content-type": type,
            "accept-ranges": "bytes",
            "cache-control": "private, max-age=600",
          });
          for (const k of ["content-length", "content-range"]) {
            const v = upstream.headers.get(k);
            if (v) out.set(k, v);
          }
          const name = (q.get("name") ?? "").replace(/[^\w.-]/g, "").slice(0, 80);
          if (name) out.set("content-disposition", `attachment; filename="${name}"`);

          return new Response(upstream.body, { status: upstream.status, headers: out });
        } catch {
          return text("fetch failed", 502);
        }
      },
    },
  },
});
