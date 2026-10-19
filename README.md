<p align="center">
  <img src="public/og-image.png" alt="Preset Finder — Ekstraktor Preset Alight Motion & Media Downloader" width="100%">
</p>

<h1 align="center">Preset Finder</h1>

<p align="center">
  <strong>Mesin pencari & ekstraktor preset Alight Motion (5MB & XML) berbasis link maupun kata kunci judul TikTok, dilengkapi pengunduh media tanpa watermark dan all-in-one (AIO) downloader.</strong>
</p>

<p align="center">
  <a href="https://alight-motion-preset-finder-gold.vercel.app/">Live Demo</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/NimzzAI/alight-motion-preset-finder">Repository</a>
  &nbsp;·&nbsp;
  <a href="#arsitektur--algoritma-pencarian">Arsitektur</a>
  &nbsp;·&nbsp;
  <a href="#dokumentasi-api">Dokumentasi API</a>
  &nbsp;·&nbsp;
  <a href="#deployment">Deployment</a>
</p>

---

## Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Fitur Utama](#fitur-utama)
3. [Arsitektur & Algoritma Pencarian](#arsitektur--algoritma-pencarian)
   - [1. Pencarian Preset via Judul / Kata Kunci (Modal Discovery)](#1-pencarian-preset-via-judul--kata-kunci-modal-discovery)
   - [2. Pemindaian Link Video Tunggal (TikTok, YouTube, Instagram)](#2-pemindaian-link-video-tunggal-tiktok-youtube-instagram)
   - [3. Downloader TikTok Tanpa Watermark & Slideshow Foto](#3-downloader-tiktok-tanpa-watermark--slideshow-foto)
   - [4. All-in-One (AIO) Media Downloader](#4-all-in-one-aio-media-downloader)
4. [Tech Stack](#tech-stack)
5. [Struktur Proyek](#struktur-proyek)
6. [Memulai Cepat (Local Development)](#memulai-cepat-local-development)
7. [Konfigurasi & Environment Variables](#konfigurasi--environment-variables)
8. [Dokumentasi API](#dokumentasi-api)
   - [`GET /api/search`](#get-apisearch)
   - [`GET /api/find`](#get-apifind)
   - [`GET /api/tiktok`](#get-apitiktok)
   - [`GET /api/aio`](#get-apiaio)
   - [`GET /api/media`](#get-apimedia)
9. [Microservice Go (`services/downloader-go`)](#microservice-go-servicesdownloader-go)
10. [Keamanan & Rate Limiting](#keamanan--rate-limiting)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Kredit & Lisensi](#kredit--lisensi)

---

## Gambaran Umum

Kreator Alight Motion umumnya membagikan tautan preset (`alight.link`, `alightcreative.com/am/share/...`, maupun file `.xml` di Google Drive/MediaFire) secara tersebar: di deskripsi video, bio profil, tautan link-in-bio (`linktr.ee`, `lynk.id`, `heylink.me`), komentar yang disematkan, hingga balasan komentar berlapis.

**Preset Finder** mengotomatiskan seluruh proses penemuan dan ekstraksi tersebut melalui dua pendekatan utama:

- **Pencarian Berbasis Judul / Kata Kunci (Modal Preset Discovery):** Cukup masukkan judul atau gaya preset (contoh: `preset elitis`, `preset jj slowmo`, `preset velocity`). Mesin secara otomatis mencari video dan foto slideshow di TikTok, mengambil tautan VT aslinya, lalu memindai setiap VT secara paralel hingga terkumpul **minimal 10 preset unik** dengan rotasi variasi dinamis agar hasil selalu segar dan tidak monoton.
- **Pemindaian Tautan Video Langsung:** Tempel tautan video TikTok, YouTube (Video/Shorts), atau Instagram (Post/Reels/TV) untuk mengekstrak seluruh preset beserta pratinjau video tanpa watermark dan metadatanya.

---

## Fitur Utama

### 1. Pencarian Preset via Judul / Kata Kunci (`⌘K` / Modal)
- **Pencarian Multi-VT Otomatis:** Mencari kandidat video dan slideshow foto di TikTok berdasarkan kata kunci (misal `preset elitis`).
- **Target Minimal 10 Preset Unik:** Memindai kandidat VT secara bertahap (deskripsi, bio, link-in-bio, komentar, dan balasan komentar) sampai mengumpulkan minimal 10 preset unik.
- **Anti-Stale & Rotasi Variasi Dinamis:** Dilengkapi sistem rotasi kueri, offset kursor, dan *history ring buffer* per kata kunci sehingga pencarian berulang atau tombol **Acak Variasi VT** selalu menampilkan kumpulan VT dan preset yang berbeda.
- **Konteks VT Asal & Pratinjau Langsung:** Setiap preset dilengkapi tautan VT TikTok asalnya (`https://www.tiktok.com/@user/video/...`), nama kreator, statistik tayangan, serta *drawer* pratinjau video/foto langsung di dalam modal.
- **Filter & Pengelompokan:** Filter instan berdasarkan format (`Semua`, `5MB Alight Motion`, `XML / Drive`) dan mode tampilan (`Daftar Preset` atau `Per Video VT`).

### 2. Ekstraktor Preset Multi-Platform (`/`)
- **Deteksi Platform Otomatis:** Mengenali tautan TikTok, YouTube, dan Instagram secara otomatis.
- **Deep Link Resolution (8 Hops):** Membuka rantai pengalihan (*redirect chain*) dari pemendek tautan (`bit.ly`, `s.id`, `cutt.ly`, `tinyurl.com`, `alight.link`) hingga menemukan URL `alightcreative.com/am/share/` asli.
- **Link-in-Bio Crawler:** Menelusuri halaman agregator tautan (`linktr.ee`, `lynk.id`, `bio.link`, `heylink.me`, `taplink.cc`, `stan.store`) untuk memanen tautan preset di dalamnya.
- **Inspeksi Metadata Preset:** Mengambil judul proyek dan *thumbnail* dari server Alight Motion (`5MB`) serta nama scene dan ukuran file dari Google Drive/MediaFire (`XML`).
- **Skor Kepercayaan (Trust Ranking):** Mengurutkan preset berdasarkan tingkat validitas sumber (deskripsi video > komentar pembuat video > bio > link di bio > komentar disematkan > komentar populer).

### 3. Pengunduh TikTok Tanpa Watermark (`/tiktok`)
- Unduh video tanpa watermark (termasuk kualitas HD jika tersedia), audio/musik asli, dan galeri foto dari postingan slideshow.
- Menampilkan statistik lengkap (tayangan, suka, komentar, bagikan) dan informasi kreator tanpa memerlukan login.

### 4. Downloader All-in-One (`/aio`)
- Mendukung pengunduhan video dan audio lintas platform dengan pemilihan resolusi/kualitas melalui pemecah tantangan *Proof-of-Work* (SHA-256) otomatis di sisi server.

---

## Arsitektur & Algoritma Pencarian

### 1. Pencarian Preset via Judul / Kata Kunci (Modal Discovery)

Algoritma pada `src/lib/search-preset.server.ts` bekerja dalam 4 tahap terstruktur:

```text
[Input Kata Kunci: "preset elitis"]
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tahap 1: Query Expansion & Variation Rotation                   │
│ • Membentuk variasi kueri ("preset elitis alight motion",       │
│   "preset elitis 5mb xml", "preset elitis 5mb", dll.)           │
│ • Memutar offset kursor & memeriksa riwayat VT yang baru saja   │
│   ditampilkan agar hasil pencarian tidak pernah monoton.        │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tahap 2: Multi-Source TikTok VT Discovery                       │
│ • Mengambil daftar kandidat VT (video & foto) melalui           │
│   Service Go (/search) dan TikWM Feed Search API.               │
│ • Memberi skor prioritas pada VT yang mengandung indikasi       │
│   tautan preset di caption atau memiliki interaksi komentar.    │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tahap 3: Parallel Deep Harvesting (Batch Concurrency = 4)       │
│ • Mengekstrak link dari deskripsi VT, bio profil kreator,       │
│   halaman link-in-bio, komentar teratas/disematkan, & balasan.  │
│ • Menjalankan resolveChain() untuk membuka shortlink dan        │
│   mengambil metadata judul/ukuran file preset (5MB & XML).      │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tahap 4: Minimum 10 Presets Threshold Loop                      │
│ • Jika total preset unik < 10, algoritma otomatis mengambil     │
│   batch kandidat VT berikutnya hingga mencapai ≥ 10 preset      │
│   unik atau batas waktu pemindaian terpenuhi.                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Pemindaian Link Video Tunggal (TikTok, YouTube, Instagram)

1. **Normalisasi URL:** Tautan pendek (`vt.tiktok.com`, `vm.tiktok.com`, `youtu.be`, `/share/`) di-resolve ke URL kanonik dan ID video diekstrak.
2. **Akuisisi Data Paralel:** Mengambil metadata video, profil kreator, dan halaman komentar secara bersamaan.
3. **Penyaringan Noise:** Membuang domain internal/CDN/sosial media (`NOISE_HOSTS`) dan mempertahankan kandidat link preset, file, serta pohon tautan.
4. **Triple-Engine Fallback (TikTok):** Jika mesin utama (`finder`) tidak menemukan preset atau mengalami pembatasan jaringan, sistem otomatis beralih ke jalur cadangan 1 (`bintangapi`) lalu jalur cadangan 2 (`amfinder`).

### 3. Downloader TikTok Tanpa Watermark & Slideshow Foto

Menggunakan arsitektur *waterfall fallback*:
1. **Go Microservice (`GO_SERVICE_URL`)**: Mengambil data langsung dari Mobile Feed API TikTok (`aweme/v1/feed`) atau SSR Web dengan pemecah tantangan *Slardar SHA-256*.
2. **TikWM API**: Mengambil stream video tanpa watermark, stream HD, musik, dan daftar gambar slideshow.
3. **Direct Page Hydration**: Mem-parsing `__UNIVERSAL_DATA_FOR_REHYDRATION__` dari halaman TikTok langsung.

### 4. All-in-One (AIO) Media Downloader

1. Membuka sesi ke penyedia upstream, mengekstrak konfigurasi `__BOOTSTRAP__`, dan menyelesaikan tantangan *Proof-of-Work* SHA-256 di server.
2. Menukar solusi PoW dengan token otorisasi dan mengambil daftar stream video/audio.
3. Membungkus seluruh URL unduhan dengan proxy bertanda tangan HMAC (`/api/media`).

---

## Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Framework Full-Stack** | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) |
| **Frontend UI** | React 19, Custom CSS Editorial System (`src/styles.css`) |
| **Server Runtime** | Nitro (kompatibel penuh dengan Node.js, Vercel, Cloudflare, Docker) |
| **Build Tooling** | Vite 8 + TypeScript 5.8 (`strict: true`) |
| **HTML Parser** | Cheerio (ekstraksi struktur DOM YouTube & Instagram) |
| **Optional Microservice** | Go 1.22 (`services/downloader-go`) |

---

## Struktur Proyek

```text
.
├── public/                          # Aset statis (favicon, icon manifest, og-image)
├── services/
│   └── downloader-go/               # Microservice Go opsional (ekstraksi & pencarian TikTok)
│       ├── cmd/server/main.go       # HTTP server (:8090) dengan endpoint /health, /extract, /search
│       ├── internal/tiktok/         # Engine Mobile API, Web SSR, Slardar PoW solver, & Search
│       ├── Dockerfile
│       └── go.mod
├── src/
│   ├── components/
│   │   ├── preset-search-modal.tsx  # Modal pencarian 10+ preset via judul/kata kunci TikTok
│   │   ├── finder-result.tsx        # Tampilan hasil pemindaian link tunggal
│   │   ├── preset-row.tsx           # Baris item preset (5MB / XML)
│   │   ├── url-form.tsx             # Form input ganda (mendukung URL & kata kunci judul)
│   │   ├── recent-searches.tsx      # Riwayat pencarian di localStorage
│   │   ├── tiktok-result.tsx        # Hasil unduhan media TikTok
│   │   ├── aio-result.tsx           # Hasil unduhan media AIO
│   │   ├── media-downloads.tsx      # Tombol unduh video, HD, musik, dan slideshow
│   │   ├── media-meta.tsx           # Tabel metadata video & kreator
│   │   ├── video-box.tsx            # Pemutar video dengan fallback proxy otomatis
│   │   ├── header.tsx               # Navigasi utama & pengubah tema
│   │   └── theme-toggle.tsx         # Pengubah mode terang / gelap
│   ├── config/
│   │   ├── site.ts                  # Konfigurasi identitas situs, SEO, dan OpenGraph
│   │   └── settings.server.ts       # Konfigurasi server, batas cache, dan timeout
│   ├── hooks/
│   │   └── use-lookup.ts            # Custom hook request API dengan AbortController & timer
│   ├── lib/
│   │   ├── search-preset.server.ts  # Algoritma pencarian preset via judul TikTok (min. 10 preset)
│   │   ├── finder.server.ts         # Mesin utama pemindai deskripsi, bio, komentar, & shortlink
│   │   ├── preset.server.ts         # Orkestrator multi-platform & fallback
│   │   ├── fallback.server.ts       # Integrasi jalur cadangan (bintangapi & amfinder)
│   │   ├── find-social.server.ts    # Pemindai preset YouTube & Instagram
│   │   ├── youtube.server.ts        # Scraper Innertube komentar & video YouTube
│   │   ├── instagram.server.ts      # Scraper caption GraphQL & video Instagram
│   │   ├── tiktok.server.ts         # Pengunduh media TikTok (Go, TikWM, Page)
│   │   ├── tiktok-page.server.ts    # Resolver tautan pendek & embed TikTok
│   │   ├── aio.server.ts            # Scraper AIO dengan pemecah PoW SHA-256
│   │   ├── links.server.ts          # Klasifikasi URL (5MB, XML, Tree, Noise)
│   │   ├── sign.server.ts           # Tanda tangan HMAC-SHA256 untuk proxy media
│   │   ├── guard.server.ts          # Proteksi anti-bot & validasi origin request
│   │   ├── limit.server.ts          # Rate limiter berbasis IP di memori
│   │   ├── http.server.ts           # Utilitas HTTP client & worker pool (mapLimit)
│   │   └── types.ts                 # Kontrak tipe data TypeScript
│   ├── routes/
│   │   ├── __root.tsx               # Root shell, font, & JSON-LD
│   │   ├── index.tsx                # Halaman utama (Link Finder + Keyword Preset Modal)
│   │   ├── tiktok.tsx               # Halaman khusus pengunduh TikTok
│   │   ├── aio.tsx                  # Halaman khusus pengunduh AIO
│   │   └── api/
│   │       ├── search.ts            # GET /api/search (pencarian preset via judul)
│   │       ├── find.ts              # GET /api/find (pencarian preset via URL)
│   │       ├── tiktok.ts            # GET /api/tiktok (metadata & unduhan TikTok)
│   │       ├── aio.ts               # GET /api/aio (unduhan multi-platform)
│   │       └── media.ts             # GET /api/media (streaming proxy bertanda tangan)
│   ├── router.tsx
│   └── styles.css
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Memulai Cepat (Local Development)

### Prasyarat
- **Node.js** versi `22.x` atau lebih baru
- **npm** versi `10.x` atau lebih baru

### Instalasi

```bash
git clone https://github.com/NimzzAI/alight-motion-preset-finder.git
cd alight-motion-preset-finder
npm install
cp .env.example .env
```

Jalankan server pengembangan:

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`.

### Daftar Perintah NPM

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server pengembangan Vite + Nitro di port `3000` |
| `npm run build` | Mem-build aplikasi untuk produksi ke direktori `.output/` |
| `npm run preview` | Menjalankan hasil build produksi secara lokal di port `3000` |

---

## Konfigurasi & Environment Variables

Salin `.env.example` menjadi `.env` dan sesuaikan nilainya:

```ini
SIGN_SECRET=isi_dengan_string_acak_minimal_32_karakter
GO_SERVICE_URL=
API_SECRET=
RATE_LIMIT_PER_MINUTE=20
BOT_KEY=
GUARD_ENABLED=true
```

| Variabel | Wajib | Default | Penjelasan |
| :--- | :---: | :---: | :--- |
| `SIGN_SECRET` | **Ya** | `"ganti-lewat-env"` | Kunci rahasia HMAC-SHA256 untuk menandatangani URL proxy `/api/media`. Buat dengan `openssl rand -hex 32`. |
| `GO_SERVICE_URL` | Tidak | `""` | URL microservice Go opsional (contoh: `http://localhost:8090`). Jika kosong, sistem otomatis menggunakan jalur internal Node.js. |
| `API_SECRET` | Tidak | `""` | Token otentikasi bersama antara aplikasi utama dan microservice Go (dikirim melalui header `x-api-secret`). |
| `RATE_LIMIT_PER_MINUTE` | Tidak | `20` | Batas maksimum request API per alamat IP setiap menit. |
| `BOT_KEY` | Tidak | `""` | Kunci akses khusus untuk melewati guard anti-bot melalui header `x-am-key` (berguna untuk integrasi bot WhatsApp/Telegram/Discord). |
| `GUARD_ENABLED` | Tidak | `true` | Set ke `false` jika ingin menonaktifkan pemeriksaan `Sec-Fetch-Site` / `Referer` saat menguji endpoint dengan `curl` di lokal. |

---

## Dokumentasi API

Seluruh endpoint API mengembalikan format JSON standar:

```json
{
  "ok": true,
  "data": { ... }
}
```

Jika terjadi kesalahan:

```json
{
  "ok": false,
  "error": "Pesan penjelasan error"
}
```

> **Catatan Otorisasi Eksternal:** Jika memanggil API dari luar browser (misalnya melalui `curl` atau bot), sertakan header `-H "x-am-key: <BOT_KEY>"` atau atur `GUARD_ENABLED=false` di `.env`.

### `GET /api/search`

Mencari video/foto TikTok berdasarkan judul atau kata kunci preset, mengambil link VT-nya, dan mengekstrak minimal 10 preset unik beserta informasi VT asalnya.

**Parameter Query:**
- `q` *(wajib)*: Kata kunci atau judul preset (contoh: `preset elitis`).
- `variation` *(opsional)*: Angka variasi (`0`, `1`, `2`, dst.) untuk memutar offset pencarian dan mendapatkan kumpulan VT yang berbeda.
- `min` *(opsional)*: Target jumlah minimal preset unik (default: `10`, rentang: `10`–`25`).

**Contoh Request:**

```bash
curl -H "x-am-key: $BOT_KEY" \
  "http://localhost:3000/api/search?q=preset%20elitis&variation=0&min=10"
```

**Contoh Struktur `data` Respons:**

```json
{
  "query": "preset elitis",
  "effectiveQueries": [
    "preset elitis alight motion",
    "preset elitis 5mb xml"
  ],
  "variation": 0,
  "targetMin": 10,
  "totalPresets": 12,
  "totalVideosScanned": 8,
  "totalCandidatesFound": 26,
  "presets": [
    {
      "id": "7412345678901234567-1",
      "type": "5mb",
      "url": "https://alightcreative.com/am/share/u/...",
      "title": "PRESET ELITIS SLOWMO",
      "size": null,
      "thumb": "https://firebasestorage.googleapis.com/...",
      "source": "comment",
      "detail": "@creator_am",
      "byAuthor": true,
      "pinned": true,
      "vt": {
        "id": "7412345678901234567",
        "url": "https://www.tiktok.com/@creator_am/video/7412345678901234567",
        "kind": "video",
        "description": "Preset elitis cek komentar pin #alightmotion #preset",
        "cover": "https://...",
        "src": "https://...",
        "proxy": "/api/media?u=...&s=...",
        "images": [],
        "duration": 15,
        "views": 184200,
        "likes": 21500,
        "comments": 340,
        "author": {
          "username": "creator_am",
          "nickname": "Creator AM",
          "avatar": "https://..."
        }
      }
    }
  ],
  "videos": [
    {
      "vt": { "...": "..." },
      "presets": [ { "...": "..." } ],
      "scannedComments": 50
    }
  ],
  "timestamp": 1760835000000
}
```

### `GET /api/find`

Memindai satu tautan video TikTok, YouTube, atau Instagram untuk mengekstrak seluruh preset yang ada di dalamnya.

```bash
curl -H "x-am-key: $BOT_KEY" \
  "http://localhost:3000/api/find?url=https://vt.tiktok.com/ZS..."
```

### `GET /api/tiktok`

Mengambil tautan unduhan video tanpa watermark, musik, foto slideshow, serta statistik video dan profil TikTok.

```bash
curl -H "x-am-key: $BOT_KEY" \
  "http://localhost:3000/api/tiktok?url=https://www.tiktok.com/@user/video/1234567890123456789"
```

### `GET /api/aio`

Mengambil daftar stream video dan audio multi-resolusi dari URL platform yang didukung.

```bash
curl -H "x-am-key: $BOT_KEY" \
  "http://localhost:3000/api/aio?url=https://www.youtube.com/watch?v=..."
```

### `GET /api/media`

Endpoint proxy streaming bertanda tangan HMAC-SHA256 (`?u=<encoded_url>&s=<hmac_signature>&name=<filename>`). Mendukung header `Range` untuk *video seeking*.

---

## Microservice Go (`services/downloader-go`)

Pencarian TikTok (`TikTokSearchEngine`) dibangun menggunakan **Golang** di dalam `services/downloader-go` dengan arsitektur:
- **Headless Browser Search (`chromedp` + `goquery`)**: Membuka halaman pencarian TikTok (`https://www.tiktok.com/search?q=`), melewati deteksi otomasi (`navigator.webdriver` stealth patch), dan mengekstrak kartu video maupun slideshow foto (`div[data-e2e='search_top-item']`).
- **Concurrent Worker Enrichment (`sync.WaitGroup` + Semaphore 5)**: Memperkaya setiap link VT secara paralel melalui **TikTok Mobile Feed API (`api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/`)** menggunakan `tidwall/gjson` serta **Web SSR Fallback** yang dilengkapi pemecah tantangan kriptografi **Slardar SHA-256 Proof-of-Work (`solveSlardarChallenge`)**.

### Menjalankan HTTP Server Go (`:8090`)

```bash
cd services/downloader-go
go mod tidy
go run ./cmd/server
```

### Menjalankan CLI Pencarian Langsung

```bash
cd services/downloader-go
go run ./cmd/search "preset elitis"
```

### Menjalankan dengan Docker (Sudah Termasuk Headless Chromium)

```bash
cd services/downloader-go
docker build -t downloader-go .
docker run -d -p 8090:8090 -e API_SECRET=rahasia_internal downloader-go
```

### Endpoint Service Go

| Metode & Path | Parameter / Body | Fungsi |
| :--- | :--- | :--- |
| `GET /health` | `-` | Pemeriksaan status hidup service |
| `POST /extract` | `{ "url": "https://www.tiktok.com/..." }` | Mengekstrak metadata, video tanpa watermark, & foto slideshow |
| `POST /search` | `{ "keyword": "preset elitis", "count": 15 }` | Mencari VT video/foto TikTok via `TikTokSearchEngine` (Golang) |
| `GET /search` | `?q=preset+elitis&count=15` | Mencari VT video/foto TikTok via query parameter |

---

## Keamanan & Rate Limiting

- **HMAC-SHA256 Signed Media Proxy:** Setiap URL di `/api/media` diverifikasi menggunakan `crypto.timingSafeEqual`. Mencegah penyalahgunaan server sebagai *open proxy*.
- **SSRF Protection:** Memblokir skema non-HTTPS, `localhost`, alamat IP mentah (IPv4/IPv6), dan domain internal (`.local`, `.internal`).
- **Anti-Bot Guard:** Memeriksa `User-Agent`, `Sec-Fetch-Site`, `Origin`, dan `Referer` untuk menolak *automated scraping* liar, sembari menyediakan jalur resmi lewat header `x-am-key` (`BOT_KEY`).
- **Per-IP Rate Limiting:** Membatasi frekuensi permintaan per menit untuk menjaga stabilitas upstream.

---

## Deployment

### Deploy ke Vercel
1. Push repositori ke GitHub dan impor proyek ke Vercel.
2. Pilih preset **Nitro** dengan Root Directory `./`.
3. Tambahkan environment variable `SIGN_SECRET` (dan `BOT_KEY` bila diperlukan).
4. Klik **Deploy**. Setelah domain aktif, perbarui properti `url` di `src/config/site.ts` agar canonical URL, `sitemap.xml`, dan `og:image` mengarah ke domain produksi.

### Deploy ke VPS / Node.js Server / Docker
```bash
npm run build
node .output/server/index.mjs
```

---

## Troubleshooting

| Gejala / Pesan Error | Penyebab & Solusi |
| :--- | :--- |
| `Akses ditolak.` (HTTP 403) saat uji `curl` | Guard anti-bot aktif. Kirim header `-H "x-am-key: $BOT_KEY"` atau set `GUARD_ENABLED=false` di `.env` lokal. |
| `bad signature` pada `/api/media` | Nilai `SIGN_SECRET` berubah atau URL terpotong. Lakukan pencarian ulang untuk mendapatkan URL bertanda tangan baru. |
| Hasil pencarian judul kurang dari 10 preset | Sebagian kreator tidak menyertakan tautan yang dapat dibaca publik. Klik tombol **Acak Variasi VT** untuk memindai kumpulan video TikTok yang berbeda. |
| Ekstraksi TikTok gagal di IP datacenter | Pasang dan jalankan `services/downloader-go` pada VPS/instance terpisah, lalu hubungkan melalui `GO_SERVICE_URL`. |

---

## Kredit & Lisensi

- Dirancang dan dikembangkan oleh **Nimzz**.
- Proyek ini dibuat untuk tujuan edukasi dan kemudahan komunitas kreator. Seluruh hak cipta preset dan karya video tetap menjadi milik masing-masing kreator asli di TikTok, YouTube, Instagram, dan Alight Motion.