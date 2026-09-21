/* ================================================================
   IRGXYMODS — COMPRESS VIDEO CLIENT
   File    : compressvideo.js
   Version : 6.6.0 — STABLE / BUG-FREE / MOBILE FRIENDLY
   ================================================================ */

(function () {
'use strict';

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const rawToast = (typeof window.showToast === 'function') ? window.showToast : null;

const APP_VERSION = '6.6.0';
const WORKER_VERSION_EXPECTED = '6.6.0';
const HISTORY_KEY        = 'irgxy_cv_history_v66';
const LEGACY_HISTORY_KEY = 'irgxy_cv_history_v65';
const CUSTOM_PRESETS_KEY = 'irgxy_cv_presets_v66';
const MAX_HISTORY        = 50;
const HISTORY_TTL        = 30 * 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE      = 1024 * 1024 * 1024;
const WARN_FILE_SIZE     = 500 * 1024 * 1024;
const PING_INTERVAL_MS   = 8000;
const READY_WAIT_MS      = 90000;
const ESTIMATE_DEBOUNCE  = 150;
const PROGRESS_THROTTLE  = 100;

const OUT_FORMATS = Object.freeze({
  mp4:       { ext: 'mp4', mime: 'video/mp4',        label: 'MP4 (H.264/H.265)' },
  webm:      { ext: 'webm', mime: 'video/webm',      label: 'WebM (VP9)' },
  mkv:       { ext: 'mkv', mime: 'video/x-matroska', label: 'MKV' },
  gif:       { ext: 'gif', mime: 'image/gif',        label: 'GIF (animasi)' },
  mp3:       { ext: 'mp3', mime: 'audio/mpeg',       label: 'MP3 (audio only)' },
  m4a:       { ext: 'm4a', mime: 'audio/mp4',        label: 'M4A (audio only)' },
  thumbnail: { ext: 'jpg', mime: 'image/jpeg',       label: 'Thumbnail JPG' }
});

const STATE = Object.freeze({
  IDLE: 'IDLE', FILE_LOADED: 'FILE_LOADED', PROCESSING: 'PROCESSING',
  DONE: 'DONE', ERROR: 'ERROR'
});

const state = {
  mode: STATE.IDLE,
  file: null, metadata: null, previewUrl: null,
  resultBlob: null, resultUrl: null,
  lastConfig: null, lastInputBytes: 0, lastEstimateBytes: 0,
  worker: null, workerReady: false, workerBooted: false,
  workerPingTimer: null, lastPongAt: 0, readyWaiters: [],
  processing: false, cancelRequested: false,
  startTime: 0, lastProgress: 0, lastProgressTime: 0,
  emaSpeed: 0, progressHistory: [], rafPending: false,
  logsOpen: false, helpOpen: false,
  batch: [], batchProcessing: false,
  customPresets: []
};
const refs = {};

const clamp   = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const safeNum = (v, fb) => { const n = Number(v); return isFinite(n) ? n : (fb || 0); };

function formatBytes(b, d) {
  d = (d == null) ? 2 : d;
  if (!b || b <= 0 || !isFinite(b)) return '0 B';
  const k = 1024, u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), u.length - 1);
  return (b / Math.pow(k, i)).toFixed(d) + ' ' + u[i];
}
function formatDuration(sec) {
  sec = safeNum(sec, 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return m + ':' + String(s).padStart(2, '0');
}
function formatEta(sec) {
  if (!isFinite(sec) || sec < 0 || sec > 86400) return '--:--';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function timestampName(base, ext) {
  ext = ext || 'mp4';
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' +
                p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  const clean = String(base || 'video').replace(/\.[^/.]+$/, '').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'video';
  return clean + '_compressed_' + stamp + '.' + ext;
}
function debounce(fn, ms) {
  let t = null;
  return function () {
    const a = arguments, c = this;
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn.apply(c, a); }, ms);
  };
}
function setText(sel, v) { const e = typeof sel === 'string' ? $(sel) : sel; if (e) e.textContent = v; }
function show(sel, mode)  { const e = typeof sel === 'string' ? $(sel) : sel; if (e) e.style.display = mode || 'block'; }
function hide(sel)        { const e = typeof sel === 'string' ? $(sel) : sel; if (e) e.style.display = 'none'; }
function revokeUrl(u)     { if (u) { try { URL.revokeObjectURL(u); } catch (_) {} } }

const TOAST_TYPES = {
  info:    { color: '#4facfe', icon: 'fa-info-circle' },
  success: { color: '#43e97b', icon: 'fa-check-circle' },
  warning: { color: '#ffc107', icon: 'fa-exclamation-triangle' },
  error:   { color: '#ff416c', icon: 'fa-times-circle' }
};
function toast(msg, type, duration) {
  type = type || 'info'; duration = duration || 4000;
  if (rawToast) { try { rawToast(msg, type); return; } catch (_) {} }
  const c = refs.toastContainer || (refs.toastContainer = $('#toastContainer'));
  if (!c) return;
  const t = TOAST_TYPES[type] || TOAST_TYPES.info;
  const el = document.createElement('div');
  el.className = 'cv-toast cv-toast-' + type;
  el.style.cssText = 'display:flex;align-items:center;gap:10px;border-left:3px solid ' + t.color + ';';
  el.innerHTML = '<i class="fas ' + t.icon + '" style="color:' + t.color + ';flex-shrink:0;"></i>' +
    '<span style="flex:1;min-width:0;">' + escapeHtml(msg) + '</span>' +
    '<button type="button" style="background:transparent;border:none;color:inherit;cursor:pointer;opacity:.6;padding:2px 4px;" aria-label="Tutup">×</button>';
  const close = () => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0'; el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('button').addEventListener('click', close);
  c.appendChild(el);
  setTimeout(close, duration);
}

function appendLog(kind, msg) {
  const body = refs.logBody || (refs.logBody = $('#logBody'));
  if (!body) return;
  const ts = new Date().toLocaleTimeString('id-ID');
  const line = document.createElement('div');
  line.className = 'cv-log-line cv-log-' + (kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : 'info');
  line.innerHTML = '<span class="cv-log-ts">' + ts + '</span><span class="cv-log-msg">' + escapeHtml(msg) + '</span>';
  body.appendChild(line);
  while (body.children.length > 500) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
}
function toggleLogs(force) {
  state.logsOpen = (typeof force === 'boolean') ? force : !state.logsOpen;
  const p = refs.logPanel || (refs.logPanel = $('#logPanel'));
  if (p) p.style.display = state.logsOpen ? 'flex' : 'none';
}

function mapFFmpegError(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('coop_coep') || m.includes('sharedarraybuffer')) return 'Server tidak mengaktifkan COOP/COEP.';
  if (m.includes('memory') || m.includes('oom'))   return 'Memori tidak cukup. Turunkan resolusi atau gunakan file lebih kecil.';
  if (m.includes('exit code')) return 'File input rusak atau codec tidak didukung FFmpeg.';
  if (m.includes('timeout'))   return 'Proses timeout — file terlalu besar untuk perangkat ini.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('http ') || m.includes('gagal dimuat')) {
    return 'Gagal mengunduh FFmpeg. Browser Anda (mungkin in-app browser) memblokir koneksi ke CDN. Silakan buka halaman ini di Chrome atau Safari.';
  }
  return msg || 'Terjadi kesalahan tidak diketahui.';
}

function revokePreview() {
  revokeUrl(state.previewUrl); state.previewUrl = null;
  const v = refs.videoPreview || (refs.videoPreview = $('#videoPreview'));
  if (v) { try { v.pause(); } catch (_) {} v.removeAttribute('src'); try { v.load(); } catch (_) {} }
}
function revokeResult() {
  revokeUrl(state.resultUrl); state.resultUrl = null; state.resultBlob = null;
  const v = refs.resultVideo || (refs.resultVideo = $('#resultVideo'));
  if (v) { try { v.pause(); } catch (_) {} v.removeAttribute('src'); try { v.load(); } catch (_) {} }
}

function loadVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (err, data) => {
      if (done) return; done = true;
      clearTimeout(timer);
      revokeUrl(url); v.removeAttribute('src'); try { v.load(); } catch (_) {}
      err ? reject(err) : resolve(data);
    };
    const timer = setTimeout(() => finish(new Error('Timeout membaca metadata')), 15000);
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

const getCodec        = () => ($('input[name="codec"]:checked') || {}).value || 'h264-cpu';
const getMethod       = () => ($('input[name="method"]:checked') || {}).value || 'size-percent';
const getResolution   = () => ($('input[name="resolution"]:checked') || {}).value || 'keep';
const getAudioCodec   = () => (refs.audioCodec || (refs.audioCodec = $('#audioCodec')) || {}).value || 'aac';
const getAudioBitrate = () => parseInt((refs.audioBitrate || (refs.audioBitrate = $('#audioBitrate')) || {}).value, 10) || 128;
const getOutputFormat = () => (refs.outputFormat || (refs.outputFormat = $('#outputFormat')) || {}).value || 'mp4';

