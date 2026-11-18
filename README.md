# 🔍 Sherlock Web - OSINT Username Reconnaissance

Aplikasi antarmuka web modern untuk **Sherlock** (tool OSINT populer pelacak jejak *username* di 480+ platform media sosial dan situs web). Didesain agar siapa pun dapat melakukan investigasi digital langsung dari browser dengan mudah dan cepat.

---

## ⚡ Fitur Utama

- **🚀 Real-Time Live Streaming (SSE):** Hasil pencarian muncul seketika secara *live* detik demi detik tanpa perlu menunggu semua 480+ situs selesai dipindai.
- **🎯 Kategori & Preset Cepat:**
  - **⚡ Populer (Top 35):** Scan kilat (~3–5 detik) untuk platform utama (GitHub, Instagram, Twitter/X, TikTok, Reddit, YouTube, Telegram, Spotify, Steam, dll.).
  - **🌐 Semua Situs (480+):** Full reconnaissance scan menyeluruh ke seluruh database Sherlock.
  - **💻 Developer & Tech:** Fokus pada platform coding & komunitas developer (GitHub, GitLab, DEV Community, Docker Hub, LeetCode, NPM, PyPi, dll.).
  - **💬 Media Sosial:** Instagram, Twitter, TikTok, Reddit, Telegram, Pinterest, Snapchat, dll.
  - **🎨 Kreatif & Media:** YouTube, Spotify, SoundCloud, Behance, Dribbble, Medium, Substack, dll.
  - **🎮 Gaming:** Steam, Twitch, Roblox, Chess.com, dll.
- **📊 Telemetri & Metrik Langsung:**
  - Persentase progress bar interaktif.
  - Penghitung total akun ditemukan, tidak ditemukan, dan terproteksi (WAF / bot shield).
  - Waktu berlalu (*elapsed time*) dan kecepatan scan (*requests per second*).
- **🔍 Filter & Pencarian Instan:**
  - Filter tab: *Semua*, *Ditemukan Saja*, *Tidak Ada*, *WAF / Error*.
  - Kolom pencarian instan untuk menyaring platform tertentu secara langsung.
- **👁️ Pilihan Tampilan:**
  - **Tampilan Grid Kartu:** Kartu interaktif dengan status badge, latency, dan tombol aksi langsung (*Open ↗*, *Copy*).
  - **Tampilan Tabel:** Format tabel data profesional untuk audit komprehensif.
- **💾 Ekspor Data Lengkap:**
  - 📋 Salin semua tautan aktif ke clipboard.
  - 📄 Unduh file JSON (data lengkap dengan timestamp dan telemetri).
  - 📊 Unduh file CSV (cocok untuk analisis spreadsheet/Excel).
  - 📝 Unduh file TXT ringkas.
- **🌓 Mode Gelap / Terang (Dark & Light Mode):**
  - Desain high-contrast yang nyaman di mata dengan persistensi otomatis di browser.

---

## 🚀 Cara Menjalankan

### 1. Jalankan Server Web

Buka terminal di dalam folder proyek ini:

```bash
python3 run_web.py
```
*atau menggunakan script launcher:*
```bash
./start_web.sh
```

### 2. Buka di Browser

Akses URL berikut:
```
http://127.0.0.1:5000
```

---

## 📁 Struktur Direktori

```text
sherlock-web/
├── run_web.py                  # Entrypoint utama server Flask
├── start_web.sh                # Script bash launcher
├── web/
│   ├── app.py                  # Flask REST API & SSE router
│   ├── scanner.py              # Engine scanner asinkron & multithreaded SSE
│   ├── templates/
│   │   └── index.html          # UI Dashboard tunggal yang responsif
│   └── static/
│       ├── css/
│       │   └── style.css       # Styling kustom (desain OSINT, no-slop)
│       └── js/
│           └── app.js          # EventSource client, filter, dan eksportir
└── sherlock_project/           # Core Sherlock OSINT library & resources
    └── resources/
        └── data.json           # Basis data 481+ situs Sherlock
```

---

## ⚖️ Etika & Disclaimer

Alat ini dibuat untuk keperluan investigasi legal, riset jejak digital pribadi (*self-footprint check*), audit keamanan informasi, dan edukasi OSINT (*Open Source Intelligence*). Gunakan dengan bijak dan patuhi hukum serta ketentuan layanan platform terkait.
