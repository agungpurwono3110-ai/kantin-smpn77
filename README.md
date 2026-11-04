# SISTEM MANAJEMEN & KASIR KANTIN SMPN 77

Aplikasi web profesional, mandiri (*standalone*), dan otomatis untuk mengelola operasional kantin sekolah **SMP Negeri 77 Jakarta** yang menjual aneka minuman kemasan botol dan makanan ringan (*snack*).

Aplikasi dirancang khusus agar sangat mudah digunakan oleh **1 orang karyawan kantin**, dapat diakses langsung dari **HP Android**, **tablet**, maupun **laptop/komputer kasir**, tanpa ketergantungan server luar yang rumit. Seluruh data tersimpan secara permanen di database lokal peramban (*IndexedDB*), aman, konsisten, dan dilengkapi fitur **Backup & Restore**.

---

## 📋 DAFTAR ISI
1. [Fitur & Keunggulan Utama](#-fitur--keunggulan-utama)
2. [Alur Operasional Harian Karyawan](#-alur-operasional-harian-karyawan)
3. [Panduan Menjalankan Aplikasi](#-panduan-menjalankan-aplikasi)
4. [Akun Login & Keamanan](#-akun-login--keamanan)
5. [Panduan Penggunaan Setiap Menu](#-panduan-penggunaan-setiap-menu)
6. [Rumus & Ketentuan Akuntansi](#-rumus--ketentuan-akuntansi)
7. [Cadangan Data (Backup & Restore)](#-cadangan-data-backup--restore)

---

## 🌟 FITUR & KEUNGGULAN UTAMA

1. **Dashboard Eksekutif Real-Time**:
   - Kartu metrik dengan 5 warna standar: **Biru** (Omzet), **Hijau** (Keuntungan Bersih & Kotor), **Merah** (Pengeluaran Operasional), **Oranye** (Stok Barang), **Ungu** (Jumlah Transaksi).
   - Grafik tren penjualan & laba 7 hari terakhir.
   - Peringatan dini stok menipis dan habis.
   - Pemantauan uang fisik di laci kasir secara langsung.

2. **Penjualan Harian (Kasir POS Terpadu)**:
   - Menggabungkan transaksi **Istirahat Pertama** dan **Istirahat Kedua** menjadi satu penjualan harian (tidak perlu repot ganti shift/menu).
   - Tampilan tombol produk layar sentuh besar (*touch-friendly*) yang sangat nyaman digunakan melalui HP Android.
   - Pilihan metode bayar: **Tunai (Cash)** dengan tombol hitung uang cepat & kembalian otomatis, atau **Non-Tunai (QRIS / Rekening Sekolah)**.
   - Otomatis memotong stok, menambah omzet, menghitung HPP & laba, dan mencatat mutasi kas.
   - Fitur cetak struk belanja format thermal (*58mm / 80mm*).
   - Pembatalan transaksi aman disertai alasan dan pengembalian stok otomatis.

3. **Stok Opname Khusus Usai Istirahat Kedua**:
   - Dilakukan 1 kali sehari setelah istirahat kedua selesai.
   - Menghitung selisih antara hitungan fisik dan stok sistem secara otomatis.
   - Pilihan alasan selisih (*Barang rusak, Barang hilang, Kesalahan pencatatan, Barang diberikan gratis, dll*).
   - Fitur **Tutup Transaksi Harian**: Mengunci pembukuan hari tersebut, menyimpan laporan laba rugi permanen, dan menjadikan stok fisik akhir sebagai stok awal hari berikutnya secara otomatis.

4. **Kas Harian & Pengeluaran Operasional**:
   - Pemisahan uang tunai di laci dan saldo non-tunai (QRIS).
   - Pencatatan biaya operasional (*plastik, transportasi belanja, kebersihan, dll*).

5. **Restock Pembelian & Hutang Supplier**:
   - Pembelian barang masuk tunai otomatis memotong kas.
   - Pembelian tempo otomatis masuk ke tagihan hutang supplier dengan jatuh tempo.

6. **Laporan & Ekspor Lengkap**:
   - Laporan Laba Rugi komprehensif (Omzet, HPP, Laba Kotor, Beban Ops, Laba Bersih).
   - Rekap produk terlaris, produk kurang laku, minuman terlaris, snack terlaris.
   - Ekspor data ke **Excel (.xlsx)** dan cetak format cetak rapi.
   - Backup database penuh ke file **JSON** kapan saja.

---

## 🕒 ALUR OPERASIONAL HARIAN KARYAWAN

```
[06.30 Pagi]
1. Karyawan Buka Aplikasi di HP/Laptop -> Login -> Periksa Saldo Awal Kas (Laci)
   ↓
[09.30 - 10.00: Istirahat Pertama]
2. Buka Menu "Penjualan Harian" -> Layani siswa -> Masukkan pesanan & Simpan transaksi
   ↓
[12.00 - 12.30: Istirahat Kedua]
3. Lanjutkan pencatatan di Menu "Penjualan Harian" yang sama (Otomatis terakumulasi)
   ↓
[13.00 Siang: Selesai Operasional]
4. Buka Menu "Stok Opname (Istirahat 2)"
5. Hitung fisik sisa barang di etalase -> Masukkan ke kolom "Stok Fisik Real"
6. Sistem memeriksa selisih -> Pilih keterangan bila ada selisih
7. Buka Menu "Kas Harian" -> Cocokkan uang fisik di laci kasir dengan "Saldo Kas Akhir"
8. Tekan tombol "KONFIRMASI & TUTUP HARIAN" di menu Stok Opname
   ↓
[Selesai]
9. Transaksi harian terkunci rapi, stok fisik otomatis menjadi stok awal esok hari!
```

---

## 🚀 PANDUAN MENJALANKAN APLIKASI

Aplikasi dibuat dengan teknologi standar web murni (HTML5, CSS3, JavaScript, Bootstrap 5, IndexedDB) sehingga:
- **Dapat langsung dibuka**: Cukup klik dua kali (*double click*) file `index.html` pada browser modern (Google Chrome, Microsoft Edge, Mozilla Firefox, atau Opera).
- **Penggunaan di HP Android**:
  - Salin folder `TOKO KANTIN 77` ke HP atau buka melalui peramban web HP Android.
  - Atau sambungkan HP dan laptop ke jaringan Wi-Fi sekolah yang sama untuk mengaksesnya secara nirkabel.
- Seluruh data tersimpan di penyimpanan lokal browser perangkat Anda dan **TIDAK AKAN HILANG** saat tab atau browser ditutup.

---

## 🔐 AKUN LOGIN & KEAMANAN

Untuk memudahkan 1 orang karyawan kantin:
- **Username Default**: `admin`
- **PIN / Password Default**: `123456`

> **Catatan**: Anda dapat mengganti PIN atau nama petugas kapan saja melalui menu **16. Pengaturan Akun**.

---

## 📖 PANDUAN PENGGUNAAN SETIAP MENU

### 1. Dashboard Utama
Menampilkan ringkasan seluruh performa kantin hari ini dalam satu layar. Kartu metrik otomatis diperbarui setiap kali ada transaksi baru tanpa perlu memuat ulang halaman (*real-time*).

### 2. Penjualan Harian (Kasir POS)
- **Cari Produk**: Ketik nama/kode barang atau sentuh tab kategori di bagian atas.
- **Tambah Pesanan**: Sentuh kartu produk. Jumlah barang di keranjang otomatis bertambah.
- **Ubah Jumlah**: Gunakan tombol `+` dan `-` pada keranjang belanja.
- **Bayar**: Tekan tombol besar **PROSES PEMBAYARAN (F8)**.
- **Pilih Pembayaran**:
  - *Tunai*: Masukkan nominal uang yang diterima siswa atau gunakan tombol uang cepat (Pas, 5.000, 10.000, 20.000, dll). Kembalian dihitung otomatis.
  - *Non-Tunai*: Pilih opsi QRIS untuk pembayaran digital sekolah.
- **Cetak Struk**: Klik tombol **SIMPAN & CETAK STRUK** untuk mencetak ke printer struk bluetooth/thermal atau cukup tampilkan struk digital.

### 3. Rekap Penjualan
Melihat rincian setiap barang yang terjual hari ini beserta perolehan omzet dan keuntungan. Menampilkan otomatis produk paling laris, produk kurang laku, minuman terlaris, dan snack terlaris.

### 4. Master Produk
Mengelola katalog barang jualan:
- Tambah produk baru beserta harga modal dan harga jual (keuntungan/margin dihitung otomatis).
- Unggah foto produk agar kasir mudah mengenali barang.
- Atur batas **Stok Minimum** untuk memicu peringatan otomatis saat stok menipis.
- Fitur **Export Excel** dan **Import Excel** untuk memperbarui data dalam jumlah banyak sekaligus.

### 5. Stok Barang
Memantau persediaan fisik barang secara transparan:
- Menampilkan rumus: `Stok Tersedia = Stok Awal + Barang Masuk - Total Terjual`.
- Status stok otomatis: **Aman** (Hijau), **Hampir Habis** (Kuning), atau **Habis** (Merah).
- Barang yang habis otomatis dinonaktifkan di kasir agar tidak terjadi selisih stok negatif.

### 6. Barang Masuk / Restock
Mencatat pembelian atau pengiriman barang dari distributor:
- Setiap barang masuk otomatis menambah stok di sistem.
- Jika dibayar **Tunai**, sistem otomatis memotong saldo kas harian.
- Jika dibayar **Tempo**, sistem otomatis mencatat tagihan ke menu **Hutang Supplier**.

### 7. Stok Opname (Setelah Istirahat Kedua)
Fitur inti kontrol persediaan:
- Isi jumlah barang fisik yang sebenarnya tersisa di etalase.
- Sistem otomatis menghitung `Selisih = Stok Fisik - Stok Sistem`.
- Bila ada selisih, pilih alasan (*Barang rusak, Barang hilang, Kesalahan pencatatan, dll*).
- Tekan **KONFIRMASI & TUTUP HARIAN** untuk mengunci operasional hari ini.

### 8. Kas Harian
Mencatat buku kas masuk dan keluar secara terperinci. Menghitung saldo uang fisik yang wajib ada di laci kasir saat toko tutup.

### 9. Pengeluaran Operasional
Mencatat beban operasional harian kantin:
- Kategori: Transportasi belanja, Biaya kantong plastik, Kebersihan kantin, Perlengkapan, dan Biaya lainnya.
- Pengeluaran ini otomatis menjadi pengurang laba bersih di laporan laba rugi.

### 10. Hutang Supplier
Mencatat daftar faktur pembelian tempo ke agen/distributor. Tombol **Bayar** akan mencatat cicilan/pelunasan dan otomatis memotong saldo kas tunai kantin.

### 11. Data Supplier
Menyimpan kontak telepon/WhatsApp, alamat, dan riwayat distributor minuman botol serta grosir makanan ringan.

### 12. Laporan Keuntungan (Laba Rugi)
Laporan laba rugi otomatis dengan standar akuntansi kantin:
- Menghitung HPP berdasarkan barang yang benar-benar terjual.
- Dapat difilter: Hari Ini, 7 Hari Terakhir, Bulan Ini, atau Rentang Tanggal Khusus.

### 13. Riwayat Transaksi
Daftar seluruh transaksi yang pernah dilakukan. Kasir dapat melihat rincian nota, mencetak ulang struk (*reprint*), atau melakukan **Pembatalan Transaksi** jika terjadi kesalahan input kasir (stok barang otomatis dikembalikan ke etalase).

### 14. Laporan Bulanan
Rekapitulasi penjualan bulanan per hari lengkap dengan grafik tren omzet vs keuntungan, serta tombol cetak dan ekspor Excel.

### 15. Backup dan Restore Data
- **Unduh File Backup (.json)**: Menghasilkan satu file arsip lengkap seluruh isi database. Lakukan backup setiap akhir pekan atau akhir bulan.
- **Pulihkan Data (Restore)**: Mengunggah file `.json` untuk memulihkan seluruh data saat berpindah ke HP/laptop baru.
- **Reset Data Contoh**: Mengembalikan database ke katalog awal kantin SMPN 77.

### 16. Pengaturan Akun
Mengatur nama usaha, alamat sekolah, catatan footer struk, modal kas awal harian, nama karyawan, dan PIN/sandi login.

---

## 📐 RUMUS & KETENTUAN AKUNTANSI

1. **Keuntungan per Produk**:
   $$\text{Keuntungan} = \text{Harga Jual} - \text{Harga Modal}$$

2. **Stok Tersedia**:
   $$\text{Stok Tersedia} = \text{Stok Awal} + \text{Barang Masuk} - \text{Total Terjual}$$

3. **Stok Opname**:
   $$\text{Stok Akhir Sistem} = \text{Stok Awal} + \text{Barang Masuk} - \text{Total Terjual}$$
   $$\text{Selisih Stok} = \text{Stok Fisik Real} - \text{Stok Akhir Sistem}$$

4. **Harga Pokok Penjualan (HPP)**:
   $$\text{HPP} = \sum (\text{Qty Terjual} \times \text{Harga Modal Barang})$$
   *(Catatan: Stok barang yang belum laku tetap menjadi aset persediaan, bukan beban laba rugi)*

5. **Laba Kotor & Laba Bersih**:
   $$\text{Laba Kotor} = \text{Omzet Penjualan} - \text{HPP}$$
   $$\text{Laba Bersih} = \text{Laba Kotor} - \text{Pengeluaran Operasional}$$

6. **Saldo Kas Fisik di Laci**:
   $$\text{Saldo Kas Akhir} = \text{Saldo Awal} + \text{Penerimaan Tunai} - \text{Pengeluaran Tunai}$$

---

## 💾 CADANGAN DATA (BACKUP & RESTORE)

Karena aplikasi menggunakan penyimpanan lokal peramban (*IndexedDB*), disarankan:
1. Menekan tombol **Unduh File Backup Sekarang** di menu **Backup & Restore Data** minimal **1 kali setiap minggu**.
2. Simpan file `.json` tersebut ke Flashdisk atau Google Drive.
3. Jika sewaktu-waktu laptop/HP berganti, cukup buka aplikasi di peramban perangkat baru dan pilih menu **Restore Data** untuk melanjutkan pekerjaan dengan seluruh riwayat utuh.

---
**SISTEM KANTIN SMPN 77 JAKARTA**  
*Sederhana, Profesional, Cepat, dan Siap Digunakan.*
