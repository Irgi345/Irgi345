/* =========================================================
   SPMB SMK MUHAMMADIYAH KUDUS 2025/2026
   Vanilla JS — 18 Modul, Zero Error
   ========================================================= */
(function () {
  'use strict';

  /* ============ SAFE HELPERS ============ */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const prefersReduced = (() => {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  })();

  const isDesktop = () => {
    try { return window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches; }
    catch (_) { return false; }
  };

  /* ============ 17) XSS ESCAPE HELPER ============ */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============ STORAGE (SAFE) ============ */
  const Store = {
    get(key) {
      try { return window.localStorage.getItem(key); }
      catch (_) { return null; }
    },
    set(key, val) {
      try { window.localStorage.setItem(key, val); return true; }
      catch (_) { return false; }
    }
  };

  /* =========================================================
     1) PRELOADER HIDE
     ========================================================= */
  function initPreloader() {
    const pre = $('#preloader');
    if (!pre) return;
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      pre.classList.add('hide');
      setTimeout(() => {
        if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
      }, 600);
    };
    window.addEventListener('load', hide, { once: true });
    // fallback if load already fired or slow network
    setTimeout(hide, 3500);
  }

  /* =========================================================
     2) FOOTER YEAR
     ========================================================= */
  function initFooterYear() {
    const y = $('#year');
    if (!y) return;
    try { y.textContent = String(new Date().getFullYear()); }
    catch (_) { /* ignore */ }
  }

  /* =========================================================
     3) NAVBAR SCROLL STATE
     ========================================================= */
  function initNavbarScroll() {
    const nav = $('#navbar');
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 40) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* =========================================================
     4) SCROLL PROGRESS
     ========================================================= */
  function initScrollProgress() {
    const bar = $('#scrollProgress');
    if (!bar) return;
    let raf = false;
    const update = () => {
      raf = false;
      try {
        const doc = document.documentElement;
        const h = doc.scrollHeight - doc.clientHeight;
        const pct = h > 0 ? (doc.scrollTop / h) * 100 : 0;
        bar.style.width = pct.toFixed(2) + '%';
      } catch (_) { /* ignore */ }
    };
    const onScroll = () => {
      if (!raf) { raf = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* =========================================================
     5) BACK TO TOP
     ========================================================= */
  function initBackTop() {
    const btn = $('#backTop');
    if (!btn) return;
    const onScroll = () => {
      if (window.scrollY > 500) btn.classList.add('show');
      else btn.classList.remove('show');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', () => {
      try { window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }); }
      catch (_) { window.scrollTo(0, 0); }
    });
  }

  /* =========================================================
     6) HAMBURGER TOGGLE
     ========================================================= */
  function initHamburger() {
    const btn = $('#hamburger');
    const menu = $('#navMenu');
    if (!btn || !menu) return;

    const setOpen = (open) => {
      btn.classList.toggle('active', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!menu.classList.contains('open'));
    });

    // Close when clicking a nav link
    $$('.nav-link, .nav-cta', menu).forEach((a) => {
      a.addEventListener('click', () => setOpen(false));
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('open')) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    });

    // Close on resize back to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) setOpen(false);
    }, { passive: true });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
    });
  }

  /* =========================================================
     7) SCROLLSPY
     ========================================================= */
  function initScrollspy() {
    const links = $$('.nav-link');
    if (!links.length) return;

    const sections = [];
    links.forEach((l) => {
      const id = (l.getAttribute('href') || '').replace('#', '');
      if (!id) return;
      const el = document.getElementById(id);
      if (el) sections.push({ link: l, el: el });
    });
    if (!sections.length) return;

    let raf = false;
    const update = () => {
      raf = false;
      const scrollPos = window.scrollY + 120;
      let current = sections[0];
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        if (s.el.offsetTop <= scrollPos) current = s;
      }
      // If near bottom, force last section active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1];
      }
      sections.forEach((s) => s.link.classList.toggle('active', s === current));
    };
    const onScroll = () => {
      if (!raf) { raf = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* =========================================================
     8) REVEAL ON SCROLL (IntersectionObserver + fallback)
     ========================================================= */
  function initReveal() {
    const els = $$('.reveal');
    if (!els.length) return;

    if (prefersReduced || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'));
      return;
    }
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
      els.forEach((el) => io.observe(el));
    } catch (_) {
      els.forEach((el) => el.classList.add('visible'));
    }
  }

  /* =========================================================
     9) ANIMATED COUNTER
     ========================================================= */
  function initCounters() {
    const nodes = $$('.stat-num');
    if (!nodes.length) return;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (el) => {
      const target = parseInt(el.getAttribute('data-target') || '0', 10) || 0;
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 1600;
      const start = performance.now();

      if (prefersReduced) {
        el.textContent = target + suffix;
        return;
      }

      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const val = Math.round(target * easeOutCubic(t));
        el.textContent = val + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target + suffix;
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(animate);
      return;
    }
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.35 });
      nodes.forEach((n) => io.observe(n));
    } catch (_) {
      nodes.forEach(animate);
    }
  }

  /* =========================================================
     10) CURSOR GLOW (lerp 0.12, desktop only)
     ========================================================= */
  function initCursorGlow() {
    if (prefersReduced || !isDesktop()) return;
    const glow = $('#cursorGlow');
    if (!glow) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let gx = mx, gy = my;
    let raf = null;

    const tick = () => {
      gx += (mx - gx) * 0.12;
      gy += (my - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    });
  }

  /* =========================================================
     11) COUNTDOWN TIMER
     ========================================================= */
  function initCountdown() {
    const dEl = $('#cdDays');
    const hEl = $('#cdHours');
    const mEl = $('#cdMins');
    const sEl = $('#cdSecs');
    if (!dEl || !hEl || !mEl || !sEl) return;

    // Target: 28 Feb 2025 23:59 WIB (UTC+7) => 2025-02-28T16:59:00Z
    const target = Date.UTC(2025, 1, 28, 16, 59, 0);
    const pad = (n) => (n < 10 ? '0' + n : String(n));

    const update = () => {
      const now = Date.now();
      let diff = target - now;
      if (diff < 0) diff = 0;
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      dEl.textContent = pad(days);
      hEl.textContent = pad(hours);
      mEl.textContent = pad(mins);
      sEl.textContent = pad(secs);
    };
    update();
    setInterval(update, 1000);
  }

  /* =========================================================
     12) FORM VALIDATION (15 validators real-time)
     ========================================================= */
  const Validators = {
    nama: (v) => v.trim().length >= 3 ? '' : 'Nama minimal 3 karakter.',
    nisn: (v) => /^\d{10}$/.test(v.trim()) ? '' : 'NISN harus 10 digit angka.',
    tempatLahir: (v) => v.trim().length >= 3 ? '' : 'Tempat lahir minimal 3 karakter.',
    tanggalLahir: (v) => {
      if (!v) return 'Tanggal lahir wajib diisi.';
      const d = new Date(v);
      if (isNaN(d.getTime())) return 'Tanggal lahir tidak valid.';
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      if (age < 8 || age > 25) return 'Umur harus antara 8 sampai 25 tahun.';
      return '';
    },
    jenisKelamin: (v) => v ? '' : 'Pilih jenis kelamin.',
    agama: (v) => v ? '' : 'Pilih agama.',
    alamat: (v) => v.trim().length >= 10 ? '' : 'Alamat minimal 10 karakter.',
    hpSiswa: (v) => /^0\d{9,13}$/.test(v.trim()) ? '' : 'Format HP: 08xxxxxxx (10-14 digit).',
    hpOrtu: (v) => /^0\d{9,13}$/.test(v.trim()) ? '' : 'Format HP: 08xxxxxxx (10-14 digit).',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Format email tidak valid.',
    asalSekolah: (v) => v.trim().length >= 3 ? '' : 'Asal sekolah minimal 3 karakter.',
    namaOrtu: (v) => v.trim().length >= 3 ? '' : 'Nama orang tua minimal 3 karakter.',
    pekerjaanOrtu: (v) => v.trim().length >= 3 ? '' : 'Pekerjaan minimal 3 karakter.',
    jurusan: (v) => v ? '' : 'Pilih jurusan.',
    gelombang: (v) => v ? '' : 'Pilih gelombang.',
    setuju: (v, el) => (el && el.checked) ? '' : 'Anda harus menyetujui syarat & ketentuan.'
  };

  function setFieldState(input, errEl, msg) {
    if (!input) return;
    const field = input.closest ? input.closest('.field') : null;
    const target = errEl || (field ? field.querySelector('.err') : null);

    if (msg) {
      input.classList.add('invalid');
      input.classList.remove('valid');
      input.setAttribute('aria-invalid', 'true');
      if (target) { target.textContent = msg; target.classList.add('show'); }
    } else {
      input.classList.remove('invalid');
      if (input.value || (input.type === 'checkbox' && input.checked)) {
        input.classList.add('valid');
      } else {
        input.classList.remove('valid');
      }
      input.removeAttribute('aria-invalid');
      if (target) { target.textContent = ''; target.classList.remove('show'); }
    }
  }

  function validateField(id, form) {
    const input = form.querySelector('#' + id);
    if (!input) return true;
    const validator = Validators[id];
    if (!validator) return true;
    const msg = validator(input.value, input);
    const errEl = form.querySelector('.err[data-for="' + id + '"]');
    setFieldState(input, errEl, msg);
    return !msg;
  }

  const FIELD_IDS = [
    'nama', 'nisn', 'tempatLahir', 'tanggalLahir', 'jenisKelamin',
    'agama', 'alamat', 'hpSiswa', 'hpOrtu', 'email',
    'asalSekolah', 'namaOrtu', 'pekerjaanOrtu', 'jurusan', 'gelombang'
  ];

  function initFormValidation() {
    const form = $('#regForm');
    if (!form) return;

    FIELD_IDS.forEach((id) => {
      const input = form.querySelector('#' + id);
      if (!input) return;
      const ev = (input.tagName === 'SELECT') ? 'change' : 'input';
      input.addEventListener(ev, () => {
        // only live-validate after user has typed something or on change
        if (input.value) validateField(id, form);
      });
      input.addEventListener('blur', () => validateField(id, form));
    });

    // checkbox
    const chk = form.querySelector('#setuju');
    if (chk) {
      chk.addEventListener('change', () => {
        const errEl = form.querySelector('.err[data-for="setuju"]');
        const msg = Validators.setuju('', chk);
        setFieldState(chk, errEl, msg);
      });
    }

    // reset clears errors
    form.addEventListener('reset', () => {
      setTimeout(() => {
        FIELD_IDS.forEach((id) => {
          const input = form.querySelector('#' + id);
          if (!input) return;
          input.classList.remove('invalid', 'valid');
          input.removeAttribute('aria-invalid');
        });
        const chkEl = form.querySelector('#setuju');
        if (chkEl) chkEl.checked = false;
        $$('.err', form).forEach((e) => { e.textContent = ''; e.classList.remove('show'); });
      }, 0);
    });
  }

  /* =========================================================
     13) FORM SUBMIT + 14) MODAL CONTROL
     ========================================================= */
  let lastFocused = null;

  function generateRegNumber() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SPMB-${yy}${mm}-${rand}`;
  }

  function collectData(form) {
    const data = {};
    FIELD_IDS.forEach((id) => {
      const input = form.querySelector('#' + id);
      if (input) data[id] = input.value.trim();
    });
    const chk = form.querySelector('#setuju');
    data.setuju = !!(chk && chk.checked);
    return data;
  }

  function saveRegistration(record) {
    try {
      const key = 'spmb_smkmuhi';
      const raw = Store.get(key);
      const arr = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      list.push(record);
      Store.set(key, JSON.stringify(list));
    } catch (_) { /* storage may be full/unavailable */ }
  }

  function openModal(record) {
    const modal = $('#successModal');
    if (!modal) return;
    lastFocused = document.activeElement;

    const numEl = $('#modalNumber');
    if (numEl) numEl.textContent = record.nomor;

    const set = (id, val) => {
      const el = $(id);
      if (el) el.textContent = escapeHtml(val || '-');
    };
    set('#sumNama', record.nama);
    set('#sumNisn', record.nisn);
    set('#sumJurusan', record.jurusan);
    set('#sumGelombang', record.gelombang);
    set('#sumHp', record.hpSiswa);
    set('#sumEmail', record.email);

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeBtn = modal.querySelector('.modal-done');
    if (closeBtn) setTimeout(() => { try { closeBtn.focus(); } catch (_) {} }, 60);
  }

  function closeModal() {
    const modal = $('#successModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (_) {}
    }
  }

  function initModalControl() {
    const modal = $('#successModal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close')) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });

    // Focus trap (simple)
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !modal.classList.contains('show')) return;
      const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function initFormSubmit() {
    const form = $('#regForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // validate all
      let firstInvalid = null;
      FIELD_IDS.forEach((id) => {
        const ok = validateField(id, form);
        if (!ok && !firstInvalid) firstInvalid = form.querySelector('#' + id);
      });

      // checkbox
      const chk = form.querySelector('#setuju');
      const chkErrEl = form.querySelector('.err[data-for="setuju"]');
      const chkMsg = Validators.setuju('', chk);
      setFieldState(chk, chkErrEl, chkMsg);
      if (chkMsg && !firstInvalid) firstInvalid = chk;

      if (firstInvalid) {
        try {
          const rect = firstInvalid.getBoundingClientRect();
          const top = window.scrollY + rect.top - 120;
          window.scrollTo({ top: top, behavior: prefersReduced ? 'auto' : 'smooth' });
        } catch (_) {}
        setTimeout(() => { try { firstInvalid.focus({ preventScroll: true }); } catch (_) {} }, prefersReduced ? 0 : 400);
        return;
      }

      // Build record
      const data = collectData(form);
      const record = Object.assign({}, data, {
        nomor: generateRegNumber(),
        timestamp: new Date().toISOString()
      });

      saveRegistration(record);
      openModal(record);

      // Reset form + clear styles
      form.reset();
      FIELD_IDS.forEach((id) => {
        const input = form.querySelector('#' + id);
        if (!input) return;
        input.classList.remove('invalid', 'valid');
        input.removeAttribute('aria-invalid');
      });
      if (chk) {
        chk.checked = false;
        chk.classList.remove('invalid', 'valid');
      }
      $$('.err', form).forEach((el) => { el.textContent = ''; el.classList.remove('show'); });
    });
  }

  /* =========================================================
     15) SMOOTH ANCHOR SCROLL (offset 80px)
     ========================================================= */
  function initSmoothAnchors() {
    const links = $$('a[href^="#"]');
    if (!links.length) return;
    links.forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href === '#' || href.length < 2) return;
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        e.preventDefault();
        try {
          const rect = target.getBoundingClientRect();
          const top = window.scrollY + rect.top - 80;
          window.scrollTo({ top: top, behavior: prefersReduced ? 'auto' : 'smooth' });
        } catch (_) {
          target.scrollIntoView();
        }
      });
    });
  }

  /* =========================================================
     16) PARALLAX ORBS (light, desktop only)
     ========================================================= */
  function initParallax() {
    if (prefersReduced || !isDesktop()) return;
    const orbs = $$('[data-parallax]');
    if (!orbs.length) return;

    let raf = false;
    const update = () => {
      raf = false;
      const y = window.scrollY;
      orbs.forEach((o) => {
        const speed = parseFloat(o.getAttribute('data-parallax')) || 0;
        const base = o.style.getPropertyValue('--base-transform') || '';
        o.style.transform = `translate3d(0, ${(y * speed).toFixed(2)}px, 0) ${base}`;
      });
    };
    const onScroll = () => {
      if (!raf) { raf = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  /* =========================================================
     18) GLOBAL ERROR GUARD + BOOTSTRAP
     ========================================================= */
  function boot() {
    const modules = [
      initPreloader,
      initFooterYear,
      initNavbarScroll,
      initScrollProgress,
      initBackTop,
      initHamburger,
      initScrollspy,
      initReveal,
      initCounters,
      initCursorGlow,
      initCountdown,
      initFormValidation,
      initFormSubmit,
      initModalControl,
      initSmoothAnchors,
      initParallax
    ];
    modules.forEach((fn) => {
      try { fn(); }
      catch (err) {
        // Silent fail per module to protect the whole page
        if (window.console && console.warn) {
          console.warn('[SPMB] Modul gagal:', fn.name || 'anonymous', err);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Global error guard
  window.addEventListener('error', (e) => {
    if (window.console && console.warn) {
      console.warn('[SPMB] Runtime error ditangkap:', e.message || e);
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (window.console && console.warn) {
      console.warn('[SPMB] Promise rejection ditangkap:', e.reason);
    }
  });

})();