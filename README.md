# Microstock Checker

Microstock Checker adalah sebuah aplikasi (monorepo) yang berfungsi sebagai validator aset microstock untuk format file SVG, EPS, dan JPG. Aplikasi ini memiliki bagian backend berbasis Express dan antarmuka pengguna (frontend) menggunakan React + Vite. Selain itu, aplikasi juga menggunakan sistem antrean (BullMQ + Redis) untuk memproses file dan dapat memanfaatkan AI (Gemini/OpenAI) untuk validasi lebih lanjut.

## 📋 Persyaratan Sistem

Sebelum menginstal aplikasi ini, pastikan Anda telah menginstal beberapa perangkat lunak berikut:

- **Node.js** (Versi 18+ disarankan)
- **Redis Server** (Harus berjalan di latar belakang untuk sistem antrean)
- **API Key Gemini** atau **OpenAI** (Untuk fitur validasi AI)

## 🚀 Cara Instalasi

1. **Kloning atau buka repositori ini** di mesin lokal Anda.
2. **Instal dependensi** untuk seluruh proyek (termasuk backend dan frontend) dengan menjalankan perintah berikut di direktori root:

```bash
npm run install:all
# atau cukup jalankan:
# npm install
```

## ⚙️ Konfigurasi (Backend)

Aplikasi membutuhkan konfigurasi environment (lingkungan) untuk backend agar dapat terhubung dengan Redis dan layanan AI.

1. Masuk ke folder `backend/`:
   ```bash
   cd backend
   ```
2. Buat file `.env` dengan menyalin template dari `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Buka file `.env` dan konfigurasikan nilainya, terutama untuk API Key:
   ```env
   PORT=3001
   REDIS_HOST=localhost
   REDIS_PORT=6379
   UPLOAD_DIR=./uploads
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash
   OPENAI_API_KEY=optional_openai_key_here
   AI_PROVIDER=gemini
   AI_DAILY_LIMIT=500
   ```

*Pastikan Redis server Anda sudah berjalan di `localhost:6379` atau sesuaikan konfigurasinya dengan environment Anda.*

## 💻 Penggunaan & Menjalankan Aplikasi

Anda dapat menjalankan semua layanan (Backend, Queue Worker, dan Frontend) secara serentak dari direktori root.

1. Buka terminal di direktori root (`microstock-checker/`).
2. Jalankan perintah berikut:

```bash
npm run dev
```

Perintah di atas menggunakan `concurrently` untuk menjalankan 3 proses sekaligus:
- `backend` server (berjalan di port yang disetel, default 3001)
- `worker` (memproses antrean validasi dari Redis)
- `frontend` server (Vite dev server, biasanya berjalan di port 5173)

Buka URL frontend yang muncul di terminal (contoh: `http://localhost:5173`) untuk mulai menggunakan Microstock Checker.
