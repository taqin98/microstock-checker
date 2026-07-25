# Microstock Checker

Microstock Checker adalah aplikasi monorepo untuk memeriksa aset SVG, EPS, dan JPG sebelum dikirim ke platform microstock. Sistem mencakup validasi teknis, analisis Gemini, ekstraksi metadata XMP EPS, preview Illustrator, pairing EPS/JPG, pengaturan kategori, serta ekspor CSV Shutterstock dan Adobe Stock.

## Dokumentasi

- [Dokumentasi teknis backend dan frontend](docs/technical-documentation.md)

## Persyaratan utama

- Node.js 24 direkomendasikan.
- Redis Server.
- Gemini API key untuk analisis AI.
- macOS dan Adobe Illustrator untuk pemeriksaan EPS.

## Instalasi

```bash
npm install
cp backend/.env.example backend/.env
```

Isi minimal `backend/.env`:

```env
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
UPLOAD_DIR=./uploads
GEMINI_API_KEY=replace_with_real_key
GEMINI_MODEL=gemini-3.5-flash
AI_DAILY_LIMIT=500
```

## Menjalankan aplikasi

Pastikan Redis aktif, kemudian jalankan:

```bash
npm run dev
```

Layanan yang dijalankan:

- Express API, default `http://localhost:3001`;
- BullMQ worker;
- Vite frontend, biasanya `http://localhost:5173`.

## Verifikasi

```bash
node --test backend/__tests__/*.test.js frontend/src/utils/shutterstockCsv.test.js
npm run lint -w frontend
npm run build -w frontend
```