function audioBitrateKbps() {
  const c = getAudioCodec();
  if (c === 'copy' || c === 'none') return 0;
  return getAudioBitrate();
}
function effectiveDuration() {
  const dur = (state.metadata && state.metadata.duration) || 0;
  if (dur <= 0) return 0;
  const s = clamp(safeNum((refs.trimStart || {}).value, 0), 0, dur);
  const e = clamp(safeNum((refs.trimEnd   || {}).value, dur), 0, dur);
  if (e > s && e > 0) return e - s;
  return dur;
}

function calcVideoBitrate() {
  const method = getMethod();
  const srcKbps = (state.metadata && state.metadata.bitrate) || 2000;
  const duration = effectiveDuration() || 1;
  const audio = audioBitrateKbps();
  if (method === 'size-percent') {
    const pct = clamp(safeNum((refs.slider || {}).value, 50) / 100, 0.05, 0.95);
    return Math.max(100, Math.round(srcKbps * pct - audio));
  }
  if (method === 'size-mb') {
    const mb = Math.max(1, safeNum((refs.numberInput || {}).value, 1));
    return Math.max(100, Math.round((mb * 8192) / duration - audio));
  }
  const crf = safeNum((refs.slider || {}).value, 23);
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
  const dur = effectiveDuration() || 0;
  if (dur <= 0) return 0;
  const factor = getCodec() === 'h265-cpu' ? 3.5 : 1.5;
  return Math.round(dur * factor);
}
function updateEstimate() {
  if (!state.file) return;
  const fmt = getOutputFormat();
  if (fmt === 'gif' || fmt === 'mp3' || fmt === 'm4a' || fmt === 'thumbnail') {
    const dur = effectiveDuration() || 1;
    let est = 0;
    if (fmt === 'gif') est = dur * 12 * 300 * 1024 / 8;
    else if (fmt === 'mp3' || fmt === 'm4a') est = (audioBitrateKbps() || 128) * dur * 1000 / 8;
    else est = 80 * 1024;
    setText('#estSize', formatBytes(est));
    setText('#estVideoBitrate', '—');
    setText('#estAudioBitrate', fmt === 'gif' || fmt === 'thumbnail' ? '—' : (audioBitrateKbps() + ' kbps'));
    setText('#estRatio', '—');
    setText('#estQuality', fmt === 'gif' ? 'GIF 12fps' : fmt === 'thumbnail' ? 'JPG' : 'Audio');
    setText('#estTime', '± ' + formatDuration(estimateTime()));
    const warn = $('#estOutputWarning'); if (warn) warn.style.display = 'none';
    return;
  }
  const audio = audioBitrateKbps();
  const videoKbps = calcVideoBitrate();
  const dur = effectiveDuration() || (state.metadata && state.metadata.duration) || 1;
  const estBytes = ((videoKbps + audio) * dur * 1000) / 8;
  const srcSize = state.file.size || 1;
  const ratioPct = clamp(Math.round((1 - estBytes / srcSize) * 100), -999, 100);
  let q;
  if (getMethod() === 'quality') q = qualityLabel(safeNum((refs.slider || {}).value, 23));
  else {
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
  state.lastEstimateBytes = estBytes;
  const warn = $('#estOutputWarning');
  if (warn) warn.style.display = (estBytes >= srcSize * 0.98) ? 'flex' : 'none';
}
const updateEstimateDebounced = debounce(updateEstimate, ESTIMATE_DEBOUNCE);

function updateDynamicInput() {
  const method = getMethod(), codec = getCodec();
  const sliderWrap = refs.sliderWrap || (refs.sliderWrap = $('#sliderWrap'));
  const numberWrap = refs.numberWrap || (refs.numberWrap = $('#numberWrap'));
  const label      = refs.dynamicLabel || (refs.dynamicLabel = $('#dynamicLabel'));
  if (sliderWrap) sliderWrap.style.display = 'none';
  if (numberWrap) numberWrap.style.display = 'none';
  if (method === 'size-percent') {
    if (label) label.innerHTML = '<i class="fas fa-percent"></i> Target Ukuran (%)';
    if (sliderWrap) sliderWrap.style.display = 'flex';
    const s = refs.slider || (refs.slider = $('#slider'));
    if (s) { s.min = 5; s.max = 95; if (!s.dataset.touched) s.value = 50; }
    setText('#sliderValue', (s && s.value) || '50'); setText('#sliderUnit', '%');
  } else if (method === 'size-mb') {
    if (label) label.innerHTML = '<i class="fas fa-database"></i> Target Ukuran (MB)';
    if (numberWrap) numberWrap.style.display = 'flex';
    const srcMB = state.file ? Math.max(1, Math.floor(state.file.size / 1048576)) : 2048;
    const n = refs.numberInput || (refs.numberInput = $('#numberInput'));
    if (n) { n.min = 1; n.max = srcMB; if (!n.dataset.touched) n.value = Math.max(1, Math.round(srcMB * 0.5)); }
    setText('#numberUnit', 'MB');
  } else {
    const defCrf = codec === 'h265-cpu' ? 28 : 23;
    if (label) label.innerHTML = '<i class="fas fa-star"></i> Kualitas (CRF 0–51)';
    if (sliderWrap) sliderWrap.style.display = 'flex';
    const s = refs.slider || (refs.slider = $('#slider'));
    if (s) { s.min = 0; s.max = 51; if (!s.dataset.touched) s.value = defCrf; }
    setText('#sliderValue', (s && s.value) || String(defCrf));
    setText('#sliderUnit', 'CRF');
  }
  updateEstimate();
}

function buildFFmpegArgs() {
  const format = getOutputFormat();
  if (format === 'gif')       return buildGifArgs();
  if (format === 'mp3' || format === 'm4a') return buildAudioOnlyArgs(format);
  if (format === 'thumbnail') return buildThumbnailArgs();
  return buildVideoArgs(format);
}
function trimOpts(args) {
  const dur = (state.metadata && state.metadata.duration) || 0;
  const tStart = clamp(safeNum((refs.trimStart || {}).value, 0), 0, dur);
  const tEnd   = clamp(safeNum((refs.trimEnd   || {}).value, dur), 0, dur);
  const hasTrimStart = tStart > 0.01;
  const hasTrimEnd   = tEnd > 0 && tEnd < dur - 0.01 && tEnd > tStart;
  if (hasTrimStart) args.push('-ss', tStart.toFixed(3));
  args.push('-i', '__INPUT__');
  if (hasTrimEnd) args.push('-t', (tEnd - tStart).toFixed(3));
  return args;
}
function buildVideoArgs(container) {
  const codec = getCodec();
  const method = getMethod();
  const encoder = codec === 'h265-cpu' ? 'libx265' : 'libx264';
  const args = ['-hide_banner'];
  trimOpts(args);

  if (container === 'webm') {
    args.push('-c:v', 'libvpx-vp9');
    if (method === 'quality') { args.push('-crf', String(clamp(safeNum((refs.slider || {}).value, 30), 0, 63))); args.push('-b:v', '0'); }
    else { args.push('-b:v', calcVideoBitrate() + 'k'); }
    args.push('-row-mt', '1');
  } else {
    args.push('-c:v', encoder, '-preset', 'medium');
    if (encoder === 'libx265') args.push('-tag:v', 'hvc1');
    if (method === 'quality') args.push('-crf', String(clamp(safeNum((refs.slider || {}).value, 23), 0, 51)));
    else {
      const kbps = calcVideoBitrate();
      args.push('-b:v', kbps + 'k', '-maxrate', kbps + 'k', '-bufsize', (kbps * 2) + 'k');
    }
  }

  const filters = [];
  const res = getResolution();
  if (res && res !== 'keep' && state.metadata.width > 0) {
    const parts = res.split('x').map(Number);
    if (parts[0] && parts[1]) {
      if (parts[0] > state.metadata.width) filters.push('scale=' + state.metadata.width + ':' + state.metadata.height);
      else filters.push('scale=' + parts[0] + ':' + parts[1] + ':force_original_aspect_ratio=decrease');
    }
  }
  const rot = safeNum((refs.advRotate || {}).value, 0);
  if (rot === 90)       filters.push('transpose=1');
  else if (rot === 180) filters.push('transpose=2,transpose=2');
  else if (rot === 270) filters.push('transpose=2');
  const flip = (refs.advFlip || {}).value || 'none';
  if (flip === 'h') filters.push('hflip');
  if (flip === 'v') filters.push('vflip');
  const b = safeNum((refs.fBrightness || {}).value, 0);
  const c = safeNum((refs.fContrast   || {}).value, 1);
  const s = safeNum((refs.fSaturation || {}).value, 1);
  if (b !== 0 || c !== 1 || s !== 1) filters.push('eq=brightness=' + b.toFixed(3) + ':contrast=' + c.toFixed(3) + ':saturation=' + s.toFixed(3));

  const wmText = ((refs.wmText || {}).value || '').trim();
  if (wmText) {
    const size = clamp(safeNum((refs.wmSize || {}).value, 24), 10, 200);
    const hex  = ((refs.wmColor || {}).value || '#ffffff').replace('#', '0x');
    const op   = clamp(safeNum((refs.wmOpacity || {}).value, 0.8), 0.1, 1);
    const color = hex + '@' + op.toFixed(2);
    const posMap = { tl: ['10','10'], tr: ['w-tw-10','10'], bl: ['10','h-th-10'], br: ['w-tw-10','h-th-10'], tc: ['(w-tw)/2','10'], bc: ['(w-tw)/2','h-th-10'] };
    const pos = posMap[(refs.wmPos || {}).value || 'br'];
    const box = (refs.wmBg && refs.wmBg.checked) ? ':box=1:boxcolor=black@0.5:boxborderw=8' : '';
    const escaped = wmText.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
    filters.push("drawtext=text='" + escaped + "':x=" + pos[0] + ':y=' + pos[1] + ':fontsize=' + size + ':fontcolor=' + color + box);
  }
  if (filters.length) args.push('-vf', filters.join(','));

  const ac = getAudioCodec();
  if (container === 'webm') {
    if (ac === 'none') args.push('-an');
    else args.push('-c:a', 'libopus', '-b:a', getAudioBitrate() + 'k', '-ac', '2');
  } else if (container === 'mkv') {
    if (ac === 'none') args.push('-an');
    else if (ac === 'copy') args.push('-c:a', 'copy');
    else args.push('-c:a', ac === 'libopus' ? 'libopus' : ac, '-b:a', getAudioBitrate() + 'k', '-ac', '2');
  } else {
    if (ac === 'none') args.push('-an');
    else if (ac === 'copy') {
      const mime = (state.file && state.file.type || '').toLowerCase();
      if (/webm|matroska/.test(mime)) args.push('-c:a', 'aac', '-b:a', getAudioBitrate() + 'k', '-ac', '2');
      else args.push('-c:a', 'copy');
    } else args.push('-c:a', ac, '-b:a', getAudioBitrate() + 'k', '-ac', '2');
  }
  if (container !== 'webm') args.push('-pix_fmt', 'yuv420p');
  if (container === 'mp4')  args.push('-movflags', '+faststart');
  args.push('-map_metadata', '-1');
  args.push('__OUTPUT__');
  return args;
}
function buildGifArgs() {
  const args = ['-hide_banner'];
  trimOpts(args);
  args.push('-vf', 'fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse');
  args.push('-loop', '0', '__OUTPUT__');
  return args;
}
function buildAudioOnlyArgs(format) {
  const args = ['-hide_banner'];
  trimOpts(args);
  args.push('-vn');
  if (format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', getAudioBitrate() + 'k', '-ac', '2');
  else args.push('-c:a', 'aac', '-b:a', getAudioBitrate() + 'k', '-ac', '2');
  args.push('__OUTPUT__');
  return args;
}
function buildThumbnailArgs() {
  const atSec = clamp(safeNum((refs.thumbAt || {}).value, 1), 0, (state.metadata && state.metadata.duration) || 1);
  return ['-hide_banner', '-ss', atSec.toFixed(3), '-i', '__INPUT__', '-frames:v', '1', '-q:v', '3', '__OUTPUT__'];
}

function destroyWorker() {
  if (state.workerPingTimer) { clearInterval(state.workerPingTimer); state.workerPingTimer = null; }
  if (state.worker) { try { state.worker.terminate(); } catch (_) {} state.worker = null; }
  state.workerReady = false; state.workerBooted = false;
  setWorkerStatus('Worker dihentikan.', 'idle');
}
function setWorkerStatus(text, mode, version) {
  const el  = refs.workerStatus     || (refs.workerStatus = $('#workerStatus'));
  const txt = refs.workerStatusText || (refs.workerStatusText = $('#workerStatusText'));
  const tag = refs.workerVersionTag || (refs.workerVersionTag = $('#workerVersionTag'));
  if (txt) txt.textContent = text;
  if (tag && version) tag.textContent = 'v' + version;
  if (el) {
    el.classList.remove('is-ready', 'is-error');
    if (mode === 'ready') el.classList.add('is-ready');
    else if (mode === 'error') el.classList.add('is-error');
    const i = el.querySelector('i');
    if (i) i.className = (mode === 'ready') ? 'fas fa-check-circle'
                    : (mode === 'error') ? 'fas fa-exclamation-circle'
                    : 'fas fa-circle-notch fa-spin';
  }
}
function ensureWorker() {
  if (state.worker) return state.worker;
  try {
    const w = new Worker('compressvideo-worker.js', { type: 'module' });
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
    if (!state.worker || state.processing) return;
    try { state.worker.postMessage({ type: 'ping' }); } catch (_) {}
  }, PING_INTERVAL_MS);
}
function waitForReady() {
  if (state.workerReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      state.readyWaiters = state.readyWaiters.filter(w => w.resolve !== resolve);
      reject(new Error('FFmpeg belum siap setelah ' + (READY_WAIT_MS / 1000) + 's'));
    }, READY_WAIT_MS);
    state.readyWaiters.push({ resolve, reject, timer: t });
  });
}
function flushReadyWaiters(err) {
  const list = state.readyWaiters.slice();
  state.readyWaiters = [];
  list.forEach(w => { clearTimeout(w.timer); if (err) w.reject(err); else w.resolve(); });
}
function onWorkerMessage(e) {
  try {
    const d = (e && e.data) || {};
    switch (d.type) {
      case 'booted':
        state.workerBooted = true;
        setWorkerStatus('Worker siap, memuat FFmpeg...', 'idle', d.version);
        appendLog('info', 'Worker booted (v' + d.version + ', core ' + d.coreVersion + ')');
        if (d.version && d.version !== WORKER_VERSION_EXPECTED) {
          appendLog('warn', 'Versi worker ' + d.version + ' ≠ client ' + WORKER_VERSION_EXPECTED);
        }
        try { state.worker.postMessage({ type: 'preload' }); } catch (_) {}
        break;
      case 'ready':
        state.workerReady = true;
        setWorkerStatus('FFmpeg siap (' + (d.cdn || 'CDN') + ').', 'ready', d.version);
        appendLog('info', 'FFmpeg ready via ' + (d.cdn || 'CDN'));
        flushReadyWaiters(null);
        refreshStartButton();
        break;
      case 'status':
        appendLog('info', d.message || '');
        if (d.stage && d.message) setWorkerStatus(d.message, 'idle');
        break;
      case 'progress': updateProgress(d.progress || 0, d.etaMs || 0); break;
      case 'done': handleWorkerDone(d); break;
      case 'error':
        if (d.code === 'PRELOAD_FAIL') {
          setWorkerStatus('Gagal memuat FFmpeg.', 'error');
          appendLog('error', 'Preload gagal: ' + d.message);
          flushReadyWaiters(new Error(d.message));
        } else handleWorkerError(d.message || 'unknown');
        break;
      case 'cancelled': handleWorkerCancelled(); break;
      case 'pong': state.lastPongAt = Date.now(); break;
    }
  } catch (err) {
    console.error('[onWorkerMessage]', err);
    appendLog('error', 'Handler exception: ' + err.message);
  }
}

