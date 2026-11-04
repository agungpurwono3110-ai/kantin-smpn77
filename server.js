/**
 * SISTEM KANTIN SMPN 77 - EXPRESS REST API BACKEND SERVER
 * Menghubungkan seluruh perangkat (HP Android, Tablet, Laptop) ke satu database SQLite terpusat.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, dbRun, dbGet, dbAll, initDatabase, resetDatabaseToDemo, clearTrialTransactionsOnly } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Layani file frontend statis (HTML, CSS, JS)
app.use(express.static(__dirname));

// ==================== 1. AUTH & SETTINGS ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (user) {
      res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    } else {
      res.status(401).json({ success: false, message: 'Username atau PIN salah!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const rows = await dbAll('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    await dbRun('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, String(value)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/bulk', async (req, res) => {
  try {
    const items = req.body; // { key: value, ... }
    for (const [k, v] of Object.entries(items)) {
      await dbRun('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [k, String(v)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 2. MASTER PRODUK ====================
app.get('/api/products', async (req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products ORDER BY category ASC, name ASC');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { code, name, category, buy_price, sell_price, initial_stock, min_stock, unit, image } = req.body;
    const profit = parseFloat(sell_price) - parseFloat(buy_price);
    const result = await dbRun(`
      INSERT INTO products (code, name, category, buy_price, sell_price, profit, initial_stock, min_stock, stock, unit, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [code, name, category, buy_price, sell_price, profit, initial_stock, min_stock || 5, initial_stock, unit || 'Pcs', image || null]);

    res.json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, category, buy_price, sell_price, min_stock, stock, unit, image } = req.body;
    const profit = parseFloat(sell_price) - parseFloat(buy_price);

    await dbRun(`
      UPDATE products 
      SET code = ?, name = ?, category = ?, buy_price = ?, sell_price = ?, profit = ?, min_stock = ?, stock = ?, unit = ?, image = COALESCE(?, image)
      WHERE id = ?
    `, [code, name, category, buy_price, sell_price, profit, min_stock, stock, unit, image, id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 3. PENJUALAN & TRANSAKSI ====================
app.get('/api/transactions', async (req, res) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM transactions';
    let params = [];
    if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    }
    query += ' ORDER BY id DESC';

    const transactions = await dbAll(query, params);
    
    // Attach items to each transaction
    for (const trx of transactions) {
      trx.items = await dbAll('SELECT * FROM transaction_items WHERE transaction_id = ?', [trx.id]);
    }

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { order_number, date, time, timestamp, items, total, total_hpp, total_profit, payment_method, cash_given, change_amount } = req.body;

    // 1. Validasi Stok Sebelum Menyimpan
    for (const item of items) {
      const prod = await dbGet('SELECT stock, name FROM products WHERE id = ?', [item.id]);
      if (!prod || prod.stock < item.qty) {
        return res.status(400).json({ success: false, message: `Stok barang "${item.name}" tidak mencukupi (sisa ${prod ? prod.stock : 0})` });
      }
    }

    // 2. Simpan Header Transaksi
    const trxResult = await dbRun(`
      INSERT INTO transactions (order_number, date, time, timestamp, total, total_hpp, total_profit, payment_method, cash_given, change_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'selesai')
    `, [order_number, date, time, timestamp || Date.now(), total, total_hpp, total_profit, payment_method, cash_given, change_amount]);

    const trxId = trxResult.lastID;

    // 3. Simpan Item Transaksi & Kurangi Stok Produk
    for (const item of items) {
      await dbRun(`
        INSERT INTO transaction_items (transaction_id, product_id, code, name, category, unit, buy_price, sell_price, qty, subtotal, subtotal_hpp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [trxId, item.id, item.code, item.name, item.category, item.unit, item.buy_price, item.sell_price, item.qty, item.subtotal, item.subtotal_hpp]);

      await dbRun('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.id]);
    }

    // 4. Catat Mutasi Kas Masuk
    await dbRun(`
      INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
      VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?)
    `, [
      date,
      time,
      timestamp || Date.now(),
      payment_method === 'tunai' ? 'penjualan_tunai' : 'penjualan_nontunai',
      payment_method,
      total,
      `Penjualan Kasir #${order_number} (${items.length} item)`,
      String(trxId)
    ]);

    res.json({ success: true, id: trxId, order_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, date, time } = req.body;

    const trx = await dbGet('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    if (trx.status === 'dibatalkan') return res.status(400).json({ message: 'Transaksi ini sudah pernah dibatalkan!' });

    // 1. Ubah status transaksi
    await dbRun('UPDATE transactions SET status = "dibatalkan", cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP WHERE id = ?', [reason || 'Dibatalkan kasir', id]);

    // 2. Kembalikan stok barang
    const items = await dbAll('SELECT * FROM transaction_items WHERE transaction_id = ?', [id]);
    for (const item of items) {
      await dbRun('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id]);
    }

    // 3. Batalkan mutasi kas jika pembayaran tunai
    if (trx.payment_method === 'tunai') {
      await dbRun(`
        INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
        VALUES (?, ?, ?, 'out', 'batal_penjualan', 'tunai', ?, ?, ?)
      `, [
        date || trx.date,
        time || trx.time,
        Date.now(),
        trx.total,
        `Pembatalan penjualan #${trx.order_number} (${reason})`,
        String(trx.id)
      ]);
    }

    res.json({ success: true, message: 'Transaksi berhasil dibatalkan dan stok telah dikembalikan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 4. BARANG MASUK / RESTOCK ====================
app.get('/api/restocks', async (req, res) => {
  try {
    const restocks = await dbAll('SELECT * FROM restocks ORDER BY id DESC');
    res.json(restocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restocks', async (req, res) => {
  try {
    const { invoice_no, date, supplier_id, supplier_name, product_id, product_name, qty, buy_price, total, payment_method, due_date, notes } = req.body;

    // 1. Simpan Pembelian Restock
    const result = await dbRun(`
      INSERT INTO restocks (invoice_no, date, supplier_id, supplier_name, product_id, product_name, qty, buy_price, total, payment_method, payment_status, due_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice_no, date, supplier_id, supplier_name, product_id, product_name, qty, buy_price, total, 
      payment_method, payment_method === 'tunai' ? 'lunas' : 'belum', due_date || null, notes || ''
    ]);

    const restockId = result.lastID;

    // 2. Tambah Stok Produk & Perbarui Harga Beli
    const profitDiff = `sell_price - ${parseFloat(buy_price)}`;
    await dbRun(`
      UPDATE products 
      SET stock = stock + ?, buy_price = ?, profit = (${profitDiff})
      WHERE id = ?
    `, [qty, buy_price, product_id]);

    // 3. Integrasi Kas Tunai vs Hutang Tempo
    if (payment_method === 'tunai') {
      await dbRun(`
        INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
        VALUES (?, ?, ?, 'out', 'restock_tunai', 'tunai', ?, ?, ?)
      `, [
        date,
        new Date().toTimeString().split(' ')[0].substring(0, 5),
        Date.now(),
        total,
        `Pembelian restock tunai: ${product_name} (${qty} pcs) #${invoice_no}`,
        String(restockId)
      ]);
    } else {
      await dbRun(`
        INSERT INTO debts (restock_id, supplier_id, supplier_name, invoice_no, date, total, paid, remaining, due_date, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'belum')
      `, [restockId, supplier_id, supplier_name, invoice_no, date, total, total, due_date]);
    }

    res.json({ success: true, id: restockId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 5. PENGELUARAN OPERASIONAL ====================
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await dbAll('SELECT * FROM expenses ORDER BY id DESC');
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { date, category, amount, payment_method, notes } = req.body;
    const result = await dbRun(`
      INSERT INTO expenses (date, category, amount, payment_method, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [date, category, amount, payment_method || 'tunai', notes || '']);

    const expId = result.lastID;

    if (payment_method === 'tunai') {
      await dbRun(`
        INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
        VALUES (?, ?, ?, 'out', 'operasional', 'tunai', ?, ?, ?)
      `, [
        date,
        new Date().toTimeString().split(' ')[0].substring(0, 5),
        Date.now(),
        amount,
        `Biaya Operasional: ${category} - ${notes}`,
        String(expId)
      ]);
    }

    res.json({ success: true, id: expId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 6. DATA SUPPLIER & HUTANG ====================
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await dbAll('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    const result = await dbRun('INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)', [name, phone, address, notes]);
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debts', async (req, res) => {
  try {
    const debts = await dbAll('SELECT * FROM debts ORDER BY id DESC');
    for (const d of debts) {
      d.payments = await dbAll('SELECT * FROM debt_payments WHERE debt_id = ?', [d.id]);
    }
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debts/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, source, date } = req.body;

    const debt = await dbGet('SELECT * FROM debts WHERE id = ?', [id]);
    if (!debt) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });

    const newPaid = debt.paid + parseFloat(amount);
    const newRemaining = Math.max(0, debt.total - newPaid);
    const newStatus = newRemaining === 0 ? 'lunas' : 'belum';

    await dbRun('UPDATE debts SET paid = ?, remaining = ?, status = ? WHERE id = ?', [newPaid, newRemaining, newStatus, id]);

    await dbRun('INSERT INTO debt_payments (debt_id, date, amount, source) VALUES (?, ?, ?, ?)', [id, date, amount, source]);

    if (source === 'kas') {
      await dbRun(`
        INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
        VALUES (?, ?, ?, 'out', 'bayar_hutang', 'tunai', ?, ?, ?)
      `, [
        date,
        new Date().toTimeString().split(' ')[0].substring(0, 5),
        Date.now(),
        amount,
        `Bayar hutang supplier ${debt.supplier_name} (#${debt.invoice_no})`,
        String(id)
      ]);
    }

    res.json({ success: true, remaining: newRemaining, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 7. MUTASI KAS HARIAN ====================
app.get('/api/cash-mutations', async (req, res) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM cash_mutations';
    let params = [];
    if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    }
    query += ' ORDER BY id ASC';
    const rows = await dbAll(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cash-mutations', async (req, res) => {
  try {
    const { date, time, timestamp, type, category, payment_method, amount, description, ref_id } = req.body;
    const result = await dbRun(`
      INSERT INTO cash_mutations (date, time, timestamp, type, category, payment_method, amount, description, ref_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [date, time, timestamp || Date.now(), type, category, payment_method || 'tunai', amount, description, ref_id]);

    res.json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 8. STOK OPNAME & TUTUP HARIAN ====================
app.get('/api/stock-opname', async (req, res) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM stock_opnames';
    let params = [];
    if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    }
    const opnames = await dbAll(query, params);
    for (const o of opnames) {
      o.items = await dbAll('SELECT * FROM stock_opname_items WHERE opname_id = ?', [o.id]);
    }
    res.json(opnames);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stock-opname/close', async (req, res) => {
  try {
    const { date, items, opening_cash, total_omzet, total_cash_sales, total_cashless_sales, total_hpp, gross_profit, total_expenses, net_profit } = req.body;

    // 1. Simpan atau perbarui header stok opname
    let opname = await dbGet('SELECT * FROM stock_opnames WHERE date = ?', [date]);
    let opnameId;
    if (opname) {
      await dbRun('UPDATE stock_opnames SET status = "closed", closed_at = CURRENT_TIMESTAMP WHERE id = ?', [opname.id]);
      await dbRun('DELETE FROM stock_opname_items WHERE opname_id = ?', [opname.id]);
      opnameId = opname.id;
    } else {
      const resOp = await dbRun('INSERT INTO stock_opnames (date, status, closed_at) VALUES (?, "closed", CURRENT_TIMESTAMP)', [date]);
      opnameId = resOp.lastID;
    }

    // 2. Simpan rincian stok opname dan perbarui stok fisik jadi stok awal esok hari!
    for (const item of items) {
      await dbRun(`
        INSERT INTO stock_opname_items (opname_id, product_id, code, name, category, unit, initial_stock, restock_qty, sold_qty, system_stock, physical_stock, diff, diff_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [opnameId, item.productId, item.code, item.name, item.category, item.unit, item.stokAwal, item.masuk, item.terjual, item.sistemStock, item.fisikStock, item.selisih, item.diffReason]);

      // Stok fisik akhir menjadi stok awal hari berikutnya
      await dbRun('UPDATE products SET stock = ?, initial_stock = ? WHERE id = ?', [item.fisikStock, item.fisikStock, item.productId]);
    }

    // 3. Simpan rekap penutupan harian
    await dbRun(`
      INSERT OR REPLACE INTO daily_closures (date, opening_cash, total_omzet, total_cash_sales, total_cashless_sales, total_hpp, gross_profit, total_expenses, net_profit, opname_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [date, opening_cash, total_omzet, total_cash_sales, total_cashless_sales, total_hpp, gross_profit, total_expenses, net_profit, opnameId]);

    res.json({ success: true, message: 'Transaksi harian berhasil ditutup dan stok fisik disimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 9. BACKUP & RESTORE ====================
app.get('/api/backup', async (req, res) => {
  try {
    const backup = {
      app: 'SISTEM_KANTIN_SMPN_77',
      version: '2.0-sqlite',
      exported_at: new Date().toISOString(),
      data: {
        products: await dbAll('SELECT * FROM products'),
        transactions: await dbAll('SELECT * FROM transactions'),
        transaction_items: await dbAll('SELECT * FROM transaction_items'),
        restocks: await dbAll('SELECT * FROM restocks'),
        expenses: await dbAll('SELECT * FROM expenses'),
        suppliers: await dbAll('SELECT * FROM suppliers'),
        debts: await dbAll('SELECT * FROM debts'),
        debt_payments: await dbAll('SELECT * FROM debt_payments'),
        cash_mutations: await dbAll('SELECT * FROM cash_mutations'),
        stock_opnames: await dbAll('SELECT * FROM stock_opnames'),
        stock_opname_items: await dbAll('SELECT * FROM stock_opname_items'),
        daily_closures: await dbAll('SELECT * FROM daily_closures'),
        settings: await dbAll('SELECT * FROM settings')
      }
    };
    res.setHeader('Content-Disposition', `attachment; filename=BACKUP_KANTIN_SMPN77_${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-demo', async (req, res) => {
  try {
    await resetDatabaseToDemo();
    res.json({ success: true, message: 'Database SQLite berhasil direset ke data awal katalog standar SMPN 77!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clear-trial-transactions', async (req, res) => {
  try {
    await clearTrialTransactionsOnly();
    res.json({ success: true, message: 'Seluruh riwayat transaksi uji coba berhasil dibersihkan! Katalog produk tetap tersimpan.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Jalankan Server & Inisialisasi Database
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
======================================================
🏪 SISTEM MANAJEMEN KANTIN SMPN 77 AKTIF!
🌐 Server Berjalan di Port: ${PORT}
💻 Akses Komputer Kasir: http://localhost:${PORT}
📱 Akses HP Android: http://<IP_KOMPUTER_ANDA>:${PORT}
💾 Database SQLite: ${path.join(__dirname, 'kantin77.db')}
======================================================
    `);
  });
}).catch(err => {
  console.error('Fatal initialization error:', err);
});
