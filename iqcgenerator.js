/* ================================================================
   IQC GENERATOR — iqcgenerator.js
   Version: 5.12 (Instagram iOS Fully Removed)
   ================================================================
   CHANGELOG v5.12:
     [REMOVE] State.contact / State.messages / State.custom (IG only)
     [REMOVE] State.mode / darkMode / statusBar / readReceipt / typingIndicator
     [REMOVE] State.showWallpaper (hanya untuk IG chat)
     [REMOVE] initTabs() — mode tunggal: contextmenu
     [REMOVE] initForm() / incrementTime() (chat message IG)
     [REMOVE] initAvatarUpload() (avatar IG)
     [REMOVE] initToggleSwitches() (toggle IG)
     [REMOVE] renderMessageList() / addMessage / deleteMessage / editMessage
     [REMOVE] buildBubbleHTML() / checkIcon()
     [REMOVE] Branch IG di renderPreview() & onclone()
     [REMOVE] Referensi #iqcStatusBar / #iqcChatHeader / #iqcMessageList
     [REMOVE] .iqc-ig-card / .iqc-tab handler
     [KEEP] Context Menu iOS (WhatsApp iOS) — presisi 100%
     [KEEP] Custom Emoji Image + Size Slider
     [KEEP] Preload & capture pipeline
   ================================================================ */
