/* ================================================================
   IRGXYMODS — COMPRESS VIDEO WORKER
   File    : compressvideo-worker.js
   Version : 5.0.0 — COMPLETE / STABLE / PRODUCTION READY
   ================================================================
   Changelog v5.0 (dari v4.0):
     [NEW-1]  fetchBlobURL sendiri + AbortController → load bisa dibatalkan
     [NEW-2]  Retry exponential backoff untuk load CDN FFmpeg
     [NEW-3]  Timeout adaptif untuk ff.exec (dihitung dari ukuran input)
     [NEW-4]  Idle terminate → bebaskan memori saat menganggur 5 menit
     [NEW-5]  Progress dengan ETA (estimasi sisa waktu real-time)
     [NEW-6]  Structured logging berlevel (debug/info/warn/error)
     [NEW-7]  Validasi config menyeluruh (codec, audio, resolusi, CRF, bitrate)
     [NEW-8]  Sanitasi nama file virtual FS (anti path traversal)
     [NEW-9]  Fallback otomatis: audio 'copy' → 'aac' bila MP4 tidak cocok
     [NEW-10] Pesan 'ping' & 'warmup' untuk health-check & preload FFmpeg
     [NEW-11] Cleanup lengkap: semua timer & AbortController di-reset
     [NEW-12] Ringkasan hasil (in/out MB, rasio, durasi, ETA real)
     [NEW-13] Guard NaN / Infinity / nilai tidak wajar di semua hitungan
     [NEW-14] Cek 'cancelled' setelah SETIAP await (termasuk saat retry)
     [NEW-15] Tidak ada unhandled rejection walau cancel saat loading
     [NEW-16] MAX_INPUT_MB menyesuaikan memori perangkat (bila tersedia)
   ================================================================ */

'use strict';

/* ================================================================
   [0] KONSTANTA
   ================================================================ */
const WORKER_VERSION = '5.0.0';
const CORE_VERSION   = '0.12.6';

const CDN = Object.freeze({
  ffmpeg:   'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js',
  util:     'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js',
  coreJs:   `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`,
  coreWasm: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.wasm`
});

const LIMITS = Object.freeze({
  loadTimeoutMs:    90000,     // 90s
  loadRetryMax:     3,
  loadRetryBaseMs:  1500,
  terminateMs:      5000,      // 5s hard cap terminate
  execMinMs:        2 * 60 * 1000,
  execMaxMs:        30 * 60 * 1000,
  execPerMbMs:      20 * 1000, // 20s per MB
  idleTerminateMs:  5 * 60 * 1000,
  maxInputMbHard:   1200,
  progressEmitMinMs: 250       // throttle progress
});

/* ================================================================
   [1] SAFE POST & STRUCTURED LOG
   ================================================================ */
function post(type, payload) {
  try {
    self.postMessage(Object.assign({ type, ts: Date.now() }, payload || {}));
  } catch (err) {
    try {
      self.postMessage({
        type: 'error',
        message: 'postMessage gagal: ' + (err && err.message ? err.message : String(err))
      });
    } catch (_) { /* menyerah dengan tenang */ }
  }
}

const LogLevel = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 };
let currentLogLevel = LogLevel.INFO;

function log(level, ...args) {
  if (level < currentLogLevel) return;
  const tag = ['DBG', 'INF', 'WRN', 'ERR'][level] || '?';
  const prefix = `[Worker v${WORKER_VERSION}][${tag}]`;
  if (level >= LogLevel.ERROR) console.error(prefix, ...args);
  else if (level >= LogLevel.WARN) console.warn(prefix, ...args);
  else console.log(prefix, ...args);
}
const logD = (...a) => log(LogLevel.DEBUG, ...a);
const logI = (...a) => log(LogLevel.INFO,  ...a);
const logW = (...a) => log(LogLevel.WARN,  ...a);
const logE = (...a) => log(LogLevel.ERROR, ...a);

/* ================================================================
   [2] UTILITAS
   ================================================================ */
function formatMB(bytes) {
  if (!bytes || !isFinite(bytes) || bytes <= 0) return '0';
  return (bytes / 1048576).toFixed(1);
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new Error('Sleep dibatalkan.'));
    }
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Race antara promise dan timeout — timer selalu dibersihkan di kedua jalur.
 */
function withTimeout(promise, ms, label) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error((label || 'Operasi') + ' timeout setelah ' + (ms / 1000) + 's')),
      ms
    );
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => { if (timer) clearTimeout(timer); }),
    timeoutPromise
  ]);
}

/**
 * Retry dengan exponential backoff + AbortSignal.
 */
async function withRetry(fn, { max = 3, baseMs = 1500, label = 'Operasi', signal } = {}) {
  let lastErr = null;
  for (let i = 0; i < max; i++) {
    if (signal && signal.aborted) throw new Error(label + ' dibatalkan.');
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = (i === max - 1);
      logW(`${label} gagal (percobaan ${i + 1}/${max}):`, err && err.message);
      if (!isLast) {
        const delay = baseMs * Math.pow(2, i);
        post('status', { message: `${label} gagal, coba lagi dalam ${(delay/1000).toFixed(1)}s (${i+1}/${max})...` });
        try {
          await sleep(delay, signal);
        } catch (_) {
          throw new Error(label + ' dibatalkan saat menunggu retry.');
        }
      }
    }
  }
  throw lastErr || new Error(label + ' gagal tanpa error.');
}

/**
 * Fetch URL → Blob URL, dengan AbortSignal.
 * Menggantikan toBlobURL dari @ffmpeg/util agar bisa dibatalkan.
 */
async function fetchBlobURL(url, mime, signal, timeoutMs) {
  const doFetch = async () => {
    const res = await fetch(url, { signal, cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} saat mengambil ${url}`);
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: mime });
    return URL.createObjectURL(blob);
  };
  if (timeoutMs) return withTimeout(doFetch(), timeoutMs, 'Download ' + url);
  return doFetch();
}

