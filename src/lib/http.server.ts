export const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function hostIn(url: string, list: string[]): boolean {
  const host = hostOf(url);
  return !!host && list.some((x) => host === x || host.endsWith("." + x));
}

type Options = {
  redirect?: RequestRedirect;
  ua?: string;
  accept?: string;
  referer?: string;
  timeout?: number;
};

export const http = (url: string, o: Options = {}) =>
  fetch(url, {
    redirect: o.redirect ?? "follow",
    headers: {
      "User-Agent": o.ua ?? UA,
      Accept: o.accept ?? "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: o.referer ?? "https://www.tiktok.com/",
    },
    signal: AbortSignal.timeout(o.timeout ?? 15000),
  });

export async function fetchText(url: string, o?: Options) {
  const res = await http(url, o);
  return { status: res.status, body: await res.text() };
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