function setState(newMode) { state.mode = newMode; refreshStartButton(); }
function refreshStartButton() {
  const btn = refs.btnStart || (refs.btnStart = $('#btnStart'));
  if (!btn) return;
  const canStart = !!state.file && !state.processing && state.workerReady;
  btn.disabled = !canStart;
  if (state.processing) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sedang Memproses...';
  else if (!state.file) btn.innerHTML = '<i class="fas fa-play"></i> MULAI COMPRESS';
  else if (!state.workerReady) btn.innerHTML = '<i class="fas fa-hourglass-half"></i> Menyiapkan FFmpeg...';
  else btn.innerHTML = '<i class="fas fa-play"></i> MULAI COMPRESS';
}

function isVideoFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('video/')) return true;
  return /\.(mp4|mov|mkv|webm|avi|m4v|3gp|flv|wmv|mpeg|mpg|ts|ogv)$/i.test(file.name);
}
async function handleFile(file) {
  if (!file) return;
  if (state.processing) { toast('Tunggu proses sebelumnya selesai.', 'warning'); return; }
  if (!isVideoFile(file)) { toast('File bukan video yang didukung.', 'error'); return; }
  if (file.size > MAX_FILE_SIZE) { toast('File terlalu besar. Maks ' + formatBytes(MAX_FILE_SIZE) + '.', 'error'); return; }

  revokePreview(); revokeResult(); resetProgressUI();
  hide('#resultCard'); hide('#progressWrap'); hide('#splitViewCard');

  toast('Memuat metadata...', 'info');
  try {
    const meta = await loadVideoMetadata(file);
    state.file = file;
    state.metadata = { duration: meta.duration, width: meta.width, height: meta.height,
      bitrate: Math.round((file.size * 8) / meta.duration / 1000) || 0 };
    state.previewUrl = URL.createObjectURL(file);
    const v = refs.videoPreview || (refs.videoPreview = $('#videoPreview'));
    if (v) v.src = state.previewUrl;

    hide('#dropzone'); show('#preview', 'grid');
    setText('#fileName', file.name);
    setText('#fileSize', formatBytes(file.size));
    setText('#fileDuration', formatDuration(meta.duration));
    setText('#fileResolution', meta.width + '×' + meta.height);
    setText('#fileBitrate', (state.metadata.bitrate || 0) + ' kbps');

    const ts = refs.trimStart || (refs.trimStart = $('#trimStart')); if (ts) ts.value = '0';
    const te = refs.trimEnd   || (refs.trimEnd   = $('#trimEnd'));   if (te) te.value = meta.duration.toFixed(2);
    syncTrimRanges();

    show('#settingsCard'); show('#actionCard');
    updateDynamicInput(); updateEstimate(); checkResWarning();
    setState(STATE.FILE_LOADED);
    toast('Video dimuat (' + formatDuration(meta.duration) + ')', 'success');
    if (file.size > WARN_FILE_SIZE) toast('File besar (>500 MB) — jangan tutup tab.', 'warning', 6000);
  } catch (err) {
    console.error('[handleFile]', err);
    toast('Gagal memuat video: ' + (err.message || 'unknown'), 'error');
    resetFileSelection();
  }
}
function resetFileSelection() {
  revokePreview(); revokeResult();
  state.file = null; state.metadata = null;
  hide('#preview'); show('#dropzone');
  hide('#settingsCard'); hide('#actionCard');
  hide('#resultCard'); hide('#progressWrap'); hide('#splitViewCard');
  const fi = refs.fileInput || (refs.fileInput = $('#fileInput')); if (fi) fi.value = '';
  resetProgressUI();
  setState(STATE.IDLE);
}

