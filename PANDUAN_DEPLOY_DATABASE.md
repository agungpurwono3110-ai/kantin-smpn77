# 🚀 PANDUAN DEPLOY DATABASE & SERVER KANTIN SMPN 77
### Dari Komputer Lokal Sampai Online (Cloud Hosting)

Aplikasi **SISTEM KANTIN SMPN 77** kini telah dilengkapi dengan:
- **Backend API Server**: Node.js & Express (`server.js`)
- **Database Relasional**: SQLite terpusat (`kantin77.db`)
- **Kontainer Docker**: `Dockerfile`
- **Konfigurasi Cloud**: `render.yaml`
- **File Eksekusi Otomatis**: `jalankan-kantin-server.bat`

Anda memiliki **2 pilihan cara deploy** sesuai kebutuhan operasional sekolah:
1. **Opsi A (Online Cloud)**: Dapat diakses dari mana saja melalui HP/Laptop via internet (Gratis di Render.com).
2. **Opsi B (Lokal Sekolah)**: Berjalan di server/laptop kantin via Wi-Fi sekolah tanpa perlu kuota internet.

---

## 🌐 OPSI A: DEPLOY GRATIS KE CLOUD (RENDER.COM)
*(Rekomendasi: Agar kantin bisa diakses kapan saja dari HP Android karyawan, bendahara, dan kepala sekolah di mana pun berada)*

