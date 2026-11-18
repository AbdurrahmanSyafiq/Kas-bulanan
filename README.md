# Kas Bulanan

Dashboard satu halaman untuk mencatat pengeluaran dari gajian ke gajian (periode tanggal 10 sampai tanggal 9). Dibuat dengan Next.js 16.

Yang ada di halaman:

- **Sisa budget** keseluruhan, plus perbandingan budget terpakai dengan hari yang sudah berjalan.
- **Menunggu kategori**: transaksi QRIS yang masuk dari email. Kamu pilih kategorinya sendiri, baru setelah itu dihitung ke budget.
- **Catat pengeluaran** manual.
- **Sisa per kategori**, dikelompokkan, dengan tombol untuk mengubah budget.
- **Limit makan harian**: Makan & Minum maksimal Rp50.000 per hari. Kelebihannya otomatis dicatat ke Keinginan.
- **Potongan otomatis** ongkos TransJakarta Rp10.500 tiap hari kerja (Sabtu dan Minggu tidak dipotong).
- Grafik pengeluaran per hari dan daftar transaksi periode ini.

Tidak ada login, sidebar, atau halaman lain.

## Menjalankan di komputer

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Data tersimpan di `data/db.json` dan dibuat otomatis saat pertama dibuka (isi awalnya ada di `lib/seed.ts`). Hapus file itu kalau mau mulai dari awal.

Untuk mencoba penerimaan email QRIS di komputer sendiri:

```bash
QRIS_API_SECRET=rahasia-panjang npm run dev
```

```bash
curl -X POST http://localhost:3000/api/qris \
  -H "x-api-key: rahasia-panjang" -H "Content-Type: application/json" \
  -d '{"messageId":"tes-1","amount":20000,"merchant":"WARUNG MAKAN","paidAt":"2026-11-16T01:09:20.000Z"}'
```

## Penyimpanan data

Di Vercel filesystem tidak bisa dipakai untuk menyimpan data, jadi dashboard memakai Upstash Redis (ada paket gratis).

1. Di Vercel: **Storage** lalu tambahkan **Upstash Redis** ke proyek ini.
2. Pastikan environment variable `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` terisi (nama `KV_REST_API_URL` dan `KV_REST_API_TOKEN` juga dikenali).
3. Tambahkan `QRIS_API_SECRET` berisi teks acak yang panjang.
4. Deploy ulang.

Kalau dua variabel Upstash belum ada, halaman akan menampilkan pesan yang menjelaskan apa yang kurang.

## Menyambungkan email QRIS

Google Apps Script (`../apps-script/Code.gs`) membaca email dari BYOND by BSI lalu mengirimnya ke `POST /api/qris`. Di bagian `CONFIG` pada script:

- `ENDPOINT_URL`: `https://alamat-aplikasimu.vercel.app/api/qris`
- `API_SECRET`: sama persis dengan `QRIS_API_SECRET` di server

Lalu jalankan `setupTrigger` sekali supaya email dicek tiap 10 menit.

Data yang diterima endpoint: `messageId`, `amount`, `merchant`, `location`, `transactionNo`, `paidAt`. Email yang sama dikirim dua kali tetap hanya tercatat sekali.

## Catatan keamanan

Dashboard ini tidak punya login. Siapa pun yang tahu alamatnya bisa melihat dan mengubah datanya. Sebelum dipakai di internet, batasi aksesnya (misalnya lewat proteksi akses di Vercel) atau minta ditambahkan login sederhana. Endpoint `/api/qris` sendiri sudah dilindungi `QRIS_API_SECRET`.

## Struktur

```
app/page.tsx            halaman tunggal
app/api/dashboard       baca dan ubah data dari halaman
app/api/qris            penerima email QRIS dari Apps Script
components/dashboard    bagian-bagian halaman
lib/finance.ts          aturan hitungan (limit harian, potongan otomatis, periode)
lib/finance.test.ts     tes untuk aturan di atas (npm test)
lib/seed.ts             kategori dan budget awal
lib/store.ts            penyimpanan (file lokal / Upstash Redis)
```
