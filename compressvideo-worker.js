/* ================================================================
   IRGXYMODS — COMPRESS VIDEO WORKER
   File    : compressvideo-worker.js
   Version : 6.5.2 — ESM WRAPPER + UMD CORE (FIXED)
   ================================================================
   [FIX] Kombinasi benar untuk FFmpeg.wasm 0.12.x:
         - Wrapper @ffmpeg/ffmpeg → ESM (via import())
         - Util @ffmpeg/util      → ESM (via import())
         - Core @ffmpeg/core      → UMD (via toBlobURL + internal importScripts)
   [FIX] Multi-CDN fallback: jsdelivr → unpkg
   [FIX] toBlobURL dari @ffmpeg/util untuk hindari CORS
   ================================================================ */

'use strict';

const WORKER_VERSION = '6.5.2';
const FFMPEG_VERSION = '0.12.10';
const UTIL_VERSION   = '0.12.1';
const CORE_VERSION   = '0.12.10';

const CDN_BASES = Object.freeze([
  'https://cdn.jsdelivr.net/npm',
  'https://unpkg.com'
]);

const LIMITS = Object.freeze({
  loadTimeoutMs:      90000,
  execMinMs:          120000,
  execMaxMs:          3600000,
  execPerMbMs:        25000,
  maxInputMb:         1024,
  warnInputMb:        700,
  terminateMs:        3000,
  progressThrottleMs: 150
});

const logI = (...a) => console.log('[W]', ...a);
const logW = (...a) => console.warn('[W]', ...a);
const logE = (...a) => console.error('[W]', ...a);

function post(type, payload) {
  try { self.postMessage(Object.assign({ type, ts: Date.now() }, payload || {})); }
  catch (e) { logE('post fail', e); }
}

let ffmpeg         = null;
let loadingPromise = null;
let busy           = false;
let cancelled      = false;
let execStartTs    = 0;
let lastEmit       = 0;
let effectiveDur   = 0;
let lastLoggedSec  = -1;

function withTimeout(p, ms, label) {
  let timer = null;
  const to = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error((label || 'Op') + ' timeout ' + ms + 'ms')), ms);
  });
  return Promise.race([
    Promise.resolve(p).finally(() => { if (timer) clearTimeout(timer); }),
    to
  ]);
}

/** Load FFmpeg dari satu CDN base. */
async function loadFFmpegFrom(base) {
  const ffmpegURL = base + '/@ffmpeg/ffmpeg@' + FFMPEG_VERSION + '/dist/esm/index.js';
  const utilURL   = base + '/@ffmpeg/util@' + UTIL_VERSION + '/dist/esm/index.js';
  const coreJsURL = base + '/@ffmpeg/core@' + CORE_VERSION + '/dist/umd/ffmpeg-core.js';
  const coreWasmURL = base + '/@ffmpeg/core@' + CORE_VERSION + '/dist/umd/ffmpeg-core.wasm';

  const cdnName = base.split('/')[2];
  post('status', { stage: 'module', message: 'Memuat modul FFmpeg dari ' + cdnName + '...' });

  const [ffmpegMod, utilMod] = await Promise.all([
    import(ffmpegURL),
    import(utilURL)
  ]);

  if (!ffmpegMod || !ffmpegMod.FFmpeg) throw new Error('FFmpeg class tidak ditemukan');
  if (!utilMod || !utilMod.toBlobURL)   throw new Error('toBlobURL tidak ditemukan');

  post('status', { stage: 'core', message: 'Mengunduh FFmpeg core...' });

  const [coreURL, wasmURL] = await Promise.all([
    utilMod.toBlobURL(coreJsURL,   'text/javascript'),
    utilMod.toBlobURL(coreWasmURL, 'application/wasm')
  ]);

  post('status', { stage: 'init', message: 'Menginisialisasi FFmpeg...' });

  const inst = new ffmpegMod.FFmpeg();
  inst.on('log',      ({ message })  => handleLog(message));
  inst.on('progress', ({ progress }) => handleProgressEvent(progress));

  await withTimeout(inst.load({ coreURL, wasmURL }), LIMITS.loadTimeoutMs, 'Load FFmpeg');

  return inst;
}

