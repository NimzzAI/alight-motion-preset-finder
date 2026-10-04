const env = process.env;
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const settings = {
  signSecret: env["SIGN_SECRET"] ?? "ganti-lewat-env",

  downloader: {
    goServiceUrl: (env["GO_SERVICE_URL"] ?? "").replace(/\/$/, ""),
    goServiceSecret: env["API_SECRET"] ?? "",
    goTimeoutMs: 25_000,
  },

  finder: {
    cacheMinutes: 20,
    cacheMax: 200,
    commentPages: 4,
    fallbacks: {
      bintang: "https://bintangapi.my.id/api/amfind/",
      amfinder: "https://amfinder.web.id/api/find",
    },
  },

  limits: {
    requestsPerMinute: num(env["RATE_LIMIT_PER_MINUTE"], 20),
    mediaProxyTimeoutMs: 30_000,
  },
} as const;
