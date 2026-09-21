/* ================================================================
   IRGXYMODS — COMPRESS VIDEO WORKER
   File    : compressvideo-worker.js
   Version : 6.5.0 — AUTO-PRELOAD / MULTI-CDN / PRECISE
   ================================================================
   Changelog v6.5 (dari v6.1):
     [NEW] Auto-preload FFmpeg saat boot (background)
     [NEW] Multi-CDN fallback: jsdelivr → unpkg (retry 3x, backoff)
     [NEW] XHR download progress untuk core JS/WASM
     [NEW] Parse time=HH:MM:SS.ms dari log sebagai fallback progress
     [NEW] Force 100% sebelum done
     [NEW] Normalisasi exitCode (Number || 0)
     [NEW] Deteksi crossOriginIsolated → error COOP_COEP
     [NEW] Warning input > 700MB
     [NEW] Output format: MP4/WebM/MKV/GIF/MP3/M4A/Thumbnail
     [NEW] Stage events: booted/core-downloading/core-loaded/ready
     [FIX] Filter args NaN/undefined sebelum exec
     [FIX] Cancel: race terminate 3s, reset state bersih
     [FIX] deleteFile() dipanggil sebelum post('done')
   ================================================================ */

'use strict';

const WORKER_VERSION    = '6.5.0';
const CORE_VERSION      = '0.12.10';
const MAX_CDN_RETRIES   = 3;
const CDN_BACKOFF_MS    = [1000, 2000, 4000];

const CDN_BASES = Object.freeze([
  { name: 'jsdelivr', base: 'https://cdn.jsdelivr.net/npm' },
  { name: 'unpkg',    base: 'https://unpkg.com' }
]);

const LIMITS = Object.freeze({
  loadTimeoutMs:      60000,
  execMinMs:          120000,
  execMaxMs:          3600000,
  execPerMbMs:        25000,
  maxInputMb:         1024,
  warnInputMb:        700,
  terminateMs:        3000,
  progressThrottleMs: 150,
  xhrTimeoutMs:       60000
});

const DEBUG = false;
const logI = DEBUG ? (...a) => console.log('[W]', ...a) : () => {};
const logW = (...a) => console.warn('[W]', ...a);
const logE = (...a) => console.error('[W]', ...a);

/** Post structured message to client. */
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

/** Promise race dengan timeout. */
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

/** Fetch URL sebagai blob URL dengan progress callback via XHR. */
function fetchBlobURL(url, mime, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = LIMITS.xhrTimeoutMs;
    xhr.onprogress = (e) => {
      if (typeof onProgress === 'function') {
        onProgress(e.loaded || 0, e.lengthComputable ? e.total : 0);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(URL.createObjectURL(new Blob([xhr.response], { type: mime }))); }
        catch (e) { reject(e); }
      } else {
        reject(new Error('HTTP ' + xhr.status + ' → ' + url));
      }
    };
    xhr.onerror = () => reject(new Error('Network error → ' + url));
    xhr.ontimeout = () => reject(new Error('XHR timeout → ' + url));
    xhr.send();
  });
}

/** Load FFmpeg UMD scripts dari satu CDN base. */
function loadScriptsFrom(base) {
  const ffUrl   = base + '/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
  const utilUrl = base + '/@ffmpeg/util@0.12.1/dist/umd/index.js';
  importScripts(ffUrl, utilUrl);
}

/** Pastikan FFmpegWASM & FFmpegUtil tersedia di global. */
function ensureScriptsLoaded() {
  if (self.FFmpegWASM && self.FFmpegWASM.FFmpeg) return;
  let lastErr = null;
  for (const cdn of CDN_BASES) {
    try {
      loadScriptsFrom(cdn.base);
      if (self.FFmpegWASM && self.FFmpegWASM.FFmpeg) { logI('scripts loaded via', cdn.name); return; }
    } catch (e) { lastErr = e; logW('scripts fail', cdn.name, e && e.message); }
  }
  throw new Error('Gagal memuat FFmpeg dari semua CDN: ' + (lastErr && lastErr.message));
}

/** Emit progress ter-throttle. */
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

/** Handle log dari FFmpeg — parse time= untuk progress fallback. */
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

