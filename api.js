/**
 * SISTEM KANTIN SMPN 77 - API CLIENT & SERVER SYNCHRONIZER
 * Mendeteksi secara otomatis apakah backend SQLite aktif dan menyinkronkan data antar-perangkat.
 */

const API = {
  isOnline: false,
  baseUrl: window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000',

  async checkConnection() {
    try {
      const res = await fetch(`${this.baseUrl}/api/products`, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        this.isOnline = true;
        this.updateConnectionBadge(true);
        console.log('🟢 Terhubung ke backend database server SQLite!');
        return true;
      }
    } catch (e) {
      // Offline or file:// protocol
    }
    this.isOnline = false;
    this.updateConnectionBadge(false);
    console.log('🔵 Berjalan dalam mode penyimpanan lokal (IndexedDB).');
    return false;
  },

  updateConnectionBadge(online, mode = 'sqlite') {
    const badge = document.getElementById('badge-connection-status');
    const mobileBadge = document.getElementById('mobile-cloud-badge');
    if (!badge) return;

    if (online || (window.db && window.db.isCloud)) {
      if (mode === 'cloud' || (window.db && window.db.isCloud)) {
        badge.className = 'badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small fw-semibold';
        badge.innerHTML = '<i class="bi bi-cloud-check-fill me-1"></i> Cloud Database (Online Real-Time)';
        badge.title = 'Terhubung ke Google Firebase Cloud. Seluruh transaksi tersinkronisasi otomatis antar-perangkat.';
        if (mobileBadge) {
          mobileBadge.className = 'badge bg-success-subtle text-white border border-light-subtle px-2 py-1';
          mobileBadge.innerHTML = '<i class="bi bi-cloud-check-fill"></i> Cloud';
          mobileBadge.style.display = 'inline-block';
        }
      } else {
        badge.className = 'badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small fw-semibold';
        badge.innerHTML = '<i class="bi bi-database-check me-1"></i> SQLite Terpusat (Online)';
        badge.title = 'Terhubung ke server database. Seluruh transaksi tersimpan di server terpusat.';
      }
    } else {
      if (window.db && window.db.isCloud) return;
      badge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small fw-semibold';
      badge.innerHTML = '<i class="bi bi-hdd-network me-1"></i> Mode Offline (Lokal)';
      badge.title = 'Berjalan di penyimpanan lokal browser perangkat ini.';
      if (mobileBadge) {
        mobileBadge.className = 'badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1';
        mobileBadge.innerHTML = '<i class="bi bi-hdd"></i> Lokal';
      }
    }
  },

  // Generic Request Helper
  async request(endpoint, options = {}) {
    if (!this.isOnline) return null;
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      const res = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...(options.headers || {}) }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`API call failed [${endpoint}]:`, err.message);
      return null;
    }
  }
};

// Check connection on start
window.addEventListener('DOMContentLoaded', () => {
  API.checkConnection();
});
