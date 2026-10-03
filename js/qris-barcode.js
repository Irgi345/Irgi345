/* ================================================================
   IRGXYMODS — QRIS & BARCODE GENERATOR
   File   : qris-barcode.js
   Versi  : 1.0
   Deps   : qrcode@1.5.3 + jsbarcode@3.11.6 (CDN, sudah di-load di HTML)
   Helper : window.IRGXY dari main.js (dengan fallback lokal)
   Catatan: 100% client-side — tidak ada data dikirim ke server
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     [1] HELPER ADAPTER — pakai main.js jika tersedia
     ================================================================ */
  const IRGXY = window.IRGXY || {};
  const $  = IRGXY.$  || ((s, c = document) => c.querySelector(s));
  const $$ = IRGXY.$$ || ((s, c = document) => Array.from(c.querySelectorAll(s)));
  const showToast = IRGXY.showToast || window.showToast || ((m, t) => {
    console.log('[' + (t || 'info') + '] ' + m);
  });

  /* ================================================================
     [2] GUARD — tunggu library CDN siap
     ================================================================ */
  function waitForLib(name, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        if (window[name]) return resolve(window[name]);
        if (Date.now() - start > timeoutMs) {
          return reject(new Error('Library "' + name + '" gagal dimuat. Periksa koneksi internet.'));
        }
        setTimeout(poll, 80);
      })();
    });
  }

  /* ================================================================
     [3] STATE GLOBAL
     ================================================================ */
  const state = {
    mode: 'qris',           // 'qris' | 'barcode'
    qrDataUrl: null,
    qrSvgString: null,
    barcodeSvgString: null,
    lastPayload: '',
    lastType: 'text',
    lastGeneratedAt: 0
  };
  window.QRB = { state };

  /* ================================================================
     [4] BUILD PAYLOAD — encode data sesuai jenis konten
     ================================================================ */
  function buildPayload() {
    const type = ($('#qrbType') && $('#qrbType').value) || 'text';
    const raw  = (($('#qrbInput') && $('#qrbInput').value) || '').trim();

    if (!raw) throw new Error('Isi teks / URL terlebih dahulu.');

    switch (type) {
      case 'url': {
        // Auto-prepend https:// kalau user tidak tulis protokol
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return raw;
        return 'https://' + raw;
      }
      case 'email': {
        return 'mailto:' + raw;
      }
      case 'phone': {
        return 'tel:' + raw.replace(/\s+/g, '');
      }
      case 'sms': {
        return 'smsto:' + raw.replace(/\s+/g, '');
      }
      case 'wifi': {
        const ssid = raw;
        const pass = ($('#qrbWifiPass') && $('#qrbWifiPass').value) || '';
        const enc  = ($('#qrbWifiEnc')  && $('#qrbWifiEnc').value)  || 'WPA';
        // Escape karakter khusus sesuai standar WiFi QR format
        const esc = (v) => String(v).replace(/([\\;,:"])/g, '\\$1');
        if (enc === 'nopass') return 'WIFI:T:nopass;S:' + esc(ssid) + ';;';
        return 'WIFI:T:' + enc + ';S:' + esc(ssid) + ';P:' + esc(pass) + ';;';
      }
      case 'vcard': {
        const name = raw;
        const tel  = ($('#qrbVcardTel')  && $('#qrbVcardTel').value)  || '';
        const mail = ($('#qrbVcardMail') && $('#qrbVcardMail').value) || '';
        const esc  = (v) => String(v).replace(/([\\;,])/g, '\\$1');
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          'FN:' + esc(name),
          tel  ? 'TEL:'   + esc(tel)  : '',
          mail ? 'EMAIL:' + esc(mail) : '',
          'END:VCARD'
        ].filter(Boolean).join('\n');
      }
      case 'qris':
        // QRIS: raw string dari user (biasanya dari merchant / bank)
        return raw;
      case 'text':
      default:
        return raw;
    }
  }

  /* ================================================================
     [5] GENERATE QR (QRIS / QR Code)
     ================================================================ */
  async function generateQR(payload) {
    const size  = parseInt(($('#qrbSize') && $('#qrbSize').value) || '512', 10);
    const ecc   = ($('#qrbEcc') && $('#qrbEcc').value) || 'M';
    const dark  = ($('#qrbColorDark')  && $('#qrbColorDark').value)  || '#000000';
    const light = ($('#qrbColorLight') && $('#qrbColorLight').value) || '#ffffff';

    // 5a. Canvas → PNG DataURL (Ultra HD)
    const canvas = document.createElement('canvas');
    await window.QRCode.toCanvas(canvas, payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: ecc,
      color: { dark: dark, light: light }
    });
    state.qrDataUrl = canvas.toDataURL('image/png');

    // 5b. SVG Vektor
    state.qrSvgString = await new Promise((resolve, reject) => {
      window.QRCode.toString(payload, {
        type: 'svg',
        width: size,
        margin: 2,
        errorCorrectionLevel: ecc,
        color: { dark: dark, light: light }
      }, (err, str) => err ? reject(err) : resolve(str));
    });

    // 5c. Render ke holder
    const holder = $('#qrbQrHolder');
    if (holder) {
      holder.innerHTML = '';
      const img = document.createElement('img');
      img.src = state.qrDataUrl;
      img.alt = 'QR Code';
      img.style.maxWidth = '100%';
      img.style.display = 'block';
      img.style.imageRendering = 'pixelated';
      holder.appendChild(img);
      holder.style.display = 'block';
    }

    return { canvas: canvas, size: size };
  }

  /* ================================================================
     [6] GENERATE BARCODE
     ================================================================ */
  function generateBarcode(payload) {
    const format   = ($('#qrbBarcodeFormat') && $('#qrbBarcodeFormat').value) || 'CODE128';
    const width    = parseInt(($('#qrbBarWidth')  && $('#qrbBarWidth').value)  || '2', 10);
    const height   = parseInt(($('#qrbBarHeight') && $('#qrbBarHeight').value) || '100', 10);
    const showText = ($('#qrbBarShowText') && $('#qrbBarShowText').checked) !== false;
    const color    = ($('#qrbBarColor') && $('#qrbBarColor').value) || '#000000';

    // Validasi input per format (cegah crash + error jelas)
    if (['EAN13', 'EAN8', 'UPC', 'ITF14', 'pharmacode'].indexOf(format) !== -1 && !/^\d+$/.test(payload)) {
      throw new Error('Format ' + format + ' hanya menerima angka.');
    }
    if (format === 'EAN13' && [12, 13].indexOf(payload.length) === -1) {
      throw new Error('EAN13 butuh 12 atau 13 digit angka (contoh: 123456789012).');
    }
    if (format === 'EAN8' && [7, 8].indexOf(payload.length) === -1) {
      throw new Error('EAN8 butuh 7 atau 8 digit angka.');
    }
    if (format === 'UPC' && [11, 12].indexOf(payload.length) === -1) {
      throw new Error('UPC-A butuh 11 atau 12 digit angka.');
    }
    if (format === 'ITF14' && payload.length !== 14) {
      throw new Error('ITF-14 butuh tepat 14 digit angka.');
    }

    // Buat SVG element
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    try {
      window.JsBarcode(svg, payload, {
        format: format,
        width: width,
        height: height,
        displayValue: showText,
        lineColor: color,
        background: '#ffffff',
        margin: 10,
        font: 'Inter, sans-serif',
        fontSize: 16,
        textMargin: 4,
        valid: function () { /* suppress internal console error */ }
      });
    } catch (err) {
      throw new Error('Barcode gagal: ' + (err && err.message ? err.message : 'Periksa format & data.'));
    }

    state.barcodeSvgString = svg.outerHTML;

    // Render ke holder
    const holder = $('#qrbBarcodeHolder');
    if (holder) {
      holder.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'qrb-barcode-wrap';
      wrap.style.maxWidth = '100%';
      wrap.appendChild(svg.cloneNode(true));
      holder.appendChild(wrap);
      holder.style.display = 'block';
    }

    return svg;
  }

  /* ================================================================
     [7] SVG → PNG (untuk download ULTRA HD)
     ================================================================ */
  function renderSvgToPng(svgEl, scale) {
    scale = scale || 4;
    return new Promise((resolve, reject) => {
      try {
        if (!svgEl) return reject(new Error('SVG tidak ditemukan.'));

        // Ambil dimensi
        let w = parseFloat(svgEl.getAttribute('width'));
        let h = parseFloat(svgEl.getAttribute('height'));

        // Fallback ke viewBox
        if (!w || !h) {
          const vb = (svgEl.getAttribute('viewBox') || '').split(/\s+/).map(Number);
          if (vb.length === 4) { w = vb[2]; h = vb[3]; }
        }
        if (!w || !h) {
          const bb = svgEl.getBoundingClientRect();
          w = bb.width  || 400;
          h = bb.height || 150;
        }

        // Clone + pastikan width/height/xmlns untuk serialisasi
        const clone = svgEl.cloneNode(true);
        if (!clone.getAttribute('width'))  clone.setAttribute('width',  w);
        if (!clone.getAttribute('height')) clone.setAttribute('height', h);
        if (!clone.getAttribute('xmlns'))  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const xml   = new XMLSerializer().serializeToString(clone);
        const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          try {
            const canvas = document.createElement('canvas');
            canvas.width  = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(new Error('Render canvas gagal: ' + e.message));
          }
        };
        img.onerror = function () {
          reject(new Error('Render PNG gagal (SVG tidak bisa dimuat).'));
        };
        img.src = svg64;
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ================================================================
     [8] TRIGGER GENERATE
     ================================================================ */
  async function handleGenerate() {
    const btn = $('#qrbGenerateBtn');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }

    try {
      await waitForLib('QRCode');
      await waitForLib('JsBarcode');

      const payload = buildPayload();
      state.lastPayload     = payload;
      state.lastType        = ($('#qrbType') && $('#qrbType').value) || 'text';
      state.lastGeneratedAt = Date.now();

      // Hide semua holder dulu
      const qrHolder  = $('#qrbQrHolder');
      const barHolder = $('#qrbBarcodeHolder');
      const empty     = $('#qrbEmptyState');
      if (qrHolder)  qrHolder.style.display  = 'none';
      if (barHolder) barHolder.style.display = 'none';
      if (empty)     empty.style.display     = 'none';

      if (state.mode === 'qris') {
        await generateQR(payload);
      } else {
        generateBarcode(payload);
      }

      // Info panel
      const info = $('#qrbPreviewInfo');
      if (info) {
        info.style.display = 'grid';
        const infoType = $('#qrbInfoType');
        const infoSize = $('#qrbInfoSize');
        const infoData = $('#qrbInfoData');
        if (infoType) infoType.textContent = state.mode === 'qris' ? 'QRIS / QR' : 'Barcode';
        if (infoSize) {
          infoSize.textContent = state.mode === 'qris'
            ? (parseInt($('#qrbSize').value, 10) + ' px')
            : ($('#qrbBarWidth').value + ' × ' + $('#qrbBarHeight').value + ' px');
        }
        if (infoData) {
          infoData.textContent = payload.length > 30 ? payload.slice(0, 27) + '…' : payload;
        }
      }

      const dlRow = $('#qrbDownloadRow');
      if (dlRow) dlRow.style.display = 'flex';

      showToast('✅ Kode berhasil di-generate!', 'success');
      History.add(payload, state.lastType, state.mode);

      if (IRGXY.Activity) IRGXY.Activity.add('download', 'Generate ' + state.mode.toUpperCase());
    } catch (err) {
      console.error('[QRB] Generate error:', err);
      showToast('❌ ' + (err.message || 'Gagal generate.'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    }
  }

  /* ================================================================
     [9] DOWNLOAD PNG (ULTRA HD)
     ================================================================ */
  async function downloadPng() {
    try {
      if (state.mode === 'qris') {
        if (!state.qrDataUrl) throw new Error('Generate dulu sebelum download.');
        triggerDownload(state.qrDataUrl, 'qris-' + Date.now() + '.png');
        showToast('✅ PNG QR berhasil di-download.', 'success');
      } else {
        const svg = $('#qrbBarcodeHolder svg');
        if (!svg) throw new Error('Generate dulu sebelum download.');
        const pngUrl = await renderSvgToPng(svg, 4);
        triggerDownload(pngUrl, 'barcode-' + Date.now() + '.png');
        showToast('✅ PNG Barcode (4× HD) berhasil di-download.', 'success');
      }
      if (IRGXY.Activity) IRGXY.Activity.add('download', 'Download ' + state.mode.toUpperCase() + ' PNG');
    } catch (err) {
      console.error('[QRB] Download PNG error:', err);
      showToast('❌ ' + err.message, 'error');
    }
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ================================================================
     [10] DOWNLOAD SVG
     ================================================================ */
  function downloadSvg() {
    try {
      let svgString = null;
      if (state.mode === 'qris') {
        svgString = state.qrSvgString;
      } else {
        const svgEl = $('#qrbBarcodeHolder svg');
        svgString = svgEl ? svgEl.outerHTML : null;
      }
      if (!svgString) throw new Error('Generate dulu sebelum download.');

      // Pastikan xmlns ada
      if (svgString.indexOf('xmlns=') === -1) {
        svgString = svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      }

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      triggerDownload(url, (state.mode === 'qris' ? 'qris-' : 'barcode-') + Date.now() + '.svg');
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      showToast('✅ SVG berhasil di-download.', 'success');
      if (IRGXY.Activity) IRGXY.Activity.add('download', 'Download ' + state.mode.toUpperCase() + ' SVG');
    } catch (err) {
      console.error('[QRB] Download SVG error:', err);
      showToast('❌ ' + err.message, 'error');
    }
  }

  /* ================================================================
     [11] COPY IMAGE KE CLIPBOARD
     ================================================================ */
  async function copyImage() {
    try {
      if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
        throw new Error('Browser tidak mendukung copy gambar ke clipboard.');
      }

      let dataUrl;
      if (state.mode === 'qris') {
        if (!state.qrDataUrl) throw new Error('Generate dulu.');
        dataUrl = state.qrDataUrl;
      } else {
        const svg = $('#qrbBarcodeHolder svg');
        if (!svg) throw new Error('Generate dulu.');
        dataUrl = await renderSvgToPng(svg, 3);
      }

      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
      showToast('✅ Gambar disalin ke clipboard!', 'success');
    } catch (err) {
      console.error('[QRB] Copy image error:', err);
      showToast('❌ ' + err.message, 'error');
    }
  }

  /* ================================================================
     [12] PRINT — buka window baru bersih
     ================================================================ */
  function handlePrint() {
    try {
      const holderId = state.mode === 'qris' ? '#qrbQrHolder' : '#qrbBarcodeHolder';
      const holder = $(holderId);
      const node = holder && holder.firstElementChild;
      if (!node) throw new Error('Generate dulu sebelum print.');

      // Prefer SVG untuk kualitas cetak maksimal
      let contentHTML = '';
      if (state.mode === 'qris' && state.qrSvgString) {
        contentHTML = state.qrSvgString;
      } else if (state.mode === 'barcode') {
        const svg = holder.querySelector('svg');
        contentHTML = svg ? svg.outerHTML : node.outerHTML;
      } else {
        contentHTML = node.outerHTML;
      }

      const w = window.open('', '_blank', 'width=900,height=720');
      if (!w) throw new Error('Popup diblokir browser. Izinkan popup untuk print.');

      w.document.open();
      w.document.write(
        '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<title>Print QR/Barcode — IRGXYMODS</title>' +
        '<style>' +
        'body{margin:0;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,-apple-system,sans-serif;background:#fff;}' +
        'img,svg{max-width:90vw;max-height:78vh;image-rendering:pixelated;}' +
        '.print-title{font-size:14px;color:#666;margin-top:20px;letter-spacing:0.3px;}' +
        '.print-brand{font-size:11px;color:#999;margin-top:6px;}' +
        '</style></head><body>' +
        contentHTML +
        '<div class="print-title">Dicetak dari IRGXYMODS — Generator QRIS &amp; Barcode</div>' +
        '<div class="print-brand">© 2025 IRGXYMODS</div>' +
        '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.focus();window.print();},400);};</scr' + 'ipt>' +
        '</body></html>'
      );
      w.document.close();
      showToast('🖨️ Jendela print dibuka.', 'info');
    } catch (err) {
      console.error('[QRB] Print error:', err);
      showToast('❌ ' + err.message, 'error');
    }
  }

  /* ================================================================
     [13] SHARE
     ================================================================ */
  async function handleShare() {
    try {
      const payload = state.lastPayload;
      if (!payload) throw new Error('Generate dulu sebelum share.');

      if (navigator.share) {
        await navigator.share({
          title: 'QRIS / Barcode dari IRGXYMODS',
          text:  payload,
          url:   location.href
        });
        showToast('✅ Berhasil dibagikan.', 'success');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
        showToast('✅ Data disalin (share tidak didukung).', 'success');
      } else {
        window.prompt('Salin data:', payload);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('[QRB] Share error:', err);
      showToast('❌ ' + (err.message || 'Share gagal.'), 'error');
    }
  }

  /* ================================================================
     [14] RIWAYAT (localStorage)
     ================================================================ */
  const History = {
    KEY: 'irgxy_qrb_history',

    load: function () {
      try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
      catch (e) { return []; }
    },

    save: function (list) {
      try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, 20))); }
      catch (e) { /* quota full — abaikan */ }
    },

    add: function (payload, type, mode) {
      const list = this.load();
      // Hindari duplikat berurutan
      if (list[0] && list[0].payload === payload && list[0].mode === mode) {
        list[0].time = Date.now();
      } else {
        list.unshift({ payload: payload, type: type, mode: mode, time: Date.now() });
      }
      this.save(list);
      this.render();
    },

    clear: function () {
      try { localStorage.removeItem(this.KEY); } catch (e) {}
      this.render();
      showToast('🗑️ Riwayat dibersihkan.', 'info');
    },

    render: function () {
      const wrap = $('#qrbHistoryList');
      if (!wrap) return;
      const list = this.load();

      if (!list.length) {
        wrap.innerHTML = '<div class="qrb-history-empty">Belum ada riwayat.</div>';
        return;
      }

      wrap.innerHTML = list.map(function (item, idx) {
        const preview = item.payload.length > 40 ? item.payload.slice(0, 37) + '…' : item.payload;
        const modeIcon = item.mode === 'qris' ? 'fa-qrcode' : 'fa-barcode';
        return (
          '<div class="qrb-history-item" data-idx="' + idx + '">' +
            '<div class="hi-icon"><i class="fas ' + modeIcon + '"></i></div>' +
            '<div class="hi-content">' +
              '<div class="hi-name">' + escapeHtml(preview) + '</div>' +
              '<div class="hi-meta">' + escapeHtml(String(item.type).toUpperCase()) + ' • ' +
                escapeHtml(String(item.mode).toUpperCase()) + ' • ' + timeAgo(item.time) + '</div>' +
            '</div>' +
            '<button class="hi-reuse" title="Pakai lagi" type="button"><i class="fas fa-rotate-right"></i></button>' +
          '</div>'
        );
      }).join('');

      // Bind click handler
      $$('.qrb-history-item', wrap).forEach(function (el) {
        el.addEventListener('click', function (e) {
          const idx = parseInt(el.dataset.idx, 10);
          const list2 = History.load();
          const item = list2[idx];
          if (!item) return;

          const input = $('#qrbInput');
          const sel   = $('#qrbType');

          if (input) {
            input.value = item.payload;
            input.dispatchEvent(new Event('input'));
          }

          if (e.target.closest('.hi-reuse')) {
            // Reuse + auto-generate
            if (sel) {
              sel.value = item.type;
              switchType(item.type);
            }
            const radio = document.querySelector('input[name="qrbMode"][value="' + item.mode + '"]');
            if (radio) {
              radio.checked = true;
              state.mode = item.mode;
              const qrSet  = $('#qrbQrSettings');
              const barSet = $('#qrbBarcodeSettings');
              if (qrSet)  qrSet.style.display  = state.mode === 'qris'    ? 'block' : 'none';
              if (barSet) barSet.style.display = state.mode === 'barcode' ? 'block' : 'none';
            }
            handleGenerate();
            showToast('🔄 Data dimuat ulang dari riwayat.', 'info');
          }
        });
      });
    }
  };

  function timeAgo(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60)    return 'baru saja';
    if (d < 3600)  return Math.floor(d / 60) + ' menit lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    return Math.floor(d / 86400) + ' hari lalu';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ================================================================
     [15] DYNAMIC FIELDS (WiFi / vCard)
     ================================================================ */
  function switchType(type) {
    const wrap = $('#qrbDynamicFields');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (type === 'wifi') {
      wrap.innerHTML =
        '<div class="qrb-field">' +
          '<label class="qrb-label" for="qrbWifiPass">Password WiFi</label>' +
          '<input type="text" id="qrbWifiPass" class="qrb-input" placeholder="password" autocomplete="off" />' +
        '</div>' +
        '<div class="qrb-field">' +
          '<label class="qrb-label" for="qrbWifiEnc">Keamanan</label>' +
          '<select id="qrbWifiEnc" class="qrb-select">' +
            '<option value="WPA">WPA/WPA2</option>' +
            '<option value="WEP">WEP</option>' +
            '<option value="nopass">Tanpa Password</option>' +
          '</select>' +
        '</div>';
    } else if (type === 'vcard') {
      wrap.innerHTML =
        '<div class="qrb-field">' +
          '<label class="qrb-label" for="qrbVcardTel">Telepon</label>' +
          '<input type="tel" id="qrbVcardTel" class="qrb-input" placeholder="08123456789" autocomplete="off" />' +
        '</div>' +
        '<div class="qrb-field">' +
          '<label class="qrb-label" for="qrbVcardMail">Email</label>' +
          '<input type="email" id="qrbVcardMail" class="qrb-input" placeholder="email@contoh.com" autocomplete="off" />' +
        '</div>';
    }
  }

  /* ================================================================
     [16] EVENT BINDING
     ================================================================ */
  function bind() {
    // Input counter
    const input = $('#qrbInput');
    if (input) {
      input.addEventListener('input', function (e) {
        const c = $('#qrbCharCount');
        if (c) c.textContent = e.target.value.length + ' karakter';
      });
    }

    // Type switch
    const typeSel = $('#qrbType');
    if (typeSel) {
      typeSel.addEventListener('change', function (e) {
        switchType(e.target.value);
      });
    }

    // Mode radio
    $$('input[name="qrbMode"]').forEach(function (r) {
      r.addEventListener('change', function (e) {
        state.mode = e.target.value;
        const qrSet  = $('#qrbQrSettings');
        const barSet = $('#qrbBarcodeSettings');
        if (qrSet)  qrSet.style.display  = state.mode === 'qris'    ? 'block' : 'none';
        if (barSet) barSet.style.display = state.mode === 'barcode' ? 'block' : 'none';
      });
    });

    // Sliders
    const sizeSlider = $('#qrbSize');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', function (e) {
        const v = $('#qrbSizeVal');
        if (v) v.textContent = e.target.value;
      });
    }
    const wSlider = $('#qrbBarWidth');
    if (wSlider) {
      wSlider.addEventListener('input', function (e) {
        const v = $('#qrbBarWidthVal');
        if (v) v.textContent = e.target.value;
      });
    }
    const hSlider = $('#qrbBarHeight');
    if (hSlider) {
      hSlider.addEventListener('input', function (e) {
        const v = $('#qrbBarHeightVal');
        if (v) v.textContent = e.target.value;
      });
    }

    // Action buttons
    const genBtn = $('#qrbGenerateBtn');     if (genBtn) genBtn.addEventListener('click', handleGenerate);
    const pngBtn = $('#qrbDownloadPngBtn');  if (pngBtn) pngBtn.addEventListener('click', downloadPng);
    const svgBtn = $('#qrbDownloadSvgBtn');  if (svgBtn) svgBtn.addEventListener('click', downloadSvg);
    const cpyBtn = $('#qrbCopyImgBtn');      if (cpyBtn) cpyBtn.addEventListener('click', copyImage);
    const prtBtn = $('#qrbPrintBtn');        if (prtBtn) prtBtn.addEventListener('click', handlePrint);
    const shrBtn = $('#qrbShareBtn');        if (shrBtn) shrBtn.addEventListener('click', handleShare);
    const clrH   = $('#qrbClearHistoryBtn'); if (clrH)   clrH.addEventListener('click', function () { History.clear(); });

    // Paste
    const pasteBtn = $('#qrbPasteBtn');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async function () {
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) {
            throw new Error('Clipboard API tidak didukung.');
          }
          const txt = await navigator.clipboard.readText();
          const inp = $('#qrbInput');
          if (inp) {
            inp.value = txt;
            inp.dispatchEvent(new Event('input'));
          }
          showToast('📋 Teks ditempel.', 'info');
        } catch (err) {
          showToast('❌ Tidak bisa akses clipboard: ' + err.message, 'error');
        }
      });
    }

    // Clear
    const clearBtn = $('#qrbClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        const inp = $('#qrbInput');
        if (inp) {
          inp.value = '';
          inp.dispatchEvent(new Event('input'));
          inp.focus();
        }
      });
    }

    // Random sample
    const randBtn = $('#qrbRandomBtn');
    if (randBtn) {
      randBtn.addEventListener('click', function () {
        const samples = [
          'https://irgxymods.my.id',
          'Halo dari IRGXYMODS 👋',
          '08123456789',
          'https://t.me/irgxyzmods',
          'QRIS-MERCHANT-CONTOH-123',
          'https://google.com'
        ];
        const inp = $('#qrbInput');
        if (inp) {
          inp.value = samples[Math.floor(Math.random() * samples.length)];
          inp.dispatchEvent(new Event('input'));
        }
      });
    }

    // Reset tanpa reload
    const resetBtn = $('#qrbResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        const inp = $('#qrbInput');
        if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input')); }
        const typeSel2 = $('#qrbType');
        if (typeSel2) { typeSel2.value = 'text'; switchType('text'); }

        const qrHolder  = $('#qrbQrHolder');
        const barHolder = $('#qrbBarcodeHolder');
        const empty     = $('#qrbEmptyState');
        const info      = $('#qrbPreviewInfo');
        const dlRow     = $('#qrbDownloadRow');
        if (qrHolder)  qrHolder.style.display  = 'none';
        if (barHolder) barHolder.style.display = 'none';
        if (empty)     empty.style.display     = 'block';
        if (info)      info.style.display      = 'none';
        if (dlRow)     dlRow.style.display     = 'none';

        state.qrDataUrl = null;
        state.qrSvgString = null;
        state.barcodeSvgString = null;
        state.lastPayload = '';
        showToast('🔄 Form direset.', 'info');
      });
    }

    // FAQ accordion
    $$('.qrb-faq-q').forEach(function (q) {
      q.addEventListener('click', function () {
        const item = q.parentElement;
        if (item) item.classList.toggle('open');
      });
    });

    // Enter di input → generate
    if (input) {
      input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleGenerate();
        }
      });
    }
  }

  /* ================================================================
     [17] INIT — auto-run saat halaman siap
     ================================================================ */
  function init() {
    // Guard: hanya jalan di halaman qris-barcode.html
    if (!$('#qrbGenerateBtn')) return;

    bind();
    History.render();
    switchType('text');

    // Sembunyikan barcode settings default
    const barSet = $('#qrbBarcodeSettings');
    if (barSet) barSet.style.display = 'none';

    // Sembunyikan download row default
    const dlRow = $('#qrbDownloadRow');
    if (dlRow) dlRow.style.display = 'none';

    console.log('✅ qris-barcode.js ready (v1.0)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM sudah siap (script di-load async/defer)
    init();
  }

  /* ================================================================
     [18] EXPOSE untuk debugging
     ================================================================ */
  window.QRB = Object.assign(window.QRB || {}, {
    version:   '1.0',
    generate:  handleGenerate,
    downloadPng: downloadPng,
    downloadSvg: downloadSvg,
    copyImage: copyImage,
    print:     handlePrint,
    share:     handleShare,
    History:   History
  });

})();