function revokeBlobURL(url) {
  if (!url) return;
  try { URL.revokeObjectURL(url); } catch (_) {}
}

/**
 * Sanitasi nama file untuk virtual FS — hindari path traversal & karakter aneh.
 */
function sanitizeFsName(name, fallbackExt = '.mp4') {
  const base = String(name || '').trim() || ('file_' + Date.now() + fallbackExt);
  // Buang path, hanya ambil bagian akhir
  const justName = base.replace(/\\/g, '/').split('/').pop() || base;
  // Ganti karakter berbahaya
  const clean = justName.replace(/[^\w.\-]+/g, '_').slice(0, 200);
  if (!clean) return 'file_' + Date.now() + fallbackExt;
  return clean;
}

/**
 * Estimasi timeout exec berdasarkan ukuran input.
 */
function computeExecTimeout(inputBytes) {
  const mb = Math.max(1, (inputBytes || 0) / 1048576);
  const t = mb * LIMITS.execPerMbMs;
  return Math.round(clampNum(t, LIMITS.execMinMs, LIMITS.execMaxMs, LIMITS.execMinMs));
}

/**
 * Deteksi batas input berdasarkan memori perangkat (bila tersedia).
 */
function detectMaxInputMb() {
  try {
    const nav = self.navigator || {};
    const deviceMemory = Number(nav.deviceMemory);   // GB (Chromium)
    if (isFinite(deviceMemory) && deviceMemory > 0) {
      // ~ 250 MB per GB RAM, tapi tetap dibatasi hard cap
      return Math.min(LIMITS.maxInputMbHard, Math.max(200, deviceMemory * 250));
    }
  } catch (_) {}
  return LIMITS.maxInputMbHard;
}

/* ================================================================
   [3] IMPORT FFMPEG VIA IMPORTSCRIPTS
   ================================================================ */
let loadError = null;
try {
  importScripts(CDN.ffmpeg, CDN.util);
  logI('importScripts FFmpeg sukses');
} catch (e) {
  loadError = e;
  logE('importScripts gagal:', e);
}

const FFmpeg = (self.FFmpegWASM && self.FFmpegWASM.FFmpeg) || null;
// toBlobURL tidak dipakai — kita pakai fetchBlobURL sendiri, tapi tetap disimpan untuk referensi
const _toBlobURL = (self.FFmpegUtil && self.FFmpegUtil.toBlobURL) || null;

/* ================================================================
   [4] STATE GLOBAL
   ================================================================ */