async function ensureFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let lastErr = null;
    for (const base of CDN_BASES) {
      if (cancelled) throw new Error('Dibatalkan');
      try {
        const inst = await loadFFmpegFrom(base);
        if (cancelled) { try { await inst.terminate(); } catch (_) {} throw new Error('Dibatalkan'); }
        ffmpeg = inst;
        loadingPromise = null;
        post('ready', { version: WORKER_VERSION, coreVersion: CORE_VERSION, cdn: base.split('/')[2] });
        logI('FFmpeg ready via', base);
        return inst;
      } catch (e) {
        lastErr = e;
        logW('CDN gagal:', base, e && e.message);
        try { if (ffmpeg) { await ffmpeg.terminate(); ffmpeg = null; } } catch (_) {}
      }
    }
    loadingPromise = null;
    throw new Error('FFmpeg gagal dimuat dari semua CDN: ' + (lastErr && lastErr.message));
  })();

  return loadingPromise;
}

function emitProgress(p) {
  const now = Date.now();
  if (now - lastEmit < LIMITS.progressThrottleMs && p < 1) return;
  lastEmit = now;
  let etaMs = 0;
  if (execStartTs > 0 && p > 0.01 && p < 1) {
    const el = now - execStartTs;
    etaMs = Math.max(0, Math.round(el / p - el));
  }
  post('progress', { progress: p, percent: Math.round(p * 100), etaMs });
}

function handleLog(message) {
  if (cancelled || !message) return;
  post('status', { message: String(message) });
  const m = String(message).match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (m && effectiveDur > 0) {
    const t = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
    if (t > lastLoggedSec + 0.2 || t >= effectiveDur - 0.1) {
      lastLoggedSec = t;
      emitProgress(Math.max(0, Math.min(1, t / effectiveDur)));
    }
  }
}

function handleProgressEvent(progress) {
  if (cancelled) return;
  emitProgress(Math.max(0, Math.min(1, Number(progress) || 0)));
}

function sanitizeName(name, fallbackExt) {
  const base = String(name || '').trim() || ('file_' + Date.now() + (fallbackExt || '.mp4'));
  const just = base.replace(/\\/g, '/').split('/').pop() || base;
  const clean = just.replace(/[^\w.\-]+/g, '_').slice(0, 200);
  return clean || ('file_' + Date.now() + (fallbackExt || '.mp4'));
}

function computeExecTimeout(bytes) {
  const mb = Math.max(1, (bytes || 0) / 1048576);
  return Math.round(Math.min(LIMITS.execMaxMs, Math.max(LIMITS.execMinMs, mb * LIMITS.execPerMbMs)));
}

async function safeTerminate() {
  const inst = ffmpeg;
  ffmpeg = null;
  loadingPromise = null;
  if (!inst) return;
  try {
    await Promise.race([
      Promise.resolve(inst.terminate()).catch(() => {}),
      new Promise(r => setTimeout(r, LIMITS.terminateMs))
    ]);
  } catch (e) { logW('terminate:', e && e.message); }
}

function mimeFromExt(ext) {
  const map = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    gif: 'image/gif', mp3: 'audio/mpeg', m4a: 'audio/mp4',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
  };
  return map[String(ext).toLowerCase()] || 'application/octet-stream';
}

