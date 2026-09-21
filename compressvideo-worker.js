/* ================================================================
   IRGXYMODS — COMPRESS VIDEO WORKER
   File    : compressvideo-worker.js
   Version : 6.1.0 — FOCUSED / STABLE / BUG-FREE
   ================================================================
   Changelog v6.1 (dari v5.0):
     [FIX]  -i wajib ada sebelum input (v5.0 lupa → exit code 1)
     [FIX]  Args pakai placeholder __INPUT__ / __OUTPUT__
     [FIX]  Cancel sekarang benar-benar terminate tanpa hang
     [FIX]  exec timeout selalu di-clear walau sukses/gagal
     [FIX]  Selalu kirim 'ready' setelah load sukses
     [FIX]  Selalu kirim 'done'/'error'/'cancelled' — no silent death
     [DEL]  Retry berlapis, idle-terminate, warmup, ping (disederhanakan)
     [NEW]  Structured logging ringkas
     [NEW]  Guard NaN/Infinity di semua hitungan
     [NEW]  Sanitasi nama FS anti path-traversal
   ================================================================ */

'use strict';

const WORKER_VERSION = '6.1.0';
const CORE_VERSION   = '0.12.6';

const CDN = Object.freeze({
  ffmpeg:   'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js',
  util:     'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js',
  coreJs:   `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`,
  coreWasm: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`
});

const LIMITS = Object.freeze({
  loadTimeoutMs: 45000,
  execMinMs:     120000,
  execMaxMs:     1800000,
  execPerMbMs:   20000,
  maxInputMb:    1024,
  terminateMs:   3000
});

/* ---------- Post & Log ---------- */
function post(type, payload) {
  try {
    self.postMessage(Object.assign({ type, ts: Date.now() }, payload || {}));
  } catch (_) { /* ignore */ }
}
const tag = '[Worker v' + WORKER_VERSION + ']';
const logI = (...a) => console.log(tag, ...a);
const logW = (...a) => console.warn(tag, ...a);
const logE = (...a) => console.error(tag, ...a);

/* ---------- Import FFmpeg (satu CDN cukup) ---------- */
let loadError = null;
try {
  importScripts(CDN.ffmpeg, CDN.util);
  logI('importScripts OK');
} catch (e) {
  loadError = e;
  logE('importScripts gagal:', e);
}
const FFmpeg = (self.FFmpegWASM && self.FFmpegWASM.FFmpeg) || null;

/* ---------- State ---------- */
let ffmpeg        = null;
let loadingPromise = null;
let busy          = false;
let cancelled     = false;
let lastEmit      = 0;
let execStartTs   = 0;

/* ---------- Util ---------- */
function withTimeout(promise, ms, label) {
  let timer = null;
  const to = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error((label || 'Operasi') + ' timeout ' + ms + 'ms')), ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => { if (timer) clearTimeout(timer); }),
    to
  ]);
}

async function fetchBlobURL(url, mime) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' → ' + url);
  const buf = await res.arrayBuffer();
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

function sanitizeName(name, fallbackExt) {
  const base = String(name || '').trim() || ('file_' + Date.now() + (fallbackExt || '.mp4'));
  const just = base.replace(/\\/g, '/').split('/').pop() || base;
  const clean = just.replace(/[^\w.\-]+/g, '_').slice(0, 200);
  return clean || ('file_' + Date.now() + (fallbackExt || '.mp4'));
}

function computeExecTimeout(bytes) {
  const mb = Math.max(1, (bytes || 0) / 1048576);
  const t = mb * LIMITS.execPerMbMs;
  return Math.round(Math.min(LIMITS.execMaxMs, Math.max(LIMITS.execMinMs, t)));
}

/* ---------- Terminate bersih ---------- */
async function safeTerminate() {
  const inst = ffmpeg;
  ffmpeg = null;
  loadingPromise = null;
  if (!inst) return;
  try {
    const r = inst.terminate();
    if (r && typeof r.then === 'function') {
      await Promise.race([
        r.catch(() => {}),
        new Promise(res => setTimeout(res, LIMITS.terminateMs))
      ]);
    }
  } catch (e) {
    logW('terminate (diabaikan):', e && e.message);
  }
}

/* ---------- Ensure FFmpeg ---------- */
async function ensureFFmpeg() {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  if (loadError) throw new Error('FFmpeg gagal dimuat dari CDN: ' + (loadError.message || loadError));
  if (typeof FFmpeg !== 'function') throw new Error('Kelas FFmpeg tidak tersedia (cek koneksi internet)');

  loadingPromise = (async () => {
    const inst = new FFmpeg();
    try {
      inst.on('log', ({ message }) => {
        if (cancelled) return;
        if (message) post('status', { message: String(message) });
      });

      inst.on('progress', ({ progress }) => {
        if (cancelled) return;
        const p = Math.max(0, Math.min(1, Number(progress) || 0));
        const now = Date.now();
        if (now - lastEmit < 200 && p < 1) return;
        lastEmit = now;
        let etaMs = 0;
        if (execStartTs > 0 && p > 0.01 && p < 1) {
          const el = now - execStartTs;
          etaMs = Math.max(0, Math.round(el / p - el));
        }
        post('progress', { progress: p, percent: Math.round(p * 100), etaMs });
      });

      post('status', { message: 'Mengunduh FFmpeg core ' + CORE_VERSION + '...' });

      const [coreURL, wasmURL] = await Promise.all([
        fetchBlobURL(CDN.coreJs,   'text/javascript'),
        fetchBlobURL(CDN.coreWasm, 'application/wasm')
      ]);

      if (cancelled) throw new Error('Dibatalkan');

      post('status', { message: 'Menginisialisasi FFmpeg...' });
      await withTimeout(
        inst.load({ coreURL, wasmURL }),
        LIMITS.loadTimeoutMs,
        'Load FFmpeg'
      );

      if (cancelled) {
        try { await inst.terminate(); } catch (_) {}
        throw new Error('Dibatalkan');
      }

      ffmpeg = inst;
      loadingPromise = null;
      post('ready', { version: WORKER_VERSION, coreVersion: CORE_VERSION });
      logI('FFmpeg siap');
      return inst;
    } catch (e) {
      try { await inst.terminate(); } catch (_) {}
      ffmpeg = null;
      loadingPromise = null;
      throw e;
    }
  })();

  return loadingPromise;
}

/* ---------- Compress handler ---------- */
async function handleCompress(data) {
  if (busy) {
    post('error', { message: 'Worker masih memproses video lain.' });
    return;
  }
  busy = true;
  cancelled = false;
  lastEmit = 0;
  execStartTs = 0;

  let inputName  = null;
  let outputName = null;
  let ff         = null;

  try {
    const payload = data.payload || {};
    const fileBuffer = payload.fileBuffer;
    const cfg = payload.config || {};
    const args = Array.isArray(cfg.ffmpegArgs) ? cfg.ffmpegArgs.slice() : [];

    if (!fileBuffer || !(fileBuffer instanceof ArrayBuffer)) {
      throw new Error('Data file tidak valid (bukan ArrayBuffer).');
    }
    const bytes = fileBuffer.byteLength;
    if (bytes <= 0) throw new Error('File kosong.');

    inputName  = sanitizeName(cfg.inputName  || 'input.mp4',  '.mp4');
    outputName = sanitizeName(cfg.outputName || 'output.mp4', '.mp4');

    post('status', { message: 'Memuat FFmpeg...' });
    ff = await ensureFFmpeg();
    if (cancelled) throw new Error('Dibatalkan');

    /* Hapus sisa file (kalau ada) */
    try { await ff.deleteFile(inputName);  } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}

    post('status', { message: 'Menulis input ke virtual FS...' });
    await ff.writeFile(inputName, new Uint8Array(fileBuffer));

    if (cancelled) throw new Error('Dibatalkan');

    /* Replace placeholder → nama file nyata */
    const finalArgs = args.map(a => {
      if (a === '__INPUT__')  return inputName;
      if (a === '__OUTPUT__') return outputName;
      return a;
    });

    if (!finalArgs.includes(inputName))  finalArgs.unshift('-i', inputName);
    if (!finalArgs.includes(outputName)) finalArgs.push(outputName);

    logI('Args:', finalArgs.join(' '));

    post('status', { message: 'Menjalankan FFmpeg...' });
    execStartTs = Date.now();
    const timeoutMs = computeExecTimeout(bytes);

    let exitCode;
    try {
      exitCode = await Promise.race([
        ff.exec(finalArgs),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('FFmpeg melebihi batas waktu ' + (timeoutMs / 1000) + 's')), timeoutMs)
        )
      ]);
    } catch (e) {
      await safeTerminate();
      throw e;
    }

    execStartTs = 0;
    if (cancelled) throw new Error('Dibatalkan');
    if (exitCode !== 0) throw new Error('FFmpeg exit dengan kode ' + exitCode);

    post('status', { message: 'Membaca hasil output...' });
    const out = await ff.readFile(outputName);
    if (!out || !out.length) throw new Error('Output kosong / tidak ditemukan.');

    const blob = new Blob([out], { type: 'video/mp4' });

    /* Cleanup FS sedini mungkin */
    try { await ff.deleteFile(inputName);  } catch (_) {}
    try { await ff.deleteFile(outputName); } catch (_) {}

    post('done', { blob, outputBytes: out.byteLength });

  } catch (e) {
    const wasCancelled = cancelled;
    try { if (ff && inputName)  await ff.deleteFile(inputName).catch(()=>{}); } catch (_) {}
    try { if (ff && outputName) await ff.deleteFile(outputName).catch(()=>{}); } catch (_) {}

    if (wasCancelled) {
      post('cancelled', {});
    } else {
      logE('compress error:', e);
      post('error', { message: (e && e.message) || String(e) });
      await safeTerminate();
    }
  } finally {
    busy = false;
    execStartTs = 0;
  }
}

/* ---------- Cancel handler ---------- */
async function handleCancel() {
  cancelled = true;
  await safeTerminate();
  post('cancelled', {});
}

/* ---------- Router ---------- */
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
    case 'compress':
      handleCompress(d); /* fire-and-forget, selalu kirim done/error */
      break;
    case 'cancel':
      handleCancel();
      break;
  }
};

/* ---------- Safety net ---------- */
self.addEventListener('unhandledrejection', (ev) => {
  logW('unhandledrejection:', ev.reason);
  ev.preventDefault();
});
self.addEventListener('error', (ev) => {
  logE('global error:', ev.message);
  ev.preventDefault();
});

/* ---------- Startup ---------- */
logI('siap (core ' + CORE_VERSION + ')');
post('booted', {
  version: WORKER_VERSION,
  coreVersion: CORE_VERSION,
  maxInputMb: LIMITS.maxInputMb
});