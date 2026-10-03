/* ═══════════════════════════════════════════════════════════════
   FILE: js/testspeed.js
   Logic Test Speed Internet — IRGXYMODS
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ---------- GLOBAL ERROR GUARD ---------- */
  window.addEventListener('error', (e) => console.warn('[SpeedTest] error:', e.message));
  window.addEventListener('unhandledrejection', (e) => console.warn('[SpeedTest] rejection:', e.reason));

  /* ---------- DEPENDENCY BRIDGE (fallback jika main.js belum load) ---------- */
  const IRGXY = window.IRGXY || {};
  const $ = IRGXY.$ || ((s, ctx = document) => ctx.querySelector(s));
  const $$ = IRGXY.$$ || ((s, ctx = document) => Array.from(ctx.querySelectorAll(s)));
  const showToast = IRGXY.showToast || function (msg, type = 'success') { console.log('[SpeedTest ' + type + ']', msg); };
  const Activity = IRGXY.Activity || { add() {} };
  const withTimeout = IRGXY.withTimeout || function (ms) {
    const c = new AbortController();
    setTimeout(() => { try { c.abort(new DOMException('TimeoutError', 'TimeoutError')); } catch (_) { c.abort(); } }, ms);
    return c.signal;
  };

  /* ---------- CONSTANTS ---------- */
  const STORAGE_KEY = 'irgxy_speed_history';
  const MAX_HISTORY = 20;
  const MAX_GAUGE_MBPS = 100;
  const SERVERS = {
    down: 'https://speed.cloudflare.com/__down',
    up: 'https://speed.cloudflare.com/__up',
    meta: 'https://speed.cloudflare.com/meta',
    ip: 'https://api.ipify.org?format=json',
    fallbackDown: 'https://httpbin.org/bytes/',
    fallbackUp: 'https://httpbin.org/post'
  };

  /* ---------- STATE ---------- */
  const state = {
    running: false,
    abortController: null,
    timerInterval: null,
    tickInterval: null,
    startTime: 0,
    results: null,
    history: []
  };

  /* ---------- DOM CACHE ---------- */
  const dom = {
    onlineDot: $('#tsOnlineDot'),
    onlineText: $('#tsOnlineText'),
    connBadge: $('#tsConnBadge'),
    connType: $('#tsConnType'),
    publicIp: $('#tsPublicIp'),
    deviceInfo: $('#tsDeviceInfo'),
    downlinkEst: $('#tsDownlinkEst'),
    gaugeArc: $('#tsGaugeArc'),
    gaugeNeedle: $('#tsGaugeNeedle'),
    gaugeValue: $('#tsGaugeValue'),
    gaugeLabel: $('#tsGaugeLabel'),
    startBtn: $('#tsStartBtn'),
    stopBtn: $('#tsStopBtn'),
    retryBtn: $('#tsRetryBtn'),
    phaseLabel: $('#tsPhaseLabel'),
    timer: $('#tsTimer'),
    progressFill: $('#tsProgressFill'),
    progressPct: $('#tsProgressPct'),
    liveSpeed: $('#tsLiveSpeed'),
    liveBytes: $('#tsLiveBytes'),
    dlVal: $('#tsDownloadVal'),
    dlSub: $('#tsDownloadSub'),
    ulVal: $('#tsUploadVal'),
    ulSub: $('#tsUploadSub'),
    pingVal: $('#tsPingVal'),
    pingSub: $('#tsPingSub'),
    jitterVal: $('#tsJitterVal'),
    jitterSub: $('#tsJitterSub'),
    qualityBadge: $('#tsQualityBadge'),
    qualityLabel: $('#tsQualityLabel'),
    qualityDesc: $('#tsQualityDesc'),
    recoGrid: $('#tsRecoGrid'),
    historyList: $('#tsHistoryList'),
    clearHistoryBtn: $('#tsClearHistoryBtn'),
    exportCard: $('#tsExportCard'),
    shareBtn: $('#tsShareBtn'),
    copyBtn: $('#tsCopyBtn'),
    downloadTxtBtn: $('#tsDownloadTxtBtn'),
    downloadJsonBtn: $('#tsDownloadJsonBtn')
  };

  /* ================================================================
     UTILITIES
     ================================================================ */
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const safeNum = (v, digits = 2) => {
    const n = Number(v);
    if (!isFinite(n) || isNaN(n)) return '0.' + '0'.repeat(digits);
    return n.toFixed(digits);
  };

  const formatBytes = (bytes) => {
    if (!bytes || !isFinite(bytes)) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  const formatTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
  };

  const formatDate = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return '—'; }
  };

  /* ================================================================
     CONNECTION DETECTION
     ================================================================ */
  function detectConnection() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const online = navigator.onLine;
    if (!online) return { online: false, type: 'Offline', downlink: 0, rtt: 0, saveData: false, available: !!conn };
    if (conn) {
      const map = { 'slow-2g': '2G', '2g': '2G', '3g': '3G', '4g': '4G' };
      return {
        online: true,
        type: map[conn.effectiveType] || 'Unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0,
        saveData: !!conn.saveData,
        available: true
      };
    }
    return { online: true, type: 'Unknown', downlink: 0, rtt: 0, saveData: false, available: false };
  }

  function detectPlatform() {
    const ua = navigator.userAgent || '';
    let os = 'Unknown';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Unknown';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\//i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua)) browser = 'Safari';

    return { os, browser };
  }

  async function fetchPublicIp() {
    try {
      const res = await fetch(SERVERS.meta, { signal: withTimeout(6000), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return data.clientIp || data.ip || '—';
      }
    } catch (_) { /* fallback di bawah */ }
    try {
      const res = await fetch(SERVERS.ip, { signal: withTimeout(6000), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return data.ip || '—';
      }
    } catch (_) { /* abaikan */ }
    return '—';
  }

  function renderConnectionInfo() {
    try {
      const conn = detectConnection();
      const plat = detectPlatform();

      if (dom.onlineDot) {
        dom.onlineDot.classList.remove('offline', 'unknown');
        if (!conn.online) dom.onlineDot.classList.add('offline');
        else if (conn.type === 'Unknown') dom.onlineDot.classList.add('unknown');
      }
      if (dom.onlineText) dom.onlineText.textContent = conn.online ? 'Terhubung' : 'Offline';
      if (dom.connType) dom.connType.textContent = conn.type;
      if (dom.deviceInfo) dom.deviceInfo.textContent = plat.os + ' · ' + plat.browser;
      if (dom.downlinkEst) {
        dom.downlinkEst.textContent = conn.downlink ? '≈ ' + safeNum(conn.downlink, 1) + ' Mbps' : '—';
      }
      fetchPublicIp().then(ip => { if (dom.publicIp) dom.publicIp.textContent = ip; });
    } catch (e) {
      console.warn('[SpeedTest] renderConnectionInfo:', e);
    }
  }

  /* ================================================================
     PING / JITTER TEST
     ================================================================ */
  async function testPing(count, onProgress) {
    const rtts = [];
    for (let i = 0; i < count; i++) {
      if (state.abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const t0 = performance.now();
      try {
        const res = await fetch(SERVERS.down + '?bytes=0&r=' + Math.random(), {
          method: 'GET',
          cache: 'no-store',
          signal: state.abortController.signal
        });
        // consume (meski bytes=0)
        try { await res.arrayBuffer(); } catch (_) {}
        const rtt = performance.now() - t0;
        rtts.push(rtt);
        if (onProgress) onProgress({ index: i + 1, total: count, rtt });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        // skip sample gagal
      }
    }
    if (!rtts.length) throw new Error('Ping test gagal — tidak ada respons');
    const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    const min = Math.min(...rtts);
    const max = Math.max(...rtts);
    let jitterSum = 0;
    for (let i = 1; i < rtts.length; i++) jitterSum += Math.abs(rtts[i] - rtts[i - 1]);
    const jitter = rtts.length > 1 ? jitterSum / (rtts.length - 1) : 0;
    return { avg, min, max, jitter, samples: rtts };
  }

  /* ================================================================
     DOWNLOAD TEST
     ================================================================ */
  function pickDownloadSize() {
    try {
      const conn = detectConnection();
      const dl = conn.downlink || 0; // Mbps
      if (dl === 0) return 5 * 1024 * 1024;
      if (dl < 1) return 1 * 1024 * 1024;
      if (dl < 5) return 5 * 1024 * 1024;
      if (dl < 20) return 10 * 1024 * 1024;
      return 25 * 1024 * 1024;
    } catch (_) { return 10 * 1024 * 1024; }
  }

  async function testDownload(onProgress) {
    const size = pickDownloadSize();
    const url = SERVERS.down + '?bytes=' + size + '&r=' + Math.random();
    const start = performance.now();
    let received = 0;
    let lastUpdate = start;
    let lastBytes = 0;
    let peak = 0;
    let min = Infinity;
    const samples = [];

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: state.abortController.signal
    });
    if (!res.ok) throw new Error('Download server error: ' + res.status);
    if (!res.body || !res.body.getReader) throw new Error('Stream tidak didukung');

    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      const now = performance.now();
      if (now - lastUpdate >= 100) {
        const dt = (now - lastUpdate) / 1000;
        const dBytes = received - lastBytes;
        const mbps = dt > 0 ? (dBytes * 8) / dt / 1e6 : 0;
        if (isFinite(mbps) && mbps > 0) {
          samples.push(mbps);
          if (mbps > peak) peak = mbps;
          if (mbps < min) min = mbps;
        }
        lastUpdate = now;
        lastBytes = received;
        if (onProgress) onProgress({ received, total: size, mbps, elapsed: (now - start) / 1000 });
      }
    }
    const elapsed = Math.max(0.001, (performance.now() - start) / 1000);
    const avg = (received * 8) / elapsed / 1e6;
    return {
      avgMbps: clamp(avg, 0, 10000),
      peak: clamp(peak || avg, 0, 10000),
      min: clamp(min === Infinity ? avg : min, 0, 10000),
      bytes: received,
      elapsed
    };
  }

  /* ================================================================
     UPLOAD TEST (XHR karena fetch tidak mendukung upload progress)
     ================================================================ */
  function pickUploadSize() {
    try {
      const conn = detectConnection();
      const dl = conn.downlink || 0;
      if (dl === 0) return 1 * 1024 * 1024;
      if (dl < 2) return 512 * 1024;
      if (dl < 10) return 1 * 1024 * 1024;
      return 3 * 1024 * 1024;
    } catch (_) { return 1 * 1024 * 1024; }
  }

  function testUpload(onProgress) {
    return new Promise((resolve, reject) => {
      const size = pickUploadSize();
      let payload;
      try {
        payload = new Uint8Array(size);
        // fill dengan data pseudo-random untuk menghindari kompresi server
        for (let i = 0; i < size; i += 512) {
          payload[i] = (i * 31 + 7) & 0xff;
        }
      } catch (e) {
        return reject(new Error('Gagal membuat payload'));
      }

      const xhr = new XMLHttpRequest();
      const start = performance.now();
      let peak = 0;
      let min = Infinity;
      let cancelled = false;

      const onAbort = () => {
        cancelled = true;
        try { xhr.abort(); } catch (_) {}
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (state.abortController && state.abortController.signal) {
        state.abortController.signal.addEventListener('abort', onAbort, { once: true });
      }

      xhr.upload.onprogress = (e) => {
        if (cancelled) return;
        if (e.lengthComputable && e.loaded > 0) {
          const now = performance.now();
          const elapsed = Math.max(0.001, (now - start) / 1000);
          const mbps = (e.loaded * 8) / elapsed / 1e6;
          if (isFinite(mbps) && mbps > 0) {
            if (mbps > peak) peak = mbps;
            if (mbps < min) min = mbps;
          }
          if (onProgress) onProgress({ loaded: e.loaded, total: size, mbps, elapsed });
        }
      };

      xhr.onload = () => {
        if (state.abortController?.signal) {
          state.abortController.signal.removeEventListener('abort', onAbort);
        }
        if (xhr.status >= 200 && xhr.status < 400) {
          const elapsed = Math.max(0.001, (performance.now() - start) / 1000);
          const avg = (size * 8) / elapsed / 1e6;
          resolve({
            avgMbps: clamp(avg, 0, 10000),
            peak: clamp(peak || avg, 0, 10000),
            min: clamp(min === Infinity ? avg : min, 0, 10000),
            bytes: size,
            elapsed
          });
        } else {
          reject(new Error('Upload server error: ' + xhr.status));
        }
      };

      xhr.onerror = () => {
        if (state.abortController?.signal) {
          state.abortController.signal.removeEventListener('abort', onAbort);
        }
        reject(new Error('Upload network error'));
      };

      xhr.ontimeout = () => {
        if (state.abortController?.signal) {
          state.abortController.signal.removeEventListener('abort', onAbort);
        }
        reject(new Error('Upload timeout'));
      };

      try {
        xhr.open('POST', SERVERS.up, true);
        xhr.timeout = 30000;
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(payload);
      } catch (e) {
        reject(e);
      }
    });
  }

  /* ================================================================
     GAUGE / UI UPDATES
     ================================================================ */
  function updateGauge(mbps) {
    try {
      const v = clamp(Number(mbps) || 0, 0, MAX_GAUGE_MBPS);
      const ratio = v / MAX_GAUGE_MBPS;
      const angle = -90 + ratio * 180;
      if (dom.gaugeNeedle) dom.gaugeNeedle.setAttribute('transform', 'rotate(' + angle + ' 160 170)');
      if (dom.gaugeArc) dom.gaugeArc.setAttribute('stroke-dasharray', (ratio * 100).toFixed(2) + ' 100');
      if (dom.gaugeValue) dom.gaugeValue.textContent = safeNum(v, 2);
    } catch (e) { console.warn('[SpeedTest] updateGauge:', e); }
  }

  function setGaugeLabel(text) {
    if (dom.gaugeLabel) dom.gaugeLabel.textContent = text;
  }

  function setPhase(phase, label) {
    if (dom.phaseLabel) {
      const icons = {
        idle: 'fa-hourglass-start',
        ping: 'fa-satellite-dish',
        download: 'fa-download',
        upload: 'fa-upload',
        done: 'fa-check-circle',
        error: 'fa-exclamation-triangle',
        cancelled: 'fa-ban'
      };
      dom.phaseLabel.innerHTML = '<i class="fas ' + (icons[phase] || 'fa-hourglass-start') + '"></i> ' + label;
    }
    if (dom.gaugeLabel) {
      const gaugeLabels = {
        idle: 'Siap Mengukur',
        ping: 'Mengukur Latensi...',
        download: 'Mengukur Kecepatan...',
        upload: 'Mengukur Upload...',
        done: 'Selesai',
        error: 'Error',
        cancelled: 'Dibatalkan'
      };
      dom.gaugeLabel.textContent = gaugeLabels[phase] || label;
    }
  }

  function setProgress(pct) {
    const v = clamp(pct, 0, 100);
    if (dom.progressFill) dom.progressFill.style.width = v + '%';
    if (dom.progressPct) dom.progressPct.textContent = Math.round(v) + '%';
  }

  function setLiveStats(mbps, bytes) {
    if (dom.liveSpeed) dom.liveSpeed.textContent = safeNum(mbps, 2);
    if (dom.liveBytes) dom.liveBytes.textContent = formatBytes(bytes);
  }

  function updateButtons() {
    const running = state.running;
    if (dom.startBtn) {
      dom.startBtn.disabled = running;
      dom.startBtn.classList.toggle('hidden', running);
    }
    if (dom.stopBtn) dom.stopBtn.classList.toggle('hidden', !running);
    if (dom.retryBtn) dom.retryBtn.classList.toggle('hidden', running || !state.results);
  }

  function startTimer() {
    stopTimer();
    state.startTime = performance.now();
    state.timerInterval = setInterval(() => {
      const sec = (performance.now() - state.startTime) / 1000;
      if (dom.timer) dom.timer.textContent = formatTime(sec);
    }, 250);
  }

  function stopTimer() {
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  }

  function stopTick() {
    if (state.tickInterval) { clearInterval(state.tickInterval); state.tickInterval = null; }
  }

  /* ================================================================
     FULL TEST FLOW
     ================================================================ */
  async function runFullTest() {
    if (state.running) return;
    if (!navigator.onLine) {
      showToast('Anda sedang offline. Periksa koneksi internet.', 'error');
      return;
    }

    state.running = true;
    state.results = null;
    state.abortController = new AbortController();
    updateButtons();
    stopTick();
    resetResultsUI();
    startTimer();

    const result = {
      timestamp: Date.now(),
      download: 0, upload: 0,
      ping: 0, jitter: 0,
      pingMin: 0, pingMax: 0,
      dlPeak: 0, dlMin: 0, ulPeak: 0, ulMin: 0,
      connType: 'Unknown',
      device: detectPlatform()
    };

    try {
      // ============ PHASE 1: PING ============
      setPhase('ping', 'Mengukur latensi...');
      setProgress(5);
      const pingRes = await testPing(6, (p) => {
        const pct = 5 + (p.index / p.total) * 15;
        setProgress(pct);
        if (dom.pingVal) dom.pingVal.textContent = safeNum(p.rtt, 0);
        if (dom.liveSpeed) dom.liveSpeed.textContent = safeNum(p.rtt, 0);
        if (dom.liveBytes) dom.liveBytes.textContent = p.rtt.toFixed(0) + ' ms';
      });
      result.ping = pingRes.avg;
      result.jitter = pingRes.jitter;
      result.pingMin = pingRes.min;
      result.pingMax = pingRes.max;
      if (dom.pingVal) dom.pingVal.textContent = safeNum(pingRes.avg, 0);
      if (dom.pingSub) dom.pingSub.textContent = 'min ' + pingRes.min.toFixed(0) + ' / max ' + pingRes.max.toFixed(0) + ' ms';
      if (dom.jitterVal) dom.jitterVal.textContent = safeNum(pingRes.jitter, 1);
      if (dom.jitterSub) dom.jitterSub.textContent = pingRes.jitter < 10 ? 'Stabil ✓' : pingRes.jitter < 30 ? 'Cukup stabil' : 'Tidak stabil';
      setProgress(20);

      // ============ PHASE 2: DOWNLOAD ============
      setPhase('download', 'Mengukur kecepatan unduh...');
      updateGauge(0);
      const dlRes = await testDownload((p) => {
        const pct = 20 + (p.received / p.total) * 50;
        setProgress(pct);
        setLiveStats(p.mbps, p.received);
        updateGauge(p.mbps);
      });
      result.download = dlRes.avgMbps;
      result.dlPeak = dlRes.peak;
      result.dlMin = dlRes.min;
      if (dom.dlVal) dom.dlVal.textContent = safeNum(dlRes.avgMbps, 2);
      if (dom.dlSub) dom.dlSub.textContent = 'peak ' + safeNum(dlRes.peak, 2) + ' Mbps';
      updateGauge(dlRes.avgMbps);
      setProgress(70);

      // ============ PHASE 3: UPLOAD ============
      setPhase('upload', 'Mengukur kecepatan unggah...');
      const ulRes = await testUpload((p) => {
        const pct = 70 + (p.loaded / p.total) * 28;
        setProgress(pct);
        setLiveStats(p.mbps, p.loaded);
      });
      result.upload = ulRes.avgMbps;
      result.ulPeak = ulRes.peak;
      result.ulMin = ulRes.min;
      if (dom.ulVal) dom.ulVal.textContent = safeNum(ulRes.avgMbps, 2);
      if (dom.ulSub) dom.ulSub.textContent = 'peak ' + safeNum(ulRes.peak, 2) + ' Mbps';
      setProgress(100);

      // ============ DONE ============
      const connInfo = detectConnection();
      result.connType = connInfo.type;

      state.results = result;
      setPhase('done', 'Selesai');
      stopTimer();

      renderQuality(result);
      saveHistory(result);
      renderHistory();
      if (dom.exportCard) dom.exportCard.classList.remove('hidden');

      Activity.add('download', 'Test speed: ↓' + safeNum(result.download, 2) + ' / ↑' + safeNum(result.upload, 2) + ' Mbps');
      showToast('Test selesai! Kecepatan ' + safeNum(result.download, 2) + ' Mbps', 'success');
      updateButtons();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        setPhase('cancelled', 'Dibatalkan');
        showToast('Test dibatalkan', 'warning');
      } else {
        console.warn('[SpeedTest] test error:', err);
        setPhase('error', 'Gagal: ' + (err.message || 'Unknown error'));
        showToast('Test gagal: ' + (err.message || 'Unknown error'), 'error');
      }
    } finally {
      state.running = false;
      state.abortController = null;
      stopTimer();
      stopTick();
      updateButtons();
    }
  }

  function cancelTest() {
    if (!state.running) return;
    try {
      if (state.abortController) state.abortController.abort();
    } catch (_) {}
    state.running = false;
    stopTimer();
    stopTick();
    setPhase('cancelled', 'Dibatalkan');
    updateButtons();
    showToast('Test dihentikan', 'warning');
  }

  function resetResultsUI() {
    if (dom.dlVal) dom.dlVal.textContent = '0.00';
    if (dom.ulVal) dom.ulVal.textContent = '0.00';
    if (dom.pingVal) dom.pingVal.textContent = '0';
    if (dom.jitterVal) dom.jitterVal.textContent = '0.0';
    if (dom.dlSub) dom.dlSub.textContent = '—';
    if (dom.ulSub) dom.ulSub.textContent = '—';
    if (dom.pingSub) dom.pingSub.textContent = '—';
    if (dom.jitterSub) dom.jitterSub.textContent = '—';
    if (dom.liveSpeed) dom.liveSpeed.textContent = '0.00';
    if (dom.liveBytes) dom.liveBytes.textContent = '0 KB';
    if (dom.timer) dom.timer.textContent = '00:00';
    setProgress(0);
    updateGauge(0);
    if (dom.exportCard) dom.exportCard.classList.add('hidden');
    resetQualityUI();
  }

  function resetQualityUI() {
    if (dom.qualityBadge) {
      dom.qualityBadge.className = 'ts-quality-badge';
      dom.qualityBadge.innerHTML = '<i class="fas fa-signal"></i> <span id="tsQualityLabel">Belum Ada Hasil</span>';
    }
    if (dom.qualityDesc) dom.qualityDesc.textContent = 'Jalankan test untuk melihat kualitas koneksi dan rekomendasi aktivitas.';
    if (dom.recoGrid) dom.recoGrid.innerHTML = '';
  }

  /* ================================================================
     NETWORK QUALITY GRADING
     ================================================================ */
  function gradeDownload(mbps) {
    if (mbps < 1) return { label: '2G — Lambat', cls: 'grade-2g', desc: 'Koneksi sangat lambat. Hanya cocok untuk browsing teks ringan.' };
    if (mbps < 5) return { label: '3G — Cukup', cls: 'grade-3g', desc: 'Koneksi standar. Bisa streaming SD dan sosial media ringan.' };
    if (mbps < 30) return { label: '4G — Bagus', cls: 'grade-4g', desc: 'Koneksi bagus. Streaming HD lancar, video call stabil.' };
    if (mbps < 100) return { label: '4G+ — Sangat Bagus', cls: 'grade-4gplus', desc: 'Koneksi sangat bagus. Streaming Full HD lancar & gaming online nyaman.' };
    return { label: '5G — Excellent', cls: 'grade-5g', desc: 'Koneksi luar biasa! Streaming 4K & download file besar tanpa hambatan.' };
  }

  function renderQuality(result) {
    try {
      const grade = gradeDownload(result.download);
      if (dom.qualityBadge) {
        dom.qualityBadge.className = 'ts-quality-badge ' + grade.cls;
        dom.qualityBadge.innerHTML = '<i class="fas fa-signal"></i> <span id="tsQualityLabel">' + grade.label + '</span>';
      }
      if (dom.qualityDesc) dom.qualityDesc.textContent = grade.desc;

      const dl = result.download;
      const ping = result.ping;
      const recos = [
        { icon: 'fa-video', label: 'Video Call HD', ok: dl >= 3 && ping < 150 },
        { icon: 'fa-film', label: 'Streaming HD', ok: dl >= 5 },
        { icon: 'fa-tv', label: 'Streaming 4K', ok: dl >= 25 },
        { icon: 'fa-gamepad', label: 'Gaming Online', ok: dl >= 10 && ping < 80 && result.jitter < 30 },
        { icon: 'fa-cloud-download-alt', label: 'Download Besar', ok: dl >= 20 },
        { icon: 'fa-comments', label: 'Sosial Media', ok: dl >= 1 }
      ];

      if (dom.recoGrid) {
        dom.recoGrid.innerHTML = recos.map(r => `
          <div class="ts-reco-item ${r.ok ? 'yes' : 'no'}">
            <i class="fas ${r.ok ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            <span>${r.label}</span>
          </div>
        `).join('');
      }
    } catch (e) { console.warn('[SpeedTest] renderQuality:', e); }
  }

  /* ================================================================
     HISTORY
     ================================================================ */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.history = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.history)) state.history = [];
    } catch (_) { state.history = []; }
  }

  function saveHistory(result) {
    try {
      state.history.unshift(result);
      state.history = state.history.slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch (e) { console.warn('[SpeedTest] saveHistory:', e); }
  }

  function clearHistory() {
    try {
      state.history = [];
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      showToast('Riwayat berhasil dihapus', 'success');
    } catch (e) { console.warn('[SpeedTest] clearHistory:', e); }
  }

  function renderHistory() {
    if (!dom.historyList) return;
    if (!state.history.length) {
      dom.historyList.innerHTML = '<div class="ts-history-empty"><i class="fas fa-inbox"></i><p>Belum ada riwayat test. Mulai test pertama Anda!</p></div>';
      return;
    }
    dom.historyList.innerHTML = state.history.map((h, idx) => `
      <div class="ts-history-item" data-idx="${idx}">
        <div class="hi-top">
          <span class="hi-type">${h.connType || 'Unknown'}</span>
          <span class="hi-time">${formatDate(h.timestamp)}</span>
        </div>
        <div class="hi-speeds">
          <div class="hi-speed-block">
            <span class="hi-speed-label">Download</span>
            <span class="hi-speed-val dl">${safeNum(h.download, 1)} Mbps</span>
          </div>
          <div class="hi-speed-block">
            <span class="hi-speed-label">Upload</span>
            <span class="hi-speed-val ul">${safeNum(h.upload, 1)} Mbps</span>
          </div>
        </div>
        <div class="hi-ping"><i class="fas fa-satellite-dish"></i> Ping ${safeNum(h.ping, 0)} ms · Jitter ${safeNum(h.jitter, 1)} ms</div>
      </div>
    `).join('');

    $$('.ts-history-item', dom.historyList).forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-idx'));
        const h = state.history[idx];
        if (h) showHistoryDetail(h);
      });
    });
  }

  function showHistoryDetail(h) {
    alert(
      '📊 DETAIL TEST\n' +
      '─────────────────────\n' +
      '🕒 Waktu    : ' + formatDate(h.timestamp) + '\n' +
      '📶 Koneksi  : ' + (h.connType || 'Unknown') + '\n' +
      '⬇️ Download : ' + safeNum(h.download, 2) + ' Mbps\n' +
      '⬆️ Upload   : ' + safeNum(h.upload, 2) + ' Mbps\n' +
      '📡 Ping     : ' + safeNum(h.ping, 0) + ' ms\n' +
      '📉 Jitter   : ' + safeNum(h.jitter, 1) + ' ms'
    );
  }

  /* ================================================================
     EXPORT / SHARE
     ================================================================ */
  function buildResultText() {
    const r = state.results;
    if (!r) return '';
    const date = new Date(r.timestamp).toLocaleString('id-ID');
    return [
      '⚡ HASIL TEST SPEED INTERNET',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🕒 Waktu     : ' + date,
      '📶 Koneksi   : ' + (r.connType || 'Unknown'),
      '📱 Perangkat : ' + ((r.device?.os) || '—') + ' · ' + ((r.device?.browser) || '—'),
      '',
      '⬇️  Download : ' + safeNum(r.download, 2) + ' Mbps',
      '    (peak ' + safeNum(r.dlPeak, 2) + ' / min ' + safeNum(r.dlMin, 2) + ')',
      '⬆️  Upload   : ' + safeNum(r.upload, 2) + ' Mbps',
      '    (peak ' + safeNum(r.ulPeak, 2) + ' / min ' + safeNum(r.ulMin, 2) + ')',
      '📡 Ping      : ' + safeNum(r.ping, 0) + ' ms  (min ' + safeNum(r.pingMin, 0) + ' / max ' + safeNum(r.pingMax, 0) + ')',
      '📉 Jitter    : ' + safeNum(r.jitter, 1) + ' ms',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🌐 Tested via IRGXYMODS Speed Test',
      '🔗 ' + location.href
    ].join('\n');
  }

  async function shareResult() {
    const text = buildResultText();
    if (!text) { showToast('Belum ada hasil untuk dibagikan', 'warning'); return; }
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Hasil Test Speed Internet', text });
        showToast('Berhasil dibagikan', 'success');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast('Hasil disalin ke clipboard', 'success');
      } else {
        prompt('Salin hasil test:', text);
      }
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Gagal membagikan', 'error');
    }
  }

  async function copyResult() {
    const text = buildResultText();
    if (!text) { showToast('Belum ada hasil', 'warning'); return; }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast('Hasil disalin ke clipboard', 'success');
      } else {
        prompt('Salin hasil test:', text);
      }
    } catch (e) { showToast('Gagal menyalin', 'error'); }
  }

  function downloadFile(content, filename, mime) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (_) {} }, 100);
      showToast('File berhasil diunduh', 'success');
    } catch (e) { showToast('Gagal mengunduh file', 'error'); }
  }

  function downloadTxt() {
    const text = buildResultText();
    if (!text) { showToast('Belum ada hasil', 'warning'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(text, 'irgxymods-speedtest-' + ts + '.txt', 'text/plain;charset=utf-8');
  }

  function downloadJson() {
    if (!state.results) { showToast('Belum ada hasil', 'warning'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(JSON.stringify(state.results, null, 2), 'irgxymods-speedtest-' + ts + '.json', 'application/json');
  }

  /* ================================================================
     FAQ TOGGLE
     ================================================================ */
  function initFaq() {
    $$('.ts-faq-q').forEach(btn => {
      btn.addEventListener('click', function () {
        const item = this.closest('.ts-faq-item');
        if (!item) return;
        item.classList.toggle('open');
      });
    });
  }

  /* ================================================================
     EVENT BINDINGS
     ================================================================ */
  function bindEvents() {
    if (dom.startBtn) dom.startBtn.addEventListener('click', runFullTest);
    if (dom.stopBtn) dom.stopBtn.addEventListener('click', cancelTest);
    if (dom.retryBtn) dom.retryBtn.addEventListener('click', () => {
      resetResultsUI();
      runFullTest();
    });
    if (dom.clearHistoryBtn) dom.clearHistoryBtn.addEventListener('click', clearHistory);
    if (dom.shareBtn) dom.shareBtn.addEventListener('click', shareResult);
    if (dom.copyBtn) dom.copyBtn.addEventListener('click', copyResult);
    if (dom.downloadTxtBtn) dom.downloadTxtBtn.addEventListener('click', downloadTxt);
    if (dom.downloadJsonBtn) dom.downloadJsonBtn.addEventListener('click', downloadJson);

    // Listen untuk perubahan koneksi
    if (navigator.connection && typeof navigator.connection.addEventListener === 'function') {
      navigator.connection.addEventListener('change', renderConnectionInfo);
    }
    window.addEventListener('online', renderConnectionInfo);
    window.addEventListener('offline', renderConnectionInfo);
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    try {
      if (window.AOS && typeof AOS.init === 'function') {
        AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 });
      }
    } catch (e) { console.warn('[SpeedTest] AOS init failed:', e); }

    loadHistory();
    renderHistory();
    renderConnectionInfo();
    resetQualityUI();
    updateGauge(0);
    updateButtons();
    bindEvents();
    initFaq();

    console.log('✅ IRGXYMODS testspeed.js loaded');
  }

  // Expose untuk debugging / konsumsi eksternal
  window.SpeedTest = {
    run: runFullTest,
    cancel: cancelTest,
    getState: () => ({ ...state }),
    getHistory: () => [...state.history],
    clearHistory,
    SERVERS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();