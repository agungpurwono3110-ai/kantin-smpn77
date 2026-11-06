/**
 * SISTEM KANTIN SMPN 77 - CORE APPLICATION CONTROLLER
 * Menghubungkan seluruh 16 modul operasional kantin secara otomatis dan real-time.
 */

// Helper utility for Indonesian Currency formatting
function formatRupiah(number) {
  if (isNaN(number) || number === null || number === undefined) number = 0;
  return 'Rp ' + Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseNumber(val) {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

// Helper untuk mendapatkan tanggal lokal (WIB / jam perangkat pengguna) format YYYY-MM-DD
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==================== APP CONTROLLER ====================
const App = {
  currentUser: null,
  operationalDate: '',
  activeView: 'dashboard',
  charts: {},

  async init() {
    try {
      await db.init();
      
      // Ambil tanggal real-time HARI INI dari jam/kalender perangkat pengguna
      this.operationalDate = getLocalDateString();
      await db.setSetting('operational_date', this.operationalDate);
      
      const staffName = await db.getSetting('staff_name', 'Karyawan Kantin');
      const canteenName = await db.getSetting('canteen_name', 'SISTEM KANTIN SMPN 77');

      // Update UI Header & Titles
      document.querySelectorAll('#user-display-name, #user-display-mobile').forEach(el => el.textContent = staffName);
      document.querySelectorAll('#sidebar-op-date, #top-date-display, #opname-cur-date').forEach(el => el.textContent = formatDateIndo(this.operationalDate));
      
      // Jalankan jam real-time digital di header
      this.startLiveClock();
      
      // Check authentication session
      const authSession = sessionStorage.getItem('kantin77_auth');
      if (!authSession) {
        document.getElementById('login-overlay').classList.remove('d-none');
      } else {
        this.currentUser = JSON.parse(authSession);
        this.applyUserRole(this.currentUser.role);
      }

      // Initialize all modules
      await POS.init();
      await MasterProduk.init();
      await StokBarang.init();
      await BarangMasuk.init();
      await StokOpname.init();
      await KasHarian.init();
      await Pengeluaran.init();
      await HutangSupplier.init();
      await Supplier.init();
      await LaporanLaba.init();
      await Rekap.init();
      await RiwayatTransaksi.init();
      await LaporanBulanan.init();
      await Pengaturan.init();

      // Load initial dashboard metrics & charts
      await this.refreshDashboard();

      // Keyboard shortcuts (F8 for POS Checkout)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F8') {
          e.preventDefault();
          if (App.activeView === 'penjualan') {
            POS.openPaymentModal();
          }
        }
      });

      console.log('Sistem Kantin SMPN 77 siap dioperasikan!');
    } catch (err) {
      console.error('Initialization error:', err);
      alert('Gagal memuat database sistem: ' + err.message);
    }
  },

  // View Routing
  async navigate(viewName, event) {
    if (event) event.preventDefault();

    // Enforce restricted access for Karyawan Kasir
    if (this.currentUser && this.currentUser.role === 'kasir') {
      const allowedKasirViews = ['dashboard', 'penjualan', 'stok-barang', 'stok-opname', 'riwayat-transaksi'];
      if (!allowedKasirViews.includes(viewName)) {
        alert('Akses Dibatasi!\nMenu ini hanya dapat diakses oleh Akun Administrator/Pengelola.');
        viewName = 'penjualan';
      }
    }

    // Hide all views
    document.querySelectorAll('.app-view').forEach(view => view.classList.add('d-none'));

    // Show target view
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('d-none');
      this.activeView = viewName;
    }

    // Update active nav links in sidebar
    document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      }
    });

    // Update Mobile bottom nav active state
    document.querySelectorAll('.mobile-bottom-nav .btn-nav-mobile').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('onclick')?.includes(`'${viewName}'`)) {
        btn.classList.add('active');
      }
    });

    // Update desktop title
    const titles = {
      'dashboard': '<i class="bi bi-grid-1x2-fill me-2 text-primary"></i> Dashboard Utama',
      'penjualan': '<i class="bi bi-cart-check-fill me-2 text-success"></i> Penjualan Harian (Kasir Istirahat 1 & 2)',
      'rekap-penjualan': '<i class="bi bi-journal-text me-2 text-info"></i> Rekap Penjualan Harian',
      'master-produk': '<i class="bi bi-box-seam-fill me-2 text-indigo"></i> Master Produk & Harga',
      'stok-barang': '<i class="bi bi-boxes me-2 text-warning"></i> Monitoring Stok Barang',
      'barang-masuk': '<i class="bi bi-truck-flatbed me-2 text-primary"></i> Barang Masuk / Restock Pembelian',
      'stok-opname': '<i class="bi bi-clipboard2-check-fill me-2 text-danger"></i> Stok Opname (Setelah Istirahat Kedua)',
      'kas-harian': '<i class="bi bi-wallet2 me-2 text-emerald"></i> Kas Harian Kantin',
      'pengeluaran': '<i class="bi bi-cash-stack me-2 text-danger"></i> Pengeluaran Biaya Operasional',
      'hutang-supplier': '<i class="bi bi-receipt-cutoff me-2 text-orange"></i> Manajemen Hutang Supplier',
      'supplier': '<i class="bi bi-people-fill me-2 text-secondary"></i> Data Kontak Supplier',
      'laporan-keuntungan': '<i class="bi bi-graph-up-arrow me-2 text-success"></i> Laporan Keuntungan / Laba Rugi',
      'riwayat-transaksi': '<i class="bi bi-clock-history me-2 text-purple"></i> Riwayat Transaksi & Pembatalan',
      'laporan-bulanan': '<i class="bi bi-calendar3 me-2 text-primary"></i> Laporan Bulanan Kantin',
      'backup-restore': '<i class="bi bi-database-check me-2 text-teal"></i> Backup & Restore Data',
      'pengaturan': '<i class="bi bi-gear-fill me-2 text-secondary"></i> Pengaturan Akun & Usaha'
    };
    if (document.getElementById('page-title')) {
      document.getElementById('page-title').innerHTML = titles[viewName] || 'Kantin SMPN 77';
    }

    // Refresh view specific data
    if (viewName === 'dashboard') await this.refreshDashboard();
    if (viewName === 'penjualan') await POS.renderProducts();
    if (viewName === 'rekap-penjualan') await Rekap.loadRekap();
    if (viewName === 'master-produk') await MasterProduk.renderTable();
    if (viewName === 'stok-barang') await StokBarang.renderTable();
    if (viewName === 'barang-masuk') await BarangMasuk.renderTable();
    if (viewName === 'stok-opname') await StokOpname.loadOpnameTable();
    if (viewName === 'kas-harian') await KasHarian.renderTable();
    if (viewName === 'pengeluaran') await Pengeluaran.renderTable();
    if (viewName === 'hutang-supplier') await HutangSupplier.renderTable();
    if (viewName === 'supplier') await Supplier.renderTable();
    if (viewName === 'laporan-keuntungan') await LaporanLaba.loadReport();
    if (viewName === 'riwayat-transaksi') await RiwayatTransaksi.renderTable();
    if (viewName === 'laporan-bulanan') await LaporanBulanan.loadReport();

    // Close mobile drawer if opened
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
  },

  // Authentication Handlers
  async handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();

    const adminUser = await db.getSetting('admin_username', 'admin');
    const adminPass = await db.getSetting('admin_password', (await db.getSetting('staff_password', '123456')));

    const kasirUser = await db.getSetting('kasir_username', 'kasir');
    const kasirPass = await db.getSetting('kasir_password', '1234');
    const kasirName = await db.getSetting('kasir_name', 'Karyawan Kasir');

    let role = null;
    let displayName = '';

    if (user === adminUser && pass === adminPass) {
      role = 'admin';
      displayName = 'Administrator Kantin';
    } else if (user === kasirUser && pass === kasirPass) {
      role = 'kasir';
      displayName = kasirName;
    }

    if (role) {
      this.currentUser = { username: user, role, name: displayName, loggedAt: new Date().toISOString() };
      sessionStorage.setItem('kantin77_auth', JSON.stringify(this.currentUser));
      document.getElementById('login-overlay').classList.add('d-none');
      document.getElementById('login-password').value = '';
      this.applyUserRole(role);
      
      if (role === 'kasir') {
        await this.navigate('penjualan');
      } else {
        await this.navigate('dashboard');
        await this.refreshDashboard();
      }
    } else {
      alert('Username atau PIN salah! Silakan periksa kembali akun Anda.');
    }
  },

  applyUserRole(role) {
    if (role === 'kasir') {
      document.body.classList.add('user-role-kasir');
      const name = this.currentUser?.name || 'Karyawan Kasir';
      document.querySelectorAll('#user-display-name, #user-display-mobile').forEach(el => {
        el.innerHTML = `${name} <span class="badge bg-success" style="font-size: 9px;">KASIR</span>`;
      });
    } else {
      document.body.classList.remove('user-role-kasir');
      document.querySelectorAll('#user-display-name, #user-display-mobile').forEach(el => {
        el.innerHTML = `Administrator <span class="badge bg-primary" style="font-size: 9px;">ADMIN</span>`;
      });
    }
  },

  handleLogout() {
    if (confirm('Yakin ingin keluar dari akun kantin?')) {
      sessionStorage.removeItem('kantin77_auth');
      document.getElementById('login-overlay').classList.remove('d-none');
    }
  },

  togglePasswordVisibility(inputId) {
    const el = document.getElementById(inputId);
    el.type = el.type === 'password' ? 'text' : 'password';
  },

  // Fallback Otomatis untuk Logo Toko (Coba berbagai variasi nama file gambar)
  tryFallbackLogo(imgEl, fallbackIconId) {
    const candidates = [
      'logo.png',
      'logo.jpeg',
      'logo.jfif',
      'logo.webp',
      'Logo.jpg',
      'Logo.png',
      'Logo.jpeg',
      'assets/img/logo.jpg',
      'assets/img/logo.png',
      'assets/img/logo.jpeg'
    ];
    imgEl._fallbackIndex = (imgEl._fallbackIndex || 0);
    if (imgEl._fallbackIndex < candidates.length) {
      const nextSrc = candidates[imgEl._fallbackIndex++];
      imgEl.src = nextSrc;
    } else {
      // Jika semua nama file tidak ditemukan, sembunyikan gambar dan tampilkan ikon toko default
      imgEl.classList.add('d-none');
      if (fallbackIconId) {
        const icon = document.getElementById(fallbackIconId);
        if (icon) icon.classList.remove('d-none');
      }
    }
  },

  // Jam Digital Real-time di Header
  startLiveClock() {
    function updateClock() {
      const el = document.getElementById('live-time-display');
      if (el) {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        el.textContent = `${h}:${m}:${s} WIB`;
      }
    }
    updateClock();
    if (!this._clockInterval) {
      this._clockInterval = setInterval(updateClock, 1000);
    }
  },

  // Fitur Ganti Tanggal Operasional (Bisa pilih tanggal mana pun atau kembali ke Hari Ini)
  async changeOperationalDate() {
    const today = getLocalDateString();
    const newDate = prompt(
      `PENGATURAN TANGGAL OPERASIONAL KANTIN\n\nTanggal aktif saat ini: ${this.operationalDate}\nTanggal asli hari ini: ${today}\n\nMasukkan tanggal (format: YYYY-MM-DD, contoh: ${today}) atau kosongkan untuk kembali ke HARI INI:`,
      this.operationalDate
    );
    if (newDate === null) return; // Batal

    const targetDate = newDate.trim() || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      alert('Format tanggal salah! Gunakan format TAHUN-BULAN-TANGGAL (contoh: ' + today + ').');
      return;
    }

    this.operationalDate = targetDate;
    await db.setSetting('operational_date', this.operationalDate);

    // Update tampilan tanggal di seluruh modul
    document.querySelectorAll('#sidebar-op-date, #top-date-display, #opname-cur-date').forEach(el => {
      el.textContent = formatDateIndo(this.operationalDate);
      if (this.operationalDate !== today) {
        el.setAttribute('data-custom-date', 'true');
      } else {
        el.removeAttribute('data-custom-date');
      }
    });

    // Refresh data tampilan aktif
    await this.refreshDashboard();
    if (this.activeView === 'penjualan') await POS.renderProducts();
    if (this.activeView === 'rekap-penjualan') {
      const el = document.getElementById('rekap-filter-date');
      if (el) el.value = this.operationalDate;
      await Rekap.loadRekap();
    }
    if (this.activeView === 'stok-opname') await StokOpname.loadOpnameTable();
    if (this.activeView === 'kas-harian') {
      const el = document.getElementById('kas-filter-date');
      if (el) el.value = this.operationalDate;
      await KasHarian.renderTable();
    }
    if (this.activeView === 'pengeluaran') {
      const el = document.getElementById('expense-filter-date');
      if (el) el.value = this.operationalDate;
      await Pengeluaran.renderTable();
    }
    if (this.activeView === 'riwayat-transaksi') {
      const el = document.getElementById('history-filter-date');
      if (el) el.value = this.operationalDate;
      await RiwayatTransaksi.renderTable();
    }

    alert(`Tanggal operasional berhasil disetel ke:\n${formatDateIndo(this.operationalDate)}`);
  },

  // Dashboard Refresh Logic
  async refreshDashboard() {
    const today = this.operationalDate;
    
    // 1. Transactions Today
    const transactions = await db.getAll('transactions');
    const todayTrx = transactions.filter(t => t.date === today && t.status !== 'dibatalkan');
    
    let totalOmzet = 0;
    let totalHPP = 0;
    let totalItemsSold = 0;
    const productSoldCounts = {};

    todayTrx.forEach(t => {
      totalOmzet += t.total;
      totalHPP += (t.total_hpp || 0);
      t.items.forEach(item => {
        totalItemsSold += item.qty;
        if (!productSoldCounts[item.name]) {
          productSoldCounts[item.name] = { name: item.name, qty: 0, omzet: 0 };
        }
        productSoldCounts[item.name].qty += item.qty;
        productSoldCounts[item.name].omzet += item.subtotal;
      });
    });

    const labaKotor = totalOmzet - totalHPP;

    // 2. Expenses Today
    const expenses = await db.getAll('expenses');
    const todayExpenses = expenses.filter(e => e.date === today);
    let totalOpsExpense = 0;
    todayExpenses.forEach(e => totalOpsExpense += e.amount);

    const labaBersih = labaKotor - totalOpsExpense;

    // 3. Products & Stock Monitoring
    const products = await db.getAll('products');
    let totalAvailableStock = 0;
    let lowStockCount = 0;
    const lowStockItems = [];

    products.forEach(p => {
      totalAvailableStock += p.stock;
      if (p.stock <= p.min_stock) {
        lowStockCount++;
        lowStockItems.push(p);
      }
    });

    // 4. Kas Harian Balance
    const mutations = await db.getAll('cash_mutations');
    const todayMutations = mutations.filter(m => m.date === today);
    
    let cashBalance = 0;
    let cashTunai = 0;
    let cashNonTunai = 0;

    todayMutations.forEach(m => {
      if (m.type === 'in') {
        if (m.payment_method === 'tunai') cashTunai += m.amount;
        else cashNonTunai += m.amount;
      } else if (m.type === 'out') {
        if (m.payment_method === 'tunai') cashTunai -= m.amount;
      }
    });
    cashBalance = cashTunai; // Physical cash in drawer

    // Update Top Badges & Pills
    document.getElementById('top-quick-cash').textContent = formatRupiah(cashBalance);

    // Update Dashboard 5 Metric Cards
    // 1. Biru - Omzet
    document.getElementById('dash-omzet').textContent = formatRupiah(totalOmzet);
    // 2. Hijau - Keuntungan
    document.getElementById('dash-keuntungan-bersih').textContent = formatRupiah(labaBersih);
    document.getElementById('dash-keuntungan-kotor').textContent = formatRupiah(labaKotor);
    // 3. Merah - Pengeluaran
    document.getElementById('dash-pengeluaran').textContent = formatRupiah(totalOpsExpense);
    // 4. Oranye - Stok
    document.getElementById('dash-stok-total').textContent = `${totalAvailableStock} pcs`;
    document.getElementById('dash-stok-menipis').textContent = lowStockCount;
    // 5. Ungu - Transaksi
    document.getElementById('dash-transaksi-total').textContent = `${todayTrx.length} Trx`;
    document.getElementById('dash-barang-terjual').textContent = `${totalItemsSold} pcs`;

    // Secondary row metrics
    document.getElementById('dash-saldo-kas').textContent = formatRupiah(cashBalance);
    document.getElementById('dash-kas-tunai').textContent = formatRupiah(cashTunai);
    document.getElementById('dash-kas-nontunai').textContent = formatRupiah(cashNonTunai);
    document.getElementById('dash-hpp').textContent = formatRupiah(totalHPP);

    // Check Opname Status
    const opnames = await db.getAll('stock_opname');
    const todayOpname = opnames.find(o => o.date === today && o.status === 'closed');
    const opnameBadge = document.getElementById('dash-opname-status');
    if (todayOpname) {
      opnameBadge.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill"></i> Sudah Ditutup & Opname Selesai</span>';
    } else {
      opnameBadge.innerHTML = '<span class="text-warning"><i class="bi bi-clock-history"></i> Belum Tutup Harian (Tersedia Usai Istirahat 2)</span>';
    }

    // Low Stock Alert Badge in Sidebar
    const lowStockSidebarBadge = document.getElementById('badge-low-stock');
    if (lowStockCount > 0) {
      lowStockSidebarBadge.textContent = lowStockCount;
      lowStockSidebarBadge.style.display = 'inline-block';
    } else {
      lowStockSidebarBadge.style.display = 'none';
    }

    // Hutang Alert Badge in Sidebar
    const debts = await db.getAll('debts');
    const activeDebts = debts.filter(d => d.status !== 'lunas');
    const debtSidebarBadge = document.getElementById('badge-debt-count');
    if (activeDebts.length > 0) {
      debtSidebarBadge.textContent = activeDebts.length;
      debtSidebarBadge.style.display = 'inline-block';
    } else {
      debtSidebarBadge.style.display = 'none';
    }

    // Top Selling Products List
    const topListEl = document.getElementById('dash-top-products-list');
    const sortedProducts = Object.values(productSoldCounts).sort((a, b) => b.qty - a.qty).slice(0, 5);
    
    if (sortedProducts.length === 0) {
      topListEl.innerHTML = '<li class="list-group-item text-center text-muted py-4 small">Belum ada barang terjual hari ini.</li>';
    } else {
      topListEl.innerHTML = sortedProducts.map((p, idx) => `
        <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-0 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${idx === 0 ? 'bg-warning text-dark' : 'bg-light text-secondary'} rounded-circle" style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;">${idx + 1}</span>
            <div>
              <div class="fw-semibold text-navy small">${p.name}</div>
              <small class="text-muted" style="font-size: 11px;">Omzet: ${formatRupiah(p.omzet)}</small>
            </div>
          </div>
          <span class="badge bg-primary-subtle text-primary fw-bold">${p.qty} pcs</span>
        </li>
      `).join('');
    }

    // Low Stock Table
    const lowStockTbody = document.getElementById('dash-low-stock-table');
    if (lowStockItems.length === 0) {
      lowStockTbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">Semua stok barang dalam kondisi aman.</td></tr>';
    } else {
      lowStockTbody.innerHTML = lowStockItems.map(p => {
        const isOut = p.stock <= 0;
        return `
          <tr>
            <td class="ps-3 fw-bold text-secondary">${p.code}</td>
            <td class="fw-semibold text-navy">${p.name}</td>
            <td><span class="badge bg-light text-secondary border">${p.category}</span></td>
            <td class="text-center">${p.min_stock} ${p.unit}</td>
            <td class="text-center fw-bold ${isOut ? 'text-danger' : 'text-warning'}">${p.stock} ${p.unit}</td>
            <td class="text-center">
              <span class="badge ${isOut ? 'bg-danger' : 'bg-warning text-dark'}">
                ${isOut ? 'Habis' : 'Hampir Habis'}
              </span>
            </td>
            <td class="text-end pe-3">
              <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="BarangMasuk.openRestockForProduct(${p.id})">
                <i class="bi bi-plus"></i> Restock
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render 7-day Sales & Profit Chart
    this.renderWeeklyChart(transactions, expenses);
  },

  // 7-Day Chart rendering via Chart.js
  renderWeeklyChart(allTransactions, allExpenses) {
    const ctx = document.getElementById('chart-penjualan-harian');
    if (!ctx) return;

    // Generate last 7 dates
    const labels = [];
    const dateKeys = [];
    const omzetData = [];
    const profitData = [];

    const now = new Date(this.operationalDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const isoStr = d.toISOString().split('T')[0];
      dateKeys.push(isoStr);
      labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }));
    }

    dateKeys.forEach(dateStr => {
      const trxs = allTransactions.filter(t => t.date === dateStr && t.status !== 'dibatalkan');
      let dayOmzet = 0;
      let dayHPP = 0;
      trxs.forEach(t => {
        dayOmzet += t.total;
        dayHPP += (t.total_hpp || 0);
      });

      const exps = allExpenses.filter(e => e.date === dateStr);
      let dayOps = 0;
      exps.forEach(e => dayOps += e.amount);

      const dayProfit = (dayOmzet - dayHPP) - dayOps;

      omzetData.push(dayOmzet);
      profitData.push(dayProfit);
    });

    if (this.charts.weekly) {
      this.charts.weekly.destroy();
    }

    this.charts.weekly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Omzet Penjualan (Rp)',
            data: omzetData,
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'Keuntungan Bersih (Rp)',
            data: profitData,
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatRupiah(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => 'Rp ' + (val >= 1000 ? (val / 1000) + 'k' : val)
            }
          }
        }
      }
    });
  }
};

// ==================== 2. POS PENJUALAN HARIAN ====================
const POS = {
  cart: [],
  products: [],
  selectedCategory: '',
  paymentMethod: 'tunai',
  cashGiven: 0,
  activeOrder: null,

  async init() {
    this.renderCategoryPills();
  },

  renderCategoryPills() {
    const categories = [
      'Semua', 'Air mineral', 'Teh kemasan', 'Minuman rasa buah', 
      'Susu kemasan', 'Minuman lainnya', 'Keripik', 'Biskuit', 
      'Wafer', 'Permen', 'Cokelat', 'Snack lainnya'
    ];
    
    // Select dropdown in POS
    const selectEl = document.getElementById('pos-category-select');
    if (selectEl) {
      selectEl.innerHTML = categories.map(c => `<option value="${c === 'Semua' ? '' : c}">${c === 'Semua' ? 'Semua Kategori' : c}</option>`).join('');
    }

    // Quick scrollable pills
    const pillsEl = document.getElementById('pos-quick-pills');
    if (pillsEl) {
      pillsEl.innerHTML = categories.map(c => `
        <button type="button" class="pos-pill-btn ${c === 'Semua' ? 'active' : ''}" onclick="POS.selectCategory('${c === 'Semua' ? '' : c}', this)">
          ${c}
        </button>
      `).join('');
    }
  },

  selectCategory(cat, btn) {
    this.selectedCategory = cat;
    document.querySelectorAll('#pos-quick-pills .pos-pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    const select = document.getElementById('pos-category-select');
    if (select) select.value = cat;

    this.filterProducts();
  },

  async renderProducts() {
    this.products = await db.getAll('products');
    this.filterProducts();
  },

  filterProducts() {
    const searchVal = document.getElementById('pos-search').value.toLowerCase().trim();
    const selectCat = document.getElementById('pos-category-select').value;
    const cat = selectCat || this.selectedCategory;

    const filtered = this.products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || p.code.toLowerCase().includes(searchVal);
      const matchCat = !cat || p.category === cat;
      return matchSearch && matchCat;
    });

    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="bi bi-search fs-1 text-secondary opacity-50 mb-2 d-block"></i>
          <p>Produk tidak ditemukan.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const isOutOfStock = p.stock <= 0;
      const isLowStock = p.stock > 0 && p.stock <= p.min_stock;
      return `
        <div class="col-6 col-md-4 col-xl-3">
          <div class="pos-product-card p-2 h-100 ${isOutOfStock ? 'out-of-stock' : ''}" onclick="POS.addToCart(${p.id})">
            <span class="pos-product-stock-badge ${isOutOfStock ? 'bg-danger text-white' : isLowStock ? 'bg-warning text-dark' : 'bg-success text-white'}">
              Stok: ${p.stock}
            </span>
            <div class="pos-product-img rounded-2 mb-2">
              ${p.image ? `<img src="${p.image}" alt="${p.name}" class="w-100 h-100 object-fit-cover rounded-2">` : `<i class="bi bi-cup-straw"></i>`}
            </div>
            <div class="text-truncate fw-bold text-navy small mb-1" title="${p.name}">${p.name}</div>
            <div class="d-flex justify-content-between align-items-center">
              <span class="fw-bolder text-primary small">${formatRupiah(p.sell_price)}</span>
              <span class="text-muted" style="font-size: 11px;">/${p.unit}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
      alert(`Stok barang "${product.name}" telah habis! Tidak dapat dijual sebelum restock.`);
      return;
    }

    const existing = this.cart.find(item => item.id === productId);
    if (existing) {
      if (existing.qty + 1 > product.stock) {
        alert(`Jumlah pesanan melebihi sisa stok yang tersedia (${product.stock} ${product.unit}).`);
        return;
      }
      existing.qty += 1;
      existing.subtotal = existing.qty * existing.sell_price;
      existing.subtotal_hpp = existing.qty * existing.buy_price;
    } else {
      this.cart.push({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        unit: product.unit,
        buy_price: product.buy_price,
        sell_price: product.sell_price,
        qty: 1,
        subtotal: product.sell_price,
        subtotal_hpp: product.buy_price,
        maxStock: product.stock
      });
    }

    this.renderCart();
  },

  changeQty(productId, delta) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      this.cart = this.cart.filter(i => i.id !== productId);
    } else {
      if (newQty > item.maxStock) {
        alert(`Maksimal stok tersedia adalah ${item.maxStock}.`);
        return;
      }
      item.qty = newQty;
      item.subtotal = item.qty * item.sell_price;
      item.subtotal_hpp = item.qty * item.buy_price;
    }
    this.renderCart();
  },

  setDirectQty(productId, val) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    let qty = parseInt(val, 10);
    if (isNaN(qty) || qty <= 0) {
      if (confirm(`Hapus "${item.name}" dari keranjang belanja?`)) {
        this.cart = this.cart.filter(i => i.id !== productId);
        this.renderCart();
        return;
      } else {
        qty = 1;
      }
    }

    if (qty > item.maxStock) {
      alert(`Stok tidak mencukupi!\nMaksimal stok "${item.name}" yang tersedia adalah ${item.maxStock} ${item.unit}.`);
      qty = item.maxStock;
    }

    item.qty = qty;
    item.subtotal = item.qty * item.sell_price;
    item.subtotal_hpp = item.qty * item.buy_price;
    this.renderCart();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.id !== productId);
    this.renderCart();
  },

  clearCart() {
    if (this.cart.length > 0 && confirm('Kosongkan keranjang belanja kasir?')) {
      this.cart = [];
      this.renderCart();
    }
  },

  renderCart() {
    const listEl = document.getElementById('pos-cart-list');
    const totalItemsEl = document.getElementById('pos-total-items');
    const totalPriceEl = document.getElementById('pos-total-price');
    const checkoutBtn = document.getElementById('btn-pos-checkout');
    const badgeCartCount = document.getElementById('badge-cart-count');

    let totalQty = 0;
    let totalPrice = 0;

    if (this.cart.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-cart-x fs-1 d-block mb-2 text-secondary opacity-50"></i>
          <p class="mb-0 small">Keranjang masih kosong.<br>Sentuh produk di sebelah kiri untuk menambah pesanan.</p>
        </div>
      `;
      totalItemsEl.textContent = '0 item (0 jenis)';
      totalPriceEl.textContent = 'Rp 0';
      checkoutBtn.disabled = true;
      badgeCartCount.style.display = 'none';
      return;
    }

    this.cart.forEach(item => {
      totalQty += item.qty;
      totalPrice += item.subtotal;
    });

    listEl.innerHTML = this.cart.map(item => `
      <div class="pos-cart-item d-flex justify-content-between align-items-center">
        <div class="flex-grow-1 pe-2">
          <div class="fw-semibold text-navy small text-truncate" style="max-width: 170px;">${item.name}</div>
          <div class="text-muted small" style="font-size: 11px;">@${formatRupiah(item.sell_price)}</div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn btn-sm btn-outline-secondary pos-qty-btn" onclick="POS.changeQty(${item.id}, -1)" title="Kurang 1">-</button>
          <input type="number" class="form-control form-control-sm text-center fw-bold pos-cart-qty-input" 
                 value="${item.qty}" min="1" max="${item.maxStock}" 
                 title="Ketik jumlah langsung (contoh: 20, 50)"
                 onfocus="this.select()" 
                 onchange="POS.setDirectQty(${item.id}, this.value)" 
                 onkeyup="if(event.key === 'Enter') this.blur();"
                 style="width: 56px; height: 30px; padding: 2px 4px; font-size: 0.95rem;">
          <button type="button" class="btn btn-sm btn-outline-secondary pos-qty-btn" onclick="POS.changeQty(${item.id}, 1)" title="Tambah 1">+</button>
        </div>
        <div class="text-end ps-2" style="min-width: 75px;">
          <div class="fw-bold text-navy small">${formatRupiah(item.subtotal)}</div>
          <button class="btn btn-link text-danger p-0 border-0" style="font-size: 11px;" onclick="POS.removeFromCart(${item.id})">Hapus</button>
        </div>
      </div>
    `).join('');

    totalItemsEl.textContent = `${totalQty} item (${this.cart.length} jenis)`;
    totalPriceEl.textContent = formatRupiah(totalPrice);
    checkoutBtn.disabled = false;
    
    badgeCartCount.textContent = totalQty;
    badgeCartCount.style.display = 'inline-block';
  },

  openPaymentModal() {
    if (this.cart.length === 0) return;

    let totalPrice = 0;
    this.cart.forEach(i => totalPrice += i.subtotal);

    document.getElementById('pay-total-display').textContent = formatRupiah(totalPrice);
    document.getElementById('pay-cash-given').value = '';
    document.getElementById('pay-change-display').textContent = 'Rp 0';
    const empInput = document.getElementById('pay-employee-name');
    if (empInput) empInput.value = 'Karyawan Kantin';

    // Default to Tunai
    document.getElementById('pay-method-cash').checked = true;
    this.handleMethodChange();

    const modal = new bootstrap.Modal(document.getElementById('modal-payment'));
    modal.show();

    setTimeout(() => {
      document.getElementById('pay-cash-given').focus();
    }, 400);
  },

  handleMethodChange() {
    const isCash = document.getElementById('pay-method-cash').checked;
    const isKonsumsi = document.getElementById('pay-method-konsumsi')?.checked;

    if (isKonsumsi) {
      this.paymentMethod = 'konsumsi';
    } else if (isCash) {
      this.paymentMethod = 'tunai';
    } else {
      this.paymentMethod = 'non-tunai';
    }

    const cashFields = document.getElementById('cash-payment-fields');
    const cashlessFields = document.getElementById('cashless-payment-fields');
    const konsumsiFields = document.getElementById('konsumsi-payment-fields');
    const payTotalDisplay = document.getElementById('pay-total-display');
    const confirmBtn = document.getElementById('btn-confirm-payment');

    let totalPrice = 0;
    this.cart.forEach(i => totalPrice += i.subtotal);

    if (this.paymentMethod === 'konsumsi') {
      cashFields?.classList.add('d-none');
      cashlessFields?.classList.add('d-none');
      konsumsiFields?.classList.remove('d-none');
      if (payTotalDisplay) {
        payTotalDisplay.innerHTML = `<span class="badge bg-warning text-dark px-3 py-2 fs-5"><i class="bi bi-cup-hot-fill me-1"></i> Rp 0 (Gratis Karyawan)</span>`;
      }
      if (confirmBtn) {
        confirmBtn.className = 'btn btn-warning fw-bold px-4 text-dark shadow-sm';
        confirmBtn.innerHTML = '<i class="bi bi-cup-hot-fill me-1"></i> SIMPAN KONSUMSI KARYAWAN';
      }
    } else if (this.paymentMethod === 'tunai') {
      cashFields?.classList.remove('d-none');
      cashlessFields?.classList.add('d-none');
      konsumsiFields?.classList.add('d-none');
      if (payTotalDisplay) {
        payTotalDisplay.textContent = formatRupiah(totalPrice);
      }
      if (confirmBtn) {
        confirmBtn.className = 'btn btn-primary fw-bold px-4';
        confirmBtn.innerHTML = '<i class="bi bi-printer me-1"></i> SIMPAN & CETAK STRUK';
      }
      this.calculateChange();
    } else {
      cashFields?.classList.add('d-none');
      cashlessFields?.classList.remove('d-none');
      konsumsiFields?.classList.add('d-none');
      if (payTotalDisplay) {
        payTotalDisplay.textContent = formatRupiah(totalPrice);
      }
      if (confirmBtn) {
        confirmBtn.className = 'btn btn-primary fw-bold px-4';
        confirmBtn.innerHTML = '<i class="bi bi-printer me-1"></i> SIMPAN & CETAK STRUK';
      }
    }
  },

  setExactCash() {
    let totalPrice = 0;
    this.cart.forEach(i => totalPrice += i.subtotal);
    document.getElementById('pay-cash-given').value = totalPrice;
    this.calculateChange();
  },

  setCash(amount) {
    document.getElementById('pay-cash-given').value = amount;
    this.calculateChange();
  },

  calculateChange() {
    let totalPrice = 0;
    this.cart.forEach(i => totalPrice += i.subtotal);

    const cashGiven = parseNumber(document.getElementById('pay-cash-given').value);
    const change = cashGiven - totalPrice;
    const changeDisplay = document.getElementById('pay-change-display');

    if (change < 0) {
      changeDisplay.textContent = `Kurang ${formatRupiah(Math.abs(change))}`;
      changeDisplay.className = 'fw-bold mb-0 text-danger';
    } else {
      changeDisplay.textContent = formatRupiah(change);
      changeDisplay.className = 'fw-bold mb-0 text-success';
    }
  },

  // Save POS Transaction and Update Stock atomically
  async processPayment() {
    let totalPrice = 0;
    let totalHPP = 0;
    this.cart.forEach(i => {
      totalPrice += i.subtotal;
      totalHPP += i.subtotal_hpp;
    });

    const isKonsumsi = this.paymentMethod === 'konsumsi';
    const isCash = this.paymentMethod === 'tunai';
    
    let cashGiven = 0;
    let change = 0;
    let employeeName = '';

    if (isKonsumsi) {
      totalPrice = 0; // Karyawan tidak membayar, penjualan tunai = 0
      employeeName = document.getElementById('pay-employee-name')?.value.trim() || 'Karyawan Kantin';
    } else if (isCash) {
      cashGiven = parseNumber(document.getElementById('pay-cash-given').value);
      if (cashGiven < totalPrice) {
        alert(`Uang pembayaran kurang ${formatRupiah(totalPrice - cashGiven)}!`);
        return;
      }
      change = cashGiven - totalPrice;
    } else {
      cashGiven = totalPrice;
      change = 0;
    }

    const now = new Date();
    const dateStr = App.operationalDate;
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    const prefix = isKonsumsi ? 'KNS' : 'TRX';
    const orderNumber = `${prefix}-${dateStr.replace(/-/g, '')}-${now.getTime().toString().slice(-4)}`;

    const transactionData = {
      order_number: orderNumber,
      date: dateStr,
      time: timeStr,
      timestamp: now.getTime(),
      items: JSON.parse(JSON.stringify(this.cart)),
      total: totalPrice,
      total_hpp: isKonsumsi ? 0 : totalHPP, // Jika konsumsi, HPP dialihkan ke akun pengeluaran
      total_profit: isKonsumsi ? 0 : (totalPrice - totalHPP),
      payment_method: this.paymentMethod,
      employee_name: isKonsumsi ? employeeName : '',
      cash_given: cashGiven,
      change: change,
      status: 'selesai',
      cancel_reason: isKonsumsi ? `Konsumsi Karyawan: ${employeeName}` : ''
    };

    try {
      // 1. Verify stocks once more before updating
      for (const item of this.cart) {
        const prod = await db.get('products', item.id);
        if (!prod || prod.stock < item.qty) {
          alert(`Transaksi dibatalkan! Stok untuk "${item.name}" tidak mencukupi (sisa ${prod ? prod.stock : 0}).`);
          return;
        }
      }

      // 2. Decrement Stocks in DB (STOK OTOMATIS BERKURANG AGAR OPNAME AKURAT)
      for (const item of this.cart) {
        const prod = await db.get('products', item.id);
        prod.stock -= item.qty;
        await db.put('products', prod);
      }

      // 3. Save Transaction
      const trxId = await db.add('transactions', transactionData);
      transactionData.id = trxId;
      this.activeOrder = transactionData;

      // 4. Record Cash Mutation or Expense
      if (isKonsumsi) {
        // Otomatis catat ke tabel Pengeluaran (Beban Konsumsi Karyawan) sebesar HARGA MODAL (HPP)
        const itemDetails = this.cart.map(i => `${i.name} (x${i.qty})`).join(', ');
        await db.add('expenses', {
          date: dateStr,
          category: 'Konsumsi Karyawan',
          amount: totalHPP,
          payment_method: 'internal',
          notes: `Konsumsi: ${employeeName} - ${itemDetails} (No. #${orderNumber})`,
          ref_id: trxId
        });
      } else {
        // Record Cash Mutation for cash / cashless
        await db.add('cash_mutations', {
          date: dateStr,
          time: timeStr,
          timestamp: now.getTime(),
          type: 'in',
          category: isCash ? 'penjualan_tunai' : 'penjualan_nontunai',
          payment_method: this.paymentMethod,
          amount: totalPrice,
          description: `Penjualan Kasir #${orderNumber} (${this.cart.length} item)`,
          ref_id: trxId
        });
      }

      // Close Payment Modal
      bootstrap.Modal.getInstance(document.getElementById('modal-payment'))?.hide();

      // Clear Cart
      this.cart = [];
      this.renderCart();

      // Refresh Products & Dashboard
      await this.renderProducts();
      await App.refreshDashboard();

      // Show Thermal Receipt Modal
      this.showReceiptModal(transactionData);

    } catch (err) {
      console.error('Payment error:', err);
      alert('Terjadi kesalahan saat memproses pembayaran: ' + err.message);
    }
  },

  showReceiptModal(order) {
    this.renderReceipt(order);
    const receiptModal = new bootstrap.Modal(document.getElementById('modal-receipt'));
    receiptModal.show();
  },

  async renderReceipt(order) {
    const canteenName = await db.getSetting('canteen_name', 'SISTEM KANTIN SMPN 77');
    const schoolAddress = await db.getSetting('canteen_address', 'SMPN 77 Jakarta');
    const footerMsg = await db.getSetting('receipt_footer', 'Terima kasih atas kunjungannya!');

    const container = document.getElementById('receipt-content');
    if (!container) return;

    container.innerHTML = `
      <div class="text-center mb-2">
        <img src="logo.jpg" alt="Logo" class="rounded-circle mb-1" style="width: 44px; height: 44px; object-fit: cover;" onerror="if(!this.triedPng){this.triedPng=true; this.src='logo.png';}else{this.style.display='none';}">
        <h6 class="fw-bold mb-0 text-uppercase">${canteenName}</h6>
        <div style="font-size: 11px;">${schoolAddress}</div>
        <div style="font-size: 10px;">Telp/WA: 0812-9876-5432</div>
      </div>
      <div class="receipt-divider"></div>
      <div class="d-flex justify-content-between" style="font-size: 11px;">
        <span>No: ${order.order_number}</span>
        <span>${order.date} ${order.time}</span>
      </div>
      <div class="receipt-divider"></div>
      <div>
        ${order.items.map(item => `
          <div class="d-flex justify-content-between">
            <span class="text-truncate" style="max-width: 170px;">${item.name}</span>
            <span>${formatRupiah(item.subtotal)}</span>
          </div>
          <div class="text-muted" style="font-size: 10px;">${item.qty} x ${formatRupiah(item.sell_price)}</div>
        `).join('')}
      </div>
      <div class="receipt-divider"></div>
      <div class="d-flex justify-content-between fw-bold">
        <span>TOTAL</span>
        <span>${order.payment_method === 'konsumsi' ? 'Rp 0 (GRATIS)' : formatRupiah(order.total)}</span>
      </div>
      <div class="d-flex justify-content-between" style="font-size: 11px;">
        <span>Metode:</span>
        <span class="text-uppercase fw-semibold">${order.payment_method === 'konsumsi' ? 'KONSUMSI KARYAWAN' : order.payment_method}</span>
      </div>
      ${order.payment_method === 'konsumsi' ? `
        <div class="text-center my-2 p-1 bg-light border fw-bold text-uppercase" style="font-size: 11px;">
          ☕ KONSUMSI KARYAWAN (GRATIS)
        </div>
        <div class="d-flex justify-content-between" style="font-size: 11px;">
          <span>Penerima:</span>
          <span class="fw-semibold">${order.employee_name || 'Karyawan Kantin'}</span>
        </div>
      ` : ''}
      ${order.payment_method === 'tunai' ? `
        <div class="d-flex justify-content-between" style="font-size: 11px;">
          <span>Bayar:</span>
          <span>${formatRupiah(order.cash_given)}</span>
        </div>
        <div class="d-flex justify-content-between" style="font-size: 11px;">
          <span>Kembali:</span>
          <span>${formatRupiah(order.change)}</span>
        </div>
      ` : ''}
      <div class="receipt-double-divider"></div>
      <div class="text-center mt-2" style="font-size: 10px; white-space: pre-line;">
        ${footerMsg}
      </div>
    `;
  },

  printReceiptNow() {
    document.body.classList.add('printing-receipt');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-receipt');
    }, 500);
  }
};

