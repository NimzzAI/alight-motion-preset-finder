import { createFileRoute } from "@tanstack/react-router";
import { absolute } from "../lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absolute("/sitemap.xml")}\n`, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