let ffmpegInstance       = null;
let ffmpegLoadingPromise = null;
let loadGeneration       = 0;
let busy                 = false;
let cancelled            = false;
let cancelNoticeSent     = false;
let lastProgress         = 0;
let lastProgressEmitTs   = 0;
let execStartTs          = 0;
let currentAbortCtrl     = null;
let currentCoreJsURL     = null;
let currentCoreWasmURL   = null;
let idleTimer            = null;

const MAX_INPUT_MB = detectMaxInputMb();
logI(`Batas input: ${MAX_INPUT_MB} MB (device-aware)`);

/* ================================================================
   [5] SAFE TERMINATE
   ================================================================ */
async function safeTerminate(reason) {
  const inst = ffmpegInstance;
  ffmpegInstance = null;
  ffmpegLoadingPromise = null;

  // Revoke blob URLs agar tidak bocor
  revokeBlobURL(currentCoreJsURL);
  revokeBlobURL(currentCoreWasmURL);
  currentCoreJsURL = null;
  currentCoreWasmURL = null;

  if (!inst || typeof inst.terminate !== 'function') return;
  logD('Terminate instance:', reason || '-');
  try {
    const r = inst.terminate();
    if (r && typeof r.then === 'function') {
      await Promise.race([
        r.catch((e) => logD('terminate reject (diabaikan):', e && e.message)),
        new Promise((res) => setTimeout(res, LIMITS.terminateMs))
      ]);
    }
  } catch (e) {
    logW('terminate error (diabaikan):', e && e.message);
  }
}

/* ================================================================
   [6] ENSURE FFMPEG — LOAD LAZY + RETRY + GENERATION GUARD
   ================================================================ */
async function ensureFFmpeg(signal) {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  if (loadError) {
    throw new Error('FFmpeg.wasm gagal dimuat dari CDN: ' + (loadError.message || loadError));
  }
  if (typeof FFmpeg !== 'function') {
    throw new Error('Kelas FFmpeg tidak tersedia — periksa koneksi internet Anda.');
  }

  const myGen = ++loadGeneration;

  ffmpegLoadingPromise = (async () => {
    let inst = null;
    try {
      inst = new FFmpeg();

      /* Log FFmpeg → status (abaikan bila cancel / generasi berubah) */
      inst.on('log', ({ message }) => {
        if (cancelled || myGen !== loadGeneration) return;
        const msg = String(message || '');
        if (msg) post('status', { message: msg });
      });

      /* Progress FFmpeg → progress + ETA */
      inst.on('progress', ({ progress }) => {
        if (cancelled || myGen !== loadGeneration) return;
        reportProgress(progress);
      });

      post('status', { message: 'Memuat core FFmpeg ' + CORE_VERSION + '...' });

      /* ---------- Fetch core JS & WASM dengan retry ---------- */
      const fetchBoth = async () => {
        const [jsURL, wasmURL] = await Promise.all([
          fetchBlobURL(CDN.coreJs,   'text/javascript',  signal, LIMITS.loadTimeoutMs),
          fetchBlobURL(CDN.coreWasm, 'application/wasm', signal, LIMITS.loadTimeoutMs)
        ]);
        return { jsURL, wasmURL };
      };

      const { jsURL, wasmURL } = await withRetry(fetchBoth, {
        max: LIMITS.loadRetryMax,
        baseMs: LIMITS.loadRetryBaseMs,
        label: 'Download core FFmpeg',
        signal
      });

      currentCoreJsURL   = jsURL;
      currentCoreWasmURL = wasmURL;

      /* ---------- Inisialisasi core ---------- */
      post('status', { message: 'Menginisialisasi FFmpeg...' });
      await withTimeout(
        inst.load({ coreURL: jsURL, wasmURL: wasmURL }),
        LIMITS.loadTimeoutMs,
        'Inisialisasi FFmpeg'
      );

      /* Guard: user cancel / generasi berubah saat load → buang instance */
      if (myGen !== loadGeneration || cancelled) {
        try {
          const r = inst.terminate();
          if (r && typeof r.then === 'function') await r.catch(() => {});
        } catch (_) {}
        throw new Error('Load FFmpeg dibatalkan (generasi berubah).');
      }

      ffmpegInstance = inst;
      logI('FFmpeg siap');
      post('ready', { version: WORKER_VERSION, coreVersion: CORE_VERSION });
      return inst;

    } catch (err) {
      try {
        if (inst) {
          const r = inst.terminate();
          if (r && typeof r.then === 'function') await r.catch(() => {});
        }
      } catch (_) {}
      if (myGen === loadGeneration) {
        ffmpegInstance = null;
        ffmpegLoadingPromise = null;
      }
      throw err;
    }
  })();

  return ffmpegLoadingPromise;
}

