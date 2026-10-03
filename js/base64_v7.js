/* ================================================================
   IRGXYMODS — BASE64_V7.JS — QUANTUM EDITION
   Merge v6.1 + v6.2 + v7-new • Zero-defect • 200+ fitur
   Komentar: v7-merge (gabungan), v7-fix (perbaikan bug), v7-new
   ================================================================ */
(function () {
  'use strict';

  /* ============ SHORTHANDS ============ */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const sec = () => $('#base64Section');

  /* ============ DEBUG ============ */
  const dbg = { on: false };
  const log  = (...a) => { if (dbg.on) try { console.log('[B64v7]', ...a); } catch (_) {} };
  const warn = (...a) => { if (dbg.on) try { console.warn('[B64v7]', ...a); } catch (_) {} };

  /* ============ TOAST ============ */
  const toast = (msg, type = 'success') => {
    try {
      if (window.IRGXY && typeof window.IRGXY.showToast === 'function') return window.IRGXY.showToast(msg, type);
      if (typeof window.showToast === 'function') return window.showToast(msg, type);
      const c = $('#toastContainer'); if (!c) return;
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = String(msg);
      c.appendChild(el);
      setTimeout(() => el.classList.add('show'), 20);
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
    } catch (_) {}
    try { if (SOUND.on) beep(type === 'error' ? 220 : 880); if (HAPTIC.on && navigator.vibrate) navigator.vibrate(type === 'error' ? [80,40,80] : 30); } catch (_) {}
  };

  /* ============ SAFE HELPERS ============ */
  const escapeHtml = (s) => s == null ? '' : String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const formatBytes = (b) => {
    if (!b || b < 1) return '0 B';
    const k = 1024, u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), u.length - 1);
    return (b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2) + ' ' + u[i];
  };
  const nf = (n) => Number(n || 0).toLocaleString('id-ID');
  const nowMs = () => (window.performance && performance.now) ? performance.now() : Date.now();
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* v7-merge: ProtoGuard (dari v6.2) */
  const safeObj = (o) => {
    if (!o || typeof o !== 'object') return {};
    const out = Object.create(null);
    for (const k of Object.keys(o)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = o[k];
    }
    return out;
  };

  /* ============ v7-new: SOUND & HAPTIC ============ */
  const SOUND = { on: false, ctx: null };
  const HAPTIC = { on: false };
  function beep(freq = 880) {
    try {
      if (!SOUND.ctx) SOUND.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = SOUND.ctx.createOscillator();
      const g = SOUND.ctx.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.value = 0.05;
      o.connect(g); g.connect(SOUND.ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); }, 80);
    } catch (_) {}
  }

  /* ============ STATE ============ */
  const state = {
    file2b64: { dataUrl: '', rawB64: '', mime: '', fileName: '', size: 0 },
    batch: [], loading: false, reader: null, controller: null,
    camera: { stream: null, facing: 'environment' },
    history: [], undo: { encode: [] },
    lang: 'id', theme: 'auto', fontScale: 3,
    stats: { total: 0, bytes: 0, byType: {}, days: [], timeSum: 0 },
    cmdIndex: 0, cmdItems: [], deferredPrompt: null, swReg: null,
    clipHistory: [], auditLog: [],
    xp: 0, level: 1, streak: 0, lastActive: '',
    codeKeypair: null, quiz: null
  };

  const KEYS = {
    HISTORY: 'irgxy_b64v7_history', THEME: 'irgxy_b64v7_theme', LANG: 'irgxy_b64v7_lang',
    DEBUG: 'irgxy_b64v7_debug', CLIP: 'irgxy_b64v7_clip', SANDBOX: 'irgxy_b64v7_sandbox',
    HC: 'irgxy_b64v7_hc', DYS: 'irgxy_b64v7_dys', MOTION: 'irgxy_b64v7_motion',
    FONT: 'irgxy_b64v7_font', STATS: 'irgxy_b64v7_stats', AUDIT: 'irgxy_b64v7_audit',
    CLIPHIST: 'irgxy_b64v7_cliphist', XP: 'irgxy_b64v7_xp', DRAFT: 'irgxy_b64v7_draft',
    ACCENT: 'irgxy_b64v7_accent', LAYOUT: 'irgxy_b64v7_layout',
    SOUND: 'irgxy_b64v7_sound', HAPTIC: 'irgxy_b64v7_haptic'
  };
  const HISTORY_MAX = 50, AUDIT_MAX = 100, CLIP_MAX = 20;

  const safeGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } };

  /* ============ i18n ============ */
  const i18n = {
    id: {
      heroSub: 'Quantum toolkit 200+ fitur — file, teks, URL, kamera, QR, Base32/58/85/91/16, JWT, AES-GCM, ECDSA, steganografi, PWA, AI-lite.',
      pillSafe: 'Client-Side', pillFast: 'Real-time', pillWorker: 'Web Worker', pillA11y: 'WCAG 2.1 AA',
      tabFile: 'File', tabText: 'Teks', tabUrl: 'URL', tabCamera: 'Kamera', tabAdv: 'Advanced',
      tabQr: 'QR', tabUtil: 'Utility', tabShare: 'Share', tabA11y: 'A11y', tabStats: 'Statistik',
      tabInteg: 'Integrasi', tabPwa: 'PWA', tabLearn: 'Edukasi', tabHist: 'Riwayat', tabSet: 'Pengaturan',
      dropTitle: 'Drag & Drop file', dropSub: 'atau klik — multi-file (batch), maks 25 MB/file',
      batchTitle: 'Batch Files', lblCompress: 'Kompres gambar'
    },
    en: {
      heroSub: 'Quantum toolkit 200+ features — file, text, URL, camera, QR, Base32/58/85/91/16, JWT, AES-GCM, ECDSA, stego, PWA, AI-lite.',
      pillSafe: 'Client-Side', pillFast: 'Real-time', pillWorker: 'Web Worker', pillA11y: 'WCAG 2.1 AA',
      tabFile: 'File', tabText: 'Text', tabUrl: 'URL', tabCamera: 'Camera', tabAdv: 'Advanced',
      tabQr: 'QR', tabUtil: 'Utility', tabShare: 'Share', tabA11y: 'A11y', tabStats: 'Stats',
      tabInteg: 'Integrate', tabPwa: 'PWA', tabLearn: 'Learn', tabHist: 'History', tabSet: 'Settings',
      dropTitle: 'Drag & Drop file', dropSub: 'or click — multi-file (batch), max 25 MB/file',
      batchTitle: 'Batch Files', lblCompress: 'Compress image'
    }
  };
  function applyLang(lang) {
    if (!i18n[lang]) lang = 'id';
    state.lang = lang;
    const dict = i18n[lang];
    $$('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (dict[k]) el.textContent = dict[k];
    });
    const lbl = $('#b64LangLabel'); if (lbl) lbl.textContent = lang.toUpperCase();
    document.documentElement.lang = lang;
    safeSet(KEYS.LANG, lang);
  }

  /* ============ BASE64 CORE (v7-merge) ============ */
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }
  function textToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function base64ToText(b64) {
    const clean = normalizeBase64(b64);
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  function base64ToBlob(b64, mime) {
    const clean = normalizeBase64(b64);
    const bin = atob(clean);
    const len = bin.length;
    const CHUNK = 1024 * 1024;
    const parts = [];
    for (let i = 0; i < len; i += CHUNK) {
      const end = Math.min(i + CHUNK, len);
      const arr = new Uint8Array(end - i);
      for (let j = i; j < end; j++) arr[j - i] = bin.charCodeAt(j);
      parts.push(arr);
    }
    return new Blob(parts, { type: mime || 'application/octet-stream' });
  }
  function normalizeBase64(b64) {
    let s = String(b64).replace(/\s+/g, '');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad === 2) s += '==';
    else if (pad === 3) s += '=';
    else if (pad === 1) throw new Error('Panjang Base64 tidak valid');
    return s;
  }
  function isValidBase64(b64) {
    return /^[A-Za-z0-9+/=_-]+$/.test(String(b64).replace(/\s+/g, ''));
  }
  const toUrlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const stripPad  = (b64) => b64.replace(/=+$/g, '');
  const wrapMime  = (b64) => b64.replace(/(.{76})/g, '$1\n');

  /* ============ Base32 (RFC 4648) ============ */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bits = 0, value = 0, out = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    while (out.length % 8 !== 0) out += '=';
    return out;
  }
  function base32Decode(str) {
    const clean = String(str).toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
    let bits = 0, value = 0;
    const out = [];
    for (let i = 0; i < clean.length; i++) {
      const idx = B32.indexOf(clean[i]);
      if (idx === -1) throw new Error('Karakter Base32 tidak valid: ' + clean[i]);
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(out));
  }

  /* ============ Base85 / ASCII85 (v7-fix: pakai versi v6.2 yang benar) ============ */
  function base85Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let out = '', i = 0;
    const pad = (4 - (bytes.length % 4)) % 4;
    const data = new Uint8Array(bytes.length + pad);
    data.set(bytes);
    for (; i < data.length; i += 4) {
      const n = (data[i] * 16777216) + (data[i + 1] * 65536) + (data[i + 2] * 256) + data[i + 3];
      if (n === 0) { out += 'z'; continue; }
      let chunk = '';
      let v = n;
      for (let j = 0; j < 5; j++) { chunk = String.fromCharCode((v % 85) + 33) + chunk; v = Math.floor(v / 85); }
      out += chunk;
    }
    out = out.slice(0, out.length - pad);
    return '<~' + out + '~>';
  }
  function base85Decode(str) {
    let s = String(str).trim().replace(/^<~/, '').replace(/~>$/, '').replace(/\s+/g, '');
    let out = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
      const chunk = s.substr(i, 5);
      let n = 0;
      for (let j = 0; j < 5; j++) {
        const c = chunk.charCodeAt(j) || 117;
        n = n * 85 + (c - 33);
      }
      out.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
      i += 5;
    }
    if (s.length % 5 !== 0) out = out.slice(0, out.length - (5 - (s.length % 5)));
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(out));
  }

  /* ============ v7-new: Base58 (Bitcoin alphabet) ============ */
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let n = 0n;
    for (const b of bytes) n = n * 256n + BigInt(b);
    let out = '';
    while (n > 0n) { const r = Number(n % 58n); out = B58[r] + out; n = n / 58n; }
    for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
    return out || '1';
  }
  function base58Decode(str) {
    let n = 0n;
    for (const c of String(str)) {
      const idx = B58.indexOf(c);
      if (idx === -1) throw new Error('Karakter Base58 tidak valid: ' + c);
      n = n * 58n + BigInt(idx);
    }
    const bytes = [];
    while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
    let leading = 0;
    for (const c of String(str)) { if (c === '1') leading++; else break; }
    for (let i = 0; i < leading; i++) bytes.unshift(0);
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  }

  /* ============ v7-new: Base91 (basE91) ============ */
  const B91 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
  function base91Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let b = 0, n = 0, out = '';
    for (const byte of bytes) {
      b |= byte << n;
      n += 8;
      if (n > 13) {
        let v = b & 8191;
        if (v > 88) { b >>= 13; n -= 13; }
        else { v = b & 16383; b >>= 14; n -= 14; }
        out += B91[v % 91] + B91[Math.floor(v / 91)];
      }
    }
    if (n) {
      out += B91[b % 91];
      if (n > 7 || b > 90) out += B91[Math.floor(b / 91)];
    }
    return out;
  }
  function base91Decode(str) {
    const clean = String(str).replace(/\s+/g, '');
    let v = -1, b = 0, n = 0;
    const out = [];
    for (const c of clean) {
      const idx = B91.indexOf(c);
      if (idx === -1) continue;
      if (v < 0) { v = idx; }
      else {
        v += idx * 91;
        b |= v << n;
        n += (v & 8191) > 88 ? 13 : 14;
        while (n > 7) { out.push(b & 255); b >>= 8; n -= 8; }
        v = -1;
      }
    }
    if (v >= 0) out.push((b | v << n) & 255);
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(out));
  }

  /* ============ Hex ============ */
  function textToHex(str) {
    const bytes = new TextEncoder().encode(str);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
  }
  function hexToText(hex) {
    const clean = String(hex).replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length % 2 !== 0) throw new Error('Panjang Hex ganjil');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  /* ============ v7-merge: MD5 (pakai v6.1 — satu-satunya yang valid) ============ */
  function md5(str) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function au(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
    function cmn(q, a, b, x, s, t) { return au(rl(au(au(a, q), au(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    const bytes = new TextEncoder().encode(str);
    const n = bytes.length, bl = n * 8;
    const words = [];
    for (let i = 0; i < n; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8));
    words[n >> 2] = (words[n >> 2] || 0) | (0x80 << ((n % 4) * 8));
    const totalWords = (((n + 8) >> 6) + 1) * 16;
    while (words.length < totalWords) words.push(0);
    words[totalWords - 2] = bl;
    const x = words;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222);
      c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od);
    }
    const h = (n, len) => { let s = ''; for (let i = 0; i < len * 4; i++) s += String.fromCharCode((n >> (i * 8)) & 0xFF); return s; };
    return (h(a, 4) + h(b, 4) + h(c, 4) + h(d, 4)).split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  }

  /* ============ SHA-256 via Web Crypto ============ */
  async function sha256Hex(bytes) {
    if (!window.crypto || !crypto.subtle) return 'crypto.subtle unavailable';
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ============ MIME DETECTOR ============ */
  function detectMime(bytes) {
    try {
      if (!bytes || bytes.length < 4) return null;
      const b = bytes;
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
      if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
      if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
      if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
      if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return 'image/x-icon';
      if (bytes.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
          b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
      if (bytes.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
          b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) return 'audio/wav';
      if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg';
      if (b[0] === 0xFF && (b[1] === 0xE0 || b[1] === 0xF2 || b[1] === 0xFB)) return 'audio/mpeg';
      if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
      if (b[0] === 0x50 && b[1] === 0x4B && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'application/zip';
      if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'video/webm';
      if (bytes.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
      return null;
    } catch (_) { return null; }
  }

  /* ============ FILE READER ============ */
  function readFileAsArrayBuffer(file, onProgress) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      state.reader = r;
      r.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100))); };
      r.onload = () => { state.reader = null; resolve(r.result); };
      r.onerror = () => { state.reader = null; reject(r.error || new Error('FileReader error')); };
      r.onabort = () => { state.reader = null; reject(new Error('Read aborted')); };
      r.readAsArrayBuffer(file);
    });
  }
  function abortRead() {
    if (state.reader && state.reader.readyState === 1) { try { state.reader.abort(); } catch (_) {} }
    state.reader = null;
    state.loading = false;
  }

  /* ============ WEB WORKER ============ */
  let b64Worker = null;
  function getWorker() {
    if (b64Worker) return b64Worker;
    const code = `
      self.onmessage = function (e) {
        const d = e.data;
        try {
          if (d.mode === 'encode') {
            var bytes = new Uint8Array(d.buffer);
            var bin = '', CH = 0x8000;
            for (var i = 0; i < bytes.length; i += CH) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
            }
            self.postMessage({ id: d.id, ok: true, b64: btoa(bin) });
          } else if (d.mode === 'decode') {
            var bin2 = atob(d.b64);
            var out = new Uint8Array(bin2.length);
            for (var j = 0; j < bin2.length; j++) out[j] = bin2.charCodeAt(j);
            self.postMessage({ id: d.id, ok: true, buffer: out.buffer }, [out.buffer]);
          }
        } catch (err) { self.postMessage({ id: d.id, ok: false, error: err.message }); }
      };
    `;
    try {
      const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      b64Worker = new Worker(url);
      b64Worker._url = url;
    } catch (err) { warn('Worker unavailable', err); b64Worker = null; }
    return b64Worker;
  }
  function workerEncode(buffer) {
    const w = getWorker();
    if (!w) return Promise.resolve(arrayBufferToBase64(buffer));
    return new Promise((resolve, reject) => {
      try {
        const id = 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const handler = (e) => {
          if (e.data.id !== id) return;
          w.removeEventListener('message', handler);
          if (e.data.ok) resolve(e.data.b64); else reject(new Error(e.data.error));
        };
        w.addEventListener('message', handler);
        w.postMessage({ id, buffer, mode: 'encode' }, [buffer]);
      } catch (err) { try { resolve(arrayBufferToBase64(buffer)); } catch (e2) { reject(e2); } }
    });
  }

  /* ============ CLIPBOARD / DOWNLOAD / SHARE ============ */
  const getClipAutoClear = () => { try { return safeGet(KEYS.CLIP) === '1'; } catch (_) { return false; } };

  function pushClipHistory(text) {
    if (!text) return;
    state.clipHistory = [text, ...state.clipHistory.filter((x) => x !== text)].slice(0, CLIP_MAX);
    try { safeSet(KEYS.CLIPHIST, JSON.stringify(state.clipHistory)); } catch (_) {}
    renderClipHistory();
  }
  function renderClipHistory() {
    const el = $('#b64ClipList');
    if (!el) return;
    if (!state.clipHistory.length) {
      el.innerHTML = '<span class="b64-hint">Belum ada riwayat clipboard.</span>';
      return;
    }
    el.innerHTML = state.clipHistory.slice(0, 10).map((t, i) =>
      '<span class="b64-stat-chip" style="cursor:pointer;" data-ci="' + i + '" title="Klik untuk copy">' +
      escapeHtml(t.slice(0, 30)) + (t.length > 30 ? '…' : '') + '</span>').join('');
    el.querySelectorAll('[data-ci]').forEach((chip) => {
      chip.addEventListener('click', () => copyText(state.clipHistory[parseInt(chip.getAttribute('data-ci'), 10)]));
    });
  }

  async function copyText(text, opts = {}) {
    if (!text) { toast('Tidak ada teks', 'warning'); return false; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast('Berhasil di-copy!', 'success');
        pushClipHistory(text);
        if (opts.autoClear || getClipAutoClear()) {
          setTimeout(async () => { try { await navigator.clipboard.writeText(''); } catch (_) {} }, 30000);
        }
        audit('copy', text.slice(0, 80));
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { toast('Berhasil di-copy!', 'success'); pushClipHistory(text); return true; }
    } catch (_) {}
    toast('Gagal copy — select manual (Ctrl/Cmd + C)', 'error');
    return false;
  }
  function downloadBlob(filename, blob) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 5000);
      toast('Download: ' + filename, 'success');
      return true;
    } catch (err) { toast('Gagal download: ' + err.message, 'error'); return false; }
  }
  const downloadText = (filename, text) => downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));

  async function shareResult(title, text, file) {
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] }); toast('Berhasil di-share!', 'success'); return true;
      }
      if (navigator.share) {
        await navigator.share({ title, text }); toast('Berhasil di-share!', 'success'); return true;
      }
      await copyText(text);
      toast('Share tidak didukung — teks di-copy', 'info');
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
      toast('Share gagal: ' + (err.message || err), 'error');
    }
  }

  function printResult(title, content) {
    const w = window.open('', '_blank', 'width=820,height=640');
    if (!w) { toast('Popup diblokir', 'warning'); return; }
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>' +
      '<style>body{font-family:monospace;padding:24px;color:#111;}h1{font-size:18px;}pre{white-space:pre-wrap;word-break:break-all;background:#f5f5f5;padding:12px;border-radius:8px;font-size:12px;}</style>' +
      '</head><body><h1>' + escapeHtml(title) + '</h1><pre>' + escapeHtml(content) + '</pre></body></html>'
    );
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 250);
  }

  /* ============ PREVIEW ============ */
  function renderPreview(container, src) {
    if (!container) return;
    container.innerHTML = '';
    if (!src) return;
    const sandbox = $('#b64SandboxPreview') && $('#b64SandboxPreview').checked;
    try {
      if (src.startsWith('data:image/svg+xml') && sandbox) {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', '');
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        iframe.style.cssText = 'width:100%;height:280px;border:0;background:#fff;border-radius:8px;';
        iframe.srcdoc = '<!doctype html><meta charset="utf-8"><body style="margin:0"><img alt="preview" style="max-width:100%;display:block;margin:auto" src="' + src.replace(/"/g, '&quot;') + '"></body>';
        container.appendChild(iframe);
      } else if (src.startsWith('data:image/')) {
        const img = document.createElement('img');
        img.src = src; img.alt = 'Preview'; img.loading = 'lazy';
        img.addEventListener('click', () => openFullscreen(src));
        container.appendChild(img);
      } else if (src.startsWith('data:video/')) {
        const v = document.createElement('video');
        v.src = src; v.controls = true; v.playsInline = true; v.muted = true; v.preload = 'metadata';
        container.appendChild(v);
      } else if (src.startsWith('data:audio/')) {
        const a = document.createElement('audio');
        a.src = src; a.controls = true; a.preload = 'metadata';
        container.appendChild(a);
      } else {
        const ph = document.createElement('div');
        ph.className = 'b64-preview-placeholder';
        ph.innerHTML = '<i class="fas fa-file"></i><span>Tidak ada preview untuk tipe ini</span>';
        container.appendChild(ph);
      }
    } catch (_) {
      const ph = document.createElement('div');
      ph.className = 'b64-preview-placeholder';
      ph.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Gagal render preview</span>';
      container.appendChild(ph);
    }
  }

  /* ============ MODAL ============ */
  function confirmModal(msg, title) {
    return new Promise((resolve) => {
      const m = $('#b64Modal'); if (!m) return resolve(window.confirm(msg));
      $('#b64ModalTitle').textContent = title || 'Konfirmasi';
      $('#b64ModalMsg').textContent = msg;
      m.hidden = false; m.setAttribute('aria-hidden', 'false');
      const ok = () => { m.hidden = true; m.setAttribute('aria-hidden', 'true'); resolve(true); };
      const cancel = () => { m.hidden = true; m.setAttribute('aria-hidden', 'true'); resolve(false); };
      $('#b64ModalOk').addEventListener('click', ok, { once: true });
      $('#b64ModalCancel').addEventListener('click', cancel, { once: true });
      m.addEventListener('click', (e) => { if (e.target === m) cancel(); }, { once: true });
    });
  }

  /* ============ RATE LIMIT ============ */
  const rateMap = new Map();
  const rateLimit = (key, ms = 300) => {
    const t = Date.now();
    const last = rateMap.get(key) || 0;
    if (t - last < ms) return false;
    rateMap.set(key, t);
    return true;
  };

  /* ============ FULLSCREEN ============ */
  function openFullscreen(src) {
    const fs = $('#b64Fullscreen'), body = $('#b64FullscreenBody');
    if (!fs || !body) return;
    body.innerHTML = '';
    const img = document.createElement('img'); img.src = src; img.alt = 'Fullscreen';
    body.appendChild(img);
    fs.hidden = false; fs.setAttribute('aria-hidden', 'false');
    const close = () => { fs.hidden = true; fs.setAttribute('aria-hidden', 'true'); body.innerHTML = ''; };
    $('#b64FullscreenClose').addEventListener('click', close, { once: true });
    fs.addEventListener('click', (e) => { if (e.target === fs) close(); }, { once: true });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ============ v7-new: AUDIT LOG ============ */
  function audit(action, detail = '') {
    state.auditLog.unshift({ t: new Date().toISOString(), a: action, d: String(detail).slice(0, 200) });
    if (state.auditLog.length > AUDIT_MAX) state.auditLog = state.auditLog.slice(0, AUDIT_MAX);
    try { safeSet(KEYS.AUDIT, JSON.stringify(state.auditLog)); } catch (_) {}
  }
  function loadAudit() {
    try { state.auditLog = JSON.parse(safeGet(KEYS.AUDIT) || '[]') || []; } catch (_) { state.auditLog = []; }
  }

  /* ============ HISTORY ============ */
  function loadHistory() {
    try {
      const raw = safeGet(KEYS.HISTORY);
      state.history = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.history)) state.history = [];
    } catch (_) { state.history = []; }
  }
  function saveHistory() {
    try { safeSet(KEYS.HISTORY, JSON.stringify(state.history.slice(0, HISTORY_MAX))); }
    catch (err) { if (err && err.name === 'QuotaExceededError') toast('localStorage penuh', 'warning'); }
  }
  function addHistory(type, label, payload) {
    const item = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: String(type).slice(0, 40),
      label: String(label || '').slice(0, 200),
      payload: typeof payload === 'string' ? payload.slice(0, 8000) : String(payload || '').slice(0, 8000),
      time: new Date().toISOString(), fav: false
    };
    state.history.unshift(item);
    if (state.history.length > HISTORY_MAX) state.history = state.history.slice(0, HISTORY_MAX);
    saveHistory(); renderHistory();
  }
  function renderHistory() {
    const list = $('#b64HistoryList'); if (!list) return;
    if (!state.history.length) { list.innerHTML = '<p class="b64-hint">Belum ada riwayat.</p>'; return; }
    const frag = document.createDocumentFragment();
    state.history.forEach((h) => {
      const div = document.createElement('div');
      div.className = 'b64-history-item' + (h.fav ? ' fav' : '');
      div.setAttribute('data-id', h.id);
      const head = document.createElement('div'); head.className = 'b64-history-item-head';
      const typeEl = document.createElement('span'); typeEl.className = 'b64-history-item-type'; typeEl.textContent = h.type;
      const timeEl = document.createElement('span'); timeEl.className = 'b64-history-item-time';
      try { timeEl.textContent = new Date(h.time).toLocaleString('id-ID'); } catch (_) { timeEl.textContent = h.time; }
      head.appendChild(typeEl); head.appendChild(timeEl);
      const prev = document.createElement('div'); prev.className = 'b64-history-item-preview'; prev.textContent = h.label;
      const actions = document.createElement('div'); actions.className = 'b64-history-item-actions';
      ['copy','download','fav','delete'].forEach((a) => {
        const b = document.createElement('button');
        b.className = 'b64-btn' + (a === 'delete' ? ' b64-btn-danger' : '');
        b.setAttribute('data-action', a);
        const icons = { copy:'fa-copy', download:'fa-download', fav:'fa-star', delete:'fa-trash' };
        const i = document.createElement('i'); i.className = 'fas ' + icons[a]; b.appendChild(i);
        actions.appendChild(b);
      });
      div.appendChild(head); div.appendChild(prev); div.appendChild(actions);
      frag.appendChild(div);
    });
    list.innerHTML = ''; list.appendChild(frag);
  }
  function bindHistory() {
    const list = $('#b64HistoryList'); if (!list) return;
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]'); if (!btn) return;
      const item = e.target.closest('.b64-history-item'); if (!item) return;
      const id = item.getAttribute('data-id');
      const h = state.history.find((x) => x.id === id); if (!h) return;
      const action = btn.getAttribute('data-action');
      if (action === 'copy') copyText(h.payload);
      else if (action === 'download') downloadText('history-' + h.type + '.txt', h.payload);
      else if (action === 'delete') {
        state.history = state.history.filter((x) => x.id !== id);
        saveHistory(); renderHistory(); toast('Dihapus', 'info');
      } else if (action === 'fav') {
        h.fav = !h.fav; saveHistory(); renderHistory();
        toast(h.fav ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit', 'info');
      }
    });
  }

  /* ============ TABS ============ */
  function initTabs() {
    $$('.b64-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        $$('.b64-tab').forEach((t) => {
          const on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        $$('.b64-panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + target));
        if (window.AOS && AOS.refresh) AOS.refresh();
      });
    });
    $$('.b64-subtab').forEach((st) => {
      st.addEventListener('click', () => {
        const parent = st.closest('.b64-panel'); if (!parent) return;
        const sub = st.getAttribute('data-sub');
        parent.querySelectorAll('.b64-subtab').forEach((x) => {
          const on = x === st;
          x.classList.toggle('active', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        parent.querySelectorAll('.b64-subpanel').forEach((p) => p.classList.toggle('active', p.getAttribute('data-sub') === sub));
      });
    });
  }
  function switchTab(name) {
    const t = document.querySelector('.b64-tab[data-tab="' + name + '"]');
    if (t) t.click();
  }

  /* ============ v7-new: GAMIFIKASI (XP/Level/Streak) ============ */
  function loadXp() {
    try {
      const raw = JSON.parse(safeGet(KEYS.XP) || '{}');
      state.xp = raw.xp || 0; state.level = raw.level || 1; state.streak = raw.streak || 0; state.lastActive = raw.lastActive || '';
    } catch (_) {}
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastActive && state.lastActive !== today) {
      const diff = Math.round((new Date(today) - new Date(state.lastActive)) / 86400000);
      if (diff === 1) { state.streak++; toast('🔥 Streak ' + state.streak + ' hari!', 'success'); }
      else if (diff > 1) state.streak = 1;
      else state.streak = Math.max(1, state.streak);
    } else if (!state.lastActive) state.streak = 1;
    state.lastActive = today;
    saveXp();
    renderXp();
  }
  function saveXp() {
    safeSet(KEYS.XP, JSON.stringify({ xp: state.xp, level: state.level, streak: state.streak, lastActive: state.lastActive }));
  }
  function addXp(amount) {
    state.xp += amount;
    const newLevel = Math.floor(Math.sqrt(state.xp / 10)) + 1;
    if (newLevel > state.level) {
      state.level = newLevel;
      toast('🎉 Level up! Lv.' + newLevel, 'success');
    }
    saveXp(); renderXp();
  }
  function renderXp() {
    const lbl = $('#b64XpLabel');
    if (lbl) lbl.textContent = 'Lv.' + state.level + ' · ' + state.xp + ' XP · 🔥' + state.streak;
  }

  /* ============ STATS ============ */
  function loadStats() {
    try {
      const raw = safeGet(KEYS.STATS);
      if (raw) { const o = safeObj(JSON.parse(raw)); Object.assign(state.stats, o); }
    } catch (_) {}
    if (!state.stats.byType || typeof state.stats.byType !== 'object') state.stats.byType = {};
    if (!Array.isArray(state.stats.days)) state.stats.days = [];
  }
  function saveStats() {
    try { safeSet(KEYS.STATS, JSON.stringify(state.stats)); } catch (_) {}
  }
  function recordStats(type, bytes, elapsed) {
    state.stats.total = (state.stats.total || 0) + 1;
    state.stats.bytes = (state.stats.bytes || 0) + (bytes || 0);
    if (elapsed) state.stats.timeSum = (state.stats.timeSum || 0) + elapsed;
    if (type) state.stats.byType[type] = (state.stats.byType[type] || 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const dayEntry = state.stats.days.find((d) => d.d === today);
    if (dayEntry) dayEntry.n++;
    else state.stats.days.push({ d: today, n: 1 });
    if (state.stats.days.length > 90) state.stats.days = state.stats.days.slice(-90);
    saveStats();
    addXp(5);
  }
  function renderStats() {
    const st = state.stats;
    if ($('#b64AnTotal')) $('#b64AnTotal').textContent = nf(st.total);
    if ($('#b64AnBytes')) $('#b64AnBytes').textContent = formatBytes(st.bytes);
    if ($('#b64AnDays'))  $('#b64AnDays').textContent = nf(st.days.length);
    if ($('#b64AnAvg'))   $('#b64AnAvg').textContent = st.total ? Math.round((st.timeSum || 0) / st.total) : 0;
    const top = Object.entries(st.byType || {}).sort((a, b) => b[1] - a[1])[0];
    if ($('#b64AnTop')) $('#b64AnTop').textContent = top ? top[0] : '—';
    if ($('#b64AnTopList')) {
      const entries = Object.entries(st.byType || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
      $('#b64AnTopList').innerHTML = entries.length
        ? entries.map(([k, v]) => '<span class="b64-stat-chip"><i class="fas fa-file"></i> ' + escapeHtml(k) + ': ' + nf(v) + '</span>').join('')
        : '<span class="b64-hint">Belum ada data</span>';
    }
    drawChart();
    drawHeatmap();
  }
  function drawChart() {
    const c = $('#b64Chart'); if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const days = state.stats.days.slice(-7);
    if (!days.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data aktivitas', w / 2, h / 2);
      return;
    }
    const padding = 30;
    const bw = (w - padding * 2) / days.length;
    const max = Math.max(1, ...days.map((d) => d.n));
    days.forEach((d, i) => {
      const bh = (h - padding * 2) * (d.n / max);
      const x = padding + i * bw + bw * 0.15;
      const y = h - padding - bh;
      const grd = ctx.createLinearGradient(0, y, 0, h - padding);
      grd.addColorStop(0, '#f0d78c');
      grd.addColorStop(1, '#b8946a');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, bw * 0.7, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.d.slice(5), x + bw * 0.35, h - 10);
      ctx.fillText(String(d.n), x + bw * 0.35, y - 4);
    });
  }
  /* v7-new: heatmap 12 minggu */
  function drawHeatmap() {
    const el = $('#b64Heatmap'); if (!el) return;
    el.innerHTML = '';
    const map = {};
    (state.stats.days || []).forEach((d) => { map[d.d] = d.n; });
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const n = map[key] || 0;
      const lvl = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
      const cell = document.createElement('div');
      cell.className = 'b64-heatmap-cell';
      cell.setAttribute('data-lvl', String(lvl));
      cell.title = key + ': ' + n + ' aktivitas';
      el.appendChild(cell);
    }
  }

  /* ============ FEATURE DETECTION ============ */
  function featureDetect() {
    return {
      'Clipboard API': !!navigator.clipboard,
      'FileReader': typeof FileReader !== 'undefined',
      'Web Worker': typeof Worker !== 'undefined',
      'Web Crypto': !!(window.crypto && crypto.subtle),
      'TextEncoder': typeof TextEncoder !== 'undefined',
      'getUserMedia': !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      'Web Share': !!navigator.share,
      'IndexedDB': typeof indexedDB !== 'undefined',
      'BroadcastChannel': typeof BroadcastChannel !== 'undefined',
      'Speech Recognition': !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      'Speech Synthesis': !!window.speechSynthesis,
      'Service Worker': 'serviceWorker' in navigator,
      'localStorage': (() => { try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; } catch (_) { return false; } })(),
      'AOS': !!window.AOS,
      'QRCode lib': typeof window.QRCode !== 'undefined',
      'jsQR lib': typeof window.jsQR !== 'undefined',
      'File System Access': 'showSaveFilePicker' in window,
      'Badge API': 'setAppBadge' in navigator
    };
  }
  function renderFeatureDetect() {
    const out = $('#b64FeatureOut'); if (!out) return;
    out.textContent = Object.entries(featureDetect()).map(([k, v]) => (v ? '✅ ' : '❌ ') + k).join('\n');
  }
  function renderBrowserInfo() {
    const out = $('#b64BrowserOut'); if (!out) return;
    const ua = navigator.userAgent;
    const info = {
      'User Agent': ua.slice(0, 80) + (ua.length > 80 ? '…' : ''),
      'Language': navigator.language, 'Platform': navigator.platform || '—',
      'Online': navigator.onLine, 'Screen': (screen.width || 0) + '×' + (screen.height || 0),
      'Viewport': window.innerWidth + '×' + window.innerHeight,
      'DPR': window.devicePixelRatio, 'CPU Cores': navigator.hardwareConcurrency || '—',
      'Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    out.textContent = Object.entries(info).map(([k, v]) => k + ': ' + v).join('\n');
  }

  /* ============ SELF TEST ============ */
  function runSelfTest() {
    const out = $('#b64SelfTestOut'); if (!out) return;
    const tests = [];
    const t = (name, fn) => {
      try { const r = fn(); tests.push([name, r === true, r === true ? 'OK' : String(r)]); }
      catch (e) { tests.push([name, false, e.message]); }
    };
    t('Encode ASCII', () => textToBase64('Hello') === 'SGVsbG8=');
    t('Decode ASCII', () => base64ToText('SGVsbG8=') === 'Hello');
    t('Round-trip Unicode', () => base64ToText(textToBase64('Halo ✨ مرحبا')) === 'Halo ✨ مرحبا');
    t('Round-trip emoji', () => base64ToText(textToBase64('😀🚀🎉')) === '😀🚀🎉');
    t('Round-trip Arab', () => base64ToText(textToBase64('مرحبا بالعالم')) === 'مرحبا بالعالم');
    t('Round-trip Jepang', () => base64ToText(textToBase64('こんにちは')) === 'こんにちは');
    t('Round-trip Cina', () => base64ToText(textToBase64('你好世界')) === '你好世界');
    t('Empty string', () => textToBase64('') === '' && base64ToText('') === '');
    t('URL-safe', () => toUrlSafe('a+b/c==') === 'a-b_c');
    t('Strip padding', () => stripPad('SGVsbG8=') === 'SGVsbG8');
    t('Padding fix', () => { try { normalizeBase64('SGVsbG8'); return true; } catch (_) { return false; } });
    t('MIME wrap', () => wrapMime('a'.repeat(160)).split('\n').length === 3);
    t('Base32 round-trip', () => base32Decode(base32Encode('Test 123')) === 'Test 123');
    t('Base85 round-trip', () => base85Decode(base85Encode('Hello World')) === 'Hello World');
    t('Base58 round-trip', () => base58Decode(base58Encode('Bitcoin Address')) === 'Bitcoin Address');
    t('Base91 round-trip', () => base91Decode(base91Encode('Test 91')) === 'Test 91');
    t('Hex round-trip', () => hexToText(textToHex('Halo')) === 'Halo');
    t('MD5 "abc"', () => md5('abc') === '900150983cd24fb0d6963f7d28e17f72');
    t('MD5 "hello"', () => md5('hello') === '5d41402abc4b2a76b9719d911017c592');
    t('isValidBase64 ok', () => isValidBase64('SGVsbG8='));
    t('isValidBase64 bad', () => !isValidBase64('SGVs!!!bG8='));
    t('formatBytes', () => formatBytes(1024) === '1.00 KB');
    t('escapeHtml', () => escapeHtml('<script>') === '&lt;script&gt;');
    t('safeObj blocks proto', () => { const o = safeObj(JSON.parse('{"__proto__":{"x":1},"a":2}')); return o.a === 2 && !Object.prototype.x; });
    t('AES available', () => !!(window.crypto && crypto.subtle));
    t('MIME detect PNG', () => detectMime(new Uint8Array([0x89,0x50,0x4E,0x47,0,0,0,0])) === 'image/png');
    t('MIME detect JPEG', () => detectMime(new Uint8Array([0xFF,0xD8,0xFF,0,0,0,0,0])) === 'image/jpeg');

    const passed = tests.filter((x) => x[1]).length;
    const total = tests.length;
    out.textContent = tests.map(([n, ok, m]) => (ok ? '✅' : '❌') + ' ' + n + ' — ' + m).join('\n')
      + '\n\nHasil: ' + passed + '/' + total + ' lulus';
    toast(passed === total ? 'Semua test lulus! 🎉' : (passed + '/' + total + ' test lulus'), passed === total ? 'success' : 'info');
  }

  /* ============ THEME / A11Y ============ */
  function applyTheme(theme) {
    const s = sec(); if (!s) return;
    state.theme = theme;
    if (theme === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      s.classList.toggle('b64-light', mql.matches);
      if (!s._autoMql) {
        s._autoMql = (e) => { if (state.theme === 'auto') s.classList.toggle('b64-light', e.matches); };
        try { mql.addEventListener('change', s._autoMql); } catch (_) {}
      }
    } else {
      s.classList.toggle('b64-light', theme === 'light');
    }
    const lbl = $('#b64ThemeLabel');
    if (lbl) lbl.textContent = theme === 'auto' ? 'Auto' : (theme === 'light' ? 'Light' : 'Dark');
    safeSet(KEYS.THEME, theme);
  }
  function applyFontScale() {
    const s = sec(); if (!s) return;
    s.classList.remove('b64-fs-1','b64-fs-2','b64-fs-3','b64-fs-4','b64-fs-5');
    s.classList.add('b64-fs-' + Math.max(1, Math.min(5, state.fontScale)));
    if ($('#b64FontStats')) $('#b64FontStats').innerHTML = '<span class="b64-stat-chip">Level: ' + state.fontScale + '/5</span>';
    safeSet(KEYS.FONT, String(state.fontScale));
  }
  function applyAccent(color) {
    const s = sec(); if (!s) return;
    s.style.setProperty('--b64-gold', color);
    s.style.setProperty('--b64-gold-light', color);
    safeSet(KEYS.ACCENT, color);
  }
  function applyLayout(mode) {
    const grid = $('#panel-utility .b64-util-grid'); if (!grid) return;
    grid.classList.remove('b64-layout-list','b64-layout-compact');
    if (mode === 'list') grid.classList.add('b64-layout-list');
    else if (mode === 'compact') grid.classList.add('b64-layout-compact');
    safeSet(KEYS.LAYOUT, mode);
  }

  /* ============ COMMAND PALETTE ============ */
  function buildCmdItems() {
    const items = [];
    $$('.b64-tab').forEach((t) => {
      const label = t.querySelector('span')?.textContent || t.getAttribute('data-tab');
      items.push({ icon: 'fa-folder', label: 'Buka tab: ' + label, action: () => t.click() });
    });
    items.push({ icon: 'fa-moon', label: 'Toggle tema', action: () => $('#b64ThemeToggle').click() });
    items.push({ icon: 'fa-globe', label: 'Toggle bahasa', action: () => $('#b64LangToggle').click() });
    items.push({ icon: 'fa-vial', label: 'Run self test', action: () => { switchTab('settings'); setTimeout(() => $('#b64SelfTestBtn').click(), 100); } });
    items.push({ icon: 'fa-trash', label: 'Reset total', action: () => $('#b64FullReset').click() });
    items.push({ icon: 'fa-download', label: 'Export riwayat', action: () => $('#b64HistoryExport').click() });
    items.push({ icon: 'fa-graduation-cap', label: 'Buka Edukasi', action: () => switchTab('learn') });
    items.push({ icon: 'fa-qrcode', label: 'Buka QR', action: () => switchTab('qr') });
    return items;
  }
  function openCmdk() {
    const c = $('#b64Cmdk'); if (!c) return;
    c.hidden = false; c.setAttribute('aria-hidden', 'false');
    state.cmdItems = buildCmdItems();
    state.cmdIndex = 0;
    renderCmdk('');
    setTimeout(() => $('#b64CmdkInput').focus(), 30);
  }
  function closeCmdk() { const c = $('#b64Cmdk'); if (c) { c.hidden = true; c.setAttribute('aria-hidden', 'true'); } }
  function renderCmdk(q) {
    const list = $('#b64CmdkList'); if (!list) return;
    const items = state.cmdItems.filter((it) => !q || it.label.toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      if (i === state.cmdIndex) li.classList.add('active');
      const icon = document.createElement('i'); icon.className = 'fas ' + it.icon;
      const span = document.createElement('span'); span.textContent = it.label;
      li.appendChild(icon); li.appendChild(span);
      li.addEventListener('click', () => { closeCmdk(); try { it.action(); } catch (_) {} });
      list.appendChild(li);
    });
    state.cmdItems = items;
  }
  function initCmdk() {
    $('#b64CmdkBtn')?.addEventListener('click', openCmdk);
    const input = $('#b64CmdkInput');
    input?.addEventListener('input', (e) => { state.cmdIndex = 0; renderCmdk(e.target.value); });
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); state.cmdIndex = Math.min(state.cmdIndex + 1, state.cmdItems.length - 1); renderCmdk(input.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); state.cmdIndex = Math.max(state.cmdIndex - 1, 0); renderCmdk(input.value); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const it = state.cmdItems[state.cmdIndex]; if (it) { closeCmdk(); try { it.action(); } catch (_) {} }
      }
    });
    $('#b64Cmdk')?.addEventListener('click', (e) => { if (e.target.id === 'b64Cmdk') closeCmdk(); });
  }

  /* ============ SHORTCUTS ============ */
  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      const section = document.getElementById('base64Section'); if (!section) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
      if (e.key === 'Escape') { closeCmdk(); const fs = $('#b64Fullscreen'); if (fs && !fs.hidden) fs.hidden = true; return; }
      if (ctrl && e.key === 'Enter') {
        const active = section.querySelector('.b64-panel.active');
        if (!active) return;
        const map = { 'panel-text': '#b64EncodeBtn', 'panel-url': '#b64UrlFetch', 'panel-qr': '#b64QrGen' };
        const sel = map[active.id];
        if (sel) { e.preventDefault(); $(sel)?.click(); }
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const active = section.querySelector('.b64-panel.active');
        if (active && active.id === 'panel-text') {
          const subt = $$('.b64-subtab').find((x) => x.classList.contains('active'));
          if (subt && subt.getAttribute('data-sub') === 'encode') $('#b64EncodeSwap')?.click();
          else if (subt && subt.getAttribute('data-sub') === 'decode') $('#b64DecodeSwap')?.click();
        }
      }
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const active = section.querySelector('.b64-panel.active');
        if (active && active.id === 'panel-file') $('#b64Download1')?.click();
      }
    });
  }

  /* ============ THEME / LANG BUTTONS ============ */
  function initThemeLangButtons() {
    $('#b64ThemeToggle')?.addEventListener('click', () => {
      const order = ['auto', 'dark', 'light'];
      const idx = order.indexOf(state.theme);
      applyTheme(order[(idx + 1) % order.length]);
      toast('Tema: ' + state.theme, 'info');
    });
    $('#b64LangToggle')?.addEventListener('click', () => {
      const langs = ['id', 'en'];
      const idx = langs.indexOf(state.lang);
      applyLang(langs[(idx + 1) % langs.length]);
      toast('Bahasa: ' + state.lang.toUpperCase(), 'info');
    });
    $('#b64TourStart')?.addEventListener('click', () => {
      const steps = [
        '👋 Selamat datang di Base64 Pro v7 Quantum!',
        '📁 Tab File — konversi file/gambar/video ke Base64.',
        '🔤 Tab Teks — encode/decode + Base32/58/85/91/16 + JWT.',
        '🔗 Tab URL — fetch file dari internet.',
        '📷 Tab Kamera — jepret gambar langsung.',
        '🧪 Tab Advanced — AES-GCM, ECDSA, hash, steganografi.',
        '📱 Tab QR — generate & scan QR.',
        '🛠️ Tab Utility — 20+ tool praktis.',
        '📚 Tab Edukasi — belajar Base64.',
        '💾 Ctrl+K — Command palette!'
      ];
      let i = 0;
      const show = () => {
        if (i >= steps.length) return;
        toast(steps[i], 'info');
        i++;
        setTimeout(show, 1800);
      };
      show();
    });
  }

  /* ============ LOAD PERSISTED ============ */
  function loadPrefs() {
    try {
      const t = safeGet(KEYS.THEME); if (t) state.theme = t;
      const l = safeGet(KEYS.LANG); if (l) state.lang = l;
      const d = safeGet(KEYS.DEBUG); dbg.on = d === '1';
      if ($('#b64DebugToggle')) $('#b64DebugToggle').checked = dbg.on;
      if (safeGet(KEYS.HC) === '1' && $('#b64HighContrast')) { $('#b64HighContrast').checked = true; sec().classList.add('b64-hc'); }
      if (safeGet(KEYS.DYS) === '1' && $('#b64Dyslexia')) { $('#b64Dyslexia').checked = true; sec().classList.add('b64-dyslexia'); }
      if (safeGet(KEYS.MOTION) === '1' && $('#b64ReduceMotion')) { $('#b64ReduceMotion').checked = true; sec().classList.add('b64-reduce-motion'); }
      if (safeGet(KEYS.CLIP) === '1' && $('#b64ClearClipboard')) $('#b64ClearClipboard').checked = true;
      if (safeGet(KEYS.SANDBOX) === '1' && $('#b64SandboxPreview')) $('#b64SandboxPreview').checked = true;
      if (safeGet(KEYS.SOUND) === '1' && $('#b64SoundToggle')) { $('#b64SoundToggle').checked = true; SOUND.on = true; }
      if (safeGet(KEYS.HAPTIC) === '1' && $('#b64HapticToggle')) { $('#b64HapticToggle').checked = true; HAPTIC.on = true; }
      const f = parseInt(safeGet(KEYS.FONT) || '3', 10); if (f >= 1 && f <= 5) state.fontScale = f;
      const a = safeGet(KEYS.ACCENT); if (a) applyAccent(a);
      const lay = safeGet(KEYS.LAYOUT); if (lay) applyLayout(lay);
      // clipboard history
      try { state.clipHistory = JSON.parse(safeGet(KEYS.CLIPHIST) || '[]'); } catch (_) {}
    } catch (_) {}
  }

  /* ============ PANEL: FILE ============ */
  function initFilePanel() {
    const dz = $('#b64Dropzone'); if (!dz) return;
    const input = $('#b64FileInput');
    const loader = $('#b64Loader1');
    const fill = $('#b64ProgressFill1');
    const ptext = $('#b64ProgressText1');
    const output = $('#b64Output1');
    const preview = $('#b64Preview1');
    const info = $('#b64FileInfo1');
    const outText = $('#b64OutputText1');
    const tDataUrl = $('#b64DataUrl1');
    const tUrlSafe = $('#b64UrlSafe1');
    const tNoPad = $('#b64NoPad1');
    const tWrap = $('#b64Wrap1');
    const tComp = $('#b64Compress1');
    const tWorker = $('#b64UseWorker1');
    const stats = $('#b64Stats1');
    const batchBox = $('#b64Batch1');
    const batchList = $('#b64BatchList1');
    let startTime = 0;
    const MAX_SIZE = 25 * 1024 * 1024;

    function currentValue() {
      let val = tDataUrl.checked ? state.file2b64.dataUrl : state.file2b64.rawB64;
      if (!tDataUrl.checked) {
        if (tUrlSafe && tUrlSafe.checked) val = toUrlSafe(val);
        if (tNoPad && tNoPad.checked) val = stripPad(val);
      }
      if (tWrap && tWrap.checked) val = wrapMime(val);
      return val;
    }

    function compressImage(file, maxDim = 1920, quality = 0.85) {
      if (!file.type.startsWith('image/')) return Promise.resolve(file);
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') return Promise.resolve(file);
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          try {
            let { width: w, height: h } = img;
            if (w <= maxDim && h <= maxDim && file.size < 500 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
            const ratio = Math.min(maxDim / w, maxDim / h, 1);
            w = Math.round(w * ratio); h = Math.round(h * ratio);
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            c.toBlob((blob) => {
              URL.revokeObjectURL(url);
              if (!blob) return resolve(file);
              const outName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
              resolve(new File([blob], outName, { type: 'image/jpeg' }));
            }, 'image/jpeg', quality);
          } catch (_) { URL.revokeObjectURL(url); resolve(file); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      });
    }

    async function handleFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length || state.loading) { if (state.loading) toast('Sedang memproses...', 'warning'); return; }
      state.loading = true;
      state.batch = [];
      startTime = nowMs();
      loader.style.display = 'flex';
      output.style.display = 'none';
      fill.style.width = '0%'; ptext.textContent = '0%';

      try {
        let lastResult = null;
        for (let i = 0; i < files.length; i++) {
          let f = files[i];
          if (f.size > MAX_SIZE) { toast('Skip (>25 MB): ' + f.name, 'warning'); continue; }
          if (f.size === 0) { toast('Skip (kosong): ' + f.name, 'warning'); continue; }
          if (tComp && tComp.checked && f.type.startsWith('image/')) { try { f = await compressImage(f); } catch (_) {} }
          const buffer = await readFileAsArrayBuffer(f, (p) => {
            const overall = Math.round(((i + p / 100) / files.length) * 100);
            fill.style.width = overall + '%'; ptext.textContent = overall + '%';
          });
          const headBytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 32));
          let mime = detectMime(headBytes) || f.type || 'application/octet-stream';
          if ((!mime || mime === 'application/octet-stream') && /\.svg$/i.test(f.name)) mime = 'image/svg+xml';

          let b64;
          if (tWorker && tWorker.checked && buffer.byteLength > 2 * 1024 * 1024) {
            try { b64 = await workerEncode(buffer.slice(0)); } catch (_) { b64 = arrayBufferToBase64(buffer); }
          } else {
            b64 = arrayBufferToBase64(buffer);
          }
          const dataUrl = 'data:' + mime + ';base64,' + b64;
          const entry = { fileName: f.name || 'file', size: f.size, mime, rawB64: b64, dataUrl };
          state.batch.push(entry);
          lastResult = entry;
        }
        if (!lastResult) throw new Error('Tidak ada file yang diproses');
        state.file2b64 = Object.assign({}, lastResult);
        fill.style.width = '100%'; ptext.textContent = '100%';
        setTimeout(() => {
          loader.style.display = 'none';
          output.style.display = 'block';
          renderFile2B64();
          renderBatch();
          if (window.AOS && AOS.refresh) AOS.refresh();
        }, 250);
      } catch (err) {
        if (err && /aborted/i.test(err.message)) return;
        toast('Gagal: ' + (err.message || 'unknown'), 'error');
        loader.style.display = 'none';
      } finally { state.loading = false; }
    }

    function renderFile2B64() {
      const s = state.file2b64;
      if (!s.dataUrl) return;
      const value = currentValue();
      outText.value = value;
      const elapsed = Math.max(1, Math.round(nowMs() - startTime));
      renderPreview(preview, s.dataUrl);
      info.innerHTML =
        '<div class="b64-info-row"><i class="fas fa-file"></i><span><strong>Nama:</strong> ' + escapeHtml(s.fileName) + '</span></div>' +
        '<div class="b64-info-row"><i class="fas fa-microchip"></i><span><strong>MIME:</strong> ' + escapeHtml(s.mime) + '</span></div>' +
        '<div class="b64-info-row"><i class="fas fa-weight-hanging"></i><span><strong>Ukuran:</strong> ' + formatBytes(s.size) + '</span></div>';
      const overhead = s.size > 0 ? ((value.length - s.size) / s.size * 100).toFixed(1) : '0';
      stats.innerHTML =
        '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(value.length) + ' char</span>' +
        '<span class="b64-stat-chip"><i class="fas fa-weight-hanging"></i> ' + formatBytes(s.size) + '</span>' +
        '<span class="b64-stat-chip"><i class="fas fa-clock"></i> ' + elapsed + ' ms</span>' +
        '<span class="b64-stat-chip"><i class="fas fa-percent"></i> Overhead ' + overhead + '%</span>';
      recordStats(s.mime, s.size, elapsed);
    }

    function renderBatch() {
      if (!batchBox) return;
      if (state.batch.length <= 1) { batchBox.style.display = 'none'; return; }
      batchBox.style.display = 'block';
      batchList.innerHTML = '';
      state.batch.forEach((b, i) => {
        const li = document.createElement('li');
        const icon = document.createElement('i'); icon.className = 'fas fa-file';
        const span = document.createElement('span'); span.textContent = b.fileName + ' — ' + formatBytes(b.size);
        const btn = document.createElement('button'); btn.className = 'b64-btn'; btn.setAttribute('data-idx', i);
        btn.style.cssText = 'padding:4px 10px;font-size:.72rem;';
        btn.innerHTML = '<i class="fas fa-copy"></i>';
        li.appendChild(icon); li.appendChild(span); li.appendChild(btn);
        batchList.appendChild(li);
      });
      batchList.querySelectorAll('button[data-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          const b = state.batch[idx]; if (!b) return;
          copyText(tDataUrl.checked ? b.dataUrl : b.rawB64);
        });
      });
    }

    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) handleFiles(e.target.files);
      input.value = '';
    });
    ['dragenter','dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add('b64-dragover'); }));
    ['dragleave','drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ev === 'dragleave' && dz.contains(e.relatedTarget)) return;
      dz.classList.remove('b64-dragover');
    }));
    dz.addEventListener('drop', (e) => { const dt = e.dataTransfer; if (dt && dt.files && dt.files.length) handleFiles(dt.files); });
    window.addEventListener('dragover', (e) => { if (e.target && e.target.closest && !e.target.closest('#b64Dropzone')) e.preventDefault(); });
    window.addEventListener('drop', (e) => { if (e.target && e.target.closest && !e.target.closest('#b64Dropzone')) e.preventDefault(); });

    [tDataUrl, tUrlSafe, tNoPad, tWrap].forEach((t) => t && t.addEventListener('change', renderFile2B64));

    $('#b64Cancel1')?.addEventListener('click', () => { abortRead(); loader.style.display = 'none'; toast('Dibatalkan', 'info'); });
    $('#b64Copy1')?.addEventListener('click', () => copyText(outText.value, { autoClear: $('#b64ClearClipboard')?.checked }));
    $('#b64Download1')?.addEventListener('click', () => {
      if (!outText.value) { toast('Tidak ada output', 'warning'); return; }
      const base = (state.file2b64.fileName || 'output').replace(/\.[^/.]+$/, '');
      downloadText(base + '.base64.txt', outText.value);
      addHistory('file2b64', base, outText.value);
    });
    $('#b64Share1')?.addEventListener('click', () => { if (!outText.value) return; shareResult('Base64 File', outText.value); });
    $('#b64Print1')?.addEventListener('click', () => printResult('Base64 File', outText.value));
    $('#b64Hash1')?.addEventListener('click', async () => {
      if (!outText.value) { toast('Tidak ada output', 'warning'); return; }
      try {
        const h = await sha256Hex(new TextEncoder().encode(outText.value));
        toast('SHA-256: ' + h.slice(0, 24) + '…', 'info');
        copyText(h);
      } catch (err) { toast('Hash gagal: ' + err.message, 'error'); }
    });
    $('#b64Pin1')?.addEventListener('click', () => {
      if (!outText.value) { toast('Tidak ada output', 'warning'); return; }
      if (outText.hasAttribute('readonly')) {
        outText.removeAttribute('readonly');
        toast('Unlocked (bisa diedit)', 'info');
      } else {
        outText.setAttribute('readonly', '');
        toast('Pinned (read-only)', 'info');
      }
    });
    $('#b64Reset1')?.addEventListener('click', async () => {
      if (!(await confirmModal('Reset hasil konversi file?'))) return;
      abortRead();
      state.file2b64 = { dataUrl: '', rawB64: '', mime: '', fileName: '', size: 0 };
      state.batch = [];
      output.style.display = 'none';
      outText.value = '';
      if (input) input.value = '';
      toast('Reset berhasil', 'info');
    });
    $('#b64BatchDownload')?.addEventListener('click', () => {
      if (!state.batch.length) return;
      downloadBlob('batch-base64.json', new Blob([JSON.stringify(state.batch, null, 2)], { type: 'application/json' }));
    });
    $('#b64BatchCsv')?.addEventListener('click', () => {
      if (!state.batch.length) return;
      const header = 'fileName,size,mime,base64\n';
      const rows = state.batch.map((b) => '"' + b.fileName.replace(/"/g, '""') + '",' + b.size + ',"' + b.mime + '","' + b.rawB64 + '"').join('\n');
      downloadText('batch-base64.csv', header + rows);
    });
    /* v7-new: batch copy all */
    $('#b64BatchCopyAll')?.addEventListener('click', () => {
      if (!state.batch.length) return;
      const txt = state.batch.map((b) => b.fileName + '\n' + b.rawB64).join('\n\n');
      copyText(txt);
      toast('Semua ' + state.batch.length + ' item di-copy', 'success');
    });

    $('#b64SplitBtn')?.addEventListener('click', () => {
      if (!outText.value) { toast('Tidak ada output', 'warning'); return; }
      const n = Math.max(2, Math.min(100, parseInt($('#b64SplitN').value, 10) || 4));
      const chunk = Math.ceil(outText.value.length / n);
      const out = $('#b64SplitOut'); out.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const part = outText.value.slice(i * chunk, (i + 1) * chunk);
        if (!part) break;
        const div = document.createElement('div');
        div.className = 'b64-split-piece';
        const strong = document.createElement('strong'); strong.textContent = 'Part ' + (i + 1) + '/' + n + ' (' + part.length + '):';
        const span = document.createElement('span'); span.textContent = part;
        div.appendChild(strong); div.appendChild(span);
        out.appendChild(div);
      }
      toast('Split menjadi ' + n + ' bagian', 'success');
    });
  }

  /* ============ PANEL: TEXT ============ */
  function initTextPanels() {
    const encIn = $('#b64EncodeInput');
    const encOut = $('#b64EncodeOutput');
    const encStats = $('#b64EncodeStats');
    const tUrlSafe3 = $('#b64UrlSafe3');
    const tNoPad3   = $('#b64NoPad3');
    const tWrap3    = $('#b64Wrap3');

    function runEncode() {
      if (!encIn) return;
      const text = encIn.value;
      if (!text) { toast('Masukkan teks untuk di-encode', 'warning'); return; }
      try {
        const t0 = nowMs();
        let b64 = textToBase64(text);
        if (tUrlSafe3 && tUrlSafe3.checked) b64 = toUrlSafe(b64);
        if (tNoPad3   && tNoPad3.checked)   b64 = stripPad(b64);
        if (tWrap3    && tWrap3.checked)    b64 = wrapMime(b64);
        encOut.value = b64;
        const elapsed = Math.max(1, Math.round(nowMs() - t0));
        encStats.innerHTML =
          '<span class="b64-stat-chip"><i class="fas fa-font"></i> Input: ' + nf(text.length) + '</span>' +
          '<span class="b64-stat-chip"><i class="fas fa-code"></i> Output: ' + nf(b64.length) + '</span>' +
          '<span class="b64-stat-chip"><i class="fas fa-clock"></i> ' + elapsed + ' ms</span>';
        toast('Encode berhasil!', 'success');
        addHistory('encode', text.slice(0, 60) || '(teks kosong)', b64);
        recordStats('text-encode', text.length, elapsed);
      } catch (err) { toast('Gagal encode: ' + err.message, 'error'); }
    }
    $('#b64EncodeBtn')?.addEventListener('click', runEncode);
    $('#b64EncodePaste')?.addEventListener('click', async () => {
      try { encIn.value = await navigator.clipboard.readText(); toast('Pasted', 'success'); }
      catch (_) { toast('Gagal paste — paste manual', 'warning'); encIn.focus(); }
    });
    $('#b64EncodeVoice')?.addEventListener('click', () => { switchTab('a11y'); setTimeout(() => $('#b64VoiceStart')?.click(), 150); });
    $('#b64EncodeSwap')?.addEventListener('click', () => {
      const v = encOut.value.trim() || encIn.value.trim();
      if (!v) { toast('Tidak ada isi', 'warning'); return; }
      const dec = $('#b64DecodeInput'); if (dec) dec.value = v;
      const subt = $$('.b64-subtab').find((x) => x.getAttribute('data-sub') === 'decode'); subt?.click();
      toast('Dipindah ke Decode', 'info');
    });
    $('#b64EncodeReset')?.addEventListener('click', () => { encIn.value = ''; encOut.value = ''; encStats.innerHTML = ''; toast('Reset', 'info'); });
    $('#b64EncodeCopy')?.addEventListener('click', () => copyText(encOut.value));
    $('#b64EncodeDownload')?.addEventListener('click', () => { if (!encOut.value) return; downloadText('encoded-base64.txt', encOut.value); });
    $('#b64EncodeShare')?.addEventListener('click', () => shareResult('Base64 Encode', encOut.value));
    $('#b64EncodeQr')?.addEventListener('click', () => {
      if (!encOut.value) { toast('Tidak ada output untuk QR', 'warning'); return; }
      const qrText = $('#b64QrText'); if (qrText) qrText.value = encOut.value;
      switchTab('qr');
      setTimeout(() => $('#b64QrGen')?.click(), 120);
    });
    $('#b64EncodeEncrypt')?.addEventListener('click', () => {
      const aes = $('#b64AesIn'); if (aes) aes.value = encIn.value;
      switchTab('advanced');
    });
    $('#b64EncodeTts')?.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) { toast('TTS tidak didukung', 'warning'); return; }
      const u = new SpeechSynthesisUtterance(encIn.value.slice(0, 500));
      u.lang = state.lang === 'id' ? 'id-ID' : 'en-US';
      speechSynthesis.cancel(); speechSynthesis.speak(u);
      toast('Membacakan teks…', 'info');
    });
    [tUrlSafe3, tNoPad3, tWrap3].forEach((t) => t && t.addEventListener('change', () => { if (encOut.value) runEncode(); }));

    /* DECODE */
    const decIn = $('#b64DecodeInput');
    const decOut = $('#b64DecodeOutput');
    const decStats = $('#b64DecodeStats');

    function runDecode() {
      let raw = decIn.value.trim();
      if (!raw) { toast('Masukkan Base64 string', 'warning'); return; }
      try {
        const t0 = nowMs();
        const m = raw.match(/^data:[^;,]+(?:;[^;,]+)*;base64,([\s\S]*)$/);
        if (m) raw = m[1];
        raw = raw.replace(/\s+/g, '');
        if (!isValidBase64(raw)) throw new Error('Format Base64 tidak valid');
        const text = base64ToText(raw);
        decOut.value = text;
        const elapsed = Math.max(1, Math.round(nowMs() - t0));
        decStats.innerHTML =
          '<span class="b64-stat-chip"><i class="fas fa-code"></i> Input: ' + nf(raw.length) + '</span>' +
          '<span class="b64-stat-chip"><i class="fas fa-font"></i> Output: ' + nf(text.length) + '</span>' +
          '<span class="b64-stat-chip"><i class="fas fa-clock"></i> ' + elapsed + ' ms</span>';
        toast('Decode berhasil!', 'success');
        addHistory('decode', raw.slice(0, 60), text);
        recordStats('text-decode', text.length, elapsed);
      } catch (err) {
        decOut.value = '';
        toast('Gagal decode: ' + err.message, 'error');
      }
    }
    $('#b64DecodeBtn')?.addEventListener('click', runDecode);
    /* v7-new: auto-detect encoding */
    $('#b64DecodeAuto')?.addEventListener('click', () => {
      const v = decIn.value.trim();
      if (!v) { toast('Masukkan string', 'warning'); return; }
      const attempts = [
        { name: 'Base85', test: () => /^<~.*~>$/.test(v) || /[!#$%&()*+,./:;<=>?@[\]^_`{|}~"]/.test(v), fn: base85Decode },
        { name: 'Hex', test: () => /^[0-9A-Fa-f\s]+$/.test(v) && v.replace(/\s/g,'').length % 2 === 0, fn: hexToText },
        { name: 'Base32', test: () => /^[A-Z2-7=\s]+$/.test(v), fn: base32Decode },
        { name: 'Base91', test: () => /[!#$%&()*+,./:;<=>?@[\]^_`{|}~"]/.test(v), fn: base91Decode },
        { name: 'Base58', test: () => /^[1-9A-HJ-NP-Za-km-z]+$/.test(v), fn: base58Decode },
        { name: 'Base64', test: () => isValidBase64(v), fn: base64ToText }
      ];
      let decoded = null, used = '';
      for (const a of attempts) {
        try {
          if (!a.test()) continue;
          const r = a.fn(v);
          if (r && r.length > 0) { decoded = r; used = a.name; break; }
        } catch (_) {}
      }
      if (decoded) {
        decOut.value = decoded;
        decStats.innerHTML = '<span class="b64-stat-chip"><i class="fas fa-magic"></i> ' + used + '</span>';
        toast('Terdeteksi: ' + used, 'success');
      } else {
        toast('Auto-detect gagal', 'error');
      }
    });
    $('#b64DecodePaste')?.addEventListener('click', async () => { try { decIn.value = await navigator.clipboard.readText(); toast('Pasted', 'success'); } catch (_) { toast('Gagal paste', 'warning'); } });
    $('#b64DecodeSwap')?.addEventListener('click', () => {
      const v = decIn.value.trim() || decOut.value.trim();
      if (!v) { toast('Tidak ada isi', 'warning'); return; }
      const enc = $('#b64EncodeInput'); if (enc) enc.value = v;
      const subt = $$('.b64-subtab').find((x) => x.getAttribute('data-sub') === 'encode'); subt?.click();
      toast('Dipindah ke Encode', 'info');
    });
    $('#b64DecodeReset')?.addEventListener('click', () => { decIn.value = ''; decOut.value = ''; decStats.innerHTML = ''; toast('Reset', 'info'); });
    $('#b64DecodeCopy')?.addEventListener('click', () => copyText(decOut.value));
    $('#b64DecodeDownload')?.addEventListener('click', () => { if (!decOut.value) return; downloadText('decoded-text.txt', decOut.value); });
    $('#b64DecodeShare')?.addEventListener('click', () => shareResult('Decoded Text', decOut.value));

    /* BASE32 */
    $('#b64B32Enc')?.addEventListener('click', () => {
      const v = $('#b64B32In').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      try {
        const out = base32Encode(v);
        $('#b64B32Out').value = out;
        $('#b64B32Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-code"></i> ' + nf(out.length) + ' char</span>';
        toast('Base32 encoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B32Dec')?.addEventListener('click', () => {
      const v = $('#b64B32In').value.trim();
      if (!v) { toast('Masukkan Base32', 'warning'); return; }
      try {
        const out = base32Decode(v);
        $('#b64B32Out').value = out;
        $('#b64B32Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(out.length) + ' char</span>';
        toast('Base32 decoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B32Clr')?.addEventListener('click', () => { $('#b64B32In').value = ''; $('#b64B32Out').value = ''; $('#b64B32Stats').innerHTML = ''; });
    $('#b64B32Copy')?.addEventListener('click', () => copyText($('#b64B32Out').value));

    /* BASE85 */
    $('#b64B85Enc')?.addEventListener('click', () => {
      const v = $('#b64B85In').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      try {
        const out = base85Encode(v);
        $('#b64B85Out').value = out;
        $('#b64B85Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-code"></i> ' + nf(out.length) + ' char</span>';
        toast('Base85 encoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B85Dec')?.addEventListener('click', () => {
      const v = $('#b64B85In').value.trim();
      if (!v) { toast('Masukkan Base85', 'warning'); return; }
      try {
        const out = base85Decode(v);
        $('#b64B85Out').value = out;
        $('#b64B85Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(out.length) + ' char</span>';
        toast('Base85 decoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B85Clr')?.addEventListener('click', () => { $('#b64B85In').value = ''; $('#b64B85Out').value = ''; $('#b64B85Stats').innerHTML = ''; });
    $('#b64B85Copy')?.addEventListener('click', () => copyText($('#b64B85Out').value));

    /* v7-new: BASE91 */
    $('#b64B91Enc')?.addEventListener('click', () => {
      const v = $('#b64B91In').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      try {
        const out = base91Encode(v);
        $('#b64B91Out').value = out;
        $('#b64B91Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-code"></i> ' + nf(out.length) + ' char</span>';
        toast('Base91 encoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B91Dec')?.addEventListener('click', () => {
      const v = $('#b64B91In').value.trim();
      if (!v) { toast('Masukkan Base91', 'warning'); return; }
      try {
        const out = base91Decode(v);
        $('#b64B91Out').value = out;
        $('#b64B91Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(out.length) + ' char</span>';
        toast('Base91 decoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B91Clr')?.addEventListener('click', () => { $('#b64B91In').value = ''; $('#b64B91Out').value = ''; $('#b64B91Stats').innerHTML = ''; });
    $('#b64B91Copy')?.addEventListener('click', () => copyText($('#b64B91Out').value));

    /* v7-new: BASE58 */
    $('#b64B58Enc')?.addEventListener('click', () => {
      const v = $('#b64B58In').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      try {
        const out = base58Encode(v);
        $('#b64B58Out').value = out;
        $('#b64B58Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-code"></i> ' + nf(out.length) + ' char</span>';
        toast('Base58 encoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B58Dec')?.addEventListener('click', () => {
      const v = $('#b64B58In').value.trim();
      if (!v) { toast('Masukkan Base58', 'warning'); return; }
      try {
        const out = base58Decode(v);
        $('#b64B58Out').value = out;
        $('#b64B58Stats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(out.length) + ' char</span>';
        toast('Base58 decoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64B58Clr')?.addEventListener('click', () => { $('#b64B58In').value = ''; $('#b64B58Out').value = ''; $('#b64B58Stats').innerHTML = ''; });
    $('#b64B58Copy')?.addEventListener('click', () => copyText($('#b64B58Out').value));

    /* HEX */
    $('#b64HexEnc')?.addEventListener('click', () => {
      const v = $('#b64HexIn').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      const out = textToHex(v);
      $('#b64HexOut').value = out;
      $('#b64HexStats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-code"></i> ' + nf(out.length) + ' char</span>';
      toast('Hex encoded', 'success');
    });
    $('#b64HexDec')?.addEventListener('click', () => {
      const v = $('#b64HexIn').value;
      if (!v) { toast('Masukkan hex', 'warning'); return; }
      try {
        const out = hexToText(v);
        $('#b64HexOut').value = out;
        $('#b64HexStats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(out.length) + ' char</span>';
        toast('Hex decoded', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
    $('#b64HexClr')?.addEventListener('click', () => { $('#b64HexIn').value = ''; $('#b64HexOut').value = ''; $('#b64HexStats').innerHTML = ''; });
    $('#b64HexCopy')?.addEventListener('click', () => copyText($('#b64HexOut').value));

    /* JWT */
    $('#b64JwtDec')?.addEventListener('click', () => {
      const v = $('#b64JwtIn').value.trim();
      if (!v) { toast('Masukkan JWT', 'warning'); return; }
      const parts = v.split('.');
      if (parts.length < 2) { toast('Format JWT tidak valid', 'error'); return; }
      try {
        const header  = JSON.parse(base64ToText(parts[0]));
        const payload = JSON.parse(base64ToText(parts[1]));
        $('#b64JwtHeader').textContent  = JSON.stringify(header, null, 2);
        $('#b64JwtPayload').textContent = JSON.stringify(payload, null, 2);
        $('#b64JwtSig').textContent     = parts[2] || '(tidak ada)';
        toast('JWT didecode', 'success');
      } catch (err) { toast('JWT tidak valid: ' + err.message, 'error'); }
    });
    $('#b64JwtClr')?.addEventListener('click', () => {
      $('#b64JwtIn').value = '';
      $('#b64JwtHeader').textContent = '—'; $('#b64JwtPayload').textContent = '—'; $('#b64JwtSig').textContent = '—';
    });
  }

  /* ============ PANEL: URL ============ */
  function initUrlPanel() {
    const input = $('#b64UrlInput');
    if (!input) return;
    const controller = { c: null };
    async function fetchIt() {
      const url = input.value.trim();
      if (!url) { toast('Masukkan URL', 'warning'); return; }
      if (!/^https?:\/\//i.test(url)) { toast('URL harus http(s)://', 'error'); return; }
      if (state.loading) { toast('Sedang memproses', 'warning'); return; }
      state.loading = true;
      const loader = $('#b64LoaderUrl'), output = $('#b64OutputUrl');
      const status = $('#b64UrlStatus');
      loader.style.display = 'flex'; output.style.display = 'none';
      status.textContent = 'Menghubungi server...';
      controller.c = new AbortController();
      const timer = setTimeout(() => controller.c.abort(), 30000);
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.c.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        status.textContent = 'Mengunduh...';
        const blob = await res.blob();
        if (blob.size > 25 * 1024 * 1024) throw new Error('File > 25 MB');
        status.textContent = 'Encode Base64...';
        const buffer = await blob.arrayBuffer();
        const headBytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 32));
        const mime = detectMime(headBytes) || blob.type || 'application/octet-stream';
        const b64 = arrayBufferToBase64(buffer);
        const dataUrl = 'data:' + mime + ';base64,' + b64;
        const name = (url.split('/').pop() || 'file').split('?')[0] || 'file';
        $('#b64OutputUrlText').value = dataUrl;
        renderPreview($('#b64PreviewUrl'), dataUrl);
        $('#b64FileInfoUrl').innerHTML =
          '<div class="b64-info-row"><i class="fas fa-link"></i><span><strong>URL:</strong> ' + escapeHtml(url) + '</span></div>' +
          '<div class="b64-info-row"><i class="fas fa-microchip"></i><span><strong>MIME:</strong> ' + escapeHtml(mime) + '</span></div>' +
          '<div class="b64-info-row"><i class="fas fa-weight-hanging"></i><span><strong>Ukuran:</strong> ' + formatBytes(blob.size) + '</span></div>';
        $('#b64StatsUrl').innerHTML =
          '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(dataUrl.length) + ' char</span>' +
          '<span class="b64-stat-chip"><i class="fas fa-weight-hanging"></i> ' + formatBytes(blob.size) + '</span>';
        loader.style.display = 'none'; output.style.display = 'block';
        toast('Fetch berhasil!', 'success');
        addHistory('url', url, dataUrl.slice(0, 5000));
        state.file2b64 = { dataUrl, rawB64: b64, mime, fileName: name, size: blob.size };
        recordStats(mime, blob.size);
      } catch (err) {
        const msg = err.name === 'AbortError' ? 'Timeout 30 detik' : (err.message || 'CORS / network');
        toast('Fetch gagal: ' + msg, 'error');
        loader.style.display = 'none';
      } finally { state.loading = false; clearTimeout(timer); controller.c = null; }
    }
    $('#b64UrlFetch')?.addEventListener('click', fetchIt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchIt(); } });
    $('#b64UrlCorsTest')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) return;
      try { await fetch(url, { method: 'HEAD', mode: 'cors', credentials: 'omit' }); toast('CORS OK ✅', 'success'); }
      catch (err) { toast('CORS blokir / error: ' + err.message, 'error'); }
    });
    $('#b64UrlCopy')?.addEventListener('click', () => copyText($('#b64OutputUrlText').value));
    $('#b64UrlDownload')?.addEventListener('click', () => { if (!$('#b64OutputUrlText').value) return; downloadText('url-base64.txt', $('#b64OutputUrlText').value); });
    $('#b64UrlReset')?.addEventListener('click', () => {
      input.value = ''; $('#b64OutputUrlText').value = '';
      $('#b64OutputUrl').style.display = 'none';
      $('#b64PreviewUrl').innerHTML = ''; $('#b64FileInfoUrl').innerHTML = ''; $('#b64StatsUrl').innerHTML = '';
      toast('Reset', 'info');
    });
  }

  /* ============ PANEL: KAMERA ============ */
  function initCamera() {
    const video = $('#b64CamPreview'); if (!video) return;
    const canvas = $('#b64CamCanvas');
    const startBtn = $('#b64CamStart'), snapBtn = $('#b64CamSnap'), switchBtn = $('#b64CamSwitch'), stopBtn = $('#b64CamStop');
    const wrap = video.closest('.b64-camera-wrap');

    async function start() {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: state.camera.facing, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        state.camera.stream = stream;
        video.srcObject = stream;
        await video.play().catch(() => {});
        wrap?.classList.add('b64-cam-on');
        snapBtn.disabled = false; switchBtn.disabled = false; stopBtn.disabled = false;
        toast('Kamera aktif', 'success');
      } catch (err) { toast('Kamera gagal: ' + (err.message || 'permission?'), 'error'); }
    }
    function stop() {
      if (state.camera.stream) state.camera.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      state.camera.stream = null;
      if (video) video.srcObject = null;
      wrap?.classList.remove('b64-cam-on');
      if (snapBtn) snapBtn.disabled = true;
      if (switchBtn) switchBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = true;
    }
    function snap() {
      if (!state.camera.stream) { toast('Kamera belum aktif', 'warning'); return; }
      const w = video.videoWidth || 1280, h = video.videoHeight || 720;
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const b64 = dataUrl.split(',')[1];
      $('#b64CamOutputText').value = dataUrl;
      renderPreview($('#b64CamResult'), dataUrl);
      $('#b64CamInfo').innerHTML =
        '<div class="b64-info-row"><i class="fas fa-camera"></i><span><strong>Sumber:</strong> Kamera</span></div>' +
        '<div class="b64-info-row"><i class="fas fa-microchip"></i><span><strong>MIME:</strong> image/jpeg</span></div>' +
        '<div class="b64-info-row"><i class="fas fa-ruler-combined"></i><span><strong>Resolusi:</strong> ' + w + '×' + h + '</span></div>';
      $('#b64CamStats').innerHTML =
        '<span class="b64-stat-chip"><i class="fas fa-font"></i> ' + nf(dataUrl.length) + ' char</span>' +
        '<span class="b64-stat-chip"><i class="fas fa-code"></i> raw B64: ' + nf(b64.length) + '</span>';
      $('#b64OutputCam').style.display = 'block';
      state.file2b64 = { dataUrl, rawB64: b64, mime: 'image/jpeg', fileName: 'camera-' + Date.now() + '.jpg', size: Math.round(b64.length * 0.75) };
      toast('Jepret berhasil!', 'success');
      addHistory('camera', 'camera.jpg', dataUrl.slice(0, 5000));
      recordStats('image/jpeg', Math.round(b64.length * 0.75));
    }
    startBtn?.addEventListener('click', start);
    snapBtn?.addEventListener('click', snap);
    switchBtn?.addEventListener('click', () => { state.camera.facing = state.camera.facing === 'environment' ? 'user' : 'environment'; start(); });
    stopBtn?.addEventListener('click', () => { stop(); toast('Kamera dimatikan', 'info'); });
    $('#b64CamCopy')?.addEventListener('click', () => copyText($('#b64CamOutputText').value));
    $('#b64CamDownload')?.addEventListener('click', () => { if (!$('#b64CamOutputText').value) return; downloadText('camera-base64.txt', $('#b64CamOutputText').value); });
    $('#b64CamReset')?.addEventListener('click', () => {
      $('#b64CamOutputText').value = ''; $('#b64OutputCam').style.display = 'none';
      $('#b64CamResult').innerHTML = ''; $('#b64CamInfo').innerHTML = ''; $('#b64CamStats').innerHTML = '';
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('beforeunload', stop);
  }

  /* ============ PANEL: ADVANCED ============ */
  function initAdvanced() {
    /* AES-GCM (v7-fix: hapus dead code v6.2) */
    async function getKey(pass) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']);
      const salt = enc.encode('irgxy-b64-v7-salt');
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    }
    async function aesEncrypt() {
      const pass = $('#b64AesPass').value;
      const text = $('#b64AesIn').value;
      if (!pass || !text) { toast('Password & teks wajib', 'warning'); return; }
      try {
        const t0 = nowMs();
        const key = await getKey(pass);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
        const combined = new Uint8Array(iv.length + ct.byteLength);
        combined.set(iv); combined.set(new Uint8Array(ct), iv.length);
        const b64 = arrayBufferToBase64(combined.buffer);
        $('#b64AesOut').value = b64;
        $('#b64AesStats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-shield"></i> AES-GCM 256</span><span class="b64-stat-chip"><i class="fas fa-clock"></i> ' + Math.round(nowMs() - t0) + ' ms</span>';
        toast('Encrypt berhasil!', 'success');
      } catch (err) { toast('Encrypt gagal: ' + err.message, 'error'); }
    }
    async function aesDecrypt() {
      const pass = $('#b64AesPass').value;
      const b64 = $('#b64AesIn').value.trim();
      if (!pass || !b64) { toast('Password & Base64 wajib', 'warning'); return; }
      try {
        const key = await getKey(pass);
        const bin = atob(normalizeBase64(b64));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const iv = bytes.slice(0, 12);
        const ct = bytes.slice(12);
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        $('#b64AesOut').value = new TextDecoder().decode(pt);
        $('#b64AesStats').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-unlock"></i> Decrypt OK</span>';
        toast('Decrypt berhasil!', 'success');
      } catch (err) { toast('Decrypt gagal (password salah?): ' + err.message, 'error'); }
    }
    $('#b64AesEnc')?.addEventListener('click', aesEncrypt);
    $('#b64AesDec')?.addEventListener('click', aesDecrypt);

    /* Join */
    $('#b64JoinBtn')?.addEventListener('click', () => {
      const v = $('#b64JoinIn').value.trim();
      if (!v) { toast('Masukkan potongan', 'warning'); return; }
      try {
        let parts;
        if (v.startsWith('[')) parts = JSON.parse(v);
        else parts = v.split('\n').map((s) => s.trim()).filter(Boolean);
        const joined = parts.join('');
        $('#b64JoinOut').value = joined;
        toast('Join ' + parts.length + ' bagian', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });

    /* Hash */
    async function hashAlgo(algo) {
      const v = $('#b64HashIn').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      try {
        const buf = new TextEncoder().encode(v);
        const h = await crypto.subtle.digest(algo, buf);
        const hex = Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
        $('#b64HashOut').value = hex;
        $('#b64HashStats').innerHTML = '<span class="b64-stat-chip">' + algo + '</span><span class="b64-stat-chip">' + hex.length * 4 + ' bit</span>';
        toast(algo + ' OK', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    }
    $('#b64HashSha256')?.addEventListener('click', () => hashAlgo('SHA-256'));
    $('#b64HashSha1')?.addEventListener('click', () => hashAlgo('SHA-1'));
    $('#b64HashSha512')?.addEventListener('click', () => hashAlgo('SHA-512'));
    $('#b64HashMd5')?.addEventListener('click', () => {
      const v = $('#b64HashIn').value;
      if (!v) { toast('Masukkan teks', 'warning'); return; }
      try {
        const h = md5(v);
        $('#b64HashOut').value = h;
        $('#b64HashStats').innerHTML = '<span class="b64-stat-chip">MD5</span><span class="b64-stat-chip">128 bit</span>';
        toast('MD5 OK', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });

    /* Diff */
    $('#b64DiffBtn')?.addEventListener('click', () => {
      const a = $('#b64DiffA').value.trim(), b = $('#b64DiffB').value.trim();
      if (!a || !b) { toast('Isi kedua kolom', 'warning'); return; }
      const same = a === b;
      let firstDiff = -1;
      for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] !== b[i]) { firstDiff = i; break; } }
      $('#b64DiffStats').innerHTML =
        '<span class="b64-stat-chip">' + (same ? '✅ Identik' : '❌ Beda') + '</span>' +
        '<span class="b64-stat-chip">Len A: ' + nf(a.length) + '</span>' +
        '<span class="b64-stat-chip">Len B: ' + nf(b.length) + '</span>' +
        (firstDiff !== -1 ? '<span class="b64-stat-chip">First diff @ ' + firstDiff + '</span>' : '');
    });

    /* v7-new: ECDSA Sign / Verify */
    $('#b64SignKeygen')?.addEventListener('click', async () => {
      try {
        const kp = await crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
        );
        state.codeKeypair = kp;
        const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
        $('#b64SignKey').value = JSON.stringify(pub, null, 2);
        toast('Keypair dibuat', 'success');
      } catch (err) { toast('Gagal keygen: ' + err.message, 'error'); }
    });
    $('#b64SignBtn')?.addEventListener('click', async () => {
      if (!state.codeKeypair) { toast('Generate key dulu', 'warning'); return; }
      const txt = $('#b64SignIn').value;
      if (!txt) { toast('Isi teks', 'warning'); return; }
      try {
        const sig = await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          state.codeKeypair.privateKey,
          new TextEncoder().encode(txt)
        );
        const b64 = arrayBufferToBase64(sig);
        $('#b64SignOut').value = b64;
        $('#b64SignStats').innerHTML = '<span class="b64-stat-chip">✅ Signed</span>';
        toast('Sign berhasil', 'success');
      } catch (err) { toast('Sign gagal: ' + err.message, 'error'); }
    });
    $('#b64VerifyBtn')?.addEventListener('click', async () => {
      const txt = $('#b64SignIn').value;
      const sig = $('#b64SignOut').value.trim();
      const pubKeyJson = $('#b64SignKey').value.trim();
      if (!txt || !sig || !pubKeyJson) { toast('Teks + signature + public key wajib', 'warning'); return; }
      try {
        const jwk = JSON.parse(pubKeyJson);
        const pubKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
        const sigBuf = base64ToBlob(sig, 'application/octet-stream').arrayBuffer ? null : null;
        const bin = atob(normalizeBase64(sig));
        const sigBytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) sigBytes[i] = bin.charCodeAt(i);
        const ok = await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          pubKey,
          sigBytes,
          new TextEncoder().encode(txt)
        );
        $('#b64SignStats').innerHTML = '<span class="b64-stat-chip">' + (ok ? '✅ Valid' : '❌ Invalid') + '</span>';
        toast(ok ? 'Signature valid ✅' : 'Signature invalid ❌', ok ? 'success' : 'error');
      } catch (err) { toast('Verify gagal: ' + err.message, 'error'); }
    });

    /* Steganografi LSB (v7-merge: pakai v6.2 R-channel) */
    let stegImageData = null, stegCanvas = null;
    $('#b64StegImage')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        stegCanvas = document.createElement('canvas');
        stegCanvas.width = img.width; stegCanvas.height = img.height;
        const ctx = stegCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        stegImageData = ctx.getImageData(0, 0, stegCanvas.width, stegCanvas.height);
        renderPreview($('#b64StegPreview'), stegCanvas.toDataURL('image/png'));
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    });
    $('#b64StegEmbed')?.addEventListener('click', () => {
      if (!stegImageData || !stegCanvas) { toast('Pilih gambar PNG/BMP dulu', 'warning'); return; }
      const msg = $('#b64StegMsg').value;
      if (!msg) { toast('Pesan kosong', 'warning'); return; }
      const bytes = new TextEncoder().encode(msg);
      const needed = (bytes.length + 4) * 8;
      const data = stegImageData.data;
      if (needed > data.length) { toast('Gambar terlalu kecil untuk pesan', 'error'); return; }
      const lenBuf = new Uint8Array(4); new DataView(lenBuf.buffer).setUint32(0, bytes.length);
      const payload = new Uint8Array(4 + bytes.length);
      payload.set(lenBuf); payload.set(bytes, 4);
      let bitIdx = 0;
      for (let i = 0; i < payload.length; i++) {
        for (let b = 0; b < 8; b++) {
          const bit = (payload[i] >> (7 - b)) & 1;
          data[bitIdx * 4] = (data[bitIdx * 4] & 0xFE) | bit;
          bitIdx++;
        }
      }
      const ctx = stegCanvas.getContext('2d');
      ctx.putImageData(stegImageData, 0, 0);
      const out = stegCanvas.toDataURL('image/png');
      renderPreview($('#b64StegPreview'), out);
      $('#b64StegStats').innerHTML = '<span class="b64-stat-chip">✅ Embed ' + bytes.length + ' bytes</span>';
      toast('Embed berhasil!', 'success');
    });
    $('#b64StegExtract')?.addEventListener('click', () => {
      if (!stegImageData) { toast('Pilih gambar dulu', 'warning'); return; }
      const data = stegImageData.data;
      const read = (from) => {
        let v = 0;
        for (let b = 0; b < 8; b++) v = (v << 1) | (data[(from + b) * 4] & 1);
        return v;
      };
      let p = 0;
      const lenBytes = [];
      for (let i = 0; i < 4; i++) { lenBytes.push(read(p)); p += 8; }
      const msgLen = (lenBytes[0] << 24) | (lenBytes[1] << 16) | (lenBytes[2] << 8) | lenBytes[3];
      if (msgLen <= 0 || msgLen > 100000) { toast('Tidak ada pesan terdeteksi', 'warning'); return; }
      const out = new Uint8Array(msgLen);
      for (let i = 0; i < msgLen; i++) out[i] = read(p + i * 8);
      try {
        const msg = new TextDecoder().decode(out);
        $('#b64StegMsg').value = msg;
        $('#b64StegStats').innerHTML = '<span class="b64-stat-chip">✅ Extract ' + msgLen + ' bytes</span>';
        toast('Extract berhasil!', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });

    /* Resize + Watermark */
    let rwImage = null;
    $('#b64RwFile')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => { rwImage = img; toast('Gambar siap', 'success'); URL.revokeObjectURL(url); };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    });
    $('#b64RwApply')?.addEventListener('click', () => {
      if (!rwImage) { toast('Pilih gambar dulu', 'warning'); return; }
      const w = parseInt($('#b64RwWidth').value, 10) || rwImage.naturalWidth;
      const h = parseInt($('#b64RwHeight').value, 10) || rwImage.naturalHeight;
      const text = $('#b64RwText').value;
      const opacity = parseInt($('#b64RwOpacity').value, 10) / 100;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(rwImage, 0, 0, w, h);
      if (text) {
        ctx.font = Math.max(14, Math.floor(w / 20)) + 'px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,' + opacity + ')';
        ctx.strokeStyle = 'rgba(0,0,0,' + opacity + ')';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.strokeText(text, w / 2, h - 20);
        ctx.fillText(text, w / 2, h - 20);
      }
      renderPreview($('#b64RwPreview'), canvas.toDataURL('image/jpeg', 0.9));
      toast('Apply berhasil!', 'success');
    });

    /* v7-new: EXIF reader (JPEG baseline) */
    $('#b64ExifRead')?.addEventListener('click', async () => {
      const f = $('#b64ExifFile').files && $('#b64ExifFile').files[0];
      if (!f) { toast('Pilih JPEG', 'warning'); return; }
      const out = $('#b64ExifOut');
      out.textContent = 'Membaca...';
      try {
        const buf = await f.arrayBuffer();
        const view = new DataView(buf);
        if (view.getUint16(0) !== 0xFFD8) throw new Error('Bukan JPEG');
        let offset = 2;
        const tags = { 0x011A: 'XResolution', 0x011B: 'YResolution', 0x0132: 'DateTime', 0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation' };
        const info = {};
        while (offset < view.byteLength - 4) {
          const marker = view.getUint16(offset);
          if ((marker & 0xFF00) !== 0xFF00) { offset++; continue; }
          const len = view.getUint16(offset + 2);
          if (marker === 0xFFE1 && offset + 4 + 6 < view.byteLength) {
            info['APP1 (EXIF) segment'] = 'ditemukan, ' + len + ' bytes';
            break;
          }
          offset += 2 + len;
        }
        info['File'] = f.name;
        info['Ukuran'] = formatBytes(f.size);
        info['Note'] = 'Parser EXIF lengkap memerlukan lib exif-js. Minimal info ditampilkan.';
        out.textContent = Object.entries(info).map(([k, v]) => k + ': ' + v).join('\n');
        toast('EXIF dibaca (parsial)', 'info');
      } catch (err) { out.textContent = 'Gagal: ' + err.message; }
    });
  }

  /* ============ PANEL: QR ============ */
  function initQr() {
    const qrText = $('#b64QrText'), qrCanvas = $('#b64QrCanvas'), dlBtn = $('#b64QrDownload');
    function generate() {
      if (!qrText || !qrCanvas) return;
      const txt = qrText.value.trim();
      if (!txt) { toast('Masukkan teks untuk QR', 'warning'); return; }
      if (typeof window.QRCode === 'undefined') { toast('Library QR belum termuat', 'error'); return; }
      try {
        window.QRCode.toCanvas(qrCanvas, txt, { width: 256, margin: 2, color: { dark: '#0f0f1a', light: '#ffffff' } }, (err) => {
          if (err) { toast('Gagal: ' + err.message, 'error'); return; }
          if (dlBtn) dlBtn.disabled = false;
          toast('QR siap!', 'success');
        });
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    }
    $('#b64QrGen')?.addEventListener('click', generate);
    dlBtn?.addEventListener('click', () => {
      if (typeof window.QRCode === 'undefined') return;
      const txt = qrText.value.trim(); if (!txt) return;
      window.QRCode.toDataURL(txt, { width: 512, margin: 2, color: { dark: '#0f0f1a', light: '#ffffff' } }, (err, url) => {
        if (err) { toast('Gagal: ' + err.message, 'error'); return; }
        const a = document.createElement('a'); a.href = url; a.download = 'qr-code.png';
        document.body.appendChild(a); a.click(); a.remove();
        toast('QR di-download', 'success');
      });
    });
    $('#b64QrClear')?.addEventListener('click', () => {
      if (qrText) qrText.value = '';
      if (qrCanvas) { const ctx = qrCanvas.getContext('2d'); ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height); }
      if (dlBtn) dlBtn.disabled = true;
      toast('Cleared', 'info');
    });

    const scanInput = $('#b64QrScanInput'), scanResult = $('#b64QrScanResult'), scanCanvas = $('#b64QrScanCanvas');

    async function scanFile(file) {
      if (!file) { toast('Pilih gambar', 'warning'); return; }
      if (typeof window.jsQR === 'undefined') { toast('Library jsQR belum termuat', 'error'); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          scanCanvas.width = w; scanCanvas.height = h;
          const ctx = scanCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          const code = window.jsQR(data.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            scanResult.textContent = '';
            const strong = document.createElement('strong'); strong.style.color = 'var(--b64-gold-light)'; strong.textContent = 'Hasil:';
            scanResult.appendChild(strong); scanResult.appendChild(document.createElement('br'));
            scanResult.appendChild(document.createTextNode(code.data));
            copyText(code.data);
            toast('QR terbaca & di-copy!', 'success');
            addHistory('qr-scan', 'qr result', code.data);
          } else {
            scanResult.textContent = 'QR tidak terdeteksi. Coba gambar lebih jelas.';
            toast('QR tidak terdeteksi', 'warning');
          }
        } catch (err) { toast('Scan error: ' + err.message, 'error'); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Gagal load gambar', 'error'); };
      img.src = url;
    }
    $('#b64QrScanBtn')?.addEventListener('click', () => {
      const f = scanInput.files && scanInput.files[0];
      scanFile(f);
    });
    $('#b64QrScanToEncode')?.addEventListener('click', () => {
      const txt = scanResult.textContent.replace(/^Hasil:\s*/, '').trim();
      if (!txt) { toast('Belum ada hasil scan', 'warning'); return; }
      const enc = $('#b64EncodeInput'); if (enc) enc.value = txt;
      switchTab('text');
      const subt = $$('.b64-subtab').find((x) => x.getAttribute('data-sub') === 'encode'); subt?.click();
      toast('Dikirim ke Encode', 'success');
    });
    $('#b64QrScanClear')?.addEventListener('click', () => { if (scanInput) scanInput.value = ''; if (scanResult) scanResult.textContent = ''; toast('Cleared', 'info'); });
  }

  /* ============ PANEL: UTILITY ============ */
  function initUtility() {
    /* URL encode/decode */
    $('#b64UrlEncBtn')?.addEventListener('click', () => { $('#b64UrlEncOut').value = encodeURIComponent($('#b64UrlEncIn').value); toast('Encoded', 'success'); });
    $('#b64UrlDecBtn')?.addEventListener('click', () => { try { $('#b64UrlEncOut').value = decodeURIComponent($('#b64UrlEncIn').value); toast('Decoded', 'success'); } catch (e) { toast('Gagal: ' + e.message, 'error'); } });

    /* Binary */
    $('#b64BinEnc')?.addEventListener('click', () => {
      const v = $('#b64BinIn').value;
      const bytes = new TextEncoder().encode(v);
      $('#b64BinOut').value = Array.from(bytes).map((b) => b.toString(2).padStart(8, '0')).join(' ');
      toast('Bin encoded', 'success');
    });
    $('#b64BinDec')?.addEventListener('click', () => {
      const v = $('#b64BinIn').value.replace(/\s+/g, '');
      if (v.length % 8 !== 0) { toast('Panjang biner invalid', 'error'); return; }
      const bytes = new Uint8Array(v.length / 8);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(v.substr(i * 8, 8), 2);
      $('#b64BinOut').value = new TextDecoder().decode(bytes);
      toast('Bin decoded', 'success');
    });

    /* HTML entity */
    $('#b64HtmlEnc')?.addEventListener('click', () => { $('#b64HtmlOut').value = escapeHtml($('#b64HtmlIn').value); toast('Encoded', 'success'); });
    $('#b64HtmlDec')?.addEventListener('click', () => {
      const tmp = document.createElement('textarea');
      tmp.innerHTML = $('#b64HtmlIn').value;
      $('#b64HtmlOut').value = tmp.value;
      toast('Decoded', 'success');
    });

    /* ROT */
    $('#b64RotBtn')?.addEventListener('click', () => {
      const n = parseInt($('#b64RotN').value, 10) || 13;
      const v = $('#b64RotIn').value;
      $('#b64RotOut').value = v.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + n) % 26) + base);
      });
      toast('ROT' + n + ' diterapkan', 'success');
    });

    /* UUID */
    $('#b64UuidGen')?.addEventListener('click', () => {
      const n = Math.max(1, Math.min(100, parseInt($('#b64UuidN').value, 10) || 5));
      const list = [];
      for (let i = 0; i < n; i++) list.push(crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
      $('#b64UuidOut').value = list.join('\n');
      toast(n + ' UUID dibuat', 'success');
    });

    /* Timestamp */
    $('#b64TsConv')?.addEventListener('click', () => {
      const v = $('#b64TsIn').value.trim(); if (!v) return;
      try {
        let d;
        if (/^\d+$/.test(v)) d = new Date(parseInt(v, 10) * 1000);
        else d = new Date(v);
        if (isNaN(d.getTime())) throw new Error('Invalid');
        $('#b64TsOut').value = 'ISO: ' + d.toISOString() + '\nUnix: ' + Math.floor(d.getTime() / 1000) + '\nLocal: ' + d.toLocaleString('id-ID');
        toast('Converted', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64TsNow')?.addEventListener('click', () => { $('#b64TsIn').value = Math.floor(Date.now() / 1000); $('#b64TsConv').click(); });

    /* Color */
    $('#b64ColorBtn')?.addEventListener('click', () => {
      const c = $('#b64ColorIn').value;
      const b64 = textToBase64(c);
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
      const rgb = m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : '—';
      $('#b64ColorOut').value = 'Hex: ' + c + '\nBase64: ' + b64 + '\nRGB: ' + rgb;
      toast('Converted', 'success');
    });

    /* Lorem */
    $('#b64LoremGen')?.addEventListener('click', () => {
      const n = Math.max(1, Math.min(50, parseInt($('#b64LoremN').value, 10) || 3));
      const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore'.split(' ');
      const paras = [];
      for (let p = 0; p < n; p++) {
        const len = 40 + Math.floor(Math.random() * 40);
        const arr = [];
        for (let i = 0; i < len; i++) arr.push(words[Math.floor(Math.random() * words.length)]);
        arr[0] = arr[0][0].toUpperCase() + arr[0].slice(1);
        paras.push(arr.join(' ') + '.');
      }
      $('#b64LoremOut').value = paras.join('\n\n');
      toast(n + ' paragraf dibuat', 'success');
    });

    /* Case */
    $$('[data-case]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = $('#b64CaseIn').value;
        const mode = btn.getAttribute('data-case');
        let out = v;
        if (mode === 'upper') out = v.toUpperCase();
        else if (mode === 'lower') out = v.toLowerCase();
        else if (mode === 'title') out = v.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
        else if (mode === 'camel') out = v.toLowerCase().replace(/[^a-z0-9]+(.)/g, (m, c) => c.toUpperCase());
        $('#b64CaseOut').value = out;
      });
    });

    /* Regex */
    $('#b64RegexRun')?.addEventListener('click', () => {
      const pat = $('#b64RegexPattern').value, flags = $('#b64RegexFlags').value || 'g', input = $('#b64RegexInput').value;
      try {
        const re = new RegExp(pat, flags);
        const matches = input.match(re);
        $('#b64RegexStats').innerHTML = '<span class="b64-stat-chip">Match: ' + (matches ? matches.length : 0) + '</span>';
      } catch (e) { toast('Regex error: ' + e.message, 'error'); }
    });

    /* JSON */
    $('#b64JsonFormat')?.addEventListener('click', () => {
      try { $('#b64JsonOut').value = JSON.stringify(JSON.parse($('#b64JsonIn').value), null, 2); toast('Formatted', 'success'); }
      catch (e) { toast('JSON invalid: ' + e.message, 'error'); }
    });
    $('#b64JsonMinify')?.addEventListener('click', () => {
      try { $('#b64JsonOut').value = JSON.stringify(JSON.parse($('#b64JsonIn').value)); toast('Minified', 'success'); }
      catch (e) { toast('JSON invalid: ' + e.message, 'error'); }
    });
    $('#b64JsonB64')?.addEventListener('click', () => {
      try {
        const obj = JSON.parse($('#b64JsonIn').value);
        $('#b64JsonOut').value = textToBase64(JSON.stringify(obj));
        toast('Base64 created', 'success');
      } catch (e) { toast('JSON invalid: ' + e.message, 'error'); }
    });

    /* Cron */
    $('#b64CronParse')?.addEventListener('click', () => {
      const v = $('#b64CronIn').value.trim();
      const parts = v.split(/\s+/);
      if (parts.length < 5) { toast('Cron minimal 5 field', 'error'); return; }
      const fields = ['Menit','Jam','Hari/Bulan','Bulan','Hari/Minggu'];
      const out = parts.slice(0, 5).map((p, i) => fields[i] + ': ' + p).join(' | ');
      $('#b64CronOut').innerHTML = '<span class="b64-stat-chip">' + escapeHtml(out) + '</span>';
      toast('Parsed', 'success');
    });

    /* v7-new: Unicode inspector */
    $('#b64UniBtn')?.addEventListener('click', () => {
      const v = $('#b64UniIn').value;
      const out = $('#b64UniOut');
      if (!v) { out.textContent = '—'; return; }
      const lines = [];
      let i = 0;
      const arr = Array.from(v);
      for (const ch of arr) {
        const cp = ch.codePointAt(0);
        lines.push(
          '[' + i + '] ' + JSON.stringify(ch) + '  U+' + cp.toString(16).toUpperCase().padStart(4, '0') +
          '  Dec:' + cp + '  Bytes:' + new TextEncoder().encode(ch).length
        );
        i++;
      }
      out.textContent = lines.slice(0, 100).join('\n') + (arr.length > 100 ? '\n... (+' + (arr.length - 100) + ')' : '');
      toast('Inspect: ' + arr.length + ' chars', 'info');
    });

    /* v7-new: Text diff */
    $('#b64TdiffBtn')?.addEventListener('click', () => {
      const a = $('#b64TdiffA').value, b = $('#b64TdiffB').value;
      const out = $('#b64TdiffOut');
      if (!a && !b) { out.textContent = '—'; return; }
      const maxLen = Math.max(a.length, b.length);
      const lines = [];
      for (let i = 0; i < Math.min(maxLen, 500); i++) {
        if (a[i] !== b[i]) {
          lines.push('@' + i + ' A="' + (a[i] === undefined ? '∅' : a[i]) + '" B="' + (b[i] === undefined ? '∅' : b[i]) + '"');
        }
      }
      out.textContent = lines.length ? lines.join('\n') : '✅ Identik';
      toast(lines.length + ' perbedaan', 'info');
    });

    /* v7-new: CSV ↔ JSON */
    $('#b64CsvToJson')?.addEventListener('click', () => {
      try {
        const lines = $('#b64CsvIn').value.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error('Minimal 1 header + 1 baris');
        const headers = lines[0].split(',').map((s) => s.trim());
        const rows = lines.slice(1).map((l) => {
          const vals = l.split(',').map((s) => s.trim());
          const o = {};
          headers.forEach((h, i) => { o[h] = vals[i] || ''; });
          return o;
        });
        $('#b64CsvOut').value = JSON.stringify(rows, null, 2);
        toast('CSV→JSON OK', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64JsonToCsv')?.addEventListener('click', () => {
      try {
        const arr = JSON.parse($('#b64CsvIn').value);
        if (!Array.isArray(arr) || !arr.length) throw new Error('Harus array of objects');
        const headers = Object.keys(arr[0]);
        const lines = [headers.join(',')];
        for (const row of arr) lines.push(headers.map((h) => '"' + String(row[h] ?? '').replace(/"/g, '""') + '"').join(','));
        $('#b64CsvOut').value = lines.join('\n');
        toast('JSON→CSV OK', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });

    /* v7-new: Markdown preview */
    $('#b64MdBtn')?.addEventListener('click', () => {
      const md = $('#b64MdIn').value;
      const out = $('#b64MdOut');
      const safe = escapeHtml(md);
      const html = safe
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, '<br>');
      out.innerHTML = html;
      toast('Preview OK', 'success');
    });

    /* v7-new: Text stats */
    $('#b64TstatsBtn')?.addEventListener('click', () => {
      const v = $('#b64TstatsIn').value;
      const chars = v.length;
      const words = v.trim() ? v.trim().split(/\s+/).length : 0;
      const lines = v.split('\n').length;
      const bytes = new TextEncoder().encode(v).length;
      const sentences = (v.match(/[.!?]+/g) || []).length || 0;
      $('#b64TstatsOut').textContent =
        'Characters: ' + nf(chars) + '\n' +
        'Words: ' + nf(words) + '\n' +
        'Lines: ' + nf(lines) + '\n' +
        'Sentences: ' + nf(sentences) + '\n' +
        'UTF-8 Bytes: ' + nf(bytes) + '\n' +
        'Base64 length: ~' + nf(Math.ceil(bytes / 3) * 4);
    });

    /* v7-new: Clipboard history */
    $('#b64ClipClear')?.addEventListener('click', () => {
      state.clipHistory = [];
      safeSet(KEYS.CLIPHIST, '[]');
      renderClipHistory();
      toast('Clipboard history cleared', 'info');
    });
  }

  /* ============ PANEL: SHARE ============ */
  function initShare() {
    $('#b64ShareUrlGen')?.addEventListener('click', () => {
      const v = $('#b64ShareText').value;
      if (!v) { toast('Kosong', 'warning'); return; }
      try {
        const encoded = textToBase64(v);
        const link = location.origin + location.pathname + '#data=' + encodeURIComponent(encoded);
        $('#b64ShareUrlOut').value = link;
        toast('Link dibuat', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64ShareUrlCopy')?.addEventListener('click', () => copyText($('#b64ShareUrlOut').value));
    $('#b64ShareWa')?.addEventListener('click', () => { const t = encodeURIComponent($('#b64ShareMsg').value); window.open('https://wa.me/?text=' + t, '_blank'); });
    $('#b64ShareTg')?.addEventListener('click', () => { const t = encodeURIComponent($('#b64ShareMsg').value); window.open('https://t.me/share/url?url=' + t, '_blank'); });
    $('#b64ShareMail')?.addEventListener('click', () => { const t = encodeURIComponent($('#b64ShareMsg').value); location.href = 'mailto:?body=' + t; });

    /* IndexedDB */
    let db = null;
    function openDB() {
      return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        if (!('indexedDB' in window)) return reject(new Error('IndexedDB tidak tersedia'));
        const req = indexedDB.open('b64v7', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('kv', { keyPath: 'k' }); };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => reject(req.error);
      });
    }
    $('#b64IdbSave')?.addEventListener('click', async () => {
      const k = $('#b64IdbKey').value.trim(); const v = $('#b64IdbVal').value;
      if (!k) { toast('Isi key', 'warning'); return; }
      try {
        const d = await openDB();
        const tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ k, v, t: Date.now() });
        await new Promise((res) => tx.oncomplete = res);
        toast('Saved: ' + k, 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64IdbLoad')?.addEventListener('click', async () => {
      const k = $('#b64IdbKey').value.trim();
      if (!k) { toast('Isi key', 'warning'); return; }
      try {
        const d = await openDB();
        const tx = d.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(k);
        req.onsuccess = () => {
          if (req.result) { $('#b64IdbVal').value = req.result.v; toast('Loaded', 'success'); }
          else toast('Key tidak ada', 'warning');
        };
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64IdbList')?.addEventListener('click', async () => {
      try {
        const d = await openDB();
        const tx = d.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').getAllKeys();
        req.onsuccess = () => {
          $('#b64IdbStats').innerHTML = req.result.length
            ? req.result.map((k) => '<span class="b64-stat-chip">' + escapeHtml(k) + '</span>').join('')
            : '<span class="b64-hint">Kosong</span>';
        };
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64IdbDel')?.addEventListener('click', async () => {
      const k = $('#b64IdbKey').value.trim(); if (!k) return;
      try {
        const d = await openDB();
        const tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(k);
        await new Promise((res) => tx.oncomplete = res);
        toast('Deleted', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });

    /* BroadcastChannel */
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('irgxy-b64-v7');
      bc.onmessage = (e) => {
        $('#b64BcRecv').innerHTML = '<span class="b64-stat-chip"><i class="fas fa-inbox"></i> ' + escapeHtml(String(e.data).slice(0, 120)) + '</span>';
      };
      $('#b64BcSend')?.addEventListener('click', () => {
        const m = $('#b64BcMsg').value;
        if (!m) return;
        bc.postMessage(m);
        toast('Broadcast dikirim', 'success');
      });
    }

    /* Gist */
    $('#b64GistFetch')?.addEventListener('click', async () => {
      let url = $('#b64GistUrl').value.trim(); if (!url) return;
      if (!/gist\.github\.com/.test(url)) { toast('URL gist invalid', 'error'); return; }
      if (!url.endsWith('.json')) url = url.replace(/\/([a-f0-9]+)$/, '/$1.json');
      try {
        const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        const files = Object.values(j.files || {});
        if (!files.length) throw new Error('No files');
        $('#b64GistStats').innerHTML = files.map((f) => '<span class="b64-stat-chip">' + escapeHtml(f.filename) + '</span>').join('');
        if (files[0].content) { const enc = $('#b64EncodeInput'); if (enc) enc.value = files[0].content; }
        toast('Loaded', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });

    /* B64 export */
    $('#b64B64ExportBtn')?.addEventListener('click', () => {
      const v = $('#b64B64ExportIn').value;
      if (!v) { toast('Kosong', 'warning'); return; }
      downloadBlob('export-' + Date.now() + '.b64', new Blob([v], { type: 'application/octet-stream' }));
    });

    /* v7-new: Deep link */
    $('#b64DeepGen')?.addEventListener('click', () => {
      const type = $('#b64DeepType').value.trim() || 'encode';
      const data = $('#b64DeepData').value;
      if (!data) { toast('Kosong', 'warning'); return; }
      try {
        const b64 = textToBase64(data);
        const link = location.origin + location.pathname + '#type=' + encodeURIComponent(type) + '&data=' + encodeURIComponent(b64);
        $('#b64DeepOut').value = link;
        toast('Deep link dibuat', 'success');
      } catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
  }

  /* ============ PANEL: A11Y ============ */
  function initA11y() {
    let recognition = null;
    $('#b64VoiceStart')?.addEventListener('click', () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { toast('Speech Recognition tidak didukung', 'error'); return; }
      recognition = new SR();
      recognition.lang = state.lang === 'id' ? 'id-ID' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript;
        $('#b64VoiceOut').value = txt;
        toast('Voice captured', 'success');
      };
      recognition.onerror = (e) => toast('Voice error: ' + e.error, 'error');
      recognition.onend = () => { $('#b64VoiceStart').disabled = false; $('#b64VoiceStop').disabled = true; };
      recognition.start();
      $('#b64VoiceStart').disabled = true; $('#b64VoiceStop').disabled = false;
    });
    $('#b64VoiceStop')?.addEventListener('click', () => { if (recognition) recognition.stop(); });

    $('#b64TtsSpeak')?.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) { toast('TTS tidak didukung', 'warning'); return; }
      const u = new SpeechSynthesisUtterance($('#b64TtsIn').value);
      u.lang = state.lang === 'id' ? 'id-ID' : 'en-US';
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    });
    $('#b64TtsStop')?.addEventListener('click', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });

    $('#b64FontMinus')?.addEventListener('click', () => { state.fontScale = Math.max(1, state.fontScale - 1); applyFontScale(); });
    $('#b64FontPlus')?.addEventListener('click', () => { state.fontScale = Math.min(5, state.fontScale + 1); applyFontScale(); });
    $('#b64FontReset')?.addEventListener('click', () => { state.fontScale = 3; applyFontScale(); });

    const hc = $('#b64HighContrast'), dys = $('#b64Dyslexia'), rm = $('#b64ReduceMotion');
    hc?.addEventListener('change', () => { sec().classList.toggle('b64-hc', hc.checked); safeSet(KEYS.HC, hc.checked ? '1' : '0'); });
    dys?.addEventListener('change', () => { sec().classList.toggle('b64-dyslexia', dys.checked); safeSet(KEYS.DYS, dys.checked ? '1' : '0'); });
    rm?.addEventListener('change', () => { sec().classList.toggle('b64-reduce-motion', rm.checked); safeSet(KEYS.MOTION, rm.checked ? '1' : '0'); });

    /* v7-new: sound + haptic */
    const snd = $('#b64SoundToggle'), hap = $('#b64HapticToggle');
    snd?.addEventListener('change', () => { SOUND.on = snd.checked; safeSet(KEYS.SOUND, snd.checked ? '1' : '0'); });
    hap?.addEventListener('change', () => { HAPTIC.on = hap.checked; safeSet(KEYS.HAPTIC, hap.checked ? '1' : '0'); });
  }

  /* ============ PANEL: SETTINGS ============ */
  function initSettings() {
    const dbgT = $('#b64DebugToggle');
    dbgT?.addEventListener('change', () => {
      dbg.on = dbgT.checked;
      safeSet(KEYS.DEBUG, dbg.on ? '1' : '0');
      toast('Debug: ' + (dbg.on ? 'ON' : 'OFF'), 'info');
    });
    $('#b64DebugExport')?.addEventListener('click', () => {
      const report = {
        ua: navigator.userAgent, time: new Date().toISOString(),
        features: featureDetect(),
        state: { history: state.history.length, stats: state.stats, xp: state.xp, level: state.level, streak: state.streak },
        audit: state.auditLog.slice(0, 20)
      };
      downloadText('b64v7-debug-' + Date.now() + '.txt', JSON.stringify(report, null, 2));
    });
    $('#b64ClearClipboard')?.addEventListener('change', (e) => safeSet(KEYS.CLIP, e.target.checked ? '1' : '0'));
    $('#b64SandboxPreview')?.addEventListener('change', (e) => safeSet(KEYS.SANDBOX, e.target.checked ? '1' : '0'));
    $('#b64SelfTestBtn')?.addEventListener('click', runSelfTest);
    $('#b64PerfCheck')?.addEventListener('click', () => {
      const mem = performance.memory;
      $('#b64PerfStats').innerHTML = mem
        ? '<span class="b64-stat-chip">Used: ' + formatBytes(mem.usedJSHeapSize) + '</span><span class="b64-stat-chip">Total: ' + formatBytes(mem.totalJSHeapSize) + '</span>'
        : '<span class="b64-hint">Memory API tidak tersedia</span>';
    });
    $('#b64NetTest')?.addEventListener('click', async () => {
      try {
        $('#b64NetStats').textContent = 'Testing...';
        const t0 = nowMs();
        await fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' });
        const ms = Math.round(nowMs() - t0);
        $('#b64NetStats').innerHTML = '<span class="b64-stat-chip">Latency: ' + ms + ' ms</span>';
      } catch (e) { $('#b64NetStats').innerHTML = '<span class="b64-stat-chip">Gagal: ' + escapeHtml(e.message) + '</span>'; }
    });
    $('#b64FullReset')?.addEventListener('click', async () => {
      if (!(await confirmModal('Hapus SEMUA data (riwayat, stats, pengaturan)?'))) return;
      try { Object.values(KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} }); } catch (_) {}
      try { indexedDB.deleteDatabase('b64v7'); } catch (_) {}
      try { if (caches && caches.keys) (await caches.keys()).forEach((k) => caches.delete(k)); } catch (_) {}
      toast('Semua data dihapus — reload...', 'info');
      setTimeout(() => location.reload(), 800);
    });
    /* v7-new: theme customizer */
    $('#b64AccentColor')?.addEventListener('input', (e) => applyAccent(e.target.value));
    /* v7-new: layout switcher */
    $('#b64LayoutSelect')?.addEventListener('change', (e) => applyLayout(e.target.value));
  }

  /* ============ PANEL: ANALYTICS ============ */
  function initAnalytics() {
    $('#b64AnReset')?.addEventListener('click', async () => {
      if (!(await confirmModal('Reset semua statistik?'))) return;
      state.stats = { total: 0, bytes: 0, byType: {}, days: [], timeSum: 0 };
      saveStats(); renderStats();
      toast('Statistik direset', 'info');
    });
    /* v7-new: export PNG */
    $('#b64AnExportPng')?.addEventListener('click', () => {
      const c = $('#b64Chart'); if (!c) return;
      try {
        const url = c.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url; a.download = 'analytics-' + Date.now() + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        toast('PNG di-download', 'success');
      } catch (err) { toast('Gagal: ' + err.message, 'error'); }
    });
  }

  /* ============ PANEL: INTEGRASI ============ */
  function initIntegrate() {
    $('#b64EmbedGen')?.addEventListener('click', () => {
      const url = $('#b64EmbedUrl').value.trim() || location.href;
      $('#b64EmbedOut').value = '<iframe src="' + url + '" width="100%" height="700" frameborder="0" loading="lazy"></iframe>';
      toast('Widget dibuat', 'success');
    });
    $('#b64CliRun')?.addEventListener('click', () => {
      const v = $('#b64CliIn').value.trim();
      if (!v) return;
      try {
        const m = v.match(/echo\s+["']?([^"']+)["']?\s*\|\s*base64\s*(-d)?/i);
        if (m) {
          if (m[2]) $('#b64CliOut').value = base64ToText(m[1].trim());
          else $('#b64CliOut').value = textToBase64(m[1].trim());
        } else $('#b64CliOut').value = '# Perintah tidak dikenali. Coba: echo "Halo" | base64';
      } catch (e) { $('#b64CliOut').value = 'Error: ' + e.message; }
    });
    $('#b64CurlGen')?.addEventListener('click', () => {
      $('#b64CurlOut').value = 'curl -X POST https://api.example.com/convert \\\n  -H "Content-Type: application/json" \\\n  -d \'{"data":"SGVsbG8=","mode":"decode"}\'';
    });
    /* v7-new: webhook simulator */
    $('#b64WebhookSend')?.addEventListener('click', async () => {
      const url = $('#b64WebhookUrl').value.trim();
      const body = $('#b64WebhookBody').value;
      if (!url) { toast('Isi URL', 'warning'); return; }
      const out = $('#b64WebhookOut');
      out.textContent = 'Mengirim...';
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });
        const t = await r.text();
        out.textContent = 'Status: ' + r.status + '\n\n' + t.slice(0, 2000);
        toast('Webhook terkirim', 'success');
      } catch (e) { out.textContent = 'Gagal: ' + e.message; toast('Webhook gagal', 'error'); }
    });
  }

  /* ============ PANEL: PWA ============ */
  function initPwa() {
    const statusEl = $('#b64PwaStatus');
    function updateStatus() {
      if (statusEl) statusEl.innerHTML =
        '<span class="b64-stat-chip"><i class="fas fa-wifi"></i> ' + (navigator.onLine ? 'Online' : 'Offline') + '</span>' +
        '<span class="b64-stat-chip"><i class="fas fa-cookie"></i> ' + (navigator.cookieEnabled ? 'Cookies' : 'No Cookies') + '</span>';
    }
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      const b = $('#b64PwaInstall'); if (b) b.disabled = false;
    });
    $('#b64PwaInstall')?.addEventListener('click', async () => {
      if (!state.deferredPrompt) { toast('Install tidak tersedia', 'warning'); return; }
      state.deferredPrompt.prompt();
      const choice = await state.deferredPrompt.userChoice;
      toast('Install: ' + choice.outcome, 'info');
      state.deferredPrompt = null;
    });
    $('#b64PwaSwReg')?.addEventListener('click', async () => {
      if (!('serviceWorker' in navigator)) { toast('SW tidak didukung', 'error'); return; }
      try {
        const reg = await navigator.serviceWorker.register('sw.js').catch(() => null);
        state.swReg = reg;
        $('#b64PwaSwStats').innerHTML = reg
          ? '<span class="b64-stat-chip">✅ Terdaftar</span>'
          : '<span class="b64-stat-chip">⚠️ sw.js tidak tersedia</span>';
      } catch (e) { $('#b64PwaSwStats').innerHTML = '<span class="b64-stat-chip">❌ ' + escapeHtml(e.message) + '</span>'; }
    });
    $('#b64PwaSwUpdate')?.addEventListener('click', async () => {
      if (!state.swReg) { toast('Register dulu', 'warning'); return; }
      await state.swReg.update();
      toast('Update dicek', 'info');
    });
    $('#b64PwaCacheInfo')?.addEventListener('click', async () => {
      if (!('caches' in window)) { toast('Cache API tidak didukung', 'warning'); return; }
      const keys = await caches.keys();
      $('#b64PwaCacheStats').innerHTML = keys.length
        ? keys.map((k) => '<span class="b64-stat-chip">' + escapeHtml(k) + '</span>').join('')
        : '<span class="b64-hint">Tidak ada cache</span>';
    });
    /* v7-new: File System Access API */
    $('#b64FsSave')?.addEventListener('click', async () => {
      const content = $('#b64FsContent').value;
      if (!content) { toast('Isi konten', 'warning'); return; }
      if (!('showSaveFilePicker' in window)) { toast('API tidak didukung browser ini', 'warning'); return; }
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: 'output.txt', types: [{ description: 'Text', accept: { 'text/plain': ['.txt'] } }] });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        toast('File disimpan', 'success');
      } catch (e) { if (e.name !== 'AbortError') toast('Gagal: ' + e.message, 'error'); }
    });
    /* v7-new: Badge API */
    $('#b64BadgeSet')?.addEventListener('click', async () => {
      const n = parseInt($('#b64BadgeNum').value, 10) || 0;
      if (!('setAppBadge' in navigator)) { toast('Badge API tidak didukung', 'warning'); return; }
      try { await navigator.setAppBadge(n); toast('Badge diset: ' + n, 'success'); }
      catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
    $('#b64BadgeClear')?.addEventListener('click', async () => {
      if (!('clearAppBadge' in navigator)) { toast('Badge API tidak didukung', 'warning'); return; }
      try { await navigator.clearAppBadge(); toast('Badge cleared', 'info'); }
      catch (e) { toast('Gagal: ' + e.message, 'error'); }
    });
  }

  /* ============ PANEL: LEARN ============ */
  function initLearn() {
    /* Cheat sheet */
    const cheat = [
      '# Base64 Cheat Sheet',
      '',
      '## Base64 (RFC 4648)',
      'Alphabet: A-Z a-z 0-9 + /',
      'Padding: =',
      '',
      '## Base64URL (RFC 4648 §5)',
      'Alphabet: A-Z a-z 0-9 - _',
      'Padding: dihilangkan',
      '',
      '## Base32',
      'Alphabet: A-Z 2-7',
      '',
      '## Base85 (ASCII85/RFC 1924)',
      'Alphabet: !-u',
      'Delimiter: <~ ... ~>',
      '',
      '## Base58 (Bitcoin)',
      'Alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
      '',
      '## JavaScript',
      '```js',
      '// Encode Unicode-safe',
      'btoa(unescape(encodeURIComponent(str)))  // deprecated',
      'btoa(String.fromCharCode(...new TextEncoder().encode(str)))  // modern',
      '',
      '// Decode Unicode-safe',
      'new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))',
      '```',
      '',
      '## Python',
      '```python',
      'import base64',
      'b64 = base64.b64encode(b"Hello").decode()  # SGVsbG8=',
      'text = base64.b64decode(b64).decode()',
      '```',
      '',
      '## Node.js',
      '```js',
      "const b64 = Buffer.from('Hello').toString('base64');",
      "const text = Buffer.from(b64, 'base64').toString('utf-8');",
      '```',
      '',
      '## Go',
      '```go',
      'import "encoding/base64"',
      'b64 := base64.StdEncoding.EncodeToString([]byte("Hello"))',
      '```'
    ].join('\n');
    const preview = $('#b64CheatPreview');
    if (preview) preview.textContent = cheat.slice(0, 500) + '...';
    $('#b64CheatMd')?.addEventListener('click', () => downloadText('base64-cheatsheet.md', cheat));
    $('#b64CheatTxt')?.addEventListener('click', () => downloadText('base64-cheatsheet.txt', cheat.replace(/```[a-z]*/g, '')));

    /* Code examples */
    const codeExamples = {
      js: "// JavaScript (modern, Unicode-safe)\nconst b64 = btoa(String.fromCharCode(...new TextEncoder().encode('Halo ✨')));\nconst text = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));\nconsole.log(text); // Halo ✨",
      py: "# Python 3\nimport base64\nb64 = base64.b64encode('Halo ✨'.encode('utf-8')).decode()\nprint(b64)\ntext = base64.b64decode(b64).decode('utf-8')\nprint(text)",
      php: "<?php\n$b64 = base64_encode('Halo ✨');\necho $b64;\n$text = base64_decode($b64);\necho $text;",
      go: "package main\n\nimport (\n  \"encoding/base64\"\n  \"fmt\"\n)\n\nfunc main() {\n  b64 := base64.StdEncoding.EncodeToString([]byte(\"Halo ✨\"))\n  fmt.Println(b64)\n  decoded, _ := base64.StdEncoding.DecodeString(b64)\n  fmt.Println(string(decoded))\n}",
      rust: "fn main() {\n    use base64::{Engine, engine::general_purpose};\n    let b64 = general_purpose::STANDARD.encode(b\"Halo\");\n    println!(\"{}\", b64);\n    let decoded = general_purpose::STANDARD.decode(&b64).unwrap();\n    println!(\"{}\", String::from_utf8_lossy(&decoded));\n}"
    };
    $('#b64CodeGen')?.addEventListener('click', () => {
      const lang = $('#b64CodeLang').value;
      $('#b64CodeOut').textContent = codeExamples[lang] || '—';
    });

    /* Quiz */
    const quizPool = [
      { q: 'Base64 alphabet berapa karakter?', a: ['32','64','85','128'], c: 1 },
      { q: 'Kepanjangan Base64?', a: ['4 byte','Skema encoding 64-char','64-bit','Urutan ke-64'], c: 1 },
      { q: 'Padding Base64 = ', a: ['=','+','/','-'], c: 0 },
      { q: 'URL-safe Base64 pakai karakter apa?', a: ['+/','-_','=~','!$'], c: 1 },
      { q: 'Data URI default-nya pakai?', a: ['MIME wrap','Base58','Base64','Hex'], c: 2 },
      { q: 'Overhead Base64 dari data asli?', a: ['~33%','~50%','~10%','~100%'], c: 0 },
      { q: 'Base32 alphabet?', a: ['A-Z0-9','A-Z2-7','A-F0-9','Base32 = 32 hex'], c: 1 },
      { q: 'Base64 dipakai di JWT bagian?', a: ['Header + payload','Signature saja','Semua','Tidak'], c: 0 },
      { q: 'Base85 alphabet mulai dari?', a: ['A','!','0','~'], c: 1 },
      { q: 'MIME wrap Base64 = berapa kolom?', a: ['64','72','76','80'], c: 2 }
    ];
    $('#b64QuizStart')?.addEventListener('click', () => {
      const body = $('#b64QuizBody');
      if (!body) return;
      const qs = [...quizPool].sort(() => Math.random() - 0.5).slice(0, 5);
      let idx = 0, score = 0;
      function renderQ() {
        if (idx >= qs.length) {
          body.innerHTML = '<div class="b64-stats"><span class="b64-stat-chip">Skor: ' + score + '/' + qs.length + '</span></div>' +
            '<button class="b64-btn b64-btn-primary" id="b64QuizAgain">Ulangi</button>';
          document.getElementById('b64QuizAgain')?.addEventListener('click', () => { idx = 0; score = 0; renderQ(); });
          addXp(score * 10);
          return;
        }
        const q = qs[idx];
        body.innerHTML = '<p style="margin:10px 0;"><strong>Q' + (idx + 1) + ':</strong> ' + escapeHtml(q.q) + '</p>' +
          q.a.map((a, i) => '<button class="b64-btn" data-qi="' + i + '" style="display:block;width:100%;margin:4px 0;text-align:left;">' + escapeHtml(a) + '</button>').join('');
        body.querySelectorAll('[data-qi]').forEach((b) => {
          b.addEventListener('click', () => {
            const sel = parseInt(b.getAttribute('data-qi'), 10);
            if (sel === q.c) { score++; toast('Benar! ✅', 'success'); }
            else toast('Salah ❌', 'error');
            idx++; renderQ();
          });
        });
      }
      renderQ();
    });
  }

  /* ============ PANEL: HISTORY ============ */
  function initHistory() {
    loadHistory(); renderHistory(); bindHistory();
    $('#b64HistoryExport')?.addEventListener('click', () => {
      if (!state.history.length) { toast('Riwayat kosong', 'warning'); return; }
      downloadBlob('base64-history.json', new Blob([JSON.stringify(state.history, null, 2)], { type: 'application/json' }));
    });
    $('#b64HistoryImportBtn')?.addEventListener('click', () => $('#b64HistoryImport').click());
    $('#b64HistoryImport')?.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const arr = JSON.parse(await f.text());
        if (!Array.isArray(arr)) throw new Error('Bukan array');
        state.history = arr.slice(0, HISTORY_MAX);
        saveHistory(); renderHistory();
        toast('Import: ' + arr.length + ' item', 'success');
      } catch (err) { toast('Import gagal: ' + err.message, 'error'); }
      e.target.value = '';
    });
    $('#b64HistoryClear')?.addEventListener('click', async () => {
      if (!state.history.length) return;
      if (!(await confirmModal('Hapus semua riwayat?'))) return;
      state.history = []; saveHistory(); renderHistory(); toast('Riwayat dihapus', 'info');
    });
  }

  /* ============ HASH IMPORT (URL hash) ============ */
  function checkHashImport() {
    try {
      const h = location.hash;
      const m = h.match(/#data=([^&]+)/);
      if (m) {
        const b64 = decodeURIComponent(m[1]);
        const enc = $('#b64DecodeInput');
        if (enc) { enc.value = b64; switchTab('text'); setTimeout(() => $('#b64DecodeBtn')?.click(), 200); toast('Data dari URL siap di-decode', 'info'); }
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (_) {}
  }

  /* ============ v7-new: AUTO-SAVE DRAFT ============ */
  function initAutoSave() {
    const save = debounce(() => {
      try {
        const draft = {
          enc: $('#b64EncodeInput')?.value || '',
          dec: $('#b64DecodeInput')?.value || '',
          ts: Date.now()
        };
        safeSet(KEYS.DRAFT, JSON.stringify(draft));
      } catch (_) {}
    }, 3000);
    ['b64EncodeInput', 'b64DecodeInput'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', save);
    });
    // restore
    try {
      const raw = safeGet(KEYS.DRAFT);
      if (raw) {
        const d = JSON.parse(raw);
        const enc = $('#b64EncodeInput');
        if (d.enc && enc && !enc.value) enc.value = d.enc;
        const dec = $('#b64DecodeInput');
        if (d.dec && dec && !dec.value) dec.value = d.dec;
        if (d.enc || d.dec) toast('Draft sebelumnya dipulihkan', 'info');
      }
    } catch (_) {}
  }

  /* ============ v7-new: CONSOLE API ============ */
  function initConsoleApi() {
    window.b64v7 = {
      encode: (text) => textToBase64(String(text ?? '')),
      decode: (b64) => base64ToText(String(b64 ?? '')),
      encodeFile: async (file) => arrayBufferToBase64(await file.arrayBuffer()),
      hash: async (algo, text) => sha256Hex(new TextEncoder().encode(String(text))),
      md5: (text) => md5(String(text)),
      stats: () => ({ ...state.stats }),
      xp: () => ({ xp: state.xp, level: state.level, streak: state.streak }),
      features: () => featureDetect(),
      reset: () => { state.stats = { total: 0, bytes: 0, byType: {}, days: [], timeSum: 0 }; saveStats(); renderStats(); },
      version: '7.0.0-quantum'
    };
  }

  /* ============ SERVICE WORKER ============ */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    try {
      const swCode = "self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.open('b64v7').then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.ok)c.put(e.request,res.clone());return res}).catch(()=>c.match(e.request)))))});";
      const swUrl = URL.createObjectURL(new Blob([swCode], { type: 'application/javascript' }));
      navigator.serviceWorker.register(swUrl).catch(() => {});
    } catch (_) {}
  }

  /* ============ INIT ============ */
  function init() {
    try {
      if (!$('#b64Dropzone') && !$('#b64EncodeInput')) return;
      loadPrefs();
      applyTheme(state.theme);
      applyLang(state.lang);
      applyFontScale();
      loadStats();
      loadAudit();
      loadXp();
      renderClipHistory();

      initTabs();
      initFilePanel();
      initTextPanels();
      initUrlPanel();
      initCamera();
      initAdvanced();
      initQr();
      initUtility();
      initShare();
      initA11y();
      initSettings();
      initAnalytics();
      initIntegrate();
      initPwa();
      initLearn();
      initHistory();
      initCmdk();
      initShortcuts();
      initThemeLangButtons();
      initAutoSave();
      initConsoleApi();

      renderStats();
      renderFeatureDetect();
      renderBrowserInfo();
      checkHashImport();

      if (window.AOS && typeof AOS.init === 'function') {
        AOS.init({ duration: 600, once: true, easing: 'ease-out-cubic' });
      }

      initServiceWorker();

      window.addEventListener('beforeunload', () => {
        abortRead();
        if (state.camera.stream) state.camera.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      });

      log('v7 Quantum ready');
      toast('Base64 Pro v7 Quantum siap! ⚛️', 'success');
    } catch (err) { warn('Init error', err); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();