function syncTrimRanges() {
  const dur = (state.metadata && state.metadata.duration) || 0;
  if (dur <= 0) return;
  const s = clamp(safeNum((refs.trimStart || {}).value, 0), 0, dur);
  const e = clamp(safeNum((refs.trimEnd   || {}).value, dur), 0, dur);
  const sr = refs.trimStartRange || (refs.trimStartRange = $('#trimStartRange'));
  const er = refs.trimEndRange   || (refs.trimEndRange   = $('#trimEndRange'));
  if (sr) sr.value = String((s / dur) * 100);
  if (er) er.value = String((e / dur) * 100);
}

let lastProgressEmit = 0;
function resetProgressUI() {
  const f = refs.progressFill || (refs.progressFill = $('#progressFill')); if (f) f.style.width = '0%';
  setText('#progressPct', '0%'); setText('#progressEta', '--:--');
  setText('#progressSpeed', '-'); setText('#progressFps', '-');
  state.lastProgress = 0; state.lastProgressTime = Date.now();
  state.emaSpeed = 0; state.progressHistory = [];
  renderProgressChart();
}
function updateProgress(raw, etaMs) {
  const now = Date.now();
  if (now - lastProgressEmit < PROGRESS_THROTTLE && raw < 1) return;
  lastProgressEmit = now;
  const pct = clamp(Math.round((raw || 0) * 100), 0, 100);
  const f = refs.progressFill || (refs.progressFill = $('#progressFill')); if (f) f.style.width = pct + '%';
  setText('#progressPct', pct + '%');
  const bar = refs.progressBar || (refs.progressBar = $('.cv-progress-bar'));
  if (bar) bar.setAttribute('aria-valuenow', String(pct));
  const dt = (now - state.lastProgressTime) / 1000;
  const dp = pct - state.lastProgress;
  if (dt > 0.3 && dp > 0) {
    const rate = dp / dt;
    const dur = effectiveDuration() || (state.metadata && state.metadata.duration) || 1;
    const instSpeed = (dur * rate) / 100;
    state.emaSpeed = state.emaSpeed === 0 ? instSpeed : state.emaSpeed * 0.7 + instSpeed * 0.3;
    let etaSec;
    if (etaMs > 0) etaSec = etaMs / 1000;
    else if (state.emaSpeed > 0) etaSec = ((100 - pct) / 100 * dur) / state.emaSpeed;
    else etaSec = 0;
    setText('#progressEta', formatEta(etaSec));
    setText('#progressSpeed', state.emaSpeed.toFixed(2) + '×');
    state.lastProgressTime = now;
    state.lastProgress = pct;
    state.progressHistory.push({ t: now, p: pct });
    if (state.progressHistory.length > 60) state.progressHistory.shift();
    scheduleChartRender();
  }
}
function scheduleChartRender() {
  if (state.rafPending) return;
  state.rafPending = true;
  requestAnimationFrame(() => { state.rafPending = false; renderProgressChart(); });
}
function renderProgressChart() {
  const host = refs.progressChart || (refs.progressChart = $('#progressChart'));
  if (!host) return;
  const pts = state.progressHistory;
  if (pts.length < 2) { host.innerHTML = ''; return; }
  const w = 100, h = 30;
  const path = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - (p.p / 100) * h;
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  host.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="pgGrad" x1="0" x2="1">' +
    '<stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#43e97b"/></linearGradient></defs>' +
    '<path d="' + path + '" fill="none" stroke="url(#pgGrad)" stroke-width="1.5" stroke-linecap="round"/></svg>';
}

async function startCompression() {
  if (state.processing) { toast('Sedang memproses...', 'warning'); return; }
  if (!state.file) { toast('Pilih video terlebih dahulu.', 'error'); return; }
  if (!state.workerReady) {
    toast('Menyiapkan FFmpeg...', 'info');
    try { await waitForReady(); }
    catch (e) { toast('FFmpeg belum siap: ' + e.message, 'error'); return; }
  }
  const method = getMethod();
  if (method === 'size-mb') {
    const v = safeNum((refs.numberInput || {}).value, 0);
    if (v <= 0) { toast('Masukkan target ukuran (MB) yang valid.', 'error'); return; }
  }
  const worker = ensureWorker();
  if (!worker) { toast('Tidak dapat membuat worker.', 'error'); return; }

  state.processing = true; state.cancelRequested = false;
  state.startTime = Date.now(); state.lastProgressTime = Date.now();
  state.lastProgress = 0; state.emaSpeed = 0; state.progressHistory = [];

  show('#progressWrap'); hide('#resultCard'); hide('#splitViewCard');
  resetProgressUI(); setState(STATE.PROCESSING);

  try {
    const fileBuffer = await state.file.arrayBuffer();
    const args = buildFFmpegArgs();
    const format = getOutputFormat();
    const ext = OUT_FORMATS[format].ext;

    state.lastConfig = {
      codec: getCodec(), method, resolution: getResolution(),
      sourceWidth: state.metadata.width, sourceHeight: state.metadata.height,
      duration: effectiveDuration() || state.metadata.duration,
      videoBitrate: calcVideoBitrate(),
      audioCodec: getAudioCodec(), audioBitrate: getAudioBitrate(),
      ffmpegArgs: args, outputFormat: format,
      inputName: 'input_' + Date.now() + '.mp4',
      outputName: 'output_' + Date.now() + '.' + ext,
      target: method === 'size-mb' ? safeNum((refs.numberInput || {}).value, 0) :
              method === 'size-percent' ? safeNum((refs.slider || {}).value, 50) : null,
      estimateBytes: state.lastEstimateBytes
    };
    state.lastInputBytes = fileBuffer.byteLength;

    appendLog('info', 'Args: ' + args.join(' '));
    appendLog('info', 'Mulai: ' + state.file.name + ' (' + formatBytes(fileBuffer.byteLength) + ')');

    worker.postMessage({
      type: 'compress',
      payload: { fileBuffer, config: Object.assign({}, state.lastConfig, { effectiveDuration: state.lastConfig.duration }) }
    });
  } catch (err) {
    console.error('[startCompression]', err);
    appendLog('error', 'start: ' + err.message);
    toast('Gagal memulai: ' + (err.message || 'unknown'), 'error');
    state.processing = false;
    setState(state.file ? STATE.FILE_LOADED : STATE.IDLE);
  }
}

