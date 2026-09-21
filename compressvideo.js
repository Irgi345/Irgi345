/* ================================================================
   IRGXYMODS — COMPRESS VIDEO CLIENT
   File    : compressvideo.js
   Version : 6.1.0 — STABLE / BUG-FREE / MISSION-CRITICAL
   ================================================================
   Changelog v6.1 (dari v5.0):
     [FIX-CORE] Tombol MULAI COMPRESS selalu bisa diklik (kecuali busy)
                → menggunakan event delegation + refreshStartButton()
                → tidak lagi diblokir oleh worker yang belum boot
     [FIX-CORE] Argumen FFmpeg diperbaiki: -i WAJIB ada, pakai placeholder
                __INPUT__ / __OUTPUT__ supaya worker bisa replace dengan
                nama file nyata di virtual FS.
     [FIX-CORE] Buffer ArrayBuffer TIDAK di-transfer (structured clone)
                supaya main thread tidak kehilangan referensi.
     [FIX-CORE] Semua state transition lewat setState() → UI konsisten.
     [FIX-CORE] Cancel bersih: kirim cancel → tunggu 3s → force terminate.
     [DEL] Two-pass, custom args, export/import, save/load preset,
           advanced audio (normalize/samplerate/channel), GPU codec,
           sharpen, denoise, fps override, log level selector,
           ping/warmup manual buttons → dihapus total.
     [NEW] Tombol Reset ke Default.
     [NEW] Indikator "Target tercapai?" setelah compress.
     [NEW] Estimasi waktu proses awal (ETA before start).
     [NEW] Tombol Compress Ulang dengan setting sama.
     [NEW] Auto-hapus riwayat > 30 hari.
     [NEW] Codec badge di panel hasil.
     [NEW] "Saved X MB" bukan hanya %.
     [NEW] Toast dengan close button.
   ================================================================ */

(function () {
'use strict';

/* ================================================================
   [1] DEPENDENCY GUARDS
   ================================================================ */
const $  = (s, c = document) => (c || document).querySelector(s);
const $$ = (s, c = document) => Array.from((c || document).querySelectorAll(s));

const rawToast = (typeof window.showToast === 'function') ? window.showToast : null;

/* ================================================================
   [2] CONSTANTS
   ================================================================ */
const HISTORY_KEY   = 'irgxy_cv_history_v61';
const MAX_HISTORY   = 30;
const HISTORY_TTL   = 30 * 24 * 60 * 60 * 1000; // 30 hari
const MAX_FILE_SIZE = 1024 * 1024 * 1024;       // 1 GB
const WARN_FILE_SIZE = 500 * 1024 * 1024;
const WORKER_VERSION_EXPECTED = '6.1.0';
const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS  = 15000;

/* ================================================================
   [3] STATE MACHINE
   ================================================================ */
const STATE = Object.freeze({
  IDLE:        'IDLE',
  FILE_LOADED: 'FILE_LOADED',
  PROCESSING:  'PROCESSING',
  DONE:        'DONE',
  ERROR:       'ERROR'
});

const state = {
  mode: STATE.IDLE,
  file: null,
  metadata: null,
  previewUrl: null,

  resultBlob: null,
  resultUrl: null,
  lastConfig: null,
  lastInputBytes: 0,

  worker: null,
  workerReady: false,
  workerBooted: false,
  workerPingTimer: null,
  lastPongAt: 0,

  processing: false,
  cancelRequested: false,

  startTime: 0,
  lastProgress: 0,
  lastProgressTime: 0,
  emaSpeed: 0,
  progressHistory: [],
  watchdogTimer: null,

  logsOpen: false,
  helpOpen: false
};

/* ================================================================
   [4] UTIL
   ================================================================ */
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function safeNum(v, fb = 0) { const n = Number(v); return isFinite(n) ? n : fb; }

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B';
  const k = 1024, units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return (bytes / Math.pow(k, i)).toFixed(decimals) + ' ' + units[i];
}

function formatDuration(sec) {
  sec = safeNum(sec, 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatEta(seconds) {
  if (!isFinite(seconds) || seconds < 0 || seconds > 86400) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function timestampName(baseName, ext = 'mp4') {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const clean = String(baseName || 'video').replace(/\.[^/.]+$/, '').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'video';
  return `${clean}_compressed_${stamp}.${ext}`;
}

function setText(sel, v) { const e = $(sel); if (e) e.textContent = v; }
function show(sel, mode) { const e = $(sel); if (e) e.style.display = (mode || 'block'); }
function hide(sel) { const e = $(sel); if (e) e.style.display = 'none'; }
function revokeUrl(u) { if (u) { try { URL.revokeObjectURL(u); } catch (_) {} } }

/* ================================================================
   [5] TOAST (dengan close button + auto-dismiss)
   ================================================================ */
const TOAST_TYPES = {
  info:    { color: '#4facfe', icon: 'fa-info-circle' },
  success: { color: '#43e97b', icon: 'fa-check-circle' },
  warning: { color: '#ffc107', icon: 'fa-exclamation-triangle' },
  error:   { color: '#ff416c', icon: 'fa-times-circle' }
};

function toast(msg, type = 'info', duration = 4000) {
  if (rawToast) { try { rawToast(msg, type); return; } catch (_) {} }

  const container = $('#toastContainer');
  if (!container) return;
  const t = TOAST_TYPES[type] || TOAST_TYPES.info;

  const el = document.createElement('div');
  el.className = 'cv-toast cv-toast-' + type;
  el.style.cssText = `display:flex;align-items:center;gap:10px;border-left:3px solid ${t.color};`;
  el.innerHTML = `
    <i class="fas ${t.icon}" style="color:${t.color};flex-shrink:0;"></i>
    <span style="flex:1;min-width:0;">${escapeHtml(msg)}</span>
    <button type="button" style="background:transparent;border:none;color:inherit;cursor:pointer;opacity:.6;padding:2px 4px;" aria-label="Tutup">×</button>
  `;
  const close = () => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('button').addEventListener('click', close);
  container.appendChild(el);
  setTimeout(close, duration);
}

/* ================================================================
   [6] LOG VIEWER
   ================================================================ */
function appendLog(kind, msg) {
  const body = $('#logBody');
  if (!body) return;
  const now = new Date().toLocaleTimeString('id-ID');
  const line = document.createElement('div');
  line.className = 'cv-log-line cv-log-' + (kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : 'info');
  line.innerHTML = `<span class="cv-log-ts">${now}</span><span class="cv-log-msg">${escapeHtml(msg)}</span>`;
  body.appendChild(line);
  while (body.children.length > 500) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
}

function toggleLogs(force) {
  state.logsOpen = (typeof force === 'boolean') ? force : !state.logsOpen;
  const p = $('#logPanel');
  if (p) p.style.display = state.logsOpen ? 'flex' : 'none';
}

/* ================================================================
   [7] URL LIFECYCLE
   ================================================================ */
function revokePreview() {
  revokeUrl(state.previewUrl);
  state.previewUrl = null;
  const v = $('#videoPreview');
  if (v) { try { v.pause(); } catch (_) {} v.removeAttribute('src'); try { v.load(); } catch (_) {} }
}
function revokeResult() {
  revokeUrl(state.resultUrl);
  state.resultUrl = null;
  state.resultBlob = null;
  const v = $('#resultVideo');
  if (v) { try { v.pause(); } catch (_) {} v.removeAttribute('src'); try { v.load(); } catch (_) {} }
}

/* ================================================================
   [8] METADATA
   ================================================================ */
function loadVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (err, data) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      revokeUrl(url);
      v.removeAttribute('src');
      try { v.load(); } catch (_) {}
      err ? reject(err) : resolve(data);
    };
    const timer = setTimeout(() => finish(new Error('Timeout membaca metadata (file rusak?)')), 15000);
    v.onloadedmetadata = () => {
      const w = v.videoWidth, h = v.videoHeight, d = v.duration;
      if (!w || !h) return finish(new Error('Resolusi video tidak dapat dibaca'));
      if (!isFinite(d) || d <= 0) return finish(new Error('Durasi video tidak valid'));
      finish(null, { duration: d, width: w, height: h });
    };
    v.onerror = () => finish(new Error('Format video tidak didukung browser'));
    v.src = url;
  });
}