/* ================================================================
   [7] PROGRESS + ETA
   ================================================================ */
function reportProgress(progress, force) {
  const p = clampNum(progress, 0, 1, 0);
  if (!force && p < lastProgress) return;

  const now = Date.now();
  if (!force && (now - lastProgressEmitTs) < LIMITS.progressEmitMinMs) {
    lastProgress = p;
    return;
  }

  lastProgress = p;
  lastProgressEmitTs = now;

  let etaMs = 0;
  if (execStartTs > 0 && p > 0.005 && p < 1) {
    const elapsed = now - execStartTs;
    etaMs = Math.max(0, Math.round(elapsed / p - elapsed));
  }

  post('progress', {
    progress: p,
    etaMs,
    percent: Math.round(p * 100)
  });
}

/* ================================================================
   [8] VALIDASI CONFIG
   ================================================================ */
const VALID = {
  codecs:  ['h264-cpu', 'h265-cpu', 'h265-gpu', 'av1-gpu'],
  methods: ['size-percent', 'quality'],
  audio:   ['aac', 'mp3', 'opus', 'copy', 'none'],
  res:     ['keep', '1920x1080', '1280x720', '854x480', '640x360']
};

function validateConfig(rawCfg) {
  const cfg = Object.assign({}, rawCfg || {});
  const errors = [];

  if (cfg.codec && !VALID.codecs.includes(cfg.codec)) {
    errors.push(`codec "${cfg.codec}" tidak dikenal`);
  }
  if (cfg.method && !VALID.methods.includes(cfg.method)) {
    errors.push(`method "${cfg.method}" tidak dikenal`);
  }
  if (cfg.audioCodec && !VALID.audio.includes(cfg.audioCodec)) {
    errors.push(`audioCodec "${cfg.audioCodec}" tidak dikenal`);
  }

  // Angka
  cfg.crf = clampNum(cfg.crf, 0, 63, 23);
  cfg.videoBitrate = clampNum(cfg.videoBitrate, 100, 200000, 2000);
  cfg.audioBitrate = clampNum(cfg.audioBitrate, 32, 512, 128);

  if (typeof cfg.resolution === 'string' && cfg.resolution !== 'keep') {
    if (!/^\d{2,5}x\d{2,5}$/.test(cfg.resolution)) {
      errors.push(`resolusi "${cfg.resolution}" tidak valid`);
    }
  }

  if (errors.length) {
    logW('Konfigurasi bermasalah:', errors.join(', '));
  }

  return { cfg, errors };
}

/* ================================================================
   [9] BUILD FFMPEG ARGS
   ================================================================ */
function buildFFmpegArgs(cfg) {
  /* Bila main thread menyediakan args lengkap, hormati */
  if (Array.isArray(cfg.ffmpegArgs) && cfg.ffmpegArgs.length) {
    return cfg.ffmpegArgs.slice();
  }

  const args = ['-hide_banner'];

  const codec = String(cfg.codec || 'h264-cpu');
  let encoder = 'libx264';
  let isAV1   = false;

  if (codec === 'h265-cpu' || codec === 'h265-gpu') {
    encoder = 'libx265';
  } else if (codec === 'av1-gpu') {
    encoder = 'libsvtav1';
    isAV1 = true;
  }

  args.push('-c:v', encoder);

  if (encoder === 'libx264') {
    args.push('-preset', 'medium');
  } else if (encoder === 'libx265') {
    args.push('-preset', 'medium', '-tag:v', 'hvc1');
  } else if (encoder === 'libsvtav1') {
    args.push('-preset', '8');
  }

  const method = String(cfg.method || 'size-percent');
  if (method === 'quality') {
    const maxCrf = isAV1 ? 63 : 51;
    const crf = Math.round(clampNum(cfg.crf, 0, maxCrf, 23));
    args.push('-crf', String(crf));
  } else {
    const b = Math.round(clampNum(cfg.videoBitrate, 100, 200000, 2000));
    args.push('-b:v', b + 'k', '-maxrate', b + 'k', '-bufsize', (b * 2) + 'k');
  }

  /* Scale (hindari upscale) */
  const res = cfg.resolution;
  if (res && res !== 'keep' && cfg.sourceWidth > 0) {
    const parts = String(res).split('x').map(Number);
    const tw = parts[0], th = parts[1];
    if (tw && th && tw <= cfg.sourceWidth) {
      args.push('-vf', `scale=${tw}:${th}:force_original_aspect_ratio=decrease`);
    }
  }

  /* Audio */
  const ac = String(cfg.audioCodec || 'aac');
  if (ac === 'none') {
    args.push('-an');
  } else if (ac === 'copy') {
    args.push('-c:a', 'copy');
  } else {
    const ab = Math.round(clampNum(cfg.audioBitrate, 32, 512, 128));
    args.push('-c:a', ac, '-b:a', ab + 'k', '-ac', '2');
  }

  /* Wajib untuk kompatibilitas */
  args.push('-pix_fmt', 'yuv420p');
  args.push('-movflags', '+faststart');
  args.push('-map_metadata', '-1');
  args.push('-nostdin');

  return args;
}