function cancelCompression() {
  if (!state.processing) return;
  state.cancelRequested = true;
  toast('Membatalkan...', 'warning');
  try { state.worker && state.worker.postMessage({ type: 'cancel' }); } catch (_) {}
  setTimeout(() => {
    if (state.processing) {
      destroyWorker(); ensureWorker();
      finalizeCancel('force');
    }
  }, 3000);
}
function finalizeCancel(reason) {
  state.processing = false; state.cancelRequested = false;
  hide('#progressWrap');
  setState(state.file ? STATE.FILE_LOADED : STATE.IDLE);
  appendLog('warn', 'Dibatalkan (' + reason + ')');
}
function handleWorkerCancelled() { finalizeCancel('worker-ack'); toast('Proses dibatalkan.', 'warning'); }

function handleWorkerDone(d) {
  state.processing = false; state.cancelRequested = false;
  hide('#progressWrap');
  if (!d || !(d.blob instanceof Blob) || d.blob.size === 0) {
    toast('Hasil kompresi tidak valid.', 'error');
    setState(state.file ? STATE.FILE_LOADED : STATE.IDLE);
    return;
  }
  revokeResult();
  state.resultBlob = d.blob;
  state.resultUrl = URL.createObjectURL(d.blob);
  const beforeSize = state.lastInputBytes || (state.file && state.file.size) || 0;
  const afterSize  = d.blob.size;
  const savedPct   = beforeSize > 0 ? Math.max(0, Math.round((1 - afterSize / beforeSize) * 100)) : 0;
  const savedBytes = Math.max(0, beforeSize - afterSize);
  const rv = refs.resultVideo || (refs.resultVideo = $('#resultVideo'));
  if (rv) rv.src = state.resultUrl;
  setText('#beforeSize', formatBytes(beforeSize));
  setText('#afterSize',  formatBytes(afterSize));
  setText('#beforeRes',  state.metadata.width + '×' + state.metadata.height);
  const cfg = state.lastConfig || {};
  setText('#afterRes', resolveOutputRes(cfg));
  setText('#savedText', savedPct > 0
    ? '🎉 Berhasil menghemat ' + savedPct + '% · ' + formatBytes(savedBytes)
    : '⚠ Ukuran output tidak lebih kecil.');
  const badge = refs.resultCodecBadge || (refs.resultCodecBadge = $('#resultCodecBadge'));
  if (badge) {
    const fmt = cfg.outputFormat || 'mp4';
    badge.textContent = fmt === 'gif' ? 'GIF' : fmt === 'mp3' ? 'MP3' :
      fmt === 'm4a' ? 'M4A' : fmt === 'thumbnail' ? 'JPG' :
      fmt === 'webm' ? 'VP9' : cfg.codec === 'h265-cpu' ? 'H.265' : 'H.264';
  }
  showTargetStatus(cfg, afterSize);
  showAccuracyBadge(cfg, afterSize);
  const dl = refs.btnDownload || (refs.btnDownload = $('#btnDownload'));
  if (dl) {
    dl.href = state.resultUrl;
    dl.download = timestampName((state.file && state.file.name) || 'video', OUT_FORMATS[cfg.outputFormat || 'mp4'].ext);
  }
  show('#resultCard'); setState(STATE.DONE);
  toast(savedPct > 0 ? 'Selesai! Berkurang ' + savedPct + '%' : 'Selesai — cek hasil.', 'success');
  appendLog('info', 'Selesai: ' + formatBytes(beforeSize) + ' → ' + formatBytes(afterSize) + ' (-' + savedPct + '%)');
  saveHistory({
    name: (state.file && state.file.name) || 'video',
    before: beforeSize, after: afterSize,
    codec: cfg.codec, method: cfg.method, outputFormat: cfg.outputFormat || 'mp4',
    config: { codec: cfg.codec, method: cfg.method, resolution: cfg.resolution,
              audioCodec: cfg.audioCodec, audioBitrate: cfg.audioBitrate, target: cfg.target },
    date: Date.now(), savedPct
  });
  if (state.previewUrl && state.resultUrl) showSplitView();
}
function resolveOutputRes(cfg) {
  const res = cfg.resolution;
  if (!res || res === 'keep') return state.metadata.width + '×' + state.metadata.height;
  const parts = res.split('x').map(Number);
  if (parts[0] > state.metadata.width) return state.metadata.width + '×' + state.metadata.height + ' (source)';
  return res;
}
function showTargetStatus(cfg, actualBytes) {
  const el = refs.targetStatus || (refs.targetStatus = $('#targetStatus'));
  if (!el) return;
  const method = cfg.method;
  if (method !== 'size-mb' && method !== 'size-percent') { el.style.display = 'none'; return; }
  let targetBytes;
  if (method === 'size-mb') targetBytes = (cfg.target || 0) * 1048576;
  else targetBytes = state.lastInputBytes * ((cfg.target || 50) / 100);
  const diffPct = targetBytes > 0 ? Math.round(((actualBytes - targetBytes) / targetBytes) * 100) : 0;
  const ok = Math.abs(diffPct) <= 10;
  el.style.display = 'flex';
  el.className = 'cv-target-status ' + (ok ? 'success' : 'miss');
  el.innerHTML = ok
    ? '<i class="fas fa-check-circle"></i> Target tercapai (target ' + formatBytes(targetBytes) + ', hasil ' + formatBytes(actualBytes) + ')'
    : '<i class="fas fa-exclamation-triangle"></i> Target ~' + formatBytes(targetBytes) + ', hasil ' + formatBytes(actualBytes) + ' (' + (diffPct > 0 ? '+' : '') + diffPct + '%)';
}
function showAccuracyBadge(cfg, actualBytes) {
  const el = refs.accuracyBadge || (refs.accuracyBadge = $('#accuracyBadge'));
  if (!el) return;
  const est = cfg.estimateBytes || 0;
  if (!est || est <= 0) { el.style.display = 'none'; return; }
  const acc = Math.max(0, Math.round(100 - Math.abs((actualBytes - est) / est) * 100));
  el.style.display = 'inline-flex';
  el.className = 'cv-badge-accuracy ' + (acc >= 90 ? 'good' : acc >= 70 ? 'ok' : 'poor');
  el.innerHTML = '<i class="fas fa-crosshairs"></i> Akurasi: ' + acc + '%';
}
function handleWorkerError(msg) {
  state.processing = false; state.cancelRequested = false;
  hide('#progressWrap');
  const friendly = mapFFmpegError(msg);
  appendLog('error', msg);
  toast('Gagal compress: ' + friendly, 'error', 6000);
  setState(state.file ? STATE.ERROR : STATE.IDLE);
}

function showSplitView() {
  const card = refs.splitViewCard || (refs.splitViewCard = $('#splitViewCard'));
  if (!card || !state.previewUrl || !state.resultUrl) return;
  const a = refs.splitBefore || (refs.splitBefore = $('#splitBefore'));
  const b = refs.splitAfter  || (refs.splitAfter  = $('#splitAfter'));
  if (a) a.src = state.previewUrl;
  if (b) b.src = state.resultUrl;
  show('#splitViewCard');
}
function bindSplitView() {
  const range  = refs.splitRange  || (refs.splitRange  = $('#splitRange'));
  const after  = refs.splitAfter  || (refs.splitAfter  = $('#splitAfter'));
  const before = refs.splitBefore || (refs.splitBefore = $('#splitBefore'));
  if (!range || !after || !before) return;
  range.addEventListener('input', () => {
    after.style.clipPath = 'inset(0 0 0 ' + safeNum(range.value, 50) + '%)';
  });
  const sync = () => { try { if (Math.abs(before.currentTime - after.currentTime) > 0.1) after.currentTime = before.currentTime; } catch (_) {} };
  before.addEventListener('play',   () => { try { after.play(); } catch (_) {} });
  before.addEventListener('pause',  () => { try { after.pause(); } catch (_) {} });
  before.addEventListener('seeked', sync);
  before.addEventListener('timeupdate', sync);
}

