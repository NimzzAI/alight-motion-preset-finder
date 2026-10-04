export const siteConfig = {
  name: "Preset Finder",
  tagline: "Cari preset Alight Motion dari video TikTok",
  description:
    "Tempel link video TikTok, preset Alight Motion di deskripsi, bio, dan komentar dicarikan otomatis. Sekalian unduh video tanpa watermark, musik, dan foto beserta metadatanya.",
  url: "https://preset-finder.vercel.app",
  lang: "id",
  locale: "id_ID",
  author: "Nimzz",
  keywords: [
    "alight motion preset",
    "preset finder",
    "cari preset alight motion",
    "link preset am",
    "tiktok downloader",
    "unduh tiktok tanpa watermark",
  ],
  themeColor: "#f2eee4",
  images: {
    favicon: "/favicon.png",
    favicon32: "/favicon-32.png",
    ico: "/favicon.ico",
    appleTouch: "/apple-touch-icon.png",
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
    og: "/og-image.png",
    ogWidth: 1200,
    ogHeight: 630,
    ogAlt: "Preset Finder, cari preset Alight Motion dari video TikTok",
  },
  pages: {
    finder: {
      path: "/",
      title: "Cari preset Alight Motion dari video TikTok",
      description:
        "Tempel link video TikTok, lalu link preset Alight Motion di deskripsi, bio, komentar, dan balasan komentar dicarikan otomatis.",
    },
    tiktok: {
      path: "/tiktok",
      title: "Unduh video TikTok tanpa watermark",
      description:
        "Unduh video TikTok tanpa watermark, musik, dan foto slideshow. Metadata video dan akun ikut ditampilkan, tanpa login.",
    },
  },
} as const;

export type SiteConfig = typeof siteConfig;