// ==================== 3. REKAP PENJUALAN ====================
const Rekap = {
  async init() {
    document.getElementById('rekap-filter-date').value = App.operationalDate;
    await this.loadCategories();
  },

  async loadCategories() {
    const products = await db.getAll('products');
    const categories = Array.from(new Set(products.map(p => p.category)));
    const select = document.getElementById('rekap-filter-category');
    if (select) {
      select.innerHTML = '<option value="">Semua Kategori</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  },

  async loadRekap() {
    const filterDate = document.getElementById('rekap-filter-date').value || App.operationalDate;
    const filterCat = document.getElementById('rekap-filter-category').value;

    const transactions = await db.getAll('transactions');
    const dayTrxs = transactions.filter(t => t.date === filterDate && t.status !== 'dibatalkan');

    const productSalesMap = {};
    let totalQty = 0;
    let totalOmzet = 0;
    let totalModal = 0;
    let totalProfit = 0;

    dayTrxs.forEach(t => {
      t.items.forEach(item => {
        if (filterCat && item.category !== filterCat) return;

        if (!productSalesMap[item.id]) {
          productSalesMap[item.id] = {
            id: item.id,
            code: item.code,
            name: item.name,
            category: item.category,
            buy_price: item.buy_price,
            sell_price: item.sell_price,
            qty: 0,
            omzet: 0,
            modal: 0,
            profit: 0
          };
        }
        productSalesMap[item.id].qty += item.qty;
        productSalesMap[item.id].omzet += item.subtotal;
        productSalesMap[item.id].modal += item.subtotal_hpp;
        productSalesMap[item.id].profit += (item.subtotal - item.subtotal_hpp);

        totalQty += item.qty;
        totalOmzet += item.subtotal;
        totalModal += item.subtotal_hpp;
        totalProfit += (item.subtotal - item.subtotal_hpp);
      });
    });

    // Update Summary Header Cards
    document.getElementById('rekap-total-trx').textContent = dayTrxs.length;
    document.getElementById('rekap-total-qty').textContent = `${totalQty} pcs`;
    document.getElementById('rekap-total-omzet').textContent = formatRupiah(totalOmzet);
    document.getElementById('rekap-total-profit').textContent = formatRupiah(totalProfit);

    // Identify Best Seller, Worst Seller, Top Drink, Top Snack
    const itemsArray = Object.values(productSalesMap);
    itemsArray.sort((a, b) => b.qty - a.qty);

    const drinkCats = ['Air mineral', 'Teh kemasan', 'Minuman rasa buah', 'Susu kemasan', 'Minuman lainnya'];
    const snackCats = ['Keripik', 'Biskuit', 'Wafer', 'Permen', 'Cokelat', 'Snack lainnya'];

    const topDrink = itemsArray.find(i => drinkCats.includes(i.category));
    const topSnack = itemsArray.find(i => snackCats.includes(i.category));

    document.getElementById('rekap-best-seller').textContent = itemsArray.length > 0 ? `${itemsArray[0].name} (${itemsArray[0].qty} pcs)` : '-';
    document.getElementById('rekap-worst-seller').textContent = itemsArray.length > 1 ? `${itemsArray[itemsArray.length - 1].name} (${itemsArray[itemsArray.length - 1].qty} pcs)` : '-';
    document.getElementById('rekap-top-drink').textContent = topDrink ? `${topDrink.name} (${topDrink.qty} pcs)` : '-';
    document.getElementById('rekap-top-snack').textContent = topSnack ? `${topSnack.name} (${topSnack.qty} pcs)` : '-';

    // Render Table
    const tbody = document.getElementById('rekap-table-body');
    if (itemsArray.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">Tidak ada penjualan pada tanggal dan kategori yang dipilih.</td></tr>';
    } else {
      tbody.innerHTML = itemsArray.map((i, idx) => `
        <tr>
          <td class="ps-3 text-center">${idx + 1}</td>
          <td class="fw-bold text-secondary">${i.code}</td>
          <td class="fw-semibold text-navy">${i.name}</td>
          <td><span class="badge bg-light text-secondary border">${i.category}</span></td>
          <td class="text-center fw-bold">${i.qty}</td>
          <td class="text-end">${formatRupiah(i.buy_price)}</td>
          <td class="text-end">${formatRupiah(i.sell_price)}</td>
          <td class="text-end fw-bold text-blue">${formatRupiah(i.omzet)}</td>
          <td class="text-end text-muted">${formatRupiah(i.modal)}</td>
          <td class="text-end pe-3 fw-bold text-green">${formatRupiah(i.profit)}</td>
        </tr>
      `).join('');
    }

    // Footers
    document.getElementById('rekap-foot-qty').textContent = totalQty;
    document.getElementById('rekap-foot-omzet').textContent = formatRupiah(totalOmzet);
    document.getElementById('rekap-foot-modal').textContent = formatRupiah(totalModal);
    document.getElementById('rekap-foot-profit').textContent = formatRupiah(totalProfit);
  },

  exportExcel() {
    const table = document.getElementById('table-rekap-penjualan');
    const wb = XLSX.utils.table_to_book(table, { sheet: "Rekap Penjualan" });
    const curDate = document.getElementById('rekap-filter-date').value || App.operationalDate;
    XLSX.writeFile(wb, `Rekap_Penjualan_Kantin_SMPN77_${curDate}.xlsx`);
  },

  printReport() {
    window.print();
  }
};

// ==================== 4. MASTER PRODUK ====================
const MasterProduk = {
  currentEditId: null,

  async init() {
    await this.loadCategoryFilter();
    await this.renderTable();
  },

  async loadCategoryFilter() {
    const select = document.getElementById('prod-filter-cat');
    if (!select) return;
    const cats = [
      'Air mineral', 'Teh kemasan', 'Minuman rasa buah', 'Susu kemasan', 
      'Minuman lainnya', 'Keripik', 'Biskuit', 'Wafer', 'Permen', 
      'Cokelat', 'Snack lainnya'
    ];
    select.innerHTML = '<option value="">Semua Kategori</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  async renderTable() {
    const products = await db.getAll('products');
    const searchVal = document.getElementById('prod-search').value.toLowerCase().trim();
    const filterCat = document.getElementById('prod-filter-cat').value;

    const filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || p.code.toLowerCase().includes(searchVal);
      const matchCat = !filterCat || p.category === filterCat;
      return matchSearch && matchCat;
    });

    const tbody = document.getElementById('master-produk-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">Belum ada data produk atau tidak sesuai pencarian.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const profit = p.sell_price - p.buy_price;
      const isOut = p.stock <= 0;
      const isLow = p.stock > 0 && p.stock <= p.min_stock;
      return `
        <tr>
          <td class="ps-3 text-center">
            ${p.image ? `<img src="${p.image}" class="rounded border" style="width: 32px; height: 32px; object-fit: cover;">` : `<i class="bi bi-image text-muted fs-5"></i>`}
          </td>
          <td class="fw-bold text-secondary">${p.code}</td>
          <td class="fw-semibold text-navy">${p.name}</td>
          <td><span class="badge bg-light text-secondary border">${p.category}</span></td>
          <td class="text-end">${formatRupiah(p.buy_price)}</td>
          <td class="text-end fw-bold text-primary">${formatRupiah(p.sell_price)}</td>
          <td class="text-end text-success fw-semibold">+${formatRupiah(profit)}</td>
          <td class="text-center">${p.min_stock}</td>
          <td class="text-center fw-bold ${isOut ? 'text-danger' : isLow ? 'text-warning' : 'text-success'}" style="cursor: pointer;" onclick="MasterProduk.quickEditStock(${p.id})" title="Klik untuk ubah stok cepat">
            ${p.stock} <i class="bi bi-pencil-fill text-muted opacity-50" style="font-size: 10px;"></i>
          </td>
          <td>${p.unit}</td>
          <td class="text-end pe-3">
            <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="MasterProduk.openModal(${p.id})" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="MasterProduk.deleteProduct(${p.id})" title="Hapus">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openModal(id = null) {
    this.currentEditId = id;
    const form = document.getElementById('form-product');
    form.reset();
    document.getElementById('prod-image-data').value = '';
    document.getElementById('prod-image-preview-wrapper').style.display = 'none';

    if (id) {
      document.getElementById('modal-product-title').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Produk & Stok';
      const lblStock = document.getElementById('label-prod-stock');
      if (lblStock) lblStock.textContent = 'Jumlah Stok Tersedia Saat Ini';
      db.get('products', id).then(prod => {
        if (!prod) return;
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-code').value = prod.code;
        document.getElementById('prod-name').value = prod.name;
        document.getElementById('prod-category').value = prod.category;
        document.getElementById('prod-unit').value = prod.unit;
        document.getElementById('prod-buy-price').value = prod.buy_price;
        document.getElementById('prod-sell-price').value = prod.sell_price;
        document.getElementById('prod-initial-stock').value = prod.stock !== undefined ? prod.stock : (prod.initial_stock || 0);
        document.getElementById('prod-min-stock').value = prod.min_stock;
        this.calculateProfit();

        if (prod.image) {
          document.getElementById('prod-image-data').value = prod.image;
          document.getElementById('prod-image-preview').src = prod.image;
          document.getElementById('prod-image-preview-wrapper').style.display = 'block';
        }
      });
    } else {
      document.getElementById('modal-product-title').innerHTML = '<i class="bi bi-box-seam me-2"></i>Tambah Produk Baru';
      const lblStock = document.getElementById('label-prod-stock');
      if (lblStock) lblStock.textContent = 'Stok Awal';
      document.getElementById('prod-id').value = '';
      this.calculateProfit();
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-product'));
    modal.show();
  },

  calculateProfit() {
    const buy = parseNumber(document.getElementById('prod-buy-price').value);
    const sell = parseNumber(document.getElementById('prod-sell-price').value);
    const profit = sell - buy;
    document.getElementById('prod-profit').value = formatRupiah(profit);
  },

  previewImage(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('prod-image-data').value = e.target.result;
        document.getElementById('prod-image-preview').src = e.target.result;
        document.getElementById('prod-image-preview-wrapper').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = this.currentEditId ? parseInt(this.currentEditId) : null;
    const code = document.getElementById('prod-code').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const unit = document.getElementById('prod-unit').value;
    const buy_price = parseNumber(document.getElementById('prod-buy-price').value);
    const sell_price = parseNumber(document.getElementById('prod-sell-price').value);
    const initial_stock = parseNumber(document.getElementById('prod-initial-stock').value);
    const min_stock = parseNumber(document.getElementById('prod-min-stock').value);
    const image = document.getElementById('prod-image-data').value || null;

    if (sell_price < buy_price) {
      if (!confirm('Harga jual lebih kecil dari harga modal (potensi rugi). Lanjutkan menyimpan?')) return;
    }

    let prodObj;
    if (id) {
      prodObj = await db.get('products', id);
      prodObj.code = code;
      prodObj.name = name;
      prodObj.category = category;
      prodObj.unit = unit;
      prodObj.buy_price = buy_price;
      prodObj.sell_price = sell_price;
      prodObj.profit = sell_price - buy_price;
      prodObj.min_stock = min_stock;
      prodObj.stock = initial_stock;          // Perbarui stok langsung saat diedit
      prodObj.initial_stock = initial_stock;  // Perbarui stok awal
      if (image) prodObj.image = image;
      await db.put('products', prodObj);

      if (window.API && window.API.isOnline) {
        await API.request(`/api/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            code, name, category, buy_price, sell_price, min_stock, stock: initial_stock, unit, image: prodObj.image
          })
        });
      }
    } else {
      prodObj = {
        code,
        name,
        category,
        unit,
        buy_price,
        sell_price,
        profit: sell_price - buy_price,
        initial_stock,
        min_stock,
        stock: initial_stock,
        image
      };
      const newId = await db.add('products', prodObj);
      if (window.API && window.API.isOnline) {
        await API.request('/api/products', {
          method: 'POST',
          body: JSON.stringify(prodObj)
        });
      }
    }

    bootstrap.Modal.getInstance(document.getElementById('modal-product'))?.hide();
    await this.renderTable();
    await StokBarang.renderTable();
    await POS.renderProducts();
    await App.refreshDashboard();
  },

  async quickEditStock(id) {
    const prod = await db.get('products', id);
    if (!prod) return;
    const newStockStr = prompt(`Ubah Jumlah Stok untuk "${prod.name}":`, prod.stock);
    if (newStockStr === null) return;
    const newStock = parseInt(newStockStr, 10);
    if (isNaN(newStock) || newStock < 0) {
      alert('Jumlah stok harus berupa angka 0 atau lebih!');
      return;
    }
    prod.stock = newStock;
    prod.initial_stock = newStock;
    await db.put('products', prod);

    if (window.API && window.API.isOnline) {
      await API.request(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(prod)
      });
    }

    await this.renderTable();
    await StokBarang.renderTable();
    await POS.renderProducts();
    await App.refreshDashboard();
  },

  async deleteProduct(id) {
    const prod = await db.get('products', id);
    if (!prod) return;

    if (confirm(`Hapus produk "${prod.name}" (${prod.code}) dari master data?`)) {
      await db.delete('products', id);
      await this.renderTable();
      await POS.renderProducts();
      await App.refreshDashboard();
    }
  },

  async exportExcel() {
    const products = await db.getAll('products');
    const exportData = products.map(p => ({
      "Kode Produk": p.code,
      "Nama Produk": p.name,
      "Kategori": p.category,
      "Harga Modal": p.buy_price,
      "Harga Jual": p.sell_price,
      "Keuntungan": p.sell_price - p.buy_price,
      "Stok Minimum": p.min_stock,
      "Stok Tersedia": p.stock,
      "Satuan": p.unit
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Produk");
    XLSX.writeFile(wb, `Master_Produk_Kantin_SMPN77_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  async importExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

        if (rows.length === 0) {
          alert('File Excel kosong atau format kolom tidak sesuai.');
          return;
        }

        let importedCount = 0;
        for (const row of rows) {
          const code = row['Kode Produk'] || row['kode'] || `PROD-${Date.now().toString().slice(-4)}`;
          const name = row['Nama Produk'] || row['nama'];
          if (!name) continue;

          const category = row['Kategori'] || 'Snack lainnya';
          const buy_price = parseNumber(row['Harga Modal'] || row['modal'] || 0);
          const sell_price = parseNumber(row['Harga Jual'] || row['jual'] || 0);
          const stock = parseNumber(row['Stok Tersedia'] || row['Stok'] || row['stok'] || 0);
          const min_stock = parseNumber(row['Stok Minimum'] || 5);
          const unit = row['Satuan'] || 'Pcs';

          await db.add('products', {
            code,
            name,
            category,
            buy_price,
            sell_price,
            profit: sell_price - buy_price,
            initial_stock: stock,
            stock,
            min_stock,
            unit,
            image: null
          });
          importedCount++;
        }

        alert(`Berhasil mengimpor ${importedCount} produk dari file Excel!`);
        e.target.value = '';
        await MasterProduk.renderTable();
        await POS.renderProducts();
        await App.refreshDashboard();
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
};

// ==================== 5. STOK BARANG ====================
const StokBarang = {
  async init() {
    await this.renderTable();
  },

  async renderTable() {
    const products = await db.getAll('products');
    const searchVal = document.getElementById('stok-search').value.toLowerCase().trim();
    const filterStatus = document.getElementById('stok-filter-status').value;

    const today = App.operationalDate;
    const transactions = await db.getAll('transactions');
    const dayTrxs = transactions.filter(t => t.date === today && t.status !== 'dibatalkan');

    const restocks = await db.getAll('restocks');
    const dayRestocks = restocks.filter(r => r.date === today);

    // Calculate product sold & restocked today
    const soldMap = {};
    dayTrxs.forEach(t => {
      t.items.forEach(i => {
        soldMap[i.id] = (soldMap[i.id] || 0) + i.qty;
      });
    });

    const restockMap = {};
    dayRestocks.forEach(r => {
      restockMap[r.product_id] = (restockMap[r.product_id] || 0) + r.qty;
    });

    const filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || p.code.toLowerCase().includes(searchVal);
      let status = 'aman';
      if (p.stock <= 0) status = 'habis';
      else if (p.stock <= p.min_stock) status = 'hampir_habis';

      const matchStatus = !filterStatus || status === filterStatus;
      return matchSearch && matchStatus;
    });

    const tbody = document.getElementById('stok-barang-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">Tidak ada data stok yang sesuai filter.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((p, idx) => {
      const masuk = restockMap[p.id] || 0;
      const terjual = soldMap[p.id] || 0;
      // Formula: Stok Tersedia = Stok Awal + Masuk - Terjual
      // In persistent DB, p.initial_stock is retained from morning opening
      const stokAwal = p.initial_stock !== undefined ? p.initial_stock : (p.stock + terjual - masuk);

      let statusBadge = '<span class="badge bg-success">Aman</span>';
      if (p.stock <= 0) {
        statusBadge = '<span class="badge bg-danger">Habis</span>';
      } else if (p.stock <= p.min_stock) {
        statusBadge = '<span class="badge bg-warning text-dark">Hampir Habis</span>';
      }

      return `
        <tr>
          <td class="ps-3 text-center">${idx + 1}</td>
          <td class="fw-bold text-secondary">${p.code}</td>
          <td class="fw-semibold text-navy">${p.name}</td>
          <td><span class="badge bg-light text-secondary border">${p.category}</span></td>
          <td class="text-center">${stokAwal} ${p.unit}</td>
          <td class="text-center text-primary fw-semibold">+${masuk}</td>
          <td class="text-center text-danger fw-semibold">-${terjual}</td>
          <td class="text-center fw-bold fs-6 ${p.stock <= 0 ? 'text-danger' : p.stock <= p.min_stock ? 'text-warning' : 'text-navy'}" style="cursor: pointer;" onclick="MasterProduk.quickEditStock(${p.id})" title="Klik untuk ubah stok langsung">
            ${p.stock} ${p.unit} <i class="bi bi-pencil-fill ms-1 text-muted opacity-50" style="font-size: 10px;"></i>
          </td>
          </td>
          <td class="text-center text-muted">${p.min_stock}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-end pe-3">
            <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="BarangMasuk.openRestockForProduct(${p.id})">
              <i class="bi bi-plus-circle me-1"></i> Restock
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
};

// ==================== 6. BARANG MASUK / RESTOCK ====================
const BarangMasuk = {
  async init() {
    document.getElementById('restock-date').value = App.operationalDate;
    await this.renderTable();
  },

  async renderTable() {
    const restocks = await db.getAll('restocks');
    const filterDate = document.getElementById('restock-filter-date').value;
    const searchVal = document.getElementById('restock-search').value.toLowerCase().trim();

    const filtered = restocks.filter(r => {
      const matchDate = !filterDate || r.date === filterDate;
      const matchSearch = r.supplier_name.toLowerCase().includes(searchVal) || r.product_name.toLowerCase().includes(searchVal);
      return matchDate && matchSearch;
    });

    const tbody = document.getElementById('restock-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">Belum ada riwayat barang masuk / restock.</td></tr>';
      return;
    }

    filtered.sort((a, b) => b.id - a.id);

    tbody.innerHTML = filtered.map(r => `
      <tr>
        <td class="ps-3 fw-bold text-secondary">${r.invoice_no}</td>
        <td>${formatDateIndo(r.date)}</td>
        <td class="fw-semibold text-navy">${r.supplier_name}</td>
        <td>${r.product_name}</td>
        <td class="text-center fw-bold text-success">+${r.qty}</td>
        <td class="text-end">${formatRupiah(r.buy_price)}</td>
        <td class="text-end fw-bold text-navy">${formatRupiah(r.total)}</td>
        <td class="text-center">
          <span class="badge ${r.payment_method === 'tunai' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'}">
            ${r.payment_method === 'tunai' ? 'Tunai (Kas)' : 'Tempo (Hutang)'}
          </span>
        </td>
        <td class="text-center">
          <span class="badge ${r.payment_status === 'lunas' ? 'bg-success' : 'bg-danger'}">
            ${r.payment_status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
          </span>
        </td>
        <td class="small text-muted">${r.notes || '-'}</td>
      </tr>
    `).join('');
  },

  async openModal() {
    const suppliers = await db.getAll('suppliers');
    const products = await db.getAll('products');

    const suppSelect = document.getElementById('restock-supplier');
    suppSelect.innerHTML = '<option value="">Pilih Supplier...</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const prodSelect = document.getElementById('restock-product');
    prodSelect.innerHTML = '<option value="">Pilih Produk...</option>' + products.map(p => `<option value="${p.id}" data-buy="${p.buy_price}">${p.name} (Stok: ${p.stock})</option>`).join('');

    document.getElementById('form-restock').reset();
    document.getElementById('restock-date').value = App.operationalDate;
    document.getElementById('restock-qty').value = '';
    document.getElementById('restock-buy-price').value = '';
    document.getElementById('restock-total-display').value = 'Rp 0';
    this.handleMethodChange();

    const modal = new bootstrap.Modal(document.getElementById('modal-restock'));
    modal.show();
  },

  async openRestockForProduct(productId) {
    await this.openModal();
    const prodSelect = document.getElementById('restock-product');
    prodSelect.value = productId;
    this.handleProductSelect();
  },

  async handleProductSelect() {
    const prodSelect = document.getElementById('restock-product');
    const opt = prodSelect.options[prodSelect.selectedIndex];
    if (opt && opt.value) {
      const buyPrice = opt.getAttribute('data-buy');
      document.getElementById('restock-buy-price').value = buyPrice || 0;
      this.calculateTotal();
    }
  },

  calculateTotal() {
    const qty = parseNumber(document.getElementById('restock-qty').value);
    const buyPrice = parseNumber(document.getElementById('restock-buy-price').value);
    const total = qty * buyPrice;
    document.getElementById('restock-total-display').value = formatRupiah(total);
  },

  handleMethodChange() {
    const method = document.getElementById('restock-payment-method').value;
    const tempoFields = document.getElementById('restock-tempo-fields');
    if (method === 'tempo') {
      tempoFields.classList.remove('d-none');
      const d = new Date(App.operationalDate);
      d.setDate(d.getDate() + 7); // Default tempo 7 days
      document.getElementById('restock-due-date').value = d.toISOString().split('T')[0];
    } else {
      tempoFields.classList.add('d-none');
    }
  },

  async saveRestock(e) {
    e.preventDefault();
    const date = document.getElementById('restock-date').value;
    const suppId = parseInt(document.getElementById('restock-supplier').value);
    const prodId = parseInt(document.getElementById('restock-product').value);
    const qty = parseNumber(document.getElementById('restock-qty').value);
    const buyPrice = parseNumber(document.getElementById('restock-buy-price').value);
    const method = document.getElementById('restock-payment-method').value;
    const dueDate = document.getElementById('restock-due-date').value;
    const notes = document.getElementById('restock-notes').value.trim();

    if (qty <= 0 || buyPrice < 0) {
      alert('Jumlah dan harga beli harus valid!');
      return;
    }

    const supplier = await db.get('suppliers', suppId);
    const product = await db.get('products', prodId);
    const total = qty * buyPrice;
    const invoiceNo = `PB-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    const restockData = {
      invoice_no: invoiceNo,
      date,
      supplier_id: suppId,
      supplier_name: supplier ? supplier.name : 'Supplier Umum',
      product_id: prodId,
      product_name: product ? product.name : 'Barang',
      qty,
      buy_price: buyPrice,
      total,
      payment_method: method,
      payment_status: method === 'tunai' ? 'lunas' : 'belum',
      due_date: method === 'tempo' ? dueDate : null,
      notes
    };

    // 1. Save restock log
    const restockId = await db.add('restocks', restockData);

    // 2. Increment stock in products store
    if (product) {
      product.stock += qty;
      product.buy_price = buyPrice; // Update latest cost price
      product.profit = product.sell_price - buyPrice;
      await db.put('products', product);
    }

    // 3. Financial Integration
    if (method === 'tunai') {
      // Deduct cash from drawer
      await db.add('cash_mutations', {
        date,
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        timestamp: Date.now(),
        type: 'out',
        category: 'restock_tunai',
        payment_method: 'tunai',
        amount: total,
        description: `Pembelian stok tunai: ${product.name} (${qty} ${product.unit}) #${invoiceNo}`,
        ref_id: restockId
      });
    } else {
      // Record in Hutang Supplier store
      await db.add('debts', {
        restock_id: restockId,
        supplier_id: suppId,
        supplier_name: supplier ? supplier.name : 'Supplier',
        invoice_no: invoiceNo,
        date,
        total,
        paid: 0,
        remaining: total,
        due_date: dueDate,
        status: 'belum',
        payments: []
      });
    }

    bootstrap.Modal.getInstance(document.getElementById('modal-restock'))?.hide();
    alert(`Restock berhasil! Stok ${product.name} bertambah ${qty} ${product.unit}.`);

    await this.renderTable();
    await StokBarang.renderTable();
    await MasterProduk.renderTable();
    await POS.renderProducts();
    await HutangSupplier.renderTable();
    await App.refreshDashboard();
  }
};

// ==================== 7. STOK OPNAME (SETELAH ISTIRAHAT KEDUA) ====================
const StokOpname = {
  currentOpnameItems: [],

  async init() {
    await this.loadOpnameTable();
  },

  async loadOpnameTable() {
    const today = App.operationalDate;
    document.getElementById('opname-cur-date').textContent = formatDateIndo(today);

    // Check if daily closure already made for today
    const closures = await db.getAll('daily_closures');
    const closed = closures.find(c => c.date === today);
    const badge = document.getElementById('opname-status-badge');
    const confirmBtn = document.getElementById('btn-konfirmasi-tutup-harian');

    if (closed) {
      badge.className = 'badge bg-secondary';
      badge.textContent = 'Sudah Ditutup';
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="bi bi-lock-fill me-1"></i> TRANSAKSI HARI INI SUDAH DITUTUP';
    } else {
      badge.className = 'badge bg-success';
      badge.textContent = 'Terbuka (Siap Opname Istirahat 2)';
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="bi bi-lock-fill me-1"></i> KONFIRMASI & TUTUP HARIAN';
    }

    const products = await db.getAll('products');
    const transactions = await db.getAll('transactions');
    const dayTrxs = transactions.filter(t => t.date === today && t.status !== 'dibatalkan');

    const restocks = await db.getAll('restocks');
    const dayRestocks = restocks.filter(r => r.date === today);

    // Sum sold & restock per product
    const soldMap = {};
    dayTrxs.forEach(t => {
      t.items.forEach(i => {
        soldMap[i.id] = (soldMap[i.id] || 0) + i.qty;
      });
    });

    const restockMap = {};
    dayRestocks.forEach(r => {
      restockMap[r.product_id] = (restockMap[r.product_id] || 0) + r.qty;
    });

    // Check if draft opname exists for today
    const opnames = await db.getAll('stock_opname');
    const existingDraft = opnames.find(o => o.date === today);

    this.currentOpnameItems = products.map((p, idx) => {
      const masuk = restockMap[p.id] || 0;
      const terjual = soldMap[p.id] || 0;
      const stokAwal = p.initial_stock !== undefined ? p.initial_stock : (p.stock + terjual - masuk);
      // Rumus Stok Akhir Sistem = Stok Awal + Barang Masuk - Total Terjual
      const sistemStock = stokAwal + masuk - terjual;

      let savedItem = null;
      if (existingDraft && existingDraft.items) {
        savedItem = existingDraft.items.find(i => i.productId === p.id);
      }

      const fisikStock = savedItem ? savedItem.physical_stock : p.stock;
      const selisih = fisikStock - sistemStock;
      const diffReason = savedItem ? savedItem.diff_reason : 'Cocok';

      return {
        no: idx + 1,
        productId: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stokAwal,
        masuk,
        terjual,
        sistemStock,
        fisikStock,
        selisih,
        diffReason
      };
    });

    this.renderOpnameRows();
  },

  renderOpnameRows() {
    const tbody = document.getElementById('opname-tbody');
    let hasDifference = false;

    tbody.innerHTML = this.currentOpnameItems.map((item, idx) => {
      const diff = item.selisih;
      if (diff !== 0) hasDifference = true;

      const diffClass = diff === 0 ? 'diff-zero' : diff > 0 ? 'diff-positive' : 'diff-negative';
      const diffText = diff > 0 ? `+${diff}` : `${diff}`;

      return `
        <tr>
          <td class="text-center">${item.no}</td>
          <td class="fw-semibold text-navy">
            ${item.name}
            <div class="text-muted" style="font-size: 11px;">${item.code} &bull; ${item.unit}</div>
          </td>
          <td class="text-center">${item.stokAwal}</td>
          <td class="text-center text-primary fw-semibold">+${item.masuk}</td>
          <td class="text-center text-danger fw-semibold">-${item.terjual}</td>
          <td class="text-center fw-bold bg-primary-subtle text-primary">${item.sistemStock}</td>
          <td class="text-center bg-warning-subtle">
            <input type="number" class="input-opname-fisik" value="${item.fisikStock}" min="0" oninput="StokOpname.handleFisikChange(${idx}, this.value)">
          </td>
          <td class="text-center ${diffClass}" id="opname-diff-${idx}">${diffText}</td>
          <td>
            <select class="form-select form-select-sm" id="opname-reason-${idx}" onchange="StokOpname.handleReasonChange(${idx}, this.value)">
              <option value="Cocok" ${item.diffReason === 'Cocok' ? 'selected' : ''}>Cocok / Sesuai</option>
              <option value="Barang rusak" ${item.diffReason === 'Barang rusak' ? 'selected' : ''}>Barang rusak</option>
              <option value="Barang hilang" ${item.diffReason === 'Barang hilang' ? 'selected' : ''}>Barang hilang</option>
              <option value="Kesalahan pencatatan" ${item.diffReason === 'Kesalahan pencatatan' ? 'selected' : ''}>Kesalahan pencatatan</option>
              <option value="Barang diberikan gratis" ${item.diffReason === 'Barang diberikan gratis' ? 'selected' : ''}>Barang diberikan gratis</option>
              <option value="Koreksi lainnya" ${item.diffReason === 'Koreksi lainnya' ? 'selected' : ''}>Koreksi lainnya</option>
            </select>
          </td>
        </tr>
      `;
    }).join('');

    const diffAlert = document.getElementById('opname-diff-alert');
    if (hasDifference) {
      diffAlert.classList.remove('d-none');
    } else {
      diffAlert.classList.add('d-none');
    }
  },

  handleFisikChange(idx, val) {
    const item = this.currentOpnameItems[idx];
    if (!item) return;

    item.fisikStock = parseNumber(val);
    item.selisih = item.fisikStock - item.sistemStock;

    const diffEl = document.getElementById(`opname-diff-${idx}`);
    if (diffEl) {
      diffEl.textContent = item.selisih > 0 ? `+${item.selisih}` : `${item.selisih}`;
      diffEl.className = `text-center ${item.selisih === 0 ? 'diff-zero' : item.selisih > 0 ? 'diff-positive' : 'diff-negative'}`;
    }

    // Auto set reason if difference exists and still 'Cocok'
    const reasonSelect = document.getElementById(`opname-reason-${idx}`);
    if (item.selisih !== 0 && item.diffReason === 'Cocok') {
      item.diffReason = 'Kesalahan pencatatan';
      if (reasonSelect) reasonSelect.value = 'Kesalahan pencatatan';
    } else if (item.selisih === 0) {
      item.diffReason = 'Cocok';
      if (reasonSelect) reasonSelect.value = 'Cocok';
    }

    // Recheck difference alert
    const hasDiff = this.currentOpnameItems.some(i => i.selisih !== 0);
    const diffAlert = document.getElementById('opname-diff-alert');
    if (hasDiff) diffAlert.classList.remove('d-none');
    else diffAlert.classList.add('d-none');
  },

  handleReasonChange(idx, val) {
    if (this.currentOpnameItems[idx]) {
      this.currentOpnameItems[idx].diffReason = val;
    }
  },

  samakanSemuaStokFisik() {
    this.currentOpnameItems.forEach((item, idx) => {
      item.fisikStock = item.sistemStock;
      item.selisih = 0;
      item.diffReason = 'Cocok';
    });
    this.renderOpnameRows();
  },

  async simpanDraft() {
    const today = App.operationalDate;
    const opnames = await db.getAll('stock_opname');
    let existing = opnames.find(o => o.date === today);

    const data = {
      date: today,
      items: this.currentOpnameItems,
      status: 'draft',
      updated_at: new Date().toISOString()
    };

    if (existing) {
      data.id = existing.id;
      await db.put('stock_opname', data);
    } else {
      await db.add('stock_opname', data);
    }

    alert('Hasil perhitungan stok opname berhasil disimpan sebagai draf.');
  },

  async konfirmasiTutupHarian() {
    const today = App.operationalDate;
    const closures = await db.getAll('daily_closures');
    if (closures.some(c => c.date === today)) {
      alert('Transaksi hari ini sudah pernah ditutup!');
      return;
    }

    const hasDiff = this.currentOpnameItems.some(i => i.selisih !== 0);
    let confirmMsg = 'Apakah Anda yakin ingin mengonfirmasi hasil Stok Opname dan MENUTUP TRANSAKSI HARIAN KANTIN?';
    if (hasDiff) {
      confirmMsg = 'PERINGATAN: Terdapat selisih stok fisik pada beberapa barang! Sistem akan mencatat selisih tersebut dan memperbarui stok fisik akhir.\n\nLanjutkan konfirmasi dan tutup transaksi?';
    }

    if (!confirm(confirmMsg)) return;

    try {
      // 1. Calculate Daily Totals
      const transactions = await db.getAll('transactions');
      const dayTrxs = transactions.filter(t => t.date === today && t.status !== 'dibatalkan');
      
      let totalOmzet = 0;
      let totalCashSales = 0;
      let totalCashlessSales = 0;
      let totalHPP = 0;

      dayTrxs.forEach(t => {
        totalOmzet += t.total;
        totalHPP += (t.total_hpp || 0);
        if (t.payment_method === 'tunai') totalCashSales += t.total;
        else totalCashlessSales += t.total;
      });

      const expenses = await db.getAll('expenses');
      const dayExpenses = expenses.filter(e => e.date === today);
      let totalExpenses = 0;
      dayExpenses.forEach(e => totalExpenses += e.amount);

      const grossProfit = totalOmzet - totalHPP;
      const netProfit = grossProfit - totalExpenses;

      // 2. Save Opname as Closed
      const opnames = await db.getAll('stock_opname');
      let existingOpname = opnames.find(o => o.date === today);
      const opnameRecord = {
        date: today,
        items: this.currentOpnameItems,
        status: 'closed',
        closed_at: new Date().toISOString()
      };
      let opnameId;
      if (existingOpname) {
        opnameRecord.id = existingOpname.id;
        await db.put('stock_opname', opnameRecord);
        opnameId = existingOpname.id;
      } else {
        opnameId = await db.add('stock_opname', opnameRecord);
      }

      // 3. Update physical stock in products store
      // Sesuai aturan: Stok fisik akhir menjadi stok awal hari berikutnya!
      for (const item of this.currentOpnameItems) {
        const prod = await db.get('products', item.productId);
        if (prod) {
          prod.stock = item.fisikStock;
          prod.initial_stock = item.fisikStock; // Rollover for tomorrow
          await db.put('products', prod);
        }
      }

      // 4. Save Daily Closure Archive
      await db.add('daily_closures', {
        date: today,
        closed_at: new Date().toISOString(),
        opening_cash: await db.getSetting('default_initial_cash', 200000),
        total_omzet: totalOmzet,
        total_cash_sales: totalCashSales,
        total_cashless_sales: totalCashlessSales,
        total_hpp: totalHPP,
        gross_profit: grossProfit,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        opname_id: opnameId
      });

      alert(`TUTUP HARIAN BERHASIL!\n\nOmzet Hari Ini: ${formatRupiah(totalOmzet)}\nKeuntungan Bersih: ${formatRupiah(netProfit)}\nStok fisik akhir berhasil disimpan dan menjadi stok awal hari esok.`);

      await this.loadOpnameTable();
      await StokBarang.renderTable();
      await MasterProduk.renderTable();
      await POS.renderProducts();
      await App.refreshDashboard();

    } catch (err) {
      console.error('Closing error:', err);
      alert('Gagal menutup transaksi harian: ' + err.message);
    }
  },

  printReport() {
    window.print();
  }
};

// ==================== 8. KAS HARIAN ====================
const KasHarian = {
  async init() {
    document.getElementById('kas-filter-date').value = App.operationalDate;
    await this.renderTable();
  },

  async renderTable() {
    const filterDate = document.getElementById('kas-filter-date').value || App.operationalDate;
    const mutations = await db.getAll('cash_mutations');
    const dayMutations = mutations.filter(m => m.date === filterDate);

    // Initial cash setting
    const defaultInitialCash = await db.getSetting('default_initial_cash', 200000);

    let saldoAwal = 0;
    let totalIn = 0;
    let totalOut = 0;
    let cashSales = 0;
    let otherIn = 0;
    let restockOut = 0;
    let opsOut = 0;
    let nonTunai = 0;

    // Check if initial cash recorded
    const modalMut = dayMutations.find(m => m.category === 'modal_awal');
    saldoAwal = modalMut ? modalMut.amount : defaultInitialCash;

    dayMutations.sort((a, b) => a.timestamp - b.timestamp);

    let runningBalance = saldoAwal;

    const tbody = document.getElementById('kas-mutasi-tbody');
    if (dayMutations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada mutasi kas pada tanggal ini.</td></tr>';
    } else {
      tbody.innerHTML = dayMutations.map(m => {
        const isTunai = m.payment_method === 'tunai';
        if (m.type === 'in') {
          if (isTunai) {
            totalIn += m.amount;
            if (m.category === 'penjualan_tunai') cashSales += m.amount;
            else otherIn += m.amount;
            if (m.category !== 'modal_awal') runningBalance += m.amount;
          } else {
            nonTunai += m.amount;
          }
        } else if (m.type === 'out') {
          if (isTunai) {
            totalOut += m.amount;
            if (m.category === 'restock_tunai') restockOut += m.amount;
            else opsOut += m.amount;
            runningBalance -= m.amount;
          }
        }

        return `
          <tr>
            <td class="ps-3">${m.time || '-'}</td>
            <td>
              <span class="badge ${m.type === 'in' ? 'bg-success' : 'bg-danger'}">
                ${m.type === 'in' ? 'Masuk' : 'Keluar'}
              </span>
            </td>
            <td><span class="badge bg-light text-secondary border text-capitalize">${m.category.replace(/_/g, ' ')}</span></td>
            <td class="small fw-semibold text-navy">${m.description}</td>
            <td class="text-end text-success fw-bold">${m.type === 'in' ? formatRupiah(m.amount) : '-'}</td>
            <td class="text-end text-danger fw-bold">${m.type === 'out' ? formatRupiah(m.amount) : '-'}</td>
            <td class="text-end pe-3 fw-bold text-navy">${isTunai ? formatRupiah(runningBalance) : '<span class="text-muted small">Non-Tunai</span>'}</td>
          </tr>
        `;
      }).join('');
    }

    // Summary Card updates
    document.getElementById('kas-saldo-awal').textContent = formatRupiah(saldoAwal);
    document.getElementById('kas-total-in').textContent = formatRupiah(totalIn);
    document.getElementById('kas-penjualan-tunai').textContent = formatRupiah(cashSales);
    document.getElementById('kas-in-lain').textContent = formatRupiah(otherIn);
    document.getElementById('kas-total-out').textContent = formatRupiah(totalOut);
    document.getElementById('kas-beli-tunai').textContent = formatRupiah(restockOut);
    document.getElementById('kas-ops').textContent = formatRupiah(opsOut);

    // Saldo Akhir Kas = Saldo Awal + Penerimaan Tunai - Pengeluaran Tunai
    const saldoAkhir = saldoAwal + totalIn - totalOut;
    document.getElementById('kas-saldo-akhir').textContent = formatRupiah(saldoAkhir);
    document.getElementById('kas-saldo-nontunai').textContent = formatRupiah(nonTunai);
  },

  openModal(type) {
    document.getElementById('kas-manual-type').value = type;
    document.getElementById('kas-manual-date').value = App.operationalDate;
    document.getElementById('kas-manual-amount').value = '';
    document.getElementById('kas-manual-desc').value = '';

    const titleEl = document.getElementById('modal-kas-title');
    if (type === 'in') {
      titleEl.innerHTML = '<i class="bi bi-plus-circle me-2 text-success"></i>Tambah Kas Masuk Lainnya';
    } else {
      titleEl.innerHTML = '<i class="bi bi-dash-circle me-2 text-danger"></i>Tambah Kas Keluar Lainnya';
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-kas-manual'));
    modal.show();
  },

  async saveManualEntry(e) {
    e.preventDefault();
    const type = document.getElementById('kas-manual-type').value;
    const date = document.getElementById('kas-manual-date').value;
    const amount = parseNumber(document.getElementById('kas-manual-amount').value);
    const desc = document.getElementById('kas-manual-desc').value.trim();

    if (amount <= 0) {
      alert('Jumlah uang harus lebih dari 0!');
      return;
    }

    const now = new Date();
    await db.add('cash_mutations', {
      date,
      time: now.toTimeString().split(' ')[0].substring(0, 5),
      timestamp: now.getTime(),
      type,
      category: type === 'in' ? 'manual_in' : 'manual_out',
      payment_method: 'tunai',
      amount,
      description: desc,
      ref_id: `MANUAL-${now.getTime().toString().slice(-4)}`
    });

    bootstrap.Modal.getInstance(document.getElementById('modal-kas-manual'))?.hide();
    await this.renderTable();
    await App.refreshDashboard();
  },

  printReport() {
    window.print();
  }
};

// ==================== 9. PENGELUARAN OPERASIONAL ====================
const Pengeluaran = {
  async init() {
    document.getElementById('expense-filter-date').value = App.operationalDate;
    await this.renderTable();
  },

  async renderTable() {
    const expenses = await db.getAll('expenses');
    const filterDate = document.getElementById('expense-filter-date').value;
    const filterCat = document.getElementById('expense-filter-cat').value;

    const filtered = expenses.filter(e => {
      const matchDate = !filterDate || e.date === filterDate;
      const matchCat = !filterCat || e.category === filterCat;
      return matchDate && matchCat;
    });

    let totalExpense = 0;
    const tbody = document.getElementById('expense-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada pengeluaran operasional.</td></tr>';
    } else {
      filtered.sort((a, b) => b.id - a.id);
      tbody.innerHTML = filtered.map((e, idx) => {
        totalExpense += e.amount;
        return `
          <tr>
            <td class="ps-3 text-center">${idx + 1}</td>
            <td>${formatDateIndo(e.date)}</td>
            <td><span class="badge bg-secondary-subtle text-secondary border">${e.category}</span></td>
            <td class="fw-semibold text-navy">${e.notes || '-'}</td>
            <td class="text-center"><span class="badge bg-light text-dark border text-uppercase">${e.payment_method}</span></td>
            <td class="text-end fw-bold text-danger">${formatRupiah(e.amount)}</td>
            <td class="text-end pe-3">
              <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="Pengeluaran.deleteExpense(${e.id})" title="Hapus">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('expense-total-display').textContent = formatRupiah(totalExpense);
  },

  openModal() {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-date').value = App.operationalDate;
    const modal = new bootstrap.Modal(document.getElementById('modal-expense'));
    modal.show();
  },

  async saveExpense(e) {
    e.preventDefault();
    const date = document.getElementById('exp-date').value;
    const category = document.getElementById('exp-category').value;
    const amount = parseNumber(document.getElementById('exp-amount').value);
    const method = document.getElementById('exp-method').value;
    const notes = document.getElementById('exp-notes').value.trim();

    if (amount <= 0) {
      alert('Jumlah biaya pengeluaran harus lebih dari 0!');
      return;
    }

    const expId = await db.add('expenses', {
      date,
      category,
      amount,
      payment_method: method,
      notes
    });

    // If paid via cash, deduct from Kas
    if (method === 'tunai') {
      const now = new Date();
      await db.add('cash_mutations', {
        date,
        time: now.toTimeString().split(' ')[0].substring(0, 5),
        timestamp: now.getTime(),
        type: 'out',
        category: 'operasional',
        payment_method: 'tunai',
        amount,
        description: `Biaya Operasional: ${category} - ${notes}`,
        ref_id: expId
      });
    }

    bootstrap.Modal.getInstance(document.getElementById('modal-expense'))?.hide();
    await this.renderTable();
    await KasHarian.renderTable();
    await App.refreshDashboard();
  },

  async deleteExpense(id) {
    if (confirm('Hapus catatan pengeluaran operasional ini?')) {
      await db.delete('expenses', id);
      await this.renderTable();
      await KasHarian.renderTable();
      await App.refreshDashboard();
    }
  }
};

// ==================== 10. HUTANG SUPPLIER ====================
const HutangSupplier = {
  async init() {
    await this.renderTable();
  },

  async renderTable() {
    const debts = await db.getAll('debts');

    let totalAll = 0;
    let totalPaid = 0;
    let totalRem = 0;

    const tbody = document.getElementById('hutang-tbody');
    if (debts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada tagihan hutang supplier berjalan.</td></tr>';
    } else {
      debts.sort((a, b) => b.id - a.id);
      tbody.innerHTML = debts.map(d => {
        totalAll += d.total;
        totalPaid += d.paid;
        totalRem += d.remaining;

        const isLunas = d.remaining <= 0;
        return `
          <tr>
            <td class="ps-3 fw-bold text-secondary">${d.invoice_no || '-'}</td>
            <td class="fw-semibold text-navy">${d.supplier_name}</td>
            <td>${formatDateIndo(d.due_date)}</td>
            <td class="text-end">${formatRupiah(d.total)}</td>
            <td class="text-end text-success">${formatRupiah(d.paid)}</td>
            <td class="text-end fw-bold ${isLunas ? 'text-success' : 'text-danger'}">${formatRupiah(d.remaining)}</td>
            <td class="text-center">
              <span class="badge ${isLunas ? 'bg-success' : 'bg-warning text-dark'}">
                ${isLunas ? 'Lunas' : 'Belum Lunas'}
              </span>
            </td>
            <td class="text-end pe-3">
              ${!isLunas ? `
                <button class="btn btn-sm btn-success py-0 px-2 fw-semibold" onclick="HutangSupplier.openPayModal(${d.id})">
                  <i class="bi bi-cash me-1"></i> Bayar
                </button>
              ` : '<span class="text-muted small">Selesai</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('hutang-total-all').textContent = formatRupiah(totalAll);
    document.getElementById('hutang-total-paid').textContent = formatRupiah(totalPaid);
    document.getElementById('hutang-total-rem').textContent = formatRupiah(totalRem);
  },

  async openPayModal(debtId) {
    const debt = await db.get('debts', debtId);
    if (!debt) return;

    document.getElementById('debt-id').value = debt.id;
    document.getElementById('debt-modal-supp-name').textContent = debt.supplier_name;
    document.getElementById('debt-modal-rem-amount').textContent = formatRupiah(debt.remaining);
    document.getElementById('debt-pay-amount').value = debt.remaining;

    const modal = new bootstrap.Modal(document.getElementById('modal-pay-debt'));
    modal.show();
  },

  async processPayment(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('debt-id').value);
    const amount = parseNumber(document.getElementById('debt-pay-amount').value);
    const source = document.getElementById('debt-pay-source').value;

    const debt = await db.get('debts', id);
    if (!debt) return;

    if (amount <= 0 || amount > debt.remaining) {
      alert(`Jumlah pembayaran harus antara 1 sampai sisa hutang (${formatRupiah(debt.remaining)})!`);
      return;
    }

    debt.paid += amount;
    debt.remaining -= amount;
    if (debt.remaining <= 0) {
      debt.remaining = 0;
      debt.status = 'lunas';
    }

    debt.payments.push({
      date: App.operationalDate,
      amount,
      source,
      paid_at: new Date().toISOString()
    });

    await db.put('debts', debt);

    // If paid via Kas Tunai, deduct cash
    if (source === 'kas') {
      const now = new Date();
      await db.add('cash_mutations', {
        date: App.operationalDate,
        time: now.toTimeString().split(' ')[0].substring(0, 5),
        timestamp: now.getTime(),
        type: 'out',
        category: 'bayar_hutang',
        payment_method: 'tunai',
        amount,
        description: `Bayar hutang tempo supplier ${debt.supplier_name} (#${debt.invoice_no})`,
        ref_id: id
      });
    }

    bootstrap.Modal.getInstance(document.getElementById('modal-pay-debt'))?.hide();
    alert(`Pembayaran hutang supplier sebesar ${formatRupiah(amount)} berhasil dicatat.`);

    await this.renderTable();
    await KasHarian.renderTable();
    await App.refreshDashboard();
  }
};

// ==================== 11. DATA SUPPLIER ====================
const Supplier = {
  currentEditId: null,

  async init() {
    await this.renderTable();
  },

  async renderTable() {
    const suppliers = await db.getAll('suppliers');
    const debts = await db.getAll('debts');
    const searchVal = document.getElementById('supplier-search').value.toLowerCase().trim();

    // Map remaining debts to supplier
    const debtMap = {};
    debts.forEach(d => {
      debtMap[d.supplier_id] = (debtMap[d.supplier_id] || 0) + d.remaining;
    });

    const filtered = suppliers.filter(s => s.name.toLowerCase().includes(searchVal));

    const tbody = document.getElementById('supplier-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada data supplier.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((s, idx) => {
      const sisaHutang = debtMap[s.id] || 0;
      return `
        <tr>
          <td class="ps-3 text-center">${idx + 1}</td>
          <td class="fw-semibold text-navy">${s.name}</td>
          <td><a href="tel:${s.phone}" class="text-decoration-none text-primary"><i class="bi bi-telephone me-1"></i>${s.phone || '-'}</a></td>
          <td>${s.address || '-'}</td>
          <td class="text-end fw-bold ${sisaHutang > 0 ? 'text-danger' : 'text-success'}">${formatRupiah(sisaHutang)}</td>
          <td class="small text-muted">${s.notes || '-'}</td>
          <td class="text-end pe-3">
            <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="Supplier.openModal(${s.id})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="Supplier.deleteSupplier(${s.id})"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openModal(id = null) {
    this.currentEditId = id;
    document.getElementById('form-supplier').reset();

    if (id) {
      document.getElementById('modal-supplier-title').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Data Supplier';
      db.get('suppliers', id).then(s => {
        if (!s) return;
        document.getElementById('supp-id').value = s.id;
        document.getElementById('supp-name').value = s.name;
        document.getElementById('supp-phone').value = s.phone;
        document.getElementById('supp-address').value = s.address;
        document.getElementById('supp-notes').value = s.notes || '';
      });
    } else {
      document.getElementById('modal-supplier-title').innerHTML = '<i class="bi bi-people me-2"></i>Tambah Supplier Baru';
      document.getElementById('supp-id').value = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-supplier'));
    modal.show();
  },

  async saveSupplier(e) {
    e.preventDefault();
    const id = this.currentEditId ? parseInt(this.currentEditId) : null;
    const name = document.getElementById('supp-name').value.trim();
    const phone = document.getElementById('supp-phone').value.trim();
    const address = document.getElementById('supp-address').value.trim();
    const notes = document.getElementById('supp-notes').value.trim();

    if (id) {
      const s = await db.get('suppliers', id);
      s.name = name;
      s.phone = phone;
      s.address = address;
      s.notes = notes;
      await db.put('suppliers', s);
    } else {
      await db.add('suppliers', { name, phone, address, notes });
    }

    bootstrap.Modal.getInstance(document.getElementById('modal-supplier'))?.hide();
    await this.renderTable();
  },

  async deleteSupplier(id) {
    if (confirm('Hapus supplier ini?')) {
      await db.delete('suppliers', id);
      await this.renderTable();
    }
  }
};

// ==================== 12. LAPORAN KEUNTUNGAN / LABA RUGI ====================
const LaporanLaba = {
  async init() {
    await this.loadReport();
  },

  handlePeriodChange() {
    const val = document.getElementById('laba-period-select').value;
    const customFields = document.querySelectorAll('.laba-custom-date');
    if (val === 'custom') {
      customFields.forEach(el => el.classList.remove('d-none'));
    } else {
      customFields.forEach(el => el.classList.add('d-none'));
    }
    this.loadReport();
  },

  async loadReport() {
    const period = document.getElementById('laba-period-select').value;
    const today = App.operationalDate;

    let startDate = today;
    let endDate = today;

    if (period === 'minggu_ini') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
    } else if (period === 'bulan_ini') {
      startDate = today.substring(0, 7) + '-01';
      endDate = today;
    } else if (period === 'custom') {
      startDate = document.getElementById('laba-date-start').value || today;
      endDate = document.getElementById('laba-date-end').value || today;
    }

    const transactions = await db.getAll('transactions');
    const inRangeTrxs = transactions.filter(t => t.date >= startDate && t.date <= endDate && t.status !== 'dibatalkan');

    let totalOmzet = 0;
    let totalHPP = 0;
    inRangeTrxs.forEach(t => {
      totalOmzet += t.total;
      totalHPP += (t.total_hpp || 0);
    });

    const expenses = await db.getAll('expenses');
    const inRangeExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
    let totalOps = 0;
    inRangeExpenses.forEach(e => totalOps += e.amount);

    const labaKotor = totalOmzet - totalHPP;
    const labaBersih = labaKotor - totalOps;

    // Margins
    const marginKotor = totalOmzet > 0 ? ((labaKotor / totalOmzet) * 100).toFixed(1) : 0;
    const marginBersih = totalOmzet > 0 ? ((labaBersih / totalOmzet) * 100).toFixed(1) : 0;

    document.getElementById('lr-omzet').textContent = formatRupiah(totalOmzet);
    document.getElementById('lr-hpp').textContent = `(${formatRupiah(totalHPP)})`;
    document.getElementById('lr-laba-kotor').textContent = formatRupiah(labaKotor);
    document.getElementById('lr-biaya-ops').textContent = `(${formatRupiah(totalOps)})`;
    document.getElementById('lr-laba-bersih').textContent = formatRupiah(labaBersih);

    document.getElementById('lr-margin-kotor').textContent = `${marginKotor}%`;
    document.getElementById('lr-progress-kotor').style.width = `${Math.min(marginKotor, 100)}%`;

    document.getElementById('lr-margin-bersih').textContent = `${marginBersih}%`;
    document.getElementById('lr-progress-bersih').style.width = `${Math.min(marginBersih, 100)}%`;
  },

  exportExcel() {
    const wb = XLSX.utils.book_new();
    const data = [
      ["LAPORAN LABA RUGI OPERASIONAL KANTIN SMPN 77"],
      ["Komponen", "Nilai (Rp)"],
      ["Total Omzet Penjualan", document.getElementById('lr-omzet').textContent],
      ["Harga Pokok Penjualan (HPP Modal Barang Terjual)", document.getElementById('lr-hpp').textContent],
      ["Laba Kotor", document.getElementById('lr-laba-kotor').textContent],
      ["Pengeluaran Biaya Operasional", document.getElementById('lr-biaya-ops').textContent],
      ["Laba Bersih Kantin", document.getElementById('lr-laba-bersih').textContent]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Laba Rugi");
    XLSX.writeFile(wb, `Laporan_Laba_Rugi_SMPN77_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  printReport() {
    window.print();
  }
};

// ==================== 13. RIWAYAT TRANSAKSI ====================
const RiwayatTransaksi = {
  selectedTrx: null,

  async init() {
    document.getElementById('history-filter-date').value = App.operationalDate;
    await this.renderTable();
  },

  async renderTable() {
    const transactions = await db.getAll('transactions');
    const filterDate = document.getElementById('history-filter-date').value;
    const filterStatus = document.getElementById('history-filter-status').value;
    const searchVal = document.getElementById('history-search').value.toLowerCase().trim();

    const filtered = transactions.filter(t => {
      const matchDate = !filterDate || t.date === filterDate;
      const matchStatus = !filterStatus 
        ? true 
        : filterStatus === 'konsumsi' 
          ? (t.payment_method === 'konsumsi' && t.status !== 'dibatalkan')
          : (filterStatus === 'selesai' ? (t.status === 'selesai' && t.payment_method !== 'konsumsi') : t.status === filterStatus);
      const matchSearch = t.order_number.toLowerCase().includes(searchVal) || (t.employee_name && t.employee_name.toLowerCase().includes(searchVal));
      return matchDate && matchStatus && matchSearch;
    });

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const tbody = document.getElementById('history-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Tidak ada data transaksi.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(t => {
      const itemNames = t.items.map(i => `${i.name} (x${i.qty})`).join(', ');
      const isCancelled = t.status === 'dibatalkan';
      const isKonsumsi = t.payment_method === 'konsumsi';

      const methodBadge = isKonsumsi 
        ? `<span class="badge bg-warning text-dark border border-warning fw-semibold"><i class="bi bi-cup-hot-fill me-1 text-danger"></i>Konsumsi</span>`
        : `<span class="badge bg-light text-dark border text-uppercase">${t.payment_method}</span>`;

      return `
        <tr class="${isCancelled ? 'table-danger text-muted' : ''}">
          <td class="ps-3 fw-bold ${isCancelled ? 'text-danger' : isKonsumsi ? 'text-warning' : 'text-primary'}">${t.order_number}</td>
          <td>${formatDateIndo(t.date)} ${t.time}</td>
          <td class="small text-truncate" style="max-width: 250px;" title="${itemNames}">${itemNames}</td>
          <td class="text-center">${methodBadge}</td>
          <td class="text-end fw-bold ${isCancelled ? 'text-decoration-line-through text-muted' : isKonsumsi ? 'text-warning' : 'text-navy'}">
            ${isKonsumsi ? '<span class="badge bg-light text-dark border">Rp 0 (Gratis)</span>' : formatRupiah(t.total)}
          </td>
          <td class="text-center">
            <span class="badge ${isCancelled ? 'bg-danger' : isKonsumsi ? 'bg-warning text-dark' : 'bg-success'}">
              ${isCancelled ? 'Dibatalkan' : isKonsumsi ? 'Konsumsi' : 'Selesai'}
            </span>
          </td>
          <td class="text-end pe-3">
            <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="RiwayatTransaksi.showDetail(${t.id})">
              <i class="bi bi-eye me-1"></i> Rincian
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async showDetail(id) {
    const trx = await db.get('transactions', id);
    if (!trx) return;
    this.selectedTrx = trx;

    const detailBody = document.getElementById('trx-detail-body');
    const isCancelled = trx.status === 'dibatalkan';

    detailBody.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div>
          <h6 class="fw-bold text-navy mb-0">${trx.order_number}</h6>
          <small class="text-muted">${formatDateIndo(trx.date)} ${trx.time}</small>
        </div>
        <span class="badge ${isCancelled ? 'bg-danger' : 'bg-success'} fs-6">
          ${isCancelled ? 'TRANSAKSI DIBATALKAN' : 'TRANSAKSI SELESAI'}
        </span>
      </div>

      ${isCancelled ? `
        <div class="alert alert-danger py-2 small mb-3">
          <i class="bi bi-info-circle-fill me-1"></i> Alasan Pembatalan: <b>${trx.cancel_reason || 'Kesalahan input kasir'}</b>
        </div>
      ` : ''}

      <div class="table-responsive mb-3">
        <table class="table table-sm table-bordered">
          <thead class="table-light">
            <tr>
              <th>Barang</th>
              <th class="text-center">Qty</th>
              <th class="text-end">Harga</th>
              <th class="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${trx.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-end">${formatRupiah(item.sell_price)}</td>
                <td class="text-end fw-bold">${formatRupiah(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot class="fw-bold">
            <tr>
              <td colspan="3" class="text-end">TOTAL TAGIHAN:</td>
              <td class="text-end text-primary">${formatRupiah(trx.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="row g-2 small text-muted">
        <div class="col-6">Metode: <b class="text-dark text-uppercase">${trx.payment_method === 'konsumsi' ? '<span class="text-warning fw-bold"><i class="bi bi-cup-hot-fill me-1"></i>Konsumsi Karyawan (Gratis)</span>' : trx.payment_method}</b></div>
        <div class="col-6 text-end">${trx.payment_method === 'konsumsi' ? `Penerima: <b class="text-dark">${trx.employee_name || 'Karyawan'}</b>` : `Uang Diterima: <b class="text-dark">${formatRupiah(trx.cash_given)}</b>`}</div>
        ${trx.payment_method !== 'konsumsi' ? `<div class="col-12 text-end">Uang Kembalian: <b class="text-success">${formatRupiah(trx.change)}</b></div>` : ''}
      </div>
    `;

    const cancelBtn = document.getElementById('btn-cancel-trx');
    if (isCancelled) {
      cancelBtn.classList.add('d-none');
    } else {
      cancelBtn.classList.remove('d-none');
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-trx-detail'));
    modal.show();
  },

  async showCancelPrompt() {
    if (!this.selectedTrx) return;
    const reason = prompt(`Masukkan alasan pembatalan transaksi #${this.selectedTrx.order_number}:`, 'Salah input oleh kasir / dibatalkan pembeli');
    if (!reason) return;

    if (!confirm('PERINGATAN: Membatalkan transaksi ini akan MENGEMBALIKAN STOK BARANG ke etalase dan MEMOTONG KAS PENJUALAN. Lanjutkan?')) return;

    try {
      const trx = this.selectedTrx;
      trx.status = 'dibatalkan';
      trx.cancel_reason = reason;
      trx.cancelled_at = new Date().toISOString();
      await db.put('transactions', trx);

      // 1. Restitute Stock (Kembalikan stok)
      for (const item of trx.items) {
        const prod = await db.get('products', item.id);
        if (prod) {
          prod.stock += item.qty;
          await db.put('products', prod);
        }
      }

      // 2. Reverse Cash Mutation if Cash
      if (trx.payment_method === 'tunai') {
        const now = new Date();
        await db.add('cash_mutations', {
          date: App.operationalDate,
          time: now.toTimeString().split(' ')[0].substring(0, 5),
          timestamp: now.getTime(),
          type: 'out',
          category: 'batal_penjualan',
          payment_method: 'tunai',
          amount: trx.total,
          description: `Pembatalan penjualan kasir #${trx.order_number} (${reason})`,
          ref_id: trx.id
        });
      }

      // 3. Delete Expense if Konsumsi Karyawan
      if (trx.payment_method === 'konsumsi') {
        const allExpenses = await db.getAll('expenses');
        const relatedExp = allExpenses.find(e => e.ref_id === trx.id);
        if (relatedExp) {
          await db.delete('expenses', relatedExp.id);
        }
      }

      bootstrap.Modal.getInstance(document.getElementById('modal-trx-detail'))?.hide();
      alert(`Transaksi #${trx.order_number} berhasil dibatalkan. Stok barang telah dikembalikan.`);

      await this.renderTable();
      await MasterProduk.renderTable();
      await StokBarang.renderTable();
      await POS.renderProducts();
      await KasHarian.renderTable();
      await App.refreshDashboard();

    } catch (err) {
      alert('Gagal membatalkan transaksi: ' + err.message);
    }
  },

  reprintReceipt() {
    if (this.selectedTrx) {
      bootstrap.Modal.getInstance(document.getElementById('modal-trx-detail'))?.hide();
      POS.showReceiptModal(this.selectedTrx);
    }
  },

  async exportExcel() {
    const transactions = await db.getAll('transactions');
    const exportData = transactions.map(t => ({
      "No Transaksi": t.order_number,
      "Tanggal": t.date,
      "Waktu": t.time,
      "Total": t.total,
      "Modal HPP": t.total_hpp,
      "Keuntungan": t.total_profit,
      "Metode": t.payment_method === 'konsumsi' ? 'Konsumsi Karyawan' : t.payment_method,
      "Status": t.status,
      "Keterangan / Karyawan": t.employee_name || t.cancel_reason || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Transaksi");
    XLSX.writeFile(wb, `Riwayat_Transaksi_SMPN77_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
};

// ==================== 14. LAPORAN BULANAN ====================
const LaporanBulanan = {
  async init() {
    const curDate = new Date(App.operationalDate);
    document.getElementById('monthly-select-month').value = curDate.getMonth().toString();
    document.getElementById('monthly-select-year').value = curDate.getFullYear().toString();
    await this.loadReport();
  },

  async loadReport() {
    const month = parseInt(document.getElementById('monthly-select-month').value);
    const year = parseInt(document.getElementById('monthly-select-year').value);

    const transactions = await db.getAll('transactions');
    const expenses = await db.getAll('expenses');

    // Filter by year & month
    const monthStr = (month + 1).toString().padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const monthTrxs = transactions.filter(t => t.date.startsWith(prefix) && t.status !== 'dibatalkan');
    const monthExpenses = expenses.filter(e => e.date.startsWith(prefix));

    let totalOmzet = 0;
    let totalHPP = 0;
    monthTrxs.forEach(t => {
      totalOmzet += t.total;
      totalHPP += (t.total_hpp || 0);
    });

    let totalOps = 0;
    monthExpenses.forEach(e => totalOps += e.amount);

    const labaKotor = totalOmzet - totalHPP;
    const labaBersih = labaKotor - totalOps;

    document.getElementById('month-omzet').textContent = formatRupiah(totalOmzet);
    document.getElementById('month-hpp').textContent = formatRupiah(totalHPP);
    document.getElementById('month-ops').textContent = formatRupiah(totalOps);
    document.getElementById('month-laba-bersih').textContent = formatRupiah(labaBersih);

    // Group by Day for the Table & Chart
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayRows = [];
    const chartLabels = [];
    const chartOmzet = [];
    const chartLaba = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
      const dayTrx = monthTrxs.filter(t => t.date === dStr);
      const dayExp = monthExpenses.filter(e => e.date === dStr);

      let dOmzet = 0;
      let dHPP = 0;
      let dItemsSold = 0;
      dayTrx.forEach(t => {
        dOmzet += t.total;
        dHPP += (t.total_hpp || 0);
        t.items.forEach(i => dItemsSold += i.qty);
      });

      let dOps = 0;
      dayExp.forEach(e => dOps += e.amount);

      const dKotor = dOmzet - dHPP;
      const dBersih = dKotor - dOps;

      chartLabels.push(`Tgl ${day}`);
      chartOmzet.push(dOmzet);
      chartLaba.push(dBersih);

      if (dayTrx.length > 0 || dayExp.length > 0) {
        dayRows.push({
          date: dStr,
          trxCount: dayTrx.length,
          itemsSold: dItemsSold,
          omzet: dOmzet,
          hpp: dHPP,
          labaKotor: dKotor,
          ops: dOps,
          labaBersih: dBersih
        });
      }
    }

    const tbody = document.getElementById('monthly-tbody');
    if (dayRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Belum ada transaksi operasional pada bulan yang dipilih.</td></tr>';
    } else {
      tbody.innerHTML = dayRows.map(r => `
        <tr>
          <td class="ps-3 fw-semibold">${formatDateIndo(r.date)}</td>
          <td class="text-center">${r.trxCount}</td>
          <td class="text-center">${r.itemsSold} pcs</td>
          <td class="text-end fw-bold text-blue">${formatRupiah(r.omzet)}</td>
          <td class="text-end text-muted">${formatRupiah(r.hpp)}</td>
          <td class="text-end text-success">${formatRupiah(r.labaKotor)}</td>
          <td class="text-end text-danger">${formatRupiah(r.ops)}</td>
          <td class="text-end pe-3 fw-bold text-success">${formatRupiah(r.labaBersih)}</td>
        </tr>
      `).join('');
    }

    // Render Monthly Chart
    this.renderMonthlyChart(chartLabels, chartOmzet, chartLaba);
  },

  renderMonthlyChart(labels, omzet, laba) {
    const ctx = document.getElementById('chart-bulanan');
    if (!ctx) return;

    if (App.charts.monthly) {
      App.charts.monthly.destroy();
    }

    App.charts.monthly = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Omzet Harian (Rp)',
            data: omzet,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Keuntungan Bersih (Rp)',
            data: laba,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatRupiah(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => 'Rp ' + (val >= 1000 ? (val / 1000) + 'k' : val)
            }
          }
        }
      }
    });
  },

  exportExcel() {
    const month = document.getElementById('monthly-select-month').value;
    const year = document.getElementById('monthly-select-year').value;
    const wb = XLSX.utils.table_to_book(document.getElementById('view-laporan-bulanan').querySelector('table'), { sheet: "Rekap Bulanan" });
    XLSX.writeFile(wb, `Laporan_Bulanan_Kantin_SMPN77_${year}_M${month}.xlsx`);
  },

  printReport() {
    window.print();
  }
};

// ==================== 15. BACKUP DAN RESTORE DATA ====================
const BackupRestore = {
  async downloadBackup() {
    try {
      const backup = await db.exportFullDatabase();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `BACKUP_KANTIN_SMPN77_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('File backup database lengkap (.json) berhasil diunduh. Simpan file ini dengan aman.');
    } catch (err) {
      alert('Gagal membuat file cadangan: ' + err.message);
    }
  },

  async handleRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('PERINGATAN: Memulihkan data cadangan akan menimpa seluruh data yang ada saat ini dengan isi file backup. Lanjutkan pemulihan?')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupObj = JSON.parse(e.target.result);
        await db.restoreFullDatabase(backupObj);
        alert('Data berhasil dipulihkan secara menyeluruh! Halaman akan dimuat ulang.');
        window.location.reload();
      } catch (err) {
        alert('Gagal memulihkan database. Pastikan file adalah backup valid dari Sistem Kantin SMPN 77: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  async resetToDemo() {
    if (confirm('PERINGATAN: Aksi ini akan mengatur ulang seluruh database ke katalog demo awal SMPN 77. Seluruh riwayat penjualan akan di-reset. Yakin ingin melanjutkan?')) {
      if (window.API && window.API.isOnline) {
        await API.request('/api/reset-demo', { method: 'POST' });
      }
      await db.seedDemoData();
      alert('Database berhasil direset ke kondisi toko awal SMPN 77!');
      window.location.reload();
    }
  },

  async clearTrialTransactions() {
    if (confirm('BERSIHKAN TRANSAKSI UJI COBA:\n\nAksi ini akan menghapus seluruh riwayat penjualan uji coba, stok opname, dan pengeluaran kas.\n\nPRODUK, HARGA, dan DATA SUPPLIER akan TETAP TERSIMPAN aman!\nStok barang akan dikembalikan ke stok awal.\n\nLanjutkan pembersihan transaksi uji coba?')) {
      if (window.API && window.API.isOnline) {
        await API.request('/api/clear-trial-transactions', { method: 'POST' });
      }
      await db.clearTrialTransactionsOnly();
      alert('Seluruh transaksi uji coba berhasil dibersihkan! Aplikasi siap digunakan untuk operasional resmi.');
      window.location.reload();
    }
  }
};

// ==================== 16. PENGATURAN AKUN & USAHA ====================
const Pengaturan = {
  async init() {
    const canteenName = await db.getSetting('canteen_name', 'SISTEM KANTIN SMPN 77');
    const canteenAddress = await db.getSetting('canteen_address', 'SMPN 77 Jakarta');
    const receiptFooter = await db.getSetting('receipt_footer', 'Terima kasih atas kunjungannya!\nSelamat belajar di SMPN 77.');
    const initialCash = await db.getSetting('default_initial_cash', 200000);
    
    const adminUser = await db.getSetting('admin_username', 'admin');
    const kasirName = await db.getSetting('kasir_name', 'Karyawan Kasir');
    const kasirUser = await db.getSetting('kasir_username', 'kasir');

    document.getElementById('set-canteen-name').value = canteenName;
    document.getElementById('set-canteen-address').value = canteenAddress;
    document.getElementById('set-receipt-footer').value = receiptFooter;
    document.getElementById('set-initial-cash').value = initialCash;
    
    if (document.getElementById('set-admin-username')) document.getElementById('set-admin-username').value = adminUser;
    if (document.getElementById('set-kasir-name')) document.getElementById('set-kasir-name').value = kasirName;
    if (document.getElementById('set-kasir-username')) document.getElementById('set-kasir-username').value = kasirUser;
  },

  async saveCanteenSettings(e) {
    e.preventDefault();
    const name = document.getElementById('set-canteen-name').value.trim();
    const address = document.getElementById('set-canteen-address').value.trim();
    const footer = document.getElementById('set-receipt-footer').value.trim();
    const cash = parseNumber(document.getElementById('set-initial-cash').value);

    await db.setSetting('canteen_name', name);
    await db.setSetting('canteen_address', address);
    await db.setSetting('receipt_footer', footer);
    await db.setSetting('default_initial_cash', cash);

    alert('Pengaturan identitas usaha dan modal kas berhasil disimpan!');
    await App.refreshDashboard();
  },

  async saveAdminSettings(e) {
    e.preventDefault();
    const username = document.getElementById('set-admin-username').value.trim();
    const password = document.getElementById('set-admin-password').value.trim();

    if (!password) {
      alert('PIN / Sandi Admin tidak boleh kosong!');
      return;
    }

    await db.setSetting('admin_username', username);
    await db.setSetting('admin_password', password);
    await db.setSetting('staff_password', password);

    alert('PIN / Sandi Pengelola Admin berhasil diperbarui!');
    document.getElementById('set-admin-password').value = '';
  },

  async saveKasirSettings(e) {
    e.preventDefault();
    const name = document.getElementById('set-kasir-name').value.trim();
    const username = document.getElementById('set-kasir-username').value.trim();
    const password = document.getElementById('set-kasir-password').value.trim();

    if (!password) {
      alert('PIN Kasir tidak boleh kosong!');
      return;
    }

    await db.setSetting('kasir_name', name);
    await db.setSetting('kasir_username', username);
    await db.setSetting('kasir_password', password);

    alert(`Akun Karyawan Kasir "${name}" berhasil diperbarui!\nUsername: ${username} | PIN: ${password}`);
    document.getElementById('set-kasir-password').value = '';
  }
};

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { App.init(); });
} else {
  App.init();
}