const PRESETS = {
  whatsapp:  { codec: 'h264-cpu', method: 'size-mb',  target: 16, resolution: '1280x720',  audioCodec: 'aac', audioBitrate: '128' },
  instagram: { codec: 'h264-cpu', method: 'quality',  target: 23, resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '128' },
  tiktok:    { codec: 'h264-cpu', method: 'quality',  target: 22, resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '128' },
  youtube:   { codec: 'h264-cpu', method: 'quality',  target: 20, resolution: '1920x1080', audioCodec: 'aac', audioBitrate: '192' },
  twitter:   { codec: 'h264-cpu', method: 'quality',  target: 23, resolution: '1280x720',  audioCodec: 'aac', audioBitrate: '128' },
  email:     { codec: 'h264-cpu', method: 'size-mb',  target: 20, resolution: '854x480',   audioCodec: 'aac', audioBitrate: '96' },
  discord:   { codec: 'h264-cpu', method: 'size-mb',  target: 8,  resolution: '1280x720',  audioCodec: 'aac', audioBitrate: '96' },
  maxsave:   { codec: 'h265-cpu', method: 'quality',  target: 32, resolution: '854x480',   audioCodec: 'aac', audioBitrate: '96' }
};
function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  try {
    setRadio('codec', p.codec); setRadio('method', p.method); setRadio('resolution', p.resolution);
    if (p.method === 'quality' || p.method === 'size-percent') {
      const s = refs.slider || (refs.slider = $('#slider'));
      if (s) { s.value = String(p.target); s.dataset.touched = '1'; }
    } else {
      const n = refs.numberInput || (refs.numberInput = $('#numberInput'));
      if (n) { n.value = String(p.target); n.dataset.touched = '1'; }
    }
    if (refs.audioCodec) refs.audioCodec.value = p.audioCodec;
    if (refs.audioBitrate) refs.audioBitrate.value = p.audioBitrate;
    updateDynamicInput(); updateEstimate();
    toast('Preset: ' + name.toUpperCase(), 'success');
    appendLog('info', 'Preset: ' + name);
  } catch (e) {
    console.warn('[applyPreset]', e);
    toast('Gagal menerapkan preset.', 'error');
  }
}
function setRadio(name, value) {
  const r = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
}

function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    state.customPresets = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(state.customPresets)) state.customPresets = [];
  } catch (_) { state.customPresets = []; }
}
function saveCustomPresets() {
  try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(state.customPresets)); } catch (_) {}
}
function captureCurrentSettings() {
  return {
    codec: getCodec(), method: getMethod(), resolution: getResolution(),
    target: getMethod() === 'size-mb' ? safeNum((refs.numberInput || {}).value, 50) : safeNum((refs.slider || {}).value, 50),
    audioCodec: getAudioCodec(), audioBitrate: String(getAudioBitrate()),
    outputFormat: getOutputFormat()
  };
}
function addCustomPreset() {
  const nameInput = refs.customPresetName || (refs.customPresetName = $('#customPresetName'));
  const name = ((nameInput || {}).value || '').trim();
  if (!name) { toast('Masukkan nama preset.', 'warning'); return; }
  state.customPresets = state.customPresets.filter(p => p.name !== name);
  state.customPresets.push({ name, cfg: captureCurrentSettings(), date: Date.now() });
  saveCustomPresets(); renderCustomPresets();
  if (nameInput) nameInput.value = '';
  toast('Preset "' + name + '" disimpan.', 'success');
}
function applyCustomPreset(name) {
  const p = state.customPresets.find(x => x.name === name);
  if (!p) return;
  const c = p.cfg;
  setRadio('codec', c.codec); setRadio('method', c.method); setRadio('resolution', c.resolution);
  if (refs.slider) { refs.slider.value = String(c.target); refs.slider.dataset.touched = '1'; }
  if (refs.numberInput) { refs.numberInput.value = String(c.target); refs.numberInput.dataset.touched = '1'; }
  if (refs.audioCodec) refs.audioCodec.value = c.audioCodec;
  if (refs.audioBitrate) refs.audioBitrate.value = c.audioBitrate;
  if (refs.outputFormat) refs.outputFormat.value = c.outputFormat || 'mp4';
  updateDynamicInput(); updateEstimate();
  toast('Preset "' + name + '" diterapkan.', 'success');
}
function renderCustomPresets() {
  const host = refs.customPresetsList || (refs.customPresetsList = $('#customPresetsList'));
  if (!host) return;
  if (!state.customPresets.length) {
    host.innerHTML = '<div class="cv-preset-custom-empty">Belum ada preset custom.</div>';
    return;
  }
  host.innerHTML = state.customPresets.map(p =>
    '<div class="cv-preset-custom-row">' +
      '<button type="button" class="cv-preset-apply" data-name="' + escapeHtml(p.name) + '"><i class="fas fa-star"></i> ' + escapeHtml(p.name) + '</button>' +
      '<button type="button" class="cv-preset-remove" data-name="' + escapeHtml(p.name) + '" aria-label="Hapus"><i class="fas fa-times"></i></button>' +
    '</div>'
  ).join('');
}
function removeCustomPreset(name) {
  state.customPresets = state.customPresets.filter(p => p.name !== name);
  saveCustomPresets(); renderCustomPresets();
  toast('Preset "' + name + '" dihapus.', 'info');
}

function resetAllSettings() {
  setRadio('codec', 'h264-cpu'); setRadio('method', 'size-percent'); setRadio('resolution', '1280x720');
  if (refs.slider) { refs.slider.value = '50'; delete refs.slider.dataset.touched; }
  if (refs.numberInput) { refs.numberInput.value = '50'; delete refs.numberInput.dataset.touched; }
  if (refs.audioCodec) refs.audioCodec.value = 'aac';
  if (refs.audioBitrate) refs.audioBitrate.value = '128';
  if (refs.outputFormat) refs.outputFormat.value = 'mp4';
  if (refs.trimStart) refs.trimStart.value = '0';
  if (refs.trimEnd && state.metadata) refs.trimEnd.value = state.metadata.duration.toFixed(2);
  if (refs.advRotate) refs.advRotate.value = '0';
  if (refs.advFlip) refs.advFlip.value = 'none';
  if (refs.fBrightness) refs.fBrightness.value = '0';
  if (refs.fContrast) refs.fContrast.value = '1';
  if (refs.fSaturation) refs.fSaturation.value = '1';
  if (refs.wmText) refs.wmText.value = '';
  if (refs.wmPos) refs.wmPos.value = 'br';
  if (refs.wmSize) refs.wmSize.value = '24';
  if (refs.wmColor) refs.wmColor.value = '#ffffff';
  if (refs.wmOpacity) refs.wmOpacity.value = '0.8';
  if (refs.wmBg) refs.wmBg.checked = false;
  setText('#valBrightness', '0'); setText('#valContrast', '1.0'); setText('#valSaturation', '1.0'); setText('#valWmOpacity', '0.8');
  syncTrimRanges(); updateDynamicInput(); updateEstimate();
  toast('Setting direset.', 'success');
}

function checkResWarning() {
  const t = getResolution();
  const w = refs.resolutionWarning || (refs.resolutionWarning = $('#resolutionWarning'));
  if (!w) return;
  if (!t || t === 'keep' || !state.metadata || !state.metadata.width) { w.style.display = 'none'; return; }
  const tw = Number(t.split('x')[0]);
  w.style.display = (tw > state.metadata.width) ? 'flex' : 'none';
}

