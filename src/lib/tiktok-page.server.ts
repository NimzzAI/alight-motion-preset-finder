import { fetchText, http, sleep } from "./http.server";

export function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^\d{15,}$/.test(s)) return s;
  const patterns = [
    /\/video\/(\d{15,})/,
    /\/v\/(\d{15,})/,
    /[?&](?:item_id|share_item_id|aweme_id)=(\d{15,})/,
    /\/(\d{15,})(?:\?|$)/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1] as string;
  }
  return null;
}

export async function resolveTiktok(input: string): Promise<{ videoId: string; user: string }> {
  let cur = /^https?:\/\//i.test(input) ? input : "https://" + input;
  const userOf = (u: string) => u.match(/\/@([^/?#]+)\//)?.[1] ?? "";

  for (let i = 0; i < 6; i++) {
    const id = extractVideoId(cur);
    if (id && /tiktok\.com/i.test(cur)) return { videoId: id, user: userOf(cur) };
    let res: Response;
    try {
      res = await http(cur, { redirect: "manual", timeout: 12000 });
    } catch {
      break;
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      cur = new URL(loc, cur).href;
      continue;
    }
    break;
  }

  const id = extractVideoId(cur);
  if (!id) throw new Error("Link TikTok-nya nggak valid atau nggak bisa dibuka.");
  return { videoId: id, user: userOf(cur) };
}

export type VideoInfo = {
  description: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  cover: string | null;
  src: string | null;
  user: string;
  nickname: string;
  avatar: string | null;
  bio: string;
};

export async function getVideoInfo(videoId: string): Promise<Partial<VideoInfo>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(700);
    try {
      const { body } = await fetchText(`https://www.tiktok.com/embed/v2/${videoId}`, { timeout: 8000 });
      const m = body.match(/<script[^>]*id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) continue;
      const state = JSON.parse(m[1] as string);
      const key = Object.keys(state.source?.data ?? {}).find((k) => k.includes(videoId));
      const v = key && state.source.data[key]?.videoData;
      if (!v) return {};
      const item = v.itemInfos ?? {};
      return {
        description: item.text ?? "",
        views: item.playCount ?? null,
        likes: item.diggCount ?? null,
        comments: item.commentCount ?? null,
        shares: item.shareCount ?? null,
        cover: item.coverUrl?.[0] ?? item.covers?.[0] ?? null,
        src: item.video?.urls?.find((u: string) => /^https:/i.test(u)) ?? null,
        user: v.authorInfos?.uniqueId ?? "",
        nickname: v.authorInfos?.nickName ?? "",
        avatar: v.authorInfos?.covers?.[0] ?? null,
        bio: v.authorInfos?.signature ?? "",
      };
    } catch {
      continue;
    }
  }
  return {};
}
