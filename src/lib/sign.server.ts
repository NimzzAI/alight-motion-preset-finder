import { createHmac, timingSafeEqual } from "node:crypto";
import { settings } from "../config/settings.server";

const SECRET = settings.signSecret;

export const sign = (value: string) => createHmac("sha256", SECRET).update(value).digest("hex").slice(0, 32);

export function verify(value: string, signature: string | null): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signature ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const mediaLink = (url: string) => `/api/media?u=${encodeURIComponent(url)}&s=${sign(url)}`;