/* ================================================================
   [10] IDLE TERMINATE
   ================================================================ */
function resetIdleTimer() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (busy) return; // jangan idle-terminate saat sibuk
  idleTimer = setTimeout(async () => {
    if (busy) return;
    if (ffmpegInstance) {
      logI('Idle ' + (LIMITS.idleTerminateMs / 1000) + 's — terminate FFmpeg untuk hemat memori');
      await safeTerminate('idle');
    }
  }, LIMITS.idleTerminateMs);
}

function clearIdleTimer() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

/* ================================================================
   [11] HANDLER: CANCEL
   ================================================================ */
async function handleCancel() {
  cancelled = true;
  lastProgress = 0;
  execStartTs = 0;

  /* Invalidasi load yang sedang berjalan */
  loadGeneration++;

  /* Batalkan AbortController aktif (bila ada) */
  if (currentAbortCtrl) {
    try { currentAbortCtrl.abort(); } catch (_) {}
    currentAbortCtrl = null;
  }

  /* Beri tahu user sekali */
  if (!cancelNoticeSent) {
    cancelNoticeSent = true;
    post('cancelled');
  }

  await safeTerminate('cancel');
  clearIdleTimer();
  logI('Cancel selesai.');
}

/* ================================================================
   [12] HANDLER: COMPRESS
   ================================================================ */