/** Handle progress event native dari FFmpeg. */
function handleProgressEvent(progress) {
  if (cancelled) return;
  emitProgress(Math.max(0, Math.min(1, Number(progress) || 0)));
}

/** Load FFmpeg instance dengan multi-CDN fallback. */
async function ensureFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  if (typeof SharedArrayBuffer !== 'undefined' && !self.crossOriginIsolated) {
    logW('crossOriginIsolated = false — SAB tidak tersedia, FFmpeg akan lambat');
  }

  loadingPromise = (async () => {
    let lastErr = null;
    ensureScriptsLoaded();

    for (let cdnIdx = 0; cdnIdx < CDN_BASES.length; cdnIdx++) {
      const cdn = CDN_BASES[cdnIdx];
      const coreJs   = cdn.base + '/@ffmpeg/core@' + CORE_VERSION + '/dist/umd/ffmpeg-core.js';
      const coreWasm = cdn.base + '/@ffmpeg/core@' + CORE_VERSION + '/dist/umd/ffmpeg-core.wasm';

      for (let attempt = 0; attempt < MAX_CDN_RETRIES; attempt++) {
        if (cancelled) throw new Error('Dibatalkan');
        try {
          post('status', { stage: 'core-downloading',
            message: 'Mengunduh core (' + cdn.name + ' ' + (attempt + 1) + '/' + MAX_CDN_RETRIES + ')...' });

          const inst = new self.FFmpegWASM.FFmpeg();
          inst.on('log',      ({ message })  => handleLog(message));
          inst.on('progress', ({ progress }) => handleProgressEvent(progress));

          const [coreURL, wasmURL] = await Promise.all([
            fetchBlobURL(coreJs, 'text/javascript', (l, t) => {
              if (t) post('status', { stage: 'core-downloading',
                message: 'Core JS ' + Math.round((l / t) * 100) + '%' });
            }),
            fetchBlobURL(coreWasm, 'application/wasm', (l, t) => {
              if (t) post('status', { stage: 'core-downloading',
                message: 'Core WASM ' + Math.round((l / t) * 100) + '%' });
            })
          ]);

          post('status', { stage: 'wasm-compiling', message: 'Kompilasi WASM...' });

          await withTimeout(inst.load({ coreURL, wasmURL }), LIMITS.loadTimeoutMs, 'Load FFmpeg');

          if (cancelled) { try { await inst.terminate(); } catch (_) {} throw new Error('Dibatalkan'); }

          ffmpeg = inst;
          loadingPromise = null;
          post('ready', { version: WORKER_VERSION, coreVersion: CORE_VERSION, cdn: cdn.name });
          logI('FFmpeg ready via', cdn.name);
          return inst;
        } catch (e) {
          lastErr = e;
          logW('CDN ' + cdn.name + ' attempt ' + (attempt + 1) + ' gagal:', e && e.message);
          ffmpeg = null;
          if (attempt < MAX_CDN_RETRIES - 1) {
            await new Promise(r => setTimeout(r, CDN_BACKOFF_MS[attempt] || 4000));
          }
        }
      }
    }
    loadingPromise = null;
    throw new Error('FFmpeg gagal dimuat dari semua CDN: ' + (lastErr && lastErr.message));
  })();

  return loadingPromise;
}

/** Sanitasi nama file FS. */
function sanitizeName(name, fallbackExt) {
  const base = String(name || '').trim() || ('file_' + Date.now() + (fallbackExt || '.mp4'));
  const just = base.replace(/\\/g, '/').split('/').pop() || base;
  const clean = just.replace(/[^\w.\-]+/g, '_').slice(0, 200);
  return clean || ('file_' + Date.now() + (fallbackExt || '.mp4'));
}

/** Hitung exec timeout berdasarkan ukuran input. */
function computeExecTimeout(bytes) {
  const mb = Math.max(1, (bytes || 0) / 1048576);
  return Math.round(Math.min(LIMITS.execMaxMs, Math.max(LIMITS.execMinMs, mb * LIMITS.execPerMbMs)));
}

/** Terminate FFmpeg dengan race timeout. */
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

/** Ekstensi → MIME. */
function mimeFromExt(ext) {
  const map = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    gif: 'image/gif', mp3: 'audio/mpeg', m4a: 'audio/mp4',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
  };
  return map[String(ext).toLowerCase()] || 'application/octet-stream';
}

