# Preset Finder

Cari preset Alight Motion dari video TikTok, plus unduh video TikTok tanpa watermark. TanStack Start + React, tanpa library UI.

## Jalankan

```
npm install
npm run dev
```

Build: `npm run build`. Deploy ke Vercel atau host Node apa pun (Nitro).

## Config

- `src/config/site.ts` identitas situs: nama, url, deskripsi, keyword, gambar (favicon, og-image), judul dan deskripsi per halaman. Ganti `url` ke domain asli sebelum deploy.
- `src/config/settings.server.ts` pengaturan server: url service Go, cache, jumlah halaman komentar, URL jalur cadangan, rate limit.

## Env

- `SIGN_SECRET` string acak panjang, menandatangani link proxy `/api/media`.
- `GO_SERVICE_URL` alamat service Go TikDown. Kosong berarti unduh TikTok langsung pakai tikwm lalu parse halaman.
- `API_SECRET` rahasia bersama dengan service Go (opsional).
- `RATE_LIMIT_PER_MINUTE` batas request per IP.

## Service Go

```
cd services/downloader-go
go run ./cmd/server
```

Atau pakai `Dockerfile` di folder itu. Port default 8090. Urutan unduh TikTok: Go, tikwm, parse halaman.

## Aset

`public/` berisi `favicon.png`, `favicon-32.png`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, dan `og-image.png` (1200x630). `/robots.txt`, `/sitemap.xml`, dan `/manifest.webmanifest` dibuat otomatis dari `site.ts`.

## Struktur

```
src/
  routes/
    index.tsx          halaman preset finder
    tiktok.tsx         halaman unduh TikTok
    api/find.ts        GET /api/find?url=
    api/tiktok.ts      GET /api/tiktok?url=
    api/media.ts       proxy video, audio, foto (bertanda tangan)
  components/          komponen UI kecil
  hooks/use-lookup.ts  fetch + loading + timer
  config/              site.ts dan settings.server.ts
services/downloader-go service Go dari TikDown
  lib/
    finder.server.ts   mesin utama (port Alight Motion Finder)
    fallback.server.ts jalur cadangan: bintangapi, lalu amfinder.web.id
    preset.server.ts   urutan: mesin utama, cadangan 1, cadangan 2
    tiktok.server.ts   unduh TikTok: Go, tikwm, lalu parse halaman
    video-src.server.ts  downr, snaptik, tikwm, embed, halaman
```

## Alur finder

1. Mesin utama memindai deskripsi, bio, link di bio, komentar, dan balasan komentar.
2. Kalau error atau tidak ada preset, lanjut ke bintangapi, lalu amfinder.web.id.
3. Hasil pertama yang berisi preset dipakai. Kalau semua kosong, hasil kosong dari mesin utama yang ditampilkan.

## Kredit

Logika finder dari Alight Motion Finder. Jalur cadangan dari SC_AM_FINDER (bintangapi) dan skrip Zx (amfinder.web.id).
