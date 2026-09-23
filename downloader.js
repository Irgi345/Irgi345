/* ================================================================
   IRGXYMODS — DOWNLOADER.JS (v5.2)
   ================================================================
   Berisi 4 modul downloader independen:
   • initTikTokDownloader()    → halaman tiktok.html
   • initYouTubeDownloader()   → halaman youtube.html
   • initFacebookDownloader()  → halaman facebook.html
   • initThreadsDownloader()   → halaman threads.html

   CATATAN v5.2:
   • Modul Instagram DIPINDAHKAN ke instagram.js (standalone v6.0)
   • Halaman instagram.html sekarang hanya butuh: main.js + instagram.js
   • Semua modul self-guarded: bila elemen tidak ada di halaman, skip.
   ================================================================ */
(function () {
  'use strict';

  /* ---------- DEPENDENCY GUARD ---------- */
  if (!window.IRGXY) {
    console.error('[IRGXYMODS] downloader.js requires main.js to be loaded first!');
    return;
  }

  const { $, $$, safeFetch, fixUrl, showToast, Activity } = window.IRGXY;

  /* ================================================================
     TIKTOK DOWNLOADER — Multi-Source (v4.0)
     ================================================================ */
  (function initTikTokDownloader() {
    const input       = $('#tiktokUrlInput');
    const parseBtn    = $('#tiktokParseBtn');
    const btnText     = $('#tiktokParseBtnText');
    const pasteBtn    = $('#tiktokPasteBtn');
    const clearBtn    = $('#tiktokClearBtn');
    const statusEl    = $('#tiktokStatus');
    const statusIcon  = $('#tiktokStatusIcon');
    const statusText  = $('#tiktokStatusText');
    const resultCard  = $('#tiktokResultCard');
    const descToggle  = $('#tiktokDescToggle');
    const historyWrap = $('#tiktokHistory');
    const historyList = $('#tiktokHistoryList');
    const clearHistory= $('#tiktokClearHistory');

    if (!input || !parseBtn) return;

    let isLoading = false;
    let lastClickTime = 0;
    let currentData = null;
    let history = [];
    try { history = JSON.parse(localStorage.getItem('irgxy_tt_history') || '[]'); } catch { history = []; }

    /* ---- UTILS ---- */
    const fmtNum = (n) => {
      n = Number(n) || 0;
      if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    const fmtDate = (ts) => {
      if (!ts) return '—';
      const d = new Date(Number(ts) * 1000);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const isValidTikTokUrl = (url) => /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test((url || '').trim());
    const sanitizeUrl = (url) => (url || '').trim().replace(/\s+/g, '').replace(/[<>"'`]/g, '');

    const setStatus = (type, icon, text) => {
      if (!statusEl) return;
      statusEl.className = 'tiktok-status ' + type;
      if (statusIcon) statusIcon.innerHTML = icon;
      if (statusText) statusText.textContent = text;
    };
    const hideStatus = () => { if (statusEl) statusEl.className = 'tiktok-status'; };
    const setLoading = (state) => {
      isLoading = state;
      parseBtn.disabled = state;
      if (btnText) btnText.textContent = state ? 'Memproses...' : 'Download';
      const icon = parseBtn.querySelector('i');
      if (icon) icon.className = state ? 'tiktok-spinner' : 'fas fa-download';
    };

    const validateLive = () => {
      const v = sanitizeUrl(input.value);
      input.classList.remove('valid', 'invalid');
      if (!v) { if (clearBtn) clearBtn.style.display = 'none'; return; }
      if (clearBtn) clearBtn.style.display = 'flex';
      input.classList.toggle('valid', isValidTikTokUrl(v));
      input.classList.toggle('invalid', !isValidTikTokUrl(v));
    };

    /* ---- RENDER RESULT ---- */
    function renderResult(data) {
      currentData = data;
      const noWm  = data.noWatermark || '';
      const wm    = data.watermark || '';
      const audio = data.music || '';
      const thumb = data.cover || data.originCover || '';
      const isPhoto = !!(data.images && data.images.length);

      const thumbEl = $('#tiktokThumb');
      if (thumbEl) {
        thumbEl.src = thumb || '';
        thumbEl.onerror = function () {
          this.onerror = null;
          this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23222" width="100" height="100"/></svg>';
        };
      }
      $('#tiktokAuthorAvatar').textContent = (data.author || data.uniqueId || '?').charAt(0).toUpperCase();
      $('#tiktokAuthorName').textContent   = data.author || 'TikTok User';
      $('#tiktokAuthorHandle').textContent = '@' + (data.uniqueId || 'user');
      $('#tiktokDesc').textContent         = data.title || data.desc || 'Tanpa deskripsi';
      $('#tiktokDuration').textContent     = data.duration ? data.duration + 's' : '';
      $('#tiktokDate').textContent         = fmtDate(data.dateCreated);
      $('#tiktokSource').textContent       = 'via ' + (data.source || '—');
      $('#tiktokPlays').textContent        = fmtNum(data.playCount);
      $('#tiktokLikes').textContent        = fmtNum(data.diggCount);
      $('#tiktokComments').textContent     = fmtNum(data.commentCount);
      $('#tiktokShares').textContent       = fmtNum(data.shareCount);

      const typeBadge = $('#tiktokTypeBadge');
      if (typeBadge) {
        if (isPhoto) { typeBadge.textContent = '📸 Foto'; typeBadge.classList.add('visible'); }
        else typeBadge.classList.remove('visible');
      }

      const descEl = $('#tiktokDesc');
      if (descEl && descEl.textContent.length > 100 && descToggle) {
        descToggle.style.display = 'inline-block';
        descToggle.textContent = 'Selengkapnya';
        descToggle.onclick = () => {
          const expanded = descEl.classList.toggle('expanded');
          descToggle.textContent = expanded ? 'Sembunyikan' : 'Selengkapnya';
        };
      } else if (descToggle) {
        descToggle.style.display = 'none';
      }

      const dlNoWm   = $('#tiktokDownloadNoWm');
      const dlWm     = $('#tiktokDownloadWm');
      const dlAudio  = $('#tiktokDownloadAudio');
      const dlThumb  = $('#tiktokDownloadThumb');
      const dlPhotos = $('#tiktokDownloadAllPhotos');

      if (dlNoWm)  dlNoWm.href   = noWm  || '#';
      if (dlWm)    dlWm.href     = wm    || noWm || '#';
      if (dlAudio) dlAudio.href  = audio || '#';
      if (dlThumb) dlThumb.href  = thumb || '#';

      if (dlNoWm)  dlNoWm.style.display   = noWm  ? 'flex' : 'none';
      if (dlWm)    dlWm.style.display     = wm    ? 'flex' : 'none';
      if (dlAudio) dlAudio.style.display  = audio ? 'flex' : 'none';
      if (dlThumb) dlThumb.style.display  = thumb ? 'flex' : 'none';

      if (isPhoto && dlPhotos) {
        dlPhotos.style.display = 'flex';
        const lbl = $('#tiktokPhotosLabel');
        if (lbl) lbl.textContent = `Download Semua Foto (${data.images.length})`;
      } else if (dlPhotos) {
        dlPhotos.style.display = 'none';
      }

      resultCard?.classList.add('visible');
      setTimeout(() => resultCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    /* ---- HISTORY ---- */
    function saveHistory(data, originalUrl) {
      const item = {
        id: Date.now(),
        title: (data.title || 'Video TikTok').slice(0, 80),
        author: data.uniqueId || data.author || 'user',
        thumb: data.cover || data.originCover || '',
        url: originalUrl,
        ts: Date.now()
      };
      history = history.filter(h => h.url !== originalUrl);
      history.unshift(item);
      if (history.length > 8) history = history.slice(0, 8);
      try { localStorage.setItem('irgxy_tt_history', JSON.stringify(history)); } catch {}
      renderHistory();
    }

    function renderHistory() {
      if (!historyWrap || !historyList) return;
      if (!history.length) { historyWrap.style.display = 'none'; return; }
      historyWrap.style.display = 'block';
      historyList.innerHTML = history.map(h => `
        <div class="tiktok-history-item" data-url="${String(h.url).replace(/"/g, '&quot;')}">
          ${h.thumb ? `<img src="${h.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="h-info">
            <div class="h-title">${h.title}</div>
            <div class="h-sub">@${h.author}</div>
          </div>
        </div>`).join('');
      historyList.querySelectorAll('.tiktok-history-item').forEach(el => {
        el.addEventListener('click', () => {
          input.value = el.getAttribute('data-url') || '';
          validateLive();
          handleParse();
        });
      });
    }

    clearHistory?.addEventListener('click', () => {
      history = [];
      try { localStorage.removeItem('irgxy_tt_history'); } catch {}
      renderHistory();
      showToast('Riwayat berhasil dihapus', 'success');
    });

    /* ---- API SOURCES ---- */
    const SOURCES = [
      {
        name: 'TikWM',
        async fetch(url) {
          const fd = new FormData();
          fd.append('url', url);
          fd.append('hd', '1');
          const r = await safeFetch('https://www.tikwm.com/api/', { method: 'POST', body: fd }, 12000);
          const j = await r.json();
          if (j.code !== 0) throw new Error(j.msg || 'API error');
          return j;
        },
        map(j) {
          const d = j.data || {};
          const isPhoto = Array.isArray(d.images) && d.images.length > 0;
          return {
            author: d.author?.nickname || d.author?.unique_id || 'TikTok User',
            uniqueId: d.author?.unique_id || 'user',
            title: d.title || '',
            cover: fixUrl(d.cover || d.origin_cover || ''),
            originCover: fixUrl(d.origin_cover || ''),
            duration: d.duration || 0,
            playCount: d.play_count || 0,
            diggCount: d.digg_count || 0,
            commentCount: d.comment_count || 0,
            shareCount: d.share_count || 0,
            noWatermark: fixUrl(d.hdplay || d.play || ''),
            watermark: fixUrl(d.wmplay || ''),
            music: fixUrl(d.music || ''),
            images: isPhoto ? d.images.map(u => fixUrl(u)) : [],
            isPhoto,
            dateCreated: d.create_time || 0,
            source: 'TikWM'
          };
        }
      },
      {
        name: 'Tiklydown',
        async fetch(url) {
          const r = await safeFetch(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            {}, 12000
          );
          return r.json();
        },
        map(j) {
          const v = j.video || {};
          const m = j.music || {};
          const a = j.author || {};
          const s = j.stats || {};
          const imgs = Array.isArray(j.images) ? j.images.map(i => i.url || i).filter(Boolean) : [];
          const isPhoto = imgs.length > 0;
          return {
            author: a.name || a.nickname || 'TikTok User',
            uniqueId: a.unique_id || a.uniqueId || 'user',
            title: j.title || '',
            cover: v.cover || j.cover || '',
            originCover: v.cover || '',
            duration: v.duration || 0,
            playCount: s.playCount || 0,
            diggCount: s.diggCount || 0,
            commentCount: s.commentCount || 0,
            shareCount: s.shareCount || 0,
            noWatermark: v.noWatermark || v.playAddr || '',
            watermark: v.watermark || '',
            music: m.play_url || m.playUrl || '',
            images: imgs,
            isPhoto,
            dateCreated: j.created_at || 0,
            source: 'Tiklydown'
          };
        }
      },
      {
        name: 'Douyin.wtf',
        async fetch(url) {
          const r = await safeFetch(
            `https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=false`,
            {}, 12000
          );
          return r.json();
        },
        map(j) {
          const d = j.data || j;
          if (!d || !d.video_data && !d.aweme_detail) throw new Error('Data tidak ditemukan');
          const detail = d.aweme_detail || d.video_data || d;
          const video  = detail.video || {};
          const author = detail.author || {};
          const music  = detail.music || {};
          const stats  = detail.statistics || {};
          const isPhoto = Array.isArray(detail.images) && detail.images.length > 0;
          const getPlayUrl = (v) => {
            if (!v) return '';
            if (v.play_addr?.url_list) return v.play_addr.url_list[0] || '';
            if (Array.isArray(v.play_addr)) return v.play_addr[0] || '';
            if (v.play_addr?.uri) return v.play_addr.uri;
            return '';
          };
          return {
            author: author.nickname || 'TikTok User',
            uniqueId: author.unique_id || 'user',
            title: detail.desc || '',
            cover: video.origin_cover?.url_list?.[0] || video.cover?.url_list?.[0] || '',
            originCover: video.origin_cover?.url_list?.[0] || '',
            duration: video.duration || 0,
            playCount: stats.play_count || 0,
            diggCount: stats.digg_count || 0,
            commentCount: stats.comment_count || 0,
            shareCount: stats.share_count || 0,
            noWatermark: getPlayUrl(video) || getPlayUrl(video.download_addr) || '',
            watermark: getPlayUrl(video.download_addr) || '',
            music: music.play_url?.url_list?.[0] || '',
            images: isPhoto ? detail.images.map(img => img.url_list?.[0] || '').filter(Boolean) : [],
            isPhoto,
            dateCreated: detail.create_time || 0,
            source: 'Douyin.wtf'
          };
        }
      },
      {
        name: 'TikXedd',
        async fetch(url) {
          const r = await safeFetch(
            `https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`,
            {}, 10000
          );
          return r.json();
        },
        map(j) {
          const d = j.data || j;
          const isPhoto = Array.isArray(d.images) && d.images.length > 0;
          return {
            author: d.author || d.nickname || 'TikTok User',
            uniqueId: d.uniqueId || d.author || 'user',
            title: d.description || d.title || '',
            cover: d.cover || d.thumbnail || '',
            originCover: d.originCover || '',
            duration: d.meta?.duration || d.duration || 0,
            playCount: d.meta?.playCount || d.playCount || 0,
            diggCount: d.meta?.diggCount || d.diggCount || 0,
            commentCount: d.meta?.commentCount || d.commentCount || 0,
            shareCount: d.meta?.shareCount || d.shareCount || 0,
            noWatermark: d.download?.noWatermark || d.video || d.play || '',
            watermark: d.download?.watermark || d.wmplay || '',
            music: d.download?.music || d.music || '',
            images: isPhoto ? d.images : [],
            isPhoto,
            dateCreated: d.createTime || d.create_time || 0,
            source: 'TikXedd'
          };
        }
      },
      {
        name: 'TikTok OEmbed',
        async fetch(url) {
          const r = await safeFetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
            {}, 10000
          );
          return r.json();
        },
        map(j) {
          const thumb = j.thumbnail_url || '';
          return {
            author: j.author_name || 'TikTok User',
            uniqueId: (j.author_url || '').split('@').pop() || 'user',
            title: j.title || '',
            cover: thumb,
            originCover: thumb,
            duration: 0,
            playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0,
            noWatermark: '', watermark: '', music: '',
            images: [], isPhoto: false, dateCreated: 0,
            source: 'TikTok OEmbed'
          };
        }
      }
    ];

    /* ---- CORE PARSER ---- */
    async function parseTikTok(url) {
      let lastErr = null;
      for (const src of SOURCES) {
        try {
          setStatus('loading', '<span class="tiktok-spinner"></span>', `Memproses dengan ${src.name}...`);
          const raw = await src.fetch(url);
          const data = src.map(raw);
          const hasMedia = data.noWatermark || data.watermark || data.music || (data.images && data.images.length);
          if (!hasMedia) throw new Error('Tidak ada link download ditemukan');
          return { data, source: src.name };
        } catch (e) {
          lastErr = e;
          console.warn(`[TikTok] ${src.name} gagal:`, e.message);
        }
      }
      throw lastErr || new Error('Semua server gagal. Coba lagi nanti.');
    }

    /* ---- DOWNLOAD ALL PHOTOS (anchor-based) ---- */
    async function downloadAllPhotos(images) {
      if (!images || !images.length) return;

      const btn = $('#tiktokDownloadAllPhotos');
      const origLabel = btn?.querySelector('span')?.textContent || 'Download Semua Foto';

      showToast(`Memulai unduhan ${images.length} foto...`, 'info');
      if (btn) btn.disabled = true;

      let successCount = 0;
      for (let i = 0; i < images.length; i++) {
        setStatus('loading', '<span class="tiktok-spinner"></span>', `Menyiapkan foto ${i + 1}/${images.length}...`);
        try {
          const a = document.createElement('a');
          a.href = images[i];
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.download = `tiktok_photo_${Date.now()}_${i + 1}.jpg`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          successCount++;
          await new Promise(res => setTimeout(res, 600));
        } catch (err) {
          console.warn('Gagal proses foto ke-' + (i + 1), err);
          try { window.open(images[i], '_blank', 'noopener'); } catch {}
        }
      }

      setStatus('success', '✅', `${successCount} dari ${images.length} foto berhasil diproses!`);
      setTimeout(hideStatus, 5000);
      showToast(`Selesai! ${successCount}/${images.length} foto diunduh`, 'success');
      Activity.add('download', `Mengunduh ${successCount} foto TikTok`);

      if (btn) {
        btn.disabled = false;
        const span = btn.querySelector('span');
        if (span) span.textContent = origLabel;
      }
    }

    /* ---- MAIN HANDLER ---- */
    async function handleParse() {
      const now = Date.now();
      if (now - lastClickTime < 800) return;
      lastClickTime = now;
      if (isLoading) return;

      const url = sanitizeUrl(input.value);
      if (!url) {
        setStatus('error', '⚠️', 'Tempel link TikTok terlebih dahulu.');
        showToast('Tempel link TikTok terlebih dahulu', 'error');
        return;
      }
      if (!isValidTikTokUrl(url)) {
        setStatus('error', '❌', 'Link tidak valid. Pastikan dari tiktok.com / vm.tiktok.com / vt.tiktok.com');
        showToast('Link tidak valid', 'error');
        return;
      }

      resultCard?.classList.remove('visible');
      setLoading(true);
      setStatus('loading', '<span class="tiktok-spinner"></span>', 'Mengambil data video...');

      try {
        const { data, source } = await parseTikTok(url);
        renderResult(data);
        saveHistory(data, url);
        const isPhoto = data.isPhoto && data.images?.length;
        setStatus('success', '✅',
          `Berhasil via ${source}! ${isPhoto ? `${data.images.length} foto siap diunduh.` : 'Pilih format di bawah.'}`
        );
        Activity.add('download', `Mengunduh TikTok dari @${data.uniqueId || 'user'}`);
        showToast('Data berhasil diambil!', 'success');
        setTimeout(() => { if (statusEl?.classList.contains('success')) hideStatus(); }, 5000);
      } catch (e) {
        console.error('[TikTok] Semua source gagal:', e);
        const msg = (e && e.message) || '';
        let userMsg = 'Maaf, semua server sedang sibuk. Coba lagi dalam 1 menit atau gunakan link lain.';
        if (/private|deleted|not found|not available/i.test(msg)) {
          userMsg = 'Video tidak dapat diakses (mungkin private atau telah dihapus).';
        } else if (/region|geo/i.test(msg)) {
          userMsg = 'Video tidak tersedia di region Anda.';
        } else if (/timeout|abort/i.test(msg)) {
          userMsg = 'Koneksi timeout. Periksa jaringan Anda dan coba lagi.';
        }
        setStatus('error', '❌', userMsg);
        showToast('Gagal mengambil data. Coba lagi.', 'error');
      } finally {
        setLoading(false);
      }
    }

    /* ---- EVENTS ---- */
    parseBtn.addEventListener('click', handleParse);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); handleParse(); } });
    input.addEventListener('input', validateLive);
    input.addEventListener('paste', () => setTimeout(() => { input.value = input.value.trim(); validateLive(); }, 30));

    pasteBtn?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        input.value = txt.trim();
        validateLive();
        if (isValidTikTokUrl(input.value)) handleParse();
        else showToast('Clipboard bukan link TikTok', 'warning');
      } catch { showToast('Gagal paste dari clipboard', 'error'); }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.classList.remove('valid', 'invalid');
      clearBtn.style.display = 'none';
      resultCard?.classList.remove('visible');
      hideStatus();
      input.focus();
    });

    $('#tiktokDownloadAllPhotos')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentData?.images?.length) downloadAllPhotos(currentData.images);
      else showToast('Tidak ada foto untuk diunduh', 'warning');
    });

    $('#tiktokCopyLinkBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk disalin', 'warning'); return; }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link berhasil disalin!', 'success');
        Activity.add('copy_link', 'Menyalin link TikTok');
      } catch { prompt('Salin link:', url); }
    });

    $('#tiktokShareBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk dibagikan', 'warning'); return; }
      const title = currentData ? `TikTok @${currentData.uniqueId}` : 'TikTok Video';
      if (navigator.share) {
        try {
          await navigator.share({ title, text: 'Download TikTok via IRGXYMODS', url });
          Activity.add('share', 'Membagikan link TikTok');
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link disalin ke clipboard', 'success');
        } catch { prompt('Salin link:', url); }
      }
    });

    ['tiktokDownloadNoWm', 'tiktokDownloadWm', 'tiktokDownloadAudio', 'tiktokDownloadThumb'].forEach(id => {
      $('#' + id)?.addEventListener('click', () => {
        if (currentData) {
          const type = id.replace('tiktokDownload', '').toLowerCase();
          Activity.add('download', `Mengunduh ${type} TikTok dari @${currentData.uniqueId}`);
        }
      });
    });

    $$('.tiktok-faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.tiktok-faq-item');
        if (!item) return;
        const wasOpen = item.classList.contains('open');
        $$('.tiktok-faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    renderHistory();
    validateLive();
    console.log('✅ TikTok downloader siap (5-source CORS-safe, anchor-download)');
  })();

  /* ================================================================
     YOUTUBE DOWNLOADER — Piped / Invidious / Cobalt
     ================================================================ */
  (function initYouTubeDownloader() {
    const input = $('#ytUrlInput');
    if (!input) return;

    const parseBtn    = $('#ytParseBtn');
    const btnText     = $('#ytParseBtnText');
    const pasteBtn    = $('#ytPasteBtn');
    const clearBtn    = $('#ytClearBtn');
    const statusEl    = $('#ytStatus');
    const statusIcon  = $('#ytStatusIcon');
    const statusText  = $('#ytStatusText');
    const resultCard  = $('#ytResultCard');
    const descToggle  = $('#ytDescToggle');
    const historyWrap = $('#ytHistory');
    const historyList = $('#ytHistoryList');
    const clearHistory= $('#ytClearHistory');
    const qualityGrid = $('#ytQualityGrid');
    const audioGrid   = $('#ytAudioGrid');

    if (!parseBtn) return;

    let isLoading = false;
    let lastClickTime = 0;
    let currentData = null;
    let history = [];
    try { history = JSON.parse(localStorage.getItem('irgxy_yt_history') || '[]'); } catch { history = []; }

    const fmtNum = (n) => {
      n = Number(n) || 0;
      if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    const fmtDuration = (s) => {
      s = Number(s) || 0;
      if (!s) return '';
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      return `${m}:${String(sec).padStart(2, '0')}`;
    };
    const sanitizeUrl = (url) => (url || '').trim().replace(/\s+/g, '').replace(/[<>"'`]/g, '');

    const extractVideoId = (url) => {
      if (!url) return null;
      const s = String(url).trim();
      const patterns = [
        /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
        /^([A-Za-z0-9_-]{11})$/
      ];
      for (const p of patterns) {
        const m = s.match(p);
        if (m && m[1]) return m[1];
      }
      return null;
    };

    const isValidYouTubeUrl = (url) => {
      const s = sanitizeUrl(url);
      if (!/^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(s)) return false;
      return !!extractVideoId(s);
    };

    const setStatus = (type, icon, text) => {
      if (!statusEl) return;
      statusEl.className = 'yt-status ' + type;
      if (statusIcon) statusIcon.innerHTML = icon;
      if (statusText) statusText.textContent = text;
    };
    const hideStatus = () => { if (statusEl) statusEl.className = 'yt-status'; };
    const setLoading = (state) => {
      isLoading = state;
      parseBtn.disabled = state;
      if (btnText) btnText.textContent = state ? 'Memproses...' : 'Download';
      const icon = parseBtn.querySelector('i');
      if (icon) icon.className = state ? 'yt-spinner' : 'fas fa-download';
    };

    const validateLive = () => {
      const v = sanitizeUrl(input.value);
      input.classList.remove('valid', 'invalid');
      if (!v) { if (clearBtn) clearBtn.style.display = 'none'; return; }
      if (clearBtn) clearBtn.style.display = 'flex';
      input.classList.toggle('valid', isValidYouTubeUrl(v));
      input.classList.toggle('invalid', !isValidYouTubeUrl(v));
    };

    function triggerDownload(url, filename) {
      if (!url) { showToast('Link tidak tersedia', 'warning'); return false; }
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (filename) a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch (e) {
        try { window.open(url, '_blank', 'noopener'); return true; }
        catch { return false; }
      }
    }

    const QUALITY_ORDER = ['240p', '360p', '480p', '720p', '1080p', '1080p60'];
    const QUALITY_LABELS = {
      '240p':   { icon: 'fa-video', label: '240p SD' },
      '360p':   { icon: 'fa-video', label: '360p SD' },
      '480p':   { icon: 'fa-video', label: '480p HQ' },
      '720p':   { icon: 'fa-video', label: '720p HD' },
      '1080p':  { icon: 'fa-video', label: '1080p FHD' },
      '1080p60':{ icon: 'fa-bolt',  label: '1080p60 HD' }
    };

    function renderQualityButtons(qualities) {
      if (!qualityGrid) return;
      qualityGrid.innerHTML = '';
      let rendered = 0;
      QUALITY_ORDER.forEach(q => {
        const url = qualities && qualities[q];
        if (!url) return;
        rendered++;
        const meta = QUALITY_LABELS[q] || { icon: 'fa-video', label: q };
        const a = document.createElement('a');
        a.className = 'yt-dl-btn';
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-quality', q);
        a.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.label}`;
        qualityGrid.appendChild(a);
      });
      if (rendered === 0) {
        qualityGrid.innerHTML = '<div class="yt-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-exclamation-triangle"></i> Kualitas video tidak tersedia dari sumber ini</div>';
      }
    }

    function renderAudioButtons(audio, videoId) {
      if (!audioGrid) return;
      audioGrid.innerHTML = '';
      const a128 = audio && (audio['128'] || audio['low']);
      const a320 = audio && (audio['320'] || audio['high']);

      const fallbackMp3 = `https://www.y2mate.com/youtube-mp3/${encodeURIComponent(videoId || '')}`;

      const btn128 = document.createElement('a');
      btn128.className = 'yt-dl-btn audio-128';
      btn128.href = a128 || fallbackMp3;
      btn128.target = '_blank';
      btn128.rel = 'noopener noreferrer';
      btn128.innerHTML = `<i class="fas fa-music"></i> Audio 128 kbps`;
      audioGrid.appendChild(btn128);

      const btn320 = document.createElement('a');
      btn320.className = 'yt-dl-btn audio-320';
      btn320.href = a320 || a128 || fallbackMp3;
      btn320.target = '_blank';
      btn320.rel = 'noopener noreferrer';
      btn320.innerHTML = `<i class="fas fa-music"></i> Audio 320 kbps`;
      audioGrid.appendChild(btn320);
    }

    function renderResult(data) {
      currentData = data;

      const thumbEl = $('#ytThumb');
      if (thumbEl) {
        thumbEl.src = data.thumb || '';
        thumbEl.onerror = function () {
          this.onerror = null;
          this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="%23111" width="320" height="180"/><text fill="%23444" x="160" y="95" text-anchor="middle" font-size="16">No Thumbnail</text></svg>';
        };
      }
      $('#ytAuthorAvatar').innerHTML = '<i class="fab fa-youtube"></i>';
      $('#ytAuthorName').textContent = data.author || 'YouTube Channel';
      $('#ytAuthorHandle').textContent = '@' + (data.author || 'channel').toLowerCase().replace(/\s+/g, '');
      $('#ytDesc').textContent = data.title || 'Tanpa judul';
      $('#ytDuration').textContent = fmtDuration(data.duration);
      $('#ytDate').textContent = data.date || '—';
      $('#ytSource').textContent = 'via ' + (data.source || '—');
      $('#ytViews').textContent = fmtNum(data.views);
      $('#ytLikes').textContent = fmtNum(data.likes);
      $('#ytComments').textContent = fmtNum(data.comments);

      const typeBadge = $('#ytTypeBadge');
      if (typeBadge) {
        if (data.isShorts) { typeBadge.textContent = 'SHORTS'; typeBadge.classList.add('visible'); }
        else if (data.isLive) { typeBadge.textContent = 'LIVE'; typeBadge.classList.add('visible'); }
        else typeBadge.classList.remove('visible');
      }

      const descEl = $('#ytDesc');
      if (descEl && (data.title || '').length > 90 && descToggle) {
        descToggle.style.display = 'inline-block';
        descToggle.textContent = 'Selengkapnya';
        descToggle.onclick = () => {
          const expanded = descEl.classList.toggle('expanded');
          descToggle.textContent = expanded ? 'Sembunyikan' : 'Selengkapnya';
        };
      } else if (descToggle) {
        descToggle.style.display = 'none';
      }

      renderQualityButtons(data.qualities || {});
      renderAudioButtons(data.audio || {}, data.videoId || '');

      resultCard?.classList.add('visible');
      setTimeout(() => resultCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    function saveHistory(data, originalUrl) {
      const item = {
        id: Date.now(),
        title: (data.title || 'YouTube Video').slice(0, 100),
        author: data.author || 'YouTube',
        thumb: data.thumb || '',
        url: originalUrl,
        ts: Date.now()
      };
      history = history.filter(h => h.url !== originalUrl);
      history.unshift(item);
      if (history.length > 8) history = history.slice(0, 8);
      try { localStorage.setItem('irgxy_yt_history', JSON.stringify(history)); } catch {}
      renderHistory();
    }

    function renderHistory() {
      if (!historyWrap || !historyList) return;
      if (!history.length) { historyWrap.style.display = 'none'; return; }
      historyWrap.style.display = 'block';
      historyList.innerHTML = history.map(h => `
        <div class="yt-history-item" data-url="${String(h.url).replace(/"/g, '&quot;')}">
          ${h.thumb ? `<img src="${h.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="h-info">
            <div class="h-title">${h.title}</div>
            <div class="h-sub">${h.author}</div>
          </div>
        </div>`).join('');
      historyList.querySelectorAll('.yt-history-item').forEach(el => {
        el.addEventListener('click', () => {
          input.value = el.getAttribute('data-url') || '';
          validateLive();
          handleParse();
        });
      });
    }

    clearHistory?.addEventListener('click', () => {
      history = [];
      try { localStorage.removeItem('irgxy_yt_history'); } catch {}
      renderHistory();
      showToast('Riwayat berhasil dihapus', 'success');
    });

    const YT_SOURCES = [
      {
        name: 'Piped',
        async fetch(id) {
          const instances = [
            'https://pipedapi.kavin.rocks',
            'https://pipedapi.adminforge.de',
            'https://api.piped.yt'
          ];
          let lastErr = null;
          for (const base of instances) {
            try {
              const r = await safeFetch(`${base}/streams/${id}`, {}, 12000);
              const j = await r.json();
              if (j && j.title) return j;
            } catch (e) { lastErr = e; console.warn('[YT Piped] ' + base + ' gagal:', e.message); }
          }
          throw lastErr || new Error('Piped gagal semua instance');
        },
        map(j, id) {
          const qualities = {};
          const audio = {};

          (j.videoStreams || []).forEach(s => {
            if (!s.url) return;
            const h = s.height || parseInt(s.quality) || 0;
            const fps = s.fps || 30;
            let key = null;
            if (h >= 1080 && fps >= 50) key = '1080p60';
            else if (h >= 1080) key = '1080p';
            else if (h >= 720) key = '720p';
            else if (h >= 480) key = '480p';
            else if (h >= 360) key = '360p';
            else if (h >= 240) key = '240p';
            if (key && !qualities[key]) qualities[key] = s.url;
          });

          (j.audioStreams || []).forEach(s => {
            if (!s.url) return;
            const br = s.bitrate || 128000;
            const kbps = Math.round(br / 1000);
            if (kbps >= 200) audio['320'] = audio['320'] || s.url;
            else audio['128'] = audio['128'] || s.url;
          });

          return {
            title: j.title || 'YouTube Video',
            author: j.uploader || 'YouTube',
            thumb: j.thumbnailUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: j.duration || 0,
            views: j.views || 0,
            likes: j.likes || 0,
            comments: 0,
            date: j.uploadDate || '',
            videoId: id,
            isShorts: false,
            isLive: !!j.livestream,
            qualities,
            audio,
            source: 'Piped'
          };
        }
      },
      {
        name: 'Invidious',
        async fetch(id) {
          const instances = [
            'https://inv.nadeko.net',
            'https://yewtu.be',
            'https://invidious.nerdvpn.de',
            'https://invidious.f5.si'
          ];
          let lastErr = null;
          for (const base of instances) {
            try {
              const r = await safeFetch(`${base}/api/v1/videos/${id}`, {}, 12000);
              const j = await r.json();
              if (j && j.title && !j.error) return j;
            } catch (e) { lastErr = e; console.warn('[YT Invidious] ' + base + ' gagal:', e.message); }
          }
          throw lastErr || new Error('Invidious gagal semua instance');
        },
        map(j, id) {
          const qualities = {};
          const audio = {};

          const allFormats = [...(j.formatStreams || []), ...(j.adaptiveFormats || [])];

          allFormats.forEach(f => {
            if (!f.url) return;

            if (f.type && f.type.startsWith('audio')) {
              const rawBr = parseInt(f.bitrate) || 0;
              const kbps = rawBr > 1000 ? Math.round(rawBr / 1000) : rawBr;
              if (kbps >= 200) audio['320'] = audio['320'] || f.url;
              else audio['128'] = audio['128'] || f.url;
              return;
            }

            const label = f.qualityLabel || '';
            const m = label.match(/(\d{3,4})p(\d{2})?/);
            if (!m) return;
            const h = parseInt(m[1]);
            const fps = m[2] ? parseInt(m[2]) : 30;
            let key = null;
            if (h >= 1080 && fps >= 50) key = '1080p60';
            else if (h >= 1080) key = '1080p';
            else if (h >= 720) key = '720p';
            else if (h >= 480) key = '480p';
            else if (h >= 360) key = '360p';
            else if (h >= 240) key = '240p';
            if (key && !qualities[key]) qualities[key] = f.url;
          });

          const thumb = (j.videoThumbnails || []).find(t => t.quality === 'maxresdefault')?.url
            || (j.videoThumbnails || []).find(t => t.quality === 'high')?.url
            || (j.videoThumbnails || [])[0]?.url
            || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

          return {
            title: j.title || 'YouTube Video',
            author: j.author || 'YouTube',
            thumb,
            duration: j.lengthSeconds || 0,
            views: j.viewCount || 0,
            likes: j.likeCount || 0,
            comments: 0,
            date: j.publishedText || '',
            videoId: id,
            isShorts: false,
            isLive: !!j.liveNow,
            qualities,
            audio,
            source: 'Invidious'
          };
        }
      },
      {
        name: 'Cobalt',
        async fetch(id) {
          const instances = [
            'https://api.cobalt.tools',
            'https://co.wuk.sh'
          ];
          let lastErr = null;
          for (const base of instances) {
            try {
              const r = await safeFetch(`${base}/api/json`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  url: `https://www.youtube.com/watch?v=${id}`,
                  vQuality: '1080',
                  isAudioOnly: false,
                  disableMetadata: false
                })
              }, 12000);
              const j = await r.json();
              if (j && (j.url || j.picker)) return j;
            } catch (e) { lastErr = e; console.warn('[YT Cobalt] ' + base + ' gagal:', e.message); }
          }
          throw lastErr || new Error('Cobalt gagal semua instance');
        },
        map(j, id) {
          let url = '';
          if (j.url) url = j.url;
          else if (j.picker && Array.isArray(j.picker) && j.picker[0]?.url) url = j.picker[0].url;
          if (!url) throw new Error('Cobalt tidak memberikan URL');

          const qualities = { '1080p': url };
          return {
            title: 'YouTube Video',
            author: 'YouTube',
            thumb: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
            duration: 0,
            views: 0,
            likes: 0,
            comments: 0,
            date: '',
            videoId: id,
            isShorts: false,
            isLive: false,
            qualities,
            audio: {},
            source: 'Cobalt'
          };
        }
      }
    ];

    async function parseYouTube(videoId) {
      let lastErr = null;
      for (const src of YT_SOURCES) {
        try {
          setStatus('loading', '<span class="yt-spinner"></span>', `Memproses dengan ${src.name}...`);
          const raw = await src.fetch(videoId);
          const data = src.map(raw, videoId);
          const hasMedia = Object.keys(data.qualities || {}).length > 0
            || Object.keys(data.audio || {}).length > 0;
          if (!hasMedia) throw new Error('Tidak ada stream yang tersedia');
          return { data, source: src.name };
        } catch (e) {
          lastErr = e;
          console.warn(`[YT] ${src.name} gagal:`, e.message);
        }
      }
      throw lastErr || new Error('Semua server gagal. Coba lagi nanti.');
    }

    async function handleParse() {
      const now = Date.now();
      if (now - lastClickTime < 800) return;
      lastClickTime = now;
      if (isLoading) return;

      const url = sanitizeUrl(input.value);
      if (!url) {
        setStatus('error', '⚠️', 'Tempel link YouTube terlebih dahulu.');
        showToast('Tempel link YouTube terlebih dahulu', 'error');
        return;
      }
      if (!isValidYouTubeUrl(url)) {
        setStatus('error', '❌', 'Link tidak valid. Pastikan dari youtube.com / youtu.be / shorts.');
        showToast('Link tidak valid', 'error');
        return;
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        setStatus('error', '❌', 'Video ID tidak ditemukan di link tersebut.');
        showToast('Video ID tidak ditemukan', 'error');
        return;
      }

      resultCard?.classList.remove('visible');
      setLoading(true);
      setStatus('loading', '<span class="yt-spinner"></span>', 'Mengambil data video...');

      try {
        const { data, source } = await parseYouTube(videoId);
        renderResult(data);
        saveHistory(data, url);

        const qCount = Object.keys(data.qualities || {}).length;
        setStatus('success', '✅',
          `Berhasil via ${source}! ${qCount} kualitas tersedia. Pilih di bawah.`
        );
        Activity.add('download', `Mengunduh YouTube: ${data.title.slice(0, 40)}`);
        showToast('Data berhasil diambil!', 'success');
        setTimeout(() => { if (statusEl?.classList.contains('success')) hideStatus(); }, 5000);
      } catch (e) {
        console.error('[YT] Semua source gagal:', e);
        const msg = (e && e.message) || '';
        let userMsg = 'Maaf, semua server sedang sibuk. Coba lagi dalam 1 menit atau gunakan link lain.';
        if (/private|deleted|not found|not available|unavailable/i.test(msg)) {
          userMsg = 'Video tidak dapat diakses (mungkin private atau telah dihapus).';
        } else if (/region|geo|blocked/i.test(msg)) {
          userMsg = 'Video tidak tersedia di region Anda.';
        } else if (/timeout|abort/i.test(msg)) {
          userMsg = 'Koneksi timeout. Periksa jaringan Anda dan coba lagi.';
        } else if (/age|sign in|login/i.test(msg)) {
          userMsg = 'Video memerlukan verifikasi usia atau login.';
        }
        setStatus('error', '❌', userMsg);
        showToast('Gagal mengambil data. Coba lagi.', 'error');
      } finally {
        setLoading(false);
      }
    }

    parseBtn.addEventListener('click', handleParse);
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleParse(); }
    });
    input.addEventListener('input', validateLive);
    input.addEventListener('paste', () => setTimeout(() => {
      input.value = input.value.trim();
      validateLive();
    }, 30));

    pasteBtn?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        input.value = txt.trim();
        validateLive();
        if (isValidYouTubeUrl(input.value)) handleParse();
        else showToast('Clipboard bukan link YouTube', 'warning');
      } catch { showToast('Gagal paste dari clipboard', 'error'); }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.classList.remove('valid', 'invalid');
      clearBtn.style.display = 'none';
      resultCard?.classList.remove('visible');
      hideStatus();
      input.focus();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.yt-dl-btn');
      if (!btn) return;
      const url = btn.getAttribute('href') || btn.href;
      if (!url || url === '#') return;

      const quality = btn.getAttribute('data-quality');
      const isAudio = btn.classList.contains('audio-128') || btn.classList.contains('audio-320');
      if (isAudio) {
        Activity.add('download', 'Mengunduh audio MP3 YouTube');
      } else if (quality) {
        Activity.add('download', 'Mengunduh YouTube ' + quality);
      }

      if (currentData) {
        const safeTitle = (currentData.title || 'youtube').replace(/[^\w\s-]/g, '').slice(0, 50).trim().replace(/\s+/g, '_');
        const ext = isAudio ? 'mp3' : 'mp4';
        const fname = `${safeTitle || 'youtube'}_${quality || 'audio'}.${ext}`;
        btn.setAttribute('download', fname);
      }
    });

    $('#ytCopyLinkBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk disalin', 'warning'); return; }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link berhasil disalin!', 'success');
        Activity.add('copy_link', 'Menyalin link YouTube');
      } catch { prompt('Salin link:', url); }
    });

    $('#ytShareBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk dibagikan', 'warning'); return; }
      const title = currentData ? `YouTube: ${currentData.title.slice(0, 60)}` : 'YouTube Video';
      if (navigator.share) {
        try {
          await navigator.share({ title, text: 'Download YouTube via IRGXYMODS', url });
          Activity.add('share', 'Membagikan link YouTube');
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link disalin ke clipboard', 'success');
        } catch { prompt('Salin link:', url); }
      }
    });

    $('#ytDownloadThumbBtn')?.addEventListener('click', () => {
      if (!currentData || !currentData.thumb) {
        showToast('Thumbnail tidak tersedia', 'warning');
        return;
      }
      const safeTitle = (currentData.title || 'youtube').replace(/[^\w\s-]/g, '').slice(0, 40).trim().replace(/\s+/g, '_');
      triggerDownload(currentData.thumb, `${safeTitle || 'youtube'}_thumb.jpg`);
      showToast('Thumbnail sedang diunduh', 'success');
      Activity.add('download', 'Mengunduh thumbnail YouTube');
    });

    $$('.yt-faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.yt-faq-item');
        if (!item) return;
        const wasOpen = item.classList.contains('open');
        $$('.yt-faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    renderHistory();
    validateLive();
    console.log('✅ YouTube downloader siap (Piped / Invidious / Cobalt • 6 kualitas + audio)');
  })();

  /* ================================================================
     FACEBOOK DOWNLOADER — 5 Sumber (v5.0)
     ================================================================ */
  (function initFacebookDownloader() {
    const input = $('#fbUrlInput');
    if (!input) return;

    const parseBtn    = $('#fbParseBtn');
    const btnText     = $('#fbParseBtnText');
    const pasteBtn    = $('#fbPasteBtn');
    const clearBtn    = $('#fbClearBtn');
    const statusEl    = $('#fbStatus');
    const statusIcon  = $('#fbStatusIcon');
    const statusText  = $('#fbStatusText');
    const resultCard  = $('#fbResultCard');
    const descToggle  = $('#fbDescToggle');
    const historyWrap = $('#fbHistory');
    const historyList = $('#fbHistoryList');
    const clearHistory= $('#fbClearHistory');
    const qualityGrid = $('#fbQualityGrid');
    const audioGrid   = $('#fbAudioGrid');
    const photosGrid  = $('#fbPhotosGrid');
    const photosSec   = $('#fbPhotosSection');

    if (!parseBtn) return;

    let isLoading = false;
    let lastClickTime = 0;
    let currentData = null;
    let history = [];
    try { history = JSON.parse(localStorage.getItem('irgxy_fb_history') || '[]'); } catch { history = []; }

    const fmtNum = (n) => {
      n = Number(n) || 0;
      if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    const fmtDate = (ts) => {
      if (!ts) return '—';
      const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const sanitizeUrl = (url) => (url || '').trim().replace(/\s+/g, '').replace(/[<>"'`]/g, '');
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const isValidFacebookUrl = (url) => {
      const s = sanitizeUrl(url);
      return /^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch|fb\.me)\//i.test(s);
    };

    const setStatus = (type, icon, text) => {
      if (!statusEl) return;
      statusEl.className = 'fb-status ' + type;
      if (statusIcon) statusIcon.innerHTML = icon;
      if (statusText) statusText.textContent = text;
    };
    const hideStatus = () => { if (statusEl) statusEl.className = 'fb-status'; };
    const setLoading = (state) => {
      isLoading = state;
      parseBtn.disabled = state;
      if (btnText) btnText.textContent = state ? 'Memproses...' : 'Download';
      const icon = parseBtn.querySelector('i');
      if (icon) icon.className = state ? 'fb-spinner' : 'fas fa-download';
    };

    const validateLive = () => {
      const v = sanitizeUrl(input.value);
      input.classList.remove('valid', 'invalid');
      if (!v) { if (clearBtn) clearBtn.style.display = 'none'; return; }
      if (clearBtn) clearBtn.style.display = 'flex';
      input.classList.toggle('valid', isValidFacebookUrl(v));
      input.classList.toggle('invalid', !isValidFacebookUrl(v));
    };

    function triggerDownload(url, filename) {
      if (!url) { showToast('Link tidak tersedia', 'warning'); return false; }
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (filename) a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch (e) {
        try { window.open(url, '_blank', 'noopener'); return true; }
        catch { return false; }
      }
    }

    const QUALITY_ORDER = ['360p', '720p', '1080p'];
    const QUALITY_LABELS = {
      '360p':  { icon: 'fa-video', label: '360p SD' },
      '720p':  { icon: 'fa-video', label: '720p HD' },
      '1080p': { icon: 'fa-video', label: '1080p FHD' }
    };

    function renderQualityButtons(qualities) {
      if (!qualityGrid) return;
      qualityGrid.innerHTML = '';
      let rendered = 0;

      const validKeys = Object.keys(qualities || {})
        .filter(k => /^https?:\/\//i.test(qualities[k] || ''));

      if (validKeys.length === 0) {
        qualityGrid.innerHTML = '<div class="fb-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-info-circle"></i> Video tidak tersedia untuk postingan ini</div>';
        return;
      }
      if (validKeys.length === 1) {
        const only = qualities[validKeys[0]];
        qualities = { '360p': only, '720p': only, '1080p': only };
        console.log('[FB] Hanya 1 kualitas tersedia → duplikasi ke 360p/720p/1080p');
      } else if (validKeys.length === 2) {
        if (!qualities['360p']) qualities['360p'] = qualities[validKeys[0]];
        if (!qualities['1080p']) qualities['1080p'] = qualities[validKeys[validKeys.length - 1]];
        if (!qualities['720p']) qualities['720p'] = qualities[validKeys[0]];
      }

      QUALITY_ORDER.forEach(q => {
        const url = qualities && qualities[q];
        if (!url || !/^https?:\/\//i.test(url)) return;
        rendered++;
        const meta = QUALITY_LABELS[q];
        const a = document.createElement('a');
        a.className = 'fb-dl-btn' + (q === '1080p' ? ' hd-highlight' : '');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-quality', q);
        a.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.label}`;
        qualityGrid.appendChild(a);
      });

      if (rendered === 0) {
        qualityGrid.innerHTML = '<div class="fb-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-info-circle"></i> Video tidak tersedia untuk postingan ini</div>';
      }
    }

    function renderPhotos(images) {
      if (!photosGrid || !photosSec) return;
      if (!images || !images.length) {
        photosSec.style.display = 'none';
        photosGrid.innerHTML = '';
        return;
      }
      photosSec.style.display = 'block';
      photosGrid.innerHTML = images.map((url, i) => `
        <div class="fb-photo-item" data-src="${esc(url)}" data-index="${i + 1}">
          <img src="${esc(url)}" alt="Foto ${i + 1}" loading="lazy"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23222%22 width=%22100%22 height=%22100%22/></svg>';" />
          <span class="photo-num">${i + 1}/${images.length}</span>
          <span class="photo-dl-icon"><i class="fas fa-download"></i></span>
        </div>
      `).join('');

      photosGrid.querySelectorAll('.fb-photo-item').forEach(el => {
        el.addEventListener('click', () => {
          const src = el.getAttribute('data-src');
          const idx = el.getAttribute('data-index');
          if (!src) return;
          triggerDownload(src, `fb_photo_${Date.now()}_${idx}.jpg`);
          showToast(`Foto ${idx} sedang diunduh`, 'success');
          Activity.add('download', `Mengunduh foto Facebook #${idx}`);
        });
      });
    }

    function renderAudioButtons(audio) {
      if (!audioGrid) return;
      audioGrid.innerHTML = '';
      const a128 = audio && (audio['128'] || audio['low']);
      const a320 = audio && (audio['320'] || audio['high']);

      if (a128 && /^https?:\/\//i.test(a128)) {
        const b = document.createElement('a');
        b.className = 'fb-dl-btn audio-128';
        b.href = a128;
        b.target = '_blank';
        b.rel = 'noopener noreferrer';
        b.setAttribute('download', `fb_audio_128_${Date.now()}.mp3`);
        b.innerHTML = '<i class="fas fa-music"></i> Audio 128 kbps';
        audioGrid.appendChild(b);
      }
      if ((a320 || a128) && /^https?:\/\//i.test(a320 || a128)) {
        const b = document.createElement('a');
        b.className = 'fb-dl-btn audio-320';
        b.href = a320 || a128;
        b.target = '_blank';
        b.rel = 'noopener noreferrer';
        b.setAttribute('download', `fb_audio_320_${Date.now()}.mp3`);
        b.innerHTML = '<i class="fas fa-music"></i> Audio 320 kbps';
        audioGrid.appendChild(b);
      }
      if (!a128 && !a320) {
        audioGrid.innerHTML = '<div class="fb-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-info-circle"></i> Audio tidak tersedia untuk postingan ini</div>';
      }
    }

    function renderResult(data) {
      currentData = data;

      const thumbEl = $('#fbThumb');
      if (thumbEl) {
        thumbEl.src = data.thumb || '';
        thumbEl.onerror = function () {
          this.onerror = null;
          this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect fill="%23111" width="320" height="320"/><text fill="%23444" x="160" y="170" text-anchor="middle" font-size="16">No Thumbnail</text></svg>';
        };
      }
      const av = $('#fbAuthorAvatar'); if (av) av.innerHTML = '<i class="fab fa-facebook-f"></i>';
      const an = $('#fbAuthorName'); if (an) an.textContent = data.author || 'Facebook User';
      const ah = $('#fbAuthorHandle'); if (ah) ah.textContent = '@' + (data.username || 'user');
      const ds = $('#fbDesc'); if (ds) ds.textContent = data.caption || 'Tanpa deskripsi';
      const du = $('#fbDuration'); if (du) du.textContent = data.duration ? data.duration + 's' : '';
      const dt = $('#fbDate'); if (dt) dt.textContent = fmtDate(data.timestamp);
      const sc = $('#fbSource'); if (sc) sc.textContent = 'via ' + (data.source || '—');
      const lk = $('#fbLikes'); if (lk) lk.textContent = fmtNum(data.likes);
      const cm = $('#fbComments'); if (cm) cm.textContent = fmtNum(data.comments);
      const mediaCount = (data.images?.length || 0) + (data.video ? 1 : 0);
      const mc = $('#fbMediaCount'); if (mc) mc.textContent = String(mediaCount || 1);

      const typeBadge = $('#fbTypeBadge');
      if (typeBadge) {
        const t = data.type || 'video';
        if (t === 'reels') typeBadge.textContent = 'REELS';
        else if (t === 'carousel') typeBadge.textContent = 'CAROUSEL';
        else if (t === 'post') typeBadge.textContent = 'POST';
        else typeBadge.textContent = 'VIDEO';
        typeBadge.classList.add('visible');
      }

      if (ds && ds.textContent.length > 100 && descToggle) {
        descToggle.style.display = 'inline-block';
        descToggle.textContent = 'Selengkapnya';
        descToggle.onclick = () => {
          const expanded = ds.classList.toggle('expanded');
          descToggle.textContent = expanded ? 'Sembunyikan' : 'Selengkapnya';
        };
      } else if (descToggle) {
        descToggle.style.display = 'none';
      }

      renderQualityButtons(data.qualities || {});
      renderPhotos(data.images || []);
      renderAudioButtons(data.audio || {});

      resultCard?.classList.add('visible');
      setTimeout(() => resultCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    function saveHistory(data, originalUrl) {
      const item = {
        id: Date.now(),
        title: (data.caption || 'Facebook Video').slice(0, 80),
        author: data.username || data.author || 'user',
        thumb: data.thumb || '',
        url: originalUrl,
        ts: Date.now()
      };
      history = history.filter(h => h.url !== originalUrl);
      history.unshift(item);
      if (history.length > 8) history = history.slice(0, 8);
      try { localStorage.setItem('irgxy_fb_history', JSON.stringify(history)); } catch {}
      renderHistory();
    }

    function renderHistory() {
      if (!historyWrap || !historyList) return;
      if (!history.length) { historyWrap.style.display = 'none'; return; }
      historyWrap.style.display = 'block';
      historyList.innerHTML = history.map(h => `
        <div class="fb-history-item" data-url="${esc(h.url)}">
          ${h.thumb ? `<img src="${esc(h.thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="h-info">
            <div class="h-title">${esc(h.title)}</div>
            <div class="h-sub">@${esc(h.author)}</div>
          </div>
        </div>`).join('');
      historyList.querySelectorAll('.fb-history-item').forEach(el => {
        el.addEventListener('click', () => {
          input.value = el.getAttribute('data-url') || '';
          validateLive();
          handleParse();
        });
      });
    }

    clearHistory?.addEventListener('click', () => {
      history = [];
      try { localStorage.removeItem('irgxy_fb_history'); } catch {}
      renderHistory();
      showToast('Riwayat berhasil dihapus', 'success');
    });

    const FB_SOURCES = [
      {
        name: 'FBDown',
        async fetch(url) {
          const fd = new URLSearchParams();
          fd.append('URLz', url);
          const r = await safeFetch('https://fbdown.net/download.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
          }, 12000);
          const html = await r.text();
          return { html };
        },
        map(j) {
          const html = String(j.html || '');
          const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
          const thumbs = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map(m => m[1]);
          if (!vids.length && !thumbs.length) throw new Error('FBDown: tidak ada media');
          const qualities = {};
          if (vids[0]) qualities['720p'] = vids[0];
          if (vids[1]) qualities['1080p'] = vids[1];
          if (vids[2]) qualities['360p'] = vids[2];
          if (!qualities['360p'] && vids[0]) qualities['360p'] = vids[0];
          return {
            author: 'Facebook User',
            username: 'user',
            caption: '',
            thumb: thumbs[0] || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: vids.length ? 'video' : 'post',
            qualities,
            images: [],
            audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
            video: vids[0] || '',
            source: 'FBDown'
          };
        }
      },
      {
        name: 'SnapSaveFB',
        async fetch(url) {
          const fd = new URLSearchParams();
          fd.append('url', url);
          fd.append('action', 'get');
          const r = await safeFetch('https://snapsave.app/action.php?lang=id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
          }, 12000);
          const html = await r.text();
          return { html };
        },
        map(j) {
          const html = String(j.html || '');
          const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
          const thumbs = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map(m => m[1]);
          if (!vids.length && !thumbs.length) throw new Error('SnapSave FB: tidak ada media');
          const qualities = {};
          if (vids[0]) qualities['1080p'] = vids[0];
          if (vids[1]) qualities['720p']  = vids[1];
          if (vids[2]) qualities['360p']  = vids[2];
          if (!qualities['720p'] && vids[0]) qualities['720p'] = vids[0];
          if (!qualities['360p'] && (vids[1] || vids[0])) qualities['360p'] = vids[1] || vids[0];
          return {
            author: 'Facebook User',
            username: 'user',
            caption: '',
            thumb: thumbs[0] || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: 'video',
            qualities,
            images: [],
            audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
            video: vids[0] || '',
            source: 'SnapSaveFB'
          };
        }
      },
      {
        name: 'SaveFromFB',
        async fetch(url) {
          const fd = new URLSearchParams();
          fd.append('url', url);
          const r = await safeFetch('https://en.savefrom.net/1-second-downloader/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
          }, 12000);
          const html = await r.text();
          return { html };
        },
        map(j) {
          const html = String(j.html || '');
          const ogVideo = (html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/i) || [])[1] || '';
          const ogImage = (html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) || [])[1] || '';
          const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
          const videoUrl = ogVideo || vids[0] || '';
          if (!videoUrl && !ogImage) throw new Error('SaveFrom FB: tidak ada media');
          const qualities = {};
          if (videoUrl) {
            qualities['360p']  = videoUrl;
            qualities['720p']  = videoUrl;
            qualities['1080p'] = videoUrl;
          }
          return {
            author: 'Facebook User',
            username: 'user',
            caption: '',
            thumb: ogImage || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: 'video',
            qualities,
            images: [],
            audio: videoUrl ? { '128': videoUrl, '320': videoUrl } : {},
            video: videoUrl,
            source: 'SaveFromFB'
          };
        }
      },
      {
        name: 'GetFVid',
        async fetch(url) {
          const r = await safeFetch(
            `https://getfvid.com/downloader?url=${encodeURIComponent(url)}`,
            {}, 12000
          );
          const html = await r.text();
          return { html };
        },
        map(j) {
          const html = String(j.html || '');
          const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
          const thumbs = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi)].map(m => m[1]);
          if (!vids.length) throw new Error('GetFVid: tidak ada media');
          const qualities = {};
          if (vids[0]) qualities['1080p'] = vids[0];
          if (vids[1]) qualities['720p']  = vids[1];
          if (!qualities['720p']) qualities['720p'] = vids[0];
          qualities['360p'] = vids[vids.length - 1] || vids[0];
          return {
            author: 'Facebook User',
            username: 'user',
            caption: '',
            thumb: thumbs[0] || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: 'video',
            qualities,
            images: [],
            audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
            video: vids[0],
            source: 'GetFVid'
          };
        }
      },
      {
        name: 'FBOEmbed',
        async fetch(url) {
          const token = 'EAABsbCS1iHgBO7ZC8kZBmR9TZA9X9ZBZAJZAJZBmZA9ZBZAJZB';
          const r = await safeFetch(
            `https://graph.facebook.com/v18.0/oembed_video?url=${encodeURIComponent(url)}&access_token=${token}`,
            {}, 10000
          );
          return r.json();
        },
        map(j) {
          if (!j || (!j.thumbnail_url && !j.title)) throw new Error('OEmbed kosong');
          return {
            author: j.author_name || 'Facebook User',
            username: (j.author_url || '').split('/').filter(Boolean).pop() || 'user',
            caption: j.title || '',
            thumb: j.thumbnail_url || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: 'video',
            qualities: {},
            images: j.thumbnail_url ? [j.thumbnail_url] : [],
            audio: {},
            video: '',
            source: 'FBOEmbed'
          };
        }
      }
    ];

    async function parseFacebook(url) {
      let lastErr = null;
      for (const src of FB_SOURCES) {
        try {
          setStatus('loading', '<span class="fb-spinner"></span>', `Memproses dengan ${src.name}...`);
          const raw = await src.fetch(url);
          const data = src.map(raw);
          const hasMedia = Object.keys(data.qualities || {}).length > 0
            || (data.images && data.images.length > 0)
            || data.video;
          if (!hasMedia) throw new Error('Tidak ada media ditemukan');
          return { data, source: src.name };
        } catch (e) {
          lastErr = e;
          console.warn(`[FB] ${src.name} gagal:`, e.message);
        }
      }
      throw lastErr || new Error('Semua server gagal. Coba lagi nanti.');
    }

    async function handleParse() {
      const now = Date.now();
      if (now - lastClickTime < 800) return;
      lastClickTime = now;
      if (isLoading) return;

      const url = sanitizeUrl(input.value);
      if (!url) {
        setStatus('error', '⚠️', 'Tempel link Facebook terlebih dahulu.');
        showToast('Tempel link Facebook terlebih dahulu', 'error');
        return;
      }
      if (!isValidFacebookUrl(url)) {
        setStatus('error', '❌', 'Link tidak valid. Pastikan dari facebook.com / fb.watch / fb.me');
        showToast('Link tidak valid', 'error');
        return;
      }

      resultCard?.classList.remove('visible');
      setLoading(true);
      setStatus('loading', '<span class="fb-spinner"></span>', 'Mengambil data...');

      try {
        const { data, source } = await parseFacebook(url);
        renderResult(data);
        saveHistory(data, url);

        const mediaCount = (data.images?.length || 0) + (data.video ? 1 : 0);
        setStatus('success', '✅',
          `Berhasil via ${source}! ${mediaCount || 1} media siap diunduh.`
        );
        Activity.add('download', `Mengunduh Facebook dari @${data.username || 'user'}`);
        showToast('Data berhasil diambil!', 'success');
        setTimeout(() => { if (statusEl?.classList.contains('success')) hideStatus(); }, 5000);
      } catch (e) {
        console.error('[FB] Semua source gagal:', e);
        const msg = (e && e.message) || '';
        let userMsg = 'Maaf, semua server sedang sibuk. Coba lagi dalam 1 menit atau gunakan link lain.';
        if (/private|deleted|not found|not available|unavailable/i.test(msg)) {
          userMsg = 'Video tidak dapat diakses (mungkin private atau telah dihapus).';
        } else if (/login|sign in|auth/i.test(msg)) {
          userMsg = 'Video memerlukan login Facebook.';
        } else if (/region|geo|blocked/i.test(msg)) {
          userMsg = 'Video tidak tersedia di region Anda.';
        } else if (/timeout|abort/i.test(msg)) {
          userMsg = 'Koneksi timeout. Periksa jaringan Anda dan coba lagi.';
        }
        setStatus('error', '❌', userMsg);
        showToast('Gagal mengambil data. Coba lagi.', 'error');
      } finally {
        setLoading(false);
      }
    }

    parseBtn.addEventListener('click', handleParse);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); handleParse(); } });
    input.addEventListener('input', validateLive);
    input.addEventListener('paste', () => setTimeout(() => {
      input.value = input.value.trim();
      validateLive();
    }, 30));

    pasteBtn?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        input.value = txt.trim();
        validateLive();
        if (isValidFacebookUrl(input.value)) handleParse();
        else showToast('Clipboard bukan link Facebook', 'warning');
      } catch { showToast('Gagal paste dari clipboard', 'error'); }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.classList.remove('valid', 'invalid');
      clearBtn.style.display = 'none';
      resultCard?.classList.remove('visible');
      hideStatus();
      input.focus();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.fb-dl-btn');
      if (!btn) return;
      const url = btn.getAttribute('href') || btn.href;
      if (!url || url === '#') return;

      const quality = btn.getAttribute('data-quality');
      const isAudio = btn.classList.contains('audio-128') || btn.classList.contains('audio-320');
      if (isAudio) {
        Activity.add('download', 'Mengunduh audio MP3 Facebook');
      } else if (quality) {
        Activity.add('download', 'Mengunduh Facebook ' + quality);
      }

      if (currentData) {
        const safeUser = (currentData.username || 'facebook').replace(/[^\w-]/g, '').slice(0, 40);
        const ext = isAudio ? 'mp3' : 'mp4';
        const fname = `fb_${safeUser}_${quality || 'audio'}_${Date.now()}.${ext}`;
        btn.setAttribute('download', fname);
      }
    });

    $('#fbCopyLinkBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk disalin', 'warning'); return; }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link berhasil disalin!', 'success');
        Activity.add('copy_link', 'Menyalin link Facebook');
      } catch { prompt('Salin link:', url); }
    });

    $('#fbShareBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk dibagikan', 'warning'); return; }
      const title = currentData ? `Facebook @${currentData.username}` : 'Facebook Video';
      if (navigator.share) {
        try {
          await navigator.share({ title, text: 'Download Facebook via IRGXYMODS', url });
          Activity.add('share', 'Membagikan link Facebook');
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link disalin ke clipboard', 'success');
        } catch { prompt('Salin link:', url); }
      }
    });

    $('#fbDownloadThumbBtn')?.addEventListener('click', () => {
      if (!currentData || !currentData.thumb) {
        showToast('Thumbnail tidak tersedia', 'warning');
        return;
      }
      const safeUser = (currentData.username || 'facebook').replace(/[^\w-]/g, '').slice(0, 40);
      triggerDownload(currentData.thumb, `fb_${safeUser || 'facebook'}_thumb.jpg`);
      showToast('Thumbnail sedang diunduh', 'success');
      Activity.add('download', 'Mengunduh thumbnail Facebook');
    });

    $$('.fb-faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.fb-faq-item');
        if (!item) return;
        const wasOpen = item.classList.contains('open');
        $$('.fb-faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    renderHistory();
    validateLive();
    console.log('✅ Facebook downloader siap (5-source • 360p/720p/1080p • Foto carousel • MP3)');
  })();

  /* ================================================================
     THREADS DOWNLOADER — 5 Sumber (v5.1)
     ================================================================ */
  (function initThreadsDownloader() {
    const input = $('#thUrlInput');
    if (!input) return; // Self-guard: skip jika bukan halaman Threads

    const parseBtn    = $('#thParseBtn');
    const btnText     = $('#thParseBtnText');
    const pasteBtn    = $('#thPasteBtn');
    const clearBtn    = $('#thClearBtn');
    const statusEl    = $('#thStatus');
    const statusIcon  = $('#thStatusIcon');
    const statusText  = $('#thStatusText');
    const resultCard  = $('#thResultCard');
    const descToggle  = $('#thDescToggle');
    const historyWrap = $('#thHistory');
    const historyList = $('#thHistoryList');
    const clearHistory= $('#thClearHistory');
    const qualityGrid = $('#thQualityGrid');
    const audioGrid   = $('#thAudioGrid');
    const photosGrid  = $('#thPhotosGrid');
    const photosSec   = $('#thPhotosSection');

    if (!parseBtn) return;

    let isLoading = false;
    let lastClickTime = 0;
    let currentData = null;
    let history = [];
    try { history = JSON.parse(localStorage.getItem('irgxy_th_history') || '[]'); } catch { history = []; }

    /* ---- UTILS ---- */
    const fmtNum = (n) => {
      n = Number(n) || 0;
      if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    const fmtDate = (ts) => {
      if (!ts) return '—';
      const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const sanitizeUrl = (url) => (url || '').trim().replace(/\s+/g, '').replace(/[<>"'`]/g, '');
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    /* ---- VALIDASI URL THREADS ---- */
    const isValidThreadsUrl = (url) => {
      const s = sanitizeUrl(url);
      return /^https?:\/\/(www\.)?(threads\.net|threads\.com)\/(@[\w.]+\/post\/[\w-]+|t\/[\w-]+)/i.test(s)
          || /^https?:\/\/(www\.)?(threads\.net|threads\.com)\/share\//i.test(s);
    };

    const setStatus = (type, icon, text) => {
      if (!statusEl) return;
      statusEl.className = 'th-status ' + type;
      if (statusIcon) statusIcon.innerHTML = icon;
      if (statusText) statusText.textContent = text;
    };
    const hideStatus = () => { if (statusEl) statusEl.className = 'th-status'; };
    const setLoading = (state) => {
      isLoading = state;
      parseBtn.disabled = state;
      if (btnText) btnText.textContent = state ? 'Memproses...' : 'Download';
      const icon = parseBtn.querySelector('i');
      if (icon) icon.className = state ? 'th-spinner' : 'fas fa-download';
    };

    const validateLive = () => {
      const v = sanitizeUrl(input.value);
      input.classList.remove('valid', 'invalid');
      if (!v) { if (clearBtn) clearBtn.style.display = 'none'; return; }
      if (clearBtn) clearBtn.style.display = 'flex';
      input.classList.toggle('valid', isValidThreadsUrl(v));
      input.classList.toggle('invalid', !isValidThreadsUrl(v));
    };

    function triggerDownload(url, filename) {
      if (!url) { showToast('Link tidak tersedia', 'warning'); return false; }
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (filename) a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch (e) {
        try { window.open(url, '_blank', 'noopener'); return true; }
        catch { return false; }
      }
    }

    /* ---- QUALITY & RENDER ---- */
    const QUALITY_ORDER = ['360p', '720p', '1080p'];
    const QUALITY_LABELS = {
      '360p':  { icon: 'fa-video', label: '360p SD' },
      '720p':  { icon: 'fa-video', label: '720p HD' },
      '1080p': { icon: 'fa-video', label: '1080p FHD' }
    };

    function renderQualityButtons(qualities) {
      if (!qualityGrid) return;
      qualityGrid.innerHTML = '';
      let rendered = 0;

      const validKeys = Object.keys(qualities || {})
        .filter(k => /^https?:\/\//i.test(qualities[k] || ''));

      if (validKeys.length === 0) {
        qualityGrid.innerHTML = '<div class="th-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-info-circle"></i> Video tidak tersedia untuk postingan ini</div>';
        return;
      }
      if (validKeys.length === 1) {
        const only = qualities[validKeys[0]];
        qualities = { '360p': only, '720p': only, '1080p': only };
        console.log('[TH] Hanya 1 kualitas tersedia → duplikasi ke 360p/720p/1080p');
      } else if (validKeys.length === 2) {
        if (!qualities['360p']) qualities['360p'] = qualities[validKeys[0]];
        if (!qualities['1080p']) qualities['1080p'] = qualities[validKeys[validKeys.length - 1]];
        if (!qualities['720p']) qualities['720p'] = qualities[validKeys[0]];
      }

      QUALITY_ORDER.forEach(q => {
        const url = qualities && qualities[q];
        if (!url || !/^https?:\/\//i.test(url)) return;
        rendered++;
        const meta = QUALITY_LABELS[q];
        const a = document.createElement('a');
        a.className = 'th-dl-btn' + (q === '1080p' ? ' hd-highlight' : '');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-quality', q);
        a.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.label}`;
        qualityGrid.appendChild(a);
      });

      if (rendered === 0) {
        qualityGrid.innerHTML = '<div class="th-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-info-circle"></i> Video tidak tersedia untuk postingan ini</div>';
      }
    }

    function renderPhotos(images) {
      if (!photosGrid || !photosSec) return;
      if (!images || !images.length) {
        photosSec.style.display = 'none';
        photosGrid.innerHTML = '';
        return;
      }
      photosSec.style.display = 'block';
      photosGrid.innerHTML = images.map((url, i) => `
        <div class="th-photo-item" data-src="${esc(url)}" data-index="${i + 1}">
          <img src="${esc(url)}" alt="Foto ${i + 1}" loading="lazy"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23222%22 width=%22100%22 height=%22100%22/></svg>';" />
          <span class="photo-num">${i + 1}/${images.length}</span>
          <span class="photo-dl-icon"><i class="fas fa-download"></i></span>
        </div>
      `).join('');

      photosGrid.querySelectorAll('.th-photo-item').forEach(el => {
        el.addEventListener('click', () => {
          const src = el.getAttribute('data-src');
          const idx = el.getAttribute('data-index');
          if (!src) return;
          triggerDownload(src, `threads_photo_${Date.now()}_${idx}.jpg`);
          showToast(`Foto ${idx} sedang diunduh`, 'success');
          Activity.add('download', `Mengunduh foto Threads #${idx}`);
        });
      });
    }

    function renderAudioButtons(audio) {
      if (!audioGrid) return;
      audioGrid.innerHTML = '';
      const a128 = audio && (audio['128'] || audio['low']);
      const a320 = audio && (audio['320'] || audio['high']);

      if (a128 && /^https?:\/\//i.test(a128)) {
        const b = document.createElement('a');
        b.className = 'th-dl-btn audio-128';
        b.href = a128;
        b.target = '_blank';
        b.rel = 'noopener noreferrer';
        b.setAttribute('download', `threads_audio_128_${Date.now()}.mp3`);
        b.innerHTML = '<i class="fas fa-music"></i> Audio 128 kbps';
        audioGrid.appendChild(b);
      }
      if ((a320 || a128) && /^https?:\/\//i.test(a320 || a128)) {
        const b = document.createElement('a');
        b.className = 'th-dl-btn audio-320';
        b.href = a320 || a128;
        b.target = '_blank';
        b.rel = 'noopener noreferrer';
        b.setAttribute('download', `threads_audio_320_${Date.now()}.mp3`);
        b.innerHTML = '<i class="fas fa-music"></i> Audio 320 kbps';
        audioGrid.appendChild(b);
      }
      if (!a128 && !a320) {
        audioGrid.innerHTML = '<div class="th-stat" style="grid-column:1/-1;justify-content:center;padding:14px;"><i class="fas fa-info-circle"></i> Audio tidak tersedia untuk postingan ini</div>';
      }
    }

    function renderResult(data) {
      currentData = data;

      const thumbEl = $('#thThumb');
      if (thumbEl) {
        thumbEl.src = data.thumb || '';
        thumbEl.onerror = function () {
          this.onerror = null;
          this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect fill="%23111" width="320" height="320"/><text fill="%23444" x="160" y="170" text-anchor="middle" font-size="16">No Thumbnail</text></svg>';
        };
      }
      const av = $('#thAuthorAvatar'); if (av) av.innerHTML = '<i class="fas fa-at"></i>';
      const an = $('#thAuthorName'); if (an) an.textContent = data.author || 'Threads User';
      const ah = $('#thAuthorHandle'); if (ah) ah.textContent = '@' + (data.username || 'user');
      const ds = $('#thDesc'); if (ds) ds.textContent = data.caption || 'Tanpa deskripsi';
      const du = $('#thDuration'); if (du) du.textContent = data.duration ? data.duration + 's' : '';
      const dt = $('#thDate'); if (dt) dt.textContent = fmtDate(data.timestamp);
      const sc = $('#thSource'); if (sc) sc.textContent = 'via ' + (data.source || '—');
      const lk = $('#thLikes'); if (lk) lk.textContent = fmtNum(data.likes);
      const cm = $('#thComments'); if (cm) cm.textContent = fmtNum(data.comments);
      const mediaCount = (data.images?.length || 0) + (data.video ? 1 : 0);
      const mc = $('#thMediaCount'); if (mc) mc.textContent = String(mediaCount || 1);

      const typeBadge = $('#thTypeBadge');
      if (typeBadge) {
        const t = data.type || 'post';
        if (t === 'carousel') typeBadge.textContent = 'CAROUSEL';
        else if (t === 'video') typeBadge.textContent = 'VIDEO';
        else typeBadge.textContent = 'POST';
        typeBadge.classList.add('visible');
      }

      if (ds && ds.textContent.length > 100 && descToggle) {
        descToggle.style.display = 'inline-block';
        descToggle.textContent = 'Selengkapnya';
        descToggle.onclick = () => {
          const expanded = ds.classList.toggle('expanded');
          descToggle.textContent = expanded ? 'Sembunyikan' : 'Selengkapnya';
        };
      } else if (descToggle) {
        descToggle.style.display = 'none';
      }

      renderQualityButtons(data.qualities || {});
      renderPhotos(data.images || []);
      renderAudioButtons(data.audio || {});

      resultCard?.classList.add('visible');
      setTimeout(() => resultCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    /* ---- HISTORY ---- */
    function saveHistory(data, originalUrl) {
      const item = {
        id: Date.now(),
        title: (data.caption || 'Threads Post').slice(0, 80),
        author: data.username || data.author || 'user',
        thumb: data.thumb || '',
        url: originalUrl,
        ts: Date.now()
      };
      history = history.filter(h => h.url !== originalUrl);
      history.unshift(item);
      if (history.length > 8) history = history.slice(0, 8);
      try { localStorage.setItem('irgxy_th_history', JSON.stringify(history)); } catch {}
      renderHistory();
    }

    function renderHistory() {
      if (!historyWrap || !historyList) return;
      if (!history.length) { historyWrap.style.display = 'none'; return; }
      historyWrap.style.display = 'block';
      historyList.innerHTML = history.map(h => `
        <div class="th-history-item" data-url="${esc(h.url)}">
          ${h.thumb ? `<img src="${esc(h.thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="h-info">
            <div class="h-title">${esc(h.title)}</div>
            <div class="h-sub">@${esc(h.author)}</div>
          </div>
        </div>`).join('');
      historyList.querySelectorAll('.th-history-item').forEach(el => {
        el.addEventListener('click', () => {
          input.value = el.getAttribute('data-url') || '';
          validateLive();
          handleParse();
        });
      });
    }

    clearHistory?.addEventListener('click', () => {
      history = [];
      try { localStorage.removeItem('irgxy_th_history'); } catch {}
      renderHistory();
      showToast('Riwayat berhasil dihapus', 'success');
    });

    /* ---- 5 SUMBER API ---- */
    const TH_SOURCES = [
      {
        name: 'SnapThreads',
        async fetch(url) {
          const fd = new URLSearchParams();
          fd.append('url', url);
          const r = await safeFetch('https://snapthreads.com/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
          }, 12000);
          return r.json();
        },
        map(j) {
          const list = j?.data || j?.medias || j?.url || [];
          const arr = Array.isArray(list) ? list : (list ? [list] : []);
          if (!arr.length) throw new Error('SnapThreads: data kosong');
          const qualities = {};
          const images = [];
          let videoUrl = '';
          let thumb = '';
          arr.forEach((it, i) => {
            const u = typeof it === 'string' ? it : (it.url || it.src);
            if (!u) return;
            if (/\.mp4/i.test(u) || (typeof it === 'object' && it.type === 'video')) {
              if (!videoUrl) videoUrl = u;
              const q = (typeof it === 'object' && (it.quality || it.label)) || '';
              if (/1080/i.test(q)) qualities['1080p'] = u;
              else if (/720/i.test(q)) qualities['720p'] = u;
              else if (/360/i.test(q)) qualities['360p'] = u;
              else if (i === 0) qualities['1080p'] = u;
              else if (i === 1) qualities['720p'] = u;
              else if (i === 2) qualities['360p'] = u;
            } else if (/\.(jpg|jpeg|webp|png)/i.test(u)) {
              images.push(u);
            }
            if (typeof it === 'object' && it.thumbnail) thumb = it.thumbnail;
          });
          if (videoUrl && !qualities['360p']) qualities['360p'] = videoUrl;
          if (videoUrl && !qualities['720p']) qualities['720p'] = videoUrl;
          if (videoUrl && !qualities['1080p']) qualities['1080p'] = videoUrl;
          if (!videoUrl && !images.length) throw new Error('SnapThreads: tidak ada media');
          return {
            author: j.author || 'Threads User',
            username: j.username || 'user',
            caption: j.caption || j.title || '',
            thumb: thumb || j.thumbnail || images[0] || '',
            duration: 0, likes: j.likes || 0, comments: j.comments || 0, timestamp: j.timestamp || 0,
            type: videoUrl ? 'video' : (images.length > 1 ? 'carousel' : 'post'),
            qualities, images,
            audio: videoUrl ? { '128': videoUrl, '320': videoUrl } : {},
            video: videoUrl,
            source: 'SnapThreads'
          };
        }
      },
      {
        name: 'ThreadsSave',
        async fetch(url) {
          const r = await safeFetch(
            `https://api.threadssave.com/media?url=${encodeURIComponent(url)}`,
            {}, 12000
          );
          return r.json();
        },
        map(j) {
          const items = j?.data || j?.medias || j?.url || j?.links || [];
          const list = Array.isArray(items) ? items : (items ? [items] : []);
          if (!list.length) throw new Error('ThreadsSave: data kosong');
          const images = [];
          let video = null;
          list.forEach(it => {
            const u = typeof it === 'string' ? it : (it.url || it.src || it.link);
            if (!u) return;
            const isVid = (typeof it === 'object' && it.type === 'video') || /\.mp4/i.test(u);
            if (isVid) video = { url: u, thumbnail: it.thumbnail, hd: it.hd || u, sd: it.sd || u };
            else images.push(u);
          });
          const qualities = {};
          if (video) {
            qualities['360p']  = video.sd || video.url;
            qualities['720p']  = video.url;
            qualities['1080p'] = video.hd || video.url;
          }
          if (!video && !images.length) throw new Error('ThreadsSave: tidak ada media');
          return {
            author: j.author || 'Threads User',
            username: j.username || 'user',
            caption: j.caption || j.title || '',
            thumb: j.thumbnail || video?.thumbnail || images[0] || '',
            duration: 0, likes: j.likes || 0, comments: j.comments || 0, timestamp: j.timestamp || 0,
            type: video ? 'video' : (images.length > 1 ? 'carousel' : 'post'),
            qualities, images,
            audio: video ? { '128': video.url, '320': video.hd || video.url } : {},
            video: video?.url || '',
            source: 'ThreadsSave'
          };
        }
      },
      {
        name: 'SaveThreads',
        async fetch(url) {
          const fd = new URLSearchParams();
          fd.append('url', url);
          const r = await safeFetch('https://savethreads.net/action.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
          }, 12000);
          const html = await r.text();
          return { html };
        },
        map(j) {
          const html = String(j.html || '');
          const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
          const imgs = [...html.matchAll(/href="(https?:[^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"/gi)].map(m => m[1]);
          const thumbs = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map(m => m[1]);
          const allImgs = imgs.filter(u => !thumbs.includes(u));
          if (!vids.length && !allImgs.length) throw new Error('SaveThreads: tidak ada media');
          const qualities = {};
          if (vids[0]) qualities['1080p'] = vids[0];
          if (vids[1]) qualities['720p']  = vids[1];
          if (vids[2]) qualities['360p']  = vids[2];
          if (!qualities['720p'] && vids[0]) qualities['720p'] = vids[0];
          if (!qualities['360p'] && (vids[1] || vids[0])) qualities['360p'] = vids[1] || vids[0];
          return {
            author: 'Threads User', username: 'user', caption: '',
            thumb: thumbs[0] || allImgs[0] || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: vids.length ? 'video' : (allImgs.length > 1 ? 'carousel' : 'post'),
            qualities, images: allImgs,
            audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
            video: vids[0] || '',
            source: 'SaveThreads'
          };
        }
      },
      {
        name: 'ThreadsDown',
        async fetch(url) {
          const fd = new URLSearchParams();
          fd.append('url', url);
          fd.append('action', 'get');
          const r = await safeFetch('https://threadsdown.app/action.php?lang=id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
          }, 12000);
          const html = await r.text();
          return { html };
        },
        map(j) {
          const html = String(j.html || '');
          const vids = [...html.matchAll(/href="(https?:[^"]+\.mp4[^"]*)"/gi)].map(m => m[1]);
          const imgs = [...html.matchAll(/href="(https?:[^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"/gi)].map(m => m[1]);
          const thumbs = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map(m => m[1]);
          const allImgs = imgs.filter(u => !thumbs.includes(u));
          if (!vids.length && !allImgs.length) throw new Error('ThreadsDown: tidak ada media');
          const qualities = {};
          if (vids[0]) qualities['1080p'] = vids[0];
          if (vids[1]) qualities['720p']  = vids[1];
          if (!qualities['720p'] && vids[0]) qualities['720p'] = vids[0];
          qualities['360p'] = vids[vids.length - 1] || vids[0];
          return {
            author: 'Threads User', username: 'user', caption: '',
            thumb: thumbs[0] || allImgs[0] || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: vids.length ? 'video' : (allImgs.length > 1 ? 'carousel' : 'post'),
            qualities, images: allImgs,
            audio: vids[0] ? { '128': vids[0], '320': vids[0] } : {},
            video: vids[0] || '',
            source: 'ThreadsDown'
          };
        }
      },
      {
        name: 'ThreadsOEmbed',
        async fetch(url) {
          const r = await safeFetch(
            `https://graph.threads.net/v1.0/oembed?url=${encodeURIComponent(url)}`,
            {}, 10000
          );
          return r.json();
        },
        map(j) {
          if (!j || (!j.thumbnail_url && !j.title)) throw new Error('OEmbed kosong');
          return {
            author: j.author_name || 'Threads User',
            username: (j.author_url || '').split('/').filter(Boolean).pop() || 'user',
            caption: j.title || '',
            thumb: j.thumbnail_url || '',
            duration: 0, likes: 0, comments: 0, timestamp: 0,
            type: 'post', qualities: {},
            images: j.thumbnail_url ? [j.thumbnail_url] : [],
            audio: {}, video: '',
            source: 'ThreadsOEmbed'
          };
        }
      }
    ];

    async function parseThreads(url) {
      let lastErr = null;
      for (const src of TH_SOURCES) {
        try {
          setStatus('loading', '<span class="th-spinner"></span>', `Memproses dengan ${src.name}...`);
          const raw = await src.fetch(url);
          const data = src.map(raw);
          const hasMedia = Object.keys(data.qualities || {}).length > 0
            || (data.images && data.images.length > 0)
            || data.video;
          if (!hasMedia) throw new Error('Tidak ada media ditemukan');
          return { data, source: src.name };
        } catch (e) {
          lastErr = e;
          console.warn(`[TH] ${src.name} gagal:`, e.message);
        }
      }
      throw lastErr || new Error('Semua server gagal. Coba lagi nanti.');
    }

    async function handleParse() {
      const now = Date.now();
      if (now - lastClickTime < 800) return;
      lastClickTime = now;
      if (isLoading) return;

      const url = sanitizeUrl(input.value);
      if (!url) {
        setStatus('error', '⚠️', 'Tempel link Threads terlebih dahulu.');
        showToast('Tempel link Threads terlebih dahulu', 'error');
        return;
      }
      if (!isValidThreadsUrl(url)) {
        setStatus('error', '❌', 'Link tidak valid. Pastikan dari threads.net / threads.com (/@user/post/... atau /t/...)');
        showToast('Link tidak valid', 'error');
        return;
      }

      resultCard?.classList.remove('visible');
      setLoading(true);
      setStatus('loading', '<span class="th-spinner"></span>', 'Mengambil data...');

      try {
        const { data, source } = await parseThreads(url);
        renderResult(data);
        saveHistory(data, url);

        const mediaCount = (data.images?.length || 0) + (data.video ? 1 : 0);
        setStatus('success', '✅',
          `Berhasil via ${source}! ${mediaCount || 1} media siap diunduh.`
        );
        Activity.add('download', `Mengunduh Threads dari @${data.username || 'user'}`);
        showToast('Data berhasil diambil!', 'success');
        setTimeout(() => { if (statusEl?.classList.contains('success')) hideStatus(); }, 5000);
      } catch (e) {
        console.error('[TH] Semua source gagal:', e);
        const msg = (e && e.message) || '';
        let userMsg = 'Maaf, semua server sedang sibuk. Coba lagi dalam 1 menit atau gunakan link lain.';
        if (/private|deleted|not found|not available|unavailable/i.test(msg)) {
          userMsg = 'Postingan tidak dapat diakses (mungkin private atau telah dihapus).';
        } else if (/login|sign in|auth/i.test(msg)) {
          userMsg = 'Postingan memerlukan login Threads.';
        } else if (/region|geo|blocked/i.test(msg)) {
          userMsg = 'Postingan tidak tersedia di region Anda.';
        } else if (/timeout|abort/i.test(msg)) {
          userMsg = 'Koneksi timeout. Periksa jaringan Anda dan coba lagi.';
        }
        setStatus('error', '❌', userMsg);
        showToast('Gagal mengambil data. Coba lagi.', 'error');
      } finally {
        setLoading(false);
      }
    }

    parseBtn.addEventListener('click', handleParse);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); handleParse(); } });
    input.addEventListener('input', validateLive);
    input.addEventListener('paste', () => setTimeout(() => {
      input.value = input.value.trim();
      validateLive();
    }, 30));

    pasteBtn?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        input.value = txt.trim();
        validateLive();
        if (isValidThreadsUrl(input.value)) handleParse();
        else showToast('Clipboard bukan link Threads', 'warning');
      } catch { showToast('Gagal paste dari clipboard', 'error'); }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.classList.remove('valid', 'invalid');
      clearBtn.style.display = 'none';
      resultCard?.classList.remove('visible');
      hideStatus();
      input.focus();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.th-dl-btn');
      if (!btn) return;
      const url = btn.getAttribute('href') || btn.href;
      if (!url || url === '#') return;

      const quality = btn.getAttribute('data-quality');
      const isAudio = btn.classList.contains('audio-128') || btn.classList.contains('audio-320');
      if (isAudio) {
        Activity.add('download', 'Mengunduh audio MP3 Threads');
      } else if (quality) {
        Activity.add('download', 'Mengunduh Threads ' + quality);
      }

      if (currentData) {
        const safeUser = (currentData.username || 'threads').replace(/[^\w-]/g, '').slice(0, 40);
        const ext = isAudio ? 'mp3' : 'mp4';
        const fname = `threads_${safeUser}_${quality || 'audio'}_${Date.now()}.${ext}`;
        btn.setAttribute('download', fname);
      }
    });

    $('#thCopyLinkBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk disalin', 'warning'); return; }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link berhasil disalin!', 'success');
        Activity.add('copy_link', 'Menyalin link Threads');
      } catch { prompt('Salin link:', url); }
    });

    $('#thShareBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk dibagikan', 'warning'); return; }
      const title = currentData ? `Threads @${currentData.username}` : 'Threads Post';
      if (navigator.share) {
        try {
          await navigator.share({ title, text: 'Download Threads via IRGXYMODS', url });
          Activity.add('share', 'Membagikan link Threads');
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link disalin ke clipboard', 'success');
        } catch { prompt('Salin link:', url); }
      }
    });

    $('#thDownloadThumbBtn')?.addEventListener('click', () => {
      if (!currentData || !currentData.thumb) {
        showToast('Thumbnail tidak tersedia', 'warning');
        return;
      }
      const safeUser = (currentData.username || 'threads').replace(/[^\w-]/g, '').slice(0, 40);
      triggerDownload(currentData.thumb, `threads_${safeUser || 'threads'}_thumb.jpg`);
      showToast('Thumbnail sedang diunduh', 'success');
      Activity.add('download', 'Mengunduh thumbnail Threads');
    });

    $$('.th-faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.th-faq-item');
        if (!item) return;
        const wasOpen = item.classList.contains('open');
        $$('.th-faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    renderHistory();
    validateLive();
    console.log('✅ Threads downloader siap (5-source • 360p/720p/1080p • Carousel • MP3)');
  })();

  console.log('✅ IRGXYMODS downloader.js loaded (v5.2 — TikTok / YouTube / Facebook / Threads)');
})();