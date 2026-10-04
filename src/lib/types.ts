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

export type FindResult = {
  engine: "finder" | "bintang" | "amfinder";
  video: {
    id: string | null;
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

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