function migrateHistory() {
  try {
    const legacy = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (legacy && !localStorage.getItem(HISTORY_KEY)) {
      localStorage.setItem(HISTORY_KEY, legacy);
      localStorage.removeItem(LEGACY_HISTORY_KEY);
    }
  } catch (_) {}
}
function loadHistory() {
  try {
    let items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(items)) items = [];
    const now = Date.now();
    return items.filter(it => (now - (it.date || 0)) < HISTORY_TTL);
  } catch (_) { return []; }
}
function saveHistory(entry) {
  const items = loadHistory();
  items.unshift(entry);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch (_) {}
  renderHistory();
}
function renderHistory() {
  const card = refs.historyCard || (refs.historyCard = $('#historyCard'));
  const list = refs.historyList || (refs.historyList = $('#historyList'));
  if (!card || !list) return;
  const items = loadHistory();
  if (!items.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  list.innerHTML = items.map((h, i) =>
    '<div class="cv-history-item">' +
      '<div class="hi-icon"><i class="fas fa-file-video"></i></div>' +
      '<div class="hi-content"><div class="hi-name">' + escapeHtml(h.name || 'video') + '</div>' +
        '<div class="hi-meta">' + formatBytes(h.before || 0) + ' → ' + formatBytes(h.after || 0) +
        ' · ' + escapeHtml(h.outputFormat || h.codec || '-') +
        ' · ' + new Date(h.date || Date.now()).toLocaleString('id-ID') + '</div></div>' +
      '<div class="hi-save">-' + (h.savedPct || 0) + '%</div>' +
      '<div class="hi-actions">' +
        (h.config ? '<button type="button" class="hi-btn hi-apply" data-idx="' + i + '" title="Terapkan"><i class="fas fa-redo"></i></button>' : '') +
        '<button type="button" class="hi-btn hi-remove" data-idx="' + i + '" title="Hapus"><i class="fas fa-times"></i></button>' +
      '</div></div>'
  ).join('');
}
function applyHistoryItem(idx) {
  const items = loadHistory();
  const h = items[idx];
  if (!h || !h.config) return;
  const c = h.config;
  setRadio('codec', c.codec || 'h264-cpu');
  setRadio('method', c.method || 'size-percent');
  setRadio('resolution', c.resolution || 'keep');
  if (c.target != null) {
    if (refs.slider) { refs.slider.value = String(c.target); refs.slider.dataset.touched = '1'; }
    if (refs.numberInput) { refs.numberInput.value = String(c.target); refs.numberInput.dataset.touched = '1'; }
  }
  if (refs.audioCodec && c.audioCodec) refs.audioCodec.value = c.audioCodec;
  if (refs.audioBitrate && c.audioBitrate) refs.audioBitrate.value = String(c.audioBitrate);
  updateDynamicInput(); updateEstimate();
  toast('Setting riwayat diterapkan.', 'success');
}
function removeHistoryItem(idx) {
  const items = loadHistory();
  items.splice(idx, 1);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch (_) {}
  renderHistory();
}
function exportHistory() {
  const items = loadHistory();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'irgxy-history-' + Date.now() + '.json';
  a.click();
  setTimeout(() => revokeUrl(url), 1000);
  toast('Riwayat diexport.', 'success');
}

function addToBatch() {
  const input = refs.batchInput || (refs.batchInput = $('#batchInput'));
  if (input) input.click();
}
function handleBatchFiles(files) {
  Array.from(files || []).forEach(f => {
    if (!isVideoFile(f)) return;
    if (f.size > MAX_FILE_SIZE) { toast('File terlalu besar: ' + f.name, 'error'); return; }
    state.batch.push({ file: f, status: 'pending', progress: 0 });
  });
  renderBatchList();
  toast(state.batch.length + ' file di antrian.', 'info');
}
function renderBatchList() {
  const host = refs.batchList || (refs.batchList = $('#batchList'));
  const card = refs.batchCard || (refs.batchCard = $('#batchCard'));
  if (!host || !card) return;
  if (!state.batch.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  host.innerHTML = state.batch.map((b, i) =>
    '<div class="cv-batch-item">' +
      '<div class="bi-icon"><i class="fas fa-file-video"></i></div>' +
      '<div class="bi-content"><div class="bi-name">' + escapeHtml(b.file.name) + '</div>' +
        '<div class="bi-meta">' + formatBytes(b.file.size) + ' · ' + b.status + '</div>' +
        '<div class="bi-bar"><div class="bi-bar-fill" style="width:' + b.progress + '%"></div></div></div>' +
      '<button type="button" class="bi-remove" data-idx="' + i + '" aria-label="Hapus"><i class="fas fa-times"></i></button>' +
    '</div>'
  ).join('');
}
async function processBatch() {
  if (state.batchProcessing) { toast('Batch sedang berjalan.', 'warning'); return; }
  if (!state.batch.length) { toast('Antrian kosong.', 'warning'); return; }
  if (!state.workerReady) { toast('Menyiapkan FFmpeg...', 'info'); try { await waitForReady(); } catch (e) { toast(e.message, 'error'); return; } }
  state.batchProcessing = true;
  const results = [];
  for (let i = 0; i < state.batch.length; i++) {
    const b = state.batch[i];
    if (b.status === 'done') { results.push(b.result); continue; }
    b.status = 'processing'; b.progress = 10; renderBatchList();
    try {
      const ok = await processBatchItem(b);
      if (ok) results.push(b.result);
    } catch (e) { console.error('[batch]', e); b.status = 'error'; }
    renderBatchList();
  }
  state.batchProcessing = false;
  if (results.length) await downloadBatchZip(results);
  toast('Batch selesai: ' + results.length + '/' + state.batch.length, 'success');
}
async function processBatchItem(item) {
  return new Promise((resolve) => {
    const file = item.file;
    file.arrayBuffer().then(buf => {
      loadVideoMetadata(file).then(meta => {
        state.metadata = { duration: meta.duration, width: meta.width, height: meta.height,
          bitrate: Math.round((file.size * 8) / meta.duration / 1000) || 0 };
        const args = buildFFmpegArgs();
        const ext = OUT_FORMATS[getOutputFormat()].ext;
        const handler = (e) => {
          const d = e.data || {};
          if (d.type === 'progress') { item.progress = 10 + Math.round((d.progress || 0) * 85); renderBatchList(); }
          else if (d.type === 'done') {
            state.worker.removeEventListener('message', handler);
            item.progress = 100; item.status = 'done';
            item.result = { name: file.name, blob: d.blob, ext };
            resolve(true);
          } else if (d.type === 'error') {
            state.worker.removeEventListener('message', handler);
            item.status = 'error'; resolve(false);
          }
        };
        state.worker.addEventListener('message', handler);
        state.worker.postMessage({
          type: 'compress',
          payload: { fileBuffer: buf, config: {
            ffmpegArgs: args,
            inputName: 'b_in_' + Date.now() + '.mp4',
            outputName: 'b_out_' + Date.now() + '.' + ext,
            effectiveDuration: meta.duration } }
        });
      }).catch(() => resolve(false));
    }).catch(() => resolve(false));
  });
}
async function downloadBatchZip(results) {
  if (typeof JSZip === 'undefined') {
    toast('JSZip tidak tersedia — download satu per satu.', 'warning');
    results.forEach(r => downloadBlob(r.blob, r.name));
    return;
  }
  const zip = new JSZip();
  results.forEach(r => {
    const base = r.name.replace(/\.[^/.]+$/, '') || 'video';
    zip.file(base + '_compressed.' + r.ext, r.blob);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'irgxy-batch-' + Date.now() + '.zip');
  toast('ZIP siap diunduh.', 'success');
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => revokeUrl(url), 2000);
}

function bindTabs() {
  const tabs = $$('.cv-tabs button[data-tab]');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      tabs.forEach(b => b.classList.toggle('active', b === btn));
      $$('.cv-tab-panel').forEach(p => {
        p.style.display = (p.getAttribute('data-panel') === target) ? 'block' : 'none';
      });
    });
  });
  const first = tabs[0];
  if (first) first.click();
}

