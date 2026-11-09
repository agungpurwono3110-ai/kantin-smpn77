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

  updateConnectionBadge(online) {
    if (window.location.hostname.includes('github.io') || window.CloudDB || window.SUPABASE_CONFIG || document.querySelector('script[src*="supabase"]')) return;

    const badge = document.getElementById('badge-connection-status');
    if (!badge) return;

    if (online) {
      badge.className = 'badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small fw-semibold';
      badge.innerHTML = '<i class="bi bi-database-check me-1"></i> Server Terpusat (Online)';
      badge.title = 'Terhubung ke server database. Seluruh transaksi tersimpan di server terpusat.';
    } else {
      badge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small fw-semibold';
      badge.innerHTML = '<i class="bi bi-hdd-network me-1"></i> Mode Offline (Lokal)';
      badge.title = 'Berjalan di penyimpanan lokal browser perangkat ini.';
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