/* ================================================================
   [9] FORM STATE HELPERS
   ================================================================ */
function getCodec()       { return $('input[name="codec"]:checked')?.value || 'h264-cpu'; }
function getMethod()      { return $('input[name="method"]:checked')?.value || 'size-percent'; }
function getResolution()  { return $('input[name="resolution"]:checked')?.value || 'keep'; }
function getAudioCodec()  { return $('#audioCodec')?.value || 'aac'; }
function getAudioBitrate(){ return parseInt($('#audioBitrate')?.value, 10) || 128; }

function audioBitrateKbps() {
  const c = getAudioCodec();
  if (c === 'copy' || c === 'none') return 0;
  return getAudioBitrate();
}

function effectiveDuration() {
  const dur = state.metadata?.duration || 0;
  if (dur <= 0) return 0;
  const s = clamp(safeNum($('#trimStart')?.value, 0), 0, dur);
  const e = clamp(safeNum($('#trimEnd')?.value, dur), 0, dur);
  if (e > s && e > 0) return e - s;
  return dur;
}

/* ================================================================
   [10] ESTIMASI
   ================================================================ */
function calcVideoBitrate() {
  const method = getMethod();
  const srcKbps = state.metadata?.bitrate || 2000;
  const duration = effectiveDuration() || 1;
  const audio = audioBitrateKbps();

  if (method === 'size-percent') {
    const pct = clamp(safeNum($('#slider')?.value, 50) / 100, 0.05, 0.95);
    return Math.max(100, Math.round(srcKbps * pct - audio));
  }
  if (method === 'size-mb') {
    const mb = Math.max(1, safeNum($('#numberInput')?.value, 1));
    const totalKbps = (mb * 8192) / duration;
    return Math.max(100, Math.round(totalKbps - audio));
  }
  // quality / CRF
  const crf = safeNum($('#slider')?.value, 23);
  const factor = Math.pow(0.92, crf - 18);
  return Math.max(100, Math.round(srcKbps * clamp(factor, 0.05, 2)));
}

function qualityLabel(crf) {
  if (crf <= 18) return 'Excellent';
  if (crf <= 23) return 'Good';
  if (crf <= 28) return 'Fair';
  return 'Low';
}

function estimateTime() {
  // Estimasi kasar: durasi_output * faktor_encoder * kompleksitas
  const dur = effectiveDuration() || 0;
  if (dur <= 0) return 0;
  const codec = getCodec();
  const factor = codec === 'h265-cpu' ? 3.5 : 1.5; // detik proses / detik video (rough)
  return Math.round(dur * factor);
}

function updateEstimate() {
  if (!state.file) return;
  const audio = audioBitrateKbps();
  const videoKbps = calcVideoBitrate();
  const dur = effectiveDuration() || state.metadata?.duration || 1;
  const totalKbps = videoKbps + audio;
  const estBytes = (totalKbps * dur * 1000) / 8;
  const srcSize = state.file.size || 1;
  const ratioPct = clamp(Math.round((1 - estBytes / srcSize) * 100), -999, 100);

  let q;
  if (getMethod() === 'quality') {
    q = qualityLabel(safeNum($('#slider')?.value, 23));
  } else {
    const px = (state.metadata.width * state.metadata.height) || 1;
    const bpp = (videoKbps * 1000) / px;
    q = bpp > 0.12 ? 'Excellent' : bpp > 0.06 ? 'Good' : bpp > 0.03 ? 'Fair' : 'Low';
  }

  setText('#estSize', formatBytes(estBytes));
  setText('#estVideoBitrate', videoKbps + ' kbps');
  setText('#estAudioBitrate', audio === 0 ? 'Copy/None' : audio + ' kbps');
  setText('#estRatio', (ratioPct > 0 ? ratioPct : 0) + '%');
  setText('#estQuality', q);
  setText('#estTime', '± ' + formatDuration(estimateTime()));

  const warn = $('#estOutputWarning');
  if (warn) warn.style.display = (estBytes >= srcSize * 0.98) ? 'flex' : 'none';
}

/* ================================================================
   [11] DYNAMIC INPUT (slider vs number)
   ================================================================ */
