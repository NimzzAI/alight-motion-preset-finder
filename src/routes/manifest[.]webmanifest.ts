import { createFileRoute } from "@tanstack/react-router";
import { siteConfig as site } from "../config/site";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify({
            name: site.name,
            short_name: site.name,
            description: site.description,
            lang: site.lang,
            start_url: "/",
            display: "standalone",
            background_color: site.themeColor,
            theme_color: site.themeColor,
            icons: [
              { src: site.images.icon192, sizes: "192x192", type: "image/png" },
              { src: site.images.icon512, sizes: "512x512", type: "image/png" },
              { src: site.images.icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
            ],
          }),
          { headers: { "content-type": "application/manifest+json; charset=utf-8" } },
        ),
    },
  },
});
