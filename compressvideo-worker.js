/* ================================================================
   IRGXYMODS — COMPRESS VIDEO WORKER
   File    : compressvideo-worker.js
   Version : 6.7.0 — ESM CORE FIX & DETAILED CDN LOGGING
   ================================================================ */

'use strict';

const WORKER_VERSION = '6.7.0';
const FFMPEG_VERSION = '0.12.10';
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
  progressThrottleMs: 150,
  fetchTimeoutMs:     60000
});

const logI = (...a) => console.log('[W]', ...a);
const logW = (...a) => console.warn('[W]', ...a);
const logE = (...a) => console.error('[W]', ...a);

function post(type, payload) {
  try { self.postMessage(Object.assign({ type, ts: Date.now() }, payload || {})); }
  catch (e) { logE('post fail', e); }
}

/** Kirim status ke UI + tulis ke console. */
function stage(message) {
  const msg = String(message);
  logI(msg);
  post('status', { stage: 'log', message: msg });
}

function errStr(e) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e.message) return e.message;
  if (e.toString) return e.toString();
  try { return JSON.stringify(e); } catch (_) { return 'Unserializable error'; }
}

function formatBytes(n) {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

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

async function fetchText(url, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITS.fetchTimeoutMs);
  const t0 = Date.now();
  try {
    stage(`  → GET ${label || url}`);
    const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} → ${url}`);
    const text = await res.text();
    stage(`  ← OK  ${label || url} (${formatBytes(text.length)}, ${Date.now() - t0}ms)`);
    return text;
  } catch (e) {
    stage(`  ✗ ERR ${label || url} → ${errStr(e)}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBlobURL(url, mime, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITS.fetchTimeoutMs * 3);
  const t0 = Date.now();
  try {
    stage(`  → GET ${label || url}`);
    const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} → ${url}`);
    const buf = await res.arrayBuffer();
    stage(`  ← OK  ${label || url} (${formatBytes(buf.byteLength)}, ${Date.now() - t0}ms)`);
    return URL.createObjectURL(new Blob([buf], { type: mime }));
  } catch (e) {
    stage(`  ✗ ERR ${label || url} → ${errStr(e)}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* -----------------------------------------------------------------
 * Buat blob-URL dari classWorker.js milik @ffmpeg/ffmpeg (ESM),
 * sambil menulis ulang semua import relatif (./x) menjadi absolut
 * ke CDN, supaya bisa dipakai sebagai module worker.
 * ----------------------------------------------------------------- */
async function createClassWorkerBlobURL(base) {
  const esmBase = `${base}/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm`;
  const url = `${esmBase}/worker.js`;
  const workerSrc = await fetchText(url, `classWorker source`);

  // from './x' atau from "./x"
  const fixed = workerSrc.replace(
    /(\bfrom\s*)(["'])\.\/([^"']+)\2/g,
    (_, pre, q, file) => `${pre}${q}${esmBase}/${file}${q}`
  );

  // import('./x') atau import("./x")
  const fixed2 = fixed.replace(
    /(\bimport\s*\(\s*)(["'])\.\/([^"']+)\2(\s*\))/g,
    (_, pre, q, file, post_) => `${pre}${q}${esmBase}/${file}${q}${post_}`
  );

  const blob = new Blob([fixed2], { type: 'text/javascript' });
  return URL.createObjectURL(blob);
}

/* -----------------------------------------------------------------
 * Muat FFmpeg dari satu CDN.
 * CATATAN PENTING: core HARUS dari dist/esm (bukan umd) karena
 * classWorker berjalan sebagai ES module dan melakukan dynamic
 * import(coreURL) — file UMD tidak punya `export default`.
 * ----------------------------------------------------------------- */
async function loadFFmpegFrom(base) {
  const esmBase  = `${base}/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm`;
  const coreBase = `${base}/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
  const cdnName  = base.split('/')[2];

  // Track blob URLs supaya bisa di-revoke kalau attempt ini gagal.
  const state = { revoked: false, urls: [] };
  const track = (u) => {
    if (state.revoked) { try { URL.revokeObjectURL(u); } catch (_) {} return u; }
    state.urls.push(u);
    return u;
  };
  const revokeAll = () => {
    state.revoked = true;
    for (const u of state.urls) { try { URL.revokeObjectURL(u); } catch (_) {} }
    state.urls.length = 0;
  };

  try {
    stage(`[${cdnName}] Memuat modul FFmpeg ESM dari ${esmBase}`);

    // 1) classWorker (ESM, import relatif di-patch ke CDN absolut)
    stage(`[${cdnName}] Menyiapkan classWorker...`);
    const classWorkerURL = track(await createClassWorkerBlobURL(base));
    stage(`[${cdnName}] classWorker siap (blob URL dibuat)`);

    // 2) Core ESM + WASM (paralel)
    stage(`[${cdnName}] Mengunduh FFmpeg core (ESM) dari ${coreBase}`);
    const [coreURL, wasmURL] = await Promise.all([
      fetchBlobURL(`${coreBase}/ffmpeg-core.js`,   'text/javascript', `[${cdnName}] ffmpeg-core.js`).then(track),
      fetchBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm', `[${cdnName}] ffmpeg-core.wasm`).then(track)
    ]);
    stage(`[${cdnName}] Core ESM berhasil diunduh`);

    // 3) Modul FFmpeg kelasnya
    stage(`[${cdnName}] Mengimpor modul FFmpeg dari ${esmBase}/index.js`);
    const ffmpegMod = await import(/* @vite-ignore */ `${esmBase}/index.js`);

    if (!ffmpegMod || !ffmpegMod.FFmpeg) {
      throw new Error(`Kelas FFmpeg tidak ditemukan di ${esmBase}/index.js`);
    }
    stage(`[${cdnName}] Modul FFmpeg berhasil diimpor`);

    // 4) Instantiate + load
    stage(`[${cdnName}] Membuat instance FFmpeg...`);
    const inst = new ffmpegMod.FFmpeg();
    inst.on('log',      ({ message })  => handleLog(message));
    inst.on('progress', ({ progress }) => handleProgressEvent(progress));

    stage(`[${cdnName}] inst.load() — inisialisasi core (timeout ${LIMITS.loadTimeoutMs}ms)...`);
    await withTimeout(
      inst.load({ coreURL, wasmURL, classWorkerURL }),
      LIMITS.loadTimeoutMs,
      'Load FFmpeg'
    );

    stage(`[${cdnName}] ✓ FFmpeg berhasil dimuat`);
    // Sukses → biarkan blob URL hidup selama worker ini hidup.
    return inst;
  } catch (e) {
    // Gagal → bebaskan semua blob URL attempt ini supaya tidak leak.
    revokeAll();
    throw e;
  }
}

/* -----------------------------------------------------------------
 * Coba tiap CDN berurutan sampai ada yang berhasil.
 * ----------------------------------------------------------------- */
function ensureFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return Promise.resolve(ffmpeg);
  if (loadingPromise) return loadingPromise;

  const p = (async () => {
    const total = CDN_BASES.length;
    let lastErr = null;

    for (let i = 0; i < total; i++) {
      const base = CDN_BASES[i];
      const cdnName = base.split('/')[2];

      if (cancelled) throw new Error('Dibatalkan');

      stage(`━━━ Mencoba CDN ${i + 1}/${total}: ${cdnName} ━━━`);

      try {
        const inst = await loadFFmpegFrom(base);

        if (cancelled) {
          try { await inst.terminate(); } catch (_) {}
          throw new Error('Dibatalkan');
        }

        ffmpeg = inst;
        post('ready', {
          version: WORKER_VERSION,
          coreVersion: CORE_VERSION,
          cdn: cdnName
        });
        stage(`✓ FFmpeg siap digunakan via ${cdnName}`);
        return inst;
      } catch (e) {
        lastErr = e;
        logW('CDN gagal:', base, errStr(e));
        stage(`✗ CDN ${cdnName} GAGAL: ${errStr(e)}`);

        try {
          if (ffmpeg) { await ffmpeg.terminate(); ffmpeg = null; }
        } catch (_) {}

        if (i < total - 1) {
          const nextName = CDN_BASES[i + 1].split('/')[2];
          stage(`↻ Beralih ke CDN berikutnya: ${nextName} ...`);
        }
      }
    }

    const msg = `FFmpeg gagal dimuat dari semua CDN: ${errStr(lastErr)}`;
    stage(`✗✗ ${msg}`);
    throw new Error(msg);
  })();

  loadingPromise = p;
  const clear = () => { if (loadingPromise === p) loadingPromise = null; };
  p.then(clear, clear);

  return p;
}

/* -----------------------------------------------------------------
 * Progress & log helpers
 * ----------------------------------------------------------------- */
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

/* -----------------------------------------------------------------
 * Utilitas
 * ----------------------------------------------------------------- */
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
  } catch (e) { logW('terminate:', errStr(e)); }
}

function mimeFromExt(ext) {
  const map = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
    gif: 'image/gif', mp3: 'audio/mpeg', m4a: 'audio/mp4',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
  };
  return map[String(ext).toLowerCase()] || 'application/octet-stream';
}

/* -----------------------------------------------------------------
 * Kompresi
 * ----------------------------------------------------------------- */
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
    else { logE('compress error:', errStr(e)); post('error', { message: errStr(e) }); }
  } finally {
    busy = false; execStartTs = 0; cancelled = false; effectiveDur = 0;
  }
}

async function handleCancel() {
  const wasBusy = busy;
  cancelled = true;
  await safeTerminate();
  busy = false; execStartTs = 0;
  // Kalau ada kompresi aktif, handleCompress() yang akan post('cancelled')
  // setelah promise-nya reject. Hindari double-post.
  if (!wasBusy) post('cancelled', {});
}

/* -----------------------------------------------------------------
 * State global
 * ----------------------------------------------------------------- */
let ffmpeg         = null;
let loadingPromise = null;
let busy           = false;
let cancelled      = false;
let execStartTs    = 0;
let lastEmit       = 0;
let effectiveDur   = 0;
let lastLoggedSec  = -1;

/* -----------------------------------------------------------------
 * Message router
 * ----------------------------------------------------------------- */
self.onmessage = function (e) {
  const d = (e && e.data) || {};
  switch (d.type) {
    case 'ping':
      post('pong', {
        version: WORKER_VERSION,
        busy,
        hasInstance: !!ffmpeg,
        loaded: !!(ffmpeg && ffmpeg.loaded)
      });
      break;
    case 'preload':
      ensureFFmpeg().catch(err => logW('preload fail:', errStr(err)));
      break;
    case 'compress': handleCompress(d); break;
    case 'cancel':   handleCancel();    break;
    default: logW('unknown message:', d.type);
  }
};

self.addEventListener('unhandledrejection', (ev) => {
  logW('unhandledrejection:', errStr(ev.reason));
  ev.preventDefault();
});

self.addEventListener('error', (ev) => {
  logE('global error:', ev.message);
  ev.preventDefault();
});

logI(`siap (ESM core fix, core ${CORE_VERSION}, worker v${WORKER_VERSION})`);
post('booted', {
  version: WORKER_VERSION,
  coreVersion: CORE_VERSION,
  maxInputMb: LIMITS.maxInputMb
});

ensureFFmpeg().catch(err => {
  logW('auto-preload gagal:', errStr(err));
  post('error', { code: 'PRELOAD_FAIL', message: errStr(err) });
});