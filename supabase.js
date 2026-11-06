/**
 * SISTEM KANTIN SMPN 77 - SUPABASE CLOUD SYNCHRONIZER
 * Menghubungkan seluruh perangkat (HP, Komputer Kantor, Laptop) ke satu database Cloud PostgreSQL.
 * Otomatis sinkronisasi data secara real-time dan mendukung mode offline.
 */

const SUPABASE_CONFIG = {
  url: 'https://tbapbfcgvlbtzcfsacru.supabase.co',
  key: 'sb_publishable_rdR2danAo3TKj5uQzmtvmg_T3zQOOnr'
};

const CloudDB = {
  client: null,
  isOnline: false,

  init() {
    if (typeof supabase === 'undefined') {
      console.warn('Library Supabase belum dimuat.');
      return false;
    }
    try {
      this.client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
      this.isOnline = true;
      this.updateStatusBadge(true);
      console.log('🟢 Terhubung ke Supabase Cloud Database!');
      this.setupRealtimeListeners();
      return true;
    } catch (err) {
      console.error('Gagal menghubungkan Supabase:', err);
      this.isOnline = false;
      this.updateStatusBadge(false);
      return false;
    }
  },

  updateStatusBadge(online) {
    const badge = document.getElementById('badge-connection-status');
    if (!badge) return;
    if (online) {
      badge.className = 'badge bg-success text-white border border-success px-2 py-1 small fw-semibold shadow-sm';
      badge.innerHTML = '<i class="bi bi-cloud-check-fill me-1"></i> Cloud Database (Online Real-Time)';
      badge.title = 'Terhubung ke Database Cloud Supabase. Semua data tersinkron otomatis antar HP & Komputer.';
    } else {
      badge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small fw-semibold';
      badge.innerHTML = '<i class="bi bi-hdd-network me-1"></i> Mode Offline (Lokal)';
    }
  },

  // Real-time listener: broadcast update ke seluruh HP & Komputer yang sedang membuka web
  setupRealtimeListeners() {
    if (!this.client) return;
    try {
      this.client
        .channel('canteen-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
          console.log('⚡ Pembaruan produk diterima dari cloud!');
          if (window.MasterProduk) await MasterProduk.renderTable();
          if (window.POS) await POS.renderProducts();
          if (window.App) await App.refreshDashboard();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async () => {
          console.log('⚡ Transaksi baru diterima dari cloud!');
          if (window.App) await App.refreshDashboard();
          if (window.RiwayatTransaksi) await RiwayatTransaksi.renderTable();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  },

  // Sync lokal ke cloud jika di cloud masih kosong
  async initialSyncFromLocal() {
    if (!this.client) return;
    try {
      const { data: cloudProducts, error } = await this.client.from('products').select('id').limit(1);
      if (error) {
        console.warn('Tabel Supabase belum dibuat di SQL Editor:', error.message);
        return;
      }

      // Jika di cloud belum ada produk sama sekali, upload data dari lokal komputer kantor ke cloud!
      if (!cloudProducts || cloudProducts.length === 0) {
        console.log('Cloud masih kosong. Mengunggah data awal komputer kantor ke cloud...');
        const localProducts = await db.getAll('products');
        if (localProducts.length > 0) {
          const toUpload = localProducts.map(p => {
            const item = { ...p };
            delete item.id; // biarkan Supabase auto increment
            return item;
          });
          const { error: insErr } = await this.client.from('products').insert(toUpload);
          if (!insErr) {
            console.log('✅ Seluruh produk komputer kantor berhasil diunggah ke Cloud Supabase!');
          } else {
            console.warn('Gagal upload produk ke Supabase:', insErr.message);
          }
        }
      }
    } catch (err) {
      console.warn('Initial sync error:', err);
    }
  }
};

// Inisialisasi otomatis saat script dimuat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    CloudDB.init();
  });
} else {
  CloudDB.init();
}
