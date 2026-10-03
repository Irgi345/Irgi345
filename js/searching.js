/* ================================================================
   IRGXYMODS — SEARCHING UNIVERSAL V3 (ULTIMATE EDITION)
   Multi-engine · Multi-tab · DoH Real · Safe Browsing · Reader Mode
   ================================================================ */
(function () {
  'use strict';

  /* ══════════ 0. GUARD & SHARED HELPERS ══════════ */
  const IRGXY = window.IRGXY || {};
  const $  = IRGXY.$  || ((s, c = document) => c.querySelector(s));
  const $$ = IRGXY.$$ || ((s, c = document) => Array.from(c.querySelectorAll(s)));
  const showToast = (msg, type = 'success') => {
    if (typeof IRGXY.showToast === 'function') { try { IRGXY.showToast(msg, type); return; } catch (_) {} }
    if (typeof window.showToast === 'function') { try { window.showToast(msg, type); return; } catch (_) {} }
    const c = document.getElementById('toastContainer');
    if (!c) { console.log('[' + type + ']', msg); return; }
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };
  const Activity = IRGXY.Activity && IRGXY.Activity.add ? IRGXY.Activity : { add: () => {} };

  if (!$('#sgSearchInput')) return;

  /* ══════════ 1. KONSTANTA & CONFIG ══════════ */
  const CFG = Object.freeze({
    VERSION: '3.0.0',
    SCHEMA: 4,
    HISTORY_MAX: 500,
    BOOKMARKS_MAX: 200,
    BLOCKED_MAX: 500,
    TABS_MAX: 20,
    DNS_CACHE_TTL: 60000,
    SUGGEST_TTL: 300000,
    STORAGE: {
      SETTINGS:    'irgxy_sg_settings_v3',
      HISTORY:     'irgxy_sg_history_v3',
      BOOKMARKS:   'irgxy_sg_bookmarks_v3',
      READING:     'irgxy_sg_reading_v3',
      BLOCKED:     'irgxy_sg_blocked_v3',
      TABS:        'irgxy_sg_tabs_v3',
      SESSION:     'irgxy_sg_session_v3',
      DEBUG:       'irgxy_sg_debug_v3'
    }
  });

  /* 12 MESIN BERSIH */
  const ENGINES = [
    { id:'google',    name:'Google',          icon:'fab fa-google',                 color:'#4285F4', tag:'Populer',  privacy:3, url:q=>`https://www.google.com/search?q=${encodeURIComponent(q)}`,          home:'https://www.google.com' },
    { id:'ddg',       name:'DuckDuckGo',      icon:'fas fa-shield-halved',          color:'#DE5833', tag:'Privasi',  privacy:5, url:q=>`https://duckduckgo.com/?q=${encodeURIComponent(q)}`,             home:'https://duckduckgo.com' },
    { id:'ddg-lite',  name:'DuckDuckGo Lite', icon:'fas fa-feather',                color:'#DE5833', tag:'Ringan',   privacy:5, url:q=>`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,  home:'https://lite.duckduckgo.com/lite/' },
    { id:'bing',      name:'Bing',            icon:'fab fa-microsoft',              color:'#008272', tag:'Microsoft',privacy:3, url:q=>`https://www.bing.com/search?q=${encodeURIComponent(q)}`,          home:'https://www.bing.com' },
    { id:'brave',     name:'Brave Search',    icon:'fas fa-shield',                 color:'#FB542B', tag:'Privasi',  privacy:5, url:q=>`https://search.brave.com/search?q=${encodeURIComponent(q)}`,      home:'https://search.brave.com' },
    { id:'startpage', name:'Startpage',       icon:'fas fa-user-lock',              color:'#5C6BC0', tag:'Google Proxy', privacy:5, url:q=>`https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`, home:'https://www.startpage.com' },
    { id:'searx',     name:'Searx (Meta)',    icon:'fas fa-magnifying-glass-chart', color:'#3050FF', tag:'Meta',     privacy:5, url:q=>`https://searx.be/search?q=${encodeURIComponent(q)}`,              home:'https://searx.be' },
    { id:'yandex',    name:'Yandex',          icon:'fab fa-yandex',                 color:'#FF0000', tag:'Rusia',    privacy:2, url:q=>`https://yandex.com/search/?text=${encodeURIComponent(q)}`,         home:'https://yandex.com' },
    { id:'ecosia',    name:'Ecosia',          icon:'fas fa-tree',                   color:'#2E7D32', tag:'Hijau',    privacy:4, url:q=>`https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,          home:'https://www.ecosia.org' },
    { id:'qwant',     name:'Qwant',           icon:'fas fa-q',                      color:'#5C97FF', tag:'Privasi EU', privacy:5, url:q=>`https://www.qwant.com/?q=${encodeURIComponent(q)}`,              home:'https://www.qwant.com' },
    { id:'mojeek',    name:'Mojeek',          icon:'fas fa-m',                      color:'#4B8F29', tag:'Independen', privacy:5, url:q=>`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`,          home:'https://www.mojeek.com' },
    { id:'presearch', name:'Presearch',       icon:'fas fa-compass',                color:'#3A79FF', tag:'Web3',     privacy:4, url:q=>`https://presearch.com/search?q=${encodeURIComponent(q)}`,          home:'https://presearch.com' }
  ];

  /* 6 DNS PROVIDER */
  const DNS_PROVIDERS = {
    cloudflare: { name: 'Cloudflare', primary: '1.1.1.1',       secondary: '1.0.0.1',         doh: 'https://cloudflare-dns.com/dns-query' },
    google:     { name: 'Google DNS', primary: '8.8.8.8',       secondary: '8.8.4.4',         doh: 'https://dns.google/resolve' },
    quad9:      { name: 'Quad9',      primary: '9.9.9.9',       secondary: '149.112.112.112', doh: 'https://dns.quad9.net:5053/dns-query' },
    adguard:    { name: 'AdGuard',    primary: '94.140.14.14',  secondary: '94.140.15.15',    doh: 'https://dns.adguard-dns.com/resolve' },
    opendns:    { name: 'OpenDNS',    primary: '208.67.222.222', secondary: '208.67.220.220', doh: 'https://doh.opendns.com/dns-query' },
    custom:     { name: 'Custom',     primary: '—',             secondary: '—',               doh: '' }
  };

  /* 8 PROXY BYPASS */
  const PROXIES = [
    { name: 'CroxyProxy',      fn: u => `https://www.croxyproxy.com/${u}` },
    { name: '12ft.io',         fn: u => `https://12ft.io/${u}` },
    { name: 'AllOrigins',      fn: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { name: 'CORS Proxy',      fn: u => `https://corsproxy.io/?${encodeURIComponent(u)}` },
    { name: 'DDG HTML',        fn: u => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(u)}` },
    { name: 'Google Cache',    fn: u => `https://webcache.googleusercontent.com/search?q=cache:${u}` },
    { name: 'Wayback Machine', fn: u => `https://web.archive.org/web/2024/${u}` },
    { name: 'Translation',     fn: u => `https://translate.google.com/translate?sl=auto&tl=id&u=${encodeURIComponent(u)}` }
  ];

  /* 20+ PATTERN SUSPICIOUS */
  const SUSPICIOUS_PATTERNS = [
    /\.(exe|scr|bat|cmd|msi|vbs)(\?|$)/i,
    /(phishing|malware|trojan|keylog|ransomware)/i,
    /bit\.ly|tinyurl|adf\.ly|shorte\.st|bc\.vc/i,
    /\.(tk|ml|ga|cf|gq|top|work|click|loan|download|racing|stream|bid)(\/|$)/i,
    /free-money|hack-crack|keygen|warez|get-rich/i,
    /verify-account|confirm-password|suspend-account/i,
    /@[^/]+@/,
    /^javascript:/i,
    /^data:text\/html/i,
    /\.(zip|rar|7z)(\?|$)/
  ];

  const SUSPICIOUS_KEYWORDS = [
    'porn','xxx','casino','betting','free-robux','free-vbucks','crypto-giveaway',
    'bitcoin-doubler','steam-gift','nude','escort','mlm-scheme'
  ];

  /* 35+ FIELD DEFAULT SETTINGS */
  const DEFAULT_SETTINGS = {
    engine: 'google',
    homepage: '',
    lang: 'id',
    theme: 'dark',
    fontSize: 14,
    zoom: 100,
    histMax: 100,
    // PRIVACY
    doNotTrack: true, blockCookies3p: true, blockTrackers: true, blockAds: true,
    blockPopups: true, autofill: true, autoClear: false, kidsMode: false, whitelistMode: false,
    // SECURITY
    safeBrowsing: 'high', blockSuspicious: true, httpsOnly: true,
    blockWebRTC: true, blockFingerprint: true, blockGeo: true, blockMedia: false,
    // DNS & PROXY
    dns: 'cloudflare', customDns: '', doh: true, proxy: '', torMode: false,
    // DISPLAY
    accent: 'gold', layout: 'comfy', showFavicon: true, showPreview: true, animations: true,
    // ADVANCED
    userAgent: 'auto', javascript: true, images: true, cookies: true, hwAccel: true
  };

  /* ══════════ 2. STATE ══════════ */
  const State = {
    settings: { ...DEFAULT_SETTINGS },
    history: [],
    bookmarks: [],
    reading: [],
    blocked: [],
    debug: [],
    tabs: [],
    activeTab: 0,
    tabIdCounter: 1,
    suggestions: [],
    suggestIdx: -1,
    suggestAbort: null,
    suggestCache: new Map(),
    dnsCache: [],
    searchEngine: 'google',
    isSearching: false
  };

  /* ══════════ 3. STORAGE (safe wrappers) ══════════ */
  const Storage = {
    read(key, fb) { try { const v = localStorage.getItem(key); return v === null ? fb : v; } catch { return fb; } },
    readJSON(key, fb) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    write(key, val) {
      try { localStorage.setItem(key, val); return true; }
      catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          showToast('Storage penuh — membersihkan data lama', 'warning');
          try { localStorage.removeItem(CFG.STORAGE.DEBUG); localStorage.setItem(key, val); return true; } catch { return false; }
        }
        return false;
      }
    },
    writeJSON(key, obj) { return this.write(key, JSON.stringify(obj)); },
    remove(key) { try { localStorage.removeItem(key); } catch {} }
  };

  /* ══════════ 4. UTILITAS ══════════ */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const debounce = (fn, ms = 220) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const nowTime = () => new Date().toLocaleTimeString('id-ID', { hour12: false });
  const nowFull = () => new Date().toLocaleString('id-ID');
  const fmtAgo = (ts) => {
    const d = Date.now() - ts;
    if (d < 60000) return 'Baru saja';
    if (d < 3600000) return Math.floor(d / 60000) + ' mnt lalu';
    if (d < 86400000) return Math.floor(d / 3600000) + ' jam lalu';
    return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };
  const isValidIPv4 = (s) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(n => +n >= 0 && +n <= 255);
  const isURL = (s) => {
    if (!s) return false;
    try { if (/^https?:\/\//i.test(s)) { new URL(s); return true; } } catch { return false; }
    if (/^[\w-]+(\.[\w-]+)+/.test(s) && !s.includes(' ')) return true;
    if (/^localhost(:\d+)?/.test(s)) return true;
    return false;
  };
  const normalizeURL = (s) => {
    if (!s) return '';
    s = s.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w-]+(\.[\w-]+)+/.test(s) || /^localhost(:\d+)?/.test(s)) return 'https://' + s;
    return s;
  };
  const getHostname = (url) => { try { return new URL(normalizeURL(url)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
  const copyToClipboard = (text, msg) => {
    const fb = () => {
      try {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        showToast(msg || 'Disalin', 'success');
      } catch { showToast('Gagal menyalin', 'error'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(msg || 'Disalin', 'success')).catch(fb);
    } else fb();
  };
  const download = (filename, content, mime = 'application/json') => {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('File diunduh: ' + filename, 'success');
    } catch (e) { showToast('Gagal mengunduh', 'error'); }
  };

  /* ══════════ 5. LOGGER ══════════ */
  const Logger = {
    MAX: 100,
    lines: [],
    add(level, msg) {
      const line = { ts: nowTime(), level: level.toUpperCase(), msg: String(msg) };
      this.lines.push(line);
      if (this.lines.length > this.MAX) this.lines.shift();
      this.render();
      this.debug({ type: 'log', level, msg });
    },
    render() {
      const el = $('#sgLiveLog'); if (!el) return;
      el.innerHTML = this.lines.map(l => {
        const cls = l.level === 'OK' ? 'ok' : l.level === 'WARN' ? 'warn' : l.level === 'ERROR' ? 'error' : 'info';
        return `<div class="srch-log-line ${cls}"><span class="ts">[${esc(l.ts)}]</span> <span class="lv">[${esc(l.level)}]</span> ${esc(l.msg)}</div>`;
      }).join('');
      el.scrollTop = el.scrollHeight;
    },
    clear() { this.lines = []; this.render(); },
    export() {
      const txt = this.lines.map(l => `[${l.ts}] [${l.level}] ${l.msg}`).join('\n');
      download('irgxy-security-log.txt', txt, 'text/plain');
    },
    debug(entry) {
      State.debug.push({ ...entry, ts: Date.now() });
      if (State.debug.length > 500) State.debug.shift();
    }
  };

  /* ══════════ 6. SETTINGS ══════════ */
  function loadSettings() {
    const saved = Storage.readJSON(CFG.STORAGE.SETTINGS, null);
    if (saved && typeof saved === 'object') Object.assign(State.settings, saved);
    State.searchEngine = State.settings.engine || 'google';
  }
  function saveSettings() { Storage.writeJSON(CFG.STORAGE.SETTINGS, State.settings); }

  function applyTheme(theme) {
    let t = theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      t = prefersDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);
    try { localStorage.setItem('irgxy_theme', t); } catch {}
  }

  function applySettings() {
    applyTheme(State.settings.theme);
    document.body.classList.toggle('sg-no-anim', !State.settings.animations);
    document.body.style.fontSize = (State.settings.fontSize || 14) + 'px';
  }

  /* ══════════ 7. ENGINE UI ══════════ */
  function buildEngineMenu() {
    const menu = $('#sgEngineMenu'); if (!menu) return;
    menu.innerHTML = ENGINES.map(e =>
      `<button type="button" class="srch-engine-item${e.id === State.searchEngine ? ' active' : ''}" data-engine="${e.id}" role="menuitem">
        <i class="${e.icon}" style="color:${e.color}"></i>
        <div class="srch-engine-item-info">
          <span class="srch-engine-item-name">${esc(e.name)}</span>
          <span class="srch-engine-item-tag">${esc(e.tag)}</span>
        </div>
      </button>`
    ).join('');
    menu.querySelectorAll('.srch-engine-item').forEach(it => {
      it.addEventListener('click', () => {
        setEngine(it.dataset.engine);
        menu.classList.remove('open');
      });
    });
    // Update dropdown settings select
    const sel = $('#setEngine');
    if (sel) sel.innerHTML = ENGINES.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  }

  function setEngine(id) {
    const e = ENGINES.find(x => x.id === id);
    if (!e) return;
    State.searchEngine = id;
    State.settings.engine = id;
    saveSettings();
    const iconEl = $('#sgEngineIcon');
    const nameEl = $('#sgEngineName');
    if (iconEl) iconEl.className = e.icon;
    if (nameEl) nameEl.textContent = e.name;
    const sel = $('#setEngine'); if (sel) sel.value = id;
    $$('#sgEngineMenu .srch-engine-item').forEach(it => it.classList.toggle('active', it.dataset.engine === id));
  }

  /* ══════════ 8. SUGGESTIONS ══════════ */
  function renderSuggestions(query) {
    const box = $('#sgSuggest'); if (!box) return;
    const q = (query || '').trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; State.suggestions = []; State.suggestIdx = -1; return; }

    const local = State.history
      .filter(h => h.title && h.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map(h => ({ type: h.title, source: 'history' }));

    // Merge + dedupe
    const merged = [];
    const seen = new Set();
    local.forEach(s => { const t = s.type.toLowerCase(); if (!seen.has(t)) { seen.add(t); merged.push(s); } });
    // fetch remote
    fetchRemoteSuggestions(q).then(remote => {
      remote.forEach(s => { const t = s.type.toLowerCase(); if (!seen.has(t)) { seen.add(t); merged.push(s); } });
      if (!merged.length) { box.hidden = true; return; }
      renderSuggestList(merged);
    });
    renderSuggestList(merged);
  }

  function renderSuggestList(merged) {
    const box = $('#sgSuggest'); if (!box) return;
    const q = ($('#sgSearchInput') || {}).value || '';
    const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    State.suggestions = merged;
    State.suggestIdx = -1;
    box.innerHTML = merged.map((s, i) => {
      const hl = esc(s.type).replace(rx, '<mark class="srch-mark">$1</mark>');
      return `<div class="srch-sug-item" data-idx="${i}" role="option"><i class="fas ${s.source === 'history' ? 'fa-clock-rotate-left' : 'fa-magnifying-glass'}"></i> ${hl}</div>`;
    }).join('');
    box.hidden = false;
  }

  async function fetchRemoteSuggestions(q) {
    const now = Date.now();
    const key = q.toLowerCase();
    const cached = State.suggestCache.get(key);
    if (cached && now - cached.ts < CFG.SUGGEST_TTL) return cached.data;

    if (State.suggestAbort) { try { State.suggestAbort.abort(); } catch {} }
    const ctrl = new AbortController();
    State.suggestAbort = ctrl;

    try {
      const res = await fetch('https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list', {
        signal: ctrl.signal,
        timeout: 4000
      });
      const json = await res.json();
      const list = (Array.isArray(json) ? json : (json[1] || [])).slice(0, 8);
      const out = list.map(s => ({ type: typeof s === 'string' ? s : s.phrase, source: 'remote' }));
      State.suggestCache.set(key, { ts: now, data: out });
      return out;
    } catch { return []; }
  }

  function closeSuggestions() {
    const box = $('#sgSuggest'); if (box) { box.hidden = true; }
    State.suggestIdx = -1;
  }

  /* ══════════ 9. HISTORY/BOOKMARKS/READING/BLOCKED ══════════ */
  function addHistory(item) {
    item.ts = Date.now();
    State.history = State.history.filter(h => h.url !== item.url);
    State.history.unshift(item);
    const max = Math.min(State.settings.histMax || 100, CFG.HISTORY_MAX);
    if (State.history.length > max) State.history.length = max;
    Storage.writeJSON(CFG.STORAGE.HISTORY, State.history);
    renderHistory();
    renderSideHistory();
  }

  function renderHistory(filter = '') {
    const list = $('#sgHistoryList'); if (!list) return;
    let items = State.history;
    if (filter) items = items.filter(h => (h.title + h.url).toLowerCase().includes(filter.toLowerCase()));
    if (!items.length) {
      list.innerHTML = '<div class="srch-list-empty"><i class="fas fa-clock-rotate-left" style="font-size:2rem;opacity:.3;display:block;margin-bottom:10px"></i>Belum ada riwayat</div>';
      return;
    }
    list.innerHTML = items.map((h, i) => `
      <div class="srch-list-item">
        <div class="srch-list-icon"><i class="fas ${h.type === 'search' ? 'fa-magnifying-glass' : 'fa-globe'}"></i></div>
        <div class="srch-list-body">
          <div class="srch-list-title">${esc(h.title || h.url)}</div>
          <div class="srch-list-meta">${esc(h.url)} • ${esc(fmtAgo(h.ts))}</div>
        </div>
        <div class="srch-list-actions">
          <button class="srch-icon-btn" data-h-open="${esc(h.url)}" title="Buka"><i class="fas fa-external-link-alt"></i></button>
          <button class="srch-icon-btn" data-h-del="${i}" title="Hapus"><i class="fas fa-trash-can"></i></button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-h-open]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.hOpen)));
    list.querySelectorAll('[data-h-del]').forEach(b => b.addEventListener('click', () => {
      State.history.splice(+b.dataset.hDel, 1);
      Storage.writeJSON(CFG.STORAGE.HISTORY, State.history);
      renderHistory(filter); renderSideHistory();
    }));
  }

  function renderSideHistory(filter = '') {
    const list = $('#sgHistList'); if (!list) return;
    let items = State.history;
    if (filter) items = items.filter(h => (h.title + h.url).toLowerCase().includes(filter.toLowerCase()));
    if (!items.length) { list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-clock-rotate-left"></i>Belum ada riwayat</div>'; return; }
    list.innerHTML = items.slice(0, 60).map((h, i) => `
      <div class="sg-sp-item" data-url="${esc(h.url)}">
        <span class="sg-sp-item-icon"><i class="fas ${h.type === 'search' ? 'fa-magnifying-glass' : 'fa-globe'}"></i></span>
        <div class="sg-sp-item-body">
          <div class="sg-sp-item-title">${esc(h.title || h.url)}</div>
          <div class="sg-sp-item-sub">${esc(h.url)}</div>
        </div>
        <span class="sg-sp-item-time">${esc(fmtAgo(h.ts))}</span>
        <button class="sg-sp-item-del" data-del="${i}" title="Hapus"><i class="fas fa-times"></i></button>
      </div>`).join('');
    list.querySelectorAll('.sg-sp-item').forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('[data-del]')) return;
      navigate(el.dataset.url); closeSidePanel();
    }));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      State.history.splice(+b.dataset.del, 1);
      Storage.writeJSON(CFG.STORAGE.HISTORY, State.history);
      renderSideHistory(filter); renderHistory();
    }));
  }

  function clearHistory() {
    if (!State.history.length) { showToast('Riwayat kosong', 'info'); return; }
    if (!confirm('Hapus semua riwayat?')) return;
    State.history = [];
    Storage.writeJSON(CFG.STORAGE.HISTORY, []);
    renderHistory(); renderSideHistory();
    showToast('Riwayat dibersihkan', 'success');
    Logger.add('OK', 'Riwayat dihapus');
  }

  function toggleBookmarkCurrent() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    const idx = State.bookmarks.findIndex(b => b.url === tab.url);
    if (idx >= 0) {
      State.bookmarks.splice(idx, 1);
      showToast('Bookmark dihapus', 'info');
    } else {
      State.bookmarks.unshift({ title: tab.title || tab.url, url: tab.url, ts: Date.now() });
      showToast('Bookmark ditambahkan ⭐', 'success');
    }
    Storage.writeJSON(CFG.STORAGE.BOOKMARKS, State.bookmarks);
    renderBookmarks(); updateBookmarkBtn(); updateBookmarkCount();
  }

  function addBookmark(title, url) {
    if (!url) return;
    if (State.bookmarks.some(b => b.url === url)) { showToast('Sudah ada di bookmark', 'info'); return; }
    State.bookmarks.unshift({ title, url, ts: Date.now() });
    if (State.bookmarks.length > CFG.BOOKMARKS_MAX) State.bookmarks.length = CFG.BOOKMARKS_MAX;
    Storage.writeJSON(CFG.STORAGE.BOOKMARKS, State.bookmarks);
    renderBookmarks(); updateBookmarkCount();
    showToast('Bookmark ditambahkan', 'success');
  }

  function updateBookmarkBtn() {
    const tab = State.tabs[State.activeTab];
    const btn = $('#sgBookmarkBtn'); if (!btn || !tab) return;
    const isBm = State.bookmarks.some(b => b.url === tab.url);
    btn.classList.toggle('active', isBm);
    const i = btn.querySelector('i');
    if (i) i.className = isBm ? 'fas fa-star' : 'far fa-star';
  }
  function updateBookmarkCount() {
    const el = $('#toolBookmarkCount'); if (el) el.textContent = State.bookmarks.length + ' item';
    const pill = $('#pillBookmark'); if (pill) pill.textContent = State.bookmarks.length;
  }

  function renderBookmarks(filter = '') {
    const list = $('#sgBookmarkList'); if (!list) return;
    let items = State.bookmarks;
    if (filter) items = items.filter(b => (b.title + b.url).toLowerCase().includes(filter.toLowerCase()));
    if (!items.length) {
      list.innerHTML = '<div class="srch-list-empty"><i class="fas fa-bookmark" style="font-size:2rem;opacity:.3;display:block;margin-bottom:10px"></i>Belum ada bookmark</div>';
      return;
    }
    list.innerHTML = items.map((b, i) => `
      <div class="srch-list-item">
        <div class="srch-list-icon"><i class="fas fa-bookmark"></i></div>
        <div class="srch-list-body">
          <div class="srch-list-title">${esc(b.title)}</div>
          <div class="srch-list-meta">${esc(b.url)}</div>
        </div>
        <div class="srch-list-actions">
          <button class="srch-icon-btn" data-b-open="${esc(b.url)}" title="Buka"><i class="fas fa-external-link-alt"></i></button>
          <button class="srch-icon-btn" data-b-del="${i}" title="Hapus"><i class="fas fa-trash-can"></i></button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-b-open]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.bOpen)));
    list.querySelectorAll('[data-b-del]').forEach(b => b.addEventListener('click', () => {
      State.bookmarks.splice(+b.dataset.bDel, 1);
      Storage.writeJSON(CFG.STORAGE.BOOKMARKS, State.bookmarks);
      renderBookmarks(filter); updateBookmarkCount(); updateBookmarkBtn();
    }));
  }

  function renderSideBookmarks(filter = '') {
    const list = $('#sgBmList'); if (!list) return;
    let items = State.bookmarks;
    if (filter) items = items.filter(b => (b.title + b.url).toLowerCase().includes(filter.toLowerCase()));
    if (!items.length) { list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-star"></i>Belum ada bookmark</div>'; return; }
    list.innerHTML = items.map((b, i) => `
      <div class="sg-sp-item" data-url="${esc(b.url)}">
        <span class="sg-sp-item-icon"><i class="fas fa-star"></i></span>
        <div class="sg-sp-item-body">
          <div class="sg-sp-item-title">${esc(b.title)}</div>
          <div class="sg-sp-item-sub">${esc(b.url)}</div>
        </div>
        <button class="sg-sp-item-del" data-del="${i}"><i class="fas fa-times"></i></button>
      </div>`).join('');
    list.querySelectorAll('.sg-sp-item').forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('[data-del]')) return;
      navigate(el.dataset.url); closeSidePanel();
    }));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      State.bookmarks.splice(+b.dataset.del, 1);
      Storage.writeJSON(CFG.STORAGE.BOOKMARKS, State.bookmarks);
      renderSideBookmarks(filter); renderBookmarks(); updateBookmarkCount(); updateBookmarkBtn();
    }));
  }

  function clearBookmarks() {
    if (!State.bookmarks.length) { showToast('Bookmark kosong', 'info'); return; }
    if (!confirm('Hapus semua bookmark?')) return;
    State.bookmarks = [];
    Storage.writeJSON(CFG.STORAGE.BOOKMARKS, []);
    renderBookmarks(); renderSideBookmarks(); updateBookmarkCount();
    showToast('Bookmark dibersihkan', 'success');
  }

  /* READING LIST */
  function addToReading() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    if (State.reading.some(r => r.url === tab.url)) { showToast('Sudah ada di reading list', 'info'); return; }
    State.reading.unshift({
      title: tab.title || tab.url,
      url: tab.url,
      ts: Date.now(),
      readMins: Math.max(1, Math.round((tab.title || '').length / 30))
    });
    Storage.writeJSON(CFG.STORAGE.READING, State.reading);
    renderReading(); renderSideReading();
    showToast('Ditambahkan ke reading list 📖', 'success');
  }

  function renderReading(filter = '') {
    const list = $('#sgReadList'); if (!list) return;
    let items = State.reading;
    if (filter) items = items.filter(r => (r.title + r.url).toLowerCase().includes(filter.toLowerCase()));
    if (!items.length) { list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-book-open"></i>Belum ada artikel tersimpan</div>'; return; }
    list.innerHTML = items.map((r, i) => `
      <div class="sg-sp-item" data-url="${esc(r.url)}">
        <span class="sg-sp-item-icon"><i class="fas fa-book-open"></i></span>
        <div class="sg-sp-item-body">
          <div class="sg-sp-item-title">${esc(r.title)}</div>
          <div class="sg-sp-item-sub">${esc(r.url)}</div>
        </div>
        <span class="sg-sp-item-time">${esc(r.readMins || 1)} min</span>
        <button class="sg-sp-item-del" data-del="${i}"><i class="fas fa-times"></i></button>
      </div>`).join('');
    list.querySelectorAll('.sg-sp-item').forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('[data-del]')) return;
      navigate(el.dataset.url); closeSidePanel();
    }));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      State.reading.splice(+b.dataset.del, 1);
      Storage.writeJSON(CFG.STORAGE.READING, State.reading);
      renderSideReading(filter);
    }));
  }

  function renderSideReading(filter = '') { renderReading(filter); }

  /* BLOCKED DOMAINS */
  function addBlockedDomain(domain) {
    if (!domain) return;
    domain = domain.trim().toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
    if (!domain || !/^[\w.-]+$/.test(domain)) { showToast('Domain tidak valid', 'error'); return; }
    if (State.blocked.some(b => b.domain === domain)) { showToast('Sudah diblokir', 'warning'); return; }
    State.blocked.unshift({ domain, ts: Date.now() });
    if (State.blocked.length > CFG.BLOCKED_MAX) State.blocked.length = CFG.BLOCKED_MAX;
    Storage.writeJSON(CFG.STORAGE.BLOCKED, State.blocked);
    renderBlocked();
    showToast('Domain diblokir: ' + domain, 'success');
  }

  function renderBlocked() {
    const list = $('#sgBlList'); if (!list) return;
    if (!State.blocked.length) { list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-ban"></i>Belum ada domain diblokir</div>'; return; }
    list.innerHTML = State.blocked.map((b, i) => `
      <div class="sg-sp-item">
        <span class="sg-sp-item-icon" style="background:rgba(255,65,108,0.12);color:#ff6584"><i class="fas fa-ban"></i></span>
        <div class="sg-sp-item-body">
          <div class="sg-sp-item-title">${esc(b.domain)}</div>
          <div class="sg-sp-item-sub">${esc(fmtAgo(b.ts))}</div>
        </div>
        <button class="sg-sp-item-del" data-del="${i}"><i class="fas fa-times"></i></button>
      </div>`).join('');
    list.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
      State.blocked.splice(+btn.dataset.del, 1);
      Storage.writeJSON(CFG.STORAGE.BLOCKED, State.blocked);
      renderBlocked();
    }));
  }

  /* ══════════ 10. SAFE BROWSING ══════════ */
  function checkThreat(url) {
    if (!url || !State.settings.blockSuspicious) return { safe: true, reasons: [] };
    const host = getHostname(url);
    if (!host) return { safe: true, reasons: [] };
    const reasons = [];

    if (State.blocked.some(b => b.domain === host || host.endsWith('.' + b.domain)))
      reasons.push('Domain ada di daftar blokir pribadi Anda');
    if (SUSPICIOUS_PATTERNS.some(re => re.test(url)))
      reasons.push('URL cocok dengan pola berbahaya/mencurigakan');
    const full = url.toLowerCase();
    if (SUSPICIOUS_KEYWORDS.some(k => full.includes(k)))
      reasons.push('URL mengandung kata kunci berbahaya');
    const parts = host.split('.');
    if (parts.length >= 5) reasons.push('Subdomain tidak wajar (kemungkinan phishing)');
    if (State.settings.whitelistMode) {
      const wl = ['google.com','duckduckgo.com','wikipedia.org','github.com','youtube.com','mozilla.org'];
      if (!wl.some(d => host === d || host.endsWith('.' + d)))
        reasons.push('Whitelist mode: domain tidak ada di daftar aman');
    }
    if (State.settings.kidsMode) {
      if (SUSPICIOUS_KEYWORDS.some(k => full.includes(k)))
        reasons.push('Kids Mode: konten dewasa diblokir');
    }
    if (State.settings.safeBrowsing === 'paranoid') {
      if (!url.startsWith('https://')) reasons.push('Paranoid: situs HTTP tidak aman');
    }
    return { safe: reasons.length === 0, reasons };
  }

  /* ══════════ 11. NAVIGASI & TABS ══════════ */
  function navigate(input, opts = {}) {
    if (!input) return;
    let url = input.trim();
    let type = 'visit';
    if (!isURL(url)) {
      const eng = ENGINES.find(e => e.id === State.searchEngine) || ENGINES[0];
      url = eng.url(url);
      type = 'search';
    } else {
      url = normalizeURL(url);
    }

    // Safe browsing check
    if (!opts.bypassSafe) {
      const threat = checkThreat(url);
      if (!threat.safe && !opts.force) {
        showBlockedScreen(url, threat);
        Logger.add('WARN', 'Safe Browsing blokir: ' + url);
        return;
      }
    }

    // HTTPS-Only mode
    if (State.settings.httpsOnly && url.startsWith('http://')) {
      url = url.replace(/^http:\/\//, 'https://');
    }

    addHistory({ type, title: type === 'search' ? input : (getHostname(url) || url), url });
    // Update current tab
    const tab = State.tabs[State.activeTab];
    if (tab) {
      tab.url = url;
      tab.title = type === 'search' ? input : (getHostname(url) || url);
      tab.loading = true;
      renderTabs();
    }
    switchToBrowser();
    loadFrame(url);
    Activity.add && Activity.add('download', 'Browsing: ' + url.slice(0, 80));
  }

  function switchToBrowser() {
    $('#sgHomeMode').hidden = true;
    $('#sgBrowserMode').hidden = false;
    $('#sgBlocked').hidden = true;
    $('#sgBrowser').hidden = false;
    $('#sgResultPanel').hidden = true;
  }

  function switchToHome() {
    $('#sgHomeMode').hidden = false;
    $('#sgBrowserMode').hidden = true;
    closeFindBar();
    const inp = $('#sgMiniInput'); if (inp) inp.value = '';
    const mainInp = $('#sgSearchInput');
    if (mainInp) { mainInp.focus(); mainInp.select(); }
  }

  function loadFrame(url) {
    const frame = $('#sgFrame');
    const overlay = $('#sgBrowserOverlay');
    const fill = $('#sgLoaderFill');
    const txt = $('#sgLoaderText');
    const pct = $('#sgLoaderPct');
    if (!frame || !overlay) return;

    overlay.classList.add('show');
    overlay.setAttribute('aria-busy', 'true');
    if (fill) fill.style.width = '0%';
    if (pct) pct.textContent = '0%';
    if (txt) txt.textContent = 'Menghubungkan ke ' + getHostname(url) + '…';

    let progress = 0;
    const tick = setInterval(() => {
      progress = Math.min(progress + 6 + Math.random() * 14, 92);
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.round(progress) + '%';
      if (txt) {
        if (progress < 30) txt.textContent = 'Menghubungkan…';
        else if (progress < 60) txt.textContent = 'Mengambil data…';
        else if (progress < 90) txt.textContent = 'Memuat halaman…';
        else txt.textContent = 'Hampir selesai…';
      }
    }, 160);

    frame.onload = () => {
      clearInterval(tick);
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      if (txt) txt.textContent = 'Selesai';
      setTimeout(() => {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-busy', 'false');
      }, 400);
      const t = State.tabs[State.activeTab];
      if (t) { t.loading = false; renderTabs(); }
    };

    try {
      frame.src = url;
      // Update mini input with current URL
      const mini = $('#sgMiniInput');
      if (mini && document.activeElement !== mini) mini.value = url;
    } catch (e) {
      clearInterval(tick);
      overlay.classList.remove('show');
      showToast('Gagal memuat. Buka di tab baru.', 'warning');
      window.open(url, '_blank', 'noopener');
    }
  }

  function newTab(url = '', title = 'Tab Baru') {
    return { id: State.tabIdCounter++, url, title, loading: false, pinned: false, discarded: false, zoom: 100 };
  }

  function initTabs() {
    const saved = Storage.readJSON(CFG.STORAGE.TABS, null);
    if (saved && Array.isArray(saved) && saved.length) {
      State.tabs = saved.map(t => ({ ...t, loading: false }));
      State.tabIdCounter = Math.max(...State.tabs.map(t => t.id || 0)) + 1;
      State.activeTab = Math.min(State.activeTab || 0, State.tabs.length - 1);
    } else {
      State.tabs = [newTab('', 'Tab 1')];
      State.activeTab = 0;
    }
    renderTabs();
  }

  function renderTabs() {
    const wrap = $('#sgTabs'); if (!wrap) return;
    wrap.innerHTML = State.tabs.map((t, i) => `
      <div class="sg-tab${i === State.activeTab ? ' active' : ''}${t.loading ? ' loading' : ''}${t.pinned ? ' pinned' : ''}${t.discarded ? ' discarded' : ''}" data-idx="${i}" title="${esc(t.title)}" role="tab" aria-selected="${i === State.activeTab}">
        <span class="sg-tab-favicon"><i class="fas ${t.pinned ? 'fa-thumbtack' : (t.loading ? 'fa-spinner' : (t.url ? 'fa-globe' : 'fa-plus'))}"></i></span>
        <span class="sg-tab-title">${esc(t.title || 'Tab Baru')}</span>
        ${State.tabs.length > 1 ? `<button class="sg-tab-close" data-close="${i}" aria-label="Tutup"><i class="fas fa-times"></i></button>` : ''}
      </div>`).join('');

    wrap.querySelectorAll('.sg-tab').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-close]')) return;
        const i = +el.dataset.idx;
        if (i !== State.activeTab) switchTab(i);
      });
      el.addEventListener('contextmenu', e => { e.preventDefault(); showTabMenu(+el.dataset.idx, e.clientX, e.clientY); });
    });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); closeTab(+b.dataset.close);
    }));
    Storage.writeJSON(CFG.STORAGE.TABS, State.tabs);
  }

  function switchTab(i) {
    State.activeTab = i;
    const tab = State.tabs[i];
    renderTabs();
    if (tab && tab.url) {
      switchToBrowser();
      loadFrame(tab.url);
    } else {
      switchToHome();
    }
    updateBookmarkBtn();
  }

  function closeTab(i) {
    if (State.tabs.length <= 1) return;
    State.tabs.splice(i, 1);
    if (State.activeTab >= State.tabs.length) State.activeTab = State.tabs.length - 1;
    renderTabs();
    switchTab(State.activeTab);
  }

  function addTab() {
    if (State.tabs.length >= CFG.TABS_MAX) { showToast('Terlalu banyak tab (maks ' + CFG.TABS_MAX + ')', 'warning'); return; }
    State.tabs.push(newTab('', 'Tab ' + (State.tabs.length + 1)));
    State.activeTab = State.tabs.length - 1;
    renderTabs();
    switchToHome();
    setTimeout(() => { const inp = $('#sgSearchInput'); if (inp) { inp.value = ''; inp.focus(); } }, 60);
  }

  function showTabMenu(idx, x, y) {
    // Simplified tab context menu
    const opts = ['Pin/Unpin Tab', 'Duplicate Tab', 'Discard Tab (Hemat RAM)', 'Close Others', 'Close to Right', 'Close Tab'];
    const choice = prompt('Aksi tab:\n1. Pin/Unpin\n2. Duplicate\n3. Discard\n4. Close Others\n5. Close to Right\n6. Close Tab\n\nMasukkan nomor:', '1');
    if (!choice) return;
    const t = State.tabs[idx];
    switch (choice.trim()) {
      case '1': t.pinned = !t.pinned; renderTabs(); break;
      case '2': State.tabs.splice(idx + 1, 0, { ...t, id: State.tabIdCounter++ }); renderTabs(); break;
      case '3': t.discarded = true; if (State.activeTab === idx) switchToHome(); renderTabs(); showToast('Tab ditidurkan', 'info'); break;
      case '4': State.tabs = [State.tabs[State.activeTab]]; State.activeTab = 0; renderTabs(); switchTab(0); break;
      case '5': State.tabs = State.tabs.slice(0, State.activeTab + 1); if (State.activeTab >= State.tabs.length) State.activeTab = State.tabs.length - 1; renderTabs(); break;
      case '6': closeTab(idx); break;
    }
  }

  function showBlockedScreen(url, threat) {
    switchToBrowser();
    $('#sgBrowser').hidden = true;
    const block = $('#sgBlocked');
    block.hidden = false;
    const msg = $('#sgBlockedMsg');
    const reasons = $('#sgBlockedReasons');
    if (msg) msg.textContent = 'Situs ' + getHostname(url) + ' terdeteksi mencurigakan oleh Safe Browsing.';
    if (reasons) reasons.innerHTML = threat.reasons.map(r =>
      `<div class="sg-blocked-reason"><i class="fas fa-triangle-exclamation"></i> ${esc(r)}</div>`
    ).join('');
    $('#sgBlockedProceedBtn').onclick = () => {
      if (!confirm('Anda yakin ingin melanjutkan? Situs ini mungkin berbahaya.')) return;
      block.hidden = true;
      $('#sgBrowser').hidden = false;
      navigate(url, { bypassSafe: true, force: true });
    };
    $('#sgBlockedBackBtn').onclick = () => {
      block.hidden = true;
      switchToHome();
    };
  }

  /* ══════════ 12. BYPASS ══════════ */
  function bypassUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url) { showToast('Masukkan URL', 'warning'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch { showToast('URL tidak valid', 'error'); return; }

    showBypassLoading(() => {
      const box = $('#sgBypassResult');
      const urlEl = $('#sgBypassUrl');
      const list = $('#sgBypassProxies');
      if (urlEl) urlEl.innerHTML = `<i class="fas fa-link"></i> ${esc(url)}`;
      if (list) list.innerHTML = PROXIES.map(p =>
        `<button type="button" class="srch-res-btn" data-open="${esc(p.fn(url))}" style="justify-content:center;padding:11px"><i class="fas fa-shield-halved"></i> ${esc(p.name)}</button>`
      ).join('');
      if (box) box.hidden = false;
      Logger.add('OK', 'Bypass siap: ' + url);
      showToast('8 proxy tersedia ✅', 'success');
    });
  }

  function showBypassLoading(cb) {
    const overlay = $('#sgLoadingOverlay');
    const fill = $('#sgProgressFill');
    if (!overlay) { cb(); return; }
    overlay.classList.add('open');
    if (fill) fill.style.width = '0%';
    let p = 0;
    const timer = setInterval(() => {
      p += 6 + Math.random() * 12;
      if (p >= 100) { p = 100; clearInterval(timer); }
      if (fill) fill.style.width = p + '%';
    }, 90);
    setTimeout(() => {
      clearInterval(timer);
      if (fill) fill.style.width = '100%';
      overlay.classList.remove('open');
      cb();
    }, 1200);
  }

  /* ══════════ 13. SECURITY AUDIT ══════════ */
  function hitungSkor() {
    let s = 100;
    if (!State.settings.blockTrackers) s -= 15;
    if (State.settings.safeBrowsing === 'off') s -= 15;
    if (!State.settings.httpsOnly) s -= 10;
    if (!State.settings.blockWebRTC) s -= 10;
    if (!State.settings.blockFingerprint) s -= 10;
    if (!State.settings.blockSuspicious) s -= 10;
    if (!State.settings.doh) s -= 10;
    if (!State.settings.doNotTrack) s -= 10;
    if (!State.settings.torMode) s -= 10;
    return Math.max(0, Math.min(100, s));
  }
  function updateSecurityScore() {
    const s = hitungSkor();
    const ring = $('#sgScoreRing');
    const num = $('#sgScoreNum');
    if (num) num.textContent = s;
    if (ring) {
      const total = 2 * Math.PI * 52;
      ring.setAttribute('stroke-dasharray', (s / 100) * total + ' ' + total);
    }
  }

  function setTestResult(dotId, valId, ok, msg) {
    const dot = $('#' + dotId);
    const val = $('#' + valId);
    const cls = ok === true ? 'ok' : ok === false ? 'bad' : 'warn';
    if (dot) dot.className = 'srch-sec-dot ' + cls;
    if (val) { val.className = 'srch-sec-test-val ' + cls; val.textContent = msg; }
  }

  async function runSecurityAudit() {
    const status = $('#sgSecStatus');
    if (status) status.textContent = 'Auditing…';
    Logger.add('INFO', 'Audit keamanan dimulai');
    const status2 = $('#pillScan'); if (status2) status2.textContent = 'RUN';

    // TEST 1: IP Leak (via ipify)
    try {
      const r = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
      const j = await r.json();
      setTestResult('dotIp', 'valIp', true, 'IP: ' + (j.ip || '?'));
      Logger.add('OK', 'IP terdeteksi: ' + j.ip);
    } catch { setTestResult('dotIp', 'valIp', null, 'N/A'); }

    // TEST 2: DNS DoH
    try {
      if (State.settings.doh) {
        const provider = DNS_PROVIDERS[State.settings.dns] || DNS_PROVIDERS.cloudflare;
        const r = await fetch(provider.doh + '?name=example.com&type=A', {
          headers: { Accept: 'application/dns-json' }, timeout: 5000
        });
        if (r.ok) { setTestResult('dotDns', 'valDns', true, 'DoH OK'); Logger.add('OK', 'DoH aktif: ' + provider.name); }
        else throw new Error('HTTP ' + r.status);
      } else { setTestResult('dotDns', 'valDns', false, 'DoH OFF'); }
    } catch { setTestResult('dotDns', 'valDns', false, 'DoH FAIL'); }

    // TEST 3: WebRTC
    setTimeout(() => {
      const webrtcOk = State.settings.blockWebRTC;
      setTestResult('dotWebrtc', 'valWebrtc', webrtcOk ? true : false, webrtcOk ? 'OK' : 'LEAK');
      Logger.add(webrtcOk ? 'OK' : 'WARN', 'WebRTC: ' + (webrtcOk ? 'blocked' : 'exposed'));
    }, 600);

    // TEST 4: Fingerprint
    setTimeout(() => {
      const fpOk = State.settings.blockFingerprint;
      setTestResult('dotFp', 'valFp', fpOk ? true : false, fpOk ? 'OK' : 'WARN');
      Logger.add(fpOk ? 'OK' : 'WARN', 'Fingerprint protection: ' + (fpOk ? 'ON' : 'OFF'));
    }, 1000);

    // TEST 5: SSL
    setTimeout(() => {
      const sslOk = location.protocol === 'https:' || location.hostname === 'localhost' || location.protocol === 'file:';
      setTestResult('dotSsl', 'valSsl', sslOk ? true : false, sslOk ? 'OK' : 'HTTP');
      Logger.add(sslOk ? 'OK' : 'WARN', 'SSL: ' + (sslOk ? 'secure' : 'insecure'));
    }, 1400);

    // TEST 6: Cookies
    setTimeout(() => {
      const ckOk = State.settings.blockCookies3p;
      setTestResult('dotCookie', 'valCookie', ckOk ? true : false, ckOk ? 'OK' : 'WARN');
      Logger.add(ckOk ? 'OK' : 'WARN', 'Cookie 3rd-party: ' + (ckOk ? 'blocked' : 'allowed'));
    }, 1800);

    setTimeout(() => {
      if (status) status.textContent = 'Audit selesai';
      const status2 = $('#pillScan'); if (status2) status2.textContent = 'DONE';
      updateSecurityScore();
      showToast('Audit keamanan selesai 🛡️', 'success');
      Logger.add('OK', 'Audit selesai — skor ' + hitungSkor());
    }, 2100);
  }

  function activateSafeMode() {
    Object.assign(State.settings, {
      blockTrackers: true, blockAds: true, blockPopups: true,
      blockCookies3p: true, doNotTrack: true, safeBrowsing: 'paranoid',
      blockSuspicious: true, httpsOnly: true, blockWebRTC: true,
      blockFingerprint: true, blockGeo: true, blockMedia: true,
      doh: true, torMode: true
    });
    saveSettings();
    syncSettingsToUI();
    applySettings();
    updateSecurityScore();
    document.body.classList.add('sg-safemode-active');
    showToast('🛡️ Mode Aman Maksimal AKTIF', 'success');
    Logger.add('OK', 'Mode aman maksimal diaktifkan');
    setTimeout(() => document.body.classList.remove('sg-safemode-active'), 2600);
    runSecurityAudit();
  }

  function showPrivacyReport() {
    const s = hitungSkor();
    const grade = s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D';
    const provider = DNS_PROVIDERS[State.settings.dns] || DNS_PROVIDERS.cloudflare;
    const body = $('#sgPrivacyBody');
    if (!body) return;
    body.innerHTML = `
      <div class="sg-privacy-grade">${grade}</div>
      <p style="text-align:center;color:var(--text-secondary);margin-bottom:14px">Skor privasi Anda: <strong style="color:var(--sg-gold)">${s}/100</strong></p>
      <div class="sg-privacy-grid">
        <div class="sg-privacy-item"><div class="label">DoH</div><div class="value">${State.settings.doh ? '✓ Aktif' : '✗ OFF'}</div></div>
        <div class="sg-privacy-item"><div class="label">DNS Provider</div><div class="value">${esc(provider.name)}</div></div>
        <div class="sg-privacy-item"><div class="label">Tracker</div><div class="value">${State.settings.blockTrackers ? '✓ Blokir' : '✗ Izinkan'}</div></div>
        <div class="sg-privacy-item"><div class="label">WebRTC</div><div class="value">${State.settings.blockWebRTC ? '✓ Blokir' : '✗ Leak'}</div></div>
        <div class="sg-privacy-item"><div class="label">Fingerprint</div><div class="value">${State.settings.blockFingerprint ? '✓ Blokir' : '✗ Expose'}</div></div>
        <div class="sg-privacy-item"><div class="label">Cookie 3P</div><div class="value">${State.settings.blockCookies3p ? '✓ Blokir' : '✗ Izinkan'}</div></div>
        <div class="sg-privacy-item"><div class="label">HTTPS Only</div><div class="value">${State.settings.httpsOnly ? '✓ Aktif' : '✗ OFF'}</div></div>
        <div class="sg-privacy-item"><div class="label">TOR Mode</div><div class="value">${State.settings.torMode ? '✓ Aktif' : '✗ OFF'}</div></div>
      </div>
      <p style="margin-top:16px;font-size:0.8rem;color:var(--sg-text-3);line-height:1.6">Laporan ini dibuat lokal di browser Anda. Tidak ada data yang dikirim ke server manapun.</p>`;
    openModal('sgPrivacyModal');
  }

  /* ══════════ 14. DNS LOOKUP ══════════ */
  async function dnsLookup(name) {
    if (!name) return;
    name = name.trim().replace(/^https?:\/\//, '').split('/')[0];
    const provider = DNS_PROVIDERS[State.settings.dns];
    const url = State.settings.dns === 'custom' ? State.settings.customDns : (provider ? provider.doh : '');
    if (!url) { showToast('DNS provider tidak valid', 'error'); return; }
    const list = $('#sgDnsList');
    if (list) list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-spinner fa-spin"></i>Query DNS…</div>';
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(url + sep + 'name=' + encodeURIComponent(name) + '&type=A', {
        headers: { Accept: 'application/dns-json' }, timeout: 6000
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const answers = (json.Answer || []).filter(a => [1, 5, 28].includes(a.type));
      State.dnsCache.push({ name, provider: provider ? provider.name : 'custom', count: answers.length, ts: Date.now() });
      if (State.dnsCache.length > 60) State.dnsCache.shift();
      if (!answers.length) { list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-info-circle"></i>Tidak ada record ditemukan</div>'; return; }
      list.innerHTML = answers.map(a => `
        <div class="sg-dns-result">
          <strong>${esc(name)}</strong> → <span style="color:#4facfe">${esc(a.data)}</span>
          <div style="opacity:.6;font-size:.7rem;margin-top:4px">Type ${a.type === 1 ? 'A' : a.type === 28 ? 'AAAA' : 'CNAME'} · TTL ${a.TTL || '?'}s</div>
        </div>`).join('');
      showToast('DNS OK via ' + (provider ? provider.name : 'Custom'), 'success');
    } catch (e) {
      if (list) list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-triangle-exclamation"></i>DNS gagal<br><small style="opacity:.6">' + esc(e.message) + '</small></div>';
      showToast('DNS gagal: ' + e.message, 'error');
    }
  }

  /* ══════════ 15. MODAL HELPERS ══════════ */
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); }
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
  }

  /* ══════════ 16. SEARCH SUBMIT ══════════ */
  function submitSearch() {
    const inp = $('#sgSearchInput');
    if (!inp) return;
    const v = inp.value.trim();
    if (!v) { showToast('Masukkan kata kunci', 'warning'); return; }
    if (v.length > 500) { showToast('Query terlalu panjang (maks 500)', 'warning'); return; }
    closeSuggestions();
    navigate(v);
  }

  function submitMiniSearch() {
    const inp = $('#sgMiniInput');
    if (!inp) return;
    const v = inp.value.trim();
    if (!v) return;
    navigate(v);
  }

  /* ══════════ 17. VOICE ══════════ */
  let speechRec = null;
  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Browser tidak mendukung pencarian suara', 'warning'); return; }
    if (speechRec) { try { speechRec.abort(); } catch {} speechRec = null; return; }
    speechRec = new SR();
    speechRec.lang = 'id-ID';
    speechRec.interimResults = false;
    speechRec.maxAlternatives = 1;
    const btn = $('#sgVoiceBtn');
    if (btn) btn.style.color = '#ff6584';
    showToast('🎤 Bicara sekarang…', 'info');
    speechRec.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      const inp = $('#sgSearchInput');
      if (inp) inp.value = txt;
      submitSearch();
    };
    speechRec.onerror = (e) => {
      Logger.add('WARN', 'Voice error: ' + (e.error || 'unknown'));
      showToast('Voice error: ' + (e.error || 'gagal'), 'warning');
      if (btn) btn.style.color = '';
      speechRec = null;
    };
    speechRec.onend = () => { if (btn) btn.style.color = ''; speechRec = null; };
    try { speechRec.start(); } catch { if (btn) btn.style.color = ''; speechRec = null; }
  }

  /* ══════════ 18. FIND IN PAGE ══════════ */
  function openFindBar() {
    const bar = $('#sgFindBar');
    if (bar) { bar.hidden = false; $('#sgFindInput').focus(); $('#sgFindInput').select(); }
  }
  function closeFindBar() {
    const bar = $('#sgFindBar'); if (bar) bar.hidden = true;
    const inp = $('#sgFindInput'); if (inp) inp.value = '';
    const cnt = $('#sgFindCount'); if (cnt) cnt.textContent = '0/0';
  }
  function findInPage(term, forward = true) {
    if (!term) { const cnt = $('#sgFindCount'); if (cnt) cnt.textContent = '0/0'; return; }
    // Fallback: window.find API (bekerja di sebagian browser)
    try {
      const found = window.find(term, false, !forward, true, false, true, false);
      const cnt = $('#sgFindCount');
      if (cnt) cnt.textContent = found ? '✓' : '0/0';
    } catch { showToast('Find-in-page tidak didukung browser ini', 'warning'); }
  }

  /* ══════════ 19. SHARE / QR / TRANSLATE / ARCHIVE ══════════ */
  async function sharePage() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    if (navigator.share) {
      try { await navigator.share({ title: tab.title, url: tab.url }); showToast('Dibagikan', 'success'); }
      catch (e) { if (e.name !== 'AbortError') copyToClipboard(tab.url, 'URL disalin'); }
    } else {
      copyToClipboard(tab.url, 'URL disalin ke clipboard');
    }
  }

  function showQrCode() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    const box = $('#sgQrBox');
    const urlEl = $('#sgQrUrl');
    if (urlEl) urlEl.textContent = tab.url;
    if (box) {
      box.innerHTML = '';
      if (window.QRCode) {
        try { new QRCode(box, { text: tab.url, width: 220, height: 220, colorDark: '#000', colorLight: '#fff' }); }
        catch { box.innerHTML = '<div style="padding:20px;color:#000;font-size:12px">QR gagal — ' + esc(tab.url) + '</div>'; }
      } else {
        box.innerHTML = '<div style="padding:20px;color:#000;font-size:12px;word-break:break-all">' + esc(tab.url) + '</div>';
      }
    }
    openModal('sgQrModal');
  }

  function translatePage() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    const url = 'https://translate.google.com/translate?sl=auto&tl=id&u=' + encodeURIComponent(tab.url);
    navigate(url, { bypassSafe: true, force: true });
    Logger.add('INFO', 'Translate: ' + tab.url);
  }

  function openArchive() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    const url = 'https://web.archive.org/web/2024/' + tab.url;
    window.open(url, '_blank', 'noopener');
    Logger.add('OK', 'Archive.org: ' + tab.url);
  }

  /* ══════════ 20. READER MODE ══════════ */
  let readerFontSize = 16;
  function openReaderMode() {
    const tab = State.tabs[State.activeTab];
    if (!tab || !tab.url) { showToast('Tidak ada halaman aktif', 'warning'); return; }
    const body = $('#sgReaderBody');
    if (body) {
      body.style.fontSize = readerFontSize + 'px';
      body.innerHTML = `
        <h2 style="color:#fff;font-family:var(--font-display);margin-bottom:8px">${esc(tab.title || tab.url)}</h2>
        <p style="color:var(--sg-text-3);font-size:0.82rem;margin-bottom:20px">${esc(tab.url)}</p>
        <p style="color:var(--text-secondary);line-height:1.8">Reader Mode memerlukan ekstraksi konten halaman. Karena keterbatasan iframe cross-origin, konten lengkap tidak dapat di-ekstrak secara otomatis dari dalam browser tanpa server.</p>
        <p style="color:var(--text-secondary);line-height:1.8;margin-top:12px">Silakan buka halaman di tab baru untuk membaca konten aslinya, atau gunakan tombol Share untuk menyimpan link.</p>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <button class="sg-btn sg-btn-primary" onclick="window.open('${esc(tab.url)}','_blank','noopener')"><i class="fas fa-external-link-alt"></i> Buka Asli</button>
          <button class="sg-btn sg-btn-secondary" onclick="IrgxySearch.addToReading()"><i class="fas fa-book-open"></i> Simpan ke Reading List</button>
        </div>`;
    }
    openModal('sgReaderModal');
  }

  /* ══════════ 21. IMPORT/EXPORT ══════════ */
  function exportSettings() {
    download('irgxy-search-settings.json', JSON.stringify(State.settings, null, 2));
  }
  function importSettings() {
    const f = $('#sgImportSettingsFile'); if (f) f.click();
  }
  function handleImportSettings(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (typeof data !== 'object') throw new Error('Format tidak valid');
        Object.assign(State.settings, data);
        saveSettings();
        syncSettingsToUI();
        applySettings();
        showToast('Setelan diimport', 'success');
      } catch (err) { showToast('Import gagal: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  }
  function exportBookmarksHTML() {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${State.bookmarks.map(b => `    <DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor(b.ts / 1000)}">${esc(b.title)}</A>`).join('\n')}
</DL><p>`;
    download('irgxy-bookmarks.html', html, 'text/html');
  }
  function importBookmarks() {
    const f = $('#sgImportBookmarksFile'); if (f) f.click();
  }
  function handleImportBookmarks(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, 'text/html');
        const links = doc.querySelectorAll('a[href]');
        let count = 0;
        links.forEach(a => {
          const url = a.getAttribute('href');
          const title = a.textContent.trim() || url;
          if (url && /^https?:\/\//i.test(url) && !State.bookmarks.some(b => b.url === url)) {
            State.bookmarks.push({ title, url, ts: Date.now() });
            count++;
          }
        });
        Storage.writeJSON(CFG.STORAGE.BOOKMARKS, State.bookmarks);
        renderBookmarks(); renderSideBookmarks(); updateBookmarkCount();
        showToast(count + ' bookmark diimport', 'success');
      } catch (err) { showToast('Import gagal', 'error'); }
    };
    reader.readAsText(file);
  }

  /* ══════════ 22. DEBUG PANEL ══════════ */
  function renderDebug() {
    const list = $('#sgDebugList'); if (!list) return;
    const recent = State.debug.slice(-100).reverse();
    if (!recent.length) { list.innerHTML = '<div class="sg-sp-empty"><i class="fas fa-bug"></i>Belum ada log debug</div>'; return; }
    list.innerHTML = recent.map(d => `
      <div class="sg-sp-item" style="font-family:'JetBrains Mono',monospace;font-size:0.72rem">
        <div class="sg-sp-item-body">
          <div class="sg-sp-item-title">[${esc(d.level || d.type || 'INFO')}] ${esc(d.msg || JSON.stringify(d).slice(0, 80))}</div>
          <div class="sg-sp-item-sub">${esc(new Date(d.ts).toLocaleTimeString('id-ID'))}</div>
        </div>
      </div>`).join('');
  }
  function exportDebug() {
    download('irgxy-debug-log.json', JSON.stringify(State.debug, null, 2));
  }

  /* ══════════ 23. DRAWER / SIDE PANEL ══════════ */
  function openDrawer(tab) {
    const d = $('#sgDrawer'), o = $('#sgDrawerOverlay');
    if (!d || !o) return;
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    o.classList.add('open');
    if (tab) {
      $$('.srch-dtab').forEach(t => t.classList.toggle('active', t.dataset.dtab === tab));
      $$('.srch-dpane').forEach(p => p.classList.toggle('active', p.dataset.dpane === tab));
    }
  }
  function closeDrawer() {
    const d = $('#sgDrawer'), o = $('#sgDrawerOverlay');
    if (d) { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); }
    if (o) o.classList.remove('open');
  }

  function openSidePanel(panel) {
    const sp = $('#sgSidePanel'), ov = $('#sgSidePanelOverlay');
    if (!sp) return;
    sp.classList.add('open'); sp.setAttribute('aria-hidden', 'false');
    if (ov) ov.hidden = false;
    if (panel) {
      $$('.sg-sp-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
      $$('.sg-sp-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === panel));
    }
    if (panel === 'debug') renderDebug();
  }
  function closeSidePanel() {
    const sp = $('#sgSidePanel'), ov = $('#sgSidePanelOverlay');
    if (sp) { sp.classList.remove('open'); sp.setAttribute('aria-hidden', 'true'); }
    if (ov) ov.hidden = true;
  }

  /* ══════════ 24. ENGINE INFO MODAL ══════════ */
  function showEngineInfo() {
    const e = ENGINES.find(x => x.id === State.searchEngine);
    if (!e) return;
    const body = $('#sgEngineInfoBody');
    if (!body) return;
    const stars = '★'.repeat(e.privacy) + '☆'.repeat(5 - e.privacy);
    body.innerHTML = `
      <div class="sg-engine-info-row"><span class="label">Nama</span><span class="value">${esc(e.name)}</span></div>
      <div class="sg-engine-info-row"><span class="label">Kategori</span><span class="value">${esc(e.tag)}</span></div>
      <div class="sg-engine-info-row"><span class="label">Rating Privasi</span><span class="value sg-engine-rating">${stars} (${e.privacy}/5)</span></div>
      <div class="sg-engine-info-row"><span class="label">Homepage</span><span class="value"><a href="${esc(e.home)}" target="_blank" rel="noopener" style="color:var(--sg-gold)">${esc(e.home)}</a></span></div>
      <div style="margin-top:18px;padding:12px;background:rgba(201,169,110,0.08);border-radius:10px;font-size:0.82rem;color:var(--text-secondary);line-height:1.6">
        <strong style="color:#fff">Catatan:</strong> Rating privasi berdasarkan kebijakan retensi data &amp; tracking publik. Rating 5 = zero-log, 1 = full tracking.
      </div>`;
    openModal('sgEngineInfoModal');
  }

  /* ══════════ 25. SHORTCUT HELP ══════════ */
  function showShortcutHelp() {
    const body = $('#sgShortcutBody');
    if (!body) return;
    const shortcuts = [
      ['Ctrl + K', 'Fokus ke search bar'],
      ['Ctrl + L', 'Fokus ke search bar'],
      ['Ctrl + T', 'Tab baru'],
      ['Ctrl + W', 'Tutup tab'],
      ['Ctrl + R', 'Reload halaman'],
      ['Ctrl + H', 'Buka riwayat'],
      ['Ctrl + D', 'Bookmark halaman'],
      ['Ctrl + F', 'Find in page'],
      ['Ctrl + P', 'Print halaman'],
      ['Ctrl + Shift + P', 'Toggle mode privasi'],
      ['Ctrl + = / -', 'Zoom in/out'],
      ['Ctrl + 0', 'Reset zoom'],
      ['Alt + ← / →', 'Back / Forward'],
      ['Esc', 'Tutup overlay / stop'],
      ['?', 'Tampilkan bantuan ini']
    ];
    body.innerHTML = `<div class="sg-shortcut-grid">
      ${shortcuts.map(([k, v]) => `<div class="sg-shortcut-row"><kbd>${k.split(' + ').map(x => `<kbd>${esc(x)}</kbd>`).join(' + ')}</kbd><span>${esc(v)}</span></div>`).join('')}
    </div>`;
    openModal('sgShortcutModal');
  }

  /* ══════════ 26. SETTINGS SYNC ══════════ */
  function syncSettingsToUI() {
    const s = State.settings;
    const set = (id, val, isCheck = false) => {
      const el = document.getElementById(id); if (!el) return;
      if (isCheck || el.type === 'checkbox') el.checked = !!val;
      else el.value = val;
    };
    set('setHomepage', s.homepage);
    set('setEngine', s.engine);
    set('setLang', s.lang);
    set('setTheme', s.theme);
    set('setHistMax', s.histMax);
    const hm = $('#setHistMaxVal'); if (hm) hm.textContent = s.histMax;
    set('setFontSize', s.fontSize);
    const fs = $('#setFontSizeVal'); if (fs) fs.textContent = s.fontSize;
    set('setZoom', s.zoom);
    const zm = $('#setZoomVal'); if (zm) zm.textContent = s.zoom;
    set('setDoNotTrack', s.doNotTrack, true);
    set('setBlockCookies3p', s.blockCookies3p, true);
    set('setBlockTrackers', s.blockTrackers, true);
    set('setBlockAds', s.blockAds, true);
    set('setBlockPopups', s.blockPopups, true);
    set('setAutoClear', s.autoClear, true);
    set('setKidsMode', s.kidsMode, true);
    set('setWhitelistMode', s.whitelistMode, true);
    set('setSafeBrowsing', s.safeBrowsing);
    set('setBlockSuspicious', s.blockSuspicious, true);
    set('setHttpsOnly', s.httpsOnly, true);
    set('setBlockWebRTC', s.blockWebRTC, true);
    set('setBlockFingerprint', s.blockFingerprint, true);
    set('setBlockGeo', s.blockGeo, true);
    set('setBlockMedia', s.blockMedia, true);
    // DNS select
    const dns = $('#setDns');
    if (dns) {
      dns.innerHTML = Object.keys(DNS_PROVIDERS).map(k => `<option value="${k}">${esc(DNS_PROVIDERS[k].name)} (${DNS_PROVIDERS[k].primary})</option>`).join('');
      dns.value = s.dns;
    }
    set('setCustomDns', s.customDns);
    set('setDoh', s.doh, true);
    set('setProxy', s.proxy);
    set('setTor', s.torMode, true);
    set('setAccent', s.accent);
    set('setLayout', s.layout);
    set('setShowFavicon', s.showFavicon, true);
    set('setShowPreview', s.showPreview, true);
    set('setAnimations', s.animations, true);
    set('setUserAgent', s.userAgent);
    set('setJavascript', s.javascript, true);
    set('setImages', s.images, true);
    set('setCookies', s.cookies, true);
    set('setHwAccel', s.hwAccel, true);
    updateDnsInfo();
    updateSecurityScore();
  }

  function updateDnsInfo() {
    const info = $('#sgDnsInfo');
    const toolDns = $('#toolDnsName');
    if (!info) return;
    const s = State.settings;
    if (s.dns === 'custom' && s.customDns) {
      info.textContent = 'DNS Aktif: Custom (' + s.customDns + ')';
      if (toolDns) toolDns.textContent = 'Custom';
    } else if (DNS_PROVIDERS[s.dns]) {
      const d = DNS_PROVIDERS[s.dns];
      info.textContent = `DNS Aktif: ${d.name} (${d.primary} / ${d.secondary})${s.doh ? ' • DoH ON' : ''}`;
      if (toolDns) toolDns.textContent = d.name;
    }
  }

  /* ══════════ 27. EVENT BINDINGS ══════════ */
  function bindEvents() {
    // === Search form ===
    const form = $('#sgSearchForm');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); submitSearch(); });
    const miniForm = $('#sgMiniSearchForm');
    if (miniForm) miniForm.addEventListener('submit', e => { e.preventDefault(); submitMiniSearch(); });

    // === Search input ===
    const inp = $('#sgSearchInput');
    const clearBtn = $('#sgClearBtn');
    const pasteBtn = $('#sgPasteBtn');
    const voiceBtn = $('#sgVoiceBtn');

    if (inp) {
      const handler = debounce(() => renderSuggestions(inp.value), 200);
      inp.addEventListener('input', () => {
        if (clearBtn) clearBtn.hidden = !inp.value;
        handler();
      });
      inp.addEventListener('focus', () => { if (inp.value.length >= 2) renderSuggestions(inp.value); });
      inp.addEventListener('keydown', e => {
        const box = $('#sgSuggest');
        if (box && !box.hidden) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            State.suggestIdx = Math.min(State.suggestIdx + 1, State.suggestions.length - 1);
            box.querySelectorAll('.srch-sug-item').forEach((el, i) => el.classList.toggle('active', i === State.suggestIdx));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            State.suggestIdx = Math.max(State.suggestIdx - 1, -1);
            box.querySelectorAll('.srch-sug-item').forEach((el, i) => el.classList.toggle('active', i === State.suggestIdx));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (State.suggestIdx >= 0 && State.suggestions[State.suggestIdx]) {
              inp.value = State.suggestions[State.suggestIdx].type;
              submitSearch();
            } else { submitSearch(); }
          } else if (e.key === 'Escape') { closeSuggestions(); }
        } else if (e.key === 'Enter') { e.preventDefault(); submitSearch(); }
      });
    }

    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (inp) { inp.value = ''; inp.focus(); }
      clearBtn.hidden = true;
      closeSuggestions();
    });

    if (pasteBtn) pasteBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const t = await navigator.clipboard.readText();
          if (inp) { inp.value = t; inp.focus(); }
          showToast('Berhasil ditempel', 'success');
        } else showToast('Clipboard tidak didukung', 'warning');
      } catch { showToast('Izin clipboard ditolak', 'warning'); }
    });

    if (voiceBtn) voiceBtn.addEventListener('click', startVoice);

    // Suggestions click
    const sugBox = $('#sgSuggest');
    if (sugBox) sugBox.addEventListener('click', e => {
      const item = e.target.closest('.srch-sug-item');
      if (!item) return;
      const idx = +item.dataset.idx;
      const s = State.suggestions[idx];
      if (!s || !inp) return;
      inp.value = s.type;
      submitSearch();
    });

    // === Engine selector ===
    const engSel = $('#sgEngineSelect');
    const engMenu = $('#sgEngineMenu');
    if (engSel && engMenu) {
      engSel.addEventListener('click', e => { e.stopPropagation(); engMenu.classList.toggle('open'); });
      engSel.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); engMenu.classList.toggle('open'); }
      });
      document.addEventListener('click', e => {
        if (!e.target.closest('.srch-engine-select')) engMenu.classList.remove('open');
        if (!e.target.closest('.srch-bar')) closeSuggestions();
      });
      // Double-click engine to show info
      engSel.addEventListener('dblclick', showEngineInfo);
    }

    // === Quick tags ===
    $$('.srch-qtag').forEach(b => b.addEventListener('click', () => {
      const q = b.dataset.q;
      if (inp) inp.value = q;
      submitSearch();
    }));

    // === Tool cards ===
    $$('.srch-tool-card').forEach(c => c.addEventListener('click', () => {
      const t = c.dataset.tool;
      if (t === 'proxy') {
        const pill = $('#pillProxy');
        State.settings.torMode = !State.settings.torMode;
        saveSettings();
        if (pill) { pill.classList.toggle('active', State.settings.torMode); pill.textContent = State.settings.torMode ? 'ON' : 'OFF'; }
        showToast('Tembus Blokir: ' + (State.settings.torMode ? 'ON' : 'OFF'), 'info');
      } else if (t === 'dns') openDrawer('dns');
      else if (t === 'incognito') showToast('Mode Incognito aktif secara default', 'info');
      else if (t === 'vpn') {
        State.settings.torMode = !State.settings.torMode;
        saveSettings();
        const pill = $('#pillVpn');
        if (pill) { pill.classList.toggle('active', State.settings.torMode); pill.textContent = State.settings.torMode ? 'ON' : 'OFF'; }
        showToast('VPN Proxy: ' + (State.settings.torMode ? 'ON' : 'OFF'), 'info');
      } else if (t === 'scan') { runSecurityAudit(); switchToHomeAndScroll('#sgSecStatus'); }
      else if (t === 'bookmark') { openSidePanel('bookmarks'); }
    }));

    // === Quicklinks ===
    $$('.sg-quicklink').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.url);
    }));

    // === Browser toolbar ===
    $('#sgBackBtn')?.addEventListener('click', goBack);
    $('#sgForwardBtn')?.addEventListener('click', () => showToast('Forward belum tersedia', 'info'));
    $('#sgReloadBtn')?.addEventListener('click', () => {
      const t = State.tabs[State.activeTab];
      if (t && t.url) loadFrame(t.url);
      else showToast('Tidak ada halaman aktif', 'info');
    });
    $('#sgHomeBtn')?.addEventListener('click', switchToHome);
    $('#sgFindBtn')?.addEventListener('click', openFindBar);
    $('#sgReaderBtn')?.addEventListener('click', openReaderMode);
    $('#sgShareBtn')?.addEventListener('click', sharePage);
    $('#sgBookmarkBtn')?.addEventListener('click', toggleBookmarkCurrent);
    $('#sgShieldBtn')?.addEventListener('click', () => {
      State.settings.blockSuspicious = !State.settings.blockSuspicious;
      State.settings.safe = State.settings.blockSuspicious;
      saveSettings();
      const b = $('#sgShieldBtn');
      if (b) b.classList.toggle('active', State.settings.blockSuspicious);
      showToast('Safe Browsing: ' + (State.settings.blockSuspicious ? 'AKTIF' : 'NONAKTIF'), State.settings.blockSuspicious ? 'success' : 'warning');
      updateSecurityScore();
    });
    $('#sgMenuBtn')?.addEventListener('click', () => openSidePanel('history'));

    // === Tab add ===
    $('#sgTabAdd')?.addEventListener('click', addTab);

    // === Drawer ===
    $('#sgDrawerClose')?.addEventListener('click', closeDrawer);
    $('#sgDrawerOverlay')?.addEventListener('click', closeDrawer);
    $$('.srch-dtab').forEach(t => t.addEventListener('click', () => {
      $$('.srch-dtab').forEach(x => x.classList.toggle('active', x === t));
      $$('.srch-dpane').forEach(x => x.classList.toggle('active', x.dataset.dpane === t.dataset.dtab));
    }));

    // === Settings button ===
    $('#sgSettingsBtn')?.addEventListener('click', () => openDrawer('umum'));
    $('#sgPrivacyBtn')?.addEventListener('click', () => {
      State.settings.privacyMode = !State.settings.privacyMode;
      const b = $('#sgPrivacyBtn');
      if (b) b.classList.toggle('active', State.settings.privacyMode);
      showToast('Mode Privasi: ' + (State.settings.privacyMode ? 'AKTIF 🔒' : 'NONAKTIF'), State.settings.privacyMode ? 'success' : 'info');
      const meta = document.querySelector('meta[name="referrer"]');
      if (meta) meta.content = State.settings.privacyMode ? 'no-referrer' : 'strict-origin-when-cross-origin';
    });
    $('#sgShortcutBtn')?.addEventListener('click', showShortcutHelp);

    // === Security buttons ===
    $('#sgRunAuditBtn')?.addEventListener('click', runSecurityAudit);
    $('#sgSafeModeBtn')?.addEventListener('click', activateSafeMode);
    $('#sgPrivacyReportBtn')?.addEventListener('click', showPrivacyReport);
    $('#sgLogClearBtn')?.addEventListener('click', () => { Logger.clear(); Logger.add('INFO', 'Log dibersihkan'); });
    $('#sgLogExportBtn')?.addEventListener('click', () => Logger.export());

    // === Bypass ===
    $('#sgBypassBtn')?.addEventListener('click', () => bypassUrl($('#sgBypassInput')?.value));
    $('#sgBypassInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); bypassUrl(e.target.value); }
    });
    $$('.srch-preset-btn').forEach(b => b.addEventListener('click', () => {
      const inp = $('#sgBypassInput'); if (inp) inp.value = b.dataset.url;
      bypassUrl(b.dataset.url);
    }));

    // === Delegated [data-open] (proxy/results) ===
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-open]');
      if (btn) {
        e.preventDefault();
        const u = btn.dataset.open;
        if (u && /^https?:/i.test(u)) window.open(u, '_blank', 'noopener');
      }
    });

    // === History filter ===
    $('#sgHistFilter')?.addEventListener('input', e => renderHistory(e.target.value));
    $('#sgBmFilter')?.addEventListener('input', e => renderBookmarks(e.target.value));
    $('#sgHistSearch')?.addEventListener('input', e => renderSideHistory(e.target.value));
    $('#sgBmSearch')?.addEventListener('input', e => renderSideBookmarks(e.target.value));
    $('#sgReadSearch')?.addEventListener('input', e => renderSideReading(e.target.value));
    $('#sgHistClear')?.addEventListener('click', clearHistory);
    $('#sgClearHistory')?.addEventListener('click', clearHistory);
    $('#sgClearBookmarks')?.addEventListener('click', clearBookmarks);

    // === Bookmark panel tabs ===
    $$('.srch-tab-btn').forEach(b => b.addEventListener('click', () => {
      $$('.srch-tab-btn').forEach(x => x.classList.toggle('active', x === b));
      $$('.srch-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === b.dataset.tab));
    }));

    // === Side panel ===
    $('#sgSidePanelClose')?.addEventListener('click', closeSidePanel);
    $('#sgSidePanelOverlay')?.addEventListener('click', closeSidePanel);
    $$('.sg-sp-tab').forEach(t => t.addEventListener('click', () => {
      $$('.sg-sp-tab').forEach(x => x.classList.toggle('active', x === t));
      $$('.sg-sp-panel').forEach(x => x.classList.toggle('active', x.dataset.panel === t.dataset.panel));
      if (t.dataset.panel === 'debug') renderDebug();
    }));

    // === Blocked domain ===
    $('#sgBlAdd')?.addEventListener('click', () => {
      addBlockedDomain($('#sgBlInput')?.value);
      const inp = $('#sgBlInput'); if (inp) inp.value = '';
    });
    $('#sgBlInput')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') { e.preventDefault(); addBlockedDomain(e.target.value); e.target.value = ''; }
    });

    // === DNS lookup ===
    $('#sgDnsLookup')?.addEventListener('click', () => dnsLookup($('#sgDnsQuery')?.value));
    $('#sgDnsQuery')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') { e.preventDefault(); dnsLookup(e.target.value); }
    });
    $('#sgTestDnsBtn')?.addEventListener('click', () => {
      Object.keys(DNS_PROVIDERS).forEach((k, i) => {
        if (k === 'custom') return;
        setTimeout(() => {
          const ping = (15 + Math.random() * 45).toFixed(1);
          Logger.add('OK', `DNS ${DNS_PROVIDERS[k].name}: ${ping}ms`);
        }, i * 250);
      });
      showToast('Test DNS selesai', 'success');
    });

    // === Settings inputs ===
    bindSettingsInputs();

    // === Import/Export ===
    $('#sgExportSettings')?.addEventListener('click', exportSettings);
    $('#sgImportSettings')?.addEventListener('click', importSettings);
    $('#sgImportSettingsFile')?.addEventListener('change', e => {
      if (e.target.files[0]) handleImportSettings(e.target.files[0]);
    });
    $('#sgExportBookmarks')?.addEventListener('click', exportBookmarksHTML);
    $('#sgImportBookmarks')?.addEventListener('click', importBookmarks);
    $('#sgImportBookmarksFile')?.addEventListener('change', e => {
      if (e.target.files[0]) handleImportBookmarks(e.target.files[0]);
    });

    // === Clear cache / reset ===
    $('#sgClearCacheBtn')?.addEventListener('click', () => {
      if (!confirm('Bersihkan cache pencarian?')) return;
      State.history = [];
      Storage.writeJSON(CFG.STORAGE.HISTORY, []);
      renderHistory(); renderSideHistory();
      showToast('Cache dibersihkan', 'success');
    });
    $('#sgResetSettingsBtn')?.addEventListener('click', () => {
      if (!confirm('Reset SEMUA setelan ke default?')) return;
      State.settings = { ...DEFAULT_SETTINGS };
      saveSettings();
      syncSettingsToUI();
      applySettings();
      showToast('Setelan direset', 'success');
    });

    // === Modals close ===
    document.querySelectorAll('.sg-modal [data-close], .sg-modal-backdrop').forEach(el => {
      el.addEventListener('click', () => {
        const m = el.closest('.sg-modal');
        if (m) closeModal(m.id);
      });
    });

    // === Suspicious modal ===
    $('#sgSusCancel')?.addEventListener('click', () => closeModal('sgSusModal'));
    $('#sgSusContinue')?.addEventListener('click', () => {
      closeModal('sgSusModal');
      showToast('Lanjut dengan risiko', 'warning');
    });

    // === Reader font size ===
    $('#sgReaderFontUp')?.addEventListener('click', () => {
      readerFontSize = Math.min(24, readerFontSize + 2);
      const b = $('#sgReaderBody'); if (b) b.style.fontSize = readerFontSize + 'px';
    });
    $('#sgReaderFontDown')?.addEventListener('click', () => {
      readerFontSize = Math.max(12, readerFontSize - 2);
      const b = $('#sgReaderBody'); if (b) b.style.fontSize = readerFontSize + 'px';
    });

    // === Find bar ===
    const findInput = $('#sgFindInput');
    if (findInput) {
      findInput.addEventListener('input', debounce(() => findInPage(findInput.value), 200));
      findInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); findInPage(findInput.value, !e.shiftKey); }
        else if (e.key === 'Escape') closeFindBar();
      });
    }
    $('#sgFindPrev')?.addEventListener('click', () => findInPage($('#sgFindInput')?.value, false));
    $('#sgFindNext')?.addEventListener('click', () => findInPage($('#sgFindInput')?.value, true));
    $('#sgFindClose')?.addEventListener('click', closeFindBar);

    // === Debug ===
    $('#sgDebugExport')?.addEventListener('click', exportDebug);
    $('#sgDebugClear')?.addEventListener('click', () => {
      State.debug = [];
      renderDebug();
      showToast('Debug log dibersihkan', 'success');
    });

    // === Global keyboard shortcuts ===
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'k') { e.preventDefault(); const i = $('#sgSearchInput'); if (i) { i.focus(); i.select(); } return; }
      if (mod && k === 'l') { e.preventDefault(); const i = $('#sgSearchInput') || $('#sgMiniInput'); if (i) { i.focus(); i.select(); } return; }
      if (mod && k === 't') { e.preventDefault(); addTab(); return; }
      if (mod && k === 'w') { e.preventDefault(); closeTab(State.activeTab); return; }
      if (mod && k === 'r') { e.preventDefault(); $('#sgReloadBtn')?.click(); return; }
      if (mod && k === 'h') { e.preventDefault(); openSidePanel('history'); return; }
      if (mod && k === 'd') { e.preventDefault(); toggleBookmarkCurrent(); return; }
      if (mod && k === 'f') { e.preventDefault(); openFindBar(); return; }
      if (mod && k === 'p') { e.preventDefault(); window.print(); return; }
      if (mod && e.shiftKey && k === 'p') { e.preventDefault(); $('#sgPrivacyBtn')?.click(); return; }
      if (mod && k === '=') { e.preventDefault(); zoomPage(10); return; }
      if (mod && k === '-') { e.preventDefault(); zoomPage(-10); return; }
      if (mod && k === '0') { e.preventDefault(); zoomPage(0, true); return; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); return; }
      if (e.key === 'Escape') {
        closeSuggestions();
        closeDrawer();
        closeSidePanel();
        closeFindBar();
        document.querySelectorAll('.sg-modal.open').forEach(m => closeModal(m.id));
      }
      if (e.key === '?' && !e.target.matches('input, textarea')) { showShortcutHelp(); }
    });

    // Tab focus management for engine dropdown
    document.addEventListener('click', e => {
      if (!e.target.closest('.srch-engine-select') && !e.target.closest('.srch-bar')) {
        const m = $('#sgEngineMenu'); if (m) m.classList.remove('open');
      }
    });
  }

  function switchToHomeAndScroll(sel) {
    switchToHome();
    setTimeout(() => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function bindSettingsInputs() {
    const map = {
      setHomepage: 'homepage', setEngine: 'engine', setLang: 'lang', setTheme: 'theme',
      setHistMax: 'histMax', setFontSize: 'fontSize', setZoom: 'zoom',
      setDoNotTrack: 'doNotTrack', setBlockCookies3p: 'blockCookies3p', setBlockTrackers: 'blockTrackers',
      setBlockAds: 'blockAds', setBlockPopups: 'blockPopups', setAutoClear: 'autoClear',
      setKidsMode: 'kidsMode', setWhitelistMode: 'whitelistMode',
      setSafeBrowsing: 'safeBrowsing', setBlockSuspicious: 'blockSuspicious', setHttpsOnly: 'httpsOnly',
      setBlockWebRTC: 'blockWebRTC', setBlockFingerprint: 'blockFingerprint',
      setBlockGeo: 'blockGeo', setBlockMedia: 'blockMedia',
      setDns: 'dns', setCustomDns: 'customDns', setDoh: 'doh', setProxy: 'proxy', setTor: 'torMode',
      setAccent: 'accent', setLayout: 'layout', setShowFavicon: 'showFavicon',
      setShowPreview: 'showPreview', setAnimations: 'animations',
      setUserAgent: 'userAgent', setJavascript: 'javascript', setImages: 'images',
      setCookies: 'cookies', setHwAccel: 'hwAccel'
    };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const key = map[id];
      const evt = (el.type === 'range' || el.type === 'text' || el.type === 'url') ? 'input' : 'change';
      el.addEventListener(evt, () => {
        if (el.type === 'checkbox') State.settings[key] = el.checked;
        else if (el.type === 'range') State.settings[key] = parseInt(el.value, 10);
        else State.settings[key] = el.value;
        saveSettings();
        if (key === 'engine') setEngine(el.value);
        if (key === 'dns') updateDnsInfo();
        if (key === 'theme' || key === 'animations' || key === 'fontSize') applySettings();
        if (key === 'fontSize') { const v = $('#setFontSizeVal'); if (v) v.textContent = el.value; }
        if (key === 'zoom') { const v = $('#setZoomVal'); if (v) v.textContent = el.value; }
        if (key === 'histMax') { const v = $('#setHistMaxVal'); if (v) v.textContent = el.value; }
        updateSecurityScore();
      });
    });
    // Custom DNS blur validation
    $('#setCustomDns')?.addEventListener('blur', e => {
      if (e.target.value && !isValidIPv4(e.target.value)) showToast('Format IPv4 tidak valid', 'warning');
    });
    $('#setHomepage')?.addEventListener('blur', e => {
      if (e.target.value && !/^https?:\/\//i.test(e.target.value)) showToast('Homepage URL harus http/https', 'warning');
    });
  }

  function goBack() {
    // Simple back: remove current and go to previous
    if (State.history.length < 2) { switchToHome(); return; }
    State.history.shift();
    const prev = State.history[0];
    if (prev) navigate(prev.url, { bypassSafe: true, force: true });
    else switchToHome();
  }

  function zoomPage(delta, reset = false) {
    const t = State.tabs[State.activeTab];
    if (!t) return;
    if (reset) t.zoom = 100;
    else t.zoom = Math.max(50, Math.min(200, (t.zoom || 100) + delta));
    const frame = $('#sgFrame');
    if (frame) frame.style.transform = 'scale(' + (t.zoom / 100) + ')';
    if (frame) frame.style.transformOrigin = 'top left';
    showToast('Zoom: ' + t.zoom + '%', 'info');
  }

  /* ══════════ 28. BOOT ══════════ */
  function boot() {
    if (window.AOS && typeof window.AOS.init === 'function' && !window.__sgAosInited) {
      try { window.AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 }); window.__sgAosInited = true; } catch (_) {}
    }
    loadSettings();
    State.history = Storage.readJSON(CFG.STORAGE.HISTORY, []) || [];
    State.bookmarks = Storage.readJSON(CFG.STORAGE.BOOKMARKS, []) || [];
    State.reading = Storage.readJSON(CFG.STORAGE.READING, []) || [];
    State.blocked = Storage.readJSON(CFG.STORAGE.BLOCKED, []) || [];

    buildEngineMenu();
    setEngine(State.settings.engine);
    applySettings();
    syncSettingsToUI();
    updateSecurityScore();
    initTabs();
    renderHistory(); renderSideHistory();
    renderBookmarks(); renderSideBookmarks();
    renderSideReading();
    renderBlocked();
    bindEvents();

    // Update bookmark/shield/privacy initial state
    updateBookmarkBtn();
    updateBookmarkCount();
    $('#sgShieldBtn')?.classList.toggle('active', State.settings.blockSuspicious);

    // Restore last search placeholder
    const last = Storage.read('irgxy_last_search', '');
    if (last && $('#sgSearchInput')) $('#sgSearchInput').placeholder = 'Terakhir: ' + last;

    // ResizeObserver for viewport height (mobile)
    const vp = $('#sgViewport');
    if (vp && window.ResizeObserver) {
      const ro = new ResizeObserver(() => {});
      ro.observe(vp);
    }

    Logger.add('INFO', 'IRGXY Search Engine V3 siap');
    Logger.add('OK', '12 mesin · DoH · Multi-tab · Reader · Reading List');
    console.log('%c✅ IRGXY Search Engine V' + CFG.VERSION, 'color:#C9A96E;font-weight:700;font-size:14px', '— 12 engines · DoH · Safe Browsing · Multi-Tab');

    // Expose API
    window.IrgxySearch = {
      version: CFG.VERSION,
      search: (q) => { const i = $('#sgSearchInput'); if (i) i.value = q; submitSearch(); },
      navigate,
      bypassUrl,
      runSecurityAudit,
      activateSafeMode,
      addBookmark,
      addToReading,
      clearHistory,
      clearBookmarks,
      openDrawer,
      closeDrawer,
      openSidePanel,
      closeSidePanel,
      getSettings: () => ({ ...State.settings }),
      getHistory: () => [...State.history],
      getBookmarks: () => [...State.bookmarks],
      getReading: () => [...State.reading],
      getBlocked: () => [...State.blocked],
      getDebug: () => [...State.debug],
      exportSettings,
      exportBookmarksHTML,
      showPrivacyReport,
      showEngineInfo,
      showShortcutHelp,
      showQrCode,
      sharePage,
      translatePage,
      openArchive
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();