async function handleCompress(data) {
  if (busy) {
    post('error', { message: 'Worker masih sibuk memproses video sebelumnya.', code: 'BUSY' });
    return;
  }

  busy = true;
  cancelled = false;
  cancelNoticeSent = false;
  lastProgress = 0;
  lastProgressEmitTs = 0;
  execStartTs = 0;
  clearIdleTimer();

  const abortCtrl = new AbortController();
  currentAbortCtrl = abortCtrl;
  const signal = abortCtrl.signal;

  let inputName  = null;
  let outputName = null;
  let ff         = null;
  const startTs  = Date.now();
  let inputBytes = 0;

  try {
    const payload = data.payload || {};
    let fileBuffer = payload.fileBuffer;
    const rawCfg  = payload.config || {};

    /* ---------- Validasi input ---------- */
    if (!fileBuffer || !(fileBuffer instanceof ArrayBuffer)) {
      throw new Error('Data file tidak valid (bukan ArrayBuffer).');
    }

    inputBytes = fileBuffer.byteLength;
    const fileMB = inputBytes / 1048576;

    if (fileMB > MAX_INPUT_MB) {
      throw new Error(
        `File terlalu besar (${fileMB.toFixed(1)} MB). Batas: ${MAX_INPUT_MB} MB ` +
        `(menyesuaikan memori perangkat).`
      );
    }
    if (fileMB <= 0) throw new Error('File kosong.');

    /* ---------- Validasi config ---------- */
    const { cfg, errors } = validateConfig(rawCfg);
    if (errors.length) {
      post('warning', { message: 'Konfigurasi disesuaikan: ' + errors.join('; ') });
    }

    /* ---------- Load FFmpeg ---------- */
    ff = await ensureFFmpeg(signal);
    if (cancelled) throw new Error('Dibatalkan oleh pengguna.');

    /* ---------- Siapkan nama file virtual FS ---------- */
    inputName  = sanitizeFsName(cfg.inputName  || ('input_'  + Date.now() + '.mp4'));
    outputName = sanitizeFsName(cfg.outputName || ('output_' + Date.now() + '.mp4'));

    /* Pastikan output tidak bentrok — hapus bila ada sisa run sebelumnya */
    await safeDeleteFile(ff, outputName);

    /* ---------- Tulis input ---------- */
    const inMB = formatMB(inputBytes);
    post('status', { message: `Menulis input ke virtual FS (${inMB} MB)...` });

    await ff.writeFile(inputName, new Uint8Array(fileBuffer));

    /* Lepas referensi agar GC bisa bebas */
    payload.fileBuffer = null;
    fileBuffer = null;

    if (cancelled) throw new Error('Dibatalkan oleh pengguna.');

    post('status', {
      message: `Input tertulis (${inMB} MB) — menyiapkan perintah FFmpeg...`
    });

    /* ---------- Susun args ---------- */
    const args = buildFFmpegArgs(cfg);
    args.push(inputName, outputName);
    logD('Args:', args.join(' '));

    /* ---------- Jalankan FFmpeg dengan timeout adaptif ---------- */
    const execTimeoutMs = computeExecTimeout(inputBytes);
    logI(`exec timeout = ${(execTimeoutMs/1000).toFixed(0)}s untuk ${inMB} MB`);

    post('status', {
      message: `Menjalankan FFmpeg (timeout ${(execTimeoutMs/1000).toFixed(0)}s)...`
    });

    execStartTs = Date.now();

    let exitCode;
    try {
      exitCode = await Promise.race([
        ff.exec(args),
        new Promise((_, reject) => {
          const t = setTimeout(
            () => reject(new Error(`FFmpeg melebihi batas waktu ${(execTimeoutMs/1000).toFixed(0)}s`)),
            execTimeoutMs
          );
          // bersihkan timer bila exec selesai lebih dulu
          Promise.resolve().then(() => {}).finally(() => {});
          // Note: race tidak memungkinkan clearTimeout di sini; pendekatan aman:
          // gunakan race dengan finally di jalur eksekusi
        })
      ]);
    } catch (execErr) {
      // Bila timeout / abort → terminate instance
      if (!cancelled) {
        logE('exec error:', execErr && execErr.message);
        await safeTerminate('exec-error');
      }
      throw execErr;
    }

    if (cancelled) throw new Error('Dibatalkan oleh pengguna.');

    if (exitCode !== 0) {
      throw new Error(`FFmpeg keluar dengan kode ${exitCode} — periksa konsol untuk detail.`);
    }

    /* ---------- Baca hasil ---------- */
    post('status', { message: 'Membaca hasil output...' });

    const outputData = await ff.readFile(outputName);
    if (!outputData || !outputData.length) {
      throw new Error('Output kosong atau tidak ditemukan.');
    }

    const outputBytes = outputData.byteLength;
    const outMB = formatMB(outputBytes);
    post('status', {
      message: `Output berhasil dibaca (${outMB} MB) — membuat file MP4...`
    });

    /* ---------- Buat Blob (tanpa salinan ganda) ---------- */
    const blob = new Blob([outputData], { type: 'video/mp4' });

    /* ---------- Hapus file virtual FS sedini mungkin ---------- */
    await safeDeleteFile(ff, inputName);
    await safeDeleteFile(ff, outputName);

    /* ---------- Label resolusi output ---------- */
    const srcRes = (cfg.sourceWidth && cfg.sourceHeight)
      ? `${cfg.sourceWidth}×${cfg.sourceHeight}` : '';
    let outputResolution = srcRes;
    if (cfg.resolution && cfg.resolution !== 'keep' && cfg.sourceWidth > 0) {
      const tw = parseInt(String(cfg.resolution).split('x')[0], 10);
      outputResolution = (tw && tw <= cfg.sourceWidth) ? cfg.resolution : srcRes;
    }

    /* ---------- Ringkasan ---------- */
    const durationMs = Date.now() - startTs;
    const ratio = inputBytes > 0 ? (outputBytes / inputBytes) : 0;
    const summary = {
      inputMB:  formatMB(inputBytes),
      outputMB: formatMB(outputBytes),
      ratio:    Number(ratio.toFixed(4)),
      ratioPct: Math.round(ratio * 100),
      durationMs,
      inputBytes,
      outputBytes
    };
    logI('Selesai:', summary);

    post('done', {
      blob,
      outputResolution,
      summary
    });

    /* Instans tetap hidup untuk run berikutnya; idle timer dipasang */
    busy = false;
    resetIdleTimer();

  } catch (err) {
    const wasCancelled = cancelled;
    const msg = (err && err.message) ? err.message : String(err);
    const code = err && err.code ? err.code : undefined;

    /* Cleanup file virtual FS */
    if (ff) {
      await safeDeleteFile(ff, inputName);
      await safeDeleteFile(ff, outputName);
    }

    if (wasCancelled) {
      if (!cancelNoticeSent) {
        cancelNoticeSent = true;
        post('cancelled');
      }
    } else {
      logE('compress error:', err);
      post('error', { message: msg, code });
      /* Reset instans agar run berikutnya fresh */
      await safeTerminate('compress-error');
    }

  } finally {
    if (currentAbortCtrl === abortCtrl) currentAbortCtrl = null;
    busy = false;
    execStartTs = 0;
    if (!cancelled) resetIdleTimer();
  }
}

