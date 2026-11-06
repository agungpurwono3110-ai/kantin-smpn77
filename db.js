/**
 * SISTEM KANTIN SMPN 77 - DATABASE LAYER (IndexedDB)
 * 100% Client-side persistent storage, reliable, transactional, multi-megabyte capacity.
 */

const DB_NAME = 'KantinSMPN77_DB';
const DB_VERSION = 1;

class CanteenDB {
  constructor() {
    this.db = null;
  }

  // Initialize and open IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Products Store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('code', 'code', { unique: false });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('name', 'name', { unique: false });
        }

        // 2. Transactions Store (POS Orders)
        if (!db.objectStoreNames.contains('transactions')) {
          const trxStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          trxStore.createIndex('order_number', 'order_number', { unique: true });
          trxStore.createIndex('date', 'date', { unique: false });
          trxStore.createIndex('status', 'status', { unique: false });
        }

        // 3. Restocks Store (Barang Masuk)
        if (!db.objectStoreNames.contains('restocks')) {
          const restockStore = db.createObjectStore('restocks', { keyPath: 'id', autoIncrement: true });
          restockStore.createIndex('date', 'date', { unique: false });
          restockStore.createIndex('supplier_id', 'supplier_id', { unique: false });
          restockStore.createIndex('product_id', 'product_id', { unique: false });
        }

        // 4. Expenses Store (Pengeluaran Operasional)
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expenseStore.createIndex('date', 'date', { unique: false });
          expenseStore.createIndex('category', 'category', { unique: false });
        }

        // 5. Suppliers Store
        if (!db.objectStoreNames.contains('suppliers')) {
          const suppStore = db.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
          suppStore.createIndex('name', 'name', { unique: false });
        }

        // 6. Debts Store (Hutang Supplier)
        if (!db.objectStoreNames.contains('debts')) {
          const debtStore = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
          debtStore.createIndex('supplier_id', 'supplier_id', { unique: false });
          debtStore.createIndex('status', 'status', { unique: false });
        }

        // 7. Cash Mutations Store (Buku Kas)
        if (!db.objectStoreNames.contains('cash_mutations')) {
          const cashStore = db.createObjectStore('cash_mutations', { keyPath: 'id', autoIncrement: true });
          cashStore.createIndex('date', 'date', { unique: false });
          cashStore.createIndex('type', 'type', { unique: false });
        }

        // 8. Stock Opname Store
        if (!db.objectStoreNames.contains('stock_opname')) {
          const opnameStore = db.createObjectStore('stock_opname', { keyPath: 'id', autoIncrement: true });
          opnameStore.createIndex('date', 'date', { unique: false });
        }

        // 9. Daily Closures Store (Tutup Harian)
        if (!db.objectStoreNames.contains('daily_closures')) {
          const closureStore = db.createObjectStore('daily_closures', { keyPath: 'id', autoIncrement: true });
          closureStore.createIndex('date', 'date', { unique: true });
        }

        // 10. Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        // Check if database is empty; if so, populate with initial canteen demo data
        await this.checkAndSeedDefaultData();
        
        // Inisialisasi CloudDB Supabase & Sync Otomatis
        if (window.CloudDB) {
          window.CloudDB.init();
          await window.CloudDB.initialSyncFromLocal();
        }

        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Generic helper for transaction
  tx(storeName, mode = 'readonly') {
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Get all records from a store (Otomatis dari Cloud jika Online, dengan fallback Lokal)
  async getAll(storeName) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client) {
      try {
        const { data, error } = await window.CloudDB.client.from(storeName).select('*').order('id', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            await this.putLocal(storeName, item);
          }
          return data;
        }
      } catch (e) {
        console.warn(`CloudDB getAll failed for ${storeName}:`, e);
      }
    }
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  putLocal(storeName, data) {
    return new Promise((resolve) => {
      try {
        const store = this.tx(storeName, 'readwrite');
        const req = store.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // Get record by ID
  async get(storeName, id) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client) {
      try {
        const { data, error } = await window.CloudDB.client.from(storeName).select('*').eq('id', id).maybeSingle();
        if (!error && data) return data;
      } catch (e) {}
    }
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readonly');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Add record
  async add(storeName, data) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client) {
      try {
        const payload = { ...data };
        delete payload.id;
        const { data: inserted, error } = await window.CloudDB.client.from(storeName).insert(payload).select().single();
        if (!error && inserted) {
          await this.putLocal(storeName, inserted);
          return inserted.id;
        }
      } catch (e) {
        console.warn(`CloudDB add failed for ${storeName}:`, e);
      }
    }
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readwrite');
      const req = store.add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Put (update or create) record
  async put(storeName, data) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client && data.id) {
      try {
        await window.CloudDB.client.from(storeName).upsert(data);
      } catch (e) {
        console.warn(`CloudDB put failed for ${storeName}:`, e);
      }
    }
    return this.putLocal(storeName, data);
  }

  // Delete record by ID
  async delete(storeName, id) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client) {
      try {
        await window.CloudDB.client.from(storeName).delete().eq('id', id);
      } catch (e) {
        console.warn(`CloudDB delete failed for ${storeName}:`, e);
      }
    }
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Clear an entire store
  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Settings: get value by key
  async getSetting(key, defaultValue = null) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client) {
      try {
        const { data, error } = await window.CloudDB.client.from('settings').select('value').eq('key', key).maybeSingle();
        if (!error && data && data.value !== undefined) {
          return data.value;
        }
      } catch (e) {}
    }
    return new Promise((resolve) => {
      const store = this.tx('settings', 'readonly');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result !== undefined && req.result.value !== undefined) {
          resolve(req.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => resolve(defaultValue);
    });
  }

  // Settings: set value
  async setSetting(key, value) {
    if (window.CloudDB && window.CloudDB.isOnline && window.CloudDB.client) {
      try {
        await window.CloudDB.client.from('settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return this.put('settings', { key, value, updated_at: new Date().toISOString() });
  }

  // Export entire database to JSON object
  async exportFullDatabase() {
    const stores = [
      'products', 'transactions', 'restocks', 'expenses', 
      'suppliers', 'debts', 'cash_mutations', 'stock_opname', 
      'daily_closures', 'settings'
    ];
    const backup = {
      app: 'SISTEM_KANTIN_SMPN_77',
      version: '1.0',
      exported_at: new Date().toISOString(),
      data: {}
    };

    for (const store of stores) {
      backup.data[store] = await this.getAll(store);
    }
    return backup;
  }

  // Restore entire database from JSON object
  async restoreFullDatabase(backupObj) {
    if (!backupObj || !backupObj.data) {
      throw new Error('Format file backup tidak valid.');
    }

    const stores = [
      'products', 'transactions', 'restocks', 'expenses', 
      'suppliers', 'debts', 'cash_mutations', 'stock_opname', 
      'daily_closures', 'settings'
    ];

    for (const store of stores) {
      if (backupObj.data[store]) {
        await this.clear(store);
        const storeRef = this.tx(store, 'readwrite');
        for (const item of backupObj.data[store]) {
          await new Promise((res, rej) => {
            const req = storeRef.put(item);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
          });
        }
      }
    }
    return true;
  }

  // Populate Default Realistic Data for SMPN 77
  async checkAndSeedDefaultData() {
    const products = await this.getAll('products');
    if (products.length === 0) {
      console.log('Database baru dideteksi. Memuat data awal Kantin SMPN 77...');
      await this.seedDemoData();
    }
  }

  async seedDemoData() {
    // Clear all stores first
    const stores = [
      'products', 'transactions', 'restocks', 'expenses', 
      'suppliers', 'debts', 'cash_mutations', 'stock_opname', 
      'daily_closures', 'settings'
    ];
    for (const s of stores) {
      await this.clear(s);
    }

    // 1. Initial Settings
    const defaultSettings = [
      { key: 'canteen_name', value: 'SISTEM KANTIN SMPN 77' },
      { key: 'school_name', value: 'SMP Negeri 77 Jakarta' },
      { key: 'canteen_address', value: 'Jl. Cempaka Putih Tengah No. 1, Jakarta Pusat' },
      { key: 'receipt_footer', value: 'Terima kasih atas kunjungannya!\nSelamat belajar di SMPN 77.' },
      { key: 'default_initial_cash', value: 200000 }, // Modal kas uang kembalian Rp 200.000
      { key: 'admin_username', value: 'admin' },
      { key: 'admin_password', value: '123456' },
      { key: 'kasir_username', value: 'kasir' },
      { key: 'kasir_password', value: '1234' },
      { key: 'kasir_name', value: 'Karyawan Kasir' },
      { key: 'staff_name', value: 'Pengelola Kantin' },
      { key: 'staff_username', value: 'admin' },
      { key: 'staff_password', value: '123456' },
      { key: 'operational_date', value: (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toLocaleDateString('en-CA')) }
    ];
    for (const s of defaultSettings) {
      await this.setSetting(s.key, s.value);
    }

    // 2. Initial Suppliers
    const suppliers = [
      { id: 1, name: 'Distributor Minuman Salemba Jaya', phone: '081298765432', address: 'Jl. Salemba Raya No. 45, Jakarta Pusat', notes: 'Supplier Aqua, Teh Pucuk, Floridina. Tempo 7 hari.' },
      { id: 2, name: 'Grosir Snack Berkah Mandiri', phone: '081387654321', address: 'Pasar Johar Baru Blok A No. 12', notes: 'Supplier keripik, wafer, biskuit, dan permen. Bayar tunai dapat diskon.' },
      { id: 3, name: 'Agen Susu & Minuman Segar', phone: '085612345678', address: 'Jl. Cempaka Putih Barat No. 88', notes: 'Supplier Ultra Milk, Milo, Indomilk. Pengiriman Senin & Kamis.' }
    ];
    for (const sup of suppliers) {
      await this.put('suppliers', sup);
    }

    // 3. Initial Canteen Products (Bottled drinks & Snacks for SMPN 77)
    const initialProducts = [
      // Minuman Botol & Kemasan
      { code: 'MIN-01', name: 'Aqua Botol 600ml', category: 'Air mineral', buy_price: 2500, sell_price: 3500, initial_stock: 48, min_stock: 10, stock: 48, unit: 'Botol' },
      { code: 'MIN-02', name: 'Le Minerale 600ml', category: 'Air mineral', buy_price: 2500, sell_price: 3500, initial_stock: 48, min_stock: 10, stock: 48, unit: 'Botol' },
      { code: 'MIN-03', name: 'Club Air Mineral 330ml', category: 'Air mineral', buy_price: 1500, sell_price: 2500, initial_stock: 24, min_stock: 8, stock: 24, unit: 'Botol' },
      { code: 'MIN-04', name: 'Teh Pucuk Harum 350ml', category: 'Teh kemasan', buy_price: 2800, sell_price: 4000, initial_stock: 48, min_stock: 12, stock: 48, unit: 'Botol' },
      { code: 'MIN-05', name: 'Fruit Tea Botol 350ml', category: 'Teh kemasan', buy_price: 3000, sell_price: 4500, initial_stock: 24, min_stock: 8, stock: 24, unit: 'Botol' },
      { code: 'MIN-06', name: 'Teh Botol Sosro Kotak 250ml', category: 'Teh kemasan', buy_price: 2800, sell_price: 4000, initial_stock: 24, min_stock: 8, stock: 24, unit: 'Kotak' },
      { code: 'MIN-07', name: 'Floridina Orange 350ml', category: 'Minuman rasa buah', buy_price: 2600, sell_price: 3500, initial_stock: 36, min_stock: 10, stock: 36, unit: 'Botol' },
      { code: 'MIN-08', name: 'Minute Maid Pulpy Orange 300ml', category: 'Minuman rasa buah', buy_price: 4000, sell_price: 5500, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Botol' },
      { code: 'MIN-09', name: 'Ale-Ale Aneka Rasa', category: 'Minuman lainnya', buy_price: 1000, sell_price: 2000, initial_stock: 48, min_stock: 12, stock: 48, unit: 'Cup' },
      { code: 'MIN-10', name: 'Ultra Milk Cokelat 200ml', category: 'Susu kemasan', buy_price: 4500, sell_price: 6000, initial_stock: 30, min_stock: 8, stock: 30, unit: 'Kotak' },
      { code: 'MIN-11', name: 'Ultra Milk Stroberi 200ml', category: 'Susu kemasan', buy_price: 4500, sell_price: 6000, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Kotak' },
      { code: 'MIN-12', name: 'Milo Kotak UHT 180ml', category: 'Susu kemasan', buy_price: 5000, sell_price: 6500, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Kotak' },
      { code: 'MIN-13', name: 'Indomilk Kids Cokelat 115ml', category: 'Susu kemasan', buy_price: 2800, sell_price: 4000, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Kotak' },

      // Aneka Snack / Makanan Ringan
      { code: 'SNK-01', name: 'Chitato Sapi Panggang 35g', category: 'Keripik', buy_price: 4500, sell_price: 6000, initial_stock: 20, min_stock: 5, stock: 20, unit: 'Bungkus' },
      { code: 'SNK-02', name: 'Qtela Singkong Balado 60g', category: 'Keripik', buy_price: 4200, sell_price: 5500, initial_stock: 20, min_stock: 5, stock: 20, unit: 'Bungkus' },
      { code: 'SNK-03', name: 'Kusuka Keripik Singkong 60g', category: 'Keripik', buy_price: 4000, sell_price: 5500, initial_stock: 15, min_stock: 5, stock: 15, unit: 'Bungkus' },
      { code: 'SNK-04', name: 'Oreo Mini Cup 61.3g', category: 'Biskuit', buy_price: 5500, sell_price: 7500, initial_stock: 15, min_stock: 4, stock: 15, unit: 'Cup' },
      { code: 'SNK-05', name: 'Roma Malkist Keju Manis', category: 'Biskuit', buy_price: 1200, sell_price: 2000, initial_stock: 30, min_stock: 6, stock: 30, unit: 'Bungkus' },
      { code: 'SNK-06', name: 'Beng-Beng Wafer Cokelat', category: 'Wafer', buy_price: 1800, sell_price: 2500, initial_stock: 40, min_stock: 10, stock: 40, unit: 'Pcs' },
      { code: 'SNK-07', name: 'Nabati Richeese Wafer Keju 50g', category: 'Wafer', buy_price: 1500, sell_price: 2000, initial_stock: 35, min_stock: 8, stock: 35, unit: 'Bungkus' },
      { code: 'SNK-08', name: 'Tango Wafer Cokelat 47g', category: 'Wafer', buy_price: 1500, sell_price: 2000, initial_stock: 30, min_stock: 8, stock: 30, unit: 'Bungkus' },
      { code: 'SNK-09', name: 'SilverQueen Chunky Mini 30g', category: 'Cokelat', buy_price: 7000, sell_price: 9500, initial_stock: 15, min_stock: 3, stock: 15, unit: 'Pcs' },
      { code: 'SNK-10', name: 'Permen Kopiko Pocket Pack', category: 'Permen', buy_price: 2000, sell_price: 3000, initial_stock: 25, min_stock: 5, stock: 25, unit: 'Pcs' },
      { code: 'SNK-11', name: 'Roti Aoka Aneka Rasa', category: 'Snack lainnya', buy_price: 2200, sell_price: 3000, initial_stock: 30, min_stock: 6, stock: 30, unit: 'Bungkus' }
    ];

    let prodId = 1;
    for (const p of initialProducts) {
      p.id = prodId++;
      p.profit = p.sell_price - p.buy_price;
      p.image = null;
      await this.put('products', p);
    }

    // 4. Initial Cash Opening (Rp 200.000)
    const today = new Date().toISOString().split('T')[0];
    await this.add('cash_mutations', {
      date: today,
      time: '06:30',
      timestamp: Date.now() - 14400000,
      type: 'in',
      category: 'modal_awal',
      payment_method: 'tunai',
      amount: 200000,
      description: 'Modal kas awal operasional (pecahan kecil uang kembalian)',
      ref_id: 'MODAL-AWAL'
    });

    console.log('Data awal Kantin SMPN 77 berhasil disiapkan.');
  }

  // Clear trial transactions only (keeps products and suppliers)
  async clearTrialTransactionsOnly() {
    const trialStores = [
      'transactions', 'restocks', 'expenses', 
      'debts', 'cash_mutations', 'stock_opname', 'daily_closures'
    ];
    for (const s of trialStores) {
      await this.clear(s);
    }

    // Reset each product's stock back to initial_stock
    const products = await this.getAll('products');
    for (const p of products) {
      p.stock = p.initial_stock || 0;
      await this.put('products', p);
    }

    // Restore initial cash (Rp 200.000)
    const today = new Date().toISOString().split('T')[0];
    const defaultInitialCash = await this.getSetting('default_initial_cash', 200000);
    await this.add('cash_mutations', {
      date: today,
      time: '06:30',
      timestamp: Date.now(),
      type: 'in',
      category: 'modal_awal',
      payment_method: 'tunai',
      amount: defaultInitialCash,
      description: 'Modal kas awal operasional (pecahan kecil uang kembalian)',
      ref_id: 'MODAL-AWAL'
    });
  }
}

// Global DB instance
window.db = new CanteenDB();
