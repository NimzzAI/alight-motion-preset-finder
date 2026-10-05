export type Preset = {
  type: "5mb" | "xml";
  url: string;
  title: string | null;
  size: string | null;
  thumb: string | null;
  source: string;
  detail: string | null;
  byAuthor: boolean;
  pinned: boolean;
};

export type Platform = "tiktok" | "youtube" | "instagram";

export type FindResult = {
  engine: "finder" | "bintang" | "amfinder";
  platform: Platform;
  video: {
    id: string | null;
    title: string | null;
    vertical: boolean;
    kind: "video" | "image";
    count: number;
    duration: string | null;
    createdAt: string | number | null;
    url: string | null;
    src: string | null;
    proxy: string | null;
    cover: string | null;
    description: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
  };
  author: {
    username: string;
    nickname: string;
    avatar: string | null;
    subs?: string | null;
  };
  scanned: { comments: number; replies: number };
  presets: Preset[];
};

export type TikTokMedia = {
  id: string | null;
  type: "video" | "photo";
  title: string;
  cover: string | null;
  url: string | null;
  video: string | null;
  videoHd: string | null;
  duration: number | null;
  region: string | null;
  createdAt: number | null;
  music: { title: string; author: string; url: string } | null;
  images: string[];
  author: {
    username: string;
    nickname: string;
    avatar: string | null;
    verified: boolean;
    followers: number | null;
    likes: number | null;
    videos: number | null;
  };
  stats: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
  };
  source: "go" | "tikwm" | "page";
};

export type AioMedia = {
  quality: string;
  label: string;
  extension: string;
  type: "video" | "audio";
  direct: string;
  proxy: string;
};

export type AioResult = {
  videoId: string | null;
  title: string;
  author: string;
  duration: string | null;
  thumbnail: string | null;
  viewCount: string | null;
  medias: AioMedia[];
};

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
