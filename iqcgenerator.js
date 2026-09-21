/* ================================================================
   IQC GENERATOR — iqcgenerator.js (v3.0 — CONTEXT MENU EDITION)
   ================================================================
   Fitur:
     [1] Mode WhatsApp iOS (chat bubble)
     [2] Mode Instagram iOS (chat bubble gradient)
     [3] Mode Custom Theme (warna & font bisa diubah)
     [4] Mode iOS Context Menu (long-press menu + emoji reactions) ← BARU
     [5] Compress Video client-side (MediaRecorder + Canvas)
     [6] Export HD PNG (html2canvas), Copy, Share
   ================================================================ */
(function () {
  'use strict';

  /* ================= GLOBAL ERROR GUARD ================= */
  window.addEventListener('error', (e) => console.warn('[IQC] Runtime error:', e.message));
  window.addEventListener('unhandledrejection', (e) => console.warn('[IQC] Promise rejection:', e.reason));

  /* ================= HELPERS ================= */
  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
  const safe = (fn, fb) => { try { return fn(); } catch (e) { console.warn('[IQC safe]', e); return fb; } };
  const showToast = (msg, type = 'success') => {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else console.log('[IQC Toast]', type, msg);
  };
  const escapeHtml = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const formatBytes = (b) => {
    if (!b || !isFinite(b)) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB','TB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), sizes.length - 1);
    return (b / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
  };
  const formatDuration = (sec) => {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  const humanizeTime = (s) => {
    if (!isFinite(s) || s <= 0) return '--';
    if (s < 60) return s.toFixed(1) + 's';
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return m + 'm ' + sec + 's';
  };
  const debounce = (fn, wait = 200) => {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
  };
  const uid = () => 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  /* ================= STATE ================= */
  const DEFAULT_CM = {
    messageText: 'bumi gonjang ganjing kelas IX-A NIH ANJING!!!',
    messageTime: '16:00',
    messageType: 'in',
    bubbleColor: '#005C4B',
    textColor: '#E9EDEF',
    timeColor: '#8696A0',
    reactions: ['👍','❤️','😂','😮','😢','🙏'],
    statusTime: '16:00',
    statusBattery: 59,
    statusOperator: 'SMARTFREN',
    statusNetwork: '5G',
    darkTheme: true,
    blurAmount: 18,
    dimOpacity: 0.45,
    showReactions: true,
    showContextMenu: true,
    menuItems: [
      { icon:'star',    label:'Beri Bintang', danger:false },
      { icon:'reply',   label:'Balas',        danger:false },
      { icon:'forward', label:'Teruskan',     danger:false },
      { icon:'copy',    label:'Salin',        danger:false },
      { icon:'speak',   label:'Ucapkan',      danger:false },
      { icon:'report',  label:'Laporkan',     danger:false },
      { icon:'trash',   label:'Hapus',        danger:true  }
    ]
  };

  const State = {
    mode: 'whatsapp',
    darkMode: false,
    statusBar: true,
    readReceipt: true,
    typingIndicator: false,
    showWallpaper: true,
    contact: { name: 'Irgxy Mods', status: 'online', avatar: '', headerDate: 'Hari ini' },
    messages: [
      { id: uid(), type: 'in',  text: 'Halo! Selamat datang di IRGXYMODS 👋', time: '09:40', read: true },
      { id: uid(), type: 'out', text: 'Terima kasih! Saya mau coba IQC Generator 🎉', time: '09:41', read: true }
    ],
    custom: {
      bubbleOut: '#DCF8C6', bubbleIn: '#FFFFFF', textColor: '#111111',
      timeColor: '#667781', bgColor: '#EFEAE2', nameColor: '#06CF9C',
      fontSize: 15, radius: 18, opacity: 100, wallpaper: ''
    },
    contextmenu: JSON.parse(JSON.stringify(DEFAULT_CM))
  };
  const STORAGE_KEY = 'irgxy_iqc_prefs_v3';

  /* ================= PERSIST ================= */
  function savePrefs() {
    safe(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: State.mode,
      darkMode: State.darkMode,
      statusBar: State.statusBar,
      readReceipt: State.readReceipt,
      typingIndicator: State.typingIndicator,
      showWallpaper: State.showWallpaper,
      contact: State.contact,
      custom: State.custom,
      contextmenu: State.contextmenu
    })));
  }
  function loadPrefs() {
    safe(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      State.darkMode          = !!d.darkMode;
      State.statusBar         = d.statusBar !== false;
      State.readReceipt       = d.readReceipt !== false;
      State.typingIndicator   = !!d.typingIndicator;
      State.showWallpaper     = d.showWallpaper !== false;
      if (d.contact && typeof d.contact === 'object') Object.assign(State.contact, d.contact);
      if (d.custom  && typeof d.custom  === 'object') Object.assign(State.custom, d.custom);
      if (d.contextmenu && typeof d.contextmenu === 'object') {
        Object.assign(State.contextmenu, d.contextmenu);
        if (!Array.isArray(State.contextmenu.reactions) || !State.contextmenu.reactions.length) {
          State.contextmenu.reactions = DEFAULT_CM.reactions.slice();
        }
        if (!Array.isArray(State.contextmenu.menuItems) || !State.contextmenu.menuItems.length) {
          State.contextmenu.menuItems = JSON.parse(JSON.stringify(DEFAULT_CM.menuItems));
        }
      }
      if (typeof d.mode === 'string' && ['whatsapp','instagram','custom','contextmenu'].includes(d.mode)) {
        State.mode = d.mode;
      }
    });
  }

  /* ================= MESSAGE CRUD ================= */
  function addMessage(type, text, time, read) {
    const t = (text || '').trim();
    if (!t) { showToast('Isi pesan tidak boleh kosong', 'warning'); return; }
    if (t.length > 500) { showToast('Pesan terlalu panjang (max 500 karakter)', 'warning'); return; }
    State.messages.push({
      id: uid(),
      type: type === 'out' ? 'out' : 'in',
      text: t,
      time: time || '09:41',
      read: read !== false
    });
    renderPreview();
    renderMessageList();
    savePrefs();
  }
  function deleteMessage(id) {
    State.messages = State.messages.filter(m => m.id !== id);
    renderPreview(); renderMessageList(); savePrefs();
    showToast('Pesan dihapus', 'info');
  }
  function editMessage(id, newText) {
    const m = State.messages.find(x => x.id === id);
    if (!m) return;
    m.text = String(newText || '').trim();
    if (!m.text) { showToast('Pesan kosong — dibatalkan', 'warning'); return; }
    renderPreview(); renderMessageList(); savePrefs();
    showToast('Pesan diperbarui', 'success');
  }

  /* ================= CHECK ICON ================= */
  function checkIcon(read, delivered = true) {
    const cls = 'iqc-check' + (read ? '' : ' delivered') + (State.darkMode ? ' dark' : '');
    return `<span class="${cls}" aria-label="${read ? 'terbaca' : 'terkirim'}">
      <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.5 9.8L2 5.3l-.9.9 5.4 5.4L17 1.2l-.9-.9-9.6 9.5z"/>
        <path d="M11.2 11.6L6.5 6.9l-.9.9 5.6 5.6L22 2.9l-.9-.9-9.9 9.6z" opacity="${read ? 1 : 0.35}"/>
      </svg>
    </span>`;
  }

  /* ================= BUILD BUBBLE ================= */
  function buildBubbleHTML(msg) {
    const isOut = msg.type === 'out';
    const isIG  = State.mode === 'instagram';
    const isCustom = State.mode === 'custom';

    let cls = 'iqc-bubble ';
    if (isIG) cls += isOut ? 'ig-out' : 'ig-in';
    else      cls += isOut ? 'out'    : 'in';
    if (State.darkMode) cls += ' dark';

    const c = State.custom;
    let style = '';
    if (isCustom) {
      style += `background:${isOut ? c.bubbleOut : c.bubbleIn};`;
      style += `color:${c.textColor};`;
      style += `font-size:${c.fontSize}px;`;
      style += `border-radius:${c.radius}px ${c.radius}px ${isOut ? '4px' : c.radius + 'px'} ${isOut ? c.radius + 'px' : '4px'};`;
    } else {
      style += `font-size:${c.fontSize || 15}px;`;
      style += `border-radius:${c.radius || 18}px ${c.radius || 18}px ${isOut ? '4px' : (c.radius || 18) + 'px'} ${isOut ? (c.radius || 18) + 'px' : '4px'};`;
    }

    const timeColorStyle = isCustom ? `color:${c.timeColor};` : '';
    const showCheck = isOut && !isIG;
    const timeHTML = `<span class="iqc-bubble-time" style="${timeColorStyle}">${escapeHtml(msg.time)}${showCheck ? checkIcon(msg.read !== false) : ''}</span>`;

    return `<div class="${cls}" data-id="${msg.id}" style="${style}">
      <div class="iqc-bubble-content">${escapeHtml(msg.text)}</div>
      ${timeHTML}
    </div>`;
  }

  /* ================= RENDER PREVIEW (anti double-RAF) ================= */
  let _rafPending = false;
  const renderPreview = debounce(function () {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      try { doRenderPreview(); }
      catch (err) { console.warn('[IQC renderPreview]', err); }
    });
  }, 120);

  function doRenderPreview() {
    const container   = $('#iqcChatMessages');
    const chatBg      = $('#iqcChatBg');
    const frame       = $('#iqcPhoneFrame');
    const statusBar   = $('#iqcStatusBar');
    const chatHeader  = $('#iqcChatHeader');
    const contactName = $('#iqcChatContactName');
    const contactStat = $('#iqcChatContactStatus');
    const chatAvatar  = $('#iqcChatAvatar');
    if (!container || !chatBg || !frame) return;

    /* Reset padding bila sebelumnya mode context menu */
    chatBg.style.padding = '';

    /* ================= MODE CONTEXT MENU — handle terpisah ================= */
    if (State.mode === 'contextmenu') {
      if (chatHeader) chatHeader.style.display = 'none';
      return renderContextMenuPreview();
    } else {
      if (chatHeader) chatHeader.style.display = 'flex';
    }

    /* ================= MODE LAIN (WA / IG / Custom) ================= */

    /* Frame */
    frame.classList.toggle('dark-frame', State.darkMode);

    /* Status bar — restore original content kalau pernah diubah context menu */
    if (statusBar) {
      statusBar.style.display = State.statusBar ? 'flex' : 'none';
      const left  = statusBar.querySelector('.iqc-status-left');
      const notch = statusBar.querySelector('.iqc-status-notch');
      const right = statusBar.querySelector('.iqc-status-right');
      if (left)  left.textContent = '9:41';
      if (notch) notch.textContent = '';
      if (right && right.dataset.cmOverridden === '1') {
        right.dataset.cmOverridden = '';
        right.innerHTML = `
          <svg viewBox="0 0 18 12" width="17" height="11"><path fill="currentColor" d="M1 10h2v-2H1v2zm3 0h2V6H4v4zm3 0h2V3H7v7zm3 0h2V0h-2v10z"/></svg>
          <svg viewBox="0 0 16 12" width="15" height="11"><path fill="currentColor" d="M8 3.2L1.4 9.8l1.1 1.1L8 5.4l5.5 5.5 1.1-1.1L8 3.2zM8 0L.2 7.8l1.1 1.1L8 2.2l6.7 6.7 1.1-1.1L8 0z"/></svg>
          <svg viewBox="0 0 25 12" width="24" height="11"><rect x="0" y="1" width="22" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="2" y="3" width="16" height="6" rx="1" fill="currentColor"/><rect x="23" y="4" width="1.5" height="4" rx="0.7" fill="currentColor"/></svg>`;
      }
    }

    /* Chat background */
    chatBg.classList.toggle('dark', State.darkMode);
    chatBg.classList.toggle('has-wallpaper', State.showWallpaper);
    chatBg.classList.toggle('no-wallpaper', !State.showWallpaper);
    chatBg.style.backgroundImage = '';
    chatBg.style.backgroundSize  = '';
    chatBg.style.backgroundPosition = '';
    chatBg.style.background = '';
    chatBg.style.filter = '';

    if (State.mode === 'instagram') {
      chatBg.style.background = State.darkMode ? '#000000' : '#FFFFFF';
    } else if (State.mode === 'custom') {
      const c = State.custom;
      const alpha = clamp(c.opacity / 100, 0.2, 1).toFixed(2);
      const hex = /^#[0-9a-fA-F]{6}$/.test(c.bgColor) ? c.bgColor : '#EFEAE2';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      chatBg.style.background = `rgba(${r},${g},${b},${alpha})`;
      if (c.wallpaper) {
        chatBg.style.backgroundImage = `url("${c.wallpaper.replace(/"/g, '\\"')}")`;
        chatBg.style.backgroundSize  = 'cover';
        chatBg.style.backgroundPosition = 'center';
      }
    } else {
      chatBg.style.background = State.darkMode ? '#0B141A' : '#EFEAE2';
    }

    /* Header */
    if (chatHeader) chatHeader.style.background = State.darkMode ? '#1F2C33' : '#F6F6F6';
    if (contactName) {
      contactName.textContent = State.contact.name || 'Kontak';
      if (State.mode === 'custom') contactName.style.color = State.custom.nameColor;
      else contactName.style.color = '';
    }
    if (contactStat) contactStat.textContent = State.contact.status || 'online';

    /* Avatar dengan anti-loop onerror */
    if (chatAvatar) {
      const fallback = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23007AFF"/><text x="20" y="27" font-size="22" text-anchor="middle" fill="white" font-family="Arial">I</text></svg>';
      const src = State.contact.avatar || fallback;
      const img = chatAvatar.querySelector('img');
      if (img) {
        img.dataset.fallbackApplied = '';
        img.onerror = function () {
          if (this.dataset.fallbackApplied) return;
          this.dataset.fallbackApplied = '1';
          this.src = fallback;
        };
        if (img.src !== src) img.src = src;
      } else {
        chatAvatar.innerHTML = '';
        const newImg = document.createElement('img');
        newImg.alt = 'Avatar';
        newImg.onerror = function () {
          if (this.dataset.fallbackApplied) return;
          this.dataset.fallbackApplied = '1';
          this.src = fallback;
        };
        newImg.src = src;
        chatAvatar.appendChild(newImg);
      }
    }

    /* Messages */
    let html = '';
    const headerDate = (State.contact.headerDate || '').trim();
    if (headerDate) html += `<div class="iqc-date-pill">${escapeHtml(headerDate)}</div>`;

    if (!State.messages.length) {
      html += '<div style="text-align:center;color:#888;font-size:13px;padding:20px;">Belum ada pesan — tambahkan di panel kiri</div>';
    } else {
      html += State.messages.map(buildBubbleHTML).join('');
    }
    if (State.typingIndicator) {
      html += `<div class="iqc-typing" aria-label="sedang mengetik"><span></span><span></span><span></span></div>`;
    }

    container.innerHTML = html;
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  }

  /* ================= RENDER CONTEXT MENU PREVIEW ================= */
  function renderContextMenuPreview() {
    const container = $('#iqcChatMessages');
    const chatBg    = $('#iqcChatBg');
    const frame     = $('#iqcPhoneFrame');
    if (!container || !chatBg || !frame) return;

    const cm = State.contextmenu || DEFAULT_CM;
    const isDark = cm.darkTheme !== false;
    const bgColor = isDark ? '#0B141A' : '#EFEAE2';

    /* Frame dark */
    frame.classList.toggle('dark-frame', isDark);

    /* Reset background */
    chatBg.classList.remove('has-wallpaper', 'no-wallpaper');
    chatBg.classList.toggle('dark', isDark);
    chatBg.style.background = bgColor;
    chatBg.style.backgroundImage = '';
    chatBg.style.padding = '0';
    chatBg.style.filter = '';

    /* Fake bubbles untuk latar blur */
    const fakeBubbles = [
      { type:'in',  text:'Halo' },
      { type:'out', text:'Oke siap' },
      { type:'in',  text:'Nanti kita bahas ya' },
      { type:'out', text:'Sip 👍' },
      { type:'in',  text:'Oke deh' }
    ];
    const fakeHtml = fakeBubbles.map(b => `
      <div class="iqc-bubble ${b.type}${isDark ? ' dark' : ''}" style="margin:6px 12px;">
        <div class="iqc-bubble-content">${escapeHtml(b.text)}</div>
      </div>`).join('');

    const blurPx = clamp(parseInt(cm.blurAmount, 10) || 18, 5, 30);
    const dimA   = clamp(parseFloat(cm.dimOpacity), 0.2, 0.7) || 0.45;

    /* Emoji reaction */
    const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','EmojiOne Color',sans-serif";
    const reactionsArr = (Array.isArray(cm.reactions) ? cm.reactions : [])
      .map(s => String(s || '').trim()).filter(Boolean).slice(0, 6);
    const reactionsHTML = (cm.showReactions !== false && reactionsArr.length)
      ? `<div class="iqc-cm-reactions" style="font-family:${EMOJI_FONT};">
           ${reactionsArr.map(e => `<span style="font-family:${EMOJI_FONT};">${escapeHtml(e)}</span>`).join('')}
         </div>`
      : '';

    /* Bubble utama */
    const bubbleColor = /^#[0-9a-fA-F]{6}$/.test(cm.bubbleColor) ? cm.bubbleColor : '#005C4B';
    const textColor   = /^#[0-9a-fA-F]{6}$/.test(cm.textColor)   ? cm.textColor   : '#E9EDEF';
    const timeColor   = /^#[0-9a-fA-F]{6}$/.test(cm.timeColor)   ? cm.timeColor   : '#8696A0';
    const msgType     = cm.messageType === 'out' ? 'out' : 'in';
    const msgText     = String(cm.messageText || '').slice(0, 300);
    const msgTime     = /^\d{2}:\d{2}$/.test(cm.messageTime) ? cm.messageTime : '16:00';

    const bubbleHTML = `
      <div class="iqc-cm-bubble ${msgType}" style="background:${bubbleColor};color:${textColor};">
        <div class="iqc-cm-bubble-content">${escapeHtml(msgText)}</div>
        <div class="iqc-cm-bubble-time" style="color:${timeColor};">${escapeHtml(msgTime)}</div>
      </div>`;

    /* Context menu */
    const menuIcons = {
      star:'fa-star', reply:'fa-reply', forward:'fa-share',
      copy:'fa-copy', speak:'fa-comment-dots',
      report:'fa-exclamation-triangle', trash:'fa-trash'
    };
    const menuItems = (Array.isArray(cm.menuItems) && cm.menuItems.length)
      ? cm.menuItems
      : DEFAULT_CM.menuItems;
    const menuHTML = (cm.showContextMenu !== false)
      ? `<div class="iqc-cm-menu">
           ${menuItems.map(it => `
             <button class="iqc-cm-item${it.danger ? ' danger' : ''}" data-action="${escapeHtml(it.icon)}" type="button">
               <span>${escapeHtml(it.label)}</span>
               <i class="fas ${menuIcons[it.icon] || 'fa-circle'}"></i>
             </button>`).join('')}
         </div>`
      : '';

    /* Gabungkan */
    container.innerHTML = `
      <div class="iqc-cm-blurred-bg" style="filter:blur(${blurPx}px);">${fakeHtml}</div>
      <div class="iqc-cm-dim" style="background:rgba(0,0,0,${dimA});"></div>
      <div class="iqc-cm-stage">
        ${reactionsHTML}
        ${bubbleHTML}
        ${menuHTML}
      </div>`;

    /* ---- Update status bar ---- */
    const statusEl = $('#iqcStatusBar');
    if (statusEl) {
      statusEl.style.display = State.statusBar ? 'flex' : 'none';
      const left  = statusEl.querySelector('.iqc-status-left');
      const notch = statusEl.querySelector('.iqc-status-notch');
      const right = statusEl.querySelector('.iqc-status-right');
      const op = String(cm.statusOperator || 'SMARTFREN').slice(0, 15);
      const net = String(cm.statusNetwork || '5G').slice(0, 5);
      const stTime = /^\d{2}:\d{2}$/.test(cm.statusTime) ? cm.statusTime : '16:00';
      const pct = clamp(parseInt(cm.statusBattery, 10) || 0, 0, 100);

      if (left)  left.textContent  = `${op}  ${net}`;
      if (notch) notch.textContent = stTime;
      if (right) {
        right.dataset.cmOverridden = '1';
        const fillW = Math.round(16 * pct / 100);
        right.innerHTML = `
          <span style="font-weight:600;font-size:12px;color:inherit;">${pct}%</span>
          <svg viewBox="0 0 25 12" width="24" height="11">
            <rect x="0" y="1" width="22" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1"/>
            <rect x="2" y="3" width="${fillW}" height="6" rx="1" fill="currentColor"/>
            <rect x="23" y="4" width="1.5" height="4" rx="0.7" fill="currentColor"/>
          </svg>`;
      }
    }
  }

  /* ================= RENDER MESSAGE LIST ================= */
  function renderMessageList() {
    const list = $('#iqcMessageList');
    if (!list) return;
    if (!State.messages.length) {
      list.innerHTML = `<div class="iqc-empty-state"><i class="fas fa-inbox"></i>Belum ada pesan. Tambahkan dengan tombol di atas.</div>`;
      return;
    }
    list.innerHTML = State.messages.map(m => `
      <div class="iqc-message-item" data-id="${m.id}">
        <span class="iqc-mi-badge ${m.type}">${m.type === 'in' ? 'IN' : 'OUT'}</span>
        <span class="iqc-mi-text" title="${escapeHtml(m.text)}">${escapeHtml(m.text)}</span>
        <span class="iqc-mi-actions">
          <button type="button" class="iqc-mi-edit" data-id="${m.id}" aria-label="Edit"><i class="fas fa-pen"></i></button>
          <button type="button" class="iqc-mi-del" data-id="${m.id}" aria-label="Hapus"><i class="fas fa-trash"></i></button>
        </span>
      </div>`).join('');

    $$('.iqc-mi-edit', list).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const msg = State.messages.find(x => x.id === id);
        if (!msg) return;
        const nt = prompt('Edit pesan:', msg.text);
        if (nt !== null) editMessage(id, nt);
      });
    });
    $$('.iqc-mi-del', list).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Hapus pesan ini?')) deleteMessage(id);
      });
    });
  }

  /* ================= TABS ================= */
  function initTabs() {
    const tabs = $$('.iqc-tab');
    const customCard = $('#iqcCustomCard');
    const cmCard = $('#iqcContextMenuCard');
    if (!tabs.length) return;

    const applyMode = (mode) => {
      State.mode = mode;
      if (customCard) customCard.style.display = (mode === 'custom') ? 'block' : 'none';
      if (cmCard)     cmCard.style.display     = (mode === 'contextmenu') ? 'block' : 'none';
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode') || 'whatsapp';
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        applyMode(mode);
        renderPreview();
        savePrefs();
      });
    });

    const savedTab = tabs.find(t => t.getAttribute('data-mode') === State.mode);
    if (savedTab) {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      savedTab.classList.add('active');
      savedTab.setAttribute('aria-selected', 'true');
    }
    applyMode(State.mode);
  }

  /* ================= FORM HANDLERS ================= */
  function incrementTime(hhmm) {
    try {
      const [h, m] = String(hhmm || '09:41').split(':').map(n => parseInt(n, 10) || 0);
      const total = (h * 60 + m + 1) % (24 * 60);
      return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    } catch { return hhmm || '09:41'; }
  }

  function initForm() {
    const nameInput   = $('#iqcContactName');
    const statusInput = $('#iqcContactStatus');
    const dateInput   = $('#iqcHeaderDate');
    const msgText     = $('#iqcMsgText');
    const msgTime     = $('#iqcMsgTime');
    const addIn       = $('#iqcAddIn');
    const addOut      = $('#iqcAddOut');

    if (nameInput)   nameInput.value   = State.contact.name;
    if (statusInput) statusInput.value = State.contact.status;
    if (dateInput)   dateInput.value   = State.contact.headerDate;

    nameInput?.addEventListener('input', () => {
      State.contact.name = nameInput.value.trim() || 'Kontak';
      renderPreview(); savePrefs();
    });
    statusInput?.addEventListener('input', () => {
      State.contact.status = statusInput.value.trim();
      renderPreview(); savePrefs();
    });
    dateInput?.addEventListener('input', () => {
      State.contact.headerDate = dateInput.value;
      renderPreview(); savePrefs();
    });

    if (msgTime && !msgTime.value) {
      const now = new Date();
      msgTime.value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function submitMessage(type) {
      const txt = (msgText?.value || '').trim();
      const tm  = (msgTime?.value || '09:41').trim();
      if (!txt) { showToast('Tulis pesan terlebih dahulu', 'warning'); msgText?.focus(); return; }
      addMessage(type, txt, tm);
      if (msgText) msgText.value = '';
      if (msgTime) msgTime.value = incrementTime(tm);
      msgText?.focus();
    }

    addIn?.addEventListener('click',  () => submitMessage('in'));
    addOut?.addEventListener('click', () => submitMessage('out'));

    msgText?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const last = State.messages[State.messages.length - 1];
        submitMessage(last && last.type === 'out' ? 'in' : 'out');
      }
    });
  }

  /* ================= AVATAR UPLOAD ================= */
  function initAvatarUpload() {
    const urlInput  = $('#iqcAvatarUrl');
    const fileInput = $('#iqcAvatarInput');
    const uploadBtn = $('#iqcAvatarUploadBtn');

    urlInput?.addEventListener('input', () => {
      State.contact.avatar = urlInput.value.trim();
      renderPreview(); savePrefs();
    });
    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('File harus berupa gambar', 'error'); return; }
      if (file.size > 2 * 1024 * 1024) { showToast('Ukuran gambar max 2MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        State.contact.avatar = ev.target.result;
        if (urlInput) urlInput.value = '(uploaded)';
        renderPreview(); savePrefs();
        showToast('Avatar diupload', 'success');
      };
      reader.onerror = () => showToast('Gagal membaca file', 'error');
      reader.readAsDataURL(file);
    });
  }

  /* ================= COLOR PICKERS ================= */
  function initColorPickers() {
    const map = {
      iqcColorOut: 'bubbleOut', iqcColorIn: 'bubbleIn', iqcColorText: 'textColor',
      iqcColorTime: 'timeColor', iqcColorBg: 'bgColor', iqcColorName: 'nameColor'
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = $('#' + id);
      if (!el) return;
      el.value = State.custom[key];
      el.addEventListener('input', () => {
        State.custom[key] = el.value;
        renderPreview(); savePrefs();
      });
    });

    const bindSlider = (id, valId, key, min, max, def) => {
      const el = $('#' + id), valEl = $('#' + valId);
      if (!el) return;
      el.value = State.custom[key];
      if (valEl) valEl.textContent = State.custom[key];
      el.addEventListener('input', () => {
        State.custom[key] = clamp(parseInt(el.value, 10) || def, min, max);
        if (valEl) valEl.textContent = State.custom[key];
        renderPreview(); savePrefs();
      });
    };
    bindSlider('iqcFontSize', 'iqcFontSizeVal', 'fontSize', 12, 20, 15);
    bindSlider('iqcRadius',   'iqcRadiusVal',   'radius',   0, 30, 18);
    bindSlider('iqcOpacity',  'iqcOpacityVal',  'opacity', 20, 100, 100);
  }

  /* ================= TOGGLE SWITCHES ================= */
  function initToggleSwitches() {
    const bind = (id, key) => {
      const el = $('#' + id);
      if (!el) return;
      el.checked = !!State[key];
      el.addEventListener('change', () => {
        State[key] = el.checked;
        renderPreview(); savePrefs();
      });
    };
    bind('iqcToggleDark', 'darkMode');
    bind('iqcToggleStatusBar', 'statusBar');
    bind('iqcToggleRead', 'readReceipt');
    bind('iqcToggleTyping', 'typingIndicator');
    bind('iqcToggleWallpaper', 'showWallpaper');
  }

  /* ================= WALLPAPER UPLOAD ================= */
  function initWallpaper() {
    const urlInput  = $('#iqcWallpaperUrl');
    const fileInput = $('#iqcWallpaperInput');
    const uploadBtn = $('#iqcWallpaperUploadBtn');

    urlInput?.addEventListener('input', () => {
      State.custom.wallpaper = urlInput.value.trim();
      renderPreview(); savePrefs();
    });
    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('File harus berupa gambar', 'error'); return; }
      if (file.size > 3 * 1024 * 1024) { showToast('Ukuran wallpaper max 3MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        State.custom.wallpaper = ev.target.result;
        if (urlInput) urlInput.value = '(uploaded)';
        renderPreview(); savePrefs();
        showToast('Wallpaper diupload', 'success');
      };
      reader.onerror = () => showToast('Gagal membaca file', 'error');
      reader.readAsDataURL(file);
    });
  }

  /* ================= CONTEXT MENU FORM ================= */
  function initContextMenuForm() {
    const cm = State.contextmenu;
    if (!cm) return;

    const setVal = (id, v) => { const el = $('#' + id); if (el) el.value = v; };
    const setChecked = (id, v) => { const el = $('#' + id); if (el) el.checked = !!v; };

    setVal('iqcCmMsgText', cm.messageText);
    setVal('iqcCmMsgTime', cm.messageTime);
    setVal('iqcCmMsgType', cm.messageType);
    setVal('iqcCmBubbleColor', cm.bubbleColor);
    setVal('iqcCmTextColor', cm.textColor);
    setVal('iqcCmReactions', Array.isArray(cm.reactions) ? cm.reactions.join(',') : '');
    setVal('iqcCmStatusTime', cm.statusTime);
    setVal('iqcCmOperator', cm.statusOperator);
    setVal('iqcCmNetwork', cm.statusNetwork);
    setVal('iqcCmBattery', cm.statusBattery);
    setVal('iqcCmBlur', cm.blurAmount);
    setVal('iqcCmDim', Math.round((parseFloat(cm.dimOpacity) || 0.45) * 100));
    setChecked('iqcCmDarkTheme', cm.darkTheme);
    setChecked('iqcCmShowReactions', cm.showReactions);
    setChecked('iqcCmShowMenu', cm.showContextMenu);

    const updateLabel = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    updateLabel('iqcCmBatteryVal', cm.statusBattery);
    updateLabel('iqcCmBlurVal', cm.blurAmount);
    updateLabel('iqcCmDimVal', Math.round((parseFloat(cm.dimOpacity) || 0.45) * 100));

    /* Text bindings */
    const bindText = (id, key, transform) => {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        try {
          const v = transform ? transform(el.value) : el.value;
          State.contextmenu[key] = v;
          renderPreview();
          savePrefs();
        } catch (e) { console.warn('[IQC cm bindText]', e); }
      });
    };
    const clampTime = v => /^\d{2}:\d{2}$/.test(v) ? v : '16:00';
    bindText('iqcCmMsgText', 'messageText', v => String(v).slice(0, 300));
    bindText('iqcCmMsgTime', 'messageTime', clampTime);
    bindText('iqcCmBubbleColor', 'bubbleColor');
    bindText('iqcCmTextColor', 'textColor');
    bindText('iqcCmStatusTime', 'statusTime', clampTime);
    bindText('iqcCmOperator', 'statusOperator', v => String(v).slice(0, 15));
    bindText('iqcCmNetwork', 'statusNetwork', v => String(v).slice(0, 5));

    /* Select type */
    const typeSel = $('#iqcCmMsgType');
    if (typeSel) {
      typeSel.addEventListener('change', () => {
        State.contextmenu.messageType = typeSel.value === 'out' ? 'out' : 'in';
        renderPreview(); savePrefs();
      });
    }

    /* Reactions */
    const rEl = $('#iqcCmReactions');
    if (rEl) {
      rEl.addEventListener('input', () => {
        try {
          State.contextmenu.reactions = String(rEl.value)
            .split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
          renderPreview(); savePrefs();
        } catch (e) { console.warn('[IQC cm reactions]', e); }
      });
    }

    /* Sliders */
    const bindSlider = (id, valId, key, transform) => {
      const el = $('#' + id), valEl = $('#' + valId);
      if (!el) return;
      el.addEventListener('input', () => {
        try {
          const raw = parseInt(el.value, 10);
          const v = transform ? transform(raw) : raw;
          State.contextmenu[key] = v;
          if (valEl) valEl.textContent = el.value;
          renderPreview(); savePrefs();
        } catch (e) { console.warn('[IQC cm slider]', e); }
      });
    };
    bindSlider('iqcCmBattery','iqcCmBatteryVal','statusBattery', v => clamp(v, 0, 100));
    bindSlider('iqcCmBlur','iqcCmBlurVal','blurAmount', v => clamp(v, 5, 30));
    bindSlider('iqcCmDim','iqcCmDimVal','dimOpacity', v => clamp(v / 100, 0.2, 0.7));

    /* Toggles */
    const bindToggle = (id, key) => {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('change', () => {
        State.contextmenu[key] = !!el.checked;
        renderPreview(); savePrefs();
      });
    };
    bindToggle('iqcCmDarkTheme', 'darkTheme');
    bindToggle('iqcCmShowReactions', 'showReactions');
    bindToggle('iqcCmShowMenu', 'showContextMenu');
  }

  /* ================= EXPORT — CAPTURE ================= */
  async function captureCanvas(scale = 2) {
    if (typeof html2canvas !== 'function') throw new Error('html2canvas tidak tersedia');
    const frame = $('#iqcPhoneFrame');
    if (!frame) throw new Error('Frame tidak ditemukan');
    return await html2canvas(frame, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      scale: clamp(scale, 1, 4),
      logging: false,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        try {
          /* Ganti backdrop-filter → solid rgba (html2canvas tidak support) */
          clonedDoc.querySelectorAll('.iqc-cm-menu').forEach(el => {
            el.style.backdropFilter = 'none';
            el.style.webkitBackdropFilter = 'none';
            el.style.background = 'rgba(28,28,30,0.98)';
          });
          clonedDoc.querySelectorAll('.iqc-cm-reactions').forEach(el => {
            el.style.backdropFilter = 'none';
            el.style.webkitBackdropFilter = 'none';
            el.style.background = 'rgba(30,30,30,0.96)';
          });
          clonedDoc.querySelectorAll('.iqc-date-pill').forEach(el => {
            el.style.backdropFilter = 'none';
            el.style.webkitBackdropFilter = 'none';
          });

          /* Emoji font fallback */
          const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','EmojiOne Color',sans-serif";
          clonedDoc.querySelectorAll('.iqc-cm-reactions span').forEach(el => {
            el.style.fontFamily = EMOJI_FONT;
          });
        } catch (e) { console.warn('[IQC onclone]', e); }
      }
    });
  }

  async function downloadPNG(scale = 2) {
    const loading = $('#iqcExportLoading');
    const loadingText = $('#iqcExportLoadingText');
    try {
      if (loading) loading.style.display = 'flex';
      if (loadingText) loadingText.textContent = scale >= 3 ? 'Membuat HD PNG (3x)...' : 'Membuat PNG (2x)...';

      const canvas = await captureCanvas(scale);
      await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('toBlob gagal')); return; }
          try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `iqc-${State.mode}-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            resolve();
          } catch (err) { reject(err); }
        }, 'image/png', 0.98);
      });
      showToast('Gambar diunduh!', 'success');
      if (typeof window.addActivity === 'function') window.addActivity('download', 'IQC ' + State.mode);
    } catch (err) {
      console.error('[IQC] downloadPNG:', err);
      showToast('Gagal membuat gambar', 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  async function copyImageToClipboard() {
    const loading = $('#iqcExportLoading');
    const loadingText = $('#iqcExportLoadingText');
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        showToast('Browser tidak mendukung copy gambar', 'warning');
        return;
      }
      if (loading) loading.style.display = 'flex';
      if (loadingText) loadingText.textContent = 'Menyalin gambar...';

      const canvas = await captureCanvas(2);
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('blob null')), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Gambar disalin!', 'success');
    } catch (err) {
      console.error('[IQC] copyImage:', err);
      showToast('Gagal menyalin gambar', 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  async function shareImage() {
    const loading = $('#iqcExportLoading');
    const loadingText = $('#iqcExportLoadingText');
    try {
      if (loading) loading.style.display = 'flex';
      if (loadingText) loadingText.textContent = 'Menyiapkan gambar...';

      const canvas = await captureCanvas(2);
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('blob null')), 'image/png'));
      const file = new File([blob], `iqc-${State.mode}-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'IQC Generator', text: 'Chat bubble dari IRGXYMODS' });
        showToast('Dibagikan!', 'success');
      } else if (navigator.share) {
        await navigator.share({ title: 'IQC Generator — IRGXYMODS', text: 'Cek IQC Generator di IRGXYMODS!', url: location.href });
      } else {
        await downloadPNG(2);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('[IQC] shareImage:', err);
      showToast('Gagal membagikan', 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  /* ================= RESET ================= */
  function resetForm() {
    if (!confirm('Reset semua pengaturan ke default?')) return;

    State.darkMode = false;
    State.statusBar = true;
    State.readReceipt = true;
    State.typingIndicator = false;
    State.showWallpaper = true;
    State.contact = { name: 'Irgxy Mods', status: 'online', avatar: '', headerDate: 'Hari ini' };
    State.custom = {
      bubbleOut: '#DCF8C6', bubbleIn: '#FFFFFF', textColor: '#111111',
      timeColor: '#667781', bgColor: '#EFEAE2', nameColor: '#06CF9C',
      fontSize: 15, radius: 18, opacity: 100, wallpaper: ''
    };
    State.contextmenu = JSON.parse(JSON.stringify(DEFAULT_CM));
    State.messages = [
      { id: uid(), type: 'in',  text: 'Halo! Selamat datang di IRGXYMODS 👋', time: '09:40', read: true },
      { id: uid(), type: 'out', text: 'Terima kasih! Saya mau coba IQC Generator 🎉', time: '09:41', read: true }
    ];
    safe(() => localStorage.removeItem(STORAGE_KEY));

    /* Reset input mode lama */
    if ($('#iqcContactName'))   $('#iqcContactName').value = State.contact.name;
    if ($('#iqcContactStatus')) $('#iqcContactStatus').value = State.contact.status;
    if ($('#iqcHeaderDate'))    $('#iqcHeaderDate').value = State.contact.headerDate;
    if ($('#iqcAvatarUrl'))     $('#iqcAvatarUrl').value = '';
    if ($('#iqcToggleDark'))       $('#iqcToggleDark').checked = false;
    if ($('#iqcToggleStatusBar'))  $('#iqcToggleStatusBar').checked = true;
    if ($('#iqcToggleRead'))       $('#iqcToggleRead').checked = true;
    if ($('#iqcToggleTyping'))     $('#iqcToggleTyping').checked = false;
    if ($('#iqcToggleWallpaper'))  $('#iqcToggleWallpaper').checked = true;

    const colorMap = { iqcColorOut: 'bubbleOut', iqcColorIn: 'bubbleIn', iqcColorText: 'textColor', iqcColorTime: 'timeColor', iqcColorBg: 'bgColor', iqcColorName: 'nameColor' };
    Object.entries(colorMap).forEach(([id, k]) => { const el = $('#' + id); if (el) el.value = State.custom[k]; });
    if ($('#iqcFontSize'))    $('#iqcFontSize').value = 15;
    if ($('#iqcFontSizeVal')) $('#iqcFontSizeVal').textContent = '15';
    if ($('#iqcRadius'))      $('#iqcRadius').value = 18;
    if ($('#iqcRadiusVal'))   $('#iqcRadiusVal').textContent = '18';
    if ($('#iqcOpacity'))     $('#iqcOpacity').value = 100;
    if ($('#iqcOpacityVal'))  $('#iqcOpacityVal').textContent = '100';

    /* Reset input context menu */
    if ($('#iqcCmMsgText'))     $('#iqcCmMsgText').value     = DEFAULT_CM.messageText;
    if ($('#iqcCmMsgTime'))     $('#iqcCmMsgTime').value     = DEFAULT_CM.messageTime;
    if ($('#iqcCmMsgType'))     $('#iqcCmMsgType').value     = DEFAULT_CM.messageType;
    if ($('#iqcCmBubbleColor')) $('#iqcCmBubbleColor').value = DEFAULT_CM.bubbleColor;
    if ($('#iqcCmTextColor'))   $('#iqcCmTextColor').value   = DEFAULT_CM.textColor;
    if ($('#iqcCmReactions'))   $('#iqcCmReactions').value   = DEFAULT_CM.reactions.join(',');
    if ($('#iqcCmStatusTime'))  $('#iqcCmStatusTime').value  = DEFAULT_CM.statusTime;
    if ($('#iqcCmOperator'))    $('#iqcCmOperator').value    = DEFAULT_CM.statusOperator;
    if ($('#iqcCmNetwork'))     $('#iqcCmNetwork').value     = DEFAULT_CM.statusNetwork;
    if ($('#iqcCmBattery'))     $('#iqcCmBattery').value     = DEFAULT_CM.statusBattery;
    if ($('#iqcCmBatteryVal'))  $('#iqcCmBatteryVal').textContent = DEFAULT_CM.statusBattery;
    if ($('#iqcCmBlur'))        $('#iqcCmBlur').value        = DEFAULT_CM.blurAmount;
    if ($('#iqcCmBlurVal'))     $('#iqcCmBlurVal').textContent = DEFAULT_CM.blurAmount;
    if ($('#iqcCmDim'))         $('#iqcCmDim').value         = Math.round(DEFAULT_CM.dimOpacity * 100);
    if ($('#iqcCmDimVal'))      $('#iqcCmDimVal').textContent = Math.round(DEFAULT_CM.dimOpacity * 100);
    if ($('#iqcCmDarkTheme'))      $('#iqcCmDarkTheme').checked      = DEFAULT_CM.darkTheme;
    if ($('#iqcCmShowReactions'))  $('#iqcCmShowReactions').checked  = DEFAULT_CM.showReactions;
    if ($('#iqcCmShowMenu'))       $('#iqcCmShowMenu').checked       = DEFAULT_CM.showContextMenu;

    /* Sembunyikan card context menu jika bukan mode contextmenu */
    const cmCard = $('#iqcContextMenuCard');
    if (cmCard) cmCard.style.display = (State.mode === 'contextmenu') ? 'block' : 'none';

    renderPreview();
    renderMessageList();
    showToast('Reset berhasil', 'success');
  }

  /* ================================================================
     ============ VIDEO COMPRESSION v2.0 =============================
     ================================================================ */
  const VState = {
    file: null,
    duration: 0,
    width: 0,
    height: 0,
    previewUrl: null,
    outputUrl: null,
    outputBlob: null,
    outputMime: '',
    abortController: null,
    isCompressing: false,
    cleanupFns: []
  };

  function releaseVideoPreview() {
    if (VState.previewUrl) {
      safe(() => URL.revokeObjectURL(VState.previewUrl));
      VState.previewUrl = null;
    }
    const pv = $('#iqcVideoPreview');
    if (pv) { try { pv.pause(); } catch (e) {} pv.removeAttribute('src'); try { pv.load(); } catch (e) {} }
  }
  function releaseVideoOutput() {
    if (VState.outputUrl) {
      safe(() => URL.revokeObjectURL(VState.outputUrl));
      VState.outputUrl = null;
    }
    VState.outputBlob = null;
    VState.outputMime = '';
  }

  function probeVideo(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;

      let settled = false;
      const finish = (err, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        safe(() => URL.revokeObjectURL(url));
        v.removeAttribute('src'); safe(() => v.load());
        err ? reject(err) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error('Timeout membaca metadata video')), 15000);

      v.onloadedmetadata = () => {
        if (!v.videoWidth || !v.videoHeight) return finish(new Error('Resolusi video tidak terbaca'));
        if (!isFinite(v.duration) || v.duration <= 0) return finish(new Error('Durasi video tidak valid'));
        finish(null, { duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      };
      v.onerror = () => finish(new Error('Video tidak dapat dibaca'));
      v.src = url;
    });
  }

  async function handleVideoFile(file) {
    if (!file) return;
    const validExt = /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    const validMime = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'].includes(file.type);
    if (!validMime && !validExt) {
      showToast('Format tidak didukung. Gunakan MP4/WebM/MOV.', 'error');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showToast('Ukuran file melebihi 500MB', 'error');
      return;
    }

    releaseVideoPreview();
    releaseVideoOutput();
    VState.file = file;

    try {
      const info = await probeVideo(file);
      VState.duration = info.duration;
      VState.width    = info.width;
      VState.height   = info.height;

      if ($('#iqcVideoName'))     $('#iqcVideoName').textContent     = file.name;
      if ($('#iqcVideoSize'))     $('#iqcVideoSize').textContent     = formatBytes(file.size);
      if ($('#iqcVideoDuration')) $('#iqcVideoDuration').textContent = formatDuration(info.duration);
      if ($('#iqcVideoRes'))      $('#iqcVideoRes').textContent      = `${info.width} × ${info.height}`;

      const pv = $('#iqcVideoPreview');
      if (pv) {
        VState.previewUrl = URL.createObjectURL(file);
        pv.src = VState.previewUrl;
      }

      if ($('#iqcVideoInfoCard')) $('#iqcVideoInfoCard').style.display = 'block';
      if ($('#iqcQualityCard'))   $('#iqcQualityCard').style.display   = 'block';
      if ($('#iqcResultCard'))    $('#iqcResultCard').style.display    = 'none';
      if ($('#iqcProgressCard'))  $('#iqcProgressCard').style.display  = 'none';
      if ($('#iqcProgressFill'))  $('#iqcProgressFill').style.width    = '0%';
      if ($('#iqcProgressPct'))   $('#iqcProgressPct').textContent     = '0%';

      showToast('Video siap dikompresi', 'success');
    } catch (err) {
      console.error('[IQC] probeVideo:', err);
      showToast('Gagal membaca video: ' + (err.message || 'unknown'), 'error');
    }
  }

  function pickRecorderMime() {
    const candidates = [
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    if (!('MediaRecorder' in window) || typeof MediaRecorder.isTypeSupported !== 'function') {
      return 'video/webm';
    }
    for (const c of candidates) {
      try { if (MediaRecorder.isTypeSupported(c)) return c; } catch (e) {}
    }
    return 'video/webm';
  }

  async function compressWithCanvasRecorder(file, targetHeight, videoBitrate, audioBitrate, onProgress, signal) {
    if (!('MediaRecorder' in window)) throw new Error('Browser tidak mendukung MediaRecorder');

    const srcUrl = URL.createObjectURL(file);
    const cleanupAll = [];

    try {
      /* ---- Load video ---- */
      const v = document.createElement('video');
      v.src = srcUrl;
      v.muted = false;
      v.volume = 0;
      v.playsInline = true;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      cleanupAll.push(() => { try { v.pause(); } catch (e) {} v.removeAttribute('src'); try { v.load(); } catch (e) {} });

      await new Promise((res, rej) => {
        v.onloadedmetadata = res;
        v.onerror = () => rej(new Error('Video tidak dapat dibaca'));
      });
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

      /* ---- Dimensi target (genap, jaga aspect ratio) ---- */
      const srcW = v.videoWidth, srcH = v.videoHeight;
      if (!srcW || !srcH) throw new Error('Dimensi video invalid');
      const ratio = srcW / srcH;
      let outH = Math.min(targetHeight, srcH);
      let outW = Math.round(outH * ratio);
      if (outW % 2) outW++;
      if (outH % 2) outH++;

      /* ---- Canvas ---- */
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D tidak tersedia');

      /* ---- Audio ---- */
      let audioCtx = null, sourceNode = null, destNode = null;
      const stream = canvas.captureStream(30);
      cleanupAll.push(() => stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }));

      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          audioCtx  = new AC();
          sourceNode = audioCtx.createMediaElementSource(v);
          destNode   = audioCtx.createMediaStreamDestination();
          sourceNode.connect(destNode);
          destNode.stream.getAudioTracks().forEach(t => stream.addTrack(t));
          cleanupAll.push(() => {
            try { sourceNode.disconnect(); } catch (e) {}
            try { destNode.disconnect(); } catch (e) {}
            try { if (audioCtx.state !== 'closed') audioCtx.close(); } catch (e) {}
          });
        }
      } catch (err) {
        console.warn('[IQC] Audio capture gagal, video-only:', err);
      }

      /* ---- Recorder ---- */
      const mime = pickRecorderMime();
      let rec;
      try {
        rec = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: videoBitrate * 1000,
          audioBitsPerSecond: audioBitrate
        });
      } catch (err) {
        rec = new MediaRecorder(stream, {
          videoBitsPerSecond: videoBitrate * 1000,
          audioBitsPerSecond: audioBitrate
        });
      }

      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      const stopped = new Promise((res, rej) => {
        rec.onstop = () => res();
        rec.onerror = (e) => rej(e.error || new Error('Recorder error'));
      });

      /* ---- Abort listener ---- */
      let aborted = false;
      if (signal) {
        signal.addEventListener('abort', () => {
          aborted = true;
          try { rec.state !== 'inactive' && rec.stop(); } catch (e) {}
          try { v.pause(); } catch (e) {}
        }, { once: true });
      }

      /* ---- Draw loop + Progress ---- */
      let rafId = 0;
      let cancelled = false;
      const totalDur = v.duration || VState.duration || 1;
      const t0 = performance.now();
      let emaSpeed = 0;
      let frameCount = 0;
      let fpsStart = t0;
      let lastPct = -1;

      const drawFrame = () => {
        if (cancelled || (signal && signal.aborted)) return;
        if (v.paused || v.ended) return;
        try { ctx.drawImage(v, 0, 0, outW, outH); } catch (e) {}
        frameCount++;

        const cur = v.currentTime || 0;
        const pct = Math.min(99, Math.round((cur / totalDur) * 100));
        if (pct !== lastPct) {
          lastPct = pct;
          const elapsed = (performance.now() - t0) / 1000;
          const instantSpeed = cur > 0 && elapsed > 0 ? cur / elapsed : 0;
          emaSpeed = emaSpeed === 0 ? instantSpeed : (emaSpeed * 0.7 + instantSpeed * 0.3);
          const remain = emaSpeed > 0 ? (totalDur - cur) / emaSpeed : 0;

          const fpsElapsed = (performance.now() - fpsStart) / 1000;
          const fps = fpsElapsed > 0 ? (frameCount / fpsElapsed) : 0;

          if (onProgress) onProgress({ pct, eta: remain, fps });
        }
        rafId = requestAnimationFrame(drawFrame);
      };

      /* ---- Start ---- */
      v.currentTime = 0;
      try { await v.play(); } catch (err) {
        throw new Error('Tidak bisa memutar video (mungkin butuh interaksi user)');
      }
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

      rec.start(100);
      rafId = requestAnimationFrame(drawFrame);

      await new Promise(res => {
        let done = false;
        const finish = () => { if (done) return; done = true; res(); };
        v.onended = finish;
        if (signal) {
          const onAbort = () => finish();
          signal.addEventListener('abort', onAbort, { once: true });
          cleanupAll.push(() => signal.removeEventListener('abort', onAbort));
        }
        const dur = (v.duration || 60) * 1000 + 10000;
        setTimeout(finish, dur);
      });

      cancelled = true;
      cancelAnimationFrame(rafId);
      try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {}
      await stopped;

      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (aborted) throw new DOMException('Aborted', 'AbortError');

      const realMime = rec.mimeType || mime;
      const outMime  = realMime.split(';')[0] || 'video/webm';
      const outBlob  = new Blob(chunks, { type: outMime });

      if (!outBlob.size) throw new Error('Hasil kompresi kosong');

      return { blob: outBlob, width: outW, height: outH, mimeType: outMime };

    } finally {
      safe(() => URL.revokeObjectURL(srcUrl));
      cleanupAll.forEach(fn => { try { fn(); } catch (e) {} });
    }
  }

  /* ================= VIDEO UI ================= */
  function initVideoCompress() {
    const dropzone   = $('#iqcDropzone');
    const fileInput  = $('#iqcVideoInput');
    const startBtn   = $('#iqcStartCompress');
    const cancelBtn  = $('#iqcCancelCompress');
    const downloadBtn = $('#iqcDownloadVideo');
    const resetBtn   = $('#iqcResetCompress');
    const bitrate    = $('#iqcBitrate');
    const bitrateVal = $('#iqcBitrateVal');

    bitrate?.addEventListener('input', () => {
      if (bitrateVal) bitrateVal.textContent = bitrate.value;
    });

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); }
    });
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone?.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone?.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); });
    });
    dropzone?.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (f) handleVideoFile(f);
    });
    fileInput?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (f) handleVideoFile(f);
    });

    /* ---- Start ---- */
    startBtn?.addEventListener('click', async () => {
      if (!VState.file) { showToast('Pilih video terlebih dahulu', 'warning'); return; }
      if (VState.isCompressing) { showToast('Kompresi sedang berjalan', 'warning'); return; }

      const targetHeight = parseInt(document.querySelector('input[name="iqcQuality"]:checked')?.value || '720', 10);
      const vBitrate = clamp(parseInt(bitrate?.value || '2000', 10) || 2000, 500, 8000);
      const aBitrate = clamp(parseInt($('#iqcAudioBitrate')?.value || '128000', 10) || 128000, 64000, 320000);

      releaseVideoOutput();
      VState.isCompressing = true;
      VState.abortController = new AbortController();
      startBtn.disabled = true;
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';

      if ($('#iqcProgressCard')) $('#iqcProgressCard').style.display = 'block';
      if ($('#iqcResultCard'))   $('#iqcResultCard').style.display   = 'none';
      if ($('#iqcProgressFill')) $('#iqcProgressFill').style.width   = '0%';
      if ($('#iqcProgressPct'))  $('#iqcProgressPct').textContent    = '0%';
      if ($('#iqcProgressEta'))  $('#iqcProgressEta').textContent    = 'Menghitung...';

      const beforeSize = VState.file.size;
      const beforeRes  = `${VState.width}×${VState.height}`;

      try {
        const result = await compressWithCanvasRecorder(
          VState.file, targetHeight, vBitrate, aBitrate,
          ({ pct, eta, fps }) => {
            if ($('#iqcProgressFill')) $('#iqcProgressFill').style.width = pct + '%';
            if ($('#iqcProgressPct'))  $('#iqcProgressPct').textContent = pct + '%';
            if ($('#iqcProgressEta')) {
              $('#iqcProgressEta').textContent = eta > 0
                ? `ETA ~${humanizeTime(eta)} · ${Math.round(fps)} fps`
                : 'Memproses...';
            }
          },
          VState.abortController.signal
        );

        VState.outputBlob = result.blob;
        VState.outputMime = result.mimeType;
        VState.outputUrl  = URL.createObjectURL(result.blob);

        if ($('#iqcProgressFill')) $('#iqcProgressFill').style.width = '100%';
        if ($('#iqcProgressPct'))  $('#iqcProgressPct').textContent  = '100%';
        if ($('#iqcProgressEta'))  $('#iqcProgressEta').textContent  = 'Selesai';

        const afterSize = result.blob.size;
        const saved = beforeSize > 0 ? Math.max(0, ((beforeSize - afterSize) / beforeSize) * 100) : 0;

        if ($('#iqcBeforeSize')) $('#iqcBeforeSize').textContent = formatBytes(beforeSize);
        if ($('#iqcAfterSize'))  $('#iqcAfterSize').textContent  = formatBytes(afterSize);
        if ($('#iqcBeforeRes'))  $('#iqcBeforeRes').textContent  = beforeRes;
        if ($('#iqcAfterRes'))   $('#iqcAfterRes').textContent   = `${result.width}×${result.height}`;
        if ($('#iqcSavedPercent')) {
          const fmtLabel = VState.outputMime.includes('mp4') ? 'MP4' : 'WebM';
          $('#iqcSavedPercent').innerHTML = saved > 0
            ? `<i class="fas fa-check-circle"></i> Hemat ${saved.toFixed(1)}% ukuran file (${fmtLabel})`
            : `<i class="fas fa-info-circle"></i> Ukuran setelah: ${formatBytes(afterSize)} (${fmtLabel})`;
          $('#iqcSavedPercent').style.display = 'block';
        }

        if ($('#iqcResultCard'))   $('#iqcResultCard').style.display   = 'block';
        if ($('#iqcProgressCard')) $('#iqcProgressCard').style.display = 'none';

        const fmtLabel = VState.outputMime.includes('mp4') ? 'MP4' : 'WebM';
        showToast(`Kompresi selesai (${fmtLabel})!`, 'success');
        if (typeof window.addActivity === 'function') window.addActivity('download', 'Compress Video IQC');

      } catch (err) {
        if (err && err.name === 'AbortError') {
          showToast('Kompresi dibatalkan', 'info');
        } else {
          console.error('[IQC] compress:', err);
          showToast('Gagal kompresi: ' + (err.message || 'unknown'), 'error');
        }
        if ($('#iqcProgressCard')) $('#iqcProgressCard').style.display = 'none';
      } finally {
        VState.isCompressing = false;
        VState.abortController = null;
        if (startBtn) startBtn.disabled = false;
        if (cancelBtn) cancelBtn.style.display = 'none';
      }
    });

    /* ---- Cancel ---- */
    cancelBtn?.addEventListener('click', () => {
      if (VState.abortController) {
        VState.abortController.abort();
        showToast('Membatalkan kompresi...', 'info');
      }
    });

    /* ---- Download ---- */
    downloadBtn?.addEventListener('click', () => {
      if (!VState.outputUrl || !VState.outputBlob) { showToast('Belum ada hasil', 'warning'); return; }
      const ext = VState.outputMime.includes('mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = VState.outputUrl;
      a.download = `compressed-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Video diunduh!', 'success');
    });

    /* ---- Reset ---- */
    resetBtn?.addEventListener('click', () => {
      releaseVideoPreview();
      releaseVideoOutput();
      VState.file = null;
      VState.duration = 0;
      VState.width = 0;
      VState.height = 0;
      if ($('#iqcResultCard'))    $('#iqcResultCard').style.display    = 'none';
      if ($('#iqcProgressCard'))  $('#iqcProgressCard').style.display  = 'none';
      if ($('#iqcVideoInfoCard')) $('#iqcVideoInfoCard').style.display = 'none';
      if ($('#iqcQualityCard'))   $('#iqcQualityCard').style.display   = 'none';
      showToast('Reset kompresi berhasil', 'success');
    });
  }

  /* ================= FAQ ================= */
  function initFaq() {
    $$('.iqc-faq-q').forEach(q => {
      q.addEventListener('click', () => {
        const parent = q.closest('.iqc-faq-item');
        if (!parent) return;
        $$('.iqc-faq-item').forEach(other => {
          if (other !== parent) other.classList.remove('open');
        });
        parent.classList.toggle('open');
      });
    });
  }

  /* ================= EXPORT BINDINGS ================= */
  function initExportButtons() {
    $('#iqcDownloadPng')?.addEventListener('click', () => downloadPNG(2));
    $('#iqcDownloadHd')?.addEventListener('click',  () => downloadPNG(3));
    $('#iqcCopyImage')?.addEventListener('click',   copyImageToClipboard);
    $('#iqcShareImage')?.addEventListener('click',  shareImage);
    $('#iqcResetAll')?.addEventListener('click',    resetForm);
  }

  /* ================= KEYBOARD ================= */
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const dd = $('#settingsDropdown');
        if (dd) dd.classList.remove('active');
      }
    });
  }

  /* ================= CLEANUP ================= */
  function initCleanup() {
    window.addEventListener('beforeunload', () => {
      releaseVideoPreview();
      releaseVideoOutput();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        safe(() => $('#iqcVideoPreview')?.pause());
      }
    });
  }

  /* ================= INIT ================= */
  function init() {
    try {
      loadPrefs();
      initTabs();
      initForm();
      initAvatarUpload();
      initColorPickers();
      initToggleSwitches();
      initWallpaper();
      initExportButtons();
      initVideoCompress();
      initContextMenuForm();
      initFaq();
      initKeyboard();
      initCleanup();
      renderPreview();
      renderMessageList();

      if (window.AOS && typeof AOS.init === 'function') {
        try { AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 }); } catch (e) {}
      }
      console.log('✅ IQC Generator v3.0 (Context Menu Edition) siap');
    } catch (err) {
      console.error('[IQC] Init failed:', err);
      showToast('Terjadi kesalahan saat memuat halaman', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* ================= EXPOSE ================= */
  window.IQC = {
    State, VState,
    renderPreview, renderMessageList,
    renderContextMenuPreview,
    addMessage, deleteMessage, editMessage,
    downloadPNG, copyImageToClipboard, shareImage, resetForm
  };
})();