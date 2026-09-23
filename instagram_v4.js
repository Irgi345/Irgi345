/* ================================================================
   IRGXYMODS — INSTAGRAM DOWNLOADER v4.0 FINAL ULTIMATE
   ================================================================
   Merge: v3.2 engine (quota guard, escHtml, signal, drawCheck,
                       active state, retry counter)
        + v3.1 features (i18n, settings, carousel, zoom, confirm,
                         download all, demo fallback, auto-download,
                         keyboard ←/→ & +/−)
        + NEW v4 (Quick Mode, About, Batch Preview, Queue,
                  Smart Dedupe, Copy All, Clipboard Banner,
                  Original/4K quality, Audio Preview)

   Requires: main.js (window.IRGXY: $, $$, safeFetch, fixUrl,
                       showToast, Activity)
   ================================================================ */
(function () {
  'use strict';

  if (!window.IRGXY) {
    console.error('[IG v4] instagram_v4.js requires main.js!');
    return;
  }
  const { $, $$, safeFetch, fixUrl, showToast, Activity } = window.IRGXY;
  if (!$('#igUrlInput')) return;

  /* ================================================================
     1. CONFIG
     ================================================================ */
  const CONFIG = Object.freeze({
    CACHE_TTL_MS: 5 * 60 * 1000,
    FETCH_TIMEOUT_MS: 15000,
    RETRY_PER_SOURCE: 2,
    BACKOFF_BASE_MS: 800,
    COOLDOWN_MS: 3000,
    HISTORY_MAX: 12,
    FAVORITES_MAX: 30,
    BATCH_MAX: 20,
    BATCH_DELAY_MS: 1000,
    DEDUPE_WINDOW_MS: 24 * 60 * 60 * 1000,
    SCHEMA_VERSION: 4,
    SHORTCODE_RE: /^[A-Za-z0-9_-]{5,}$/,
    STORAGE: {
      HISTORY:   'irgxy_ig_history_v4',
      FAVORITES: 'irgxy_ig_favorites_v4',
      STATS:     'irgxy_ig_stats_v4',
      SETTINGS:  'irgxy_ig_settings_v4',
      DEDUPE:    'irgxy_ig_dedupe_v4',
      THEME:     'ig_theme',
      OLD_KEYS:  ['irgxy_ig_history_v3.1','irgxy_ig_history_v2','irgxy_ig_favorites_v3.1','irgxy_ig_favorites_v1']
    }
  });

  /* ================================================================
     2. UTILS
     ================================================================ */
  const escHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const debounce = (fn, wait = 200) => {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
  };

  const fmtNum = (n) => {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtRelative = (ms) => {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' menit lalu';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    return Math.floor(h / 24) + ' hari lalu';
  };

  const sanitizeUrl = (url) => (url || '').trim().replace(/\s+/g, '').replace(/[<>"'`]/g, '');

  const isValidInstagramUrl = (url) => {
    const s = sanitizeUrl(url);
    return /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv|share|stories)\/[A-Za-z0-9_\-]+\/?/i.test(s)
        || /^https?:\/\/(www\.)?instagr\.am\//i.test(s);
  };

  const extractShortcode = (url) => {
    const m = String(url).match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    return m ? m[1] : '';
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const hashUrl = (url) => {
    let h = 0;
    const s = sanitizeUrl(url);
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return 'h_' + Math.abs(h).toString(36);
  };

  /* ================================================================
     3. CACHE
     ================================================================ */
  class ResultCache {
    constructor(ttl = CONFIG.CACHE_TTL_MS) { this.ttl = ttl; this.map = new Map(); }
    get(k) {
      const it = this.map.get(k);
      if (!it) return null;
      if (Date.now() - it.ts > this.ttl) { this.map.delete(k); return null; }
      return it.value;
    }
    set(k, v) { this.map.set(k, { value: v, ts: Date.now() }); }
    clear() { this.map.clear(); }
  }

  /* ================================================================
     4. UI ANIMATOR
     ================================================================ */
  const UIAnimator = (() => {
    let canvas, ctx, particles = [], confettiPieces = [], rafId = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function ensureCanvas() {
      if (canvas) return;
      canvas = document.getElementById('igFxCanvas') || document.createElement('canvas');
      if (!canvas.id) { canvas.id = 'igFxCanvas'; document.body.appendChild(canvas); }
      canvas.style.display = 'block';
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize, { passive: true });
    }
    function resize() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 1;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      confettiPieces = confettiPieces.filter(c => c.y < innerHeight + 40 && c.life > 0);
      confettiPieces.forEach(c => {
        c.x += c.vx; c.y += c.vy; c.vy += 0.12; c.rot += c.vr; c.life -= 0.5;
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.globalAlpha = Math.min(1, c.life / 60);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
      });
      if (particles.length || confettiPieces.length) rafId = requestAnimationFrame(tick);
      else { rafId = null; if (canvas) canvas.style.display = 'none'; }
    }
    function run() {
      if (!rafId) { ensureCanvas(); canvas.style.display = 'block'; rafId = requestAnimationFrame(tick); }
    }

    return {
      particleBurst(x, y, count = 24) {
        if (reduceMotion) return;
        const colors = ['#833AB4','#E4405F','#F77737','#FFC107','#F0D78C'];
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
          const sp = 3 + Math.random() * 4;
          particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, r: 2 + Math.random() * 3, life: 50 + Math.random() * 25, maxLife: 75, color: colors[i % colors.length] });
        }
        run();
      },
      confetti(count = 50) {
        if (reduceMotion) return;
        const colors = ['#D4AF37','#F0D78C','#E4405F','#833AB4','#FFC107'];
        for (let i = 0; i < count; i++) {
          confettiPieces.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 100, vx: (Math.random() - 0.5) * 2.4, vy: 2 + Math.random() * 3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25, life: 200, color: colors[i % colors.length] });
        }
        run();
      },
      ripple(el, ev) {
        if (!el || reduceMotion) return;
        const r = el.getBoundingClientRect();
        const size = Math.max(r.width, r.height);
        const x = (ev?.clientX || r.left + r.width / 2) - r.left - size / 2;
        const y = (ev?.clientY || r.top + r.height / 2) - r.top - size / 2;
        const span = document.createElement('span');
        span.className = 'ig-ripple';
        span.style.width = span.style.height = size + 'px';
        span.style.left = x + 'px'; span.style.top = y + 'px';
        el.appendChild(span);
        setTimeout(() => span.remove(), 650);
      },
      drawCheck() {
        const el = document.getElementById('igSuccessCheck');
        if (!el || reduceMotion) return;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 1400);
      },
      destroy() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null; particles = []; confettiPieces = [];
      }
    };
  })();

  /* ================================================================
     5. STORAGE (with quota guard)
     ================================================================ */
  const _memFallback = new Map();
  const _quotaNotified = { flag: false };

  const Storage = {
    read(key, fallback, validator) {
      if (_memFallback.has(key)) {
        const v = _memFallback.get(key);
        return (validator && !validator(v)) ? fallback : v;
      }
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (validator && !validator(parsed)) return fallback;
        return parsed;
      } catch { return fallback; }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        _memFallback.delete(key);
        return true;
      } catch (e) {
        _memFallback.set(key, value);
        if (!_quotaNotified.flag) {
          _quotaNotified.flag = true;
          try { showToast('Penyimpanan browser penuh — data disimpan sementara di memori', 'warning', 5000); } catch {}
          setTimeout(() => { _quotaNotified.flag = false; }, 60000);
        }
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch {}
      _memFallback.delete(key);
    }
  };

  /* --- Schema migration v3.1/v2 → v4 --- */
  (function migrate() {
    try {
      CONFIG.STORAGE.OLD_KEYS.forEach(k => {
        const old = localStorage.getItem(k);
        if (!old) return;
        if (!localStorage.getItem(CONFIG.STORAGE.HISTORY) && k.includes('history')) {
          try {
            const o = JSON.parse(old);
            const items = Array.isArray(o.items) ? o.items : (Array.isArray(o) ? o : []);
            localStorage.setItem(CONFIG.STORAGE.HISTORY, JSON.stringify({ v: CONFIG.SCHEMA_VERSION, items }));
          } catch {}
        }
        if (!localStorage.getItem(CONFIG.STORAGE.FAVORITES) && k.includes('favorites')) {
          try {
            const o = JSON.parse(old);
            const items = Array.isArray(o.items) ? o.items : (Array.isArray(o) ? o : []);
            localStorage.setItem(CONFIG.STORAGE.FAVORITES, JSON.stringify({ items }));
          } catch {}
        }
      });
    } catch {}
  })();

  const HistoryStore = (() => {
    const KEY = CONFIG.STORAGE.HISTORY;
    const valid = (v) => v && typeof v === 'object' && v.v === CONFIG.SCHEMA_VERSION && Array.isArray(v.items);
    let cache = Storage.read(KEY, { v: CONFIG.SCHEMA_VERSION, items: [] }, valid);
    if (!valid(cache)) cache = { v: CONFIG.SCHEMA_VERSION, items: [] };
    const persist = () => Storage.write(KEY, cache);
    return {
      all: () => cache.items.slice(),
      add(item) {
        cache.items = cache.items.filter(x => x.url !== item.url);
        cache.items.unshift(item);
        const max = getSettings().histMax;
        if (cache.items.length > max) cache.items.length = max;
        persist();
      },
      clear() { cache.items = []; persist(); }
    };
  })();

  const FavoriteStore = (() => {
    const KEY = CONFIG.STORAGE.FAVORITES;
    const valid = (v) => v && typeof v === 'object' && Array.isArray(v.items);
    let cache = Storage.read(KEY, { items: [] }, valid);
    if (!valid(cache)) cache = { items: [] };
    const persist = () => Storage.write(KEY, cache);
    return {
      all: () => cache.items.slice(),
      has(url) { return cache.items.some(x => x.url === url); },
      toggle(item) {
        const i = cache.items.findIndex(x => x.url === item.url);
        if (i >= 0) { cache.items.splice(i, 1); persist(); return false; }
        cache.items.unshift(item);
        if (cache.items.length > CONFIG.FAVORITES_MAX) cache.items.length = CONFIG.FAVORITES_MAX;
        persist(); return true;
      },
      clear() { cache.items = []; persist(); }
    };
  })();

  const StatsStore = (() => {
    const KEY = CONFIG.STORAGE.STATS;
    const today = () => new Date().toISOString().slice(0, 10);
    const valid = (v) => v && typeof v === 'object' && typeof v.days === 'object';
    let cache = Storage.read(KEY, { days: {} }, valid);
    if (!valid(cache)) cache = { days: {} };
    return {
      inc() {
        const d = today();
        cache.days[d] = (cache.days[d] || 0) + 1;
        const keys = Object.keys(cache.days).sort();
        if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(k => delete cache.days[k]);
        Storage.write(KEY, cache);
      },
      summary() {
        const d = today();
        const days = cache.days;
        const todayN = days[d] || 0;
        let week = 0, month = 0;
        const now = Date.now();
        Object.keys(days).forEach(k => {
          const diff = (now - new Date(k).getTime()) / 86400000;
          if (diff < 7) week += days[k];
          if (diff < 30) month += days[k];
        });
        const spark = [];
        for (let i = 13; i >= 0; i--) {
          const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          spark.push(days[day] || 0);
        }
        return { todayN, week, month, spark };
      }
    };
  })();

  /* --- Smart Dedupe 24h --- */
  const DedupeStore = (() => {
    const KEY = CONFIG.STORAGE.DEDUPE;
    const valid = (v) => v && typeof v === 'object' && typeof v.hashes === 'object';
    let cache = Storage.read(KEY, { hashes: {} }, valid);
    if (!valid(cache)) cache = { hashes: {} };

    function prune() {
      const now = Date.now();
      Object.keys(cache.hashes).forEach(k => {
        if (now - cache.hashes[k] > CONFIG.DEDUPE_WINDOW_MS) delete cache.hashes[k];
      });
    }

    return {
      check(url) {
        if (!getSettings().dedupe) return null;
        prune();
        const h = hashUrl(url);
        const ts = cache.hashes[h];
        return ts ? { hash: h, ts, relative: fmtRelative(ts) } : null;
      },
      mark(url) {
        if (!getSettings().dedupe) return;
        const h = hashUrl(url);
        cache.hashes[h] = Date.now();
        prune();
        Storage.write(KEY, cache);
      },
      clear() { cache.hashes = {}; Storage.write(KEY, cache); }
    };
  })();

  /* ================================================================
     6. SETTINGS
     ================================================================ */
  const DEFAULT_SETTINGS = Object.freeze({
    theme: 'dark',
    lang: 'id',
    quality: '1080p',
    autoDownload: false,
    histMax: CONFIG.HISTORY_MAX,
    quickMode: false,
    dedupe: true
  });
  function getSettings() {
    const s = Storage.read(CONFIG.STORAGE.SETTINGS, null, v => v && typeof v === 'object');
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
  }
  function saveSettings(patch) {
    const s = { ...getSettings(), ...patch };
    Storage.write(CONFIG.STORAGE.SETTINGS, s);
    return s;
  }

  /* ================================================================
     7. i18n
     ================================================================ */
  const I18N = {
    id: {
      'hero.title': 'Instagram Video / Reels / Foto / MP3 Downloader',
      'hero.sub': 'Download Reels, Video, Foto carousel, IGTV, Story & MP3 hingga 1080p/4K — cepat, akurat, tanpa watermark.',
      'pill.fast': 'Cepat', 'pill.safe': 'Aman', 'pill.hd': 'Hingga 4K',
      'pill.mp3': 'Audio MP3', 'pill.multi': 'Multi-Foto',
      'stats.today': 'Hari ini', 'stats.week': '7 hari', 'stats.month': '30 hari',
      'clip.detected': 'Link Instagram terdeteksi di clipboard!', 'clip.use': 'Gunakan',
      'input.title': 'Tempel link Instagram', 'input.batch': 'Batch', 'input.quick': 'Quick',
      'input.download': 'Download', 'input.downloadBatch': 'Download Batch',
      'input.processing': 'Memproses...', 'input.cooldown': 'Rate limit — tunggu', 'input.seconds': 'detik',
      'result.more': 'Selengkapnya', 'result.less': 'Sembunyikan',
      'result.likes': 'likes', 'result.comments': 'komentar', 'result.media': 'media',
      'result.video': 'Pilih Kualitas Video', 'result.photos': 'Download Foto',
      'result.audio': 'Download Audio MP3', 'result.downloadAll': 'Download Semua',
      'result.copyAll': 'Copy All',
      'action.favorite': 'Favorit', 'action.copy': 'Copy Link', 'action.share': 'Share',
      'action.thumb': 'Thumbnail', 'action.report': 'Laporkan',
      'tabs.history': 'Riwayat', 'tabs.favorites': 'Favorit',
      'tabs.export': 'Export', 'tabs.clear': 'Hapus',
      'howto.title': 'Cara Menggunakan',
      'howto.s1': 'Buka Instagram, salin link Reels / Post / IGTV.',
      'howto.s2': 'Tempel di input (atau tekan Ctrl+V).',
      'howto.s3': 'Klik Download / tekan Enter.',
      'howto.s4': 'Pilih kualitas video, foto, atau MP3.',
      'set.theme': 'Tema', 'set.lang': 'Bahasa', 'set.quality': 'Kualitas Default',
      'set.autoDl': 'Auto-download setelah parse', 'set.histMax': 'Maks riwayat',
      'set.quickMode': 'Quick Mode', 'set.dedupe': 'Smart Dedupe (24 jam)',
      'set.save': 'Simpan', 'set.reset': 'Reset Data',
      'msg.invalid': 'Link tidak valid.', 'msg.empty': 'Tempel link Instagram terlebih dahulu.',
      'msg.success': 'Data berhasil diambil!', 'msg.fail': 'Gagal mengambil data.',
      'msg.copied': 'Link disalin!', 'msg.confirmDelete': 'Yakin?'
    },
    en: {
      'hero.title': 'Instagram Video / Reels / Photo / MP3 Downloader',
      'hero.sub': 'Download Reels, Video, Photo carousel, IGTV, Story & MP3 up to 1080p/4K — fast, accurate, no watermark.',
      'pill.fast': 'Fast', 'pill.safe': 'Safe', 'pill.hd': 'Up to 4K',
      'pill.mp3': 'MP3 Audio', 'pill.multi': 'Multi-Photo',
      'stats.today': 'Today', 'stats.week': '7 days', 'stats.month': '30 days',
      'clip.detected': 'Instagram link detected in clipboard!', 'clip.use': 'Use it',
      'input.title': 'Paste Instagram link', 'input.batch': 'Batch', 'input.quick': 'Quick',
      'input.download': 'Download', 'input.downloadBatch': 'Download Batch',
      'input.processing': 'Processing...', 'input.cooldown': 'Rate limit — wait', 'input.seconds': 's',
      'result.more': 'Show more', 'result.less': 'Hide',
      'result.likes': 'likes', 'result.comments': 'comments', 'result.media': 'media',
      'result.video': 'Choose Video Quality', 'result.photos': 'Download Photos',
      'result.audio': 'Download MP3 Audio', 'result.downloadAll': 'Download All',
      'result.copyAll': 'Copy All',
      'action.favorite': 'Favorite', 'action.copy': 'Copy Link', 'action.share': 'Share',
      'action.thumb': 'Thumbnail', 'action.report': 'Report',
      'tabs.history': 'History', 'tabs.favorites': 'Favorites',
      'tabs.export': 'Export', 'tabs.clear': 'Clear',
      'howto.title': 'How to Use',
      'howto.s1': 'Open Instagram, copy Reels / Post / IGTV link.',
      'howto.s2': 'Paste to input (or press Ctrl+V).',
      'howto.s3': 'Click Download / press Enter.',
      'howto.s4': 'Choose video quality, photos, or MP3.',
      'set.theme': 'Theme', 'set.lang': 'Language', 'set.quality': 'Default Quality',
      'set.autoDl': 'Auto-download after parse', 'set.histMax': 'Max history',
      'set.quickMode': 'Quick Mode', 'set.dedupe': 'Smart Dedupe (24h)',
      'set.save': 'Save', 'set.reset': 'Reset Data',
      'msg.invalid': 'Invalid link.', 'msg.empty': 'Paste an Instagram link first.',
      'msg.success': 'Data fetched!', 'msg.fail': 'Failed to fetch data.',
      'msg.copied': 'Link copied!', 'msg.confirmDelete': 'Are you sure?'
    }
  };
  const t = (key) => {
    const lang = getSettings().lang || 'id';
    return (I18N[lang] && I18N[lang][key]) || (I18N.id[key] || key);
  };
  function applyLang() {
    document.documentElement.lang = getSettings().lang || 'id';
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val) el.textContent = val;
    });
    if (D.btnText) D.btnText.textContent = batchMode ? t('input.downloadBatch') : t('input.download');
  }

  /* ================================================================
     8. API SOURCES (7)
     ================================================================ */
  const IG_SOURCES = [
    {
      name: 'SnapInsta',
      async fetch(url, signal) {
        const fd = new URLSearchParams({ url });
        const r = await safeFetch('https://snapinsta.app/action.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: fd.toString(), signal
        }, CONFIG.FETCH_TIMEOUT_MS);
        const text = await r.text();
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Bad response');
        return JSON.parse(m[0]);
      },
      map(j) {
        const items = Array.isArray(j?.data) ? j.data : [];
        if (!items.length) throw new Error('no media');
        const images = []; let video = null;
        items.forEach(it => {
          if (it.type === 'image' || it.type === 'photo') images.push(fixUrl(it.url || it.download_url, ''));
          if (it.type === 'video') video = it;
        });
        const q = {};
        if (video) { q['360p'] = video.url || video.sd; q['720p'] = video.url; q['1080p'] = video.hd || video.url; if (video.original) q['original'] = video.original; }
        return {
          author: items[0].author || 'Instagram User', username: items[0].username || 'user',
          caption: items[0].caption || '', thumb: items[0].thumbnail || video?.thumbnail || images[0] || '',
          duration: video?.duration || 0, likes: items[0].likes || 0, comments: items[0].comments || 0,
          timestamp: items[0].timestamp || 0,
          type: video ? 'reels' : (images.length > 1 ? 'carousel' : 'post'),
          qualities: q, images,
          audio: video ? { '128': video.url, '320': video.hd || video.url } : {},
          video: video?.url || ''
        };
      }
    },
    {
      name: 'InstaSave',
      async fetch(url, signal) {
        const r = await safeFetch(`https://api.instasave.website/media?url=${encodeURIComponent(url)}`, { signal }, CONFIG.FETCH_TIMEOUT_MS);
        return r.json();
      },
      map(j) {
        const items = j?.data || j?.medias || j?.url || [];
        const list = Array.isArray(items) ? items : (items ? [items] : []);
        if (!list.length) throw new Error('empty');
        const images = []; let video = null;
        list.forEach(it => {
          const u = typeof it === 'string' ? it : (it.url || it.src);
          if (!u) return;
          const isV = typeof it === 'object' && (it.type === 'video' || /\.mp4/i.test(u));
          if (isV) video = { url: u, thumbnail: it.thumbnail, duration: it.duration, hd: it.hd || u, sd: it.sd || u };
          else images.push(u);
        });
        const q = {};
        if (video) { q['360p'] = video.sd || video.url; q['720p'] = video.url; q['1080p'] = video.hd || video.url; }
        return {
          author: j.author || 'Instagram User', username: j.username || 'user',
          caption: j.caption || j.title || '', thumb: j.thumbnail || video?.thumbnail || images[0] || '',
          duration: video?.duration || 0, likes: j.likes || 0, comments: j.comments || 0, timestamp: j.timestamp || 0,
          type: video ? 'reels' : (images.length > 1 ? 'carousel' : 'post'),
          qualities: q, images,
          audio: video ? { '128': video.url, '320': video.hd || video.url } : {},
          video: video?.url || ''
        };
      }
    },
    {
      name: 'Igram',
      async fetch(url, signal) {
        const r = await safeFetch(`https://api.igram.world/api/convert?url=${encodeURIComponent(url)}`, { signal }, CONFIG.FETCH_TIMEOUT_MS);
        return r.json();
      },
      map(j) {
        const items = j?.data || j?.result || j?.medias || [];
        if (!Array.isArray(items) || !items.length) throw new Error('empty');
        const images = []; let video = null;
        items.forEach(it => {
          if (it.type === 'image' || it.type === 'photo') images.push(fixUrl(it.url || it.src, ''));
          if (it.type === 'video') video = it;
        });
        const q = {};
        if (video) { q['360p'] = video.sd || video.url; q['720p'] = video.url; q['1080p'] = video.hd || video.url; }
        return {
          author: items[0].author || 'Instagram User', username: items[0].username || 'user',
          caption: items[0].caption || '',
          thumb: items[0].thumbnail || video?.thumbnail || images[0] || '',
          duration: video?.duration || 0, likes: items[0].likes || 0, comments: items[0].comments || 0, timestamp: items[0].timestamp || 0,
          type: video ? 'reels' : (images.length > 1 ? 'carousel' : 'post'),
          qualities: q, images,
          audio: video ? { '128': video.url, '320': video.hd || video.url } : {},
          video: video?.url || ''
        };
      }
    },
    {
      name: 'SaveInsta',
      async fetch(url, signal) {
        const fd = new URLSearchParams({ url });
        const r = await safeFetch('https://saveinsta.app/api/ajaxSearch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: fd.toString(), signal
        }, CONFIG.FETCH_TIMEOUT_MS);
        return r.json();
      },
      map(j) {
        const html = j?.data || '';
        if (!html) throw new Error('empty');
        const vids = [...String(html).matchAll(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
        const imgs = [...String(html).matchAll(/href="(https?:\/\/[^"]+\.(?:jpg|jpeg|webp)[^"]*)"/gi)].map(m => m[1]);
        const thumbs = [...String(html).matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map(m => m[1]);
        const allImgs = imgs.filter(u => !thumbs.includes(u));
        const q = {};
        if (vids[0]) q['720p'] = vids[0];
        if (vids[1]) q['1080p'] = vids[1];
        if (vids[0] && !q['360p']) q['360p'] = vids[0];
        return {
          author: 'Instagram User', username: 'user', caption: '',
          thumb: thumbs[0] || allImgs[0] || '',
          duration: 0, likes: 0, comments: 0, timestamp: 0,
          type: vids.length ? 'reels' : (allImgs.length > 1 ? 'carousel' : 'post'),
          qualities: q, images: allImgs,
          audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
          video: vids[0] || ''
        };
      }
    },
    {
      name: 'SnapSaveIG',
      async fetch(url, signal) {
        const fd = new URLSearchParams({ url, action: 'get' });
        const r = await safeFetch('https://snapsave.app/action.php?lang=id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: fd.toString(), signal
        }, CONFIG.FETCH_TIMEOUT_MS);
        return { html: await r.text() };
      },
      map(j) {
        const html = String(j.html || '');
        const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
        const imgs = [...html.matchAll(/href="(https?:[^"]+\.(?:jpg|jpeg|webp)[^"]*)"/gi)].map(m => m[1]);
        const thumbs = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map(m => m[1]);
        const allImgs = imgs.filter(u => !thumbs.includes(u));
        if (!vids.length && !allImgs.length) throw new Error('no media');
        const q = {};
        if (vids[0]) q['1080p'] = vids[0];
        if (vids[1]) q['720p'] = vids[1];
        if (vids[2]) q['360p'] = vids[2];
        if (!q['720p'] && vids[0]) q['720p'] = vids[0];
        if (!q['360p'] && (vids[1] || vids[0])) q['360p'] = vids[1] || vids[0];
        return {
          author: 'Instagram User', username: 'user', caption: '',
          thumb: thumbs[0] || allImgs[0] || '',
          duration: 0, likes: 0, comments: 0, timestamp: 0,
          type: vids.length ? 'reels' : (allImgs.length > 1 ? 'carousel' : 'post'),
          qualities: q, images: allImgs,
          audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
          video: vids[0] || ''
        };
      }
    },
    {
      name: 'SaveFromIG',
      async fetch(url, signal) {
        const fd = new URLSearchParams({ url });
        const r = await safeFetch('https://savefrom.net/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: fd.toString(), signal
        }, CONFIG.FETCH_TIMEOUT_MS);
        return r.json();
      },
      map(j) {
        const list = j?.data || j?.medias || j?.url || j?.links || [];
        const arr = Array.isArray(list) ? list : (list ? [list] : []);
        if (!arr.length) throw new Error('empty');
        const q = {}; const images = []; let videoUrl = ''; let thumb = '';
        arr.forEach((it, i) => {
          const u = typeof it === 'string' ? it : (it.url || it.src || it.link);
          const label = (typeof it === 'object' && (it.quality || it.label)) || '';
          if (!u) return;
          if (/\.mp4/i.test(u) || (typeof it === 'object' && it.type === 'video')) {
            if (!videoUrl) videoUrl = u;
            if (/original|4k/i.test(label)) q['original'] = u;
            else if (/1080/i.test(label)) q['1080p'] = u;
            else if (/720/i.test(label)) q['720p'] = u;
            else if (/360/i.test(label)) q['360p'] = u;
            else if (i === 0) q['1080p'] = u;
            else if (i === 1) q['720p'] = u;
            else if (i === 2) q['360p'] = u;
          } else if (/\.(jpg|jpeg|webp|png)/i.test(u)) images.push(u);
          if (typeof it === 'object' && it.thumbnail) thumb = it.thumbnail;
        });
        if (!videoUrl && !images.length) throw new Error('no media');
        if (videoUrl && !q['360p']) q['360p'] = videoUrl;
        if (videoUrl && !q['720p']) q['720p'] = videoUrl;
        if (videoUrl && !q['1080p']) q['1080p'] = videoUrl;
        return {
          author: j.author || 'Instagram User', username: j.username || 'user',
          caption: j.caption || j.title || '',
          thumb: thumb || j.thumbnail || images[0] || '',
          duration: 0, likes: 0, comments: 0, timestamp: 0,
          type: videoUrl ? 'reels' : (images.length > 1 ? 'carousel' : 'post'),
          qualities: q, images,
          audio: videoUrl ? { '128': videoUrl, '320': videoUrl } : {},
          video: videoUrl
        };
      }
    },
    {
      name: 'OEmbed',
      async fetch(url, signal) {
        const r = await safeFetch(`https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}`, { signal }, 12000);
        return r.json();
      },
      map(j) {
        if (!j || !j.thumbnail_url) throw new Error('oembed empty');
        return {
          author: j.author_name || 'Instagram User',
          username: (j.author_url || '').split('/').filter(Boolean).pop() || 'user',
          caption: j.title || '', thumb: j.thumbnail_url || '',
          duration: 0, likes: 0, comments: 0, timestamp: 0,
          type: 'post', qualities: {}, images: [j.thumbnail_url], audio: {}, video: ''
        };
      }
    }
  ];

  /* ================================================================
     9. DEMO FALLBACK
     ================================================================ */
  function buildDemoData(url) {
    return {
      author: 'Demo User',
      username: 'demo',
      caption: 'Data demo — server sumber tidak merespons. Coba lagi nanti atau gunakan link lain.',
      thumb: 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#833AB4"/><stop offset="50%" stop-color="#E4405F"/><stop offset="100%" stop-color="#F77737"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="205" text-anchor="middle" font-size="42" fill="#fff" font-family="serif" font-weight="700">DEMO</text></svg>`
      ),
      duration: 0, likes: 0, comments: 0, timestamp: Date.now(),
      type: 'post', qualities: {}, images: [], audio: {}, video: '',
      _source: 'Demo', _isDemo: true, _fromUrl: url
    };
  }

  /* ================================================================
     10. DOWNLOADER ENGINE
     ================================================================ */
  function withTimeout(p, ms, tag) {
    return Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${tag} timeout`)), ms))
    ]);
  }

  function anchorDownload(href, filename, external) {
    const a = document.createElement('a');
    a.href = href;
    if (filename) a.download = filename;
    if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  class DownloaderEngine {
    constructor(cache) { this.cache = cache; this.abort = null; this.objUrls = new Set(); }
    cancel() { if (this.abort) { try { this.abort.abort(); } catch {} this.abort = null; } }

    async parse(url, onProgress) {
      const cached = this.cache.get(url);
      if (cached) { onProgress && onProgress('cache', 'Data dari cache'); return cached; }

      this.cancel();
      this.abort = new AbortController();
      const signal = this.abort.signal;
      let lastErr = null;

      for (const src of IG_SOURCES) {
        for (let a = 0; a <= CONFIG.RETRY_PER_SOURCE; a++) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          try {
            const retryTag = a > 0 ? ` (retry ${a}/${CONFIG.RETRY_PER_SOURCE})` : '';
            onProgress && onProgress('source', `Memproses dengan ${src.name}${retryTag}…`);
            const raw = await withTimeout(src.fetch(url, signal), CONFIG.FETCH_TIMEOUT_MS, src.name);
            const data = src.map(raw);
            const has = Object.keys(data.qualities || {}).length > 0
                     || (data.images && data.images.length > 0) || data.video;
            if (!has) throw new Error(`${src.name}: no media`);
            data._source = src.name;
            data._fromUrl = url;
            data._fetchedAt = Date.now();
            this.cache.set(url, data);
            return data;
          } catch (e) {
            if (e && e.name === 'AbortError') throw e;
            lastErr = e;
            console.warn(`[IG v4][${src.name}][FAIL]`, e.message);
            if (a < CONFIG.RETRY_PER_SOURCE) await sleep(CONFIG.BACKOFF_BASE_MS * Math.pow(2, a));
          }
        }
      }
      console.warn('[IG v4] Semua sumber gagal → mode DEMO');
      const demo = buildDemoData(url);
      this.cache.set(url, demo);
      return demo;
    }

    async download(url, filename, onProgress) {
      if (!url) throw new Error('URL kosong');
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const total = Number(res.headers.get('content-length')) || 0;
        const reader = res.body && res.body.getReader ? res.body.getReader() : null;
        if (reader && onProgress) {
          const chunks = []; let recv = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            recv += value.length;
            if (total) onProgress(recv / total, recv, total);
          }
          const blob = new Blob(chunks);
          const objUrl = URL.createObjectURL(blob);
          this.objUrls.add(objUrl);
          anchorDownload(objUrl, filename);
          setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch {} this.objUrls.delete(objUrl); }, 60000);
          return { ok: true, via: 'blob' };
        }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        this.objUrls.add(objUrl);
        anchorDownload(objUrl, filename);
        setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch {} this.objUrls.delete(objUrl); }, 60000);
        return { ok: true, via: 'blob-nostream' };
      } catch (e) { console.warn('[IG v4][DL] blob fail:', e.message); }
      try { anchorDownload(url, filename, true); return { ok: true, via: 'anchor' }; } catch {}
      try { const w = window.open(url, '_blank', 'noopener,noreferrer'); return { ok: !!w, via: 'window.open' }; }
      catch { return { ok: false, via: 'failed' }; }
    }

    destroy() {
      this.cancel();
      this.objUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
      this.objUrls.clear();
    }
  }

  /* ================================================================
     11. DOWNLOAD QUEUE MANAGER (BARU v4)
     ================================================================ */
  const DownloadQueue = (() => {
    const items = [];
    let running = false;

    function renderQueue() {
      const list = document.getElementById('igQueueList');
      if (!list) return;
      if (!items.length) {
        list.innerHTML = '<div class="ig-history-empty">Belum ada download dalam queue</div>';
        return;
      }
      list.innerHTML = items.map((it, i) => `
        <div class="ig-queue-item">
          <i class="fas fa-file-download qi-icon"></i>
          <span class="qi-name">${escHtml(it.name)}</span>
          <span class="qi-status ${it.status}">${it.status === 'pending' ? 'Menunggu' : it.status === 'running' ? 'Mengunduh' : it.status === 'done' ? 'Selesai' : 'Gagal'}</span>
        </div>
      `).join('');
    }

    async function processNext() {
      if (running) return;
      const pending = items.find(x => x.status === 'pending');
      if (!pending) return;
      running = true;
      pending.status = 'running';
      renderQueue();
      try {
        const r = await engine.download(pending.url, pending.name, pending.onProgress);
        pending.status = r.ok ? 'done' : 'failed';
        Activity.add('download', 'Queue: ' + pending.name);
      } catch {
        pending.status = 'failed';
      }
      renderQueue();
      running = false;
      if (items.some(x => x.status === 'pending')) {
        setTimeout(processNext, 400);
      }
    }

    return {
      add(url, name, onProgress) {
        if (!url) return;
        items.push({ url, name, onProgress, status: 'pending' });
        renderQueue();
        processNext();
      },
      render: renderQueue,
      clearDone() {
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].status === 'done' || items[i].status === 'failed') items.splice(i, 1);
        }
        renderQueue();
      },
      count() { return items.filter(x => x.status === 'pending' || x.status === 'running').length; }
    };
  })();

  /* ================================================================
     12. DOM REFS
     ================================================================ */
  const D = {
    input: $('#igUrlInput'), batchInput: $('#igBatchInput'), batchToggle: $('#igBatchToggle'),
    batchRow: $('#igBatchRow'), batchCount: $('#igBatchCount'), singleRow: $('#igSingleRow'),
    parseBtn: $('#igParseBtn'), btnText: $('#igParseBtnText'), pasteBtn: $('#igPasteBtn'),
    clearBtn: $('#igClearBtn'), cooldown: $('#igCooldown'), cooldownNum: $('#igCooldownNum'),
    progressLine: $('#igProgressLine'), progressFill: $('#igProgressFill'),
    statusEl: $('#igStatus'), statusIcon: $('#igStatusIcon'), statusText: $('#igStatusText'),
    resultCard: $('#igResultCard'), skeleton: $('#igSkeleton'), resultBody: $('#igResultBody'),
    descToggle: $('#igDescToggle'), qualityGrid: $('#igQualityGrid'), audioGrid: $('#igAudioGrid'),
    photosGrid: $('#igPhotosGrid'), photosSec: $('#igPhotosSection'),
    downloadAllBtn: $('#igDownloadAllBtn'), copyAllBtn: $('#igCopyAllBtn'),
    tabsWrap: $('#igTabsWrap'),
    historyList: $('#igHistoryList'), favoritesList: $('#igFavoritesList'),
    clearHistory: $('#igClearHistory'), exportBtn: $('#igExportBtn'), favoriteBtn: $('#igFavoriteBtn'),
    heroIcon: $('#igHeroIcon'), thumbWrap: $('#igThumbWrap'), videoModal: $('#igVideoModal'),
    previewVideo: $('#igPreviewVideo'), previewSpeed: $('#igPreviewSpeed'),
    previewPip: $('#igPreviewPip'), previewFs: $('#igPreviewFullscreen'),
    carouselModal: $('#igCarouselModal'), carouselImg: $('#igCarouselImg'),
    carouselWrap: $('#igCarouselImgWrap'), carouselStage: $('#igCarouselStage'),
    carouselDots: $('#igCarouselDots'), carouselCounter: $('#igCarouselCounter'),
    carouselPrev: $('#igCarouselPrev'), carouselNext: $('#igCarouselNext'),
    carouselZoom: $('#igCarouselZoom'), carouselCopy: $('#igCarouselCopy'),
    carouselDownload: $('#igCarouselDownload'),
    zoomModal: $('#igZoomModal'), zoomImg: $('#igZoomImg'), zoomStage: $('#igZoomStage'),
    zoomIn: $('#igZoomIn'), zoomOut: $('#igZoomOut'), zoomReset: $('#igZoomReset'),
    shortcutModal: $('#igShortcutModal'), settingsModal: $('#igSettingsModal'),
    reportModal: $('#igReportModal'), reportBody: $('#igReportBody'),
    reportCopy: $('#igReportCopy'), reportGithub: $('#igReportGithub'),
    confirmModal: $('#igConfirmModal'), confirmTitle: $('#igConfirmTitle'),
    confirmMsg: $('#igConfirmMsg'), confirmOk: $('#igConfirmOk'),
    aboutModal: $('#igAboutModal'),
    batchPreviewModal: $('#igBatchPreviewModal'), batchGrid: $('#igBatchGrid'),
    batchDownloadAll: $('#igBatchDownloadAll'), batchExport: $('#igBatchExport'),
    queueModal: $('#igQueueModal'), queueList: $('#igQueueList'), queueClear: $('#igQueueClear'),
    themeToggle: $('#igThemeToggle'), shortcutToggle: $('#igShortcutToggle'),
    settingsToggle: $('#igSettingsToggle'),
    statToday: $('#igStatToday'), statWeek: $('#igStatWeek'),
    statMonth: $('#igStatMonth'), statSpark: $('#igStatSpark'),
    demoBadge: $('#igDemoBadge'),
    clipboardBanner: $('#igClipboardBanner'), clipboardAccept: $('#igClipboardAccept'),
    clipboardDismiss: $('#igClipboardDismiss'),
    quickModeToggle: $('#igQuickModeToggle')
  };

  /* ================================================================
     13. STATE
     ================================================================ */
  const engine = new DownloaderEngine(new ResultCache());
  let currentData = null;
  let currentUrl = '';
  let isLoading = false;
  let lastParseAt = 0;
  let cooldownTimer = null;
  let batchMode = false;
  let carouselIndex = 0;
  let carouselImages = [];
  let zoomScale = 1;
  let confirmHandler = null;
  let clipboardUrl = '';
  let batchResults = [];

  /* ================================================================
     14. STATUS / LOADING
     ================================================================ */
  function setStatus(type, iconHtml, text, opts = {}) {
    if (!D.statusEl) return;
    D.statusEl.className = 'ig-status ' + type;
    if (D.statusIcon) D.statusIcon.innerHTML = iconHtml;
    if (D.statusText) D.statusText.textContent = text;
    let retry = D.statusEl.querySelector('.ig-status-retry');
    if (retry) retry.remove();
    if (type === 'error' && opts.retry) {
      retry = document.createElement('button');
      retry.className = 'ig-status-retry';
      retry.innerHTML = '<i class="fas fa-redo"></i> Retry';
      retry.onclick = () => { hideStatus(); handleParse(); };
      D.statusEl.appendChild(retry);
    }
  }
  function hideStatus() { if (D.statusEl) D.statusEl.className = 'ig-status'; }

  function setLoading(state) {
    isLoading = state;
    if (D.parseBtn) D.parseBtn.disabled = state;
    if (D.btnText) D.btnText.textContent = state ? t('input.processing') : (batchMode ? t('input.downloadBatch') : t('input.download'));
    const iconEl = D.parseBtn?.querySelector('i');
    if (iconEl) iconEl.className = state ? 'ig-spinner' : 'fas fa-download';
    if (D.heroIcon) D.heroIcon.classList.toggle('spin-3d', state);
    if (D.progressLine) D.progressLine.hidden = !state;
    if (state && D.resultCard) {
      D.resultCard.classList.add('visible');
      if (D.skeleton) D.skeleton.hidden = false;
      if (D.resultBody) D.resultBody.style.display = 'none';
    } else {
      if (D.skeleton) D.skeleton.hidden = true;
      if (D.resultBody) D.resultBody.style.display = '';
    }
  }

  /* ================================================================
     15. COOLDOWN
     ================================================================ */
  function startCooldown() {
    lastParseAt = Date.now();
    if (!D.cooldown) return;
    D.cooldown.hidden = false;
    let remain = Math.ceil(CONFIG.COOLDOWN_MS / 1000);
    if (D.cooldownNum) D.cooldownNum.textContent = remain;
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      remain--;
      if (remain <= 0) { clearInterval(cooldownTimer); cooldownTimer = null; D.cooldown.hidden = true; }
      else if (D.cooldownNum) D.cooldownNum.textContent = remain;
    }, 1000);
  }
  const isCoolingDown = () => (Date.now() - lastParseAt) < CONFIG.COOLDOWN_MS;

  /* ================================================================
     16. VALIDATE LIVE
     ================================================================ */
  const validateLive = debounce(() => {
    if (!D.input) return;
    const v = sanitizeUrl(D.input.value);
    D.input.classList.remove('valid', 'invalid');
    if (!v) { if (D.clearBtn) D.clearBtn.style.display = 'none'; return; }
    if (D.clearBtn) D.clearBtn.style.display = 'flex';
    const ok = isValidInstagramUrl(v);
    D.input.classList.toggle('valid', ok);
    D.input.classList.toggle('invalid', !ok);
  }, 220);

  /* ================================================================
     17. RENDER: QUALITY
     ================================================================ */
  const QUALITY_ORDER = ['360p', '720p', '1080p', 'original'];
  const QUALITY_LABEL = {
    '360p':     { icon: 'fa-video', label: '360p SD' },
    '720p':     { icon: 'fa-video', label: '720p HD' },
    '1080p':    { icon: 'fa-video', label: '1080p FHD' },
    'original': { icon: 'fa-star',  label: 'Original / 4K' }
  };

  function dedupeQualities(q) {
    const out = {}; const seen = new Set();
    QUALITY_ORDER.forEach(k => {
      const u = q && q[k];
      if (!u || !/^https?:\/\//i.test(u)) return;
      if (seen.has(u) && k !== '1080p' && k !== 'original') return;
      out[k] = u; seen.add(u);
    });
    return out;
  }

  function renderQualityButtons(qualities) {
    if (!D.qualityGrid) return;
    D.qualityGrid.innerHTML = '';
    const dd = dedupeQualities(qualities);
    const keys = Object.keys(dd);

    if (!keys.length) {
      D.qualityGrid.innerHTML =
        '<div class="ig-stat" style="grid-column:1/-1;justify-content:center;padding:14px;">' +
        '<i class="fas fa-info-circle"></i> Video tidak tersedia untuk postingan ini</div>';
      return;
    }

    let map = { ...dd };
    if (keys.length === 1) {
      const only = dd[keys[0]];
      map = { '360p': only, '720p': only, '1080p': only };
    } else if (keys.length === 2) {
      map['360p'] = map['360p'] || dd[keys[0]];
      map['720p'] = map['720p'] || dd[keys[0]];
      map['1080p'] = map['1080p'] || dd[keys[keys.length - 1]];
    }

    let rendered = 0;
    QUALITY_ORDER.forEach((q, i) => {
      const url = map[q];
      if (!url || !/^https?:\/\//i.test(url)) {
        if (q === 'original') return;
        const el = document.createElement('div');
        el.className = 'ig-dl-btn';
        el.style.opacity = '0.5'; el.style.cursor = 'not-allowed';
        el.innerHTML = `<i class="fas fa-ban"></i> ${QUALITY_LABEL[q].label} — N/A`;
        D.qualityGrid.appendChild(el);
        return;
      }
      rendered++;
      const meta = QUALITY_LABEL[q];
      const a = document.createElement('a');
      a.className = 'ig-dl-btn' + (q === '1080p' ? ' hd-highlight' : '');
      a.href = url;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('data-quality', q);
      a.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.label}`;
      setTimeout(() => a.classList.add('ig-in'), i * 55);
      D.qualityGrid.appendChild(a);
    });
    if (rendered === 0) {
      D.qualityGrid.innerHTML =
        '<div class="ig-stat" style="grid-column:1/-1;justify-content:center;padding:14px;">' +
        '<i class="fas fa-info-circle"></i> Video tidak tersedia</div>';
    }
  }

  /* ================================================================
     18. RENDER: PHOTOS
     ================================================================ */
  function renderPhotos(images) {
    if (!D.photosGrid || !D.photosSec) return;
    if (!images || !images.length) { D.photosSec.style.display = 'none'; D.photosGrid.innerHTML = ''; return; }
    D.photosSec.style.display = 'block';
    D.photosGrid.innerHTML = images.map((url, i) => `
      <div class="ig-photo-item" data-src="${escHtml(url)}" data-index="${i}" role="button" tabindex="0" aria-label="Foto ${i + 1}">
        <img src="${escHtml(url)}" alt="Foto ${i + 1}" loading="lazy" />
        <span class="photo-num">${i + 1}/${images.length}</span>
        <span class="photo-actions">
          <span class="photo-dl-icon" title="Download"><i class="fas fa-download"></i></span>
        </span>
      </div>`).join('');
    D.photosGrid.querySelectorAll('.ig-photo-item').forEach(el => {
      const handler = (e) => {
        const idx = Number(el.getAttribute('data-index'));
        const isDownload = e.target.closest('.photo-dl-icon');
        if (isDownload) {
          const src = el.getAttribute('data-src');
          DownloadQueue.add(src, `instagram_photo_${Date.now()}_${idx + 1}.jpg`);
          showToast(`Foto ${idx + 1} masuk queue`, 'info');
          Activity.add('download', `Unduh foto Instagram #${idx + 1}`);
        } else {
          openCarousel(idx);
        }
      };
      el.addEventListener('click', handler);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); } });
    });
  }

  /* ================================================================
     19. RENDER: AUDIO
     ================================================================ */
  function renderAudioButtons(audio, shortcode) {
    if (!D.audioGrid) return;
    D.audioGrid.innerHTML = '';
    const a128 = audio && (audio['128'] || audio['low']);
    const a320 = audio && (audio['320'] || audio['high']);

    const valid = CONFIG.SHORTCODE_RE.test(shortcode || '') ? shortcode : '';
    const vevioz = valid ? `https://api.vevioz.com/api/button/mp3/${encodeURIComponent(valid)}` : '';

    const final320 = (a320 && /^https?:\/\//i.test(a320)) ? a320
                   : (a128 && /^https?:\/\//i.test(a128)) ? a128 : vevioz;
    const final128 = (a128 && /^https?:\/\//i.test(a128)) ? a128 : vevioz;

    if (final128) {
      const wrap = document.createElement('div');
      wrap.className = 'ig-audio-btn-wrap';
      const b = document.createElement('a');
      b.className = 'ig-dl-btn audio-128';
      b.href = final128; b.target = '_blank'; b.rel = 'noopener noreferrer';
      b.setAttribute('data-quality', 'audio128');
      b.innerHTML = '<i class="fas fa-music"></i> Audio 128 kbps';
      setTimeout(() => b.classList.add('ig-in'), 80);
      wrap.appendChild(b);
      // Preview player (BARU v4)
      if (/\.mp3/i.test(final128)) {
        const audio_el = document.createElement('audio');
        audio_el.controls = true;
        audio_el.preload = 'none';
        audio_el.src = final128;
        audio_el.className = 'ig-audio-preview';
        wrap.appendChild(audio_el);
      }
      D.audioGrid.appendChild(wrap);
    }
    if (final320 && final320 !== final128) {
      const wrap = document.createElement('div');
      wrap.className = 'ig-audio-btn-wrap';
      const b = document.createElement('a');
      b.className = 'ig-dl-btn audio-320';
      b.href = final320; b.target = '_blank'; b.rel = 'noopener noreferrer';
      b.setAttribute('data-quality', 'audio320');
      b.innerHTML = '<i class="fas fa-music"></i> Audio 320 kbps';
      setTimeout(() => b.classList.add('ig-in'), 160);
      wrap.appendChild(b);
      if (/\.mp3/i.test(final320)) {
        const audio_el = document.createElement('audio');
        audio_el.controls = true;
        audio_el.preload = 'none';
        audio_el.src = final320;
        audio_el.className = 'ig-audio-preview';
        wrap.appendChild(audio_el);
      }
      D.audioGrid.appendChild(wrap);
    }
    if (!final128 && !final320) {
      D.audioGrid.innerHTML =
        '<div class="ig-stat" style="grid-column:1/-1;justify-content:center;padding:14px;">' +
        '<i class="fas fa-info-circle"></i> Audio tidak tersedia</div>';
    }
  }

  /* ================================================================
     20. RENDER: RESULT
     ================================================================ */
  function renderResult(data) {
    currentData = data;
    const setTxt = (id, v) => { const e = $(id); if (e) e.textContent = v; };

    const thumbEl = $('#igThumb');
    if (thumbEl) {
      thumbEl.src = data.thumb || '';
      thumbEl.onerror = function () {
        this.onerror = null;
        this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect fill="#111" width="320" height="320"/><text fill="#444" x="160" y="170" text-anchor="middle" font-size="16">No Thumbnail</text></svg>`
        );
      };
    }

    setTxt('#igAuthorName', data.author || 'Instagram User');
    setTxt('#igAuthorHandle', '@' + (data.username || 'user'));
    setTxt('#igDesc', data.caption || '—');
    setTxt('#igDuration', data.duration ? data.duration + 's' : '');
    setTxt('#igDate', fmtDate(data.timestamp));
    setTxt('#igSource', 'via ' + (data._source || '—'));
    setTxt('#igLikes', fmtNum(data.likes));
    setTxt('#igComments', fmtNum(data.comments));
    const count = (data.images?.length || 0) + (data.video ? 1 : 0);
    setTxt('#igMediaCount', String(count || 1));

    const du = $('#igDuration'); if (du && data.duration) du.classList.add('visible');
    const tb = $('#igTypeBadge');
    if (tb) {
      const ty = data.type || 'post';
      tb.textContent = ({ reels: 'REELS', video: 'VIDEO', carousel: 'CAROUSEL' }[ty]) || 'POST';
      tb.classList.add('visible');
    }
    if (D.demoBadge) D.demoBadge.hidden = !data._isDemo;

    const ds = $('#igDesc');
    if (ds && ds.textContent.length > 100 && D.descToggle) {
      D.descToggle.style.display = 'inline-block';
      D.descToggle.querySelector('span').textContent = t('result.more');
      D.descToggle.onclick = () => {
        const ex = ds.classList.toggle('expanded');
        D.descToggle.querySelector('span').textContent = ex ? t('result.less') : t('result.more');
      };
    } else if (D.descToggle) {
      D.descToggle.style.display = 'none';
    }

    renderQualityButtons(data.qualities || {});
    renderPhotos(data.images || []);
    renderAudioButtons(data.audio || {}, extractShortcode(currentUrl));

    if (D.favoriteBtn) {
      const isFav = FavoriteStore.has(currentUrl);
      D.favoriteBtn.classList.toggle('active', isFav);
      const icon = D.favoriteBtn.querySelector('i');
      if (icon) icon.className = isFav ? 'fas fa-star' : 'far fa-star';
    }

    D.resultCard?.classList.add('visible');
    setTimeout(() => D.resultCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);

    // Auto-download (setting)
    const s = getSettings();
    if (s.autoDownload && !data._isDemo) {
      const q = s.quality || '1080p';
      const url = data.qualities?.[q] || data.qualities?.['1080p'] || data.qualities?.['720p'] || data.qualities?.['360p'];
      if (url) setTimeout(() => {
        DownloadQueue.add(url, `instagram_auto_${Date.now()}.mp4`);
        showToast('Auto-download ' + q + ' dimulai', 'info');
      }, 800);
    }

    // Quick Mode (BARU v4)
    if (s.quickMode && !data._isDemo) {
      const q = s.quality || '1080p';
      const url = data.qualities?.[q] || data.qualities?.['1080p'] || data.qualities?.['720p'];
      if (url) setTimeout(() => {
        DownloadQueue.add(url, `instagram_quick_${Date.now()}.mp4`);
        showToast('Quick Mode: download ' + q, 'success');
      }, 600);
    }
  }

  /* ================================================================
     21. HISTORY RENDER
     ================================================================ */
  function renderHistory() {
    if (!D.tabsWrap) return;
    const items = HistoryStore.all();
    const favs = FavoriteStore.all();
    if (!items.length && !favs.length) { D.tabsWrap.hidden = true; return; }
    D.tabsWrap.hidden = false;

    const cardHtml = (h, star) => `
      <div class="ig-history-item" data-url="${escHtml(h.url)}" tabindex="0" role="button">
        ${h.thumb ? `<img src="${escHtml(h.thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div class="h-info">
          <div class="h-title">${escHtml(h.title)}</div>
          <div class="h-sub">@${escHtml(h.author)}</div>
        </div>
        ${star ? '<span class="h-star"><i class="fas fa-star"></i></span>' : ''}
      </div>`;

    D.historyList.innerHTML = items.length
      ? items.map(h => cardHtml(h, FavoriteStore.has(h.url))).join('')
      : '<div class="ig-history-empty">Belum ada riwayat download</div>';
    D.favoritesList.innerHTML = favs.length
      ? favs.map(h => cardHtml(h, true)).join('')
      : '<div class="ig-history-empty">Belum ada favorit</div>';

    D.tabsWrap.querySelectorAll('.ig-history-item').forEach(el => {
      const handler = () => {
        D.input.value = el.getAttribute('data-url') || '';
        validateLive();
        handleParse();
      };
      el.addEventListener('click', handler);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
    });
  }

  function saveHistory(data, url) {
    HistoryStore.add({
      title: escHtml((data.caption || 'Instagram Post').slice(0, 80)),
      author: escHtml(data.username || data.author || 'user').slice(0, 40),
      thumb: escHtml(data.thumb || ''),
      url: escHtml(url)
    });
    renderHistory();
  }

  /* ================================================================
     22. STATS
     ================================================================ */
  function renderStats() {
    const s = StatsStore.summary();
    if (D.statToday) D.statToday.textContent = s.todayN;
    if (D.statWeek) D.statWeek.textContent = s.week;
    if (D.statMonth) D.statMonth.textContent = s.month;
    if (D.statSpark) {
      const max = Math.max(1, ...s.spark);
      const W = 120, H = 34;
      const pts = s.spark.map((v, i) => {
        const x = (i / Math.max(1, s.spark.length - 1)) * W;
        const y = H - (v / max) * (H - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      D.statSpark.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="igSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E4405F" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#833AB4" stop-opacity="0.1"/>
          </linearGradient></defs>
          <polyline points="${pts} 120,34 0,34" fill="url(#igSparkGrad)" stroke="none"/>
          <polyline points="${pts}" fill="none" stroke="#E4405F" stroke-width="1.5"/>
        </svg>`;
    }
  }

  /* ================================================================
     23. THEME
     ================================================================ */
  function applyTheme() {
    const s = getSettings();
    document.documentElement.setAttribute('data-ig-theme', s.theme || 'dark');
    if (D.themeToggle) D.themeToggle.setAttribute('aria-pressed', s.theme === 'light' ? 'true' : 'false');
  }
  function toggleTheme() {
    const cur = getSettings().theme || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    saveSettings({ theme: next });
    document.documentElement.setAttribute('data-ig-theme', next);
    if (D.themeToggle) D.themeToggle.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
    showToast(next === 'dark' ? 'Tema gelap aktif' : 'Tema terang aktif', 'info');
  }

  /* ================================================================
     24. MODAL HELPERS
     ================================================================ */
  let prevFocus = null;
  function openModal(m) {
    if (!m) return;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    trapFocus(m);
    if (m.id === 'igShortcutModal' && D.shortcutToggle) {
      D.shortcutToggle.classList.add('active');
      D.shortcutToggle.setAttribute('aria-pressed', 'true');
    }
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    releaseFocus();
    if (m.id === 'igVideoModal' && D.previewVideo) {
      try { D.previewVideo.pause(); D.previewVideo.removeAttribute('src'); D.previewVideo.load(); } catch {}
    }
    if (m.id === 'igZoomModal') { zoomScale = 1; if (D.zoomImg) D.zoomImg.style.transform = ''; }
    if (m.id === 'igShortcutModal' && D.shortcutToggle) {
      D.shortcutToggle.classList.remove('active');
      D.shortcutToggle.setAttribute('aria-pressed', 'false');
    }
    // Stop any audio preview
    document.querySelectorAll('.ig-audio-preview').forEach(a => { try { a.pause(); } catch {} });
  }
  function trapFocus(m) {
    prevFocus = document.activeElement;
    const list = m.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(m); }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    m._focusHandler = onKey;
    m.addEventListener('keydown', onKey);
    setTimeout(() => first.focus(), 60);
  }
  function releaseFocus() {
    document.querySelectorAll('.ig-modal.open').forEach(m => {
      if (m._focusHandler) { m.removeEventListener('keydown', m._focusHandler); delete m._focusHandler; }
    });
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch {} prevFocus = null; }
  }

  function showConfirm(title, msg, handler) {
    if (D.confirmTitle) D.confirmTitle.textContent = title || 'Konfirmasi';
    if (D.confirmMsg) D.confirmMsg.textContent = msg || t('msg.confirmDelete');
    confirmHandler = handler || null;
    openModal(D.confirmModal);
  }

  /* ================================================================
     25. CAROUSEL VIEWER
     ================================================================ */
  function openCarousel(index) {
    if (!currentData || !currentData.images || !currentData.images.length) return;
    carouselImages = currentData.images.slice();
    carouselIndex = Math.max(0, Math.min(index, carouselImages.length - 1));
    renderCarousel();
    openModal(D.carouselModal);
  }
  function renderCarousel() {
    if (!carouselImages.length) return;
    const url = carouselImages[carouselIndex];
    if (D.carouselImg) D.carouselImg.src = url;
    if (D.carouselCounter) D.carouselCounter.textContent = `${carouselIndex + 1} / ${carouselImages.length}`;
    if (D.carouselDots) {
      D.carouselDots.innerHTML = carouselImages.map((_, i) =>
        `<button type="button" class="ig-carousel-dot${i === carouselIndex ? ' active' : ''}" data-idx="${i}" role="tab" aria-label="Foto ${i + 1}" aria-selected="${i === carouselIndex}"></button>`
      ).join('');
      D.carouselDots.querySelectorAll('.ig-carousel-dot').forEach(b => {
        b.addEventListener('click', () => {
          carouselIndex = Number(b.getAttribute('data-idx'));
          renderCarousel();
        });
      });
    }
    const multi = carouselImages.length > 1;
    if (D.carouselPrev) D.carouselPrev.style.display = multi ? '' : 'none';
    if (D.carouselNext) D.carouselNext.style.display = multi ? '' : 'none';
  }
  function carouselNav(delta) {
    if (!carouselImages.length) return;
    carouselIndex = (carouselIndex + delta + carouselImages.length) % carouselImages.length;
    renderCarousel();
  }

  // Swipe support (BARU v4)
  (function initSwipe() {
    if (!D.carouselStage) return;
    let startX = 0, startY = 0;
    D.carouselStage.addEventListener('touchstart', e => {
      if (!e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    D.carouselStage.addEventListener('touchend', e => {
      if (!e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        carouselNav(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  })();

  /* ================================================================
     26. ZOOM
     ================================================================ */
  function openZoom(url) {
    if (!url || !D.zoomImg) return;
    D.zoomImg.src = url;
    zoomScale = 1;
    D.zoomImg.style.transform = '';
    openModal(D.zoomModal);
  }
  function zoomBy(delta) {
    zoomScale = Math.max(0.4, Math.min(4, zoomScale + delta));
    if (D.zoomImg) D.zoomImg.style.transform = `scale(${zoomScale})`;
  }

  /* ================================================================
     27. BATCH PREVIEW (BARU v4)
     ================================================================ */
  function renderBatchPreview() {
    if (!D.batchGrid) return;
    if (!batchResults.length) {
      D.batchGrid.innerHTML = '<div class="ig-history-empty">Tidak ada hasil batch</div>';
      return;
    }
    D.batchGrid.innerHTML = batchResults.map((r, i) => `
      <div class="ig-batch-card" data-idx="${i}" role="button" tabindex="0" aria-label="Hasil ${i + 1}">
        <img src="${escHtml(r.thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="bc-info">@${escHtml(r.username)}</div>
        <div class="bc-actions">
          <button type="button" class="bc-btn" data-action="dl" data-idx="${i}" title="Download"><i class="fas fa-download"></i></button>
        </div>
      </div>`).join('');

    D.batchGrid.querySelectorAll('.ig-batch-card').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="dl"]')) return;
        const idx = Number(el.getAttribute('data-idx'));
        const r = batchResults[idx];
        if (r && r.url) {
          D.input.value = r.url;
          validateLive();
          closeModal(D.batchPreviewModal);
          handleParse();
        }
      });
    });
    D.batchGrid.querySelectorAll('[data-action="dl"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-idx'));
        const r = batchResults[idx];
        if (r && r.bestUrl) {
          DownloadQueue.add(r.bestUrl, `instagram_batch_${Date.now()}_${idx + 1}.mp4`);
          showToast(`Batch #${idx + 1} masuk queue`, 'info');
        }
      });
    });
  }

  /* ================================================================
     28. MAIN PARSE
     ================================================================ */
  async function handleParse() {
    if (isLoading) return;
    if (isCoolingDown()) { showToast('Tunggu sebentar sebelum parse lagi', 'warning'); return; }
    if (batchMode) return handleBatchParse();

    const url = sanitizeUrl(D.input.value);
    if (!url) { setStatus('error', '⚠️', t('msg.empty')); showToast(t('msg.empty'), 'error'); return; }
    if (!isValidInstagramUrl(url)) { setStatus('error', '❌', t('msg.invalid')); showToast(t('msg.invalid'), 'error'); return; }

    // Smart Dedupe check
    const d = DedupeStore.check(url);
    if (d) {
      showConfirm('Sudah pernah diunduh',
        `URL ini sudah diunduh ${d.relative}. Tetap lanjutkan?`,
        () => { DedupeStore.mark(url); doParse(url); });
      return;
    }

    doParse(url);
  }

  async function doParse(url) {
    currentUrl = url;
    setLoading(true);
    setStatus('loading', '<span class="ig-spinner"></span>', 'Mengambil data...');
    if (D.progressFill) D.progressFill.style.width = '8%';

    try {
      const data = await engine.parse(url, (stage, msg) => {
        setStatus('loading', '<span class="ig-spinner"></span>', msg);
        if (D.progressFill) D.progressFill.style.width = stage === 'cache' ? '60%' : '45%';
      });
      if (D.progressFill) D.progressFill.style.width = '90%';
      renderResult(data);
      saveHistory(data, url);
      StatsStore.inc();
      DedupeStore.mark(url);
      renderStats();

      const count = (data.images?.length || 0) + (data.video ? 1 : 0);
      if (data._isDemo) {
        setStatus('error', '⚠️', 'Semua server gagal — menampilkan data DEMO.');
      } else {
        setStatus('success', '✅', `Berhasil via ${data._source}! ${count} media siap diunduh.`);
        showToast(t('msg.success'), 'success', 3500, 'ig-toast-premium');
        UIAnimator.drawCheck();
      }
      if (D.progressFill) D.progressFill.style.width = '100%';
      Activity.add('download', `Instagram dari @${data.username || 'user'}`);
      startCooldown();
      setTimeout(() => { if (D.statusEl?.classList.contains('success')) hideStatus(); }, 4500);
      setTimeout(() => { if (D.progressLine) D.progressLine.hidden = true; }, 800);
    } catch (e) {
      console.error('[IG v4][PARSE-FAIL]', e);
      let msg = 'Maaf, semua server sibuk. Coba lagi 1 menit lagi.';
      const m = (e && e.message) || '';
      if (/private|deleted|not found|unavailable/i.test(m)) msg = 'Postingan tidak dapat diakses (private/dihapus).';
      else if (/login|sign in/i.test(m)) msg = 'Postingan memerlukan login Instagram.';
      else if (/timeout|abort/i.test(m)) msg = 'Koneksi timeout. Periksa jaringan & coba lagi.';
      setStatus('error', '❌', msg, { retry: true });
      showToast(t('msg.fail'), 'error');
      if (D.progressLine) D.progressLine.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  /* ================================================================
     29. BATCH PARSE
     ================================================================ */
  async function handleBatchParse() {
    const raw = (D.batchInput.value || '').split(/\s+/).map(sanitizeUrl).filter(Boolean);
    const urls = raw.filter(isValidInstagramUrl).slice(0, CONFIG.BATCH_MAX);
    if (!urls.length) { showToast('Tidak ada URL valid', 'error'); return; }

    currentUrl = urls[0];
    batchResults = [];
    setLoading(true);
    showToast(`Memproses ${urls.length} URL…`, 'info');

    let ok = 0, fail = 0;
    for (let i = 0; i < urls.length; i++) {
      try {
        setStatus('loading', '<span class="ig-spinner"></span>', `[${i + 1}/${urls.length}] Memproses…`);
        if (D.progressFill) D.progressFill.style.width = ((i + 1) / urls.length * 100).toFixed(1) + '%';
        const data = await engine.parse(urls[i]);
        saveHistory(data, urls[i]);
        StatsStore.inc();
        batchResults.push({
          url: urls[i],
          thumb: data.thumb,
          username: data.username || data.author || 'user',
          bestUrl: data.qualities?.['1080p'] || data.qualities?.['720p'] || data.qualities?.['360p'] || data.video || '',
          _data: data
        });
        if (i === 0) renderResult(data);
        ok++;
        await sleep(CONFIG.BATCH_DELAY_MS);
      } catch (e) {
        console.warn('[IG v4][BATCH][FAIL]', urls[i], e.message);
        fail++;
      }
    }
    renderStats();
    setLoading(false);
    setStatus(fail ? 'error' : 'success', fail ? '⚠️' : '✅',
      `Batch selesai: ${ok} berhasil, ${fail} gagal.`);
    if (ok) {
      UIAnimator.confetti(30);
      showToast(`${ok} URL berhasil!`, 'success', 4000, 'ig-toast-premium');
      // Show batch preview
      if (ok > 1) {
        renderBatchPreview();
        setTimeout(() => openModal(D.batchPreviewModal), 800);
      }
    }
    startCooldown();
    setTimeout(() => { if (D.progressLine) D.progressLine.hidden = true; }, 800);
  }

  /* ================================================================
     30. DOWNLOAD ALL
     ================================================================ */
  async function handleDownloadAll() {
    if (!currentData) return;
    const imgs = currentData.images || [];
    if (!imgs.length) { showToast('Tidak ada foto untuk diunduh', 'warning'); return; }
    showToast(`Menambah ${imgs.length} foto ke queue…`, 'info');
    for (let i = 0; i < imgs.length; i++) {
      DownloadQueue.add(imgs[i], `instagram_${Date.now()}_${i + 1}.jpg`);
    }
    UIAnimator.confetti(30);
  }

  /* ================================================================
     31. EVENT BINDINGS
     ================================================================ */
  D.parseBtn?.addEventListener('click', (e) => {
    UIAnimator.ripple(D.parseBtn, e);
    const r = D.parseBtn.getBoundingClientRect();
    UIAnimator.particleBurst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2, 24);
    handleParse();
  });

  D.input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleParse(); } });
  D.input?.addEventListener('input', validateLive);
  D.input?.addEventListener('paste', () => setTimeout(() => {
    D.input.value = D.input.value.trim();
    validateLive();
  }, 30));

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev =>
    D.input?.addEventListener(ev, e => { e.preventDefault(); D.input.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(ev =>
    D.input?.addEventListener(ev, e => { e.preventDefault(); D.input.classList.remove('dragover'); })
  );
  D.input?.addEventListener('drop', e => {
    const txt = (e.dataTransfer?.getData('text') || '').trim();
    if (txt) {
      D.input.value = txt;
      validateLive();
      if (isValidInstagramUrl(txt)) handleParse();
    }
  });

  D.pasteBtn?.addEventListener('click', async () => {
    D.pasteBtn.classList.add('spin');
    setTimeout(() => D.pasteBtn.classList.remove('spin'), 500);
    try {
      const txt = await navigator.clipboard.readText();
      if (batchMode) { D.batchInput.value = txt.trim(); updateBatchCount(); }
      else { D.input.value = txt.trim(); validateLive(); }
      if (isValidInstagramUrl(txt)) handleParse();
      else showToast('Clipboard bukan link Instagram', 'warning');
    } catch { showToast('Gagal paste dari clipboard', 'error'); }
  });

  D.clearBtn?.addEventListener('click', () => {
    D.input.value = '';
    D.input.classList.remove('valid', 'invalid');
    D.clearBtn.style.display = 'none';
    D.resultCard?.classList.remove('visible');
    hideStatus();
    D.input.focus();
  });

  function updateBatchCount() {
    const n = (D.batchInput?.value || '').split(/\s+/).filter(Boolean).length;
    if (D.batchCount) {
      D.batchCount.textContent = n;
      D.batchCount.parentElement?.classList.toggle('over', n > CONFIG.BATCH_MAX);
    }
  }
  D.batchToggle?.addEventListener('click', () => {
    batchMode = !batchMode;
    D.batchToggle.classList.toggle('active', batchMode);
    D.batchToggle.setAttribute('aria-pressed', batchMode ? 'true' : 'false');
    D.singleRow.hidden = batchMode;
    D.batchRow.hidden = !batchMode;
    if (D.btnText) D.btnText.textContent = batchMode ? t('input.downloadBatch') : t('input.download');
    if (batchMode) D.batchInput.focus();
  });
  D.batchInput?.addEventListener('input', updateBatchCount);

  // Quick Mode toggle
  D.quickModeToggle?.addEventListener('click', () => {
    const s = getSettings();
    const next = !s.quickMode;
    saveSettings({ quickMode: next });
    D.quickModeToggle.classList.toggle('active', next);
    D.quickModeToggle.setAttribute('aria-pressed', next ? 'true' : 'false');
    showToast(next ? 'Quick Mode aktif — download otomatis' : 'Quick Mode nonaktif', 'info');
  });

  // Clipboard banner
  D.clipboardAccept?.addEventListener('click', () => {
    if (clipboardUrl) {
      D.input.value = clipboardUrl;
      validateLive();
      D.clipboardBanner.hidden = true;
      showToast('Link digunakan', 'success');
    }
  });
  D.clipboardDismiss?.addEventListener('click', () => {
    D.clipboardBanner.hidden = true;
    clipboardUrl = '';
  });

  // Delegated: .ig-dl-btn click
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.ig-mini-copy');
    if (copyBtn) {
      e.preventDefault(); e.stopPropagation();
      const u = copyBtn.getAttribute('data-copy');
      if (u) navigator.clipboard.writeText(u)
        .then(() => showToast('URL media disalin', 'success'))
        .catch(() => showToast('Gagal menyalin', 'error'));
      return;
    }
    const btn = e.target.closest('.ig-dl-btn');
    if (!btn) return;
    UIAnimator.ripple(btn, e);
    const url = btn.getAttribute('href') || btn.href;
    if (!url || url === '#') return;
    const q = btn.getAttribute('data-quality');
    const isAudio = btn.classList.contains('audio-128') || btn.classList.contains('audio-320');
    if (isAudio) Activity.add('download', 'Unduh audio MP3 Instagram');
    else if (q) Activity.add('download', 'Unduh Instagram ' + q);
    if (currentData) {
      const safe = (currentData.username || 'instagram').replace(/[^\w-]/g, '').slice(0, 40);
      const ext = isAudio ? 'mp3' : 'mp4';
      const name = `instagram_${safe}_${q || 'media'}_${Date.now()}.${ext}`;
      btn.setAttribute('download', name);
      if (!isAudio) {
        e.preventDefault();
        DownloadQueue.add(url, name);
        showToast(`${q || 'media'} masuk queue`, 'info');
      }
    }
  });

  // Copy link
  $('#igCopyLinkBtn')?.addEventListener('click', async () => {
    const url = D.input.value.trim() || currentUrl;
    if (!url) { showToast('Tidak ada link', 'warning'); return; }
    try { await navigator.clipboard.writeText(url); showToast(t('msg.copied'), 'success'); Activity.add('copy_link', 'Menyalin link IG'); }
    catch { prompt('Salin link:', url); }
  });

  // Share
  $('#igShareBtn')?.addEventListener('click', async () => {
    const url = D.input.value.trim() || currentUrl;
    if (!url) { showToast('Tidak ada link', 'warning'); return; }
    const title = currentData ? `Instagram @${currentData.username}` : 'Instagram Post';
    if (navigator.share) {
      try { await navigator.share({ title, text: 'Download Instagram via IRGXYMODS', url }); Activity.add('share', 'Bagikan link IG'); }
      catch {}
    } else {
      try { await navigator.clipboard.writeText(url); showToast('Link disalin', 'success'); }
      catch { prompt('Salin link:', url); }
    }
  });

  // Thumbnail
  $('#igDownloadThumbBtn')?.addEventListener('click', () => {
    if (!currentData || !currentData.thumb) { showToast('Thumbnail tidak tersedia', 'warning'); return; }
    const safe = (currentData.username || 'instagram').replace(/[^\w-]/g, '').slice(0, 40);
    DownloadQueue.add(currentData.thumb, `${safe || 'instagram'}_thumb.jpg`);
    showToast('Thumbnail masuk queue', 'info');
  });

  // Download All
  D.downloadAllBtn?.addEventListener('click', handleDownloadAll);

  // Copy All Links (BARU v4)
  D.copyAllBtn?.addEventListener('click', async () => {
    if (!currentData || !currentData.images?.length) { showToast('Tidak ada foto', 'warning'); return; }
    const all = currentData.images.join('\n');
    try {
      await navigator.clipboard.writeText(all);
      showToast(`${currentData.images.length} URL disalin`, 'success');
    } catch {
      prompt('Salin URL:', all);
    }
  });

  // Favorite toggle
  D.favoriteBtn?.addEventListener('click', (e) => {
    UIAnimator.ripple(D.favoriteBtn, e);
    if (!currentData || !currentUrl) { showToast('Belum ada hasil', 'warning'); return; }
    const added = FavoriteStore.toggle({
      title: escHtml((currentData.caption || 'Instagram Post').slice(0, 80)),
      author: escHtml(currentData.username || currentData.author || 'user').slice(0, 40),
      thumb: escHtml(currentData.thumb || ''),
      url: escHtml(currentUrl)
    });
    D.favoriteBtn.classList.toggle('active', added);
    const icon = D.favoriteBtn.querySelector('i');
    if (icon) icon.className = added ? 'fas fa-star' : 'far fa-star';
    showToast(added ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit', added ? 'success' : 'info');
    renderHistory();
  });

  // Tabs
  document.querySelectorAll('.ig-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tg = btn.getAttribute('data-tab');
      document.querySelectorAll('.ig-tab-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.ig-tab-panel').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-panel') === tg);
      });
    });
  });

  // Clear history
  D.clearHistory?.addEventListener('click', () => {
    showConfirm('Hapus Riwayat', 'Yakin hapus semua riwayat download?', () => {
      HistoryStore.clear();
      renderHistory();
      showToast('Riwayat dihapus', 'success');
    });
  });

  // Export
  D.exportBtn?.addEventListener('click', () => {
    const data = {
      history: HistoryStore.all(), favorites: FavoriteStore.all(),
      stats: StatsStore.summary(), settings: getSettings(),
      exportedAt: new Date().toISOString(), v: CONFIG.SCHEMA_VERSION
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    anchorDownload(url, `irgxy_ig_backup_${Date.now()}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    showToast('Backup diexport', 'success');
  });

  // FAQ
  $$('.ig-faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.ig-faq-item');
      if (!item) return;
      const wasOpen = item.classList.contains('open');
      $$('.ig-faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.ig-faq-q')?.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  // Video modal
  D.thumbWrap?.addEventListener('click', () => {
    if (!currentData) return;
    if (currentData.images && currentData.images.length > 1) { openCarousel(0); return; }
    const src = currentData.video || currentData.qualities?.['1080p'] || currentData.qualities?.['720p'] || currentData.qualities?.['360p'];
    if (!src) { showToast('Preview tidak tersedia', 'warning'); return; }
    D.previewVideo.src = src;
    D.previewVideo.playbackRate = 1;
    if (D.previewSpeed) D.previewSpeed.value = '1';
    openModal(D.videoModal);
    D.previewVideo.play().catch(() => {});
  });
  D.thumbWrap?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); D.thumbWrap.click(); } });
  D.previewSpeed?.addEventListener('change', () => { if (D.previewVideo) D.previewVideo.playbackRate = parseFloat(D.previewSpeed.value); });
  D.previewPip?.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await D.previewVideo.requestPictureInPicture();
    } catch { showToast('PiP tidak didukung', 'warning'); }
  });
  D.previewFs?.addEventListener('click', () => {
    const v = D.previewVideo;
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  });

  // Carousel nav
  D.carouselPrev?.addEventListener('click', () => carouselNav(-1));
  D.carouselNext?.addEventListener('click', () => carouselNav(1));
  D.carouselDownload?.addEventListener('click', () => {
    const url = carouselImages[carouselIndex];
    if (!url) return;
    DownloadQueue.add(url, `instagram_photo_${Date.now()}_${carouselIndex + 1}.jpg`);
    showToast('Foto masuk queue', 'success');
  });
  D.carouselCopy?.addEventListener('click', () => {
    const url = carouselImages[carouselIndex];
    if (!url) return;
    navigator.clipboard.writeText(url)
      .then(() => showToast('URL disalin', 'success'))
      .catch(() => showToast('Gagal', 'error'));
  });
  D.carouselZoom?.addEventListener('click', () => {
    const url = carouselImages[carouselIndex];
    if (url) openZoom(url);
  });

  // Zoom controls
  D.zoomIn?.addEventListener('click', () => zoomBy(0.2));
  D.zoomOut?.addEventListener('click', () => zoomBy(-0.2));
  D.zoomReset?.addEventListener('click', () => { zoomScale = 1; if (D.zoomImg) D.zoomImg.style.transform = ''; });

  // Modal closes
  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.closest('.ig-modal')));
  });

  // Confirm OK
  D.confirmOk?.addEventListener('click', () => {
    if (typeof confirmHandler === 'function') confirmHandler();
    confirmHandler = null;
    closeModal(D.confirmModal);
  });

  // Shortcut modal
  D.shortcutToggle?.addEventListener('click', () => openModal(D.shortcutModal));

  // Settings modal
  D.settingsToggle?.addEventListener('click', () => {
    const s = getSettings();
    const elT = $('#igSettingTheme'); if (elT) elT.value = s.theme;
    const elL = $('#igSettingLang'); if (elL) elL.value = s.lang;
    const elQ = $('#igSettingQuality'); if (elQ) elQ.value = s.quality;
    const elA = $('#igSettingAutoDl'); if (elA) elA.checked = !!s.autoDownload;
    const elH = $('#igSettingHistMax'); if (elH) elH.value = s.histMax;
    const elQm = $('#igSettingQuickMode'); if (elQm) elQm.checked = !!s.quickMode;
    const elD = $('#igSettingDedupe'); if (elD) elD.checked = !!s.dedupe;
    openModal(D.settingsModal);
  });

  $('#igSettingSave')?.addEventListener('click', () => {
    const patch = {
      theme: $('#igSettingTheme')?.value || 'dark',
      lang: $('#igSettingLang')?.value || 'id',
      quality: $('#igSettingQuality')?.value || '1080p',
      autoDownload: !!$('#igSettingAutoDl')?.checked,
      histMax: Math.max(4, Math.min(50, Number($('#igSettingHistMax')?.value) || 12)),
      quickMode: !!$('#igSettingQuickMode')?.checked,
      dedupe: !!$('#igSettingDedupe')?.checked
    };
    saveSettings(patch);
    document.documentElement.setAttribute('data-ig-theme', patch.theme);
    if (D.quickModeToggle) {
      D.quickModeToggle.classList.toggle('active', patch.quickMode);
      D.quickModeToggle.setAttribute('aria-pressed', patch.quickMode ? 'true' : 'false');
    }
    applyLang();
    showToast('Pengaturan disimpan', 'success');
    closeModal(D.settingsModal);
  });

  $('#igSettingReset')?.addEventListener('click', () => {
    showConfirm('Reset Data', 'Reset semua pengaturan & data lokal?', () => {
      Object.values(CONFIG.STORAGE).forEach(k => {
        if (typeof k === 'string') Storage.remove(k);
      });
      location.reload();
    });
  });

  // Theme toggle
  D.themeToggle?.addEventListener('click', toggleTheme);

  // Help button
  $('#helpBtn')?.addEventListener('click', () => {
    const faq = document.querySelector('.ig-info-grid');
    if (faq) faq.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // About modal (BARU v4)
  $('#aboutDropdownBtn')?.addEventListener('click', () => openModal(D.aboutModal));
  $('#igAboutCopyVersion')?.addEventListener('click', () => {
    navigator.clipboard.writeText('Instagram Downloader v4.0.0 FINAL ULTIMATE — IRGXYMODS')
      .then(() => showToast('Versi disalin', 'success'))
      .catch(() => showToast('Gagal menyalin', 'error'));
  });
  $('#igAboutCheckUpdate')?.addEventListener('click', () => {
    showToast('Anda menggunakan versi terbaru v4.0.0', 'info');
  });

  // Report
  $('#igReportBtn')?.addEventListener('click', () => {
    const url = D.input.value.trim() || currentUrl || '(none)';
    const ts = new Date().toISOString();
    const report = [
      '## Bug Report — Instagram Downloader v4.0', '',
      '**URL:**', url, '',
      '**Timestamp:** ' + ts,
      '**UA:** ' + navigator.userAgent,
      '**Theme:** ' + getSettings().theme,
      '**Lang:** ' + getSettings().lang,
      '**Status:** ' + (D.statusText?.textContent || '-'),
      '**Source:** ' + (currentData?._source || '-'), '',
      '**Description:**', '(jelaskan di sini)', '',
      '**Steps:**', '1.', '2.', '3.'
    ].join('\n');
    D.reportBody.value = report;
    const issueTitle = encodeURIComponent('[IG] ' + url.slice(0, 60));
    const issueBody = encodeURIComponent(report);
    D.reportGithub.href = `https://github.com/irgxymods/issue-tracker/issues/new?title=${issueTitle}&body=${issueBody}`;
    openModal(D.reportModal);
  });
  D.reportCopy?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(D.reportBody.value); showToast('Laporan disalin', 'success'); }
    catch { D.reportBody.select(); document.execCommand('copy'); showToast('Laporan disalin', 'success'); }
  });

  // Batch preview modal actions (BARU v4)
  D.batchDownloadAll?.addEventListener('click', () => {
    if (!batchResults.length) return;
    let count = 0;
    batchResults.forEach((r, i) => {
      if (r.bestUrl) {
        DownloadQueue.add(r.bestUrl, `instagram_batch_${Date.now()}_${i + 1}.mp4`);
        count++;
      }
    });
    showToast(`${count} item masuk queue`, 'success');
    UIAnimator.confetti(30);
  });
  D.batchExport?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(batchResults.map(r => ({
      url: r.url, username: r.username, bestUrl: r.bestUrl
    })), null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    anchorDownload(u, `ig_batch_${Date.now()}.json`);
    setTimeout(() => URL.revokeObjectURL(u), 30000);
    showToast('Batch diexport', 'success');
  });

  // Queue modal
  D.queueClear?.addEventListener('click', () => {
    DownloadQueue.clearDone();
    showToast('Queue dibersihkan', 'success');
  });

  // Settings dropdown toggle
  const settingsToggle = $('#settingsToggle');
  const settingsDropdown = $('#settingsDropdown');
  if (settingsToggle && settingsDropdown) {
    settingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = settingsDropdown.classList.toggle('open');
      settingsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!settingsDropdown.contains(e.target) && e.target !== settingsToggle) {
        settingsDropdown.classList.remove('open');
        settingsToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Profile dropdown (legacy)
  $('#profileDropdownBtn')?.addEventListener('click', () => {
    const pm = $('#profileModal');
    if (pm) pm.style.display = 'flex';
  });
  $('#profileModalClose')?.addEventListener('click', () => {
    const pm = $('#profileModal');
    if (pm) pm.style.display = 'none';
  });

  // Back to top
  const backToTop = $('#backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    backToTop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); backToTop.click(); }
    });
  }

  /* ================================================================
     32. GLOBAL KEYBOARD SHORTCUTS
     ================================================================ */
  document.addEventListener('keydown', (e) => {
    const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    const mod = e.ctrlKey || e.metaKey;

    // Shift+?
    if (e.shiftKey && (e.key === '?' || e.key === '/') && !inField) {
      e.preventDefault(); openModal(D.shortcutModal); return;
    }
    // Escape
    if (e.key === 'Escape') {
      const open = document.querySelector('.ig-modal.open');
      if (open) { e.preventDefault(); closeModal(open); return; }
      if (inField && document.activeElement === D.input) { D.clearBtn?.click(); return; }
    }
    // Carousel nav
    const carouselOpen = D.carouselModal?.classList.contains('open');
    if (carouselOpen) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); carouselNav(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); carouselNav(1); return; }
    }
    // Zoom +/-
    const zoomOpen = D.zoomModal?.classList.contains('open');
    if (zoomOpen) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(0.2); return; }
      if (e.key === '-') { e.preventDefault(); zoomBy(-0.2); return; }
    }
    // "/" focus input
    if (e.key === '/' && !inField) { e.preventDefault(); D.input?.focus(); return; }
    // Ctrl+Shift+L → theme
    if (mod && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); toggleTheme(); return; }
    // Ctrl+, → settings
    if (mod && e.key === ',') { e.preventDefault(); D.settingsToggle?.click(); return; }
    // Ctrl+S → download best
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const best = D.qualityGrid?.querySelector('.ig-dl-btn[data-quality="1080p"]')
              || D.qualityGrid?.querySelector('.ig-dl-btn[data-quality="original"]')
              || D.qualityGrid?.querySelector('.ig-dl-btn[data-quality]');
      if (best && best.href) best.click();
      return;
    }
    // Ctrl+B → batch
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); D.batchToggle?.click(); return; }
    // Ctrl+Enter → parse
    if (mod && e.key === 'Enter') { e.preventDefault(); handleParse(); return; }
  });

  // Auto-paste banner on focus (BARU v4)
  window.addEventListener('focus', async () => {
    try {
      if (!navigator.clipboard?.readText) return;
      const txt = (await navigator.clipboard.readText()).trim();
      if (!isValidInstagramUrl(txt)) return;
      if (D.input.value.trim()) return;
      clipboardUrl = txt;
      if (D.clipboardBanner) D.clipboardBanner.hidden = false;
    } catch {}
  });

  /* ================================================================
     33. CLEANUP
     ================================================================ */
  window.addEventListener('beforeunload', () => {
    engine.destroy();
    UIAnimator.destroy();
    if (cooldownTimer) clearInterval(cooldownTimer);
    document.querySelectorAll('.ig-audio-preview').forEach(a => { try { a.pause(); } catch {} });
  });

  /* ================================================================
     34. INIT
     ================================================================ */
  (function init() {
    applyTheme();
    applyLang();
    renderHistory();
    renderStats();
    validateLive();
    if (D.resultCard) D.resultCard.classList.remove('visible');

    // Init quick mode toggle state
    const s = getSettings();
    if (D.quickModeToggle) {
      D.quickModeToggle.classList.toggle('active', !!s.quickMode);
      D.quickModeToggle.setAttribute('aria-pressed', s.quickMode ? 'true' : 'false');
    }

    // Init queue render
    DownloadQueue.render();

    console.log(
      '%c✅ IRGXYMODS Instagram Downloader v4.0 FINAL ULTIMATE siap',
      'color:#E4405F;font-weight:bold;font-size:12px',
      '\n→ 7 API · Retry ×2 · Cache 5m · AbortController · Timeout 15s',
      '\n→ Download 3-tier · Batch 20 · Download All · Queue Manager',
      '\n→ Carousel Viewer + Zoom + Swipe + Pinch · Audio Preview',
      '\n→ i18n ID/EN · Settings · Theme Switch · Keyboard Shortcut',
      '\n→ Quick Mode · Smart Dedupe · Copy All · Clipboard Banner',
      '\n→ About Modal · Batch Preview · Error Report · Quota Guard'
    );
  })();

})();