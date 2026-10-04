import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import { Header } from "../components/header";
import { siteConfig as site } from "../config/site";
import { structuredData } from "../lib/seo";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: site.name },
      { name: "theme-color", content: site.themeColor },
      { name: "application-name", content: site.name },
      { name: "apple-mobile-web-app-title", content: site.name },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "32x32", href: site.images.favicon32 },
      { rel: "icon", type: "image/png", sizes: "64x64", href: site.images.favicon },
      { rel: "shortcut icon", href: site.images.ico },
      { rel: "apple-touch-icon", sizes: "180x180", href: site.images.appleTouch },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    scripts: [{ type: "application/ld+json", children: structuredData }],
  }),
  shellComponent: Shell,
  component: Layout,
  notFoundComponent: NotFound,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang={site.lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Layout() {
  return (
    <>
      <Header />
      <main className="wrap">
        <Outlet />
      </main>
      <footer className="wrap footer">
        <p>Bukan afiliasi Alight Motion atau TikTok. Preset tetap milik pembuatnya.</p>
      </footer>
    </>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Halaman nggak ada</h1>
      <p className="lead">
        <Link to="/">Balik ke pencarian preset</Link>
      </p>
    </div>
  );
}
