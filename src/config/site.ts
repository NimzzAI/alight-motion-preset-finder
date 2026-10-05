export const siteConfig = {
  name: "Preset Finder",
  tagline: "Cari preset Alight Motion dari video TikTok, YouTube, dan Instagram",
  description:
    "Tempel link video TikTok, YouTube, atau Instagram, lalu preset Alight Motion di deskripsi, bio, dan komentar dicarikan otomatis. Sekalian unduh video tanpa watermark, musik, dan foto, plus downloader semua-dalam-satu.",
  url: "https://alight-motion-preset-finder-gold.vercel.app",
  lang: "id",
  locale: "id_ID",
  author: "Nimzz",
  keywords: [
    "alight motion preset",
    "preset finder",
    "cari preset alight motion",
    "link preset am",
    "preset alight motion youtube",
    "preset alight motion instagram",
    "tiktok downloader",
    "unduh tiktok tanpa watermark",
    "all in one downloader",
  ],
  themeColor: "#f2eee4",
  themeColorDark: "#14130f",
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
    ogAlt: "Preset Finder, cari preset Alight Motion dari video TikTok, YouTube, dan Instagram",
  },
  pages: {
    finder: {
      path: "/",
      title: "Cari preset Alight Motion dari video TikTok, YouTube, dan Instagram",
      description:
        "Tempel link video TikTok, YouTube, atau Instagram, lalu link preset Alight Motion di deskripsi, bio, komentar, dan balasan komentar dicarikan otomatis.",
    },
    tiktok: {
      path: "/tiktok",
      title: "Unduh video TikTok tanpa watermark",
      description:
        "Unduh video TikTok tanpa watermark, musik, dan foto slideshow. Metadata video dan akun ikut ditampilkan, tanpa login.",
    },
    aio: {
      path: "/aio",
      title: "Unduh video dan audio dari satu link",
      description:
        "Downloader semua-dalam-satu: tempel link, pilih kualitas video atau audio, lalu unduh. Tanpa login dan tanpa aplikasi.",
    },
  },
} as const;

export type SiteConfig = typeof siteConfig;
