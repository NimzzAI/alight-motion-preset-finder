export const isTikTokInput = (value: string) => /tiktok\.com\//i.test(value) || /^\d{15,}$/.test(value);

export function fmtNum(n: number): string {
  const short = (v: number) => v.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (n >= 1e6) return `${short(n / 1e6)} jt`;
  if (n >= 1e3) return `${short(n / 1e3)} rb`;
  return String(n);
}