/** Handler utama compress. */
async function handleCompress(data) {
  if (busy) { post('error', { code: 'BUSY', message: 'Worker masih memproses video lain.' }); return; }
  busy = true;
  cancelled = false;
  lastEmit = 0;
  execStartTs = 0;
  lastLoggedSec = -1;

  let inputName = null;
  let outputName = null;
  let ff = null;

  try {
    const payload    = data.payload || {};
    const fileBuffer = payload.fileBuffer;
    const cfg        = payload.config || {};
    let   args       = Array.isArray(cfg.ffmpegArgs) ? cfg.ffmpegArgs.slice() : [];
    effectiveDur     = Number(cfg.effectiveDuration) || 0;

    if (!fileBuffer || !(fileBuffer instanceof ArrayBuffer)) throw new Error('Data file tidak valid (bukan ArrayBuffer).');
    const bytes = fileBuffer.byteLength;
    if (bytes <= 0) throw new Error('File kosong.');

    if (bytes > LIMITS.warnInputMb * 1048576) {
      post('status', { message: '⚠ Input > ' + LIMITS.warnInputMb + 'MB — mungkin lambat / gagal di perangkat low-end.' });
    }

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

    logI('Args:', finalArgs.join(' '));
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
    } catch (e) {
      await safeTerminate();
      throw e;
    }

    exitCode = Number(exitCode) || 0;
    execStartTs = 0;

    if (cancelled) throw new Error('Dibatalkan');
    if (exitCode !== 0) throw new Error('FFmpeg exit code ' + exitCode);

    post('progress', { progress: 1, percent: 100, etaMs: 0 });

    post('status', { message: 'Membaca hasil output...' });
    const out = await ff.readFile(outputName);
    if (!out || !out.length) throw new Error('Output kosong / tidak ditemukan.');

    const ext  = (outputName.split('.').pop() || 'mp4').toLowerCase();
    const blob = new Blob([out], { type: mimeFromExt(ext) });

    try { await ff.deleteFile(inputName);  } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}

    post('done', { blob, outputBytes: out.byteLength, mime: blob.type });

  } catch (e) {
    const wasCancelled = cancelled;
    try { if (ff && inputName)  await ff.deleteFile(inputName).catch(() => {});  } catch (_) {}
    try { if (ff && outputName) await ff.deleteFile(outputName).catch(() => {}); } catch (_) {}

    if (wasCancelled) {
      post('cancelled', {});
    } else {
      logE('compress error:', e);
      post('error', { message: (e && e.message) || String(e) });
    }
  } finally {
    busy = false;
    execStartTs = 0;
    cancelled = false;
    effectiveDur = 0;
  }
}

/** Cancel handler. */
async function handleCancel() {
  cancelled = true;
  await safeTerminate();
  busy = false;
  execStartTs = 0;
  post('cancelled', {});
}

/* ---------- Router ---------- */
self.onmessage = function (e) {
  const d = (e && e.data) || {};
  switch (d.type) {
    case 'ping':
      post('pong', { version: WORKER_VERSION, busy,
        hasInstance: !!ffmpeg, loaded: !!(ffmpeg && ffmpeg.loaded) });
      break;
    case 'preload':
      ensureFFmpeg().catch(err => logW('preload fail:', err.message));
      break;
    case 'compress':
      handleCompress(d);
      break;
    case 'cancel':
      handleCancel();
      break;
    default:
      logW('unknown message type:', d.type);
  }
};

self.addEventListener('unhandledrejection', (ev) => { logW('unhandledrejection:', ev.reason); ev.preventDefault(); });
self.addEventListener('error', (ev) => { logE('global error:', ev.message); ev.preventDefault(); });

logI('siap (core ' + CORE_VERSION + ')');
post('booted', { version: WORKER_VERSION, coreVersion: CORE_VERSION, maxInputMb: LIMITS.maxInputMb });

/* Auto-preload FFmpeg saat boot */
ensureFFmpeg().catch(err => {
  logW('auto-preload gagal:', err.message);
  post('error', { code: 'PRELOAD_FAIL', message: err.message });
});