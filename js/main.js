/* ================================================================
   IRGXYMODS — MAIN.JS (v5.1 — CORE UTILITIES)
   ================================================================
   Berisi:
   • Global error guard
   • Helpers: $, $$, withTimeout, safeFetch, fixUrl
   • Toast, Auth, Activity, updateProfileStats
   • Settings dropdown, Profile modal, reCAPTCHA modal
   • Card actions (download/share/copy)
   • Search, Back-to-top, Contact form
   • Skill bars, Gold particles
   • Portfolio grid, Shop rendering (4 katalog), Login page
   • [NEW] window.IRGXY namespace → konsumsi oleh downloader.js
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     GLOBAL ERROR GUARD
     ================================================================ */
  window.addEventListener('error', (e) => {
    console.warn('[IRGXYMODS] Runtime error caught:', e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[IRGXYMODS] Unhandled promise rejection:', e.reason);
  });

  /* ---------- HELPERS ---------- */
  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  /**
   * withTimeout — Polyfill untuk AbortSignal.timeout()
   * Support: Chrome 103+, Firefox 100+, Safari 16+. Fallback untuk Safari ≤15.
   */
  const withTimeout = (ms) => {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      try { return AbortSignal.timeout(ms); } catch (_) { /* fallback di bawah */ }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(new DOMException('TimeoutError', 'TimeoutError')); }
      catch (_) { controller.abort(); }
    }, ms);
    if (controller.signal && typeof controller.signal.addEventListener === 'function') {
      controller.signal.addEventListener('abort', () => clearTimeout(timer));
    }
    return controller.signal;
  };

  /**
   * safeFetch — Wrapper fetch dengan timeout + error handling konsisten
   */
  const safeFetch = async (url, options = {}, timeoutMs = 12000) => {
    const opts = { ...options, signal: withTimeout(timeoutMs) };
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (res.statusText || ''));
    return res;
  };

  /**
   * fixUrl — Normalisasi URL dari API (kadang return tanpa protokol)
   */
  const fixUrl = (u, base = 'https://www.tikwm.com') => {
    if (!u || typeof u !== 'string') return '';
    const s = u.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('//')) return 'https:' + s;
    return base + (s.startsWith('/') ? s : '/' + s);
  };

  /* ---------- AOS ---------- */
  if (window.AOS && typeof AOS.init === 'function') {
    try {
      AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 });
    } catch (e) { console.warn('AOS init failed:', e); }
  }

  /* ---------- TOAST ---------- */
  function showToast(message, type = 'success') {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
  }
  window.showToast = showToast;

  /* ---------- AUTH (Login State) ---------- */
  const Auth = {
    KEY_LOGGED: 'irgxy_logged_in',
    KEY_USER:   'irgxy_username',
    KEY_TIME:   'irgxy_login_time',
    isLoggedIn() { try { return localStorage.getItem(this.KEY_LOGGED) === 'true'; } catch { return false; } },
    getUser()    { try { return localStorage.getItem(this.KEY_USER) || ''; } catch { return ''; } },
    login(name) {
      try {
        localStorage.setItem(this.KEY_LOGGED, 'true');
        localStorage.setItem(this.KEY_USER, name);
        localStorage.setItem(this.KEY_TIME, String(Date.now()));
      } catch {}
    },
    logout() {
      try {
        localStorage.removeItem(this.KEY_LOGGED);
        localStorage.removeItem(this.KEY_USER);
      } catch {}
    }
  };
  window.IrgxyAuth = Auth;

  /* ---------- ACTIVITY SYSTEM ---------- */
  const Activity = {
    STORAGE: 'irgxy_activities',
    items: [],
    load() { try { this.items = JSON.parse(localStorage.getItem(this.STORAGE) || '[]'); } catch { this.items = []; } },
    save() { try { localStorage.setItem(this.STORAGE, JSON.stringify(this.items.slice(0, 20))); } catch {} },
    add(type, title) {
      try {
        this.items.unshift({ id: Date.now(), type, title, timeAgo: 'Baru saja' });
        this.items = this.items.slice(0, 20);
        this.save();
        this.render();
        updateProfileStats();
      } catch (e) { console.warn('Activity.add failed:', e); }
    },
    render() {
      const timeline = $('#activityTimeline');
      if (!timeline) return;
      if (!this.items.length) {
        timeline.innerHTML = '<div class="no-activity"><i class="fas fa-history"></i><p>Belum ada aktivitas</p><small>Riwayat aktivitas Anda akan muncul di sini</small></div>';
        return;
      }
      const iconMap  = { download: 'download', share: 'share-alt', copy_link: 'link', cheat_download: 'gamepad' };
      const colorMap = { download: 'success', share: 'warning', copy_link: 'secondary', cheat_download: 'warning' };
      timeline.innerHTML = this.items.map(a => `
        <div class="activity-item">
          <div class="activity-icon ${colorMap[a.type] || 'primary'}"><i class="fas fa-${iconMap[a.type] || 'circle'}"></i></div>
          <div class="activity-content"><div class="activity-title">${a.title}</div><div class="activity-time">${a.timeAgo}</div></div>
        </div>`).join('');
    }
  };
  Activity.load();
  window.addActivity = Activity.add.bind(Activity);
  window.IrgxyActivity = Activity;

  function updateProfileStats() {
    const items = Activity.items;
    const downloads = items.filter(a => a.type === 'download' || a.type === 'cheat_download').length;
    const earliest  = items.length ? Math.min(...items.map(a => a.id)) : Date.now();
    const days      = Math.max(1, Math.ceil((Date.now() - earliest) / 86400000));
    const bugs      = items.filter(a => a.type === 'bug').length;
    if ($('#statDownloads')) $('#statDownloads').textContent = downloads;
    if ($('#statDays'))      $('#statDays').textContent = days;
    if ($('#statBugs'))      $('#statBugs').textContent = bugs;
  }

  /* ---------- SETTINGS DROPDOWN ---------- */
  (function initSettingsDropdown() {
    const toggle   = $('#settingsToggle');
    const dropdown = $('#settingsDropdown');
    if (!toggle || !dropdown) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    document.addEventListener('click', () => dropdown.classList.remove('active'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    $('#themeToggleBtn')?.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      showToast('Tema diubah', 'info');
      dropdown.classList.remove('active');
    });

    $('#helpBtn')?.addEventListener('click', () => {
      showToast('Bantuan: Hubungi kami di Telegram @irgxyzmods', 'info');
      dropdown.classList.remove('active');
    });

    $('#profileDropdownBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      dropdown.classList.remove('active');
      if (!Auth.isLoggedIn()) {
        showToast('Silakan login terlebih dahulu', 'warning');
        setTimeout(() => location.href = 'login.html', 700);
        return;
      }
      $('#profileModal')?.classList.add('active');
      Activity.render();
      updateProfileStats();
      const nameEl = $('#profileModal .profile-name');
      if (nameEl && Auth.getUser()) nameEl.textContent = Auth.getUser();
    });
  })();

  /* ---------- PROFILE MODAL ---------- */
  (function initProfileModal() {
    const modal = $('#profileModal');
    if (!modal) return;

    $('#profileModalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    modal.querySelector('.edit-profile')?.addEventListener('click', () =>
      showToast('Fitur edit profil akan segera hadir!', 'info'));
    modal.querySelector('.upgrade-premium')?.addEventListener('click', () =>
      showToast('Anda sudah menggunakan paket premium!', 'success'));
    modal.querySelector('.logout')?.addEventListener('click', () => {
      Auth.logout();
      showToast('Anda berhasil keluar', 'success');
      setTimeout(() => { modal.classList.remove('active'); location.reload(); }, 800);
    });

    Activity.render();
    updateProfileStats();
  })();

  /* ---------- reCAPTCHA MODAL (Download) ---------- */
  (function initRecaptchaModal() {
    const modal = $('#recaptchaModal');
    if (!modal) return;

    let currentUrl = '';
    let currentName = '';
    const verifiedBtn = $('#downloadVerifiedBtn');
    const statusBox   = $('#downloadRecaptchaStatus');

    window.openRecaptchaModal = function (url, name) {
      currentUrl = url;
      currentName = name;
      modal.style.display = 'flex';
      if (statusBox) { statusBox.style.display = 'none'; statusBox.textContent = ''; }
      if (verifiedBtn) verifiedBtn.disabled = true;
      if (window.grecaptcha?.reset) { try { window.grecaptcha.reset(); } catch {} }
    };

    window.onDownloadRecaptchaSuccess = function () {
      if (verifiedBtn) verifiedBtn.disabled = false;
      if (statusBox) {
        statusBox.textContent = 'Verifikasi berhasil! Anda dapat melanjutkan download.';
        statusBox.style.display = 'block';
      }
    };
    window.onDownloadRecaptchaExpired = function () {
      if (verifiedBtn) verifiedBtn.disabled = true;
      if (statusBox) {
        statusBox.textContent = 'Verifikasi telah kedaluwarsa. Silakan verifikasi ulang.';
        statusBox.style.display = 'block';
      }
    };

    $('#recaptchaModalClose')?.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    verifiedBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
      if (currentUrl && currentUrl !== '#') {
        window.open(currentUrl, '_blank', 'noopener');
        showToast('Download ' + currentName + ' dimulai!', 'success');
        Activity.add('download', 'Mengunduh ' + currentName);
      } else {
        showToast('Link download tidak tersedia', 'error');
      }
    });
  })();

  /* ---------- CARD ACTIONS (download / share / copy) ---------- */
  document.addEventListener('click', (e) => {
    const dlBtn = e.target.closest('.download-btn');
    if (dlBtn) {
      e.preventDefault();
      const url  = dlBtn.getAttribute('data-appurl') || '';
      const name = dlBtn.getAttribute('data-appname') || 'Aplikasi';
      const section = dlBtn.closest('section');
      if (section?.id === 'cheat-section') {
        Activity.add('cheat_download', 'Mengunduh cheat ' + name);
      } else {
        Activity.add('download', 'Mengunduh ' + name);
      }
      if (window.openRecaptchaModal) window.openRecaptchaModal(url, name);
      else if (url && url !== '#') window.open(url, '_blank', 'noopener');
      return;
    }

    const shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
      const name = shareBtn.getAttribute('data-appname') || 'Aplikasi';
      const url  = shareBtn.getAttribute('data-appurl') || location.href;
      if (navigator.share) {
        navigator.share({ title: name, text: 'Download ' + name + ' dari IRGXYMODS', url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => showToast('Link disalin!', 'success')).catch(() => {});
      } else { prompt('Salin link ini:', url); }
      Activity.add('share', 'Membagikan ' + name);
      return;
    }

    const copyBtn = e.target.closest('.copy-link-btn');
    if (copyBtn) {
      const url  = copyBtn.getAttribute('data-appurl') || location.href;
      const name = copyBtn.closest('.app-card')?.querySelector('h3')?.textContent?.trim() || 'Aplikasi';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => showToast('Link berhasil disalin!', 'success')).catch(() => prompt('Salin link:', url));
      } else { prompt('Salin link:', url); }
      Activity.add('copy_link', 'Menyalin link ' + name);
    }
  });

  /* ---------- SEARCH ---------- */
  (function initSearch() {
    const input    = $('#searchInput');
    const btn      = $('#searchBtn');
    const clearBtn = $('#clearSearchBtn');
    const info     = $('#searchResultsInfo');
    const termEl   = $('#searchTerm');
    const noRes    = $('#noResults');
    if (!input) return;

    const selectors = '.app-card,.luxury-card,.portfolio-card,.portfolio-item,.testimonial-card,.testimoni-card,.feature-card,.stat-card,.tagline-item,.link-card';

    function reset() {
      $$(selectors).forEach(el => { el.style.display = ''; });
      if (info) info.style.display = 'none';
      if (noRes) noRes.style.display = 'none';
    }
    function perform() {
      const q = input.value.trim().toLowerCase();
      if (!q) return reset();
      const scope = $('main') || document;
      let count = 0;
      $$(selectors, scope).forEach(el => {
        const txt = (el.textContent || '').toLowerCase();
        if (txt.includes(q)) { el.style.display = ''; count++; }
        else el.style.display = 'none';
      });
      if (info) info.style.display = count ? 'block' : 'none';
      if (termEl) termEl.textContent = '"' + q + '"';
      if (noRes) noRes.style.display = count ? 'none' : 'block';
    }
    btn?.addEventListener('click', perform);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); perform(); } });
    clearBtn?.addEventListener('click', () => { input.value = ''; reset(); });
  })();

  /* ---------- BACK TO TOP ---------- */
  (function initBackToTop() {
    const el = $('#backToTop');
    if (!el) return;
    window.addEventListener('scroll', () => {
      el.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
    el.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  })();

  /* ---------- CONTACT FORM ---------- */
  window.handleContactForm = function (e) {
    e.preventDefault();
    const form = e.target;
    const name  = form.querySelector('input[type="text"]')?.value.trim() || '';
    const email = form.querySelector('input[type="email"]')?.value.trim() || '';
    const msg   = form.querySelector('textarea')?.value.trim() || '';
    if (!name || !email || !msg) { showToast('Harap isi semua field', 'error'); return false; }
    showToast(`Terima kasih, ${name}! Pesan Anda telah terkirim.`, 'success');
    form.reset();
    return false;
  };

  /* ---------- SKILL BARS ---------- */
  (function initSkillBars() {
    const bars = $$('.skill-bar-fill[data-width]');
    if (!bars.length) return;
    if (!('IntersectionObserver' in window)) {
      bars.forEach(b => b.style.width = b.getAttribute('data-width') || '0%');
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.width = entry.target.getAttribute('data-width') || '0%';
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    bars.forEach(b => obs.observe(b));
  })();

  /* ---------- GOLD PARTICLES ---------- */
  (function initParticles() {
    if ($('#irgxy-particles')) return;
    const container = document.createElement('div');
    container.id = 'irgxy-particles';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
    document.body.appendChild(container);
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      const size = 2 + Math.random() * 5;
      p.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,#FFD700 0%,#D4AF37 50%,transparent 70%);border-radius:50%;box-shadow:0 0 15px 3px rgba(255,215,0,0.5);left:${Math.random()*100}%;top:100%;animation:floatGold ${15 + Math.random()*20}s linear ${Math.random()*15}s infinite;`;
      container.appendChild(p);
    }
    if (!$('#irgxy-particles-style')) {
      const style = document.createElement('style');
      style.id = 'irgxy-particles-style';
      style.textContent = '@keyframes floatGold{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:0.8}90%{opacity:0.8}100%{transform:translateY(-110vh) translateX(60px);opacity:0}}';
      document.head.appendChild(style);
    }
  })();

  /* ---------- PORTFOLIO GRID ---------- */
  const portfolioItems = [
    { id:1, title:'Landing Page Startup Fintech', desc:'Desain modern dengan animasi scroll, dark mode, dan integrasi form booking.', category:'web', emoji:'🏢', tech:['HTML','CSS','JS','Figma'] },
    { id:2, title:'Dashboard Analytics SaaS', desc:'UI kompleks dengan grafik real-time, filter dinamis, dan role-based access.', category:'web', emoji:'📊', tech:['React','Chart.js','Node.js'] },
    { id:3, title:'Game UI Concept — RPG', desc:'Konsep antarmuka game RPG dengan inventory system, skill tree, dan minimap.', category:'uiux', emoji:'🎮', tech:['Figma','Illustrator'] },
    { id:4, title:'APK Mod Legal — Premium Unlocker', desc:'Modifikasi aplikasi open-source dengan fitur premium terbuka secara legal.', category:'apk', emoji:'📱', tech:['Android Studio','Java','Patch'] },
    { id:5, title:'Custom Tool — APK Patcher', desc:'Alat bantu patch legal untuk modifikasi ringan aplikasi Android secara aman.', category:'tools', emoji:'🔧', tech:['Python','ADB','Shell'] },
    { id:6, title:'UI/UX Design — Mobile App', desc:'Desain antarmuka aplikasi mobile modern dengan prinsip UX terbaik.', category:'uiux', emoji:'🖌️', tech:['Figma','Prototyping'] },
    { id:7, title:'Template Website Portfolio', desc:'Desain website portfolio responsif menggunakan HTML, CSS, dan JavaScript murni.', category:'web', emoji:'🎨', tech:['HTML','CSS','JS'] },
    { id:8, title:'Sistem Autentikasi 2FA', desc:'Microservice autentikasi dengan JWT, 2FA, reset password, dan social login.', category:'tools', emoji:'🔐', tech:['Node.js','JWT','MongoDB'] }
  ];

  function renderPortfolioGrid(filter = 'all') {
    const grid = $('#portfolioGridPage');
    const no   = $('#portfolioNoResultsPage');
    if (!grid || !no) return;
    const filtered = filter === 'all' ? portfolioItems : portfolioItems.filter(i => i.category === filter);
    grid.innerHTML = '';
    if (!filtered.length) { grid.classList.add('hidden'); no.classList.remove('hidden'); return; }
    grid.classList.remove('hidden'); no.classList.add('hidden');
    filtered.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'portfolio-item';
      div.style.animation = `fadeSlideIn 0.4s ease ${idx * 0.06}s forwards`;
      div.innerHTML = `
        <div class="item-thumb"><span style="font-size:2.8rem;">${item.emoji}</span><span class="item-badge">${item.category.toUpperCase()}</span></div>
        <div class="item-info">
          <h4>${item.title}</h4>
          <div class="item-desc">${item.desc}</div>
          <div class="item-tech">${item.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}</div>
          <a href="#" class="item-link">🔗 Lihat Detail →</a>
        </div>`;
      div.addEventListener('click', (e) => {
        if (e.target.closest('.item-link')) { e.preventDefault(); }
        alert(`📌 ${item.title}\n${item.desc}\n🛠️ ${item.tech.join(', ')}`);
      });
      grid.appendChild(div);
    });
  }

  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderPortfolioGrid(this.getAttribute('data-filter'));
    });
  });
  if ($('#portfolioGridPage')) renderPortfolioGrid('all');

  /* ---------- SHOP RENDERING ---------- */
  const ecommerceProducts = [
    { id:1, name:'Smartphone Pro X', category:'Elektronik', price:8999000, rating:4.8, emoji:'📱', badge:'terlaris', oldPrice:null },
    { id:2, name:'Laptop UltraSlim 15', category:'Elektronik', price:15499000, rating:4.7, emoji:'💻', badge:'hot', oldPrice:17999000 },
    { id:3, name:'Wireless Headphone ANC', category:'Elektronik', price:1299000, rating:4.5, emoji:'🎧', badge:null, oldPrice:null },
    { id:4, name:'Smartwatch Sport Pro', category:'Elektronik', price:3799000, rating:4.6, emoji:'⌚', badge:'sale', oldPrice:4999000 },
    { id:5, name:'Tablet Draw Pro 12"', category:'Elektronik', price:7299000, rating:4.4, emoji:'📋', badge:null, oldPrice:null },
    { id:6, name:'Kamera Mirrorless 4K', category:'Elektronik', price:12999000, rating:4.9, emoji:'📸', badge:'terlaris', oldPrice:14999000 },
    { id:7, name:'Tas Ransel Premium', category:'Fashion', price:599000, rating:4.3, emoji:'🎒', badge:null, oldPrice:null },
    { id:8, name:'Sepatu Lari Pro Running', category:'Fashion', price:899000, rating:4.6, emoji:'👟', badge:'hot', oldPrice:1199000 }
  ];
  const cuacaProducts = [
    { id:1, name:'Payung Lipat Premium', category:'Aksesoris Hujan', price:149000, rating:4.7, emoji:'☂️', badge:'terlaris', oldPrice:null },
    { id:2, name:'Jas Hujan Fashionable', category:'Aksesoris Hujan', price:299000, rating:4.5, emoji:'🧥', badge:'sale', oldPrice:399000 },
    { id:3, name:'Jaket Waterproof Pro', category:'Pakaian Outdoor', price:499000, rating:4.8, emoji:'🧥', badge:'hot', oldPrice:null },
    { id:4, name:'Sepatu Boot Hujan', category:'Alas Kaki', price:349000, rating:4.4, emoji:'👢', badge:null, oldPrice:null },
    { id:5, name:'Kacamata Hitam UV400', category:'Aksesoris Panas', price:199000, rating:4.6, emoji:'🕶️', badge:'terlaris', oldPrice:null },
    { id:6, name:'Sunblock SPF 50+', category:'Perawatan Kulit', price:89000, rating:4.9, emoji:'🧴', badge:null, oldPrice:null }
  ];
  const portfolioShopProducts = [
    { id:1, name:'Template Portfolio Premium', category:'Template Website', price:299000, rating:4.9, emoji:'🎨', badge:'terlaris', oldPrice:499000 },
    { id:2, name:'Jasa Desain UI/UX Pro', category:'Jasa Kreatif', price:1499000, rating:4.8, emoji:'🎯', badge:'premium', oldPrice:null },
    { id:3, name:'Paket Website Portfolio', category:'Paket Bundling', price:2499000, rating:4.7, emoji:'📦', badge:'hot', oldPrice:3499000 },
    { id:4, name:'Asset Ilustrasi Digital', category:'Aset Digital', price:149000, rating:4.6, emoji:'🖼️', badge:null, oldPrice:null }
  ];
  const authShopProducts = [
    { id:1, name:'Kemeja Flanel Premium', category:'Atasan Pria', price:299000, rating:4.7, emoji:'👔', badge:'terlaris', oldPrice:399000 },
    { id:2, name:'Dress Brokat Elegan', category:'Dress Wanita', price:599000, rating:4.9, emoji:'👗', badge:'hot', oldPrice:null },
    { id:3, name:'Kaos Polos Cotton 30s', category:'Atasan Pria', price:89000, rating:4.5, emoji:'👕', badge:'sale', oldPrice:129000 },
    { id:4, name:'Blouse Kantor Elegan', category:'Atasan Wanita', price:249000, rating:4.6, emoji:'👚', badge:'new', oldPrice:null }
  ];

  const formatPrice = p => 'Rp ' + p.toLocaleString('id-ID');
  const renderStars = r => {
    const full = Math.floor(r);
    const half = (r - full) >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return '★'.repeat(full) + (half ? '<span class="star-shop half">★</span>' : '') + '<span class="star-shop empty">★</span>'.repeat(empty);
  };

  function renderShopProducts(gridId, noId, counterId, data, buyBtnClass) {
    const grid = $('#' + gridId), no = $('#' + noId), counter = $('#' + counterId);
    if (!grid || !no || !counter) return;
    grid.innerHTML = '';
    if (!data.length) { grid.classList.add('hidden'); no.classList.remove('hidden'); counter.textContent = ''; return; }
    grid.classList.remove('hidden'); no.classList.add('hidden');
    counter.textContent = `Menampilkan ${data.length} produk`;
    data.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'product-card-shop';
      card.style.animation = `fadeSlideIn 0.4s ease ${idx * 0.04}s forwards`;
      let badgeHTML = '';
      if (p.badge === 'terlaris') badgeHTML = '<span class="product-badge-shop">⭐ Terlaris</span>';
      else if (p.badge === 'hot') badgeHTML = '<span class="product-badge-shop hot">🔥 Hot</span>';
      else if (p.badge === 'sale') badgeHTML = '<span class="product-badge-shop sale">💸 Diskon</span>';
      else if (p.badge === 'premium') badgeHTML = '<span class="product-badge-shop" style="background:linear-gradient(135deg,#ffd700,#ff8f00);color:#1a1a2e;">💎 Premium</span>';
      else if (p.badge === 'new') badgeHTML = '<span class="product-badge-shop" style="background:linear-gradient(135deg,#43e97b,#38f9d7);color:#1a1a2e;">🆕 Baru</span>';
      const priceHTML = p.oldPrice
        ? `<span class="product-price-shop">${formatPrice(p.price)}<span class="old-price-shop">${formatPrice(p.oldPrice)}</span></span>`
        : `<span class="product-price-shop">${formatPrice(p.price)}</span>`;
      card.innerHTML = `
        <div class="product-image-shop" style="background:linear-gradient(135deg,rgba(201,169,110,0.06),transparent);">${badgeHTML}<span class="product-image-emoji">${p.emoji}</span></div>
        <div class="product-info-shop">
          <span class="product-category-shop">${p.category}</span>
          <span class="product-name-shop">${p.name}</span>
          <div class="product-rating-shop"><span class="stars-container-shop">${renderStars(p.rating)}</span><span class="rating-number-shop">${p.rating}</span></div>
          ${priceHTML}
          <button class="${buyBtnClass}"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>Beli</button>
        </div>`;
      card.querySelector('.' + buyBtnClass)?.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast(`✅ ${p.name} ditambahkan ke keranjang!`, 'success');
      });
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        alert(`📦 ${p.name}\n💰 ${formatPrice(p.price)}\n⭐ ${p.rating}/5.0`);
      });
      grid.appendChild(card);
    });
  }

  const filterShopData = (q, data) => {
    q = (q || '').trim().toLowerCase();
    if (!q) return [...data];
    return data.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  };

  window.renderEcommerceProducts     = d => renderShopProducts('ecommerceProductGrid', 'ecommerceNoResults', 'ecommerceResultsCounter', d, 'buy-btn-shop');
  window.renderCuacaProducts         = d => renderShopProducts('cuacaProductGrid', 'cuacaNoResults', 'cuacaResultsCounter', d, 'weather-buy-btn');
  window.renderPortfolioShopProducts = d => renderShopProducts('portfolioShopProductGrid', 'portfolioShopNoResults', 'portfolioShopResultsCounter', d, 'portfolio-buy-btn');
  window.renderAuthShopProducts      = d => renderShopProducts('authShopProductGrid', 'authShopNoResults', 'authShopResultsCounter', d, 'auth-buy-btn');

  function bindShopSearch(inputId, clearId, renderFn, data) {
    const inp = $('#' + inputId), clr = $('#' + clearId);
    if (!inp || !clr) return;
    inp.addEventListener('input', function () {
      clr.classList.toggle('visible', this.value.trim().length > 0);
      renderFn(filterShopData(this.value, data));
    });
    clr.addEventListener('click', () => {
      inp.value = ''; clr.classList.remove('visible'); inp.focus(); renderFn([...data]);
    });
  }
  bindShopSearch('ecommerceSearchInput', 'ecommerceSearchClear', window.renderEcommerceProducts, ecommerceProducts);
  bindShopSearch('cuacaSearchInput', 'cuacaSearchClear', window.renderCuacaProducts, cuacaProducts);
  bindShopSearch('portfolioShopSearchInput', 'portfolioShopSearchClear', window.renderPortfolioShopProducts, portfolioShopProducts);
  bindShopSearch('authShopSearchInput', 'authShopSearchClear', window.renderAuthShopProducts, authShopProducts);

  if ($('#ecommerceProductGrid'))     window.renderEcommerceProducts(ecommerceProducts);
  if ($('#cuacaProductGrid'))         window.renderCuacaProducts(cuacaProducts);
  if ($('#portfolioShopProductGrid')) window.renderPortfolioShopProducts(portfolioShopProducts);
  if ($('#authShopProductGrid'))      window.renderAuthShopProducts(authShopProducts);

  /* ---------- LOGIN PAGE HANDLER ---------- */
  (function initLoginPage() {
    const form = $('#loginForm');
    if (!form) return;

    if (Auth.isLoggedIn()) {
      const banner = $('#loginAlreadyBanner');
      if (banner) banner.style.display = 'block';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = form.querySelector('#username')?.value.trim();
      const pass = form.querySelector('#password')?.value.trim();
      if (!user || !pass) { showToast('Isi username dan password', 'error'); return; }
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      setTimeout(() => {
        Auth.login(user);
        showToast('Login berhasil! Mengalihkan...', 'success');
        setTimeout(() => location.href = 'index.html', 900);
      }, 1000);
    });
  })();

  /* ================================================================
     [NEW v5.1] EXPOSE SHARED UTILITIES → konsumsi oleh downloader.js
     ================================================================ */
  window.IRGXY = {
    version: '5.1',
    $,
    $$,
    withTimeout,
    safeFetch,
    fixUrl,
    showToast,
    Auth,
    Activity,
    updateProfileStats
  };

  console.log('✅ IRGXYMODS main.js loaded (v5.1 — core utilities ready)');
})();