function updateDynamicInput() {
  const method = getMethod();
  const codec = getCodec();
  const sliderWrap = $('#sliderWrap');
  const numberWrap = $('#numberWrap');
  const label = $('#dynamicLabel');

  if (sliderWrap) sliderWrap.style.display = 'none';
  if (numberWrap) numberWrap.style.display = 'none';

  if (method === 'size-percent') {
    if (label) label.innerHTML = '<i class="fas fa-percent"></i> Target Ukuran (%)';
    if (sliderWrap) sliderWrap.style.display = 'flex';
    const s = $('#slider');
    if (s) { s.min = 5; s.max = 95; if (!s.dataset.touched) s.value = 50; }
    setText('#sliderValue', $('#slider')?.value || '50');
    setText('#sliderUnit', '%');
  }
  else if (method === 'size-mb') {
    if (label) label.innerHTML = '<i class="fas fa-database"></i> Target Ukuran (MB)';
    if (numberWrap) numberWrap.style.display = 'flex';
    const srcMB = state.file ? Math.max(1, Math.floor(state.file.size / 1024 / 1024)) : 2048;
    const n = $('#numberInput');
    if (n) {
      n.min = 1; n.max = srcMB;
      if (!n.dataset.touched) n.value = Math.max(1, Math.round(srcMB * 0.5));
    }
    setText('#numberUnit', 'MB');
  }
  else if (method === 'quality') {
    const maxCrf = 51;
    const defCrf = codec === 'h265-cpu' ? 28 : 23;
    if (label) label.innerHTML = `<i class="fas fa-star"></i> Kualitas (CRF 0–${maxCrf})`;
    if (sliderWrap) sliderWrap.style.display = 'flex';
    const s = $('#slider');
    if (s) { s.min = 0; s.max = maxCrf; if (!s.dataset.touched) s.value = defCrf; }
    setText('#sliderValue', $('#slider')?.value || String(defCrf));
    setText('#sliderUnit', 'CRF');
  }
  updateEstimate();
}

/* ================================================================
   [12] BUILD FFMPEG ARGS
   ----------------------------------------------------------------
   Format: array args dengan placeholder __INPUT__ dan __OUTPUT__.
   Urutan: [-global] [-input_opts] -i __INPUT__ [-output_opts] __OUTPUT__
   ================================================================ */