async function handleCompress(data) {
  if (busy) { post('error', { code: 'BUSY', message: 'Worker masih memproses video lain.' }); return; }
  busy = true; cancelled = false; lastEmit = 0; execStartTs = 0; lastLoggedSec = -1;

  let inputName = null, outputName = null, ff = null;

  try {
    const payload    = data.payload || {};
    const fileBuffer = payload.fileBuffer;
    const cfg        = payload.config || {};
    let   args       = Array.isArray(cfg.ffmpegArgs) ? cfg.ffmpegArgs.slice() : [];
    effectiveDur     = Number(cfg.effectiveDuration) || 0;

    if (!fileBuffer || !(fileBuffer instanceof ArrayBuffer)) throw new Error('Data file tidak valid.');
    const bytes = fileBuffer.byteLength;
    if (bytes <= 0) throw new Error('File kosong.');

    inputName  = sanitizeName(cfg.inputName  || 'input.mp4',  '.mp4');
    outputName = sanitizeName(cfg.outputName || 'output.mp4', '.mp4');

    args = args.filter(a => a != null && a !== 'NaN' && a !== 'undefined');
    if (!args.length) throw new Error('Argumen FFmpeg kosong.');

    post('status', { stage: 'loading', message: 'Memuat FFmpeg...' });
    ff = await ensureFFmpeg();
    if (cancelled) throw new Error('Dibatalkan');

    try { await ff.deleteFile(inputName);  } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}

    post('status', { message: 'Menulis input ke virtual FS...' });
    await ff.writeFile(inputName, new Uint8Array(fileBuffer));
    if (cancelled) throw new Error('Dibatalkan');

    const finalArgs = args.map(a => {
      if (a === '__INPUT__')  return inputName;
      if (a === '__OUTPUT__') return outputName;
      return a;
    });
    if (!finalArgs.includes(inputName))  finalArgs.unshift('-i', inputName);
    if (!finalArgs.includes(outputName)) finalArgs.push(outputName);

    post('status', { stage: 'exec', message: 'Menjalankan FFmpeg...' });
    execStartTs = Date.now();
    const timeoutMs = computeExecTimeout(bytes);

    let exitCode;
    try {
      exitCode = await Promise.race([
        ff.exec(finalArgs),
        new Promise((_, rej) => setTimeout(() => rej(
          new Error('FFmpeg melebihi batas waktu ' + Math.round(timeoutMs / 1000) + 's')
        ), timeoutMs))
      ]);
    } catch (e) { await safeTerminate(); throw e; }

    exitCode = Number(exitCode) || 0;
    execStartTs = 0;

    if (cancelled) throw new Error('Dibatalkan');
    if (exitCode !== 0) throw new Error('FFmpeg exit code ' + exitCode);

    post('progress', { progress: 1, percent: 100, etaMs: 0 });
    post('status', { message: 'Membaca hasil output...' });

    const out = await ff.readFile(outputName);
    if (!out || !out.length) throw new Error('Output kosong.');

    const ext  = (outputName.split('.').pop() || 'mp4').toLowerCase();
    const blob = new Blob([out], { type: mimeFromExt(ext) });

    try { await ff.deleteFile(inputName);  } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}

    post('done', { blob, outputBytes: out.byteLength, mime: blob.type });

  } catch (e) {
    const wasCancelled = cancelled;
    try { if (ff && inputName)  await ff.deleteFile(inputName).catch(() => {});  } catch (_) {}
    try { if (ff && outputName) await ff.deleteFile(outputName).catch(() => {}); } catch (_) {}
    if (wasCancelled) post('cancelled', {});
    else { logE('compress error:', e); post('error', { message: (e && e.message) || String(e) }); }
  } finally {
    busy = false; execStartTs = 0; cancelled = false; effectiveDur = 0;
  }
}

async function handleCancel() {
  cancelled = true;
  await safeTerminate();
  busy = false; execStartTs = 0;
  post('cancelled', {});
}

self.onmessage = function (e) {
  const d = (e && e.data) || {};
  switch (d.type) {
    case 'ping':
      post('pong', { version: WORKER_VERSION, busy, hasInstance: !!ffmpeg, loaded: !!(ffmpeg && ffmpeg.loaded) });
      break;
    case 'preload':
      ensureFFmpeg().catch(err => logW('preload fail:', err.message));
      break;
    case 'compress': handleCompress(d); break;
    case 'cancel':   handleCancel(); break;
    default: logW('unknown message:', d.type);
  }
};

self.addEventListener('unhandledrejection', (ev) => { logW('unhandledrejection:', ev.reason); ev.preventDefault(); });
self.addEventListener('error', (ev) => { logE('global error:', ev.message); ev.preventDefault(); });

logI('siap (ESM+UMD core ' + CORE_VERSION + ')');
post('booted', { version: WORKER_VERSION, coreVersion: CORE_VERSION, maxInputMb: LIMITS.maxInputMb });

ensureFFmpeg().catch(err => {
  logW('auto-preload gagal:', err.message);
  post('error', { code: 'PRELOAD_FAIL', message: err.message });
});