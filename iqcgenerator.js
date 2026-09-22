/* ================================================================
   IQC GENERATOR — iqcgenerator.js
   Version: 5.8.2 (PIXEL-PERFECT — Preview = Download 100%)
   ================================================================
   CHANGELOG v5.8.2:
     [FIX #1] Menu context icons: gunakan <img> dari CM_ICON_URL.
     [FIX #1] Preload gambar ikon sebelum render.
     [FIX #2] onclone: paksa rendering <img> context menu.
     [FIX #3] imageTimeout 30000ms untuk koneksi lambat.
     [FIX #4] sanitizeMenuItems() — migrasi legacy {icon} → {label}.
     [FIX #5] Slug generator untuk data-action.
     [FIX #6] PISAHKAN CSS: .iqc-cm-bubble (context menu) vs
              .iqc-bubble (Instagram chat) — tidak ada konflik.
     [FIX #7] Pastikan bubble chat context menu tampil dengan benar.
   ================================================================ */
(function () {
  'use strict';

  window.addEventListener('error', (e) => console.warn('[IQC] Runtime error:', e.message));
  window.addEventListener('unhandledrejection', (e) => console.warn('[IQC] Promise rejection:', e.reason));

  /* ================= CONSTANTS ================= */
  const CHAT_BG_URL = 'https://ik.imagekit.io/IrgxyMods/2383af11-2091-4331-9887-6627d8b71d7c.png';
  const CM_ICON_URL = 'https://ik.imagekit.io/IrgxyMods/BackgroundEraser_20260922_111514161.png';

  const BG_FALLBACK_COLOR = '#0B141A';
  const STORAGE_KEY = 'irgxy_iqc_prefs_v5';
  const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','EmojiOne Color','Android Emoji',sans-serif";
  const TEXT_FONT  = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif';

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
  const debounce = (fn, wait = 200) => {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
  };
  const uid = () => 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const slugify = (s = '') => String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';

  /* ================= STATE ================= */
  const DEFAULT_CM = {
    messageText: 'ikan hiu ngedek ngedek Indonesia nihhh dekkk',
    messageTime: '17:25',
    messageType: 'in',
    bubbleColor: '#1C1C1E',
    textColor: '#FFFFFF',
    timeColor: '#8E8E93',
    reactions: ['👍','❤️','😂','😮','😢','🙏'],
    darkTheme: true,
    dimOpacity: 0.45,
    showReactions: true,
    showContextMenu: true,
    menuItems: [
      { label: 'Balas',        danger: false },
      { label: 'Teruskan',     danger: false },
      { label: 'Salin',        danger: false },
      { label: 'Beri bintang', danger: false },
      { label: 'Hapus',        danger: true  },
      { label: 'Lainnya...',   danger: false }
    ]
  };

  const State = {
    mode: 'contextmenu',
    darkMode: false,
    statusBar: true,
    readReceipt: true,
    typingIndicator: false,
    showWallpaper: true,
    chatBgUrl: CHAT_BG_URL,
    contact: { name: 'Irgxy Mods', status: 'online', avatar: '', headerDate: 'Hari ini' },
    messages: [
      { id: uid(), type: 'in',  text: 'Halo! Selamat datang di IRGXYMODS 👋', time: '09:40', read: true },
      { id: uid(), type: 'out', text: 'Terima kasih! Saya mau coba IQC Generator 🎉', time: '09:41', read: true }
    ],
    custom: { fontSize: 15, radius: 18 },
    contextmenu: JSON.parse(JSON.stringify(DEFAULT_CM))
  };

  /* ================= SANITIZER MENU ITEMS ================= */
  function sanitizeMenuItems(arr) {
    try {
      if (!Array.isArray(arr) || !arr.length) {
        return JSON.parse(JSON.stringify(DEFAULT_CM.menuItems));
      }
      const cleaned = arr
        .filter(Boolean)
        .map((it) => {
          if (typeof it === 'string') {
            return { label: it.trim(), danger: false };
          }
          if (typeof it !== 'object') return null;
          const label = String(it.label || it.text || it.name || '').trim();
          if (!label) return null;
          return {
            label,
            danger: !!it.danger
          };
        })
        .filter(Boolean)
        .slice(0, 12);

      return cleaned.length
        ? cleaned
        : JSON.parse(JSON.stringify(DEFAULT_CM.menuItems));
    } catch (e) {
      console.warn('[IQC sanitizeMenuItems]', e);
      return JSON.parse(JSON.stringify(DEFAULT_CM.menuItems));
    }
  }

  /* ================= PERSIST ================= */
  function savePrefs() {
    safe(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: State.mode, darkMode: State.darkMode, statusBar: State.statusBar,
      readReceipt: State.readReceipt, typingIndicator: State.typingIndicator,
      showWallpaper: State.showWallpaper, chatBgUrl: State.chatBgUrl,
      contact: State.contact, custom: State.custom, contextmenu: State.contextmenu
    })));
  }
  function loadPrefs() {
    safe(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      State.darkMode        = !!d.darkMode;
      State.statusBar       = d.statusBar !== false;
      State.readReceipt     = d.readReceipt !== false;
      State.typingIndicator = !!d.typingIndicator;
      State.showWallpaper   = d.showWallpaper !== false;
      State.chatBgUrl = (typeof d.chatBgUrl === 'string' && d.chatBgUrl.trim())
        ? d.chatBgUrl.trim() : CHAT_BG_URL;
      if (d.contact && typeof d.contact === 'object') Object.assign(State.contact, d.contact);
      if (d.custom  && typeof d.custom  === 'object') {
        State.custom.fontSize = clamp(parseInt(d.custom.fontSize, 10) || 15, 12, 20);
        State.custom.radius   = clamp(parseInt(d.custom.radius, 10) || 18, 0, 30);
      }
      if (d.contextmenu && typeof d.contextmenu === 'object') {
        Object.assign(State.contextmenu, d.contextmenu);
        if (!Array.isArray(State.contextmenu.reactions) || !State.contextmenu.reactions.length)
          State.contextmenu.reactions = DEFAULT_CM.reactions.slice();
        State.contextmenu.menuItems = sanitizeMenuItems(State.contextmenu.menuItems);
      }
      State.mode = ['instagram','contextmenu'].includes(d.mode) ? d.mode : 'contextmenu';
    });
  }

  /* ================= APPLY BACKGROUND CHAT-BG ================= */
  function applyChatBackground(chatBg) {
    if (!chatBg) return;
    const url = (State.chatBgUrl && String(State.chatBgUrl).trim()) || CHAT_BG_URL;
    chatBg.style.backgroundImage      = `url('${url}')`;
    chatBg.style.backgroundSize       = 'cover';
    chatBg.style.backgroundPosition   = 'center center';
    chatBg.style.backgroundRepeat     = 'no-repeat';
    chatBg.style.backgroundAttachment = 'scroll';
    chatBg.style.backgroundColor      = BG_FALLBACK_COLOR;
  }

  /* ================= MESSAGE CRUD ================= */
  function addMessage(type, text, time, read) {
    const t = (text || '').trim();
    if (!t) { showToast('Isi pesan tidak boleh kosong', 'warning'); return; }
    if (t.length > 500) { showToast('Pesan terlalu panjang (max 500 karakter)', 'warning'); return; }
    State.messages.push({ id: uid(), type: type === 'out' ? 'out' : 'in', text: t, time: time || '09:41', read: read !== false });
    renderPreview(); renderMessageList(); savePrefs();
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
  function checkIcon(read) {
    const cls = 'iqc-check' + (read ? '' : ' delivered') + (State.darkMode ? ' dark' : '');
    return `<span class="${cls}" aria-label="${read ? 'terbaca' : 'terkirim'}">
      <svg viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.5 9.8L2 5.3l-.9.9 5.4 5.4L17 1.2l-.9-.9-9.6 9.5z"/>
        <path d="M11.2 11.6L6.5 6.9l-.9.9 5.6 5.6L22 2.9l-.9-.9-9.9 9.6z" opacity="${read ? 1 : 0.35}"/>
      </svg>
    </span>`;
  }

  /* ================= BUILD BUBBLE (Instagram) ================= */
  function buildBubbleHTML(msg) {
    const isOut = msg.type === 'out';
    const isIG  = State.mode === 'instagram';
    let cls = 'iqc-bubble ';
    if (isIG) cls += isOut ? 'ig-out' : 'ig-in';
    else      cls += isOut ? 'out'    : 'in';
    if (State.darkMode) cls += ' dark';

    const fs = State.custom.fontSize || 15;
    const rd = State.custom.radius || 18;
    let style = `font-size:${fs}px;`;
    style += `border-radius:${rd}px ${rd}px ${isOut ? '4px' : rd + 'px'} ${isOut ? rd + 'px' : '4px'};`;

    const showCheck = isOut && !isIG;
    const timeHTML = `<span class="iqc-bubble-time">${escapeHtml(msg.time)}${showCheck ? checkIcon(msg.read !== false) : ''}</span>`;

    return `<div class="${cls}" data-id="${msg.id}" style="${style}">
      <div class="iqc-bubble-content">${escapeHtml(msg.text)}</div>
      ${timeHTML}
    </div>`;
  }

  /* ================= RENDER PREVIEW ================= */
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

    container.style.padding = '';
    chatBg.style.padding = '';

    if (State.mode === 'contextmenu') {
      if (chatHeader) chatHeader.style.display = 'none';
      return renderContextMenuPreview();
    } else {
      if (chatHeader) chatHeader.style.display = 'flex';
      frame.classList.remove('cm-mode');
    }

    frame.classList.toggle('dark-frame', State.darkMode);

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

    chatBg.classList.toggle('dark', State.darkMode);
    chatBg.classList.toggle('has-wallpaper', State.showWallpaper);
    chatBg.classList.toggle('no-wallpaper', !State.showWallpaper);
    applyChatBackground(chatBg);
    chatBg.style.filter = '';

    if (chatHeader) chatHeader.style.background = State.darkMode ? '#1F2C33' : '#F6F6F6';
    if (contactName) {
      contactName.textContent = State.contact.name || 'Kontak';
      contactName.style.color = '';
    }
    if (contactStat) contactStat.textContent = State.contact.status || 'online';

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

  /* ================================================================
     RENDER CONTEXT MENU — v5.8.2 (IMAGE ICONS)
     ================================================================ */
  function renderContextMenuPreview() {
    const container = $('#iqcChatMessages');
    const chatBg    = $('#iqcChatBg');
    const frame     = $('#iqcPhoneFrame');
    if (!container || !chatBg || !frame) return;

    const cm = State.contextmenu || DEFAULT_CM;
    const isDark = cm.darkTheme !== false;

    frame.classList.toggle('dark-frame', isDark);
    frame.classList.add('cm-mode');

    chatBg.classList.toggle('dark', isDark);
    chatBg.classList.remove('has-wallpaper', 'no-wallpaper');
    applyChatBackground(chatBg);
    chatBg.style.padding = '0';
    chatBg.style.filter = '';

    container.style.padding = '0';

    const statusEl = $('#iqcStatusBar');
    if (statusEl) statusEl.style.display = 'none';

    const dimA = clamp(parseFloat(cm.dimOpacity), 0.2, 0.7) || 0.45;

    const reactionsArr = (Array.isArray(cm.reactions) ? cm.reactions : [])
      .map(s => String(s || '').trim()).filter(Boolean).slice(0, 6);

    const reactionsHTML = (cm.showReactions !== false && reactionsArr.length)
      ? `<div class="iqc-cm-reactions">
           ${reactionsArr.map(e => `<span>${escapeHtml(e)}</span>`).join('')}
           <button class="iqc-cm-plus" type="button" tabindex="-1" aria-hidden="true"><i class="fas fa-plus"></i></button>
         </div>`
      : '';

    const bubbleColor = /^#[0-9a-fA-F]{6}$/.test(cm.bubbleColor) ? cm.bubbleColor : '#1C1C1E';
    const textColor   = /^#[0-9a-fA-F]{6}$/.test(cm.textColor)   ? cm.textColor   : '#FFFFFF';
    const timeColor   = /^#[0-9a-fA-F]{6}$/.test(cm.timeColor)   ? cm.timeColor   : '#8E8E93';
    const msgType     = cm.messageType === 'out' ? 'out' : 'in';
    const msgText     = String(cm.messageText || '').slice(0, 300);
    const msgTime     = /^\d{2}:\d{2}$/.test(cm.messageTime) ? cm.messageTime : '17:25';

    const bubbleHTML = `
      <div class="iqc-cm-bubble ${msgType}" style="background:${bubbleColor};color:${textColor};">
        <span class="iqc-cm-bubble-content">${escapeHtml(msgText)}</span>
        <span class="iqc-cm-bubble-time" style="color:${timeColor};">${escapeHtml(msgTime)}</span>
      </div>`;

    const menuItems = sanitizeMenuItems(cm.menuItems);
    const menuHTML = (cm.showContextMenu !== false)
      ? `<div class="iqc-cm-menu">
           ${menuItems.map((it, idx) => {
             const action = slugify(it.label) || ('item_' + idx);
             const dangerCls = it.danger ? ' danger' : '';
             return `
               <button class="iqc-cm-item${dangerCls}" data-action="${escapeHtml(action)}" type="button">
                 <span>${escapeHtml(it.label)}</span>
                 <img src="${CM_ICON_URL}" alt="" aria-hidden="true" draggable="false" />
               </button>`;
           }).join('')}
         </div>`
      : '';

    container.innerHTML = `
      <div class="iqc-cm-dim" style="background:rgba(0,0,0,${dimA});"></div>
      <div class="iqc-cm-stage">
        ${reactionsHTML}
        ${bubbleHTML}
        ${menuHTML}
      </div>`;
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
    const cmCard = $('#iqcContextMenuCard');
    const igCards = $$('.iqc-ig-card');
    if (!tabs.length) return;

    const applyMode = (mode) => {
      State.mode = mode;
      const isCM = (mode === 'contextmenu');
      if (cmCard) cmCard.style.display = isCM ? 'block' : 'none';
      igCards.forEach(c => { c.style.display = isCM ? 'none' : 'block'; });
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode') || 'contextmenu';
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

  /* ================= TOGGLES (Instagram) ================= */
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
    setVal('iqcCmBattery', cm.statusBattery || 59);
    setVal('iqcCmDim', Math.round((parseFloat(cm.dimOpacity) || 0.45) * 100));
    setChecked('iqcCmDarkTheme', cm.darkTheme);
    setChecked('iqcCmShowReactions', cm.showReactions);
    setChecked('iqcCmShowMenu', cm.showContextMenu);

    const updateLabel = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    updateLabel('iqcCmBatteryVal', cm.statusBattery || 59);
    updateLabel('iqcCmDimVal', Math.round((parseFloat(cm.dimOpacity) || 0.45) * 100));

    const bindText = (id, key, transform) => {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        try {
          const v = transform ? transform(el.value) : el.value;
          State.contextmenu[key] = v;
          renderPreview(); savePrefs();
        } catch (e) { console.warn('[IQC bindText]', e); }
      });
    };
    const clampTime = v => /^\d{2}:\d{2}$/.test(v) ? v : '17:25';
    bindText('iqcCmMsgText', 'messageText', v => String(v).slice(0, 300));
    bindText('iqcCmMsgTime', 'messageTime', clampTime);
    bindText('iqcCmBubbleColor', 'bubbleColor');
    bindText('iqcCmTextColor', 'textColor');

    const typeSel = $('#iqcCmMsgType');
    if (typeSel) {
      typeSel.addEventListener('change', () => {
        State.contextmenu.messageType = typeSel.value === 'out' ? 'out' : 'in';
        renderPreview(); savePrefs();
      });
    }

    const rEl = $('#iqcCmReactions');
    if (rEl) {
      rEl.addEventListener('input', () => {
        try {
          State.contextmenu.reactions = String(rEl.value)
            .split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
          renderPreview(); savePrefs();
        } catch (e) { console.warn('[IQC reactions]', e); }
      });
    }

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
        } catch (e) { console.warn('[IQC slider]', e); }
      });
    };
    bindSlider('iqcCmBattery','iqcCmBatteryVal','statusBattery', v => clamp(v, 0, 100));
    bindSlider('iqcCmDim','iqcCmDimVal','dimOpacity', v => clamp(v / 100, 0.2, 0.7));

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

  /* ================================================================
     v5.7 FIX — PRELOAD BACKGROUND IMAGE
     ================================================================ */
  function preloadBackgroundImage() {
    return new Promise((resolve) => {
      const url = (State.chatBgUrl && String(State.chatBgUrl).trim()) || CHAT_BG_URL;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;
      const finish = (ok) => { if (done) return; done = true; resolve(ok); };
      img.onload  = () => finish(true);
      img.onerror = () => finish(false);
      img.src = url;
      setTimeout(() => finish(false), 8000);
    });
  }

  /* ================================================================
     v5.8 FIX — PRELOAD CONTEXT MENU ICONS
     ================================================================ */
  function preloadContextMenuIcons() {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      img.onload = () => { console.log('[IQC v5.8.2] CM icon loaded:', CM_ICON_URL); finish(); };
      img.onerror = () => { console.warn('[IQC v5.8.2] CM icon gagal load:', CM_ICON_URL); finish(); };
      img.src = CM_ICON_URL;
      setTimeout(finish, 8000);
    });
  }

  /* ================================================================
     v5.8.2 FIX — CAPTURE CANVAS (PIXEL-PERFECT)
     ================================================================ */
  async function captureCanvas(scale = 3) {
    if (typeof html2canvas !== 'function') throw new Error('html2canvas tidak tersedia');
    const frame = $('#iqcPhoneFrame');
    if (!frame) throw new Error('Frame tidak ditemukan');

    await Promise.all([preloadBackgroundImage(), preloadContextMenuIcons()]);

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (e) { /* noop */ }

    const freezeStyle = document.createElement('style');
    freezeStyle.id = 'iqc-freeze-anim';
    freezeStyle.textContent = `
      *, *::before, *::after {
        animation-play-state: paused !important;
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition: none !important;
      }
      .iqc-cm-bubble, .iqc-bubble { animation: none !important; }
    `;
    document.head.appendChild(freezeStyle);

    try {
      return await html2canvas(frame, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        scale: clamp(scale, 1, 4),
        logging: false,
        imageTimeout: 30000,
        removeContainer: true,
        onclone: (clonedDoc) => {
          try {
            const url = (State.chatBgUrl && String(State.chatBgUrl).trim()) || CHAT_BG_URL;

            /* ── 1) FORCE background chat ── */
            const clonedChatBg = clonedDoc.querySelector('#iqcChatBg');
            if (clonedChatBg) {
              clonedChatBg.style.backgroundImage      = `url('${url}')`;
              clonedChatBg.style.backgroundSize       = 'cover';
              clonedChatBg.style.backgroundPosition   = 'center center';
              clonedChatBg.style.backgroundRepeat     = 'no-repeat';
              clonedChatBg.style.backgroundAttachment = 'scroll';
              clonedChatBg.style.backgroundColor      = BG_FALLBACK_COLOR;
              clonedChatBg.style.filter               = 'none';
            }

            /* ── 2) FORCE frame rendering ── */
            const clonedFrame = clonedDoc.querySelector('#iqcPhoneFrame');
            if (clonedFrame) {
              clonedFrame.style.imageRendering = 'high-quality';
              clonedFrame.style.webkitFontSmoothing = 'antialiased';
            }

            /* ── 3) Hide notch + status bar + header (cm-mode) ── */
            if (State.mode === 'contextmenu') {
              if (clonedFrame) clonedFrame.classList.add('cm-mode', 'dark-frame');
              const clonedStatusBar = clonedDoc.querySelector('#iqcStatusBar');
              if (clonedStatusBar) {
                clonedStatusBar.style.display    = 'none';
                clonedStatusBar.style.visibility = 'hidden';
                clonedStatusBar.style.height     = '0';
              }
              const clonedHeader = clonedDoc.querySelector('#iqcChatHeader');
              if (clonedHeader) clonedHeader.style.display = 'none';
            }

            /* ── 4) Force dim overlay ── */
            const clonedDim = clonedDoc.querySelector('.iqc-cm-dim');
            if (clonedDim) {
              const dimA = clamp(parseFloat(State.contextmenu.dimOpacity), 0.2, 0.7) || 0.45;
              clonedDim.style.background = `rgba(0,0,0,${dimA})`;
              clonedDim.style.zIndex = '1';
            }
            const clonedStage = clonedDoc.querySelector('.iqc-cm-stage');
            if (clonedStage) clonedStage.style.zIndex = '2';

            /* ── 5) Kill backdrop-filter → SOLID fallback ── */
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
              el.style.background = 'rgba(0,0,0,0.35)';
            });

            /* ── 6) Force bubble colors ── */
            const cmBubbleColor = State.contextmenu.bubbleColor || '#1C1C1E';
            const cmTextColor   = State.contextmenu.textColor   || '#FFFFFF';
            clonedDoc.querySelectorAll('.iqc-cm-bubble').forEach(el => {
              el.style.background = cmBubbleColor;
              el.style.color      = cmTextColor;
            });

            /* ── 6b) v5.8: FORCE context menu icon images ── */
            clonedDoc.querySelectorAll('.iqc-cm-item img').forEach(img => {
              img.style.width = '22px';
              img.style.height = '22px';
              img.style.objectFit = 'contain';
              img.style.display = 'block';
              img.style.flexShrink = '0';
              img.style.pointerEvents = 'none';
              img.style.imageRendering = 'auto';
              if (!img.getAttribute('src')) {
                img.setAttribute('src', CM_ICON_URL);
              }
              img.setAttribute('crossorigin', 'anonymous');
            });

            /* v5.8: pastikan .iqc-cm-item tetap flex */
            clonedDoc.querySelectorAll('.iqc-cm-item').forEach(el => {
              el.style.display = 'flex';
              el.style.justifyContent = 'space-between';
              el.style.alignItems = 'center';
              el.style.width = '100%';
            });

            /* ── 7) Force emoji + text font stack ── */
            const targets = clonedDoc.querySelectorAll(
              '.iqc-cm-reactions span, .iqc-cm-reactions, .iqc-cm-plus, ' +
              '.iqc-cm-bubble-content, .iqc-cm-bubble-time, ' +
              '.iqc-cm-menu, .iqc-cm-item, .iqc-cm-item span, ' +
              '.iqc-bubble-content, .iqc-bubble-time, .iqc-date-pill'
            );
            targets.forEach(el => {
              el.style.fontFamily = `${TEXT_FONT},${EMOJI_FONT}`;
              el.style.fontKerning = 'normal';
              el.style.webkitFontSmoothing = 'antialiased';
              el.style.mozOsxFontSmoothing = 'grayscale';
              el.style.textRendering = 'geometricPrecision';
            });

            /* ── 8) Kill animations di clone ── */
            const killStyle = clonedDoc.createElement('style');
            killStyle.textContent = `
              *, *::before, *::after {
                animation: none !important;
                transition: none !important;
              }
              .iqc-cm-bubble, .iqc-bubble { animation: none !important; }
              .iqc-typing span { animation: none !important; }
              #iqcPhoneFrame.cm-mode::before { display: none !important; content: none !important; }
              #iqcPhoneFrame.cm-mode .iqc-status-bar {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
              }
              .iqc-cm-item img {
                width: 22px !important;
                height: 22px !important;
                object-fit: contain !important;
                display: block !important;
                flex-shrink: 0 !important;
              }
            `;
            clonedDoc.head.appendChild(killStyle);

            /* ── 9) Hilangkan padding chat-messages di cm-mode ── */
            const clonedMessages = clonedDoc.querySelector('#iqcChatMessages');
            if (clonedMessages && State.mode === 'contextmenu') {
              clonedMessages.style.padding = '0';
              clonedMessages.style.overflow = 'hidden';
            }
          } catch (e) { console.warn('[IQC onclone v5.8.2]', e); }
        }
      });
    } finally {
      freezeStyle.remove();
    }
  }

  /* ================================================================
     v5.8.2 — DOWNLOAD PNG (scale 3 / HD 4, retry 2x, quality 1.0)
     ================================================================ */
  async function downloadPNG(scale = 3) {
    const loading = $('#iqcExportLoading');
    const loadingText = $('#iqcExportLoadingText');
    try {
      if (loading) loading.style.display = 'flex';
      if (loadingText) loadingText.textContent = scale >= 4 ? 'Membuat HD PNG (4x)...' : `Membuat PNG (${scale}x)...`;

      let canvas = null, lastErr = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          canvas = await captureCanvas(scale);
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`[IQC] capture attempt ${attempt} failed:`, err);
          await new Promise(r => setTimeout(r, 250));
        }
      }
      if (!canvas) throw lastErr || new Error('Capture gagal');

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
        }, 'image/png', 1.0);
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
      const canvas = await captureCanvas(3);
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('blob null')), 'image/png', 1.0));
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
      const canvas = await captureCanvas(3);
      const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('blob null')), 'image/png', 1.0));
      const file = new File([blob], `iqc-${State.mode}-${Date.now()}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'IQC Generator', text: 'Chat bubble dari IRGXYMODS' });
        showToast('Dibagikan!', 'success');
      } else if (navigator.share) {
        await navigator.share({ title: 'IQC Generator — IRGXYMODS', text: 'Cek IQC Generator di IRGXYMODS!', url: location.href });
      } else {
        await downloadPNG(3);
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
    State.chatBgUrl = CHAT_BG_URL;
    State.contact = { name: 'Irgxy Mods', status: 'online', avatar: '', headerDate: 'Hari ini' };
    State.custom = { fontSize: 15, radius: 18 };
    State.contextmenu = JSON.parse(JSON.stringify(DEFAULT_CM));
    safe(() => localStorage.removeItem(STORAGE_KEY));

    if ($('#iqcContactName'))   $('#iqcContactName').value = State.contact.name;
    if ($('#iqcContactStatus')) $('#iqcContactStatus').value = State.contact.status;
    if ($('#iqcHeaderDate'))    $('#iqcHeaderDate').value = State.contact.headerDate;
    if ($('#iqcAvatarUrl'))     $('#iqcAvatarUrl').value = '';
    if ($('#iqcToggleDark'))       $('#iqcToggleDark').checked = false;
    if ($('#iqcToggleStatusBar'))  $('#iqcToggleStatusBar').checked = true;
    if ($('#iqcToggleRead'))       $('#iqcToggleRead').checked = true;
    if ($('#iqcToggleTyping'))     $('#iqcToggleTyping').checked = false;
    if ($('#iqcToggleWallpaper'))  $('#iqcToggleWallpaper').checked = true;

    if ($('#iqcCmMsgText'))     $('#iqcCmMsgText').value     = DEFAULT_CM.messageText;
    if ($('#iqcCmMsgTime'))     $('#iqcCmMsgTime').value     = DEFAULT_CM.messageTime;
    if ($('#iqcCmMsgType'))     $('#iqcCmMsgType').value     = DEFAULT_CM.messageType;
    if ($('#iqcCmBubbleColor')) $('#iqcCmBubbleColor').value = DEFAULT_CM.bubbleColor;
    if ($('#iqcCmTextColor'))   $('#iqcCmTextColor').value   = DEFAULT_CM.textColor;
    if ($('#iqcCmReactions'))   $('#iqcCmReactions').value   = DEFAULT_CM.reactions.join(',');
    if ($('#iqcCmBattery'))     $('#iqcCmBattery').value     = 59;
    if ($('#iqcCmBatteryVal'))  $('#iqcCmBatteryVal').textContent = 59;
    if ($('#iqcCmDim'))         $('#iqcCmDim').value         = Math.round(DEFAULT_CM.dimOpacity * 100);
    if ($('#iqcCmDimVal'))      $('#iqcCmDimVal').textContent = Math.round(DEFAULT_CM.dimOpacity * 100);
    if ($('#iqcCmDarkTheme'))      $('#iqcCmDarkTheme').checked      = DEFAULT_CM.darkTheme;
    if ($('#iqcCmShowReactions'))  $('#iqcCmShowReactions').checked  = DEFAULT_CM.showReactions;
    if ($('#iqcCmShowMenu'))       $('#iqcCmShowMenu').checked       = DEFAULT_CM.showContextMenu;

    const cmCard = $('#iqcContextMenuCard');
    const igCards = $$('.iqc-ig-card');
    const isCM = (State.mode === 'contextmenu');
    if (cmCard) cmCard.style.display = isCM ? 'block' : 'none';
    igCards.forEach(c => { c.style.display = isCM ? 'none' : 'block'; });

    renderPreview();
    renderMessageList();
    showToast('Reset berhasil', 'success');
  }

  /* ================= FAQ ================= */
  function initFaq() {
    $$('.iqc-faq-q').forEach(q => {
      q.addEventListener('click', () => {
        const parent = q.closest('.iqc-faq-item');
        if (!parent) return;
        $$('.iqc-faq-item').forEach(other => { if (other !== parent) other.classList.remove('open'); });
        parent.classList.toggle('open');
      });
    });
  }

  /* ================= EXPORT BINDINGS ================= */
  function initExportButtons() {
    $('#iqcDownloadPng')?.addEventListener('click', () => downloadPNG(3));
    $('#iqcDownloadHd')?.addEventListener('click',  () => downloadPNG(4));
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

  /* ================= PRELOAD BG IMAGE ================= */
  function preloadChatBackground() {
    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    bgImg.src = (State.chatBgUrl && String(State.chatBgUrl).trim()) || CHAT_BG_URL;
    bgImg.onload = () => { console.log('[IQC] BG image loaded:', bgImg.src); renderPreview(); };
    bgImg.onerror = () => { console.warn('[IQC] BG image gagal load:', bgImg.src); renderPreview(); };
  }

  /* ================= INIT ================= */
  function init() {
    try {
      loadPrefs();
      initTabs();
      initForm();
      initAvatarUpload();
      initToggleSwitches();
      initExportButtons();
      initContextMenuForm();
      initFaq();
      initKeyboard();
      preloadChatBackground();
      preloadContextMenuIcons();
      renderPreview();
      renderMessageList();

      if (window.AOS && typeof AOS.init === 'function') {
        try { AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 }); } catch (e) {}
      }
      console.log('✅ IQC Generator v5.8.2 (Image Icons — Clean MenuItems) siap');
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
    State, CHAT_BG_URL, CM_ICON_URL,
    applyChatBackground, renderPreview, renderMessageList,
    renderContextMenuPreview, addMessage, deleteMessage, editMessage,
    downloadPNG, copyImageToClipboard, shareImage, resetForm,
    preloadBackgroundImage, preloadContextMenuIcons, captureCanvas,
    sanitizeMenuItems, slugify
  };
})();