import crypto from "node:crypto";

export const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
  cookie?: string;
};

export const http = (url: string, o: Options = {}) =>
  fetch(url, {
    redirect: o.redirect ?? "follow",
    headers: {
      "User-Agent": o.ua ?? UA,
      Accept: o.accept ?? "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      Referer: o.referer ?? "https://www.tiktok.com/",
      ...(o.cookie ? { Cookie: o.cookie } : {}),
    },
    signal: AbortSignal.timeout(o.timeout ?? 15000),
  });

function solveSlardarChallenge(html: string): { wci: string; cookieVal: string } | null {
  const cs = html.match(/<p\s+id=["']cs["'][^>]*class=["']([^"'>]+)/)?.[1];
  const wci = html.match(/<p\s+id=["']wci["'][^>]*class=["']([^"'>]+)/)?.[1];
  if (!cs || !wci) return null;

  try {
    const padded = cs + "=".repeat((4 - (cs.length % 4)) % 4);
    const challenge = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const strA = challenge?.v?.a;
    const strC = challenge?.v?.c;
    if (typeof strA !== "string" || typeof strC !== "string") return null;

    const seed = Buffer.from(strA, "base64");
    const expected = Buffer.from(strC, "base64");

    for (let i = 0; i <= 1_000_000; i++) {
      const numBuf = Buffer.from(String(i));
      const digest = crypto.createHash("sha256").update(Buffer.concat([seed, numBuf])).digest();
      if (digest.equals(expected)) {
        challenge.d = numBuf.toString("base64");
        return {
          wci,
          cookieVal: Buffer.from(JSON.stringify(challenge)).toString("base64"),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchText(url: string, o?: Options) {
  const res = await http(url, o);
  const body = await res.text();

  if (body.length < 4000 && body.includes('id="cs"') && body.includes('id="wci"')) {
    const solved = solveSlardarChallenge(body);
    if (solved) {
      const setCookies =
        typeof (res.headers as any).getSetCookie === "function"
          ? ((res.headers as any).getSetCookie() as string[]).map((c) => c.split(";")[0]).join("; ")
          : "";
      const cookieHeader = [setCookies, `${solved.wci}=${solved.cookieVal}`].filter(Boolean).join("; ");
      const res2 = await http(url, { ...o, cookie: cookieHeader });
      return { status: res2.status, body: await res2.text(), finalUrl: res2.url };
    }
  }

  return { status: res.status, body, finalUrl: res.url };
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
