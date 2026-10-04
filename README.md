<p align="center">
  <img src="public/og-image.png" alt="Preset Finder, cari preset Alight Motion dari video TikTok" width="100%">
</p>

<h1 align="center">Preset Finder</h1>

<p align="center">
  Cari preset Alight Motion dari video TikTok, sekalian unduh video tanpa watermark, musik, dan foto slideshow.
</p>

<p align="center">
  <a href="https://alight-motion-preset-finder-gold.vercel.app/">Preview</a>
  &nbsp;|&nbsp;
  <a href="https://github.com/NimzzAI/alight-motion-preset-finder">Repo</a>
  &nbsp;|&nbsp;
  <a href="#api">API</a>
  &nbsp;|&nbsp;
  <a href="#deploy-ke-vercel">Deploy</a>
</p>

---

## Daftar isi

- [Tentang](#tentang)
- [Fitur](#fitur)
- [Preview](#preview)
- [Tech stack](#tech-stack)
- [Cara kerja](#cara-kerja)
- [Mulai cepat](#mulai-cepat)
- [Konfigurasi](#konfigurasi)
- [Environment variable](#environment-variable)
- [API](#api)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Service Go (opsional)](#service-go-opsional)
- [Struktur proyek](#struktur-proyek)
- [Keamanan](#keamanan)
- [Batasan](#batasan)
- [Troubleshooting](#troubleshooting)
- [Aset](#aset)
- [Kredit](#kredit)
- [Disclaimer](#disclaimer)

## Tentang

Banyak kreator TikTok membagikan preset Alight Motion lewat deskripsi video, bio, link di bio, atau komentar. Mencarinya manual itu repot, apalagi kalau linknya disembunyikan di balik link shortener atau di balasan komentar.

Preset Finder mengotomatiskan itu. Tempel link video TikTok, aplikasi memindai semua tempat yang mungkin berisi link preset, lalu menampilkan hasilnya berurutan dari yang paling tepercaya. Di halaman yang sama, video bisa diunduh tanpa watermark beserta metadatanya.

Dibangun dengan TanStack Start dan React, tanpa library UI.

## Fitur

**Cari preset**

- Memindai deskripsi video, bio akun, link di bio, komentar, dan balasan komentar.
- Mengikuti redirect berantai (sampai 8 lompatan) untuk membuka link pendek menjadi link share Alight Motion asli.
- Mengenali link layanan link-in-bio seperti lynk.id, linktr.ee, bio.link, heylink.me, dan sejenisnya, lalu menelusuri isinya.
- Mengelompokkan hasil menjadi dua jenis: link Alight Motion (`5mb`) dan link file seperti Google Drive, MediaFire, Mega, GitHub (`xml`).
- Menandai komentar yang di-pin dan komentar dari pemilik video, lalu mengurutkan hasil berdasarkan tingkat kepercayaan.
- Tiga jalur pencarian bertingkat, jadi kalau satu gagal otomatis lanjut ke berikutnya.

**Unduh TikTok**

- Unduh video tanpa watermark, versi HD kalau tersedia.
- Unduh musik dan foto dari postingan slideshow.
- Menampilkan metadata video (judul, durasi, region, tanggal), statistik (views, likes, komentar, share), dan info akun (followers, total likes, jumlah video).
- Tanpa login.

**Lain-lain**

- Halaman `/` (cari preset) dan `/tiktok` (khusus unduh).
- Link media diproxy dan ditandatangani, jadi tidak bisa disalahgunakan sebagai open proxy.
- Rate limit per IP dan cache hasil di server.
- SEO lengkap: meta tag, Open Graph, Twitter Card, canonical, JSON-LD, `robots.txt`, `sitemap.xml`, dan `manifest.webmanifest` yang dibuat otomatis dari satu file config.

## Preview

Coba langsung di https://alight-motion-preset-finder-gold.vercel.app/

1. Buka halaman utama.
2. Tempel link video TikTok, atau cukup ID videonya (angka 15 digit ke atas).
3. Tekan **Cari preset**.
4. Hasil preset muncul, lalu tombol unduh dan metadata menyusul di bawahnya.

## Tech stack

| Bagian | Teknologi |
|---|---|
| Framework | TanStack Start + TanStack Router |
| UI | React 19, CSS biasa (`src/styles.css`) |
| Server | Nitro (preset Vercel otomatis, bisa host Node apa pun) |
| Build | Vite |
| Bahasa | TypeScript (strict), ESM |
| Service tambahan | Go 1.22 (opsional) |

## Cara kerja

### Alur finder

1. Link dinormalisasi (link pendek `vm.tiktok.com` dan sejenisnya di-resolve), lalu info video dan akun diambil.
2. Mesin utama memindai deskripsi, bio, link di bio, komentar (sampai 4 halaman, 50 per halaman), dan balasan komentar.
3. Setiap link kandidat disaring: link TikTok, CDN, media sosial, dan aset statis dibuang sebagai noise.
4. Link pendek diikuti redirect-nya sampai ketemu link share Alight Motion.
5. Hasil diurutkan dan dikembalikan. Kalau mesin utama error atau tidak menemukan preset, lanjut ke jalur cadangan 1 (bintangapi), lalu jalur cadangan 2 (amfinder.web.id).
6. Hasil pertama yang berisi preset dipakai. Kalau semua kosong, hasil kosong dari mesin utama yang ditampilkan.
7. Hasil di-cache di memori server (default 20 menit, maksimal 200 entri).

### Alur unduh TikTok

Urutan sumber, berhenti di yang pertama berhasil:

1. Service Go (kalau `GO_SERVICE_URL` diisi).
2. tikwm.
3. Parse halaman TikTok langsung. Untuk mencari link video, jalur ini memakai downr, snaptik, tikwm, embed, lalu halaman.

Hasil di-cache 5 menit (maksimal 200 entri). Semua URL media dibungkus lewat `/api/media` dengan tanda tangan HMAC.

## Mulai cepat

Butuh Node.js 22 atau lebih baru.

```
git clone https://github.com/NimzzAI/alight-motion-preset-finder.git
cd preset-finder
npm install
cp .env.example .env
npm run dev
```

Buka http://localhost:3000 (port bisa berbeda, lihat output terminal).

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode development |
| `npm run build` | Build produksi |
| `npm run preview` | Jalankan hasil build secara lokal |

## Konfigurasi

### `src/config/site.ts`

Identitas situs. Semua meta tag, sitemap, robots, dan manifest dibuat dari file ini.

| Field | Isi |
|---|---|
| `name`, `tagline`, `description` | Nama dan deskripsi situs |
| `url` | Domain situs. Ganti ke domain asli sebelum deploy |
| `lang`, `locale` | Bahasa dan locale (`id`, `id_ID`) |
| `author` | Nama pembuat |
| `keywords` | Kata kunci SEO |
| `themeColor` | Warna tema browser dan manifest |
| `images` | Path favicon, ikon, dan og-image beserta ukurannya |
| `pages` | Path, judul, dan deskripsi per halaman |

Catatan: `url` dipakai untuk membuat link absolut di `og:image`, canonical, dan sitemap. Kalau isinya tidak sama dengan domain yang aktif, preview link di WhatsApp, Telegram, dan media sosial tidak akan menampilkan gambar yang benar.

### `src/config/settings.server.ts`

Pengaturan server.

| Setting | Default | Fungsi |
|---|---|---|
| `downloader.goServiceUrl` | kosong | Alamat service Go |
| `downloader.goTimeoutMs` | 25000 | Batas waktu request ke service Go |
| `finder.cacheMinutes` | 20 | Lama cache hasil finder |
| `finder.cacheMax` | 200 | Jumlah maksimal cache finder |
| `finder.commentPages` | 4 | Jumlah halaman komentar yang dipindai |
| `finder.fallbacks` | bintangapi, amfinder | URL jalur cadangan |
| `limits.requestsPerMinute` | 20 | Rate limit per IP |
| `limits.mediaProxyTimeoutMs` | 30000 | Batas waktu proxy media |

## Environment variable

| Variable | Wajib | Fungsi |
|---|---|---|
| `SIGN_SECRET` | Ya | String acak panjang untuk menandatangani link `/api/media`. Buat dengan `openssl rand -hex 32` |
| `GO_SERVICE_URL` | Tidak | Alamat service Go. Kosong berarti jalur Go dilewati |
| `API_SECRET` | Tidak | Rahasia bersama dengan service Go, dikirim lewat header `x-api-secret` |
| `RATE_LIMIT_PER_MINUTE` | Tidak | Batas request per IP per menit, default 20 |

Contoh `.env` ada di `.env.example`. Jangan pernah commit file `.env`.

## API

Semua endpoint memakai metode `GET`. Respons JSON selalu berbentuk:

```json
{ "ok": true, "data": {} }
```

atau

```json
{ "ok": false, "error": "pesan error" }
```

### `GET /api/find?url=`

Mencari preset dari sebuah video TikTok.

```
curl "https://alight-motion-preset-finder-gold.vercel.app/api/find?url=https://www.tiktok.com/@user/video/1234567890123456789"
```

Isi `data`:

| Field | Keterangan |
|---|---|
| `engine` | Mesin yang menghasilkan: `finder`, `bintang`, atau `amfinder` |
| `video` | `id`, `url`, `src`, `proxy`, `cover`, `description`, `views`, `likes`, `comments` |
| `author` | `username`, `nickname`, `avatar` |
| `scanned` | Jumlah komentar dan balasan yang dipindai |
| `presets` | Daftar preset (lihat di bawah) |

Isi satu item `presets`:

| Field | Keterangan |
|---|---|
| `type` | `5mb` untuk link Alight Motion, `xml` untuk link file |
| `url` | Link preset |
| `title`, `size`, `thumb` | Info tambahan kalau tersedia |
| `source` | Asal link (deskripsi, bio, komentar, dan seterusnya) |
| `detail` | Keterangan tambahan |
| `byAuthor` | `true` kalau ditemukan dari pemilik video |
| `pinned` | `true` kalau dari komentar yang di-pin |

### `GET /api/tiktok?url=`

Mengambil media dan metadata TikTok.

Isi `data`:

| Field | Keterangan |
|---|---|
| `id`, `type` | ID video dan jenis (`video` atau `photo`) |
| `title`, `cover`, `url` | Judul, sampul, link asli |
| `video`, `videoHd` | Link unduh video (sudah diproxy) |
| `duration`, `region`, `createdAt` | Durasi, region, waktu unggah |
| `music` | `title`, `author`, `url` |
| `images` | Daftar foto untuk postingan slideshow |
| `author` | `username`, `nickname`, `avatar`, `verified`, `followers`, `likes`, `videos` |
| `stats` | `views`, `likes`, `comments`, `shares` |
| `source` | Sumber data: `go`, `tikwm`, atau `page` |

### `GET /api/media?u=&s=`

Proxy untuk video, audio, dan gambar. Link dibuat otomatis oleh server dan tidak dimaksudkan untuk dibuat manual.

| Parameter | Keterangan |
|---|---|
| `u` | URL sumber (harus HTTPS) |
| `s` | Tanda tangan HMAC dari `u` |
| `name` | Opsional, nama file untuk header unduhan |

Mendukung header `Range`, jadi video bisa di-seek dan diputar sebagian.

### Kode status

| Kode | Arti |
|---|---|
| 200 | Berhasil |
| 400 | Link kosong atau bukan link TikTok |
| 403 | Tanda tangan salah, atau host tidak diizinkan (khusus `/api/media`) |
| 429 | Terlalu banyak permintaan |
| 502 | Semua jalur gagal atau sumber upstream error |

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Di Vercel, pilih **Add New > Project** dan import repo.
3. Kalau muncul preset **Services** karena ada folder `services/downloader-go`, pilih **Import single project** di baris `app (Nitro)`. Root Directory tetap `./` dan Application Preset **Nitro**.
4. Isi environment variable (minimal `SIGN_SECRET`).
5. Tekan **Deploy**.
6. Setelah dapat domain, samakan `url` di `src/config/site.ts` dengan domain tersebut, lalu push supaya sitemap dan og-image menunjuk ke alamat yang benar.

Nitro mendeteksi Vercel otomatis, jadi `vercel.json` tidak diperlukan.

### Versi TanStack Start yang aman

Vercel memblokir versi `@tanstack/react-start` yang terkena celah XSS kritis (GHSA-qx66-fv34-fjm8). Pastikan `package.json` memakai versi yang sudah dipatch:

```json
"@tanstack/react-router": "1.170.41",
"@tanstack/react-start": "1.168.60"
```

Jangan memakai `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS=1`. Cukup update versinya.

### Host selain Vercel

Karena memakai Nitro, proyek ini bisa dibuild untuk target lain (Node server, Cloudflare, Netlify, dan lain-lain) lewat preset Nitro. Untuk server Node biasa:

```
npm run build
node .output/server/index.mjs
```

## Service Go (opsional)

Service kecil untuk mengambil data TikTok langsung dari sumbernya. Berguna kalau jalur lain sering gagal dari IP datacenter. Service ini tidak berjalan di Vercel, jadi harus dihost terpisah (VPS, Railway, Fly.io, dan sejenisnya).

Jalankan lokal:

```
cd services/downloader-go
go run ./cmd/server
```

Atau pakai Docker:

```
cd services/downloader-go
docker build -t downloader-go .
docker run -p 8090:8090 -e API_SECRET=rahasia downloader-go
```

Port default 8090, ubah lewat env `PORT`.

| Endpoint | Fungsi |
|---|---|
| `GET /health` | Cek hidup |
| `POST /extract` | Body `{ "url": "..." }`, mengembalikan data video |

Kalau `API_SECRET` diisi, setiap request ke `/extract` wajib menyertakan header `x-api-secret` dengan nilai yang sama.

Setelah service hidup, isi `GO_SERVICE_URL` (dan `API_SECRET` kalau dipakai) di environment aplikasi, lalu redeploy.

## Struktur proyek

```
.
├── public/                       favicon, ikon, og-image
├── services/
│   └── downloader-go/            service Go (opsional)
│       ├── cmd/server/main.go
│       ├── internal/tiktok/
│       └── Dockerfile
├── src/
│   ├── routes/
│   │   ├── index.tsx             halaman preset finder
│   │   ├── tiktok.tsx            halaman unduh TikTok
│   │   ├── __root.tsx            layout dan head global
│   │   ├── api/
│   │   │   ├── find.ts           GET /api/find
│   │   │   ├── tiktok.ts         GET /api/tiktok
│   │   │   └── media.ts          GET /api/media (proxy bertanda tangan)
│   │   ├── robots[.]txt.ts
│   │   ├── sitemap[.]xml.ts
│   │   └── manifest[.]webmanifest.ts
│   ├── components/               komponen UI kecil
│   ├── hooks/use-lookup.ts       fetch, loading, timer
│   ├── config/
│   │   ├── site.ts               identitas situs dan SEO
│   │   └── settings.server.ts    pengaturan server
│   ├── lib/
│   │   ├── finder.server.ts      mesin utama pencari preset
│   │   ├── fallback.server.ts    jalur cadangan (bintangapi, amfinder)
│   │   ├── preset.server.ts      urutan mesin: utama, cadangan 1, cadangan 2
│   │   ├── links.server.ts       ekstraksi dan klasifikasi link
│   │   ├── tiktok.server.ts      unduh TikTok: Go, tikwm, halaman
│   │   ├── tiktok-page.server.ts parse halaman TikTok
│   │   ├── video-src.server.ts   sumber link video
│   │   ├── http.server.ts        helper fetch dan concurrency
│   │   ├── limit.server.ts       rate limit per IP
│   │   ├── sign.server.ts        tanda tangan HMAC link media
│   │   ├── respond.server.ts     helper respons JSON
│   │   ├── seo.ts                meta tag dan JSON-LD
│   │   ├── validate.ts           validasi input dan format angka
│   │   └── types.ts              tipe data bersama
│   ├── router.tsx
│   └── styles.css
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

File berakhiran `.server.ts` hanya dijalankan di server.

## Keamanan

- **Link media bertanda tangan.** Setiap URL di `/api/media` ditandatangani HMAC-SHA256 dengan `SIGN_SECRET`, dibandingkan dengan `timingSafeEqual`. Tanpa tanda tangan yang valid, permintaan ditolak 403.
- **Anti open proxy.** Hanya HTTPS yang diizinkan. Host lokal, alamat IP langsung, dan domain `.local`, `.internal`, `.localhost` diblokir. Respons upstream yang bukan video, audio, atau gambar ditolak.
- **Rate limit.** Setiap IP dibatasi per menit pada endpoint `/api/find` dan `/api/tiktok`.
- **Secret lewat env.** Jangan menaruh `SIGN_SECRET` atau `API_SECRET` di kode atau repo.
- **Dependensi.** Selalu pakai versi TanStack Start yang sudah dipatch (lihat bagian deploy).

## Batasan

- **Rate limit dan cache ada di memori.** Di hosting serverless seperti Vercel, tiap instance punya hitungan sendiri dan reset saat cold start. Cukup untuk proyek kecil, tapi bukan pembatas yang ketat. Untuk trafik besar, pindahkan ke penyimpanan bersama seperti Redis atau KV.
- **Batas durasi function.** Proxy media menyalurkan video lewat function. Video besar atau koneksi lambat bisa terkena batas durasi sesuai plan hosting.
- **Bergantung pada layanan pihak ketiga.** Jalur cadangan dan sebagian sumber unduh memakai layanan eksternal yang bisa berubah atau mati sewaktu-waktu. TikTok juga bisa mengubah struktur halamannya.
- **IP datacenter.** TikTok sering membatasi permintaan dari IP datacenter, sehingga jalur parse halaman bisa gagal. Service Go di server dengan IP berbeda biasanya membantu.
- **Video privat atau dihapus** tidak bisa diambil.

## Troubleshooting

| Masalah | Penyebab dan solusi |
|---|---|
| Build Vercel gagal dengan `Vulnerable TanStack Start package detected` | Update `@tanstack/react-start` ke `1.168.60` atau lebih baru, lalu push |
| Preview link tidak menampilkan gambar | `url` di `site.ts` tidak sama dengan domain aktif |
| `bad signature` di `/api/media` | `SIGN_SECRET` berubah setelah link dibuat, atau link dimodifikasi. Muat ulang hasil pencarian |
| Pesan "Terlalu banyak permintaan" | Rate limit per IP tercapai, tunggu semenit |
| Unduhan TikTok gagal, finder normal | Jalur unduh diblokir TikTok dari IP server. Pasang service Go di host lain |
| Preset tidak ketemu padahal ada | Link disembunyikan di tempat yang tidak dipindai, atau komentar melewati batas halaman. Naikkan `finder.commentPages` |
| Preset yang sama muncul dari cache lama | Cache finder berlaku 20 menit, tunggu atau redeploy |

## Aset

`public/` berisi:

| File | Ukuran | Fungsi |
|---|---|---|
| `favicon.png` | - | Favicon utama |
| `favicon-32.png` | 32x32 | Favicon kecil |
| `favicon.ico` | - | Favicon legacy |
| `apple-touch-icon.png` | - | Ikon iOS |
| `icon-192.png` | 192x192 | Ikon manifest |
| `icon-512.png` | 512x512 | Ikon manifest |
| `og-image.png` | 1200x630 | Gambar preview link, juga dipakai di bagian atas README ini |

`/robots.txt`, `/sitemap.xml`, dan `/manifest.webmanifest` dibuat otomatis dari `src/config/site.ts`.

## Kredit

- Dibuat oleh Nimzz.
- Logika finder berasal dari Alight Motion Finder.
- Jalur cadangan berasal dari SC_AM_FINDER (bintangapi) dan skrip Zx (amfinder.web.id).
- Service Go berasal dari TikDown.

## Disclaimer

Proyek ini dibuat untuk keperluan pribadi dan edukasi. Preset dan video tetap milik pembuat aslinya. Hargai hak cipta, beri kredit ke kreator, dan patuhi ketentuan layanan TikTok serta Alight Motion. Pembuat tidak bertanggung jawab atas penyalahgunaan.