function buildFFmpegArgs() {
  const codec = getCodec();
  const method = getMethod();
  const encoder = codec === 'h265-cpu' ? 'libx265' : 'libx264';
  const args = ['-hide_banner'];

  /* ---------- Input opts (trim: -ss sebelum -i untuk fast seek) ---------- */
  const dur = state.metadata?.duration || 0;
  const tStart = clamp(safeNum($('#trimStart')?.value, 0), 0, dur);
  const tEnd   = clamp(safeNum($('#trimEnd')?.value, dur),  0, dur);
  const hasTrimStart = tStart > 0.01;
  const hasTrimEnd   = tEnd > 0 && tEnd < dur - 0.01 && tEnd > tStart;

  if (hasTrimStart) args.push('-ss', tStart.toFixed(3));
  args.push('-i', '__INPUT__');
  if (hasTrimEnd) args.push('-t', (tEnd - tStart).toFixed(3));

  /* ---------- Video encoder ---------- */
  args.push('-c:v', encoder);
  if (encoder === 'libx264') {
    args.push('-preset', 'medium');
  } else if (encoder === 'libx265') {
    args.push('-preset', 'medium', '-tag:v', 'hvc1');
  }

  /* ---------- Bitrate / CRF ---------- */
  if (method === 'quality') {
    const crf = clamp(safeNum($('#slider')?.value, 23), 0, 51);
    args.push('-crf', String(crf));
  } else {
    const kbps = calcVideoBitrate();
    args.push('-b:v', kbps + 'k', '-maxrate', kbps + 'k', '-bufsize', (kbps * 2) + 'k');
  }

  /* ---------- Filter chain ---------- */
  const filters = [];

  /* Scale — hindari upscale */
  const res = getResolution();
  if (res && res !== 'keep' && state.metadata.width > 0) {
    const [tw, th] = res.split('x').map(Number);
    if (tw && th) {
      if (tw > state.metadata.width) {
        // Target > source: pakai source size (tidak upscale)
        filters.push(`scale=${state.metadata.width}:${state.metadata.height}`);
      } else {
        filters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease`);
      }
    }
  }

  /* Rotate */
  const rot = safeNum($('#advRotate')?.value, 0);
  if (rot === 90)  filters.push('transpose=1');
  else if (rot === 180) filters.push('transpose=2,transpose=2');
  else if (rot === 270) filters.push('transpose=2');

  /* Flip */
  const flip = $('#advFlip')?.value || 'none';
  if (flip === 'h') filters.push('hflip');
  if (flip === 'v') filters.push('vflip');

  /* EQ (brightness/contrast/saturation) */
  const b = safeNum($('#fBrightness')?.value, 0);
  const c = safeNum($('#fContrast')?.value, 1);
  const s = safeNum($('#fSaturation')?.value, 1);
  if (b !== 0 || c !== 1 || s !== 1) {
    filters.push(`eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}`);
  }

  /* Watermark teks */
  const wmText = ($('#wmText')?.value || '').trim();
  if (wmText) {
    const size = clamp(safeNum($('#wmSize')?.value, 24), 10, 200);
    const hex = ($('#wmColor')?.value || '#ffffff').replace('#', '0x');
    const op = clamp(safeNum($('#wmOpacity')?.value, 0.8), 0.1, 1);
    const color = `${hex}@${op.toFixed(2)}`;
    const posMap = {
      tl: ['10', '10'],
      tr: ['w-tw-10', '10'],
      bl: ['10', 'h-th-10'],
      br: ['w-tw-10', 'h-th-10'],
      tc: ['(w-tw)/2', '10'],
      bc: ['(w-tw)/2', 'h-th-10']
    };
    const pos = posMap[$('#wmPos')?.value || 'br'];
    const box = $('#wmBg')?.checked ? ':box=1:boxcolor=black@0.5:boxborderw=8' : '';
    /* Escape karakter khusus drawtext */
    const escaped = wmText
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'")
      .replace(/%/g, '\\%');
    filters.push(
      `drawtext=text='${escaped}':x=${pos[0]}:y=${pos[1]}:fontsize=${size}:fontcolor=${color}${box}`
    );
  }

  if (filters.length) args.push('-vf', filters.join(','));

  /* ---------- Audio ---------- */
  const ac = getAudioCodec();
  if (ac === 'none') {
    args.push('-an');
  } else if (ac === 'copy') {
    /* Fallback otomatis untuk container yang tidak cocok */
    const mime = (state.file?.type || '').toLowerCase();
    const srcIsWebmOrMkv = /webm|matroska/.test(mime);
    if (srcIsWebmOrMkv) {
      // copy tidak aman → pakai AAC
      args.push('-c:a', 'aac', '-b:a', getAudioBitrate() + 'k', '-ac', '2');
    } else {
      args.push('-c:a', 'copy');
    }
  } else {
    args.push('-c:a', ac, '-b:a', getAudioBitrate() + 'k', '-ac', '2');
  }

  /* ---------- Output compat ---------- */
  args.push('-pix_fmt', 'yuv420p');
  args.push('-movflags', '+faststart');
  args.push('-map_metadata', '-1');

  args.push('__OUTPUT__');
  return args;
}

/* ================================================================
   [13] WORKER LIFECYCLE
   ================================================================ */
function destroyWorker() {
  if (state.workerPingTimer) {
    clearInterval(state.workerPingTimer);
    state.workerPingTimer = null;
  }
  if (state.worker) {
    try { state.worker.terminate(); } catch (_) {}
    state.worker = null;
  }
  state.workerReady = false;
  state.workerBooted = false;
  setWorkerStatus('Worker dihentikan.', 'idle');
}

function setWorkerStatus(text, mode, version) {
  const el = $('#workerStatus');
  const txt = $('#workerStatusText');
  const tag = $('#workerVersionTag');
  if (txt) txt.textContent = text;
  if (tag && version) tag.textContent = 'v' + version;
  if (el) {
    el.classList.remove('is-ready', 'is-error');
    if (mode === 'ready') el.classList.add('is-ready');
    else if (mode === 'error') el.classList.add('is-error');
    const i = el.querySelector('i');
    if (i) {
      i.className = mode === 'ready'
        ? 'fas fa-check-circle'
        : mode === 'error'
          ? 'fas fa-exclamation-circle'
          : 'fas fa-circle-notch fa-spin';
    }
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
    };
    state.worker = w;
    startPingLoop();
    return w;
  } catch (err) {
    console.error('[ensureWorker]', err);
    toast('Browser tidak mendukung Web Worker.', 'error');
    return null;
  }
}

function startPingLoop() {
  if (state.workerPingTimer) clearInterval(state.workerPingTimer);
  state.workerPingTimer = setInterval(() => {
    if (!state.worker) return;
    /* Hanya ping saat tidak sibuk memproses */
    if (state.processing) return;
    try { state.worker.postMessage({ type: 'ping' }); } catch (_) {}
  }, PING_INTERVAL_MS);
}

function onWorkerMessage(e) {
  try {
    const d = (e && e.data) || {};
    switch (d.type) {
      case 'booted':
        state.workerBooted = true;
        state.workerReady = false;
        setWorkerStatus('Worker siap, FFmpeg belum dimuat.', 'idle', d.version);
        appendLog('info', `Worker booted (v${d.version}, core ${d.coreVersion})`);
        if (d.version && d.version !== WORKER_VERSION_EXPECTED) {
          appendLog('warn', `Versi worker ${d.version} ≠ client ${WORKER_VERSION_EXPECTED}`);
        }
        break;
      case 'ready':
        state.workerReady = true;
        setWorkerStatus('FFmpeg siap.', 'ready', d.version);
        appendLog('info', 'FFmpeg ready');
        break;
      case 'status':
        appendLog('info', d.message || '');
        break;
      case 'progress':
        updateProgress(d.progress || 0, d.etaMs || 0);
        break;
      case 'done':
        handleWorkerDone(d);
        break;
      case 'error':
        handleWorkerError(d.message || 'unknown');
        break;
      case 'cancelled':
        handleWorkerCancelled();
        break;
      case 'pong':
        state.lastPongAt = Date.now();
        break;
    }
  } catch (err) {
    console.error('[onWorkerMessage]', err);
    appendLog('error', 'Handler exception: ' + err.message);
  }
}

/* ================================================================
   [14] STATE TRANSITION + START BUTTON REFRESH
   ================================================================ */
function setState(newMode) {
  state.mode = newMode;
  refreshStartButton();
}

function refreshStartButton() {
  const btn = $('#btnStart');
  if (!btn) return;
  const canStart = !!state.file && !state.processing;
  btn.disabled = !canStart;
  /* Label adaptif */
  if (state.processing) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sedang Memproses...';
  } else if (!state.file) {
    btn.innerHTML = '<i class="fas fa-play"></i> MULAI COMPRESS';
  } else {
    btn.innerHTML = '<i class="fas fa-play"></i> MULAI COMPRESS';
  }
}

/* ================================================================
   [15] FILE HANDLING
   ================================================================ */
function isVideoFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('video/')) return true;
  return /\.(mp4|mov|mkv|webm|avi|m4v|3gp|flv|wmv|mpeg|mpg|ts|ogv)$/i.test(file.name);
}

async function handleFile(file) {
  if (!file) return;
  if (state.processing) { toast('Tunggu proses sebelumnya selesai.', 'warning'); return; }
  if (!isVideoFile(file)) { toast('File bukan video yang didukung.', 'error'); return; }
  if (file.size > MAX_FILE_SIZE) {
    toast(`File terlalu besar (${formatBytes(file.size)}). Maks ${formatBytes(MAX_FILE_SIZE)}.`, 'error');
    return;
  }

  /* Reset UI dulu */
  revokePreview(); revokeResult(); resetProgressUI();
  hide('#resultCard'); hide('#progressWrap');

  toast('Memuat metadata...', 'info');

  try {
    const meta = await loadVideoMetadata(file);
    state.file = file;
    state.metadata = {
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      bitrate: Math.round((file.size * 8) / meta.duration / 1000) || 0
    };

    /* Preview */
    state.previewUrl = URL.createObjectURL(file);
    const v = $('#videoPreview');
    if (v) v.src = state.previewUrl;

    hide('#dropzone');
    show('#preview', 'grid');
    setText('#fileName', file.name);
    setText('#fileSize', formatBytes(file.size));
    setText('#fileDuration', formatDuration(meta.duration));
    setText('#fileResolution', `${meta.width}×${meta.height}`);
    setText('#fileBitrate', (state.metadata.bitrate || 0) + ' kbps');

    /* Trim defaults */
    const ts = $('#trimStart'); if (ts) ts.value = '0';
    const te = $('#trimEnd');   if (te) te.value = meta.duration.toFixed(2);
    syncTrimRanges();

    /* Show settings + action */
    show('#settingsCard');
    show('#actionCard');
    updateDynamicInput();
    updateEstimate();
    checkResWarning();

    setState(STATE.FILE_LOADED);
    toast(`Video dimuat (${formatDuration(meta.duration)})`, 'success');

    if (file.size > WARN_FILE_SIZE) {
      toast('File besar (>500 MB) — jangan tutup tab saat memproses.', 'warning', 6000);
    }
  } catch (err) {
    console.error('[handleFile]', err);
    toast('Gagal memuat video: ' + (err.message || 'unknown'), 'error');
    resetFileSelection();
  }
}

function resetFileSelection() {
  revokePreview();
  revokeResult();
  state.file = null;
  state.metadata = null;

  hide('#preview'); show('#dropzone');
  hide('#settingsCard'); hide('#actionCard');
  hide('#resultCard'); hide('#progressWrap');
  const fi = $('#fileInput'); if (fi) fi.value = '';
  resetProgressUI();
  setState(STATE.IDLE);
}

/* ================================================================
   [16] TRIM
   ================================================================ */
function syncTrimRanges() {
  const dur = state.metadata?.duration || 0;
  if (dur <= 0) return;
  const s = clamp(safeNum($('#trimStart')?.value, 0), 0, dur);
  const e = clamp(safeNum($('#trimEnd')?.value, dur), 0, dur);
  const sr = $('#trimStartRange'); if (sr) sr.value = String((s / dur) * 100);
  const er = $('#trimEndRange');   if (er) er.value = String((e / dur) * 100);
}

/* ================================================================
   [17] PROGRESS + CHART
   ================================================================ */
function resetProgressUI() {
  const f = $('#progressFill'); if (f) f.style.width = '0%';
  setText('#progressPct', '0%');
  setText('#progressEta', '--:--');
  setText('#progressSpeed', '-');
  setText('#progressFps', '-');
  state.lastProgress = 0;
  state.lastProgressTime = Date.now();
  state.emaSpeed = 0;
  state.progressHistory = [];
  renderProgressChart();
}

function updateProgress(raw, etaMs) {
  const pct = clamp(Math.round((raw || 0) * 100), 0, 100);
  const f = $('#progressFill'); if (f) f.style.width = pct + '%';
  setText('#progressPct', pct + '%');
  const bar = $('.cv-progress-bar'); if (bar) bar.setAttribute('aria-valuenow', String(pct));

  const now = Date.now();
  const dt = (now - state.lastProgressTime) / 1000;
  const dp = pct - state.lastProgress;

  if (dt > 0.3 && dp > 0) {
    const rate = dp / dt;
    const dur = effectiveDuration() || state.metadata?.duration || 1;
    const instantSpeed = (dur * rate) / 100;
    state.emaSpeed = state.emaSpeed === 0
      ? instantSpeed
      : state.emaSpeed * 0.7 + instantSpeed * 0.3;

    let etaSec;
    if (etaMs > 0) etaSec = etaMs / 1000;
    else if (state.emaSpeed > 0) etaSec = ((100 - pct) / 100 * dur) / state.emaSpeed;
    else etaSec = 0;

    setText('#progressEta', formatEta(etaSec));
    setText('#progressSpeed', state.emaSpeed.toFixed(2) + '×');
    setText('#progressFps', '-');

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
  host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="pgGrad" x1="0" x2="1">
      <stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#43e97b"/>
    </linearGradient></defs>
    <path d="${path}" fill="none" stroke="url(#pgGrad)" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

/* ================================================================
   [18] START COMPRESSION
   ================================================================ */
async function startCompression() {
  if (state.processing) { toast('Sedang memproses...', 'warning'); return; }
  if (!state.file) { toast('Pilih video terlebih dahulu.', 'error'); return; }

  console.group('%c[Compress v6.1] Start','color:#d4a745;font-weight:bold');
  console.log('file:', state.file.name, formatBytes(state.file.size));
  console.log('metadata:', state.metadata);
  console.log('mode:', state.mode, '| worker:', !!state.worker, '| ready:', state.workerReady);

  /* Validasi input */
  const method = getMethod();
  if (method === 'size-mb') {
    const v = safeNum($('#numberInput')?.value, 0);
    if (v <= 0) { console.groupEnd(); toast('Masukkan target ukuran (MB) yang valid.', 'error'); return; }
  }
  if (method === 'quality') {
    const v = safeNum($('#slider')?.value, -1);
    if (v < 0 || v > 51) { console.groupEnd(); toast('CRF harus 0–51.', 'error'); return; }
  }

  const worker = ensureWorker();
  if (!worker) { console.groupEnd(); toast('Tidak dapat membuat worker.', 'error'); return; }

  state.processing = true;
  state.cancelRequested = false;
  state.startTime = Date.now();
  state.lastProgressTime = Date.now();
  state.lastProgress = 0;
  state.emaSpeed = 0;
  state.progressHistory = [];

  show('#progressWrap');
  hide('#resultCard');
  resetProgressUI();
  setState(STATE.PROCESSING);

  try {
    const fileBuffer = await state.file.arrayBuffer();
    const args = buildFFmpegArgs();

    console.log('args:', args.join(' '));

    state.lastConfig = {
      codec: getCodec(),
      method,
      resolution: getResolution(),
      sourceWidth: state.metadata.width,
      sourceHeight: state.metadata.height,
      duration: effectiveDuration() || state.metadata.duration,
      videoBitrate: calcVideoBitrate(),
      audioCodec: getAudioCodec(),
      audioBitrate: getAudioBitrate(),
      ffmpegArgs: args,
      inputName: 'input_' + Date.now() + '.mp4',
      outputName: 'output_' + Date.now() + '.mp4',
      target: method === 'size-mb' ? safeNum($('#numberInput')?.value, 0) :
              method === 'size-percent' ? safeNum($('#slider')?.value, 50) :
              null
    };
    state.lastInputBytes = fileBuffer.byteLength;

    appendLog('info', 'Args: ' + args.join(' '));
    appendLog('info', `Mulai compress: ${state.file.name} (${formatBytes(fileBuffer.byteLength)})`);

    /* Structured clone (JANGAN transfer — biar main thread tidak kehilangan referensi) */
    worker.postMessage({
      type: 'compress',
      payload: {
        fileBuffer,
        config: state.lastConfig
      }
    });
  } catch (err) {
    console.error('[startCompression]', err);
    appendLog('error', 'startCompression: ' + err.message);
    toast('Gagal memulai: ' + (err.message || 'unknown'), 'error');
    state.processing = false;
    setState(state.file ? STATE.FILE_LOADED : STATE.IDLE);
  } finally {
    console.groupEnd();
  }
}

/* ================================================================
   [19] CANCEL
   ================================================================ */
function cancelCompression() {
  if (!state.processing) return;
  state.cancelRequested = true;
  toast('Membatalkan...', 'warning');
  try { state.worker?.postMessage({ type: 'cancel' }); } catch (_) {}
  /* Force reset setelah 3s kalau worker tidak balas */
  setTimeout(() => {
    if (state.processing) {
      console.warn('[Cancel] force reset');
      destroyWorker();
      finalizeCancel('force');
    }
  }, 3000);
}

function finalizeCancel(reason) {
  state.processing = false;
  state.cancelRequested = false;
  hide('#progressWrap');
  setState(state.file ? STATE.FILE_LOADED : STATE.IDLE);
  appendLog('warn', 'Kompresi dibatalkan (' + reason + ')');
}

function handleWorkerCancelled() {
  finalizeCancel('worker-ack');
  toast('Proses dibatalkan.', 'warning');
}

/* ================================================================
   [20] DONE / ERROR
   ================================================================ */
function handleWorkerDone(d) {
  state.processing = false;
  state.cancelRequested = false;
  hide('#progressWrap');

  if (!d || !(d.blob instanceof Blob) || d.blob.size === 0) {
    toast('Hasil kompresi tidak valid.', 'error');
    setState(state.file ? STATE.FILE_LOADED : STATE.IDLE);
    return;
  }

  revokeResult();
  state.resultBlob = d.blob;
  state.resultUrl = URL.createObjectURL(d.blob);

  const beforeSize = state.lastInputBytes || (state.file?.size || 0);
  const afterSize = d.blob.size;
  const savedPct = beforeSize > 0 ? Math.max(0, Math.round((1 - afterSize / beforeSize) * 100)) : 0;
  const savedBytes = Math.max(0, beforeSize - afterSize);

  const rv = $('#resultVideo'); if (rv) rv.src = state.resultUrl;

  setText('#beforeSize', formatBytes(beforeSize));
  setText('#afterSize', formatBytes(afterSize));
  setText('#beforeRes', `${state.metadata.width}×${state.metadata.height}`);
  const cfg = state.lastConfig || {};
  const outRes = resolveOutputRes(cfg);
  setText('#afterRes', outRes);

  setText('#savedText', savedPct > 0
    ? `🎉 Berhasil menghemat ${savedPct}% · ${formatBytes(savedBytes)}`
    : '⚠️ Ukuran output tidak lebih kecil. Coba turunkan bitrate/CRF.');

  /* Codec badge */
  const badge = $('#resultCodecBadge');
  if (badge) badge.textContent = cfg.codec === 'h265-cpu' ? 'H.265' : 'H.264';

  /* Target status */
  showTargetStatus(cfg, afterSize);

  /* Download link */
  const dl = $('#btnDownload');
  if (dl) {
    dl.href = state.resultUrl;
    dl.download = timestampName(state.file?.name || 'video', 'mp4');
  }

  show('#resultCard');
  setState(STATE.DONE);

  toast(savedPct > 0
    ? `Selesai! Ukuran berkurang ${savedPct}%`
    : 'Selesai — cek hasil di bawah.', 'success');

  appendLog('info', `Selesai: ${formatBytes(beforeSize)} → ${formatBytes(afterSize)} (-${savedPct}%)`);

  /* Riwayat */
  saveHistory({
    name: state.file?.name || 'video',
    before: beforeSize,
    after: afterSize,
    codec: cfg.codec,
    method: cfg.method,
    date: Date.now(),
    savedPct
  });
}

function resolveOutputRes(cfg) {
  const res = cfg.resolution;
  if (!res || res === 'keep') {
    return `${state.metadata.width}×${state.metadata.height}`;
  }
  const [tw, th] = res.split('x').map(Number);
  if (tw > state.metadata.width) {
    return `${state.metadata.width}×${state.metadata.height} (source)`;
  }
  return res;
}

function showTargetStatus(cfg, actualBytes) {
  const el = $('#targetStatus');
  if (!el) return;
  const method = cfg.method;
  if (method !== 'size-mb' && method !== 'size-percent') {
    el.style.display = 'none';
    return;
  }
  let targetBytes;
  if (method === 'size-mb') targetBytes = (cfg.target || 0) * 1024 * 1024;
  else targetBytes = state.lastInputBytes * ((cfg.target || 50) / 100);

  const diffPct = targetBytes > 0 ? Math.round(((actualBytes - targetBytes) / targetBytes) * 100) : 0;
  const ok = Math.abs(diffPct) <= 10;

  el.style.display = 'flex';
  el.className = 'cv-target-status ' + (ok ? 'success' : 'miss');
  el.innerHTML = ok
    ? `<i class="fas fa-check-circle"></i> Target tercapai (target ${formatBytes(targetBytes)}, hasil ${formatBytes(actualBytes)})`
    : `<i class="fas fa-exclamation-triangle"></i> Target ~${formatBytes(targetBytes)}, hasil ${formatBytes(actualBytes)} (${diffPct > 0 ? '+' : ''}${diffPct}%)`;
}

function handleWorkerError(msg) {
  state.processing = false;
  state.cancelRequested = false;
  hide('#progressWrap');
  appendLog('error', msg);
  toast('Gagal compress: ' + msg, 'error', 6000);
  setState(state.file ? STATE.ERROR : STATE.IDLE);
  /* Reset agar run berikutnya fresh */
  destroyWorker();
  ensureWorker();
}

/* ================================================================
   [21] PRESETS
   ================================================================ */
const PRESETS = {
  whatsapp:  { codec: 'h264-cpu', method: 'size-mb',  target: 16,  resolution: '1280x720',  audioCodec: 'aac', audioBitrate: '128' },
  instagram: { codec: 'h264-cpu', method: 'quality',  target: 23,  resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '128' },
  tiktok:    { codec: 'h264-cpu', method: 'quality',  target: 22,  resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '128' },
  youtube:   { codec: 'h264-cpu', method: 'quality',  target: 20,  resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '192' },
  twitter:   { codec: 'h264-cpu', method: 'quality',  target: 23,  resolution: '1280x720',  audioCodec: 'aac', audioBitrate: '128' },
  email:     { codec: 'h264-cpu', method: 'size-mb',  target: 20,  resolution: '854x480',   audioCodec: 'aac', audioBitrate: '96' },
  discord:   { codec: 'h264-cpu', method: 'size-mb',  target: 8,   resolution: '1280x720',  audioCodec: 'aac', audioBitrate: '96' },
  maxsave:   { codec: 'h265-cpu', method: 'quality',  target: 32,  resolution: '854x480',   audioCodec: 'aac', audioBitrate: '96' }
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  try {
    setRadio('codec', p.codec);
    setRadio('method', p.method);
    setRadio('resolution', p.resolution);

    if (p.method === 'quality' || p.method === 'size-percent') {
      const s = $('#slider');
      if (s) { s.value = String(p.target); s.dataset.touched = '1'; }
    } else if (p.method === 'size-mb') {
      const n = $('#numberInput');
      if (n) { n.value = String(p.target); n.dataset.touched = '1'; }
    }

    const ac = $('#audioCodec'); if (ac) ac.value = p.audioCodec;
    const ab = $('#audioBitrate'); if (ab) ab.value = p.audioBitrate;

    updateDynamicInput();
    updateEstimate();
    toast('Preset diterapkan: ' + name.toUpperCase(), 'success');
    appendLog('info', 'Preset: ' + name);
  } catch (e) {
    console.warn('[applyPreset]', e);
    toast('Gagal menerapkan preset.', 'error');
  }
}

function setRadio(name, value) {
  const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
}

/* ================================================================
   [22] RESET DEFAULTS
   ================================================================ */
function resetAllSettings() {
  setRadio('codec', 'h264-cpu');
  setRadio('method', 'size-percent');
  setRadio('resolution', '1280x720');
  const s = $('#slider');
  if (s) { s.value = '50'; delete s.dataset.touched; }
  const n = $('#numberInput');
  if (n) { n.value = '50'; delete n.dataset.touched; }
  const ac = $('#audioCodec'); if (ac) ac.value = 'aac';
  const ab = $('#audioBitrate'); if (ab) ab.value = '128';
  const ts = $('#trimStart'); if (ts) ts.value = '0';
  const te = $('#trimEnd');   if (te && state.metadata) te.value = state.metadata.duration.toFixed(2);
  const rot = $('#advRotate'); if (rot) rot.value = '0';
  const flip = $('#advFlip'); if (flip) flip.value = 'none';
  const b = $('#fBrightness'); if (b) b.value = '0';
  const c = $('#fContrast'); if (c) c.value = '1';
  const sa = $('#fSaturation'); if (sa) sa.value = '1';
  const wt = $('#wmText'); if (wt) wt.value = '';
  const wp = $('#wmPos'); if (wp) wp.value = 'br';
  const ws = $('#wmSize'); if (ws) ws.value = '24';
  const wc = $('#wmColor'); if (wc) wc.value = '#ffffff';
  const wo = $('#wmOpacity'); if (wo) wo.value = '0.8';
  const wb = $('#wmBg'); if (wb) wb.checked = false;

  setText('#valBrightness', '0');
  setText('#valContrast', '1.0');
  setText('#valSaturation', '1.0');
  setText('#valWmOpacity', '0.8');

  syncTrimRanges();
  updateDynamicInput();
  updateEstimate();
  toast('Setting direset ke default.', 'success');
}

/* ================================================================
   [23] RESOLUTION WARNING
   ================================================================ */
function checkResWarning() {
  const t = getResolution();
  const w = $('#resolutionWarning');
  if (!w) return;
  if (!t || t === 'keep' || !state.metadata?.width) { w.style.display = 'none'; return; }
  const [tw] = t.split('x').map(Number);
  w.style.display = (tw > state.metadata.width) ? 'flex' : 'none';
}

/* ================================================================
   [24] HISTORY
   ================================================================ */
function loadHistory() {
  try {
    let items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(items)) items = [];
    /* Auto-purge > 30 hari */
    const now = Date.now();
    items = items.filter(it => (now - (it.date || 0)) < HISTORY_TTL);
    return items;
  } catch (_) { return []; }
}

function saveHistory(entry) {
  const items = loadHistory();
  items.unshift(entry);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch (_) {}
  renderHistory();
}

function renderHistory() {
  const card = $('#historyCard');
  const list = $('#historyList');
  if (!card || !list) return;
  const items = loadHistory();
  if (!items.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  list.innerHTML = items.map(h => `
    <div class="cv-history-item">
      <div class="hi-icon"><i class="fas fa-file-video"></i></div>
      <div class="hi-content">
        <div class="hi-name">${escapeHtml(h.name || 'video')}</div>
        <div class="hi-meta">${formatBytes(h.before || 0)} → ${formatBytes(h.after || 0)} · ${escapeHtml(h.codec || '-')} · ${new Date(h.date || Date.now()).toLocaleString('id-ID')}</div>
      </div>
      <div class="hi-save">-${h.savedPct || 0}%</div>
    </div>
  `).join('');
}

/* ================================================================
   [25] KEYBOARD SHORTCUTS
   ================================================================ */
function onKeydown(e) {
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl) {
    if (e.key === 'Escape') {
      if (state.helpOpen) { toggleHelp(false); e.preventDefault(); }
      else if (state.logsOpen) { toggleLogs(false); e.preventDefault(); }
      else if (state.processing) { cancelCompression(); e.preventDefault(); }
    }
    return;
  }
  if (e.key === 'o' || e.key === 'O') { e.preventDefault(); $('#fileInput')?.click(); }
  else if (e.key === 'Enter') { e.preventDefault(); startCompression(); }
  else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); toggleLogs(); }
  else if (e.key === '/') { e.preventDefault(); toggleHelp(); }
  else if (e.key === 's' || e.key === 'S') {
    if (state.resultUrl) { e.preventDefault(); $('#btnDownload')?.click(); }
  }
  else if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault(); resetFileSelection(); resetAllSettings();
    toast('Reset selesai.', 'success');
  }
}

/* ================================================================
   [26] HELP MODAL
   ================================================================ */
function toggleHelp(force) {
  state.helpOpen = (typeof force === 'boolean') ? force : !state.helpOpen;
  const m = $('#helpModal');
  if (m) m.style.display = state.helpOpen ? 'flex' : 'none';
}

/* ================================================================
   [27] EVENT DELEGATION (SATU HANDLER UNTUK SEMUA)
   ================================================================ */
function bindEvents() {
  /* ---- Klik (delegation) ---- */
  document.addEventListener('click', (e) => {
    const t = e.target;

    if (t.closest('#btnStart'))    { startCompression(); return; }
    if (t.closest('#btnCancel'))   { cancelCompression(); return; }
    if (t.closest('#btnRetry'))    {
      hide('#resultCard');
      revokeResult();
      const s = $('#settingsCard');
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (t.closest('#btnRemoveFile')) { resetFileSelection(); return; }
    if (t.closest('#btnChangeFile')) { $('#fileInput')?.click(); return; }
    if (t.closest('#btnTrimFull') && state.metadata) {
      const ts = $('#trimStart'); if (ts) ts.value = '0';
      const te = $('#trimEnd');   if (te) te.value = state.metadata.duration.toFixed(2);
      syncTrimRanges(); updateEstimate();
      return;
    }
    if (t.closest('#btnReset')) { resetAllSettings(); return; }
    if (t.closest('#btnClearHistory')) {
      try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
      renderHistory();
      toast('Riwayat dihapus.', 'success');
      return;
    }
    if (t.closest('#btnLog'))    { toggleLogs(); return; }
    if (t.closest('#btnHelp'))   { toggleHelp(); return; }
    if (t.closest('#logClose'))  { toggleLogs(false); return; }
    if (t.closest('#helpClose')) { toggleHelp(false); return; }
    if (t.closest('#logClear'))  { const b = $('#logBody'); if (b) b.innerHTML = ''; return; }

    const presetBtn = t.closest('.cv-preset-btn');
    if (presetBtn) { applyPreset(presetBtn.getAttribute('data-preset')); return; }

    const dropzone = t.closest('#dropzone');
    if (dropzone) { $('#fileInput')?.click(); return; }

    const faqQ = t.closest('.cv-faq-q');
    if (faqQ) {
      const item = faqQ.parentElement;
      const wasOpen = item.classList.contains('open');
      $$('.cv-faq-item').forEach(o => o.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
      return;
    }
  });

  /* ---- Change / Input (delegation) ---- */
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'codec' || t.name === 'method') { updateDynamicInput(); updateEstimate(); }
    else if (t.name === 'resolution') { checkResWarning(); updateEstimate(); }
    else if (t.id === 'audioCodec' || t.id === 'audioBitrate') { updateEstimate(); }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'slider') {
      t.dataset.touched = '1';
      setText('#sliderValue', t.value);
      updateEstimate();
    }
    else if (t.id === 'numberInput') {
      t.dataset.touched = '1';
      updateEstimate();
    }
    else if (t.id === 'trimStart' || t.id === 'trimEnd') {
      syncTrimRanges(); updateEstimate();
    }
    else if (t.id === 'trimStartRange') {
      const dur = state.metadata?.duration || 0;
      const ts = $('#trimStart');
      if (ts) ts.value = (dur * safeNum(t.value, 0) / 100).toFixed(2);
      updateEstimate();
    }
    else if (t.id === 'trimEndRange') {
      const dur = state.metadata?.duration || 0;
      const te = $('#trimEnd');
      if (te) te.value = (dur * safeNum(t.value, 100) / 100).toFixed(2);
      updateEstimate();
    }
    else if (t.id === 'fBrightness') { setText('#valBrightness', t.value); }
    else if (t.id === 'fContrast')   { setText('#valContrast', t.value); }
    else if (t.id === 'fSaturation') { setText('#valSaturation', t.value); }
    else if (t.id === 'wmOpacity')   { setText('#valWmOpacity', t.value); }
  });

  /* ---- File input ---- */
  const fi = $('#fileInput');
  if (fi) fi.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files[0]) handleFile(files[0]);
    e.target.value = '';
  });

  /* ---- Dropzone ---- */
  const dz = $('#dropzone');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    });
    dz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput')?.click(); }
    });
  }

  /* ---- Modal backdrop ---- */
  const modal = $('#helpModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) toggleHelp(false); });

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', onKeydown);

  /* ---- Cleanup on unload ---- */
  window.addEventListener('beforeunload', () => {
    destroyWorker();
    revokePreview();
    revokeResult();
  });

  /* ---- Visibility: pause videos ---- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { $('#videoPreview')?.pause(); } catch (_) {}
      try { $('#resultVideo')?.pause(); } catch (_) {}
    }
  });
}

/* ================================================================
   [28] BOOT
   ================================================================ */
function boot() {
  try {
    bindEvents();
    updateDynamicInput();
    renderHistory();
    refreshStartButton();
    appendLog('info', 'Client v6.1 siap');

    /* Start worker & ping untuk health-check */
    ensureWorker();
    setWorkerStatus('Memuat worker...', 'idle');

    console.log('%c✅ compressvideo.js v6.1 siap','color:#43e97b;font-weight:bold');
  } catch (e) {
    console.error('[boot]', e);
    toast('Error saat inisialisasi: ' + e.message, 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

/* ================================================================
   [29] GLOBAL ERROR CATCH
   ================================================================ */
window.addEventListener('error', (e) => {
  console.warn('[global error]', e.message);
  if (!state.processing) appendLog('error', 'Global: ' + e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.warn('[unhandled rejection]', e.reason);
  if (!state.processing) appendLog('warn', 'Rejection: ' + (e.reason?.message || e.reason));
});

})();