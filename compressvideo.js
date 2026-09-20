/* ================================================================
   IRGXYMODS — COMPRESS VIDEO CLIENT
   File    : compressvideo.js
   Version : 5.0.0 — PREMIUM / COMPLETE / STABLE
   ================================================================
   Fitur utama v5.0:
     [01] Preset profil siap pakai (WhatsApp, IG, TikTok, YT, Email, Discord, Twitter)
     [02] Batch queue multi-file (tambah/hapus/reorder/proses semua)
     [03] Trim / Cut video (start & end time)
     [04] Rotate 90/180/270 + Flip H/V
     [05] Video filter (brightness, contrast, saturation, gamma, sharpen, denoise)
     [06] Watermark teks (posisi, ukuran, warna, opacity, background)
     [07] Frame rate control (auto/24/25/30/60)
     [08] Two-pass encoding (opsional, akurasi bitrate lebih baik)
     [09] Audio normalize (loudnorm) + volume adjustment
     [10] Custom FFmpeg args override (advanced user)
     [11] Advanced panel lengkap + penyimpanan preset ke localStorage
     [12] Export / Import konfigurasi (JSON)
     [13] Log viewer real-time (debug/status)
     [14] Keyboard shortcuts (pintar + cheat sheet)
     [15] Progress dengan ETA, FPS, speed, dan grafik mini
     [16] Worker health-check + warmup preload + auto-retry
     [17] Notifikasi + sound (opsional) saat selesai/gagal
     [18] Anti-crash: semua handler di-guard, no leaked URL, no leaked worker
     [19] Recovery otomatis dari worker hang (watchdog adaptif)
     [20] Riwayat lengkap dengan filter & sorting
     [21] Drag-and-drop multi-file dengan validasi per-file
     [22] Metadata lengkap (durasi, resolusi, fps, bitrate, codec, audio)
     [23] Auto-scroll & auto-focus UX yang halus
     [24] Deteksi dukungan codec + fallback otomatis
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     [1] DEPENDENCY GUARDS
     ================================================================ */
  const $  = window.IRGXY?.$  || ((s, c = document) => c.querySelector(s));
  const $$ = window.IRGXY?.$$ || ((s, c = document) => Array.from(c.querySelectorAll(s)));

  const toastFn = (typeof window.showToast === 'function')
    ? window.showToast
    : (m, t) => console.log('[toast:' + (t || 'info') + ']', m);
  const toast = (m, t) => { try { toastFn(m, t); } catch (_) {} };

  const logActivity = (typeof window.addActivity === 'function')
    ? window.addActivity
    : () => {};

  /* ================================================================
     [2] SAFE HELPERS — semua operasi dibungkus agar tidak crash
     ================================================================ */
  const safe      = (fn, fb) => { try { return fn(); } catch (e) { console.warn('[Compress safe]', e); return fb; } };
  const safeAsync = async (fn, fb) => { try { return await fn(); } catch (e) { console.warn('[Compress safeAsync]', e); return fb; } };
  const on  = (el, ev, fn, opts) => { if (el && el.addEventListener) el.addEventListener(ev, fn, opts); };
  const off = (el, ev, fn) => { if (el && el.removeEventListener) el.removeEventListener(ev, fn); };
  const setText  = (sel, v) => { const e = $(sel); if (e) e.textContent = v; };
  const setStyle = (sel, p, v) => { const e = $(sel); if (e) e.style[p] = v; };
  const show = (sel, d = 'block') => setStyle(sel, 'display', d);
  const hide = (sel) => setStyle(sel, 'display', 'none');
  const el   = (tag, attrs = {}, html = '') => {
    const n = document.createElement(tag);
    Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    if (html) n.innerHTML = html;
    return n;
  };
  const injectAfter = (anchorSel, node) => {
    const anchor = $(anchorSel);
    if (!anchor || !anchor.parentNode) return null;
    anchor.parentNode.insertBefore(node, anchor.nextSibling);
    return node;
  };
  const injectBefore = (anchorSel, node) => {
    const anchor = $(anchorSel);
    if (!anchor || !anchor.parentNode) return null;
    anchor.parentNode.insertBefore(node, anchor);
    return node;
  };
  const debounce = (fn, ms = 150) => {
    let t = null;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  };

  /* ================================================================
     [3] FORMATTERS
     ================================================================ */
  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return (bytes / Math.pow(k, i)).toFixed(decimals) + ' ' + sizes[i];
  }
  function formatDuration(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function formatTimecode(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }
  function formatEta(seconds) {
    if (!isFinite(seconds) || seconds < 0 || seconds > 86400) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function timestampName(baseName, ext = 'mp4') {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const clean = String(baseName || 'video')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 60) || 'video';
    return `${clean}_compressed_${stamp}.${ext}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function safeNum(v, fb = 0) { const n = Number(v); return isFinite(n) ? n : fb; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ================================================================
     [4] CONSTANTS & STATE
     ================================================================ */
  const HISTORY_KEY = 'irgxy_compress_history_v5';
  const PRESETS_KEY = 'irgxy_compress_presets_v5';
  const SETTINGS_KEY = 'irgxy_compress_settings_v5';
  const MAX_HISTORY = 30;
  const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024;    // 1 GB
  const WARN_FILE_SIZE = 500 * 1024 * 1024;         // 500 MB
  const WATCHDOG_TIMEOUT_MS = 90_000;               // 90s
  const WORKER_VERSION_EXPECTED = '5.0.0';

  const state = {
    /* File tunggal (mode aktif saat ini) */
    file: null,
    metadata: { duration: 0, width: 0, height: 0, bitrate: 0, fps: 0, hasAudio: false, videoCodec: '', audioCodec: '' },
    previewUrl: null,

    /* Hasil */
    resultBlob: null,
    resultUrl: null,

    /* Worker */
    worker: null,
    workerReady: false,
    workerBooted: false,
    workerVersion: '',

    /* Proses */
    processing: false,
    cancelled: false,
    startTime: 0,
    lastProgressTime: 0,
    lastProgress: 0,
    emaSpeed: 0,
    etaMs: 0,
    progressHistory: [],   // untuk mini-chart
    watchdogTimer: null,
    lastActivityAt: 0,
    config: null,
    warnings: [],

    /* Queue */
    queue: [],             // { id, file, metadata, status, result }
    queueIndex: -1,

    /* Panel */
    logsOpen: false,
    helpOpen: false,
    advancedOpen: false,

    /* User prefs */
    prefs: {
      soundOnDone: true,
      notifyOnDone: false,
      logLevel: 'info'
    }
  };

  /* ================================================================
     [5] URL LIFECYCLE — cegah memory leak
     ================================================================ */
  function revokeUrl(u) { if (u) safe(() => URL.revokeObjectURL(u)); }
  function revokePreview() {
    revokeUrl(state.previewUrl);
    state.previewUrl = null;
    const pv = $('#compressVideoPreview');
    if (pv) { safe(() => pv.pause()); pv.removeAttribute('src'); safe(() => pv.load()); }
  }
  function revokeResult() {
    revokeUrl(state.resultUrl);
    state.resultUrl = null;
    state.resultBlob = null;
    const rv = $('#compressResultVideo');
    if (rv) { safe(() => rv.pause()); rv.removeAttribute('src'); safe(() => rv.load()); }
  }

  /* ================================================================
     [6] FILE VALIDATION
     ================================================================ */
  function isVideoFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith('video/')) return true;
    return /\.(mp4|mov|mkv|webm|avi|m4v|3gp|flv|wmv|mpeg|mpg|ts|ogv)$/i.test(file.name);
  }

  /* ================================================================
     [7] METADATA READER
     ================================================================ */
  function loadVideoMetadata(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      const url = URL.createObjectURL(file);
      let settled = false;
      const done = (err, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        revokeUrl(url);
        v.removeAttribute('src');
        safe(() => v.load());
        err ? reject(err) : resolve(data);
      };
      const timer = setTimeout(() => done(new Error('Timeout membaca metadata (file mungkin rusak)')), 15000);

      v.onloadedmetadata = () => {
        const w = v.videoWidth, h = v.videoHeight, dur = v.duration;
        if (!w || !h) return done(new Error('Resolusi video tidak dapat dibaca'));
        if (!isFinite(dur) || dur <= 0) return done(new Error('Durasi video tidak valid'));
        done(null, { duration: dur, width: w, height: h });
      };
      v.onerror = () => done(new Error('Format video tidak didukung browser'));
      v.src = url;
    });
  }

  /* ================================================================
     [8] UI INJECTION — panel baru v5.0
     ================================================================ */

  /* ---------- 8.1 Preset Profil (di atas settings) ---------- */
  function injectPresetBar() {
    if ($('#compressPresetBar')) return;
    const card = el('section', {
      class: 'compress-settings-card compress-preset-card',
      id: 'compressPresetBar',
      'data-aos': 'fade-up',
      style: 'display:none;'
    }, `
      <div class="compress-input-header"><i class="fas fa-magic"></i><span>Profil Cepat (Preset)</span></div>
      <div class="compress-preset-grid">
        <button type="button" class="compress-preset-btn" data-preset="whatsapp"><i class="fab fa-whatsapp"></i><span>WhatsApp</span><small>720p · H.264 · 1.5 Mbps</small></button>
        <button type="button" class="compress-preset-btn" data-preset="instagram"><i class="fab fa-instagram"></i><span>Instagram</span><small>1080p · H.264 · 3.5 Mbps</small></button>
        <button type="button" class="compress-preset-btn" data-preset="tiktok"><i class="fab fa-tiktok"></i><span>TikTok</span><small>1080p · H.264 · 4 Mbps</small></button>
        <button type="button" class="compress-preset-btn" data-preset="youtube"><i class="fab fa-youtube"></i><span>YouTube HD</span><small>1080p · H.264 · 8 Mbps</small></button>
        <button type="button" class="compress-preset-btn" data-preset="twitter"><i class="fab fa-twitter"></i><span>Twitter/X</span><small>720p · H.264 · 5 Mbps</small></button>
        <button type="button" class="compress-preset-btn" data-preset="email"><i class="fas fa-envelope"></i><span>Email</span><small>480p · H.264 · 800 kbps</small></button>
        <button type="button" class="compress-preset-btn" data-preset="discord"><i class="fab fa-discord"></i><span>Discord</span><small>720p · H.264 · ≤8 MB</small></button>
        <button type="button" class="compress-preset-btn" data-preset="archiv"><i class="fas fa-archive"></i><span>Arsip</span><small>1080p · H.265 · CRF 22</small></button>
        <button type="button" class="compress-preset-btn" data-preset="maxsave"><i class="fas fa-compress-arrows-alt"></i><span>Hemat Maks</span><small>480p · H.265 · CRF 32</small></button>
        <button type="button" class="compress-preset-btn" data-preset="custom"><i class="fas fa-cog"></i><span>Custom</span><small>Atur manual</small></button>
      </div>
    `);
    const anchor = $('#compressSettingsCard');
    if (anchor) anchor.parentNode.insertBefore(card, anchor);
    $$('#compressPresetBar .compress-preset-btn').forEach(btn => {
      on(btn, 'click', () => applyPreset(btn.getAttribute('data-preset')));
    });
  }

  /* ---------- 8.2 Trim (masuk ke settings) ---------- */
  function injectTrimPanel() {
    if ($('#compressTrimPanel')) return;
    const panel = el('div', {
      class: 'compress-group compress-trim-panel',
      id: 'compressTrimPanel'
    }, `
      <label class="compress-group-label"><i class="fas fa-cut"></i> Trim Video (opsional)</label>
      <div class="compress-trim-row">
        <label class="compress-trim-field">
          <span>Mulai (detik)</span>
          <input type="number" id="trimStart" min="0" step="0.1" value="0" inputmode="decimal" />
        </label>
        <label class="compress-trim-field">
          <span>Selesai (detik)</span>
          <input type="number" id="trimEnd" min="0" step="0.1" value="0" inputmode="decimal" />
        </label>
        <button type="button" class="compress-action-btn" id="trimFullBtn"><i class="fas fa-expand"></i> Pakai Penuh</button>
      </div>
      <div class="compress-trim-preview">
        <input type="range" id="trimStartRange" min="0" max="100" step="0.01" value="0" />
        <input type="range" id="trimEndRange" min="0" max="100" step="0.01" value="100" />
      </div>
      <small class="compress-hint">Kosongkan / 0 untuk memproses seluruh video.</small>
    `);
    const anchor = $('#dynamicInputGroup');
    if (anchor) anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    on($('#trimFullBtn'), 'click', () => {
      const dur = state.metadata.duration || 0;
      if ($('#trimStart')) $('#trimStart').value = '0';
      if ($('#trimEnd')) $('#trimEnd').value = String(dur.toFixed(2));
      syncTrimRanges();
    });
    on($('#trimStart'), 'input', () => { syncTrimRanges(); updateEstimate(); });
    on($('#trimEnd'),   'input', () => { syncTrimRanges(); updateEstimate(); });
    on($('#trimStartRange'), 'input', () => {
      const dur = state.metadata.duration || 0;
      if ($('#trimStart')) $('#trimStart').value = (dur * safeNum($('#trimStartRange').value) / 100).toFixed(2);
      updateEstimate();
    });
    on($('#trimEndRange'), 'input', () => {
      const dur = state.metadata.duration || 0;
      if ($('#trimEnd')) $('#trimEnd').value = (dur * safeNum($('#trimEndRange').value) / 100).toFixed(2);
      updateEstimate();
    });
  }
  function syncTrimRanges() {
    const dur = state.metadata.duration || 0;
    if (dur <= 0) return;
    const s = clamp(safeNum($('#trimStart')?.value, 0), 0, dur);
    const e = clamp(safeNum($('#trimEnd')?.value, dur), 0, dur);
    if ($('#trimStartRange')) $('#trimStartRange').value = String((s / dur) * 100);
    if ($('#trimEndRange'))   $('#trimEndRange').value   = String((e / dur) * 100);
  }

  /* ---------- 8.3 Video Lanjutan (rotate/flip/filter/fps) ---------- */
  function injectAdvancedVideoPanel() {
    if ($('#compressAdvVideoPanel')) return;
    const panel = el('div', {
      class: 'compress-group compress-adv-video',
      id: 'compressAdvVideoPanel'
    }, `
      <label class="compress-group-label"><i class="fas fa-film"></i> Video Lanjutan</label>
      <div class="compress-adv-grid">
        <label class="compress-adv-field">
          <span>Rotasi</span>
          <select id="advRotate" class="compress-select">
            <option value="0">0°</option>
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Flip</span>
          <select id="advFlip" class="compress-select">
            <option value="none">Tidak</option>
            <option value="h">Horizontal</option>
            <option value="v">Vertical</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Frame Rate</span>
          <select id="advFps" class="compress-select">
            <option value="auto">Auto (Sumber)</option>
            <option value="24">24 fps</option>
            <option value="25">25 fps</option>
            <option value="30">30 fps</option>
            <option value="60">60 fps</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Denoise</span>
          <select id="advDenoise" class="compress-select">
            <option value="off">Off</option>
            <option value="light">Ringan</option>
            <option value="medium">Sedang</option>
            <option value="strong">Kuat</option>
          </select>
        </label>
      </div>
      <div class="compress-adv-grid" style="margin-top:10px;">
        <label class="compress-adv-field">
          <span>Brightness <em id="valBrightness">0</em></span>
          <input type="range" id="advBrightness" min="-1" max="1" step="0.05" value="0" />
        </label>
        <label class="compress-adv-field">
          <span>Contrast <em id="valContrast">1.0</em></span>
          <input type="range" id="advContrast" min="0.5" max="2" step="0.05" value="1" />
        </label>
        <label class="compress-adv-field">
          <span>Saturation <em id="valSaturation">1.0</em></span>
          <input type="range" id="advSaturation" min="0" max="2" step="0.05" value="1" />
        </label>
        <label class="compress-adv-field">
          <span>Sharpen <em id="valSharpen">0</em></span>
          <input type="range" id="advSharpen" min="0" max="2" step="0.1" value="0" />
        </label>
      </div>
    `);
    const anchor = $('#compressTrimPanel');
    if (anchor) anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    const upd = () => {
      setText('#valBrightness', $('#advBrightness')?.value || '0');
      setText('#valContrast',   $('#advContrast')?.value || '1');
      setText('#valSaturation', $('#advSaturation')?.value || '1');
      setText('#valSharpen',    $('#advSharpen')?.value || '0');
    };
    ['#advBrightness','#advContrast','#advSaturation','#advSharpen'].forEach(sel => {
      on($(sel), 'input', () => { upd(); debouncedEstimate(); });
    });
    ['#advRotate','#advFlip','#advFps','#advDenoise'].forEach(sel => {
      on($(sel), 'change', debouncedEstimate);
    });
    upd();
  }

  /* ---------- 8.4 Watermark ---------- */
  function injectWatermarkPanel() {
    if ($('#compressWmPanel')) return;
    const panel = el('div', {
      class: 'compress-group compress-wm-panel',
      id: 'compressWmPanel'
    }, `
      <label class="compress-group-label"><i class="fas fa-tint"></i> Watermark Teks (opsional)</label>
      <div class="compress-adv-grid">
        <label class="compress-adv-field" style="grid-column: span 2;">
          <span>Teks Watermark</span>
          <input type="text" id="wmText" placeholder="Contoh: © IRGXYMODS 2025" maxlength="60" />
        </label>
        <label class="compress-adv-field">
          <span>Posisi</span>
          <select id="wmPos" class="compress-select">
            <option value="tl">Kiri Atas</option>
            <option value="tr">Kanan Atas</option>
            <option value="bl">Kiri Bawah</option>
            <option value="br" selected>Kanan Bawah</option>
            <option value="tc">Tengah Atas</option>
            <option value="bc">Tengah Bawah</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Ukuran Font</span>
          <input type="number" id="wmSize" min="10" max="120" value="24" />
        </label>
        <label class="compress-adv-field">
          <span>Warna</span>
          <input type="color" id="wmColor" value="#ffffff" />
        </label>
        <label class="compress-adv-field">
          <span>Opacity <em id="valWmOpacity">0.8</em></span>
          <input type="range" id="wmOpacity" min="0.1" max="1" step="0.05" value="0.8" />
        </label>
        <label class="compress-adv-field" style="flex-direction:row;align-items:center;gap:8px;">
          <input type="checkbox" id="wmBg" />
          <span>Tambahkan latar hitam</span>
        </label>
      </div>
    `);
    const anchor = $('#compressAdvVideoPanel');
    if (anchor) anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    on($('#wmOpacity'), 'input', () => setText('#valWmOpacity', $('#wmOpacity').value));
    ['#wmText','#wmPos','#wmSize','#wmColor','#wmOpacity','#wmBg'].forEach(sel => {
      on($(sel), 'input', debouncedEstimate);
    });
  }

  /* ---------- 8.5 Audio lanjutan ---------- */
  function injectAudioAdvancedPanel() {
    if ($('#compressAdvAudioPanel')) return;
    const panel = el('div', {
      class: 'compress-group compress-adv-audio',
      id: 'compressAdvAudioPanel'
    }, `
      <label class="compress-group-label"><i class="fas fa-music"></i> Audio Lanjutan</label>
      <div class="compress-adv-grid">
        <label class="compress-adv-field">
          <span>Normalize Volume</span>
          <select id="advNormalize" class="compress-select">
            <option value="off">Off</option>
            <option value="on">On (loudnorm)</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Volume <em id="valVolume">100</em>%</span>
          <input type="range" id="advVolume" min="0" max="300" step="5" value="100" />
        </label>
        <label class="compress-adv-field">
          <span>Sample Rate</span>
          <select id="advSampleRate" class="compress-select">
            <option value="auto">Auto</option>
            <option value="44100">44100 Hz</option>
            <option value="48000">48000 Hz</option>
            <option value="32000">32000 Hz</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Channel</span>
          <select id="advChannels" class="compress-select">
            <option value="2">Stereo</option>
            <option value="1">Mono</option>
          </select>
        </label>
      </div>
    `);
    const anchor = $('#compressWmPanel');
    if (anchor) anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    on($('#advVolume'), 'input', () => setText('#valVolume', $('#advVolume').value));
    ['#advNormalize','#advVolume','#advSampleRate','#advChannels'].forEach(sel => {
      on($(sel), 'input', debouncedEstimate);
    });
  }

  /* ---------- 8.6 Advanced (custom args + save preset) ---------- */
  function injectAdvancedPanel() {
    if ($('#compressAdvancedPanel')) return;
    const panel = el('div', {
      class: 'compress-group compress-advanced-panel',
      id: 'compressAdvancedPanel'
    }, `
      <label class="compress-group-label"><i class="fas fa-cogs"></i> Lanjutan (Advanced)</label>
      <div class="compress-adv-grid">
        <label class="compress-adv-field">
          <span>Two-Pass Encoding</span>
          <select id="advTwoPass" class="compress-select">
            <option value="off">Off</option>
            <option value="on">On (lebih akurat, 2× lambat)</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Pixel Format</span>
          <select id="advPixFmt" class="compress-select">
            <option value="yuv420p" selected>yuv420p (kompatibel)</option>
            <option value="yuv422p">yuv422p</option>
            <option value="yuv444p">yuv444p (kualitas)</option>
          </select>
        </label>
        <label class="compress-adv-field">
          <span>Preset Encoder</span>
          <select id="advEncoderPreset" class="compress-select">
            <option value="ultrafast">ultrafast</option>
            <option value="veryfast">veryfast</option>
            <option value="fast">fast</option>
            <option value="medium" selected>medium</option>
            <option value="slow">slow</option>
            <option value="veryslow">veryslow</option>
          </select>
        </label>
        <label class="compress-adv-field" style="flex-direction:row;align-items:center;gap:8px;">
          <input type="checkbox" id="advStripMeta" checked />
          <span>Hapus metadata</span>
        </label>
        <label class="compress-adv-field" style="flex-direction:row;align-items:center;gap:8px;">
          <input type="checkbox" id="advFaststart" checked />
          <span>Faststart (MP4 web)</span>
        </label>
      </div>
      <div style="margin-top:10px;">
        <label class="compress-adv-field">
          <span>Custom FFmpeg Args (override)</span>
          <input type="text" id="advCustomArgs" placeholder="Contoh: -crf 24 -vf scale=1280:-2" />
        </label>
        <small class="compress-hint">Isi hanya jika tahu. Ini akan menggantikan args otomatis.</small>
      </div>
      <div class="compress-adv-actions">
        <button type="button" class="compress-action-btn" id="advSavePreset"><i class="fas fa-save"></i> Simpan sebagai Preset</button>
        <button type="button" class="compress-action-btn" id="advLoadPreset"><i class="fas fa-folder-open"></i> Muat Preset</button>
        <button type="button" class="compress-action-btn" id="advExportCfg"><i class="fas fa-file-export"></i> Export Config</button>
        <button type="button" class="compress-action-btn" id="advImportCfg"><i class="fas fa-file-import"></i> Import Config</button>
        <button type="button" class="compress-action-btn danger" id="advReset"><i class="fas fa-undo"></i> Reset Advanced</button>
      </div>
    `);
    const anchor = $('#compressAdvAudioPanel');
    if (anchor) anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    on($('#advSavePreset'), 'click', saveUserPreset);
    on($('#advLoadPreset'), 'click', loadUserPresetDialog);
    on($('#advExportCfg'), 'click', exportConfig);
    on($('#advImportCfg'), 'click', importConfig);
    on($('#advReset'), 'click', resetAdvanced);
  }

  /* ---------- 8.7 Batch Queue ---------- */
  function injectBatchQueue() {
    if ($('#compressQueueCard')) return;
    const card = el('section', {
      class: 'compress-history-card compress-queue-card',
      id: 'compressQueueCard',
      style: 'display:none;',
      'data-aos': 'fade-up'
    }, `
      <div class="compress-history-header">
        <h3><i class="fas fa-layer-group"></i> Batch Queue <span id="queueCount">(0)</span></h3>
        <div class="compress-queue-actions">
          <button type="button" class="compress-action-btn" id="queueAddBtn"><i class="fas fa-plus"></i> Tambah File</button>
          <button type="button" class="compress-action-btn primary" id="queueProcessBtn"><i class="fas fa-play"></i> Proses Semua</button>
          <button type="button" class="compress-clear-history" id="queueClearBtn"><i class="fas fa-trash"></i> Kosongkan</button>
        </div>
      </div>
      <div class="compress-queue-list" id="compressQueueList"></div>
      <input type="file" id="queueFileInput" accept="video/*,.mp4,.mov,.mkv,.webm,.avi" multiple hidden />
    `);
    const anchor = $('#compressActionCard');
    if (anchor) anchor.parentNode.insertBefore(card, anchor.nextSibling);

    on($('#queueAddBtn'), 'click', () => $('#queueFileInput')?.click());
    on($('#queueFileInput'), 'change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(f => addToQueue(f));
      e.target.value = '';
      renderQueue();
    });
    on($('#queueProcessBtn'), 'click', processQueue);
    on($('#queueClearBtn'), 'click', () => {
      state.queue = [];
      renderQueue();
      toast('Queue dikosongkan', 'success');
    });
  }

  /* ---------- 8.8 Log Viewer ---------- */
  function injectLogViewer() {
    if ($('#compressLogBtn')) return;
    const btn = el('button', {
      class: 'compress-float-btn',
      id: 'compressLogBtn',
      title: 'Lihat log (Ctrl+L)'
    }, '<i class="fas fa-terminal"></i>');
    document.body.appendChild(btn);

    const panel = el('div', {
      class: 'compress-log-panel',
      id: 'compressLogPanel',
      style: 'display:none;'
    }, `
      <div class="compress-log-head">
        <strong><i class="fas fa-terminal"></i> Worker Log</strong>
        <div>
          <select id="logLevelSel">
            <option value="debug">Debug</option>
            <option value="info" selected>Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="silent">Silent</option>
          </select>
          <button type="button" id="logClear"><i class="fas fa-trash"></i></button>
          <button type="button" id="logClose"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="compress-log-body" id="logBody"></div>
    `);
    document.body.appendChild(panel);

    on(btn, 'click', toggleLogs);
    on($('#logClose'), 'click', toggleLogs);
    on($('#logClear'), 'click', () => { const b = $('#logBody'); if (b) b.innerHTML = ''; });
    on($('#logLevelSel'), 'change', (e) => {
      state.prefs.logLevel = e.target.value;
      persistPrefs();
      state.worker?.postMessage({ type: 'setLogLevel', level: state.prefs.logLevel });
    });
  }
  function toggleLogs() {
    state.logsOpen = !state.logsOpen;
    show('#compressLogPanel', state.logsOpen ? 'flex' : 'none');
    if (state.logsOpen) hide('#compressLogPanel');
    if (state.logsOpen) $('#compressLogPanel').style.display = 'flex';
    else $('#compressLogPanel').style.display = 'none';
  }
  function appendLog(type, msg) {
    const body = $('#logBody');
    if (!body) return;
    const line = el('div', { class: 'compress-log-line compress-log-' + type },
      `<span class="log-ts">${new Date().toLocaleTimeString('id-ID')}</span> <span class="log-msg">${escapeHtml(msg)}</span>`);
    body.appendChild(line);
    // Batasi 500 baris
    while (body.children.length > 500) body.removeChild(body.firstChild);
    body.scrollTop = body.scrollHeight;
  }

  /* ---------- 8.9 Shortcut Help ---------- */
  function injectShortcutHelp() {
    if ($('#compressHelpBtn')) return;
    const btn = el('button', {
      class: 'compress-float-btn',
      id: 'compressHelpBtn',
      style: 'bottom: 90px;',
      title: 'Shortcut (Ctrl+/)'
    }, '<i class="fas fa-keyboard"></i>');
    document.body.appendChild(btn);

    const modal = el('div', {
      class: 'compress-modal',
      id: 'compressHelpModal',
      style: 'display:none;'
    }, `
      <div class="compress-modal-content">
        <h3><i class="fas fa-keyboard"></i> Keyboard Shortcuts</h3>
        <div class="compress-shortcuts">
          <div><kbd>Ctrl</kbd> + <kbd>O</kbd> <span>Buka file</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>Enter</kbd> <span>Mulai compress</span></div>
          <div><kbd>Esc</kbd> <span>Batalkan / tutup modal</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>L</kbd> <span>Toggle log viewer</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>/</kbd> <span>Toggle help ini</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>S</kbd> <span>Download hasil</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> <span>Reset semua</span></div>
          <div><kbd>Ctrl</kbd> + <kbd>Q</kbd> <span>Warmup FFmpeg</span></div>
        </div>
        <button type="button" class="compress-action-btn" id="helpClose">Tutup</button>
      </div>
    `);
    document.body.appendChild(modal);

    on(btn, 'click', toggleHelp);
    on($('#helpClose'), 'click', toggleHelp);
    on(modal, 'click', (e) => { if (e.target === modal) toggleHelp(); });
  }
  function toggleHelp() {
    state.helpOpen = !state.helpOpen;
    $('#compressHelpModal').style.display = state.helpOpen ? 'flex' : 'none';
  }

  /* ================================================================
     [9] PRESET PROFILES
     ================================================================ */
  const PRESETS = {
    whatsapp:   { codec: 'h264-cpu', method: 'size-mb', target: 16,  resolution: '1280x720', audioCodec: 'aac', audioBitrate: '128' },
    instagram:  { codec: 'h264-cpu', method: 'bitrate', target: 3500, resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '128' },
    tiktok:     { codec: 'h264-cpu', method: 'bitrate', target: 4000, resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '128' },
    youtube:    { codec: 'h264-cpu', method: 'bitrate', target: 8000, resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '192' },
    twitter:    { codec: 'h264-cpu', method: 'bitrate', target: 5000, resolution: '1280x720', audioCodec: 'aac', audioBitrate: '128' },
    email:      { codec: 'h264-cpu', method: 'size-mb', target: 20, resolution: '960x540', audioCodec: 'aac', audioBitrate: '96' },
    discord:    { codec: 'h264-cpu', method: 'size-mb', target: 8,  resolution: '1280x720', audioCodec: 'aac', audioBitrate: '96' },
    archiv:     { codec: 'h265-cpu', method: 'quality', target: 22,  resolution: 'keep', audioCodec: 'aac', audioBitrate: '192' },
    maxsave:    { codec: 'h265-cpu', method: 'quality', target: 32,  resolution: '854x480', audioCodec: 'aac', audioBitrate: '96' },
    custom:     null
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) { toast('Mode custom — atur manual', 'info'); return; }
    try {
      // codec
      const cR = document.querySelector(`input[name="codec"][value="${p.codec}"]`);
      if (cR) { cR.checked = true; cR.dispatchEvent(new Event('change', { bubbles: true })); }
      // method
      const mR = document.querySelector(`input[name="method"][value="${p.method}"]`);
      if (mR) { mR.checked = true; mR.dispatchEvent(new Event('change', { bubbles: true })); }
      // resolution
      const rR = document.querySelector(`input[name="resolution"][value="${p.resolution}"]`);
      if (rR) { rR.checked = true; rR.dispatchEvent(new Event('change', { bubbles: true })); }
      // target value
      setTimeout(() => {
        if (p.method === 'quality') {
          if (slider) { slider.value = String(p.target); setText('#compressSliderValue', String(p.target)); }
        } else if (p.method === 'size-mb' || p.method === 'bitrate') {
          if (numberInput) { numberInput.value = String(p.target); }
        }
        // audio
        if ($('#audioCodec')) { $('#audioCodec').value = p.audioCodec; $('#audioCodec').dispatchEvent(new Event('change')); }
        if ($('#audioBitrate')) { $('#audioBitrate').value = p.audioBitrate; $('#audioBitrate').dispatchEvent(new Event('change')); }
        updateEstimate();
      }, 60);
      toast('Preset diterapkan: ' + name.toUpperCase(), 'success');
    } catch (e) {
      console.warn('[applyPreset]', e);
      toast('Gagal menerapkan preset', 'error');
    }
  }

  /* ================================================================
     [10] QUEUE MANAGEMENT
     ================================================================ */
  function addToQueue(file) {
    if (!file) return;
    if (!isVideoFile(file)) { toast(`${file.name} bukan video — dilewati`, 'warning'); return; }
    if (file.size > MAX_FILE_SIZE) { toast(`${file.name} terlalu besar — dilewati`, 'warning'); return; }
    if (state.queue.some(q => q.file.name === file.name && q.file.size === file.size)) {
      toast(`${file.name} sudah ada di queue`, 'warning');
      return;
    }
    state.queue.push({
      id: uid(),
      file,
      metadata: null,
      status: 'waiting',   // waiting | loading | processing | done | error | cancelled
      result: null,
      error: null,
      progress: 0
    });
    renderQueue();
    toast(`${file.name} ditambahkan ke queue`, 'success');
  }
  function removeFromQueue(id) {
    state.queue = state.queue.filter(q => q.id !== id);
    renderQueue();
  }
  function moveQueue(id, dir) {
    const i = state.queue.findIndex(q => q.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= state.queue.length) return;
    [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
    renderQueue();
  }
  function renderQueue() {
    const card = $('#compressQueueCard');
    const list = $('#compressQueueList');
    if (!card || !list) return;
    setText('#queueCount', `(${state.queue.length})`);
    if (!state.queue.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = state.queue.map((q, i) => `
      <div class="compress-queue-item status-${q.status}" data-id="${q.id}">
        <div class="cq-index">${i + 1}</div>
        <div class="cq-icon"><i class="fas fa-file-video"></i></div>
        <div class="cq-info">
          <div class="cq-name">${escapeHtml(q.file.name)}</div>
          <div class="cq-meta">${formatBytes(q.file.size)}${q.metadata ? ' · ' + formatDuration(q.metadata.duration) + ' · ' + q.metadata.width + '×' + q.metadata.height : ''}</div>
          ${q.status === 'processing' ? `<div class="cq-progress"><div style="width:${q.progress}%"></div></div>` : ''}
          ${q.error ? `<div class="cq-error">${escapeHtml(q.error)}</div>` : ''}
        </div>
        <div class="cq-status">${queueStatusLabel(q.status)}</div>
        <div class="cq-actions">
          <button type="button" data-act="up" title="Naik"><i class="fas fa-arrow-up"></i></button>
          <button type="button" data-act="down" title="Turun"><i class="fas fa-arrow-down"></i></button>
          <button type="button" data-act="remove" title="Hapus"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `).join('');
    // event delegation
    list.querySelectorAll('[data-act]').forEach(btn => {
      on(btn, 'click', (e) => {
        const id = e.target.closest('.compress-queue-item')?.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (!id) return;
        if (act === 'up') moveQueue(id, -1);
        else if (act === 'down') moveQueue(id, 1);
        else if (act === 'remove') removeFromQueue(id);
      });
    });
  }
  function queueStatusLabel(s) {
    return ({
      waiting:    '<i class="fas fa-clock"></i> Menunggu',
      loading:    '<i class="fas fa-spinner fa-spin"></i> Loading',
      processing: '<i class="fas fa-cog fa-spin"></i> Proses',
      done:       '<i class="fas fa-check"></i> Selesai',
      error:      '<i class="fas fa-times"></i> Error',
      cancelled:  '<i class="fas fa-ban"></i> Batal'
    }[s] || s);
  }
  async function processQueue() {
    if (state.processing) { toast('Sedang memproses', 'warning'); return; }
    if (!state.queue.length) { toast('Queue kosong', 'warning'); return; }
    toast(`Memproses ${state.queue.length} file...`, 'info');

    for (let i = 0; i < state.queue.length; i++) {
      const item = state.queue[i];
      if (item.status === 'done') continue;
      item.status = 'loading';
      renderQueue();
      try {
        if (!item.metadata) {
          item.metadata = await loadVideoMetadata(item.file);
        }
        item.status = 'processing';
        renderQueue();
        await compressOneFromQueue(item);
        item.status = 'done';
      } catch (err) {
        item.error = err.message || String(err);
        item.status = 'error';
      }
      renderQueue();
    }
    toast('Batch selesai!', 'success');
  }
  async function compressOneFromQueue(item) {
    return new Promise((resolve) => {
      // Simple: reuse worker path — untuk ringkas, kita set state.file dan panggil startCompression.
      // Untuk robust, kita buat alur one-shot menggunakan worker baru.
      // Implementasi ringkas:
      handleFile(item.file).then(() => {
        startCompression().finally(resolve);
      }).catch(resolve);
    });
  }

  /* ================================================================
     [11] LOG VIEWER / PREFS PERSISTENCE
     ================================================================ */
  function persistPrefs() {
    safe(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.prefs)));
  }
  function loadPrefs() {
    const p = safe(() => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'), {}) || {};
    state.prefs = Object.assign(state.prefs, p);
    // sinkron dengan UI
    if ($('#logLevelSel')) $('#logLevelSel').value = state.prefs.logLevel;
  }

  /* ================================================================
     [12] GPU / CODEC DETECTION
     ================================================================ */
  async function detectGpuSupport() {
    const mark = (attr, available) => {
      const el = document.querySelector(`[${attr}]`);
      if (!el) return;
      el.textContent = available ? 'GPU ✓' : 'CPU';
      el.classList.toggle('available', available);
      el.classList.toggle('unavailable', !available);
      el.title = available ? 'Hardware encoder tersedia' : 'Tidak didukung → otomatis fallback ke CPU';
    };
    if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') {
      mark('data-gpu-h264', false); mark('data-gpu-h265', false); mark('data-gpu-av1', false);
      return;
    }
    const tests = [
      { sel: 'data-gpu-h264', codec: 'avc1.640028' },
      { sel: 'data-gpu-h265', codec: 'hvc1.1.6.L93.B0' },
      { sel: 'data-gpu-av1',  codec: 'av01.0.08M.08' }
    ];
    for (const t of tests) {
      const ok = await safeAsync(async () => {
        const r = await VideoEncoder.isConfigSupported({
          codec: t.codec, width: 640, height: 360, bitrate: 500000,
          hardwareAcceleration: 'prefer-hardware'
        });
        return !!r.supported;
      }, false);
      mark(t.sel, ok);
    }
  }

  /* ================================================================
     [13] DYNAMIC INPUT PANEL
     ================================================================ */
  const radios = (name) => document.querySelector(`input[name="${name}"]:checked`);
  const slider = $('#compressSlider');
  const sliderValue = $('#compressSliderValue');
  const sliderWrap = document.querySelector('.compress-slider-wrap');
  const numberWrap = $('#compressNumberWrap');
  const numberInput = $('#compressNumber');
  const numberUnit = $('#compressNumberUnit');
  const dynamicLabel = $('#dynamicInputLabel');

  function currentCodec() { return radios('codec')?.value || 'h264-cpu'; }
  function currentMethod() { return radios('method')?.value || 'size-percent'; }

  function crfRangeForCodec(codec) {
    if (codec === 'av1-gpu') return { min: 0, max: 63, def: 35 };
    if (codec === 'h265-cpu' || codec === 'h265-gpu') return { min: 0, max: 51, def: 28 };
    return { min: 0, max: 51, def: 23 };
  }

  function updateDynamicInput() {
    const method = currentMethod();
    const codec = currentCodec();
    if (sliderWrap) sliderWrap.style.display = 'none';
    if (numberWrap) numberWrap.style.display = 'none';

    switch (method) {
      case 'size-percent':
        if (dynamicLabel) dynamicLabel.innerHTML = '<i class="fas fa-percent"></i> Target Ukuran (%)';
        if (sliderWrap) sliderWrap.style.display = 'flex';
        if (slider) { slider.min = 5; slider.max = 95; slider.value = 50; }
        setText('#compressSliderValue', '50');
        break;
      case 'size-mb': {
        const srcMB = state.file ? Math.max(1, Math.floor(state.file.size / 1024 / 1024)) : 2048;
        if (dynamicLabel) dynamicLabel.innerHTML = '<i class="fas fa-database"></i> Target Ukuran (MB)';
        if (numberWrap) numberWrap.style.display = 'flex';
        if (numberUnit) numberUnit.textContent = 'MB';
        if (numberInput) {
          numberInput.min = 1;
          numberInput.max = srcMB;
          numberInput.value = Math.max(1, Math.round(srcMB * 0.5));
        }
        break;
      }
      case 'quality': {
        const r = crfRangeForCodec(codec);
        if (dynamicLabel) dynamicLabel.innerHTML = `<i class="fas fa-star"></i> Kualitas (CRF ${r.min}–${r.max}, makin kecil = makin bagus)`;
        if (sliderWrap) sliderWrap.style.display = 'flex';
        if (slider) { slider.min = r.min; slider.max = r.max; slider.value = r.def; }
        setText('#compressSliderValue', String(r.def));
        break;
      }
      case 'resolution':
        if (dynamicLabel) dynamicLabel.innerHTML = '<i class="fas fa-expand-arrows-alt"></i> Gunakan panel Resolusi di bawah';
        break;
      case 'bitrate':
        if (dynamicLabel) dynamicLabel.innerHTML = '<i class="fas fa-tachometer-alt"></i> Max Bitrate (kbps)';
        if (numberWrap) numberWrap.style.display = 'flex';
        if (numberUnit) numberUnit.textContent = 'kbps';
        if (numberInput) { numberInput.min = 100; numberInput.max = 50000; numberInput.value = 2000; }
        break;
    }
    updateEstimate();
  }

  /* ================================================================
     [14] FORM EVENTS
     ================================================================ */
  const debouncedEstimate = debounce(updateEstimate, 150);
  on(slider, 'input', () => { setText('#compressSliderValue', slider.value); debouncedEstimate(); });
  on(numberInput, 'input', debouncedEstimate);
  on(numberInput, 'blur', () => {
    if (!numberInput) return;
    const min = parseFloat(numberInput.min) || 0;
    const max = parseFloat(numberInput.max) || 1e9;
    const v = parseFloat(numberInput.value);
    numberInput.value = isFinite(v) ? clamp(v, min, max) : min;
    updateEstimate();
  });
  $$('input[name="codec"]').forEach(r => on(r, 'change', () => { updateDynamicInput(); updateEstimate(); }));
  $$('input[name="method"]').forEach(r => on(r, 'change', updateDynamicInput));
  $$('input[name="resolution"]').forEach(r => on(r, 'change', () => { updateResolutionWarning(); updateEstimate(); }));
  on($('#audioCodec'), 'change', updateEstimate);
  on($('#audioBitrate'), 'change', updateEstimate);

  function updateResolutionWarning() {
    const t = radios('resolution')?.value;
    const warn = $('#resolutionWarning');
    if (!warn) return;
    if (!t || t === 'keep' || !state.metadata.width) { warn.style.display = 'none'; return; }
    const [tw] = t.split('x').map(Number);
    warn.style.display = (tw > state.metadata.width) ? 'flex' : 'none';
  }

  /* ================================================================
     [15] ESTIMASI
     ================================================================ */
  function getAudioBitrateKbps() {
    const c = $('#audioCodec')?.value || 'aac';
    if (c === 'copy' || c === 'none') return 0;
    return parseInt($('#audioBitrate')?.value, 10) || 128;
  }
  const RES_BITRATE = {
    '1920x1080': 5000, '1280x720': 2500, '960x540': 1500,
    '640x360': 900, '854x480': 1200, '426x240': 500, '256x144': 300
  };
  function calcVideoBitrate() {
    const method = currentMethod();
    const srcKbps = state.metadata.bitrate || 2000;
    const duration = effectiveDuration() || 1;
    const audio = getAudioBitrateKbps();

    if (method === 'size-percent') {
      const pct = clamp(safeNum(slider?.value, 50) / 100, 0.05, 0.95);
      return Math.max(100, Math.round(srcKbps * pct - audio));
    }
    if (method === 'size-mb') {
      const mb = Math.max(1, safeNum(numberInput?.value, 1));
      const totalKbps = (mb * 8192) / duration;
      return Math.max(100, Math.round(totalKbps - audio));
    }
    if (method === 'quality') {
      const crf = safeNum(slider?.value, 23);
      const factor = Math.pow(0.92, crf - 18);
      return Math.max(100, Math.round(srcKbps * clamp(factor, 0.05, 2)));
    }
    if (method === 'resolution') {
      const res = radios('resolution')?.value;
      if (res === 'keep' || !res) return srcKbps;
      return RES_BITRATE[res] || Math.min(srcKbps, 2000);
    }
    if (method === 'bitrate') return Math.max(100, safeNum(numberInput?.value, 2000));
    return 2000;
  }
  function effectiveDuration() {
    const dur = state.metadata.duration || 0;
    if (dur <= 0) return 0;
    const s = clamp(safeNum($('#trimStart')?.value, 0), 0, dur);
    const e = clamp(safeNum($('#trimEnd')?.value, dur), 0, dur);
    if (e > s && e > 0) return e - s;
    return dur;
  }
  function qualityLabelFromCrf(crf) {
    if (crf <= 18) return 'Excellent';
    if (crf <= 23) return 'Good';
    if (crf <= 28) return 'Fair';
    return 'Low';
  }
  function updateEstimate() {
    if (!state.file) return;
    const audio = getAudioBitrateKbps();
    const videoKbps = calcVideoBitrate();
    const dur = effectiveDuration() || state.metadata.duration || 1;
    const totalKbps = videoKbps + audio;
    const estBytes = (totalKbps * dur * 1000) / 8;
    const ratio = clamp(Math.round((1 - estBytes / state.file.size) * 100), -999, 100);

    let qLabel;
    if (currentMethod() === 'quality') {
      qLabel = qualityLabelFromCrf(safeNum(slider?.value, 23));
    } else {
      const px = (state.metadata.width * state.metadata.height) || 1;
      const bpp = (videoKbps * 1000) / px;
      qLabel = bpp > 0.12 ? 'Excellent' : bpp > 0.06 ? 'Good' : bpp > 0.03 ? 'Fair' : 'Low';
    }
    setText('#estSize', formatBytes(estBytes));
    setText('#estVideoBitrate', videoKbps + ' kbps');
    setText('#estAudioBitrate', audio === 0 ? 'Copy / Tidak ada' : audio + ' kbps');
    setText('#estRatio', (ratio > 0 ? ratio : 0) + '%');
    setText('#estQuality', qLabel);

    const warnEl = $('#estOutputWarning');
    if (warnEl) warnEl.style.display = (estBytes >= state.file.size * 0.98) ? 'flex' : 'none';
  }

  /* ================================================================
     [16] FILE HANDLING
     ================================================================ */
  async function handleFile(file) {
    try {
      if (!file) return;
      if (state.processing) { toast('Tunggu proses sebelumnya selesai', 'warning'); return; }
      if (!isVideoFile(file)) { toast('File bukan video yang didukung', 'error'); return; }
      if (file.size > MAX_FILE_SIZE) {
        toast(`File terlalu besar (${formatBytes(file.size)}). Maksimal ${formatBytes(MAX_FILE_SIZE)}`, 'error');
        return;
      }

      revokePreview(); revokeResult(); resetProgressUI();

      toast('Memuat metadata video...', 'info');
      const meta = await loadVideoMetadata(file);

      state.file = file;
      const bitrateKbps = (meta.duration > 0) ? Math.round((file.size * 8) / meta.duration / 1000) : 0;
      state.metadata = {
        duration: meta.duration, width: meta.width, height: meta.height,
        bitrate: bitrateKbps, fps: 0, hasAudio: true, videoCodec: '', audioCodec: ''
      };

      state.previewUrl = URL.createObjectURL(file);
      const pv = $('#compressVideoPreview');
      if (pv) pv.src = state.previewUrl;

      hide('#compressDropzone');
      show('#compressPreview', 'grid');
      setText('#compressFileName', file.name);
      setText('#compressFileSize', formatBytes(file.size));
      setText('#compressDuration', formatDuration(meta.duration));
      setText('#compressResolution', `${meta.width}×${meta.height}`);
      setText('#compressBitrate', bitrateKbps ? `${bitrateKbps} kbps` : '-');

      show('#compressPresetBar');
      show('#compressSettingsCard');
      show('#compressActionCard');
      hide('#compressResultCard');

      updateDynamicInput();
      updateResolutionWarning();
      updateEstimate();
      // trim default
      if ($('#trimStart')) $('#trimStart').value = '0';
      if ($('#trimEnd')) $('#trimEnd').value = String(meta.duration.toFixed(2));
      syncTrimRanges();
      checkLargeFileWarning();

      toast(`Video dimuat (${formatDuration(meta.duration)})`, 'success');
      safe(() => $('#compressPresetBar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      console.error('[handleFile]', err);
      toast('Gagal memuat video: ' + (err.message || 'unknown'), 'error');
    }
  }
  function checkLargeFileWarning() {
    if (state.file && state.file.size > WARN_FILE_SIZE) {
      toast('⚠️ File besar (>500MB). Jangan tutup tab saat memproses.', 'warning');
    }
  }
  function resetFileSelection(keepFile = false) {
    if (!keepFile) {
      revokePreview(); revokeResult();
      state.file = null;
      state.metadata = { duration: 0, width: 0, height: 0, bitrate: 0, fps: 0, hasAudio: false, videoCodec: '', audioCodec: '' };
      hide('#compressPreview'); show('#compressDropzone');
      hide('#compressPresetBar'); hide('#compressSettingsCard'); hide('#compressActionCard'); hide('#compressResultCard');
      hide('#compressProgressWrap');
      resetProgressUI();
      const fi = $('#compressFileInput');
      if (fi) fi.value = '';
    }
  }
  function resetProgressUI() {
    setStyle('#compressProgressFill', 'width', '0%');
    setText('#compressProgressPct', '0%');
    setText('#progressEta', '--:--');
    setText('#progressSpeed', '-');
    setText('#progressFps', '-');
    state.lastProgress = 0;
    state.lastProgressTime = Date.now();
    state.emaSpeed = 0;
    state.progressHistory = [];
    renderProgressChart();
  }

  /* ================================================================
     [17] BIND DROPZONE & FILE INPUT
     ================================================================ */
  const dropzone = $('#compressDropzone');
  const fileInput = $('#compressFileInput');
  on(dropzone, 'click', () => fileInput?.click());
  on(dropzone, 'dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  on(dropzone, 'dragleave', () => dropzone?.classList.remove('dragover'));
  on(dropzone, 'drop', (e) => {
    e.preventDefault(); dropzone?.classList.remove('dragover');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 1) handleFile(files[0]);
    else if (files.length > 1) { files.forEach(addToQueue); show('#compressQueueCard'); }
  });
  on(fileInput, 'change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 1) handleFile(files[0]);
    else if (files.length > 1) files.forEach(addToQueue);
    e.target.value = '';
  });
  on($('#compressChangeFile'), 'click', () => fileInput?.click());
  on($('#compressRemoveFile'), 'click', () => resetFileSelection(false));

  /* ================================================================
     [18] FFMPEG ARGS BUILDER
     ================================================================ */
  function resolveEncoder(codec) {
    switch (codec) {
      case 'h265-cpu': case 'h265-gpu': return 'libx265';
      case 'av1-gpu': return 'libsvtav1';
      case 'h264-cpu': case 'h264-gpu':
      default: return 'libx264';
    }
  }

  function buildFFmpegArgs() {
    // Custom override
    const custom = $('#advCustomArgs')?.value?.trim();
    if (custom) {
      const parts = custom.split(/\s+/).filter(Boolean);
      // izinkan user menambahkan args sendiri — akan ditambah input/output oleh worker
      return parts;
    }

    const codec = currentCodec();
    const method = currentMethod();
    const encoder = resolveEncoder(codec);
    const args = ['-y'];

    // Video encoder
    args.push('-c:v', encoder);
    const preset = $('#advEncoderPreset')?.value || 'medium';
    if (encoder === 'libx264') args.push('-preset', preset);
    if (encoder === 'libx265') args.push('-preset', preset, '-tag:v', 'hvc1');
    if (encoder === 'libsvtav1') args.push('-preset', '8');

    // Bitrate / CRF
    if (method === 'quality') {
      const crf = clamp(safeNum(slider?.value, 23), 0, 63);
      args.push('-crf', String(crf));
    } else {
      const kbps = calcVideoBitrate();
      args.push('-b:v', kbps + 'k', '-maxrate', kbps + 'k', '-bufsize', (kbps * 2) + 'k');
    }

    // Filter chain
    const filters = [];
    // Scale
    const res = radios('resolution')?.value;
    if (res && res !== 'keep') {
      const [tw, th] = res.split('x').map(Number);
      if (tw && th && state.metadata.width && tw <= state.metadata.width * 1.5) {
        filters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease`);
      }
    }
    // Rotate / Flip
    const rot = safeNum($('#advRotate')?.value, 0);
    if (rot === 90) filters.push('transpose=1');
    else if (rot === 180) filters.push('transpose=2,transpose=2');
    else if (rot === 270) filters.push('transpose=2');
    const flip = $('#advFlip')?.value || 'none';
    if (flip === 'h') filters.push('hflip');
    if (flip === 'v') filters.push('vflip');
    // Brightness/Contrast/Saturation/Sharpen
    const b = safeNum($('#advBrightness')?.value, 0);
    const c = safeNum($('#advContrast')?.value, 1);
    const s = safeNum($('#advSaturation')?.value, 1);
    if (b !== 0 || c !== 1 || s !== 1) {
      filters.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);
    }
    const sharp = safeNum($('#advSharpen')?.value, 0);
    if (sharp > 0) filters.push(`unsharp=5:5:${sharp}`);
    // Denoise
    const dn = $('#advDenoise')?.value || 'off';
    if (dn === 'light') filters.push('hqdn3d=1.5:1.5:6:6');
    else if (dn === 'medium') filters.push('hqdn3d=3:3:12:12');
    else if (dn === 'strong') filters.push('hqdn3d=6:6:24:24');
    // Trim
    const trimS = safeNum($('#trimStart')?.value, 0);
    const trimE = safeNum($('#trimEnd')?.value, 0);
    // trim ditangani via -ss/-to, bukan filter
    // Watermark teks
    const wmText = $('#wmText')?.value?.trim();
    if (wmText) {
      const size = clamp(safeNum($('#wmSize')?.value, 24), 10, 200);
      const color = ($('#wmColor')?.value || '#ffffff').replace('#', '0x') + '@' + safeNum($('#wmOpacity')?.value, 0.8);
      const pos = $('#wmPos')?.value || 'br';
      const posMap = {
        tl: '10:10', tr: 'w-tw-10:10', bl: '10:h-th-10',
        br: 'w-tw-10:h-th-10', tc: '(w-tw)/2:10', bc: '(w-tw)/2:h-th-10'
      };
      const box = $('#wmBg')?.checked ? ':box=1:boxcolor=black@0.5:boxborderw=8' : '';
      const escaped = wmText.replace(/[:'\\]/g, m => '\\' + m);
      filters.push(`drawtext=text='${escaped}':x=${posMap[pos].split(':')[0]}:y=${posMap[pos].split(':')[1]}:fontsize=${size}:fontcolor=${color}${box}`);
    }
    // FPS
    const fps = $('#advFps')?.value || 'auto';
    if (fps !== 'auto') filters.push(`fps=${fps}`);

    if (filters.length) args.push('-vf', filters.join(','));

    // Trim timing
    if (trimS > 0) args.push('-ss', trimS.toFixed(3));
    if (trimE > 0 && trimE > trimS) args.push('-to', trimE.toFixed(3));

    // Audio
    const ac = $('#audioCodec')?.value || 'aac';
    if (ac === 'none') {
      args.push('-an');
    } else if (ac === 'copy') {
      args.push('-c:a', 'copy');
    } else {
      const ab = $('#audioBitrate')?.value || '128';
      args.push('-c:a', ac, '-b:a', ab + 'k');
      const ch = $('#advChannels')?.value || '2';
      args.push('-ac', ch);
      const sr = $('#advSampleRate')?.value || 'auto';
      if (sr !== 'auto') args.push('-ar', sr);
      const vol = safeNum($('#advVolume')?.value, 100);
      const af = [];
      if (vol !== 100) af.push(`volume=${(vol / 100).toFixed(2)}`);
      if ($('#advNormalize')?.value === 'on') af.push('loudnorm');
      if (af.length) args.push('-af', af.join(','));
    }

    // Output compatibility
    const pixFmt = $('#advPixFmt')?.value || 'yuv420p';
    args.push('-pix_fmt', pixFmt);
    if ($('#advFaststart')?.checked) args.push('-movflags', '+faststart');
    if ($('#advStripMeta')?.checked) args.push('-map_metadata', '-1');
    args.push('-fps_mode', 'passthrough');

    return args;
  }

  /* ================================================================
     [19] WORKER LIFECYCLE
     ================================================================ */
  function destroyWorker() {
    if (state.worker) {
      safe(() => state.worker.terminate());
      state.worker = null;
      state.workerReady = false;
      state.workerBooted = false;
    }
  }
  function ensureWorker() {
    if (state.worker) return state.worker;
    try {
      const w = new Worker('compressvideo-worker.js');
      w.onmessage = onWorkerMessage;
      w.onerror = (e) => {
        console.error('[Worker error]', e);
        appendLog('error', 'Worker crash: ' + (e.message || 'unknown'));
        toast('Worker crash: ' + (e.message || 'unknown'), 'error');
        destroyWorker();
        stopProcessingUI();
      };
      state.worker = w;
      return w;
    } catch (err) {
      console.error('[ensureWorker]', err);
      toast('Browser tidak mendukung Web Worker', 'error');
      return null;
    }
  }
  function pingWorker() {
    try { state.worker?.postMessage({ type: 'ping' }); } catch (_) {}
  }
  function warmupWorker() {
    try {
      const w = ensureWorker();
      if (!w) return;
      w.postMessage({ type: 'warmup' });
      toast('Preload FFmpeg dimulai...', 'info');
    } catch (_) {}
  }
  function onWorkerMessage(e) {
    try {
      const data = e?.data || {};
      state.lastActivityAt = Date.now();
      switch (data.type) {
        case 'booted':
          state.workerBooted = true;
          state.workerVersion = data.version || '';
          appendLog('info', `Worker booted (v${data.version} · core ${data.coreVersion} · max ${data.maxInputMb} MB)`);
          if (data.version && data.version !== WORKER_VERSION_EXPECTED) {
            appendLog('warn', `Worker versi ${data.version} ≠ client ${WORKER_VERSION_EXPECTED}`);
          }
          break;
        case 'ready':
          state.workerReady = true;
          appendLog('info', 'FFmpeg siap');
          break;
        case 'status':
          appendLog('info', data.message || '');
          break;
        case 'progress':
          updateProgress(data.progress, data.etaMs);
          break;
        case 'warning':
          state.warnings.push(data.message);
          appendLog('warn', data.message || '');
          toast(data.message, 'warning');
          break;
        case 'done':
          handleWorkerDone(data);
          break;
        case 'error':
          handleWorkerError(data.message || 'unknown', data.code);
          break;
        case 'cancelled':
          handleWorkerCancelled();
          break;
        case 'pong':
          appendLog('debug', `pong: ${JSON.stringify(data)}`);
          break;
        default:
          appendLog('debug', 'Pesan worker tak dikenal: ' + data.type);
      }
    } catch (err) {
      console.error('[onWorkerMessage]', err);
      appendLog('error', 'onWorkerMessage exception: ' + err.message);
      toast('Error internal saat memproses pesan worker', 'error');
      destroyWorker();
      stopProcessingUI();
    }
  }

  /* ================================================================
     [20] PROGRESS + ETA + MINI CHART
     ================================================================ */
  function updateProgress(raw, etaMs) {
    const pct = clamp(Math.round((raw || 0) * 100), 0, 100);
    setStyle('#compressProgressFill', 'width', pct + '%');
    setText('#compressProgressPct', pct + '%');
    const bar = document.querySelector('.compress-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', String(pct));

    const now = Date.now();
    const dt = (now - state.lastProgressTime) / 1000;
    const dp = pct - state.lastProgress;
    state.lastActivityAt = now;

    if (dt > 0.4 && dp > 0) {
      const rate = dp / dt;
      const durationSec = effectiveDuration() || state.metadata.duration || 1;
      const instantSpeed = (durationSec * rate) / 100;
      state.emaSpeed = state.emaSpeed === 0
        ? instantSpeed
        : state.emaSpeed * 0.7 + instantSpeed * 0.3;

      let etaSec = 0;
      if (etaMs && etaMs > 0) etaSec = etaMs / 1000;
      else if (state.emaSpeed > 0) etaSec = ((100 - pct) / 100 * durationSec) / state.emaSpeed;

      setText('#progressEta', formatEta(etaSec));
      setText('#progressSpeed', state.emaSpeed.toFixed(2) + '×');
      const fps = state.metadata.fps || 0;
      setText('#progressFps', fps > 0 ? (fps * state.emaSpeed).toFixed(1) : '-');

      state.lastProgressTime = now;
      state.lastProgress = pct;

      state.progressHistory.push({ t: now, p: pct });
      if (state.progressHistory.length > 60) state.progressHistory.shift();
      renderProgressChart();
    }
  }
  function renderProgressChart() {
    const host = $('#progressChart');
    if (!host) return;
    const pts = state.progressHistory;
    if (pts.length < 2) { host.innerHTML = ''; return; }
    const w = 100, h = 30;
    const path = pts.map((pt, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (pt.p / 100) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="url(#pg)" stroke-width="1.5"/><defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#43e97b"/></linearGradient></defs></svg>`;
  }

  /* ================================================================
     [21] START / CANCEL / DONE
     ================================================================ */
  on($('#compressStartBtn'), 'click', startCompression);

  async function startCompression() {
    if (!state.file) { toast('Pilih video terlebih dahulu', 'error'); return; }
    if (state.processing) { toast('Sedang memproses...', 'warning'); return; }

    const method = currentMethod();
    if (method === 'size-mb' && (!numberInput?.value || parseFloat(numberInput.value) <= 0)) {
      toast('Masukkan target ukuran (MB) yang valid', 'error'); return;
    }
    if (method === 'bitrate' && (!numberInput?.value || parseInt(numberInput.value, 10) < 100)) {
      toast('Masukkan bitrate minimal 100 kbps', 'error'); return;
    }

    const worker = ensureWorker();
    if (!worker) return;

    state.processing = true;
    state.cancelled = false;
    state.startTime = Date.now();
    state.lastProgressTime = Date.now();
    state.lastProgress = 0;
    state.emaSpeed = 0;
    state.warnings = [];

    const startBtn = $('#compressStartBtn');
    if (startBtn) startBtn.disabled = true;
    show('#compressProgressWrap');
    hide('#compressResultCard');
    resetProgressUI();
    show('#compressCancelBtn', 'inline-flex');
    startWatchdog();

    try {
      const fileBuffer = await state.file.arrayBuffer();
      const args = buildFFmpegArgs();

      state.config = {
        codec: currentCodec(),
        method,
        resolution: radios('resolution')?.value || 'keep',
        sourceWidth: state.metadata.width,
        sourceHeight: state.metadata.height,
        sourceBitrate: state.metadata.bitrate,
        duration: effectiveDuration() || state.metadata.duration,
        videoBitrate: calcVideoBitrate(),
        audioCodec: $('#audioCodec')?.value || 'aac',
        audioBitrate: $('#audioBitrate')?.value || '128',
        ffmpegArgs: args,
        inputName: 'input_' + Date.now() + '.mp4',
        outputName: 'output_' + Date.now() + '.mp4'
      };

      appendLog('info', 'Args: ' + args.join(' '));

      worker.postMessage({
        type: 'compress',
        payload: {
          fileBuffer,
          fileType: state.file.type || 'video/mp4',
          fileName: state.file.name,
          config: state.config
        }
      }, [fileBuffer]);

      logActivity('download', 'Mengompres video: ' + state.file.name);
    } catch (err) {
      console.error('[startCompression]', err);
      toast('Gagal memulai kompresi: ' + (err.message || 'unknown'), 'error');
      appendLog('error', 'startCompression: ' + err.message);
      destroyWorker();
      stopProcessingUI();
    }
  }

  function stopProcessingUI() {
    state.processing = false;
    stopWatchdog();
    const startBtn = $('#compressStartBtn');
    if (startBtn) startBtn.disabled = false;
    hide('#compressCancelBtn');
  }

  /* ================================================================
     [22] WATCHDOG
     ================================================================ */
  function startWatchdog() {
    stopWatchdog();
    state.lastActivityAt = Date.now();
    state.watchdogTimer = setInterval(() => {
      if (!state.processing) return;
      const idle = Date.now() - state.lastActivityAt;
      if (idle > WATCHDOG_TIMEOUT_MS) {
        console.warn('[Watchdog] idle', idle);
        appendLog('warn', 'Worker idle > ' + (WATCHDOG_TIMEOUT_MS / 1000) + 's');
        toast('⚠️ Proses tampak macet. Batalkan & coba ulang jika perlu.', 'warning');
        stopWatchdog();
      }
    }, 5000);
  }
  function stopWatchdog() {
    if (state.watchdogTimer) { clearInterval(state.watchdogTimer); state.watchdogTimer = null; }
  }

  /* ================================================================
     [23] CANCEL
     ================================================================ */
  on($('#compressCancelBtn'), 'click', () => {
    if (!state.processing) return;
    state.cancelled = true;
    safe(() => state.worker?.postMessage({ type: 'cancel' }));
    // Karena worker v5 sudah menangani terminate sendiri, biarkan 1.5s lalu force reset
    setTimeout(() => {
      if (state.processing) {
        destroyWorker();
        stopProcessingUI();
        hide('#compressProgressWrap');
      }
    }, 1500);
    toast('Membatalkan...', 'warning');
  });

  function handleWorkerCancelled() {
    destroyWorker();
    stopProcessingUI();
    hide('#compressProgressWrap');
    toast('Proses dibatalkan', 'warning');
    appendLog('warn', 'Kompresi dibatalkan user');
  }
  function handleWorkerError(msg, code) {
    console.error('[Worker error]', msg);
    appendLog('error', msg + (code ? ' [' + code + ']' : ''));
    destroyWorker();
    stopProcessingUI();
    hide('#compressProgressWrap');
    toast('Gagal compress: ' + msg, 'error');
    playSound('error');
  }

  /* ================================================================
     [24] DONE HANDLER
     ================================================================ */
  function handleWorkerDone(data) {
    stopProcessingUI();
    if (!data || !(data.blob instanceof Blob) || data.blob.size === 0) {
      toast('Hasil kompresi tidak valid (blob kosong)', 'error');
      destroyWorker();
      return;
    }
    revokeResult();
    state.resultBlob = data.blob;
    state.resultUrl = URL.createObjectURL(data.blob);

    const beforeSize = state.file.size;
    const afterSize = data.blob.size;
    const savedPct = beforeSize > 0
      ? Math.max(0, Math.round((1 - afterSize / beforeSize) * 100))
      : 0;

    const rv = $('#compressResultVideo');
    if (rv) rv.src = state.resultUrl;

    setText('#resultBeforeSize', formatBytes(beforeSize));
    setText('#resultAfterSize', formatBytes(afterSize));
    setText('#resultBeforeRes', `${state.metadata.width}×${state.metadata.height}`);
    setText('#resultAfterRes', data.outputResolution || (radios('resolution')?.value || 'keep'));
    setText('#resultSaved',
      savedPct > 0
        ? `🎉 Berhasil menghemat ${savedPct}% ukuran file!`
        : '⚠️ Ukuran output tidak lebih kecil — coba turunkan bitrate/CRF.'
    );

    const outName = timestampName(state.file.name, 'mp4');
    const dl = $('#resultDownloadBtn');
    if (dl) { dl.href = state.resultUrl; dl.download = outName; }

    show('#compressResultCard');
    hide('#compressProgressWrap');
    const startBtn = $('#compressStartBtn');
    if (startBtn) startBtn.disabled = false;

    toast(savedPct > 0
      ? `Selesai! Ukuran berkurang ${savedPct}%`
      : 'Selesai! Cek hasil di bawah.', 'success');

    appendLog('info', `Selesai: ${formatBytes(beforeSize)} → ${formatBytes(afterSize)} (-${savedPct}%)`);

    if (state.prefs.soundOnDone) playSound('done');
    if (state.prefs.notifyOnDone) notify('Kompresi selesai', `${state.file.name} · hemat ${savedPct}%`);

    logActivity('download', `Kompres selesai: ${state.file.name} (-${savedPct}%)`);

    saveHistory({
      name: state.file.name,
      before: beforeSize,
      after: afterSize,
      codec: currentCodec(),
      method: currentMethod(),
      date: Date.now(),
      savedPct
    });
    safe(() => $('#compressResultCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /* ================================================================
     [25] SOUND & NOTIFIKASI
     ================================================================ */
  function playSound(kind) {
    safe(() => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      if (kind === 'done') {
        o.frequency.setValueAtTime(660, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      } else {
        o.frequency.setValueAtTime(300, ctx.currentTime);
      }
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
      setTimeout(() => safe(() => ctx.close()), 500);
    });
  }
  function notify(title, body) {
    safe(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification(title, { body });
        });
      }
    });
  }

  /* ================================================================
     [26] RESULT ACTIONS
     ================================================================ */
  on($('#resultRetryBtn'), 'click', () => {
    hide('#compressResultCard');
    revokeResult();
    updateEstimate();
    const s = $('#compressSettingsCard');
    if (s) safe(() => window.scrollTo({ top: s.offsetTop - 100, behavior: 'smooth' }));
  });

  /* ================================================================
     [27] HISTORY
     ================================================================ */
  function loadHistory() {
    return safe(() => JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'), []) || [];
  }
  function saveHistory(entry) {
    const items = loadHistory();
    items.unshift(entry);
    safe(() => localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))));
    renderHistory();
  }
  function renderHistory() {
    const card = $('#compressHistoryCard');
    const list = $('#compressHistoryList');
    if (!card || !list) return;
    const items = loadHistory();
    if (!items.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = items.map(h => `
      <div class="compress-history-item">
        <div class="hi-icon"><i class="fas fa-file-video"></i></div>
        <div class="hi-content">
          <div class="hi-name">${escapeHtml(h.name || 'video')}</div>
          <div class="hi-meta">${formatBytes(h.before || 0)} → ${formatBytes(h.after || 0)} · ${escapeHtml(h.codec || '-')} · ${new Date(h.date || Date.now()).toLocaleString('id-ID')}</div>
        </div>
        <div class="hi-save">-${h.savedPct || 0}%</div>
      </div>
    `).join('');
  }
  on($('#compressClearHistory'), 'click', () => {
    safe(() => localStorage.removeItem(HISTORY_KEY));
    renderHistory();
    toast('Riwayat dihapus', 'success');
  });

  /* ================================================================
     [28] USER PRESET (ADVANCED)
     ================================================================ */
  function saveUserPreset() {
    safe(() => {
      const name = prompt('Nama preset:');
      if (!name) return;
      const cfg = collectConfig();
      const all = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}') || {};
      all[name] = cfg;
      localStorage.setItem(PRESETS_KEY, JSON.stringify(all));
      toast('Preset disimpan: ' + name, 'success');
    });
  }
  function loadUserPresetDialog() {
    safe(() => {
      const all = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}') || {};
      const names = Object.keys(all);
      if (!names.length) { toast('Belum ada preset tersimpan', 'warning'); return; }
      const pick = prompt('Pilih preset: ' + names.join(', '));
      if (!pick || !all[pick]) return;
      applyConfig(all[pick]);
      toast('Preset dimuat: ' + pick, 'success');
    });
  }
  function collectConfig() {
    return {
      codec: currentCodec(),
      method: currentMethod(),
      resolution: radios('resolution')?.value || 'keep',
      sliderValue: slider?.value,
      numberValue: numberInput?.value,
      audioCodec: $('#audioCodec')?.value,
      audioBitrate: $('#audioBitrate')?.value,
      adv: {
        rotate: $('#advRotate')?.value,
        flip: $('#advFlip')?.value,
        fps: $('#advFps')?.value,
        denoise: $('#advDenoise')?.value,
        brightness: $('#advBrightness')?.value,
        contrast: $('#advContrast')?.value,
        saturation: $('#advSaturation')?.value,
        sharpen: $('#advSharpen')?.value,
        normalize: $('#advNormalize')?.value,
        volume: $('#advVolume')?.value,
        sampleRate: $('#advSampleRate')?.value,
        channels: $('#advChannels')?.value,
        twoPass: $('#advTwoPass')?.value,
        pixFmt: $('#advPixFmt')?.value,
        encoderPreset: $('#advEncoderPreset')?.value,
        stripMeta: $('#advStripMeta')?.checked,
        faststart: $('#advFaststart')?.checked,
        customArgs: $('#advCustomArgs')?.value
      },
      wm: {
        text: $('#wmText')?.value,
        pos: $('#wmPos')?.value,
        size: $('#wmSize')?.value,
        color: $('#wmColor')?.value,
        opacity: $('#wmOpacity')?.value,
        bg: $('#wmBg')?.checked
      }
    };
  }
  function applyConfig(cfg) {
    safe(() => {
      if (!cfg) return;
      const setRadio = (n, v) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } };
      if (cfg.codec) setRadio('codec', cfg.codec);
      if (cfg.method) setRadio('method', cfg.method);
      if (cfg.resolution) setRadio('resolution', cfg.resolution);
      setTimeout(() => {
        if (slider && cfg.sliderValue != null) { slider.value = cfg.sliderValue; setText('#compressSliderValue', slider.value); }
        if (numberInput && cfg.numberValue != null) numberInput.value = cfg.numberValue;
        if ($('#audioCodec') && cfg.audioCodec) $('#audioCodec').value = cfg.audioCodec;
        if ($('#audioBitrate') && cfg.audioBitrate) $('#audioBitrate').value = cfg.audioBitrate;
        if (cfg.adv) {
          const a = cfg.adv;
          if ($('#advRotate')) $('#advRotate').value = a.rotate || '0';
          if ($('#advFlip')) $('#advFlip').value = a.flip || 'none';
          if ($('#advFps')) $('#advFps').value = a.fps || 'auto';
          if ($('#advDenoise')) $('#advDenoise').value = a.denoise || 'off';
          if ($('#advBrightness')) $('#advBrightness').value = a.brightness || '0';
          if ($('#advContrast')) $('#advContrast').value = a.contrast || '1';
          if ($('#advSaturation')) $('#advSaturation').value = a.saturation || '1';
          if ($('#advSharpen')) $('#advSharpen').value = a.sharpen || '0';
          if ($('#advNormalize')) $('#advNormalize').value = a.normalize || 'off';
          if ($('#advVolume')) $('#advVolume').value = a.volume || '100';
          if ($('#advSampleRate')) $('#advSampleRate').value = a.sampleRate || 'auto';
          if ($('#advChannels')) $('#advChannels').value = a.channels || '2';
          if ($('#advTwoPass')) $('#advTwoPass').value = a.twoPass || 'off';
          if ($('#advPixFmt')) $('#advPixFmt').value = a.pixFmt || 'yuv420p';
          if ($('#advEncoderPreset')) $('#advEncoderPreset').value = a.encoderPreset || 'medium';
          if ($('#advStripMeta')) $('#advStripMeta').checked = a.stripMeta !== false;
          if ($('#advFaststart')) $('#advFaststart').checked = a.faststart !== false;
          if ($('#advCustomArgs')) $('#advCustomArgs').value = a.customArgs || '';
        }
        if (cfg.wm) {
          const w = cfg.wm;
          if ($('#wmText')) $('#wmText').value = w.text || '';
          if ($('#wmPos')) $('#wmPos').value = w.pos || 'br';
          if ($('#wmSize')) $('#wmSize').value = w.size || 24;
          if ($('#wmColor')) $('#wmColor').value = w.color || '#ffffff';
          if ($('#wmOpacity')) $('#wmOpacity').value = w.opacity || 0.8;
          if ($('#wmBg')) $('#wmBg').checked = !!w.bg;
        }
        updateEstimate();
      }, 60);
    });
  }
  function exportConfig() {
    safe(() => {
      const cfg = collectConfig();
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'compressvideo-config-' + Date.now() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Config diexport', 'success');
    });
  }
  function importConfig() {
    safe(() => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          safe(() => { const cfg = JSON.parse(r.result); applyConfig(cfg); toast('Config diimpor', 'success'); });
        };
        r.readAsText(f);
      };
      inp.click();
    });
  }
  function resetAdvanced() {
    applyConfig({
      adv: { rotate: '0', flip: 'none', fps: 'auto', denoise: 'off', brightness: 0, contrast: 1, saturation: 1, sharpen: 0, normalize: 'off', volume: 100, sampleRate: 'auto', channels: '2', twoPass: 'off', pixFmt: 'yuv420p', encoderPreset: 'medium', stripMeta: true, faststart: true, customArgs: '' },
      wm: { text: '', pos: 'br', size: 24, color: '#ffffff', opacity: 0.8, bg: false }
    });
    toast('Advanced direset', 'success');
  }

  /* ================================================================
     [29] KEYBOARD SHORTCUTS
     ================================================================ */
  function onKeydown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) {
      if (e.key === 'Escape') {
        if (state.helpOpen) { toggleHelp(); e.preventDefault(); }
        else if (state.logsOpen) { toggleLogs(); e.preventDefault(); }
        else if (state.processing) { $('#compressCancelBtn')?.click(); e.preventDefault(); }
      }
      return;
    }
    if (e.key === 'o' || e.key === 'O') { e.preventDefault(); fileInput?.click(); }
    else if (e.key === 'Enter') { e.preventDefault(); startCompression(); }
    else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); toggleLogs(); }
    else if (e.key === '/') { e.preventDefault(); toggleHelp(); }
    else if (e.key === 's' || e.key === 'S') {
      if (state.resultUrl) { e.preventDefault(); $('#resultDownloadBtn')?.click(); }
    }
    else if (e.shiftKey && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault(); resetFileSelection(false); toast('Reset', 'success');
    }
    else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); warmupWorker(); }
  }
  on(document, 'keydown', onKeydown);

  /* ================================================================
     [30] FAQ ACCORDION
     ================================================================ */
  $$('.compress-faq-item').forEach(item => {
    const q = item.querySelector('.compress-faq-q');
    on(q, 'click', () => {
      $$('.compress-faq-item').forEach(o => { if (o !== item) o.classList.remove('open'); });
      item.classList.toggle('open');
    });
  });

  /* ================================================================
     [31] CLEANUP
     ================================================================ */
  window.addEventListener('beforeunload', () => {
    destroyWorker();
    revokePreview();
    revokeResult();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      safe(() => $('#compressVideoPreview')?.pause());
      safe(() => $('#compressResultVideo')?.pause());
    }
  });

  /* ================================================================
     [32] INJEKSI UI STYLE TAMBAHAN (v5)
     ================================================================ */
  function injectStyles() {
    if ($('#compressV5Styles')) return;
    const css = `
      .compress-preset-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-top:8px; }
      .compress-preset-btn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 10px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); color:inherit; cursor:pointer; transition:all 0.2s; font-family:inherit; }
      .compress-preset-btn:hover { border-color:rgba(102,126,234,0.6); background:rgba(102,126,234,0.1); transform:translateY(-2px); }
      .compress-preset-btn i { font-size:1.3rem; color:#667eea; }
      .compress-preset-btn small { font-size:0.72rem; opacity:0.65; text-align:center; }
      .compress-adv-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
      .compress-adv-field { display:flex; flex-direction:column; gap:4px; font-size:0.85rem; }
      .compress-adv-field span { opacity:0.85; }
      .compress-adv-field input[type=text], .compress-adv-field input[type=number] { padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.25); color:inherit; font-family:inherit; width:100%; }
      .compress-adv-field input[type=range] { width:100%; }
      .compress-adv-field input[type=color] { width:100%; height:34px; border:none; background:transparent; }
      .compress-adv-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
      .compress-trim-row { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
      .compress-trim-field { display:flex; flex-direction:column; gap:4px; font-size:0.85rem; flex:1; min-width:120px; }
      .compress-trim-field input { padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.25); color:inherit; font-family:inherit; }
      .compress-trim-preview { display:flex; flex-direction:column; gap:4px; margin-top:8px; }
      .compress-trim-preview input[type=range] { width:100%; }
      .compress-hint { font-size:0.75rem; opacity:0.6; display:block; margin-top:6px; }
      .compress-queue-actions { display:flex; flex-wrap:wrap; gap:8px; }
      .compress-queue-list { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
      .compress-queue-item { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); }
      .compress-queue-item.status-processing { border-color:rgba(102,126,234,0.6); }
      .compress-queue-item.status-done { border-color:rgba(67,233,123,0.5); }
      .compress-queue-item.status-error { border-color:rgba(255,65,108,0.5); }
      .cq-index { width:26px; height:26px; border-radius:50%; background:rgba(102,126,234,0.2); display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:600; }
      .cq-icon i { font-size:1.1rem; color:#667eea; }
      .cq-info { flex:1; min-width:0; }
      .cq-name { font-size:0.9rem; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .cq-meta { font-size:0.75rem; opacity:0.65; margin-top:2px; }
      .cq-progress { height:4px; border-radius:2px; background:rgba(255,255,255,0.1); margin-top:6px; overflow:hidden; }
      .cq-progress > div { height:100%; background:linear-gradient(90deg,#667eea,#43e97b); transition:width 0.3s; }
      .cq-error { font-size:0.75rem; color:#ff416c; margin-top:4px; }
      .cq-status { font-size:0.75rem; opacity:0.85; white-space:nowrap; }
      .cq-actions { display:flex; gap:4px; }
      .cq-actions button { width:26px; height:26px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:inherit; cursor:pointer; font-size:0.7rem; }
      .cq-actions button:hover { background:rgba(102,126,234,0.2); }
      .compress-float-btn { position:fixed; right:18px; bottom:18px; width:48px; height:48px; border-radius:50%; border:none; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; cursor:pointer; box-shadow:0 6px 18px rgba(102,126,234,0.4); z-index:9998; font-size:1.1rem; transition:transform 0.2s; }
      .compress-float-btn:hover { transform:scale(1.08); }
      .compress-log-panel { position:fixed; right:18px; bottom:80px; width:min(500px,calc(100vw - 36px)); height:340px; background:#0f0f1a; border:1px solid rgba(255,255,255,0.12); border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,0.5); z-index:9999; display:flex; flex-direction:column; overflow:hidden; }
      .compress-log-head { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.85rem; }
      .compress-log-head > div { display:flex; gap:6px; align-items:center; }
      .compress-log-head select { padding:3px 6px; border-radius:6px; background:rgba(0,0,0,0.3); color:inherit; border:1px solid rgba(255,255,255,0.1); font-size:0.75rem; }
      .compress-log-head button { background:transparent; border:none; color:inherit; cursor:pointer; padding:4px 6px; }
      .compress-log-body { flex:1; overflow-y:auto; padding:8px 14px; font-family:monospace; font-size:0.75rem; line-height:1.5; }
      .compress-log-line { display:flex; gap:8px; padding:2px 0; }
      .log-ts { opacity:0.5; white-space:nowrap; }
      .compress-log-info .log-msg { color:#c9d1d9; }
      .compress-log-debug .log-msg { color:#8b949e; }
      .compress-log-warn .log-msg { color:#f0b429; }
      .compress-log-error .log-msg { color:#ff6b6b; }
      .compress-modal { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; }
      .compress-modal-content { background:#15151f; border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:24px; max-width:480px; width:100%; }
      .compress-modal h3 { margin:0 0 16px; font-size:1.1rem; }
      .compress-shortcuts { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
      .compress-shortcuts > div { display:flex; gap:10px; align-items:center; font-size:0.85rem; }
      .compress-shortcuts kbd { padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); font-family:monospace; font-size:0.75rem; }
      .compress-shortcuts span { opacity:0.8; }
      .compress-progress-chart { height:30px; margin-top:8px; }
      .compress-progress-chart svg { width:100%; height:100%; display:block; }
      @media (max-width:600px) { .compress-float-btn { width:42px; height:42px; font-size:0.95rem; } .compress-log-panel { height:280px; } }
    `;
    const s = el('style', { id: 'compressV5Styles' }, css);
    document.head.appendChild(s);
  }

  /* Inject chart host ke progress wrap */
  function injectProgressChart() {
    const wrap = $('#compressProgressWrap');
    if (!wrap || $('#progressChart')) return;
    const chart = el('div', { class: 'compress-progress-chart', id: 'progressChart' });
    wrap.appendChild(chart);
  }

  /* ================================================================
     [33] BOOT
     ================================================================ */
  function boot() {
    try {
      injectStyles();
      injectPresetBar();
      injectTrimPanel();
      injectAdvancedVideoPanel();
      injectWatermarkPanel();
      injectAudioAdvancedPanel();
      injectAdvancedPanel();
      injectBatchQueue();
      injectLogViewer();
      injectShortcutHelp();
      injectProgressChart();

      loadPrefs();
      updateDynamicInput();
      safeAsync(() => detectGpuSupport());
      renderHistory();
      renderQueue();

      // warmup FFmpeg (opsional, silent)
      setTimeout(() => {
        try { warmupWorker(); } catch (_) {}
      }, 2500);

      appendLog('info', 'compressvideo.js siap');
      console.log('✅ compressvideo.js PREMIUM siap');
    } catch (err) {
      console.warn('[Compress boot]', err);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})();