(function () {
  'use strict';

  window.addEventListener('error', (e) => console.warn('[IQC] Runtime error:', e.message));
  window.addEventListener('unhandledrejection', (e) => console.warn('[IQC] Promise rejection:', e.reason));

  /* ================= CONSTANTS ================= */
  const CHAT_BG_URL = 'https://ik.imagekit.io/IrgxyMods/2383af11-2091-4331-9887-6627d8b71d7c.png';
  const CM_MENU_IMAGE_URL = 'https://ik.imagekit.io/IrgxyMods/BackgroundEraser_20260922_111514161.png';
  const BUBBLE_COLOR = '#444444';

  const EMOJI_FONT = "'Apple Color Emoji','AppleColorEmoji','Segoe UI Emoji','SegoeUIEmoji','Noto Color Emoji','NotoColorEmoji','EmojiOne Color','Android Emoji',sans-serif";
  const TEXT_FONT  = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif';

  const BG_FALLBACK_COLOR = '#0B141A';
  const STORAGE_KEY = 'irgxy_iqc_prefs_v5';

  const EMOJI_SIZE_MIN = 20;
  const EMOJI_SIZE_MAX = 80;
  const EMOJI_SIZE_DEFAULT = 26;
  const MAX_CUSTOM_EMOJI = 6;

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
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const isValidUrl = (u) => {
    if (typeof u !== 'string') return false;
    const t = u.trim();
    if (!t) return false;
    return /^(https?:\/\/|data:image\/)/i.test(t);
  };

  const normalizeEmojiUrls = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(u => String(u == null ? '' : u).trim())
      .filter(isValidUrl)
      .slice(0, MAX_CUSTOM_EMOJI);
  };

  /* ================= STATE (Context Menu Only) ================= */
  const DEFAULT_CM = {
    messageText: 'ikan hiu ngedek ngedek Indonesia nihhh dekkk',
    messageTime: '17:25',
    messageType: 'in',
    bubbleColor: BUBBLE_COLOR,
    textColor: '#FFFFFF',
    timeColor: '#8E8E93',
    reactions: ['👍','❤️','😂','😮','😢','🙏'],
    useCustomEmoji: false,
    customEmojiUrls: [],
    emojiSize: EMOJI_SIZE_DEFAULT,
    darkTheme: true,
    dimOpacity: 0.45,
    showReactions: true,
    showContextMenu: true,
    menuImage: CM_MENU_IMAGE_URL
  };

  const State = {
    chatBgUrl: CHAT_BG_URL,
    contextmenu: JSON.parse(JSON.stringify(DEFAULT_CM))
  };

  /* ================= PERSIST ================= */
  function savePrefs() {
    safe(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({
      chatBgUrl: State.chatBgUrl,
      contextmenu: State.contextmenu
    })));
  }
  function loadPrefs() {
    safe(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;

      State.chatBgUrl = (typeof d.chatBgUrl === 'string' && d.chatBgUrl.trim())
        ? d.chatBgUrl.trim() : CHAT_BG_URL;

      if (d.contextmenu && typeof d.contextmenu === 'object') {
        Object.assign(State.contextmenu, d.contextmenu);

        if (!Array.isArray(State.contextmenu.reactions) || !State.contextmenu.reactions.length)
          State.contextmenu.reactions = DEFAULT_CM.reactions.slice();
        else
          State.contextmenu.reactions = State.contextmenu.reactions
            .map(s => String(s || '').trim()).filter(Boolean).slice(0, 6);

        if (typeof State.contextmenu.menuImage !== 'string' || !State.contextmenu.menuImage.trim())
          State.contextmenu.menuImage = CM_MENU_IMAGE_URL;

        State.contextmenu.useCustomEmoji = State.contextmenu.useCustomEmoji === true;
        State.contextmenu.customEmojiUrls = normalizeEmojiUrls(State.contextmenu.customEmojiUrls);
        State.contextmenu.emojiSize = clamp(
          parseInt(State.contextmenu.emojiSize, 10) || EMOJI_SIZE_DEFAULT,
          EMOJI_SIZE_MIN, EMOJI_SIZE_MAX
        );

        /* Cleanup legacy keys dari versi lama */
        ['menuItems', 'mode'].forEach(k => { if (k in State.contextmenu) delete State.contextmenu[k]; });
      }
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

  /* ================================================================
     BUILD REACTIONS HTML (Unicode OR Custom Image)
     ================================================================ */
  function buildReactionsHTML(cm) {
    if (!cm || cm.showReactions === false) return '';

    const useCustom = cm.useCustomEmoji === true;
    const emojiSize = clamp(
      parseInt(cm.emojiSize, 10) || EMOJI_SIZE_DEFAULT,
      EMOJI_SIZE_MIN, EMOJI_SIZE_MAX
    );
    void emojiSize;

    const customUrls = normalizeEmojiUrls(cm.customEmojiUrls);
    const unicodeArr = Array.isArray(cm.reactions)
      ? cm.reactions.map(s => String(s || '').trim()).filter(Boolean).slice(0, 6)
      : [];

    let itemsHTML = '';

    if (useCustom) {
      if (!customUrls.length) {
        itemsHTML = `<span style="font-size:13px;color:#aaa;padding:0 8px;">Tidak ada URL emoji</span>`;
      } else {
        itemsHTML = customUrls.map((url, i) => `
          <img class="iqc-cm-emoji-img"
               src="${escapeHtml(url)}"
               alt="emoji-${i+1}"
               draggable="false"
               crossorigin="anonymous" />
        `).join('');
      }
    } else {
      if (!unicodeArr.length) return '';
      itemsHTML = unicodeArr.map(e => `<span>${escapeHtml(e)}</span>`).join('');
    }

    return `
      <div class="iqc-cm-reactions" data-emoji-mode="${useCustom ? 'image' : 'unicode'}">
        ${itemsHTML}
        <button class="iqc-cm-plus" type="button" tabindex="-1" aria-hidden="true">
          <i class="fas fa-plus"></i>
        </button>
      </div>`;
  }

  /* ================================================================
     APPLY EMOJI SIZE (CSS var + inline padding/gap/+)
     ================================================================ */
  function applyEmojiSizeStyles(reactionsEl, size) {
    if (!reactionsEl) return;
    const s = clamp(parseInt(size, 10) || EMOJI_SIZE_DEFAULT, EMOJI_SIZE_MIN, EMOJI_SIZE_MAX);
    const plusSize = Math.round(s * 1.23);
    const plusFont = Math.max(12, Math.round(s * 0.54));
    const padV = Math.max(6, Math.round(s * 0.27));
    const padH = Math.max(8, Math.round(s * 0.31));
    const padL = Math.max(14, Math.round(s * 0.62));
    const gap  = Math.max(6, Math.round(s * 0.31));

    reactionsEl.style.setProperty('--iqc-emoji-size', s + 'px');
    reactionsEl.style.setProperty('--iqc-plus-size', plusSize + 'px');
    reactionsEl.style.setProperty('--iqc-plus-font-size', plusFont + 'px');
    reactionsEl.style.padding = `${padV}px ${padH}px ${padV}px ${padL}px`;
    reactionsEl.style.gap = gap + 'px';
  }

  /* ================= RENDER PREVIEW ================= */
  let _rafPending = false;
  const renderPreview = debounce(function () {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      try { renderContextMenuPreview(); }
      catch (err) { console.warn('[IQC renderPreview]', err); }
    });
  }, 120);

  /* ================================================================
     RENDER CONTEXT MENU (single mode)
     ================================================================ */
  function renderContextMenuPreview() {
    const container = $('#iqcChatMessages');
    const chatBg    = $('#iqcChatBg');
    const frame     = $('#iqcPhoneFrame');
    if (!container || !chatBg || !frame) return;

    const cm = State.contextmenu || DEFAULT_CM;
    const isDark = cm.darkTheme !== false;

    frame.classList.toggle('dark-frame', isDark);

    chatBg.classList.toggle('dark', isDark);
    chatBg.classList.remove('has-wallpaper', 'no-wallpaper');
    applyChatBackground(chatBg);
    chatBg.style.padding = '0';
    chatBg.style.filter = '';

    container.style.padding = '0';
    container.style.overflow = 'hidden';

    const dimA = clamp(parseFloat(cm.dimOpacity), 0.2, 0.7) || 0.45;

    const reactionsHTML = buildReactionsHTML(cm);

    const bubbleColor = BUBBLE_COLOR;
    const textColor   = /^#[0-9a-fA-F]{6}$/.test(cm.textColor) ? cm.textColor : '#FFFFFF';
    const timeColor   = /^#[0-9a-fA-F]{6}$/.test(cm.timeColor) ? cm.timeColor : '#8E8E93';
    const msgType     = cm.messageType === 'out' ? 'out' : 'in';
    const msgText     = String(cm.messageText || '').slice(0, 300);
    const msgTime     = /^\d{2}:\d{2}$/.test(cm.messageTime) ? cm.messageTime : '17:25';

    State.contextmenu.bubbleColor = BUBBLE_COLOR;
    const bubbleColorInput = $('#iqcCmBubbleColor');
    if (bubbleColorInput && bubbleColorInput.value.toLowerCase() !== BUBBLE_COLOR) {
      bubbleColorInput.value = BUBBLE_COLOR;
    }

    const bubbleHTML = `
      <div class="iqc-cm-bubble ${msgType}" style="background:${bubbleColor};color:${textColor};">
        <span class="iqc-cm-bubble-content">${escapeHtml(msgText)}</span>
        <span class="iqc-cm-bubble-time" style="color:${timeColor};">${escapeHtml(msgTime)}</span>
      </div>`;

    const menuImageSrc = (typeof cm.menuImage === 'string' && cm.menuImage.trim())
      ? cm.menuImage.trim()
      : CM_MENU_IMAGE_URL;

    const menuHTML = (cm.showContextMenu !== false)
      ? `<div class="iqc-cm-menu-image-wrap">
           <img class="iqc-cm-menu-image"
                src="${escapeHtml(menuImageSrc)}"
                alt="Context Menu"
                draggable="false"
                crossorigin="anonymous" />
         </div>`
      : '';

    container.innerHTML = `
      <div class="iqc-cm-dim" style="background:rgba(0,0,0,${dimA});"></div>
      <div class="iqc-cm-stage">
        ${reactionsHTML}
        ${bubbleHTML}
        ${menuHTML}
      </div>`;

    const reactionsEl = container.querySelector('.iqc-cm-reactions');
    if (reactionsEl) {
      applyEmojiSizeStyles(reactionsEl, State.contextmenu.emojiSize);
    }

    /* Post-render force: pastikan #444444 menang dari cache */
    requestAnimationFrame(() => {
      const bubbleEl = container.querySelector('.iqc-cm-bubble');
      if (bubbleEl) {
        bubbleEl.style.background = BUBBLE_COLOR;
        bubbleEl.style.setProperty('background-color', BUBBLE_COLOR, 'important');
      }
      if (reactionsEl) {
        reactionsEl.style.background = BUBBLE_COLOR;
        reactionsEl.style.setProperty('background-color', BUBBLE_COLOR, 'important');
      }
      container.querySelectorAll('.iqc-cm-reactions span').forEach(el => {
        el.style.fontFamily = EMOJI_FONT;
        el.style.fontVariantEmoji = 'emoji';
      });
    });
  }

  /* ================================================================
     CONTEXT MENU FORM
     ================================================================ */
  function initContextMenuForm() {
    const cm = State.contextmenu;
    if (!cm) return;

    cm.bubbleColor = BUBBLE_COLOR;

    const setVal = (id, v) => { const el = $('#' + id); if (el) el.value = v; };
    const setChecked = (id, v) => { const el = $('#' + id); if (el) el.checked = !!v; };

    setVal('iqcCmMsgText', cm.messageText);
    setVal('iqcCmMsgTime', cm.messageTime);
    setVal('iqcCmMsgType', cm.messageType);
    setVal('iqcCmBubbleColor', BUBBLE_COLOR);
    setVal('iqcCmTextColor', cm.textColor);
    setVal('iqcCmReactions', Array.isArray(cm.reactions) ? cm.reactions.join(',') : '');
    setVal('iqcCmBattery', cm.statusBattery || 59);
    setVal('iqcCmDim', Math.round((parseFloat(cm.dimOpacity) || 0.45) * 100));
    setChecked('iqcCmDarkTheme', cm.darkTheme);
    setChecked('iqcCmShowReactions', cm.showReactions);
    setChecked('iqcCmShowMenu', cm.showContextMenu);

    setChecked('iqcCmUseCustomEmoji', cm.useCustomEmoji);
    setVal('iqcCmEmojiSize', cm.emojiSize || EMOJI_SIZE_DEFAULT);

    const customEmojiField = $('#iqcCmCustomEmojiField');
    if (customEmojiField) {
      customEmojiField.style.display = cm.useCustomEmoji ? 'flex' : 'none';
    }

    const customEmojiUrlsEl = $('#iqcCmCustomEmojiUrls');
    if (customEmojiUrlsEl) {
      customEmojiUrlsEl.value = Array.isArray(cm.customEmojiUrls)
        ? cm.customEmojiUrls.join('\n')
        : '';
    }

    const emojiSizeVal = $('#iqcCmEmojiSizeVal');
    if (emojiSizeVal) emojiSizeVal.textContent = cm.emojiSize || EMOJI_SIZE_DEFAULT;

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
    bindText('iqcCmTextColor', 'textColor');

    const colorInput = $('#iqcCmBubbleColor');
    if (colorInput) {
      colorInput.value = BUBBLE_COLOR;
      colorInput.addEventListener('input', () => {
        if (colorInput.value.toLowerCase() !== BUBBLE_COLOR) {
          colorInput.value = BUBBLE_COLOR;
        }
        State.contextmenu.bubbleColor = BUBBLE_COLOR;
        renderPreview(); savePrefs();
      });
      colorInput.addEventListener('change', () => {
        colorInput.value = BUBBLE_COLOR;
        State.contextmenu.bubbleColor = BUBBLE_COLOR;
        renderPreview(); savePrefs();
      });
    }

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

    const emojiSizeEl = $('#iqcCmEmojiSize');
    if (emojiSizeEl) {
      emojiSizeEl.addEventListener('input', () => {
        const v = clamp(parseInt(emojiSizeEl.value, 10) || EMOJI_SIZE_DEFAULT, EMOJI_SIZE_MIN, EMOJI_SIZE_MAX);
        State.contextmenu.emojiSize = v;
        if (emojiSizeVal) emojiSizeVal.textContent = v;
        const reactionsEl = document.querySelector('#iqcChatMessages .iqc-cm-reactions');
        if (reactionsEl) applyEmojiSizeStyles(reactionsEl, v);
        savePrefs();
      });
    }

    const useCustomToggle = $('#iqcCmUseCustomEmoji');
    if (useCustomToggle) {
      useCustomToggle.addEventListener('change', () => {
        State.contextmenu.useCustomEmoji = !!useCustomToggle.checked;
        if (customEmojiField) {
          customEmojiField.style.display = useCustomToggle.checked ? 'flex' : 'none';
        }
        renderPreview(); savePrefs();
      });
    }

    if (customEmojiUrlsEl) {
      let _emojiUrlTimer = null;
      customEmojiUrlsEl.addEventListener('input', () => {
        clearTimeout(_emojiUrlTimer);
        _emojiUrlTimer = setTimeout(() => {
          try {
            const raw = String(customEmojiUrlsEl.value || '')
              .split('\n').map(s => s.trim()).filter(Boolean).slice(0, MAX_CUSTOM_EMOJI);
            State.contextmenu.customEmojiUrls = normalizeEmojiUrls(raw);
            renderPreview(); savePrefs();
          } catch (e) { console.warn('[IQC customEmojiUrls]', e); }
        }, 300);
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

  /* ================= PRELOAD BG ================= */
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

  /* ================= PRELOAD CONTEXT MENU IMAGE ================= */
  function preloadContextMenuImage() {
    return new Promise((resolve) => {
      const url = (State.contextmenu && State.contextmenu.menuImage)
        ? String(State.contextmenu.menuImage).trim()
        : CM_MENU_IMAGE_URL;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      img.onload  = () => { console.log('[IQC v5.12] CM image loaded:', url); finish(); };
      img.onerror = () => { console.warn('[IQC v5.12] CM image gagal load:', url); finish(); };
      img.src = url || CM_MENU_IMAGE_URL;
      setTimeout(finish, 10000);
    });
  }

  /* ================= PRELOAD CUSTOM EMOJI IMAGES ================= */
  function preloadCustomEmojiImages() {
    const cm = State.contextmenu || DEFAULT_CM;
    if (cm.useCustomEmoji !== true) return Promise.resolve();

    const urls = normalizeEmojiUrls(cm.customEmojiUrls);
    if (!urls.length) return Promise.resolve();

    return Promise.all(urls.map(url => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      img.onload  = () => { console.log('[IQC v5.12] Emoji loaded:', url); finish(); };
      img.onerror = () => { console.warn('[IQC v5.12] Emoji gagal load:', url); finish(); };
      img.src = url;
      setTimeout(finish, 8000);
    })));
  }

  /* ================================================================
     CAPTURE CANVAS
     ================================================================ */
  async function captureCanvas(scale = 3) {
    if (typeof html2canvas !== 'function') throw new Error('html2canvas tidak tersedia');
    const frame = $('#iqcPhoneFrame');
    if (!frame) throw new Error('Frame tidak ditemukan');

    await Promise.all([
      preloadBackgroundImage(),
      preloadContextMenuImage(),
      preloadCustomEmojiImages(),
    ]);

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
      .iqc-cm-bubble { animation: none !important; }
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

            /* 1) Background chat */
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

            /* 2) Frame rendering */
            const clonedFrame = clonedDoc.querySelector('#iqcPhoneFrame');
            if (clonedFrame) {
              clonedFrame.style.imageRendering = 'high-quality';
              clonedFrame.style.webkitFontSmoothing = 'antialiased';
              clonedFrame.classList.add('dark-frame');
            }

            /* 3) Dim overlay */
            const clonedDim = clonedDoc.querySelector('.iqc-cm-dim');
            if (clonedDim) {
              const dimA = clamp(parseFloat(State.contextmenu.dimOpacity), 0.2, 0.7) || 0.45;
              clonedDim.style.background = `rgba(0,0,0,${dimA})`;
              clonedDim.style.zIndex = '1';
            }
            const clonedStage = clonedDoc.querySelector('.iqc-cm-stage');
            if (clonedStage) clonedStage.style.zIndex = '2';

            /* 4) Force bubble & reactions background #444444 */
            clonedDoc.querySelectorAll('.iqc-cm-bubble').forEach(el => {
              el.style.background    = BUBBLE_COLOR;
              el.style.backgroundColor = BUBBLE_COLOR;
              el.style.setProperty('background-color', BUBBLE_COLOR, 'important');
            });
            clonedDoc.querySelectorAll('.iqc-cm-reactions').forEach(el => {
              el.style.background    = BUBBLE_COLOR;
              el.style.backgroundColor = BUBBLE_COLOR;
              el.style.setProperty('background-color', BUBBLE_COLOR, 'important');
              el.style.backdropFilter = 'none';
              el.style.webkitBackdropFilter = 'none';
            });

            /* 5) Force emoji size & font */
            const emojiSize = clamp(
              parseInt(State.contextmenu.emojiSize, 10) || EMOJI_SIZE_DEFAULT,
              EMOJI_SIZE_MIN, EMOJI_SIZE_MAX
            );
            const emojiSizePx = emojiSize + 'px';

            clonedDoc.querySelectorAll('.iqc-cm-reactions span').forEach(el => {
              el.style.fontSize = emojiSizePx;
              el.style.fontFamily = EMOJI_FONT;
              el.style.fontVariantEmoji = 'emoji';
              el.style.lineHeight = '1';
              el.style.webkitFontSmoothing = 'antialiased';
              el.style.textRendering = 'geometricPrecision';
            });
            clonedDoc.querySelectorAll('.iqc-cm-bubble-content').forEach(el => {
              el.style.fontFamily = `${TEXT_FONT}, ${EMOJI_FONT}`;
              el.style.fontVariantEmoji = 'emoji';
              el.style.webkitFontSmoothing = 'antialiased';
              el.style.textRendering = 'geometricPrecision';
            });

            /* 6) Force custom emoji image rendering */
            clonedDoc.querySelectorAll('.iqc-cm-reactions img.iqc-cm-emoji-img').forEach(img => {
              img.style.width  = emojiSizePx;
              img.style.height = emojiSizePx;
              img.style.objectFit = 'contain';
              img.style.display = 'inline-block';
              img.style.verticalAlign = 'middle';
              img.style.flexShrink = '0';
              img.style.pointerEvents = 'none';
              img.style.imageRendering = 'auto';
              img.style.webkitBackfaceVisibility = 'hidden';
              img.style.backfaceVisibility = 'hidden';
              img.style.transform = 'translateZ(0)';
              if (!img.getAttribute('src')) {
                const fallbackUrl = normalizeEmojiUrls(State.contextmenu.customEmojiUrls)[0];
                if (fallbackUrl) img.setAttribute('src', fallbackUrl);
              }
              img.setAttribute('crossorigin', 'anonymous');
            });

            /* 7) Force reactions padding & gap sesuai size */
            clonedDoc.querySelectorAll('.iqc-cm-reactions').forEach(el => {
              const s = emojiSize;
              const padV = Math.max(6, Math.round(s * 0.27));
              const padH = Math.max(8, Math.round(s * 0.31));
              const padL = Math.max(14, Math.round(s * 0.62));
              const gap  = Math.max(6, Math.round(s * 0.31));
              const plusSize = Math.round(s * 1.23);
              const plusFont = Math.max(12, Math.round(s * 0.54));

              el.style.padding = `${padV}px ${padH}px ${padV}px ${padL}px`;
              el.style.gap = gap + 'px';
              el.style.setProperty('--iqc-emoji-size', s + 'px');
              el.style.setProperty('--iqc-plus-size', plusSize + 'px');
              el.style.setProperty('--iqc-plus-font-size', plusFont + 'px');

              const plusBtn = el.querySelector('.iqc-cm-plus');
              if (plusBtn) {
                plusBtn.style.width = plusSize + 'px';
                plusBtn.style.height = plusSize + 'px';
                plusBtn.style.fontSize = plusFont + 'px';
                const icon = plusBtn.querySelector('i');
                if (icon) icon.style.fontSize = plusFont + 'px';
              }
            });

            /* 8) Context menu image */
            clonedDoc.querySelectorAll('.iqc-cm-menu-image').forEach(img => {
              img.style.display = 'block';
              img.style.width = '100%';
              img.style.maxWidth = '270px';
              img.style.height = 'auto';
              img.style.objectFit = 'contain';
              img.style.pointerEvents = 'none';
              img.style.imageRendering = 'auto';
              img.style.webkitBackfaceVisibility = 'hidden';
              img.style.backfaceVisibility = 'hidden';
              img.style.transform = 'translateZ(0)';
              if (!img.getAttribute('src')) {
                img.setAttribute('src', CM_MENU_IMAGE_URL);
              }
              img.setAttribute('crossorigin', 'anonymous');
            });

            /* 9) Force text font stack */
            clonedDoc.querySelectorAll('.iqc-cm-plus, .iqc-cm-bubble-time').forEach(el => {
              el.style.fontFamily = `${TEXT_FONT}, ${EMOJI_FONT}`;
              el.style.fontKerning = 'normal';
              el.style.webkitFontSmoothing = 'antialiased';
              el.style.mozOsxFontSmoothing = 'grayscale';
              el.style.textRendering = 'geometricPrecision';
            });

            /* 10) Kill animations & force sizes */
            const killStyle = clonedDoc.createElement('style');
            killStyle.textContent = `
              *, *::before, *::after {
                animation: none !important;
                transition: none !important;
              }
              .iqc-cm-bubble { background: ${BUBBLE_COLOR} !important; animation: none !important; }
              .iqc-cm-reactions { background: ${BUBBLE_COLOR} !important; }
              .iqc-cm-reactions span {
                font-family: ${EMOJI_FONT} !important;
                font-variant-emoji: emoji !important;
                font-size: ${emojiSizePx} !important;
                line-height: 1 !important;
              }
              .iqc-cm-reactions img.iqc-cm-emoji-img {
                width: ${emojiSizePx} !important;
                height: ${emojiSizePx} !important;
                object-fit: contain !important;
                display: inline-block !important;
              }
              .iqc-cm-menu-image {
                display: block !important;
                width: 100% !important;
                max-width: 270px !important;
                height: auto !important;
                object-fit: contain !important;
              }
            `;
            clonedDoc.head.appendChild(killStyle);

            /* 11) Reset padding chat-messages */
            const clonedMessages = clonedDoc.querySelector('#iqcChatMessages');
            if (clonedMessages) {
              clonedMessages.style.padding = '0';
              clonedMessages.style.overflow = 'hidden';
            }
          } catch (e) { console.warn('[IQC onclone v5.12]', e); }
        }
      });
    } finally {
      freezeStyle.remove();
    }
  }

  /* ================================================================
     DOWNLOAD PNG
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
            a.download = `iqc-contextmenu-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            resolve();
          } catch (err) { reject(err); }
        }, 'image/png', 1.0);
      });

      showToast('Gambar diunduh!', 'success');
      if (typeof window.addActivity === 'function') window.addActivity('download', 'IQC contextmenu');
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
      const file = new File([blob], `iqc-contextmenu-${Date.now()}.png`, { type: 'image/png' });
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

    State.chatBgUrl = CHAT_BG_URL;
    State.contextmenu = JSON.parse(JSON.stringify(DEFAULT_CM));
    State.contextmenu.bubbleColor = BUBBLE_COLOR;
    safe(() => localStorage.removeItem(STORAGE_KEY));

    if ($('#iqcCmMsgText'))     $('#iqcCmMsgText').value     = DEFAULT_CM.messageText;
    if ($('#iqcCmMsgTime'))     $('#iqcCmMsgTime').value     = DEFAULT_CM.messageTime;
    if ($('#iqcCmMsgType'))     $('#iqcCmMsgType').value     = DEFAULT_CM.messageType;
    if ($('#iqcCmBubbleColor')) $('#iqcCmBubbleColor').value = BUBBLE_COLOR;
    if ($('#iqcCmTextColor'))   $('#iqcCmTextColor').value   = DEFAULT_CM.textColor;
    if ($('#iqcCmReactions'))   $('#iqcCmReactions').value   = DEFAULT_CM.reactions.join(',');
    if ($('#iqcCmBattery'))     $('#iqcCmBattery').value     = 59;
    if ($('#iqcCmBatteryVal'))  $('#iqcCmBatteryVal').textContent = 59;
    if ($('#iqcCmDim'))         $('#iqcCmDim').value         = Math.round(DEFAULT_CM.dimOpacity * 100);
    if ($('#iqcCmDimVal'))      $('#iqcCmDimVal').textContent = Math.round(DEFAULT_CM.dimOpacity * 100);
    if ($('#iqcCmDarkTheme'))      $('#iqcCmDarkTheme').checked      = DEFAULT_CM.darkTheme;
    if ($('#iqcCmShowReactions'))  $('#iqcCmShowReactions').checked  = DEFAULT_CM.showReactions;
    if ($('#iqcCmShowMenu'))       $('#iqcCmShowMenu').checked       = DEFAULT_CM.showContextMenu;

    if ($('#iqcCmEmojiSize'))        $('#iqcCmEmojiSize').value = EMOJI_SIZE_DEFAULT;
    if ($('#iqcCmEmojiSizeVal'))     $('#iqcCmEmojiSizeVal').textContent = EMOJI_SIZE_DEFAULT;
    if ($('#iqcCmUseCustomEmoji'))   $('#iqcCmUseCustomEmoji').checked = false;
    if ($('#iqcCmCustomEmojiUrls'))  $('#iqcCmCustomEmojiUrls').value = '';
    if ($('#iqcCmCustomEmojiField')) $('#iqcCmCustomEmojiField').style.display = 'none';

    renderPreview();
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

  /* ================= PRELOAD BG ON LOAD ================= */
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
      State.contextmenu.bubbleColor = BUBBLE_COLOR;

      initContextMenuForm();
      initExportButtons();
      initFaq();
      initKeyboard();
      preloadChatBackground();
      preloadContextMenuImage();
      preloadCustomEmojiImages();
      renderPreview();

      if (window.AOS && typeof AOS.init === 'function') {
        try { AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 }); } catch (e) {}
      }
      console.log('✅ IQC Generator v5.12 (Instagram iOS removed, Context Menu only) siap');
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
    State, CHAT_BG_URL, CM_MENU_IMAGE_URL, BUBBLE_COLOR, EMOJI_FONT,
    EMOJI_SIZE_MIN, EMOJI_SIZE_MAX, EMOJI_SIZE_DEFAULT, MAX_CUSTOM_EMOJI,
    applyChatBackground, renderPreview,
    renderContextMenuPreview, buildReactionsHTML, applyEmojiSizeStyles,
    downloadPNG, copyImageToClipboard, shareImage, resetForm,
    preloadBackgroundImage, preloadContextMenuImage, preloadCustomEmojiImages,
    captureCanvas, normalizeEmojiUrls, isValidUrl
  };
})();