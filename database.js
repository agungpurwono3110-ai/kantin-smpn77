/**
 * SISTEM KANTIN SMPN 77 - SQLITE DATABASE INITIALIZER & ADAPTER
 * Menyediakan koneksi SQLite relasional dengan transactional safety.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kantin77.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Gagal membuka database SQLite:', err.message);
  } else {
    console.log(`✅ Terhubung ke database SQLite di: ${DB_PATH}`);
  }
});

// Helper functions for Promise-based SQL execution
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Inisialisasi Skema Tabel Relasional
async function initDatabase() {
  await dbRun("PRAGMA foreign_keys = ON;");

  // 1. Tabel Users
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Tabel Settings
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Tabel Suppliers
  await dbRun(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Tabel Products
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      profit REAL NOT NULL,
      initial_stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'Pcs',
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Tabel Transactions
  await dbRun(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      total REAL NOT NULL,
      total_hpp REAL NOT NULL,
      total_profit REAL NOT NULL,
      payment_method TEXT NOT NULL,
      cash_given REAL NOT NULL,
      change_amount REAL NOT NULL,
      status TEXT DEFAULT 'selesai',
      cancel_reason TEXT,
      cancelled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Tabel Transaction Items
  await dbRun(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      subtotal_hpp REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  // 7. Tabel Restocks (Barang Masuk)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS restocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      buy_price REAL NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      due_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  // 8. Tabel Debts (Hutang Supplier)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restock_id INTEGER,
      supplier_id INTEGER NOT NULL,
      supplier_name TEXT,
      invoice_no TEXT,
      date TEXT NOT NULL,
      total REAL NOT NULL,
      paid REAL DEFAULT 0,
      remaining REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'belum',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restock_id) REFERENCES restocks (id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    );
  `);

  // 9. Tabel Debt Payments
  await dbRun(`
    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      source TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (debt_id) REFERENCES debts (id) ON DELETE CASCADE
    );
  `);

  // 10. Tabel Expenses (Pengeluaran Operasional)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'tunai',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Tabel Cash Mutations (Buku Kas)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS cash_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT,
      timestamp INTEGER,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT DEFAULT 'tunai',
      amount REAL NOT NULL,
      description TEXT,
      ref_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 12. Tabel Stock Opnames
  await dbRun(`
    CREATE TABLE IF NOT EXISTS stock_opnames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'draft',
      closed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 13. Tabel Stock Opname Items
  await dbRun(`
    CREATE TABLE IF NOT EXISTS stock_opname_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opname_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      initial_stock INTEGER,
      restock_qty INTEGER,
      sold_qty INTEGER,
      system_stock INTEGER,
      physical_stock INTEGER,
      diff INTEGER,
      diff_reason TEXT,
      FOREIGN KEY (opname_id) REFERENCES stock_opnames (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  // 14. Tabel Daily Closures
  await dbRun(`
    CREATE TABLE IF NOT EXISTS daily_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      opening_cash REAL,
      total_omzet REAL,
      total_cash_sales REAL,
      total_cashless_sales REAL,
      total_hpp REAL,
      gross_profit REAL,
      total_expenses REAL,
      net_profit REAL,
      opname_id INTEGER,
      closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Periksa apakah database masih kosong, lalu isi data awal SMPN 77
  await seedDefaultData();
}

async function seedDefaultData() {
  const userCheck = await dbGet("SELECT count(*) as count FROM users");
  if (userCheck.count === 0) {
    console.log("🌱 Menyiapkan data awal untuk Kantin SMPN 77...");

    // 1. Akun Pengelola & Karyawan Kasir
    await dbRun(
      "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
      ['admin', '123456', 'Pengelola Kantin', 'admin']
    );
    await dbRun(
      "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
      ['kasir', '1234', 'Karyawan Kasir', 'kasir']
    );

    // 2. Pengaturan Default
    const defaultSettings = [
      ['canteen_name', 'SISTEM KANTIN SMPN 77'],
      ['school_name', 'SMP Negeri 77 Jakarta'],
      ['canteen_address', 'Jl. Cempaka Putih Tengah No. 1, Jakarta Pusat'],
      ['receipt_footer', 'Terima kasih atas kunjungannya!\nSelamat belajar di SMPN 77.'],
      ['default_initial_cash', '200000'],
      ['admin_username', 'admin'],
      ['admin_password', '123456'],
      ['kasir_username', 'kasir'],
      ['kasir_password', '1234'],
      ['kasir_name', 'Karyawan Kasir'],
      ['operational_date', new Date().toISOString().split('T')[0]]
    ];
    for (const [k, v] of defaultSettings) {
      await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, v]);
    }

    // 3. Supplier Awal
    const suppliers = [
      ['Distributor Minuman Salemba Jaya', '081298765432', 'Jl. Salemba Raya No. 45, Jakarta Pusat', 'Supplier Aqua, Teh Pucuk, Floridina. Tempo 7 hari.'],
      ['Grosir Snack Berkah Mandiri', '081387654321', 'Pasar Johar Baru Blok A No. 12', 'Supplier keripik, wafer, biskuit, permen.'],
      ['Agen Susu & Minuman Segar', '085612345678', 'Jl. Cempaka Putih Barat No. 88', 'Supplier Ultra Milk, Milo, Indomilk.']
    ];
    for (const s of suppliers) {
      await dbRun("INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)", s);
    }

    // 4. Produk Minuman & Snack SMPN 77
    const products = [
      ['MIN-01', 'Aqua Botol 600ml', 'Air mineral', 2500, 3500, 1000, 48, 10, 48, 'Botol'],
      ['MIN-02', 'Le Minerale 600ml', 'Air mineral', 2500, 3500, 1000, 48, 10, 48, 'Botol'],
      ['MIN-03', 'Club Air Mineral 330ml', 'Air mineral', 1500, 2500, 1000, 24, 8, 24, 'Botol'],
      ['MIN-04', 'Teh Pucuk Harum 350ml', 'Teh kemasan', 2800, 4000, 1200, 48, 12, 48, 'Botol'],
      ['MIN-05', 'Fruit Tea Botol 350ml', 'Teh kemasan', 3000, 4500, 1500, 24, 8, 24, 'Botol'],
      ['MIN-06', 'Teh Botol Sosro Kotak 250ml', 'Teh kemasan', 2800, 4000, 1200, 24, 8, 24, 'Kotak'],
      ['MIN-07', 'Floridina Orange 350ml', 'Minuman rasa buah', 2600, 3500, 900, 36, 10, 36, 'Botol'],
      ['MIN-08', 'Minute Maid Pulpy Orange 300ml', 'Minuman rasa buah', 4000, 5500, 1500, 24, 6, 24, 'Botol'],
      ['MIN-09', 'Ale-Ale Aneka Rasa', 'Minuman lainnya', 1000, 2000, 1000, 48, 12, 48, 'Cup'],
      ['MIN-10', 'Ultra Milk Cokelat 200ml', 'Susu kemasan', 4500, 6000, 1500, 30, 8, 30, 'Kotak'],
      ['MIN-11', 'Ultra Milk Stroberi 200ml', 'Susu kemasan', 4500, 6000, 1500, 24, 6, 24, 'Kotak'],
      ['MIN-12', 'Milo Kotak UHT 180ml', 'Susu kemasan', 5000, 6500, 1500, 24, 6, 24, 'Kotak'],
      ['MIN-13', 'Indomilk Kids Cokelat 115ml', 'Susu kemasan', 2800, 4000, 1200, 24, 6, 24, 'Kotak'],
      ['SNK-01', 'Chitato Sapi Panggang 35g', 'Keripik', 4500, 6000, 1500, 20, 5, 20, 'Bungkus'],
      ['SNK-02', 'Qtela Singkong Balado 60g', 'Keripik', 4200, 5500, 1300, 20, 5, 20, 'Bungkus'],
      ['SNK-03', 'Kusuka Keripik Singkong 60g', 'Keripik', 4000, 5500, 1500, 15, 5, 15, 'Bungkus'],
      ['SNK-04', 'Oreo Mini Cup 61.3g', 'Biskuit', 5500, 7500, 2000, 15, 4, 15, 'Cup'],
      ['SNK-05', 'Roma Malkist Keju Manis', 'Biskuit', 1200, 2000, 800, 30, 6, 30, 'Bungkus'],
      ['SNK-06', 'Beng-Beng Wafer Cokelat', 'Wafer', 1800, 2500, 700, 40, 10, 40, 'Pcs'],
      ['SNK-07', 'Nabati Richeese Wafer Keju 50g', 'Wafer', 1500, 2000, 500, 35, 8, 35, 'Bungkus'],
      ['SNK-08', 'Tango Wafer Cokelat 47g', 'Wafer', 1500, 2000, 500, 30, 8, 30, 'Bungkus'],
      ['SNK-09', 'SilverQueen Chunky Mini 30g', 'Cokelat', 7000, 9500, 2500, 15, 3, 15, 'Pcs'],
      ['SNK-10', 'Permen Kopiko Pocket Pack', 'Permen', 2000, 3000, 1000, 25, 5, 25, 'Pcs'],
      ['SNK-11', 'Roti Aoka Aneka Rasa', 'Snack lainnya', 2200, 3000, 800, 30, 6, 30, 'Bungkus']
    ];
    for (const p of products) {
      await dbRun(`
        INSERT INTO products (code, name, category, buy_price, sell_price, profit, initial_stock, min_stock, stock, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, p);
    }

    // 5. Kas Awal di Laci Kasir (Rp 200.000)
    const today = new Date().toISOString().split('T')[0];
    await dbRun(`
      INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      today,
      '06:30',
      Date.now() - 14400000,
      'in',
      'modal_awal',
      'tunai',
      200000,
      'Modal kas awal operasional (pecahan kecil uang kembalian)',
      'MODAL-AWAL'
    ]);

    console.log("✅ Data awal berhasil dimuat ke database SQLite!");
  }
}

async function resetDatabaseToDemo() {
  await dbRun("DELETE FROM transaction_items");
  await dbRun("DELETE FROM transactions");
  await dbRun("DELETE FROM restocks");
  await dbRun("DELETE FROM debt_payments");
  await dbRun("DELETE FROM debts");
  await dbRun("DELETE FROM expenses");
  await dbRun("DELETE FROM cash_mutations");
  await dbRun("DELETE FROM stock_opname_items");
  await dbRun("DELETE FROM stock_opnames");
  await dbRun("DELETE FROM daily_closures");
  await dbRun("DELETE FROM products");
  await dbRun("DELETE FROM suppliers");
  await dbRun("DELETE FROM settings");
  await dbRun("DELETE FROM users");
  await seedDefaultData();
}

async function clearTrialTransactionsOnly() {
  await dbRun("DELETE FROM transaction_items");
  await dbRun("DELETE FROM transactions");
  await dbRun("DELETE FROM restocks");
  await dbRun("DELETE FROM debt_payments");
  await dbRun("DELETE FROM debts");
  await dbRun("DELETE FROM expenses");
  await dbRun("DELETE FROM cash_mutations");
  await dbRun("DELETE FROM stock_opname_items");
  await dbRun("DELETE FROM stock_opnames");
  await dbRun("DELETE FROM daily_closures");

  // Kembalikan stok produk ke nilai stok awal
  await dbRun("UPDATE products SET stock = initial_stock");

  // Siapkan kembali modal awal kas
  const today = new Date().toISOString().split('T')[0];
  await dbRun(`
    INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
    VALUES (?, '06:30', ?, 'in', 'modal_awal', 'tunai', 200000, 'Modal kas awal operasional (pecahan kecil uang kembalian)', 'MODAL-AWAL')
  `, [today, Date.now()]);
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  resetDatabaseToDemo,
  clearTrialTransactionsOnly
};
