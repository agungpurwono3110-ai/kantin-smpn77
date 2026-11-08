/**
 * SISTEM KANTIN SMPN 77 - DATABASE LAYER (IndexedDB + Google Firebase Cloud Firestore)
 * 100% Real-time synchronization across devices (Laptop, HP, Tablet) via Firebase Cloud,
 * with automatic IndexedDB offline persistence and seamless failover.
 */

const DB_NAME = 'KantinSMPN77_DB';
const DB_VERSION = 1;

// Helper to remove 'undefined' fields before sending to Firestore
function sanitizeForFirestore(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) {
      clean[k] = null;
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      clean[k] = sanitizeForFirestore(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

class CanteenDB {
  constructor() {
    this.db = null;
    this.firestore = null;
    this.isCloud = false;
    this.stores = [
      'products', 'transactions', 'restocks', 'expenses', 
      'suppliers', 'debts', 'cash_mutations', 'stock_opname', 
      'daily_closures', 'settings'
    ];
  }

  // Initialize both IndexedDB and Firebase Firestore
  async init() {
    // 1. Initialize local IndexedDB first
    await this.initIndexedDB();

    // 2. Initialize and verify Google Firebase Cloud Firestore
    await this.initFirebaseCloud();

    return this.db;
  }

  // Initialize IndexedDB
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('code', 'code', { unique: false });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('transactions')) {
          const trxStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          trxStore.createIndex('order_number', 'order_number', { unique: true });
          trxStore.createIndex('date', 'date', { unique: false });
          trxStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('restocks')) {
          const restockStore = db.createObjectStore('restocks', { keyPath: 'id', autoIncrement: true });
          restockStore.createIndex('date', 'date', { unique: false });
          restockStore.createIndex('supplier_id', 'supplier_id', { unique: false });
          restockStore.createIndex('product_id', 'product_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expenseStore.createIndex('date', 'date', { unique: false });
          expenseStore.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('suppliers')) {
          const suppStore = db.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
          suppStore.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('debts')) {
          const debtStore = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
          debtStore.createIndex('supplier_id', 'supplier_id', { unique: false });
          debtStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('cash_mutations')) {
          const cashStore = db.createObjectStore('cash_mutations', { keyPath: 'id', autoIncrement: true });
          cashStore.createIndex('date', 'date', { unique: false });
          cashStore.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('stock_opname')) {
          const opnameStore = db.createObjectStore('stock_opname', { keyPath: 'id', autoIncrement: true });
          opnameStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('daily_closures')) {
          const closureStore = db.createObjectStore('daily_closures', { keyPath: 'id', autoIncrement: true });
          closureStore.createIndex('date', 'date', { unique: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Connect to Firebase Cloud Firestore and auto-sync
  async initFirebaseCloud() {
    if (window.firestoreDb) {
      this.firestore = window.firestoreDb;
    } else if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      this.firestore = firebase.firestore();
    }

    if (!this.firestore) {
      console.log('🔵 Firebase belum aktif. Menggunakan penyimpanan lokal (IndexedDB).');
      this.isCloud = false;
      await this.checkAndSeedDefaultData();
      return;
    }

    try {
      // Test read to check network connectivity and security rules
      const testSnap = await this.firestore.collection('settings').limit(1).get();
      this.isCloud = true;
      console.log('🟢 Terhubung ke Google Firebase Cloud Database (Real-Time)!');

      // Update badge in UI
      if (window.API && typeof API.updateConnectionBadge === 'function') {
        API.updateConnectionBadge(true, 'cloud');
      }

      // Check whether Firestore already has products
      const cloudProdsSnap = await this.firestore.collection('products').limit(1).get();
      if (cloudProdsSnap.empty) {
        // Firestore is empty. Check if local IndexedDB has existing user products (e.g. from Laptop)
        const localProds = await this.getAllLocal('products');
        if (localProds && localProds.length > 0) {
          console.log('📤 Mengunggah data lokal ke Firebase Cloud...');
          await this.migrateLocalToCloud();
          console.log('✅ Data lokal berhasil dimigrasikan ke Cloud Firebase!');
        } else {
          // Both are empty, seed default realistic canteen data
          console.log('🌱 Menyiapkan data awal kantin di Firebase Cloud...');
          await this.seedDemoData();
        }
      } else {
        // Cloud has data! Sync cloud products down to IndexedDB cache
        this.syncCloudToLocalCache();
      }

      // Setup real-time listeners so changes in HP appear on Laptop and vice versa
      this.setupRealtimeListeners();

    } catch (err) {
      console.warn('⚠️ Gagal terhubung ke Firebase Firestore (mungkin rules belum dibuka atau offline):', err.message);
      this.isCloud = false;
      await this.checkAndSeedDefaultData();
    }
  }

  // Real-time listener for multi-device sync
  setupRealtimeListeners() {
    if (!this.firestore) return;

    // Listen for product & stock changes
    this.firestore.collection('products').onSnapshot((snapshot) => {
      if (!snapshot.metadata.hasPendingWrites && snapshot.docChanges().length > 0) {
        console.log('🔄 Data produk disinkronkan dari perangkat lain (Cloud).');
        if (window.POS && typeof POS.renderProducts === 'function' && App.activeView === 'penjualan') {
          POS.renderProducts();
        }
        if (window.MasterProduk && typeof MasterProduk.renderTable === 'function' && App.activeView === 'master-produk') {
          MasterProduk.renderTable();
        }
        if (window.StokBarang && typeof StokBarang.renderTable === 'function' && App.activeView === 'stok-barang') {
          StokBarang.renderTable();
        }
        if (window.App && typeof App.refreshDashboard === 'function' && App.activeView === 'dashboard') {
          App.refreshDashboard();
        }
      }
    }, (err) => console.warn('Product listener error:', err));

    // Listen for transaction changes
    this.firestore.collection('transactions').onSnapshot((snapshot) => {
      if (!snapshot.metadata.hasPendingWrites && snapshot.docChanges().length > 0) {
        console.log('🔄 Transaksi baru terdeteksi dari cloud.');
        if (window.App && typeof App.refreshDashboard === 'function') {
          App.refreshDashboard();
        }
        if (window.RiwayatTransaksi && typeof RiwayatTransaksi.renderTable === 'function' && App.activeView === 'riwayat-transaksi') {
          RiwayatTransaksi.renderTable();
        }
      }
    }, (err) => console.warn('Transaction listener error:', err));
  }

  // ==================== GENERIC CRUD METHODS ====================

  // 1. GET ALL
  async getAll(storeName) {
    if (this.isCloud && this.firestore) {
      try {
        const snap = await this.firestore.collection(storeName).get();
        const list = [];
        snap.forEach(doc => {
          const item = doc.data();
          if (item.id === undefined) {
            item.id = !isNaN(Number(doc.id)) ? Number(doc.id) : doc.id;
          }
          list.push(item);
        });

        // Sort items by ID if numeric
        list.sort((a, b) => {
          if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
          return 0;
        });

        // Update local cache in background
        this.cacheLocal(storeName, list);

        return list;
      } catch (e) {
        console.warn(`Firestore getAll [${storeName}] failed, using local cache:`, e.message);
      }
    }
    return this.getAllLocal(storeName);
  }

  // 2. GET BY ID
  async get(storeName, id) {
    if (this.isCloud && this.firestore) {
      try {
        const doc = await this.firestore.collection(storeName).doc(String(id)).get();
        if (doc.exists) {
          const item = doc.data();
          if (item.id === undefined) {
            item.id = !isNaN(Number(doc.id)) ? Number(doc.id) : doc.id;
          }
          return item;
        }
        return null;
      } catch (e) {
        console.warn(`Firestore get [${storeName}/${id}] failed:`, e.message);
      }
    }
    return this.getLocal(storeName, id);
  }

  // 3. ADD RECORD
  async add(storeName, data) {
    if (data.id === undefined) {
      data.id = Date.now();
    }
    const cleanData = sanitizeForFirestore(data);

    if (this.isCloud && this.firestore) {
      try {
        await this.firestore.collection(storeName).doc(String(data.id)).set(cleanData);
      } catch (e) {
        console.warn(`Firestore add [${storeName}] failed:`, e.message);
      }
    }

    await this.putLocal(storeName, data);
    return data.id;
  }

  // 4. PUT (UPDATE / CREATE) RECORD
  async put(storeName, data) {
    const docKey = data.id !== undefined ? String(data.id) : (data.key || String(Date.now()));
    if (data.id === undefined && storeName !== 'settings') {
      data.id = !isNaN(Number(docKey)) ? Number(docKey) : docKey;
    }
    const cleanData = sanitizeForFirestore(data);

    if (this.isCloud && this.firestore) {
      try {
        await this.firestore.collection(storeName).doc(docKey).set(cleanData, { merge: true });
      } catch (e) {
        console.warn(`Firestore put [${storeName}/${docKey}] failed:`, e.message);
      }
    }

    await this.putLocal(storeName, data);
    return data.id || data.key;
  }

  // 5. DELETE RECORD
  async delete(storeName, id) {
    if (this.isCloud && this.firestore) {
      try {
        await this.firestore.collection(storeName).doc(String(id)).delete();
      } catch (e) {
        console.warn(`Firestore delete [${storeName}/${id}] failed:`, e.message);
      }
    }

    await this.deleteLocal(storeName, id);
    return true;
  }

  // 6. CLEAR STORE
  async clear(storeName) {
    if (this.isCloud && this.firestore) {
      try {
        const snap = await this.firestore.collection(storeName).get();
        const batch = this.firestore.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (e) {
        console.warn(`Firestore clear [${storeName}] failed:`, e.message);
      }
    }

    await this.clearLocal(storeName);
    return true;
  }

  // 7. SETTINGS GETTER
  async getSetting(key, defaultValue = null) {
    if (this.isCloud && this.firestore) {
      try {
        const doc = await this.firestore.collection('settings').doc(key).get();
        if (doc.exists && doc.data() && doc.data().value !== undefined) {
          return doc.data().value;
        }
      } catch (e) {
        // Fallback to local
      }
    }
    return this.getSettingLocal(key, defaultValue);
  }

  // 8. SETTINGS SETTER
  async setSetting(key, value) {
    const item = { key, value, updated_at: new Date().toISOString() };
    const cleanData = sanitizeForFirestore(item);

    if (this.isCloud && this.firestore) {
      try {
        await this.firestore.collection('settings').doc(key).set(cleanData);
      } catch (e) {
        console.warn(`Firestore setSetting [${key}] failed:`, e.message);
      }
    }

    return this.putLocal('settings', item);
  }

  // ==================== LOCAL INDEXEDDB HELPERS ====================

  tx(storeName, mode = 'readonly') {
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async getAllLocal(storeName) {
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getLocal(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readonly');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async putLocal(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readwrite');
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteLocal(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clearLocal(storeName) {
    return new Promise((resolve, reject) => {
      const store = this.tx(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getSettingLocal(key, defaultValue = null) {
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

  // Cache items into local IndexedDB
  async cacheLocal(storeName, items) {
    try {
      const store = this.tx(storeName, 'readwrite');
      for (const item of items) {
        store.put(item);
      }
    } catch (e) {
      // Ignore background cache errors
    }
  }

  // Sync all cloud data down to local cache
  async syncCloudToLocalCache() {
    for (const s of ['products', 'suppliers', 'settings']) {
      await this.getAll(s);
    }
  }

  // Migrate existing local laptop IndexedDB data to Firebase Cloud
  async migrateLocalToCloud() {
    for (const s of this.stores) {
      const localItems = await this.getAllLocal(s);
      if (localItems && localItems.length > 0) {
        for (const item of localItems) {
          const docKey = item.id !== undefined ? String(item.id) : (item.key || String(Date.now()));
          await this.firestore.collection(s).doc(docKey).set(sanitizeForFirestore(item));
        }
      }
    }
  }

  // ==================== BACKUP & RESTORE ====================

  async exportFullDatabase() {
    const backup = {
      app: 'SISTEM_KANTIN_SMPN_77',
      version: '2.0-cloud',
      exported_at: new Date().toISOString(),
      data: {}
    };

    for (const store of this.stores) {
      backup.data[store] = await this.getAll(store);
    }
    return backup;
  }

  async restoreFullDatabase(backupObj) {
    if (!backupObj || !backupObj.data) {
      throw new Error('Format file backup tidak valid.');
    }

    for (const store of this.stores) {
      if (backupObj.data[store]) {
        await this.clear(store);
        for (const item of backupObj.data[store]) {
          await this.put(store, item);
        }
      }
    }
    return true;
  }

  // ==================== DEFAULT DEMO DATA SEEDING ====================

  async checkAndSeedDefaultData() {
    const products = await this.getAll('products');
    if (products.length === 0) {
      console.log('Database baru dideteksi. Memuat data awal Kantin SMPN 77...');
      await this.seedDemoData();
    }
  }

  async seedDemoData() {
    for (const s of this.stores) {
      await this.clear(s);
    }

    // 1. Initial Settings
    const defaultSettings = [
      { key: 'canteen_name', value: 'TOKO MINUMAN 77' },
      { key: 'school_name', value: 'Kantin SMPN 77' },
      { key: 'canteen_address', value: 'Jl. Cempaka Putih Tengah No. 1, Jakarta Pusat' },
      { key: 'receipt_footer', value: 'Terima kasih atas kunjungannya!\nSelamat belajar di SMPN 77.' },
      { key: 'default_initial_cash', value: 200000 },
      { key: 'admin_username', value: 'admin' },
      { key: 'admin_password', value: '123456' },
      { key: 'kasir_username', value: 'kasir' },
      { key: 'kasir_password', value: '1234' },
      { key: 'kasir_name', value: 'Karyawan Kasir' },
      { key: 'staff_name', value: 'Pengelola Kantin' },
      { key: 'staff_username', value: 'admin' },
      { key: 'staff_password', value: '123456' },
      { key: 'operational_date', value: new Date().toISOString().split('T')[0] }
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

    // 3. Initial Canteen Products
    const initialProducts = [
      { code: 'MIN-01', name: 'Aqua Botol 600ml', category: 'Air mineral', buy_price: 2500, sell_price: 3500, initial_stock: 48, min_stock: 3, stock: 0, unit: 'Botol' },
      { code: 'MIN-02', name: 'Le Minerale 600ml', category: 'Air mineral', buy_price: 1950, sell_price: 5000, initial_stock: 48, min_stock: 3, stock: 23, unit: 'Botol' },
      { code: 'MIN-03', name: 'Club Air Mineral 330ml', category: 'Air mineral', buy_price: 1500, sell_price: 2500, initial_stock: 24, min_stock: 3, stock: 0, unit: 'Botol' },
      { code: 'MIN-04', name: 'Teh Pucuk Harum 350ml', category: 'Teh kemasan', buy_price: 2600, sell_price: 5000, initial_stock: 48, min_stock: 3, stock: 14, unit: 'Botol' },
      { code: 'MIN-05', name: 'Fruit Tea Botol 350ml', category: 'Teh kemasan', buy_price: 2750, sell_price: 5000, initial_stock: 24, min_stock: 3, stock: 0, unit: 'Botol' },
      { code: 'MIN-06', name: 'Teh Botol Sosro Kotak 250ml', category: 'Teh kemasan', buy_price: 2800, sell_price: 4000, initial_stock: 24, min_stock: 8, stock: 24, unit: 'Kotak' },
      { code: 'MIN-07', name: 'Floridina Orange 350ml', category: 'Minuman rasa buah', buy_price: 2600, sell_price: 3500, initial_stock: 36, min_stock: 10, stock: 36, unit: 'Botol' },
      { code: 'MIN-08', name: 'Minute Maid Pulpy Orange 300ml', category: 'Minuman rasa buah', buy_price: 4000, sell_price: 5500, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Botol' },
      { code: 'MIN-09', name: 'Ale-Ale Aneka Rasa', category: 'Minuman lainnya', buy_price: 1000, sell_price: 2000, initial_stock: 48, min_stock: 12, stock: 48, unit: 'Cup' },
      { code: 'MIN-10', name: 'Ultra Milk Cokelat 200ml', category: 'Susu kemasan', buy_price: 4500, sell_price: 6000, initial_stock: 30, min_stock: 8, stock: 30, unit: 'Kotak' },
      { code: 'MIN-11', name: 'Ultra Milk Stroberi 200ml', category: 'Susu kemasan', buy_price: 4500, sell_price: 6000, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Kotak' },
      { code: 'MIN-12', name: 'Milo Kotak UHT 180ml', category: 'Susu kemasan', buy_price: 5000, sell_price: 6500, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Kotak' },
      { code: 'MIN-13', name: 'Indomilk Kids Cokelat 115ml', category: 'Susu kemasan', buy_price: 2800, sell_price: 4000, initial_stock: 24, min_stock: 6, stock: 24, unit: 'Kotak' },
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

    // 4. Initial Cash Opening
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

    console.log('✅ Data awal toko Kantin SMPN 77 berhasil disiapkan.');
  }

  async clearTrialTransactionsOnly() {
    const trialStores = [
      'transactions', 'restocks', 'expenses', 
      'debts', 'cash_mutations', 'stock_opname', 'daily_closures'
    ];
    for (const s of trialStores) {
      await this.clear(s);
    }

    const products = await this.getAll('products');
    for (const p of products) {
      p.stock = p.initial_stock || 0;
      await this.put('products', p);
    }

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