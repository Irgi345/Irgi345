/* ================================================================
   IRGXYMODS — COMPRESS VIDEO WORKER
   File    : compressvideo-worker.js
   Version : 6.5.1 — ESM MODULE WORKER / MULTI-CDN FIX
   ================================================================
   [FIX] FFmpeg.wasm 0.12.x tidak kompatibel dengan importScripts (UMD)
         → ganti ke Module Worker + dynamic import() (ESM).
   [FIX] Multi-CDN fallback untuk ESM module loading.
   [KEEP] XHR download progress untuk core JS/WASM.
   [KEEP] Parse time= fallback, exitCode normalization, cancel race.
   ================================================================ */

'use strict';

const WORKER_VERSION = '6.5.1';
const FFMPEG_VERSION = '0.12.10';
const UTIL_VERSION   = '0.12.1';
const CORE_VERSION   = '0.12.10';
const MAX_CDN_RETRIES = 3;
const CDN_BACKOFF_MS  = [1000, 2000, 4000];

const CDN_BASES = Object.freeze([
  'https://cdn.jsdelivr.net/npm',
  'https://unpkg.com',
  'https://cdnjs.cloudflare.com/ajax/libs'
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

function post(type, payload) {
  try { self.postMessage(Object.assign({ type, ts: Date.now() }, payload || {})); }
  catch (e) { logE('post fail', e); }
}

let FFmpeg       = null;
let toBlobURL    = null;
let modulesReady = false;

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

/** Load FFmpeg ESM modules via dynamic import() dari multi-CDN. */
async function loadFFmpegModules() {
  if (modulesReady) return;
  let lastErr = null;

  for (const base of CDN_BASES) {
    try {
      const ffmpegUrl = base + '/@ffmpeg/ffmpeg@' + FFMPEG_VERSION + '/dist/esm/index.js';
      const utilUrl   = base + '/@ffmpeg/util@' + UTIL_VERSION + '/dist/esm/index.js';

      post('status', { message: 'Memuat modul ESM (' + base.split('/')[2] + ')...' });

      const [ffMod, utilMod] = await Promise.all([
        import(/* webpackIgnore: true */ ffmpegUrl),
        import(/* webpackIgnore: true */ utilUrl)
      ]);

      if (ffMod && ffMod.FFmpeg && utilMod && utilMod.toBlobURL) {
        FFmpeg = ffMod.FFmpeg;
        toBlobURL = utilMod.toBlobURL;
        modulesReady = true;
        logI('ESM modules loaded via', base);
        return;
      }
      throw new Error('Modul tidak lengkap dari ' + base);
    } catch (e) {
      lastErr = e;
      logW('ESM load fail:', base, e && e.message);
    }
  }
  throw new Error('Gagal memuat FFmpeg ESM dari semua CDN: ' + (lastErr && lastErr.message));
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

async function ensureFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (!modulesReady) await loadFFmpegModules();

    let lastErr = null;
    for (const base of CDN_BASES) {
      for (let attempt = 0; attempt < MAX_CDN_RETRIES; attempt++) {
        if (cancelled) throw new Error('Dibatalkan');
        try {
          const cdnName = base.split('/')[2];
          post('status', {
            stage: 'core-downloading',
            message: 'Mengunduh core (' + cdnName + ' ' + (attempt + 1) + '/' + MAX_CDN_RETRIES + ')...'
          });

          const inst = new FFmpeg();
          inst.on('log',      ({ message })  => handleLog(message));
          inst.on('progress', ({ progress }) => handleProgressEvent(progress));

          const coreBase = base + '/@ffmpeg/core@' + CORE_VERSION + '/dist/esm';
          const coreURL = await fetchBlobURL(coreBase + '/ffmpeg-core.js', 'text/javascript',
            (l, t) => { if (t) post('status', { stage: 'core-downloading',
              message: 'Core JS ' + Math.round((l / t) * 100) + '%' }); });
          const wasmURL = await fetchBlobURL(coreBase + '/ffmpeg-core.wasm', 'application/wasm',
            (l, t) => { if (t) post('status', { stage: 'core-downloading',
              message: 'Core WASM ' + Math.round((l / t) * 100) + '%' }); });

          post('status', { stage: 'wasm-compiling', message: 'Kompilasi WASM...' });

          await withTimeout(inst.load({ coreURL, wasmURL }), LIMITS.loadTimeoutMs, 'Load FFmpeg');

          if (cancelled) { try { await inst.terminate(); } catch (_) {} throw new Error('Dibatalkan'); }

          ffmpeg = inst;
          loadingPromise = null;
          post('ready', { version: WORKER_VERSION, coreVersion: CORE_VERSION, cdn: cdnName });
          logI('FFmpeg ready via', cdnName);
          return inst;
        } catch (e) {
          lastErr = e;
          logW('CDN ' + base + ' attempt ' + (attempt + 1) + ' gagal:', e && e.message);
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

    if (!fileBuffer || !(fileBuffer instanceof ArrayBuffer)) throw new Error('Data file tidak valid.');
    const bytes = fileBuffer.byteLength;
    if (bytes <= 0) throw new Error('File kosong.');

    if (bytes > LIMITS.warnInputMb * 1048576) {
      post('status', { message: '⚠ Input > ' + LIMITS.warnInputMb + 'MB — mungkin lambat.' });
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

async function handleCancel() {
  cancelled = true;
  await safeTerminate();
  busy = false;
  execStartTs = 0;
  post('cancelled', {});
}

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

logI('siap (ESM worker, core ' + CORE_VERSION + ')');
post('booted', { version: WORKER_VERSION, coreVersion: CORE_VERSION, maxInputMb: LIMITS.maxInputMb });

ensureFFmpeg().catch(err => {
  logW('auto-preload gagal:', err.message);
  post('error', { code: 'PRELOAD_FAIL', message: err.message });
});