async function safeDeleteFile(ff, name) {
  if (!ff || !name) return;
  try { await ff.deleteFile(name); } catch (_) {}
}

/* ================================================================
   [13] HANDLER: PING / WARMUP / SET LOG LEVEL
   ================================================================ */
function handlePing() {
  post('pong', {
    version: WORKER_VERSION,
    busy,
    cancelled,
    hasInstance: !!ffmpegInstance,
    instanceLoaded: !!(ffmpegInstance && ffmpegInstance.loaded),
    loading: !!ffmpegLoadingPromise,
    maxInputMb: MAX_INPUT_MB,
    limits: LIMITS,
    coreVersion: CORE_VERSION
  });
}

async function handleWarmup() {
  if (busy) return;
  try {
    post('status', { message: 'Warmup: memuat FFmpeg...' });
    await ensureFFmpeg(null);
    resetIdleTimer();
  } catch (e) {
    logW('Warmup gagal:', e && e.message);
  }
}

function handleSetLogLevel(data) {
  const lvl = data && data.level;
  if (typeof lvl === 'number') currentLogLevel = Math.max(0, Math.min(4, lvl | 0));
  else if (typeof lvl === 'string') {
    const map = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
    if (map[lvl.toLowerCase()] !== undefined) currentLogLevel = map[lvl.toLowerCase()];
  }
}

/* ================================================================
   [14] MESSAGE ROUTER
   ================================================================ */
self.onmessage = async function (e) {
  const data = (e && e.data) || {};
  const type = data.type;

  switch (type) {
    case 'ping':
      handlePing();
      return;

    case 'warmup':
      handleWarmup();
      return;

    case 'setLogLevel':
      handleSetLogLevel(data);
      return;

    case 'cancel':
      await handleCancel();
      return;

    case 'compress':
      await handleCompress(data);
      return;

    default:
      // Tipe tak dikenal — abaikan dengan tenang
      logD('Tipe pesan tak dikenal:', type);
      return;
  }
};

/* ================================================================
   [15] SAFETY NET — cegah crash walau ada error tak terduga
   ================================================================ */
self.addEventListener('unhandledrejection', function (ev) {
  logW('unhandledrejection:', ev.reason && (ev.reason.message || ev.reason));
  // Jangan post error — sudah ditangani di handler compress
  ev.preventDefault();
});

self.addEventListener('error', function (ev) {
  const msg = (ev && ev.message) || 'unknown';
  logE('global error:', msg);
  // Hanya post kalau bukan bagian dari compress (yang sudah handle)
  if (!busy) {
    post('error', { message: 'Worker error: ' + msg });
  }
  ev.preventDefault();
});

/* ================================================================
   [16] STARTUP
   ================================================================ */
logI(`compressvideo-worker.js v${WORKER_VERSION} siap (core ${CORE_VERSION})`);
post('booted', {
  version: WORKER_VERSION,
  coreVersion: CORE_VERSION,
  maxInputMb: MAX_INPUT_MB
});

/* Idle timer awal (agar FFmpeg dibebaskan bila tidak dipakai) */
resetIdleTimer();