### Langkah 1: Siapkan Akun GitHub
1. Buka [github.com](https://github.com) dan buat akun (gratis) jika belum punya.
2. Buat repository baru dengan nama **`kantin-smpn77`**.
3. Unggah (*upload*) seluruh file dari folder `TOKO KANTIN 77` ke repository tersebut.

### Langkah 2: Hubungkan ke Render.com
1. Buka [render.com](https://render.com) dan daftar menggunakan akun GitHub Anda.
2. Pada dashboard Render, klik tombol **New +** $\rightarrow$ pilih **Web Service**.
3. Pilih repository **`kantin-smpn77`** yang telah Anda buat di GitHub.
4. Isi form pengaturan:
   - **Name**: `kantin-smpn77`
   - **Region**: `Singapore (Southeast Asia)` *(paling cepat untuk Indonesia)*
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. *(Opsional untuk persistensi data SQLite permanen)*:
   - Gulir ke bawah ke bagian **Advanced** $\rightarrow$ klik **Add Disk**.
   - Name: `kantin-data`
   - Mount Path: `/app/data`
   - Size: `1 GB` (lebih dari cukup untuk puluhan ribu transaksi).
   - Tambahkan Environment Variable: Key `DB_PATH`, Value `/app/data/kantin77.db`.
6. Klik **Create Web Service**.

### Langkah 3: Selesai & Aplikasi Siap Diakses!
- Tunggu proses deploy sekitar 2-3 menit hingga muncul status **Live**.
- Render akan memberikan alamat website resmi Anda, misalnya:  
  👉 **`https://kantin-smpn77.onrender.com`**
- Buka tautan tersebut dari browser HP Android karyawan, tablet kasir, atau laptop bendahara. Seluruh data transaksi, penjualan, dan stok otomatis tersimpan di database cloud terpusat!

---

## 🏫 OPSI B: DEPLOY DI JARINGAN LOKAL SMPN 77 (SERVER SEKOLAH)
*(Rekomendasi: Jika ingin beroperasi secara offline/lokal tanpa bergantung pada koneksi internet luar)*

### Langkah 1: Pastikan Komputer Server Memiliki Node.js
1. Unduh dan instal Node.js versi LTS dari situs resminya: [nodejs.org](https://nodejs.org) (klik *Next* sampai selesai).

### Langkah 2: Menjalankan Server Kantin
1. Buka folder `TOKO KANTIN 77`.
2. Klik dua kali file [**`jalankan-kantin-server.bat`**](file:///c:/Users/SMPN77_SERV1/Documents/FILE%20AGUNG/TOKO%20KANTIN%2077/jalankan-kantin-server.bat).
3. Jendela hitam command prompt akan otomatis:
   - Mengunduh paket modul sistem.
   - Menghidupkan server database SQLite (`kantin77.db`).
   - Membuka halaman kasir di browser Anda secara otomatis di alamat:  
     👉 `http://localhost:3000`

### Langkah 3: Mengakses dari HP Android Karyawan (Layar Sentuh Kasir)
1. Sambungkan HP Android karyawan ke **Wi-Fi sekolah yang sama** dengan komputer server.
2. Cari tahu nomor IP komputer server:
   - Buka Command Prompt di komputer, ketik `ipconfig` lalu tekan Enter.
   - Lihat angka pada **IPv4 Address** (contoh: `192.168.1.15`).
3. Di browser Chrome HP Android karyawan, buka alamat:
   👉 `http://192.168.1.15:3000`
4. Tekan tombol titik tiga $(\vdots)$ di Chrome HP $\rightarrow$ pilih **"Tambahkan ke Layar Utama" (Add to Home screen)**.
5. Sekarang karyawan dapat mencatat penjualan langsung dari genggaman HP Android dan data langsung masuk secara real-time ke komputer server sekolah!

---

## 🗄️ STRUKTUR TABEL DATABASE SQLITE (`kantin77.db`)

Database SQLite dibuat secara relasional dan otomatis terbuat saat server pertama kali dijalankan:

| Nama Tabel | Deskripsi Data |
|---|---|
| **`users`** | Data akun admin/karyawan, username, password/PIN, role. |
| **`products`** | Master produk: kode, nama, kategori, harga modal, harga jual, stok minimum, stok tersedia, satuan, foto. |
| **`transactions`** | Header penjualan harian kasir: nomor transaksi, tanggal, waktu, total, HPP, keuntungan, metode bayar, status. |
| **`transaction_items`** | Rincian per barang dalam setiap transaksi nota penjualan. |
| **`restocks`** | Riwayat pembelian stok masuk dari supplier/distributor. |
| **`suppliers`** | Data distributor/agen: nama, kontak telepon/WA, alamat. |
| **`debts`** | Catatan hutang pembelian tempo ke supplier & jatuh tempo. |
| **`debt_payments`** | Riwayat cicilan atau pelunasan hutang ke supplier. |
| **`expenses`** | Pengeluaran operasional (plastik, es batu, kebersihan, dll). |
| **`cash_mutations`** | Buku kas mutasi uang masuk dan keluar secara kronologis. |
| **`stock_opnames`** | Sesi stok opname fisik setelah istirahat kedua selesai. |
| **`stock_opname_items`** | Selisih stok sistem vs fisik real per produk beserta alasan selisih. |
| **`daily_closures`** | Arsip penguncian buku tutup harian (omzet, HPP, laba bersih). |
| **`settings`** | Pengaturan nama kantin, sekolah, footer struk, modal kas awal. |

---

## 🔄 KEUNGGULAN SISTEM DUA JALUR (HYBRID)

Aplikasi dirancang cerdas dengan arsitektur **Hybrid**:
- **Saat Server/Cloud Aktif**: Badge di bagian atas akan otomatis berwarna hijau:  
  **`🟢 SQLite Terpusat (Online)`**  
  Seluruh perangkat membaca dan menulis ke database server yang sama secara langsung.
- **Saat Tanpa Server / Internet Terputus**: Badge akan berwarna biru:  
  **`🔵 Mode Offline (Lokal)`**  
  Aplikasi tetap berjalan normal menggunakan database IndexedDB internal peramban, sehingga kasir tidak akan pernah macet meskipun listrik padam atau koneksi internet sekolah terputus!

---
*Kantin SMP Negeri 77 Jakarta &bull; Solusi Kasir Digital Modern & Tangguh*