async function analyzeVideo() {
  if (!state.file) { toast('Pilih video terlebih dahulu.', 'warning'); return; }
  if (!state.workerReady) { toast('FFmpeg belum siap.', 'warning'); return; }
  toast('Menganalisis...', 'info');
  try {
    const buf = await state.file.arrayBuffer();
    const result = await new Promise((resolve) => {
      const analysisLines = [];
      const handler = (e) => {
        const d = e.data || {};
        if (d.type === 'status' && d.message && /Stream #|Duration|Input #/.test(d.message)) analysisLines.push(d.message);
        if (d.type === 'done' || d.type === 'error') {
          state.worker.removeEventListener('message', handler);
          resolve(analysisLines);
        }
      };
      state.worker.addEventListener('message', handler);
      state.worker.postMessage({
        type: 'compress',
        payload: { fileBuffer: buf, config: {
          ffmpegArgs: ['-hide_banner', '-i', '__INPUT__', '-f', 'null', '__OUTPUT__'],
          inputName: 'a_in_' + Date.now() + '.mp4',
          outputName: 'a_out_' + Date.now() + '.mp4',
          effectiveDuration: state.metadata.duration } }
      });
    });
    showAnalysis(result);
  } catch (e) {
    console.error('[analyze]', e);
    toast('Gagal analisis: ' + e.message, 'error');
  }
}
function showAnalysis(lines) {
  const card = refs.analysisCard || (refs.analysisCard = $('#analysisCard'));
  const body = refs.analysisBody || (refs.analysisBody = $('#analysisBody'));
  if (!card || !body) return;
  body.innerHTML = '<pre class="cv-analysis-pre">' + escapeHtml(lines.join('\n')) + '</pre>';
  show('#analysisCard');
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
  if (e.key === 'o' || e.key === 'O') { e.preventDefault(); $('#fileInput').click(); }
  else if (e.key === 'Enter') { e.preventDefault(); startCompression(); }
  else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); toggleLogs(); }
  else if (e.key === '/') { e.preventDefault(); toggleHelp(); }
  else if (e.key === 's' || e.key === 'S') { if (state.resultUrl) { e.preventDefault(); if (refs.btnDownload) refs.btnDownload.click(); } }
  else if (e.key === 'b' || e.key === 'B') { e.preventDefault(); addToBatch(); }
  else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); showSplitView(); }
  else if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault(); resetFileSelection(); resetAllSettings();
    toast('Reset selesai.', 'success');
  }
}
function toggleHelp(force) {
  state.helpOpen = (typeof force === 'boolean') ? force : !state.helpOpen;
  const m = refs.helpModal || (refs.helpModal = $('#helpModal'));
  if (m) m.style.display = state.helpOpen ? 'flex' : 'none';
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('#btnStart')) { startCompression(); return; }
    if (t.closest('#btnCancel')) { cancelCompression(); return; }
    if (t.closest('#btnRetry')) {
      hide('#resultCard'); revokeResult();
      const s = refs.settingsCard || (refs.settingsCard = $('#settingsCard'));
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (t.closest('#btnRemoveFile')) { resetFileSelection(); return; }
    if (t.closest('#btnChangeFile')) { $('#fileInput').click(); return; }
    if (t.closest('#btnTrimFull') && state.metadata) {
      if (refs.trimStart) refs.trimStart.value = '0';
      if (refs.trimEnd) refs.trimEnd.value = state.metadata.duration.toFixed(2);
      syncTrimRanges(); updateEstimate(); return;
    }
    if (t.closest('#btnReset')) { resetAllSettings(); return; }
    if (t.closest('#btnClearHistory')) {
      try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
      renderHistory(); toast('Riwayat dihapus.', 'success'); return;
    }
    if (t.closest('#btnExportHistory')) { exportHistory(); return; }
    if (t.closest('#btnLog')) { toggleLogs(); return; }
    if (t.closest('#btnHelp')) { toggleHelp(); return; }
    if (t.closest('#logClose')) { toggleLogs(false); return; }
    if (t.closest('#helpClose')) { toggleHelp(false); return; }
    if (t.closest('#logClear')) { const b = refs.logBody; if (b) b.innerHTML = ''; return; }
    if (t.closest('#btnAnalyze')) { analyzeVideo(); return; }
    if (t.closest('#btnAddBatch')) { addToBatch(); return; }
    if (t.closest('#btnProcessBatch')) { processBatch(); return; }
    if (t.closest('#btnClearBatch')) { state.batch = []; renderBatchList(); return; }
    if (t.closest('#btnSavePreset')) { addCustomPreset(); return; }

    const presetBtn = t.closest('.cv-preset-btn');
    if (presetBtn) { applyPreset(presetBtn.getAttribute('data-preset')); return; }
    const customApply = t.closest('.cv-preset-apply');
    if (customApply) { applyCustomPreset(customApply.getAttribute('data-name')); return; }
    const customRm = t.closest('.cv-preset-remove');
    if (customRm) { removeCustomPreset(customRm.getAttribute('data-name')); return; }
    const hiApply = t.closest('.hi-apply');
    if (hiApply) { applyHistoryItem(Number(hiApply.getAttribute('data-idx'))); return; }
    const hiRemove = t.closest('.hi-remove');
    if (hiRemove) { removeHistoryItem(Number(hiRemove.getAttribute('data-idx'))); return; }
    const biRemove = t.closest('.bi-remove');
    if (biRemove) { state.batch.splice(Number(biRemove.getAttribute('data-idx')), 1); renderBatchList(); return; }

    const dropzone = t.closest('#dropzone');
    if (dropzone) { $('#fileInput').click(); return; }

    const faqQ = t.closest('.cv-faq-q');
    if (faqQ) {
      const item = faqQ.parentElement;
      const wasOpen = item.classList.contains('open');
      $$('.cv-faq-item').forEach(o => o.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
      return;
    }
    const tabBtn = t.closest('.cv-help-tab');
    if (tabBtn) {
      const target = tabBtn.getAttribute('data-help-tab');
      $$('.cv-help-tab').forEach(b => b.classList.toggle('active', b === tabBtn));
      $$('.cv-help-panel').forEach(p => p.style.display = p.getAttribute('data-help-panel') === target ? 'block' : 'none');
      return;
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'codec' || t.name === 'method') { updateDynamicInput(); updateEstimate(); }
    else if (t.name === 'resolution') { checkResWarning(); updateEstimate(); }
    else if (t.id === 'audioCodec' || t.id === 'audioBitrate') { updateEstimate(); }
    else if (t.id === 'outputFormat') { updateDynamicInput(); updateEstimate(); }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'slider') { t.dataset.touched = '1'; setText('#sliderValue', t.value); updateEstimateDebounced(); }
    else if (t.id === 'numberInput') { t.dataset.touched = '1'; updateEstimateDebounced(); }
    else if (t.id === 'trimStart' || t.id === 'trimEnd') { syncTrimRanges(); updateEstimateDebounced(); }
    else if (t.id === 'trimStartRange') {
      const dur = (state.metadata && state.metadata.duration) || 0;
      if (refs.trimStart) refs.trimStart.value = (dur * safeNum(t.value, 0) / 100).toFixed(2);
      updateEstimateDebounced();
    }
    else if (t.id === 'trimEndRange') {
      const dur = (state.metadata && state.metadata.duration) || 0;
      if (refs.trimEnd) refs.trimEnd.value = (dur * safeNum(t.value, 100) / 100).toFixed(2);
      updateEstimateDebounced();
    }
    else if (t.id === 'fBrightness') setText('#valBrightness', t.value);
    else if (t.id === 'fContrast')   setText('#valContrast', t.value);
    else if (t.id === 'fSaturation') setText('#valSaturation', t.value);
    else if (t.id === 'wmOpacity')   setText('#valWmOpacity', t.value);
  });

  const fi = refs.fileInput || (refs.fileInput = $('#fileInput'));
  if (fi) fi.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files[0]) handleFile(files[0]);
    e.target.value = '';
  });
  const bi = refs.batchInput || (refs.batchInput = $('#batchInput'));
  if (bi) bi.addEventListener('change', (e) => { handleBatchFiles(e.target.files); e.target.value = ''; });

  const dz = refs.dropzone || (refs.dropzone = $('#dropzone'));
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('dragover');
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length === 1) handleFile(files[0]);
      else if (files.length > 1) handleBatchFiles(files);
    });
    dz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); }
    });
  }
  const modal = refs.helpModal || (refs.helpModal = $('#helpModal'));
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) toggleHelp(false); });

  bindSplitView();
  bindTabs();
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', (e) => {
    if (state.processing) { e.preventDefault(); e.returnValue = 'Proses sedang berjalan. Yakin keluar?'; return e.returnValue; }
    destroyWorker(); revokePreview(); revokeResult();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { if (refs.videoPreview) refs.videoPreview.pause(); } catch (_) {}
      try { if (refs.resultVideo) refs.resultVideo.pause(); } catch (_) {}
    }
  });
}

function boot() {
  try {
    ['videoPreview','resultVideo','logBody','logPanel','workerStatus','workerStatusText',
     'workerVersionTag','btnStart','progressFill','toastContainer',
     'fileInput','batchInput','dropzone','slider','numberInput',
     'dynamicLabel','trimStart','trimEnd','trimStartRange','trimEndRange','advRotate','advFlip',
     'fBrightness','fContrast','fSaturation','wmText','wmPos','wmSize','wmColor','wmOpacity','wmBg',
     'audioCodec','audioBitrate','outputFormat','thumbAt','resultCodecBadge','targetStatus',
     'accuracyBadge','btnDownload','splitViewCard','splitBefore','splitAfter','splitRange',
     'analysisCard','analysisBody','batchCard','batchList','customPresetName','customPresetsList',
     'historyCard','historyList','settingsCard','helpModal'].forEach(id => { refs[id] = document.getElementById(id); });
    refs.sliderWrap = $('#sliderWrap');
    refs.numberWrap = $('#numberWrap');
    refs.progressBar = $('.cv-progress-bar');
    refs.toastContainer = $('#toastContainer');

    migrateHistory();
    loadCustomPresets();
    bindEvents();
    updateDynamicInput();
    renderHistory();
    renderCustomPresets();
    refreshStartButton();
    appendLog('info', 'Client v' + APP_VERSION + ' siap');

    const coiWarn = $('#coiWarning');
    if (coiWarn) coiWarn.style.display = 'none';

    ensureWorker();
    setWorkerStatus('Memuat worker...', 'idle');
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

window.addEventListener('error', (e) => {
  if (!state.processing) appendLog('error', 'Global: ' + e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (!state.processing) appendLog('warn', 'Rejection: ' + ((e.reason && e.reason.message) || e.reason));
});

})();