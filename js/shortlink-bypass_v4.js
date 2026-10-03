/* ================================================================
   IRGXYMODS — SHORTLINK BYPASS V4 (ULTIMATE EDITION)
   Merge V2 (Legacy) + V3 (Modern) + 20 Fitur Baru
   Layer : direct | proxy | api | info
   Author: IRGXYMODS Engineering
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     HELPERS & FALLBACK GLOBAL
     ================================================================ */
  const $  = (window.IRGXY && window.IRGXY.$)  || ((s, ctx = document) => ctx.querySelector(s));
  const $$ = (window.IRGXY && window.IRGXY.$$) || ((s, ctx = document) => Array.from(ctx.querySelectorAll(s)));

  /* ---------- TOAST QUEUE (max 3) ---------- */
  const toastQueue = [];
  const MAX_TOAST = 3;
  function showToast(msg, type = 'info') {
    if (window.IRGXY && typeof window.IRGXY.showToast === 'function') {
      return window.IRGXY.showToast(msg, type);
    }
    if (!getSetting('notifications', true)) return;
    const c = document.getElementById('toastContainer');
    if (!c) { console.log('[' + type + ']', msg); return; }
    // Enforce max
    while (toastQueue.length >= MAX_TOAST) {
      const old = toastQueue.shift();
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = msg;
    c.appendChild(el);
    toastQueue.push(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      const idx = toastQueue.indexOf(el);
      if (idx >= 0) toastQueue.splice(idx, 1);
    }, 3200);
  }

  const safeFetch = async (url, opts = {}, timeoutMs = 15000) => {
    if (window.IRGXY && typeof window.IRGXY.safeFetch === 'function') {
      return window.IRGXY.safeFetch(url, opts, timeoutMs);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
  };

  const addActivity = (type, title) => {
    if (window.IRGXY?.Activity?.add) window.IRGXY.Activity.add(type, title);
    else if (typeof window.addActivity === 'function') window.addActivity(type, title);
  };

  /* ================================================================
     CONSTANTS & STORAGE KEYS
     ================================================================ */
  const HISTORY_KEY  = 'irgxy_slb_history';
  const HISTORY_MAX  = 15;
  const THEME_KEY    = 'slb_theme';
  const ACCENT_KEY   = 'slb_accent';
  const PROXY_KEY    = 'slb_proxy_mode';
  const SETTINGS_KEY = 'slb_settings';
  const ERROR_KEY    = 'slb_errors';
  const ERROR_MAX    = 20;
  const CACHE_TTL    = 5 * 60 * 1000;   // 5 menit
  const RATE_LIMIT   = 10;
  const RATE_WINDOW  = 60 * 1000;       // 1 menit
  const RATE_KEY     = 'slb_rate';

  const BLACKLIST = [
    'google.com','facebook.com','twitter.com','x.com','instagram.com','youtube.com',
    'cloudflare.com','gstatic.com','googleapis.com','jquery.com','fontawesome.com',
    'jsdelivr.net','unpkg.com','cdnjs.cloudflare.com','bootstrapcdn.com','cloudfront.net',
    'doubleclick.net','googlesyndication.com','googletagmanager.com','google-analytics.com',
    'w3.org','schema.org','mozilla.org','microsoft.com','apple.com','wikipedia.org',
    'stackoverflow.com','github.com','githubusercontent.com','gstatic.cn'
  ];

  const REDIRECT_PARAMS = [
    'dest','destination','url','target','u','r','redirect','to',
    'goto','go','out','outgoing','link','continue','next'
  ];

  /* ================================================================
     SERVICE DATABASE (V2 + V3 merge, deduplikasi, tambah domain baru)
     ================================================================ */
  const SERVICES = [
    /* KATEGORI A — Global Shortlink Networks */
    { name:'AdFly',           cat:'A', layer:'direct', match:['adf.ly','adfly.com','adfly.fr','adfly.it','adfly.es','adfly.mobi'] },
    { name:'Linkvertise',     cat:'A', layer:'api',    match:['linkvertise.com','linkvertise.net','link-to.net','up-to-down.net','direct-link.net','link-hub.net','link-target.net'] },
    { name:'MediaFire',       cat:'A', layer:'proxy',  match:['mediafire.com'] },
    { name:'Safelinku',       cat:'A', layer:'proxy',  match:['safelinku.com','safelink.me','safelinkconverter.com'] },
    { name:'Shorte.st',       cat:'A', layer:'direct', match:['sh.st','u2ks.com','jnw0.com','shorte.st','ceesty.com','festyy.com'] },
    { name:'Ouo.io',          cat:'A', layer:'api',    match:['ouo.io','ouo.press','uii.io'] },
    { name:'ShrinkMe',        cat:'A', layer:'proxy',  match:['shrinkme.io','shrinkme.click'] },
    { name:'ShrinkEarn',      cat:'A', layer:'info',   match:['shrinkearn.com','shrinkearn.in'] },
    { name:'Exe.io',          cat:'A', layer:'proxy',  match:['exe.io','exey.io','exee.io'] },
    { name:'GPLinks',         cat:'A', layer:'proxy',  match:['gplinks.co','gplinks.in','gplink.in'] },
    { name:'Droplink',        cat:'A', layer:'proxy',  match:['droplink.co'] },
    { name:'LKSFY',           cat:'A', layer:'proxy',  match:['lksfy.com','lksfy.in'] },
    { name:'RockLinks',       cat:'A', layer:'proxy',  match:['rocklinks.in','rocklinks.net'] },
    { name:'VPLink',          cat:'A', layer:'proxy',  match:['vplink.in'] },
    { name:'JRLinks',         cat:'A', layer:'proxy',  match:['jrlinks.in'] },
    { name:'4hi.in',          cat:'A', layer:'proxy',  match:['4hi.in'] },
    { name:'TNSHORT',         cat:'A', layer:'proxy',  match:['tnshort.net','go.tnshort.net'] },
    { name:'Dekhe.click',     cat:'A', layer:'proxy',  match:['dekhe.click'] },
    { name:'CLK Network',     cat:'A', layer:'proxy',  match:['clk.wiki','clk.kim','clk.sh','clk.ink','clk.press'] },
    { name:'SoftURL',         cat:'A', layer:'proxy',  match:['softurl.in'] },
    { name:'LinkShortify',    cat:'A', layer:'proxy',  match:['linkshortify.in'] },
    { name:'ShrinkForEarn',   cat:'A', layer:'proxy',  match:['shrinkforearn.in'] },
    { name:'IndianShortner',  cat:'A', layer:'proxy',  match:['indianshortner.com'] },
    { name:'ModijiURL',       cat:'A', layer:'proxy',  match:['modijiurl.com'] },
    { name:'InstantEarn',     cat:'A', layer:'proxy',  match:['instantearn.in'] },
    { name:'Get2Short',       cat:'A', layer:'proxy',  match:['get2short.com'] },
    { name:'KingURL',         cat:'A', layer:'proxy',  match:['kingurl.in'] },
    { name:'PublicEarn',      cat:'A', layer:'proxy',  match:['publicearn.site'] },
    { name:'TechAtg',         cat:'A', layer:'proxy',  match:['technicalatg.in','f.technicalatg.in'] },
    { name:'TPI/OII Family',  cat:'A', layer:'proxy',  match:['tpi.li','oii.la','tei.ai','tii.ai','iir.ai','oko.sh'] },

    /* KATEGORI B — Sub2Unlock */
    { name:'Sub2Unlock',      cat:'B', layer:'info',   match:['sub2unlock.net','sub2unlock.com','sub2unlock.me','sub2unlock.io'] },
    { name:'Sub2Get',         cat:'B', layer:'info',   match:['sub2get.com'] },
    { name:'Sub4Unlock',      cat:'B', layer:'info',   match:['sub4unlock.com'] },
    { name:'YTSubMe',         cat:'B', layer:'info',   match:['ytsubme.com'] },
    { name:'LetsBoost',       cat:'B', layer:'info',   match:['letsboost.net'] },
    { name:'Boost.ink',       cat:'B', layer:'info',   match:['boost.ink','bst.gg','bst.wtf'] },
    { name:'MBoost',          cat:'B', layer:'info',   match:['mboost.me'] },
    { name:'BoostFused',      cat:'B', layer:'info',   match:['boostfused.com'] },
    { name:'Social-Unlock',   cat:'B', layer:'info',   match:['social-unlock.com'] },

    /* KATEGORI C — LootLabs & Work.ink */
    { name:'LootLabs',        cat:'C', layer:'info',   match:['loot-link.com','loot-links.com','lootlabs.gg','loot-link.net'] },
    { name:'Work.ink',        cat:'C', layer:'info',   match:['work.ink','workink.net'] },

    /* KATEGORI D — File Hosters */
    { name:'Mega4Upload',     cat:'D', layer:'proxy',  match:['mega4upload.net','mega4upload.com'] },
    { name:'Uploady',         cat:'D', layer:'proxy',  match:['uploady.io'] },
    { name:'UpFiles',         cat:'D', layer:'proxy',  match:['upfilesgo.com','upfiles.app','upfiles.com'] },
    { name:'ModsFire',        cat:'D', layer:'proxy',  match:['modsfire.com'] },
    { name:'DailyUploads',    cat:'D', layer:'proxy',  match:['dailyuploads.net'] },
    { name:'JioUpload',       cat:'D', layer:'proxy',  match:['jioupload.com','jioupload.in','jioupload.net'] },
    { name:'CloudFam',        cat:'D', layer:'proxy',  match:['cloudfam.io'] },
    { name:'FRDL',            cat:'D', layer:'proxy',  match:['frdl.io','frdl.link','freedl.ink'] },
    { name:'Rapidgator',      cat:'D', layer:'info',   match:['rapidgator.net'] },

    /* KATEGORI E — Standard Shorteners */
    { name:'Bit.ly',          cat:'E', layer:'direct', match:['bit.ly','bitly.com'] },
    { name:'TinyURL',         cat:'E', layer:'direct', match:['tinyurl.com'] },
    { name:'Google URL',      cat:'E', layer:'direct', match:['goo.gl'] },
    { name:'t.co',            cat:'E', layer:'direct', match:['t.co'] },
    { name:'Shrto',           cat:'E', layer:'direct', match:['shrto.ml'] },
    { name:'Cutt.ly',         cat:'E', layer:'direct', match:['cutt.ly','cuttly.com'] },
    { name:'is.gd',           cat:'E', layer:'direct', match:['is.gd'] },
    { name:'v.gd',            cat:'E', layer:'direct', match:['v.gd'] },
    { name:'s.id',            cat:'E', layer:'direct', match:['s.id'] },
    { name:'SFL.gl',          cat:'E', layer:'info',   match:['sfl.gl'] },

    /* KATEGORI F — Lainnya */
    { name:'AdMaven',         cat:'F', layer:'proxy',  match:['admaven.com'] },
    { name:'Paster.so',       cat:'F', layer:'direct', match:['paster.so'] },
    { name:'Rekonise',        cat:'F', layer:'proxy',  match:['rekonise.com'] },
    { name:'BoostMe',         cat:'F', layer:'info',   match:['boostme.link'] },
    { name:'Shortconnect',    cat:'F', layer:'proxy',  match:['shortconnect.com'] },
    { name:'Short.am',        cat:'F', layer:'proxy',  match:['short.am'] },
    { name:'BC.VC',           cat:'F', layer:'proxy',  match:['bc.vc'] },
    { name:'AdFoc.us',        cat:'F', layer:'proxy',  match:['adfoc.us'] },
    { name:'LinkShrink',      cat:'F', layer:'proxy',  match:['linkshrink.net'] },
    { name:'LinkBucks',       cat:'F', layer:'info',   match:['linkbucks.com'] },
    { name:'AdLinkFly',       cat:'F', layer:'proxy',  match:['adlinkfly.com'] },
    { name:'StFly',           cat:'F', layer:'proxy',  match:['stfly.me','stfly.io','stfly.biz'] },
    { name:'Indobo',          cat:'F', layer:'proxy',  match:['indobo.com'] },
    { name:'Aylink',          cat:'F', layer:'proxy',  match:['aylink.co','ay.gy','ay.lc'] },
    { name:'CPMLink',         cat:'F', layer:'proxy',  match:['cpmlink.pro','cpmlink.net'] },
    { name:'ICutLink',        cat:'F', layer:'proxy',  match:['icutlink.com'] },
    { name:'ShrtFly',         cat:'F', layer:'proxy',  match:['shrtfly.com'] },
    { name:'Shortox',         cat:'F', layer:'proxy',  match:['shortox.com'] },
    { name:'ShortSlug',       cat:'F', layer:'proxy',  match:['shortslug.biz'] },
    { name:'Shortner.in',     cat:'F', layer:'proxy',  match:['shortner.in'] },
    { name:'LinkPays',        cat:'F', layer:'proxy',  match:['linkpays.in'] },
    { name:'TNLink',          cat:'F', layer:'proxy',  match:['tnlink.in','tnvalue.in'] },
    { name:'Try2Link',        cat:'F', layer:'proxy',  match:['try2link.com'] },
    { name:'URLSOpen',        cat:'F', layer:'proxy',  match:['urlsopen.com'] },
    { name:'OMG10',           cat:'F', layer:'proxy',  match:['omg10.com'] },
    { name:'EZ4Short',        cat:'F', layer:'proxy',  match:['ez4short.com'] },
    { name:'Earn4Link',       cat:'F', layer:'proxy',  match:['earn4link.in'] },
    { name:'ToLink',          cat:'F', layer:'proxy',  match:['tolink.in'] },
    { name:'ThotPacks',       cat:'F', layer:'proxy',  match:['thotpacks.xyz'] },
    { name:'MDiskShortner',   cat:'F', layer:'proxy',  match:['mdiskshortner.link'] },
    { name:'FileCrypt',       cat:'F', layer:'info',   match:['filecrypt.cc','filecrypt.co'] },
    { name:'Lnk2',            cat:'F', layer:'proxy',  match:['lnk2.cc'] },
    { name:'VearnBux',        cat:'F', layer:'proxy',  match:['vearnbux.in'] },
    { name:'Hyperlink',       cat:'F', layer:'proxy',  match:['hyperlink.pw'] }
  ];

  /* ================================================================
     SETTINGS MANAGER
     ================================================================ */
  const DEFAULT_SETTINGS = {
    autoCopy: false, autoOpen: false, saveHistory: true,
    notifications: true, sound: false, autoClipboard: false, lang: 'id'
  };

  function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  }
  function getSetting(k, dflt) {
    const s = loadSettings();
    return s[k] !== undefined ? s[k] : (dflt !== undefined ? dflt : DEFAULT_SETTINGS[k]);
  }

  /* ================================================================
     VALIDASI & DETEKSI
     ================================================================ */
  function isValidUrl(input) {
    if (!input || typeof input !== 'string') return false;
    try {
      const u = new URL(input.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
  }

  function detectService(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const u = new URL(url.trim());
      const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
      for (const s of SERVICES) {
        for (const m of s.match) {
          if (host === m || host.endsWith('.' + m)) return s;
        }
      }
    } catch {}
    return null;
  }

  function detectLayer(service) {
    if (!service) return null;
    if (typeof service === 'string') {
      const s = SERVICES.find(x => x.name === service);
      return s ? s.layer : null;
    }
    return service.layer || null;
  }

  function isValidShortlink(url) { return !!detectService(url); }

  /* ================================================================
     UTIL
     ================================================================ */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function tryDecode(v) {
    if (!v || typeof v !== 'string') return null;
    const s = v.trim();
    if (/^https?:\/\//i.test(s)) return s;
    try {
      if (/^[A-Za-z0-9+/=_-]+$/.test(s) && s.length >= 8) {
        const norm = s.replace(/-/g, '+').replace(/_/g, '/');
        const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - norm.length % 4);
        const dec = atob(norm + pad);
        if (/^https?:\/\//i.test(dec)) return dec;
        try { const d2 = decodeURIComponent(dec); if (/^https?:\/\//i.test(d2)) return d2; } catch {}
      }
    } catch {}
    try {
      const d = decodeURIComponent(s);
      if (/^https?:\/\//i.test(d) && d !== s) return d;
    } catch {}
    return null;
  }

  function timeAgo(ts) {
    if (!ts || isNaN(ts)) return '—';
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'Baru saja';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + ' menit lalu';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' jam lalu';
    return Math.floor(hr / 24) + ' hari lalu';
  }

  function isBlacklisted(host) {
    host = host.toLowerCase().replace(/^www\./, '');
    return BLACKLIST.some(b => host === b || host.endsWith('.' + b));
  }

  /* ================================================================
     ERROR LOG (V4)
     ================================================================ */
  function logError(service, message, stack) {
    try {
      const list = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
      list.unshift({ ts: Date.now(), service: service || '—', message: String(message || ''), stack: stack ? String(stack).slice(0, 300) : '' });
      localStorage.setItem(ERROR_KEY, JSON.stringify(list.slice(0, ERROR_MAX)));
    } catch {}
  }
  function loadErrors() {
    try { return JSON.parse(localStorage.getItem(ERROR_KEY) || '[]'); } catch { return []; }
  }

  /* ================================================================
     PERFORMANCE METRIC (V4)
     ================================================================ */
  const PERF_KEY = 'slb_perf';
  function logPerf(service, durationMs) {
    try {
      const list = JSON.parse(localStorage.getItem(PERF_KEY) || '[]');
      list.unshift({ service, ms: durationMs, ts: Date.now() });
      localStorage.setItem(PERF_KEY, JSON.stringify(list.slice(0, 50)));
    } catch {}
  }
  function loadPerf() {
    try { return JSON.parse(localStorage.getItem(PERF_KEY) || '[]'); } catch { return []; }
  }

  /* ================================================================
     RATE LIMITER (V4)
     ================================================================ */
  function checkRateLimit() {
    try {
      const now = Date.now();
      let arr = JSON.parse(sessionStorage.getItem(RATE_KEY) || '[]');
      arr = arr.filter(t => now - t < RATE_WINDOW);
      if (arr.length >= RATE_LIMIT) {
        const wait = Math.ceil((RATE_WINDOW - (now - arr[0])) / 1000);
        return { ok: false, wait };
      }
      arr.push(now);
      sessionStorage.setItem(RATE_KEY, JSON.stringify(arr));
      return { ok: true };
    } catch { return { ok: true }; }
  }

  /* ================================================================
     RESULT CACHE (V4)
     ================================================================ */
  const CACHE = new Map();
  function getCached(url) {
    const hit = CACHE.get(url);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL) { CACHE.delete(url); return null; }
    return hit;
  }
  function setCache(url, data) {
    CACHE.set(url, { ...data, ts: Date.now() });
    updateCacheCount();
  }
  function clearCache() {
    CACHE.clear();
    updateCacheCount();
  }
  function updateCacheCount() {
    const el = document.getElementById('slbCacheCount');
    if (el) el.textContent = CACHE.size + ' cache';
  }

  /* ================================================================
     CORS PROXY CHAIN
     ================================================================ */
  const PROXIES = {
    corsproxy:  u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    allorigins: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    codetabs:   u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    thingproxy: u => 'https://thingproxy.freeboard.io/fetch/' + u
  };

  function getProxyList() {
    const mode = localStorage.getItem(PROXY_KEY) || 'auto';
    if (mode === 'auto') return [PROXIES.corsproxy, PROXIES.allorigins, PROXIES.codetabs, PROXIES.thingproxy];
    return PROXIES[mode] ? [PROXIES[mode]] : [PROXIES.allorigins];
  }

  async function fetchWithCorsProxy(url) {
    const list = getProxyList();
    let lastErr = null;
    for (const build of list) {
      try {
        const res = await safeFetch(build(url), {}, 12000);
        if (res && res.ok) {
          const text = await res.text();
          if (text && text.length > 20) return text;
        }
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Semua proxy gagal');
  }

  /* ================================================================
     LAYER 1 — DIRECT
     ================================================================ */
  async function followRedirects(url, maxHops = 5) {
    let current = url;
    for (let i = 0; i < maxHops; i++) {
      try {
        let res = null;
        try { res = await safeFetch(current, { method: 'HEAD', redirect: 'manual' }, 5000); }
        catch { res = null; }
        if (!res || !res.ok) {
          try { res = await safeFetch(current, { redirect: 'manual' }, 6000); } catch { return null; }
        }
        const loc = res.headers.get('location');
        if (!loc) return null;
        const next = new URL(loc, current).href;
        if (next === current) return null;
        if (!detectService(next)) return next;
        current = next;
      } catch { return null; }
    }
    return null;
  }

  async function bypassDirect(url) {
    const u = new URL(url);
    for (const p of REDIRECT_PARAMS) {
      const v = u.searchParams.get(p);
      if (v) { const d = tryDecode(v); if (d && isValidUrl(d)) return d; }
    }
    if (u.hash && u.hash.length > 1) {
      const hp = new URLSearchParams(u.hash.replace(/^#\/?/, ''));
      for (const p of REDIRECT_PARAMS) {
        const v = hp.get(p);
        if (v) { const d = tryDecode(v); if (d && isValidUrl(d)) return d; }
      }
    }
    const parts = u.pathname.split('/').filter(Boolean);
    for (const part of parts) {
      const d = tryDecode(part);
      if (d && isValidUrl(d) && d !== url) return d;
    }
    // followRedirects fallback
    const chain = await followRedirects(url);
    if (chain) return chain;
    try {
      const res = await safeFetch(url, { redirect: 'follow' }, 8000);
      if (res && res.url && res.url !== url && !detectService(res.url) && isValidUrl(res.url)) return res.url;
    } catch {}
    return null;
  }

  /* ================================================================
     LAYER 2 — HTML PROXY
     ================================================================ */
  function parseHtmlForTarget(html, sourceHost) {
    if (!html || typeof html !== 'string') return null;
    const candidates = [];
    let m;

    const metaRx = /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*?url=([^"'\s>]+)/gi;
    while ((m = metaRx.exec(html)) !== null) candidates.push(m[1]);

    const locRx = /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/gi;
    while ((m = locRx.exec(html)) !== null) candidates.push(m[1]);

    const locRepRx = /(?:window\.)?location\.replace\(\s*["']([^"']+)["']/gi;
    while ((m = locRepRx.exec(html)) !== null) candidates.push(m[1]);

    const idRx = /<a[^>]+id=["'](btn-main|btn-open|getlink|btn-continue|btn-download|link-button|btn-go|btnNext|btn[^"'\s>]*|download[^"'\s>]*)["'][^>]+href=["']([^"']+)["']/gi;
    while ((m = idRx.exec(html)) !== null) candidates.push(m[2]);

    const dataRx = /data-(?:url|target|href|link|destination|dest)=["']([^"']+)["']/gi;
    while ((m = dataRx.exec(html)) !== null) candidates.push(m[1]);

    const jsonRx = /["'](?:nextUrl|target|destination|dest|url|redirectUrl|redirectTo)["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi;
    while ((m = jsonRx.exec(html)) !== null) candidates.push(m[1]);

    const hrefRx = /href=["'](https?:\/\/[^"'\s]+)["']/gi;
    while ((m = hrefRx.exec(html)) !== null) candidates.push(m[1]);

    for (let c of candidates) {
      if (!c) continue;
      c = String(c).trim().replace(/&amp;/g, '&').replace(/\\\//g, '/');
      const decoded = tryDecode(c) || c;
      if (!/^https?:\/\//i.test(decoded)) continue;
      try {
        const cu = new URL(decoded);
        const ch = cu.hostname.toLowerCase().replace(/^www\./, '');
        if (sourceHost && (ch === sourceHost || ch.endsWith('.' + sourceHost))) continue;
        if (isBlacklisted(ch)) continue;
        if (/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp|mp4|mp3)(\?|$)/i.test(cu.pathname)) continue;
        if (detectService(decoded)) continue;
        return decoded;
      } catch {}
    }
    return null;
  }

  async function bypassHtmlProxy(url, service) {
    const html = await fetchWithCorsProxy(url);
    try { window.__slbLastHtml = html; } catch {}
    return parseHtmlForTarget(html, service ? service.match[0] : null);
  }

  /* ================================================================
     LAYER 3 — API
     ================================================================ */
  async function bypassLinkvertise(url) {
    try {
      const m = url.match(/linkvertise\.com\/(?:download\/)?(\d+)/i)
             || url.match(/link-to\.net\/\w+\/(\d+)/i)
             || url.match(/up-to-down\.net\/\w+\/(\d+)/i)
             || url.match(/direct-link\.net\/\w+\/(\d+)/i)
             || url.match(/link-hub\.net\/\w+\/(\d+)/i)
             || url.match(/link-target\.net\/\w+\/(\d+)/i);
      if (!m) return null;
      const id = m[1];
      const api = 'https://publisher.linkvertise.com/api/v1/redirect/link/static/' + id;
      const txt = await fetchWithCorsProxy(api);
      if (!txt) return null;
      try {
        const json = JSON.parse(txt);
        const target = json?.data?.link?.target || json?.data?.target || json?.target || json?.url;
        if (target && isValidUrl(target)) return target;
      } catch {}
      const t = txt.match(/"target"\s*:\s*"([^"]+)"/);
      if (t && isValidUrl(t[1])) return t[1];
    } catch (e) { console.warn('[SLB] Linkvertise API error:', e.message); }
    return null;
  }

  async function bypassOuo(url) {
    try {
      const txt = await fetchWithCorsProxy(url);
      if (!txt) return null;
      const m = txt.match(/["'](?:nextUrl|url|dest(?:ination)?|target)["']\s*:\s*["'](https?:\/\/[^"']+)["']/i);
      if (m) return m[1];
      return parseHtmlForTarget(txt, 'ouo.io');
    } catch { return null; }
  }

  async function bypassApi(url, service) {
    if (!service) return null;
    if (service.name === 'Linkvertise') {
      const t = await bypassLinkvertise(url);
      if (t) return t;
    }
    if (service.name === 'Ouo.io') {
      const t = await bypassOuo(url);
      if (t) return t;
    }
    return await bypassHtmlProxy(url, service);
  }

  /* ================================================================
     LAYER 4 — INFORMATIVE
     ================================================================ */
  function bypassInformative(service) {
    const name = service?.name || 'Layanan ini';
    return (
      `${name} menggunakan proteksi Cloudflare + timer dinamis + verifikasi server-side.\n` +
      `Bypass client-side tidak dapat menembusnya.\n\n` +
      `Solusi yang berfungsi 100%:\n` +
      `• Userscript "Bypass SFL" di Greasy Fork\n` +
      `• Ekstensi browser FastForward / Bypass Tools\n` +
      `• Untuk Sub2Unlock: subscribe channel YouTube ybs\n\n` +
      `Copy link asli untuk dibuka manual di browser.`
    );
  }

  /* ================================================================
     DOM CACHE
     ================================================================ */
  const els = {};
  function cacheEls() {
    els.main         = $('#slbMain');
    els.input        = $('#slbInput');
    els.textarea     = $('#slbTextarea');
    els.badgeRow     = $('#slbBadgeRow');
    els.badge        = $('#slbServiceBadge');
    els.cacheBadge   = $('#slbCacheBadge');
    els.bypassBtn    = $('#slbBypassBtn');
    els.bypassBtnTxt = $('#slbBypassBtnText');
    els.status       = $('#slbStatus');
    els.statusIcon   = $('#slbStatusIcon');
    els.statusText   = $('#slbStatusText');
    els.resultCard   = $('#slbResultCard');
    els.resultSvc    = $('#slbResultService');
    els.resultSrc    = $('#slbResultSource');
    els.resultTgt    = $('#slbResultTarget');
    els.sourceAlias  = $('#slbSourceUrl');
    els.targetAlias  = $('#slbTargetUrl');
    els.resultMeta   = $('#slbResultMeta');
    els.history      = $('#slbHistorySection');
    els.historyList  = $('#slbHistoryList');
    els.stats        = $('#slbStats');
    els.statsGrid    = $('#slbStatsGrid');
    els.statsBars    = $('#slbStatsBars');
    els.debugPre     = $('#slbDebugPre');
    els.qrContainer  = $('#slbQrContainer');
    els.qrUrl        = $('#slbQrUrl');
    els.overlay      = $('#slbLoadingOverlay');
    els.overlayProg  = $('#slbOverlayProgress');
    els.overlayStat  = $('#slbOverlayStatus');
    els.progressBar  = $('#slbProgressBar');
    els.progressFill = $('#slbProgressFill');
  }

  /* ================================================================
     UI UPDATE
     ================================================================ */
  function showStatus(type, message) {
    if (!els.status) return;
    els.status.className = 'slb-status ' + type;
    if (els.statusText) els.statusText.textContent = message || '';
    if (els.statusIcon) {
      if (type === 'loading') els.statusIcon.innerHTML = '<span class="slb-spinner"></span>';
      else if (type === 'success') els.statusIcon.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i>';
      else if (type === 'error') els.statusIcon.innerHTML = '<i class="fas fa-times-circle" aria-hidden="true"></i>';
      else if (type === 'info') els.statusIcon.innerHTML = '<i class="fas fa-info-circle" aria-hidden="true"></i>';
    }
  }
  function hideStatus() { if (els.status) els.status.className = 'slb-status'; }

  function renderResult(source, target, service, meta) {
    if (!els.resultCard) return;
    if (els.resultSvc) {
      els.resultSvc.textContent = service ? `${service.name} · ${service.cat} · ${service.layer.toUpperCase()}` : '—';
    }
    if (els.resultSrc) els.resultSrc.textContent = source;
    if (els.resultTgt) els.resultTgt.textContent = target;
    if (els.sourceAlias) els.sourceAlias.textContent = source;
    if (els.targetAlias) els.targetAlias.textContent = target;
    if (els.resultMeta) {
      els.resultMeta.innerHTML = meta ? [
        meta.duration ? `<span>⏱ ${(meta.duration / 1000).toFixed(2)}s</span>` : '',
        meta.cached ? '<span>⚡ dari cache</span>' : '',
        meta.service ? `<span>📦 ${escapeHtml(meta.service)}</span>` : ''
      ].filter(Boolean).join('') : '';
    }
    els.resultCard.classList.add('visible');
    els.resultCard.setAttribute('data-target', target);
    try { els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
  }

  function resetUI() {
    if (els.input) { els.input.value = ''; els.input.classList.remove('valid','invalid'); }
    if (els.textarea) els.textarea.value = '';
    hideStatus();
    if (els.resultCard) { els.resultCard.classList.remove('visible'); els.resultCard.removeAttribute('data-target'); }
    if (els.badgeRow) els.badgeRow.classList.remove('visible');
    if (els.cacheBadge) els.cacheBadge.style.display = 'none';
    if (els.input) els.input.focus();
  }

  function updateBadge() {
    if (!els.input || !els.badgeRow || !els.badge) return;
    const v = els.input.value.trim();
    if (!v || !isValidUrl(v)) {
      els.input.classList.remove('valid','invalid');
      els.badgeRow.classList.remove('visible');
      return;
    }
    const svc = detectService(v);
    els.input.classList.add('valid');
    els.input.classList.remove('invalid');
    els.badgeRow.classList.add('visible');
    if (svc) {
      els.badge.textContent = '✓ ' + svc.name + ' · Kategori ' + svc.cat + ' · Layer ' + svc.layer.toUpperCase();
      els.badge.classList.remove('unknown');
    } else {
      els.badge.textContent = '⚠ Layanan tidak dikenal';
      els.badge.classList.add('unknown');
    }
  }

  /* ================================================================
     LOADING OVERLAY + PROGRESS (V4)
     ================================================================ */
  const LOADING_MESSAGES = [
    'Mendeteksi layanan...',
    'Menyiapkan proxy...',
    'Mengambil data...',
    'Mengekstrak link...',
    'Verifikasi...',
    'Menyelesaikan...'
  ];
  let loadingTimer = null;
  let progressTimer = null;
  let currentProgress = 0;

  function showLoadingOverlay() {
    if (!els.overlay) return;
    currentProgress = 0;
    updateOverlayProgress(0);
    els.overlay.classList.add('visible');
    els.overlay.setAttribute('aria-hidden', 'false');
    if (els.main) els.main.setAttribute('aria-busy', 'true');
    if (els.progressBar) { els.progressBar.classList.add('active'); els.progressBar.setAttribute('aria-valuenow', '0'); }
    if (els.progressFill) els.progressFill.style.width = '0%';

    let msgIdx = 0;
    if (els.overlayStat) els.overlayStat.textContent = LOADING_MESSAGES[0];
    loadingTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      if (els.overlayStat) els.overlayStat.textContent = LOADING_MESSAGES[msgIdx];
    }, 800);

    progressTimer = setInterval(() => {
      // Simulasi progress: maksimal 92% sampai selesai
      const step = currentProgress < 30 ? 6 : currentProgress < 60 ? 3 : currentProgress < 85 ? 1.5 : 0.5;
      currentProgress = Math.min(92, currentProgress + step);
      updateOverlayProgress(currentProgress);
    }, 180);
  }

  function updateOverlayProgress(pct) {
    const p = Math.floor(pct);
    if (els.overlayProg) els.overlayProg.textContent = p;
    if (els.progressFill) els.progressFill.style.width = p + '%';
    if (els.progressBar) els.progressBar.setAttribute('aria-valuenow', String(p));
  }

  function hideLoadingOverlay(success) {
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    updateOverlayProgress(success ? 100 : 0);
    setTimeout(() => {
      if (els.overlay) {
        els.overlay.classList.remove('visible');
        els.overlay.setAttribute('aria-hidden', 'true');
      }
      if (els.main) els.main.setAttribute('aria-busy', 'false');
      if (els.progressBar) els.progressBar.classList.remove('active');
      setTimeout(() => { if (els.progressFill) els.progressFill.style.width = '0%'; }, 400);
    }, success ? 350 : 0);
  }

  /* ================================================================
     HISTORY (schema migration + delete single + sort + search)
     ================================================================ */
  let historySearchQuery = '';
  let historySortMode = 'newest';

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map(item => ({
        source:  String(item.source || ''),
        target:  String(item.target || ''),
        service: String(item.service || 'Unknown'),
        ts:      Number(item.ts || item.timestamp || Date.now()),
        duration: Number(item.duration || 0)
      })).filter(x => x.source);
    } catch { return []; }
  }

  function saveHistory(item) {
    if (!getSetting('saveHistory', true)) return;
    try {
      const list = loadHistory();
      const dedup = list.filter(x => x.source !== item.source);
      dedup.unshift(item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(dedup.slice(0, HISTORY_MAX)));
    } catch (e) { logError('history', e.message, e.stack); }
  }

  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    renderHistory();
    renderStats();
  }

  function deleteHistoryItem(idx) {
    try {
      const list = loadHistory();
      list.splice(idx, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      renderHistory();
      renderStats();
      showToast('Item dihapus dari riwayat', 'info');
    } catch {}
  }

  function getFilteredHistory() {
    let list = loadHistory();
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      list = list.filter(x =>
        x.source.toLowerCase().includes(q) ||
        x.target.toLowerCase().includes(q) ||
        x.service.toLowerCase().includes(q)
      );
    }
    if (historySortMode === 'oldest') list = [...list].reverse();
    else if (historySortMode === 'service') list = [...list].sort((a, b) => a.service.localeCompare(b.service));
    return list;
  }

  function renderHistory() {
    if (!els.history || !els.historyList) return;
    const list = getFilteredHistory();
    if (!list.length) { els.history.classList.remove('visible'); return; }
    els.history.classList.add('visible');
    els.historyList.innerHTML = list.map((item) => {
      const idx = loadHistory().findIndex(x => x.source === item.source && x.ts === item.ts);
      const src = escapeHtml(item.source.length > 60 ? item.source.slice(0, 60) + '…' : item.source);
      const tgt = escapeHtml(item.target.length > 70 ? item.target.slice(0, 70) + '…' : item.target);
      const svc = escapeHtml(item.service);
      return '<div class="slb-history-item" data-idx="' + idx + '" role="button" tabindex="0">' +
        '<div class="slb-history-icon"><i class="fas fa-unlink" aria-hidden="true"></i></div>' +
        '<div class="slb-history-info">' +
          '<div class="slb-history-source">' + src + '</div>' +
          '<div class="slb-history-target">→ ' + tgt + '</div>' +
          '<div class="slb-history-time">' + svc + ' • ' + timeAgo(item.ts) +
            (item.duration ? ' • ' + (item.duration / 1000).toFixed(1) + 's' : '') + '</div>' +
        '</div>' +
        '<div class="slb-history-actions-inline">' +
          '<button type="button" class="slb-history-btn" data-action="copy" title="Copy" aria-label="Copy"><i class="fas fa-copy" aria-hidden="true"></i></button>' +
          '<button type="button" class="slb-history-btn danger" data-action="delete" title="Hapus" aria-label="Hapus"><i class="fas fa-trash" aria-hidden="true"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function handleHistoryClick(e) {
    const item = e.target.closest('.slb-history-item');
    if (!item) return;
    const idx = parseInt(item.getAttribute('data-idx'), 10);
    const list = loadHistory();
    const data = list[idx];
    if (!data) return;

    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      if (action === 'copy') {
        navigator.clipboard.writeText(data.source).then(
          () => showToast('URL sumber disalin', 'success'),
          () => showToast('Gagal menyalin', 'error')
        );
      } else if (action === 'delete') {
        deleteHistoryItem(idx);
      }
      return;
    }

    if (els.input) {
      els.input.value = data.source;
      if (els.textarea) els.textarea.value = data.source;
      els.input.dispatchEvent(new Event('input', { bubbles: true }));
      els.input.focus();
      showToast('URL dimuat. Klik Bypass untuk memproses.', 'info');
    }
  }

  /* ================================================================
     STATS
     ================================================================ */
  function renderStats() {
    if (!els.stats || !els.statsGrid) return;
    const list = loadHistory();
    if (list.length < 2) { els.stats.classList.remove('visible'); return; }
    els.stats.classList.add('visible');

    const total = list.length;
    const success = list.filter(x => x.target && !x.target.startsWith('❌')).length;
    const rate = total ? Math.round((success / total) * 100) : 0;

    const counts = {};
    list.forEach(x => { counts[x.service] = (counts[x.service] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    els.statsGrid.innerHTML = [
      ['Total Bypass', total],
      ['Berhasil', success],
      ['Success Rate', rate + '%'],
      ['Layanan Unik', Object.keys(counts).length]
    ].map(([label, value]) =>
      '<div class="slb-stat-box"><div class="slb-stat-value">' + value + '</div>' +
      '<div class="slb-stat-label">' + label + '</div></div>'
    ).join('');

    els.statsBars.innerHTML = top.map(([name, count]) => {
      const pct = Math.round((count / total) * 100);
      return '<div style="margin-top:10px">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--slb-muted);margin-bottom:4px">' +
          '<span>' + escapeHtml(name) + '</span><span>' + count + '× (' + pct + '%)</span>' +
        '</div>' +
        '<div class="slb-stat-bar"><div class="slb-stat-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');
  }

  /* ================================================================
     SERVICE LIST MODAL
     ================================================================ */
  function renderServiceList() {
    const body = document.getElementById('slbServiceListBody');
    const countEl = document.getElementById('slbServiceCount');
    if (!body) return;
    const q = (document.getElementById('slbServiceSearch')?.value || '').toLowerCase();
    const cat = document.getElementById('slbServiceCat')?.value || '';
    const layer = document.getElementById('slbServiceLayer')?.value || '';

    let filtered = SERVICES.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.match.some(m => m.includes(q))) return false;
      if (cat && s.cat !== cat) return false;
      if (layer && s.layer !== layer) return false;
      return true;
    });

    body.innerHTML = filtered.map((s, i) =>
      '<div class="slb-service-item" data-service-idx="' + SERVICES.indexOf(s) + '" tabindex="0" role="button">' +
        '<span class="slb-service-name" title="' + escapeHtml(s.match.join(', ')) + '">' + escapeHtml(s.name) + '</span>' +
        '<span class="slb-service-layer ' + s.layer + '">' + s.layer + '</span>' +
      '</div>'
    ).join('');

    if (countEl) countEl.textContent = `Menampilkan ${filtered.length} dari ${SERVICES.length} layanan`;

    body.querySelectorAll('.slb-service-item').forEach(item => {
      const handler = () => {
        const idx = parseInt(item.getAttribute('data-service-idx'), 10);
        const svc = SERVICES[idx];
        if (!svc) return;
        const example = 'https://' + svc.match[0] + '/contoh';
        if (els.input) {
          els.input.value = example;
          updateBadge();
          els.input.focus();
        }
        closeAllModals();
        showToast('Contoh URL untuk ' + svc.name + ' dimuat', 'info');
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    });
  }

  /* ================================================================
     FOCUS TRAP (V4)
     ================================================================ */
  let lastFocusedEl = null;
  function trapFocus(modalEl) {
    const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    modalEl.addEventListener('keydown', handler);
    modalEl.__focusTrap = handler;
  }
  function releaseFocusTrap(modalEl) {
    if (modalEl.__focusTrap) {
      modalEl.removeEventListener('keydown', modalEl.__focusTrap);
      delete modalEl.__focusTrap;
    }
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocusedEl = document.activeElement;
    m.classList.add('visible');
    document.body.style.overflow = 'hidden';
    trapFocus(m);
    const closeBtn = m.querySelector('[data-close-modal]');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
  }
  function closeAllModals() {
    $$('.slb-modal').forEach(m => {
      if (m.classList.contains('visible')) {
        releaseFocusTrap(m);
        m.classList.remove('visible');
      }
    });
    document.body.style.overflow = '';
    if (lastFocusedEl && lastFocusedEl.focus) {
      try { lastFocusedEl.focus(); } catch {}
    }
  }
  function closeAllDropdowns() {
    $$('.slb-dropdown').forEach(d => d.classList.remove('open'));
  }

  /* ================================================================
     MAIN BYPASS
     ================================================================ */
  async function performBypassForUrl(url) {
    const service = detectService(url);
    if (!service) return { ok: false, error: 'Layanan tidak didukung', service: null };
    if (service.layer === 'info') {
      return { ok: false, error: bypassInformative(service), service, info: true };
    }
    let target = null;
    const t0 = performance.now();
    try {
      if (service.layer === 'direct') {
        target = await bypassDirect(url);
        if (!target) target = await bypassHtmlProxy(url, service);
      } else if (service.layer === 'proxy') {
        target = await bypassHtmlProxy(url, service);
      } else if (service.layer === 'api') {
        target = await bypassApi(url, service);
        if (!target) target = await bypassHtmlProxy(url, service);
      }
    } catch (e) {
      logError(service.name, e.message, e.stack);
      return { ok: false, error: e.message || 'Network error', service };
    }
    const duration = Math.round(performance.now() - t0);
    if (target && isValidUrl(target)) {
      logPerf(service.name, duration);
      return { ok: true, target, service, duration };
    }
    return { ok: false, error: 'Link tidak bisa di-bypass (CAPTCHA/server-side).', service };
  }

  async function performBypass() {
    const url = (els.input ? els.input.value.trim() : '');
    if (!url) { showToast('Masukkan URL terlebih dahulu', 'error'); return; }
    if (!isValidUrl(url)) { showToast('Format URL tidak valid', 'error'); return; }

    // Rate limit
    const rl = checkRateLimit();
    if (!rl.ok) {
      showToast('Terlalu banyak request. Tunggu ' + rl.wait + 's.', 'warning');
      return;
    }

    // Cache check
    const cached = getCached(url);
    if (cached) {
      if (els.cacheBadge) els.cacheBadge.style.display = 'inline-flex';
      renderResult(url, cached.target, cached.service, { duration: 0, cached: true, service: cached.service.name });
      showStatus('success', '⚡ Link diambil dari cache (instan).');
      showToast('⚡ Dari cache — instan!', 'success');
      if (getSetting('autoCopy')) navigator.clipboard.writeText(cached.target).catch(() => {});
      if (getSetting('autoOpen')) window.open(cached.target, '_blank', 'noopener');
      return;
    }
    if (els.cacheBadge) els.cacheBadge.style.display = 'none';

    if (els.bypassBtn) {
      els.bypassBtn.disabled = true;
      if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = 'Memproses...';
    }
    if (els.resultCard) els.resultCard.classList.remove('visible');
    hideStatus();
    showStatus('loading', 'Mendeteksi layanan...');
    showLoadingOverlay();

    try {
      const result = await performBypassForUrl(url);
      if (result.ok) {
        setCache(url, { target: result.target, service: result.service });
        renderResult(url, result.target, result.service, {
          duration: result.duration,
          cached: false,
          service: result.service.name
        });
        showStatus('success', `Bypass berhasil dalam ${(result.duration / 1000).toFixed(2)}s!`);
        saveHistory({
          source: url, target: result.target,
          service: result.service.name, ts: Date.now(), duration: result.duration
        });
        renderHistory();
        renderStats();
        showToast('Bypass berhasil!', 'success');
        addActivity('download', 'Bypass ' + result.service.name);
        hideLoadingOverlay(true);

        if (getSetting('autoCopy')) navigator.clipboard.writeText(result.target).catch(() => {});
        if (getSetting('autoOpen')) window.open(result.target, '_blank', 'noopener');
      } else if (result.info) {
        hideLoadingOverlay(false);
        showStatus('info', result.error);
        showToast('Layanan ini butuh solusi manual', 'warning');
        saveHistory({
          source: url, target: '❌ ' + result.service.name + ' (info)',
          service: result.service.name, ts: Date.now(), duration: 0
        });
        renderHistory();
        renderStats();
      } else {
        hideLoadingOverlay(false);
        showStatus('error', result.error || 'Bypass gagal');
        showToast(result.error || 'Bypass gagal', 'error');
        if (result.service) logError(result.service.name, result.error);
      }
    } catch (e) {
      hideLoadingOverlay(false);
      console.error('[SLB] performBypass error:', e);
      logError('performBypass', e.message, e.stack);
      const msg = (e && e.name === 'AbortError')
        ? 'Koneksi timeout. Periksa jaringan.'
        : 'Gagal mengambil data. Coba lagi.';
      showStatus('error', msg);
      showToast(msg, 'error');
    } finally {
      if (els.bypassBtn) {
        els.bypassBtn.disabled = false;
        if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = 'Bypass Sekarang';
      }
    }
  }

  /* ================================================================
     BATCH MODE
     ================================================================ */
  async function performBatchBypass() {
    if (!els.textarea) return;
    const raw = els.textarea.value.trim();
    if (!raw) { showToast('Masukkan minimal satu URL', 'error'); return; }
    const urls = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const valid = urls.filter(u => isValidUrl(u) && isValidShortlink(u));
    if (!valid.length) { showToast('Tidak ada URL shortlink valid', 'error'); return; }

    if (els.bypassBtn) {
      els.bypassBtn.disabled = true;
      if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = `0/${valid.length}...`;
    }
    hideStatus();
    if (els.resultCard) els.resultCard.classList.remove('visible');
    showStatus('loading', `Batch: 0/${valid.length} diproses...`);

    const results = [];
    for (let i = 0; i < valid.length; i++) {
      const u = valid[i];
      try {
        const r = await performBypassForUrl(u);
        results.push({ url: u, ...r });
      } catch (e) {
        results.push({ url: u, ok: false, error: e.message });
      }
      if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = `${i + 1}/${valid.length}...`;
      showStatus('loading', `Batch: ${i + 1}/${valid.length} diproses...`);
    }

    const csv = ['source,target,status', ...results.map(r =>
      `"${r.url}","${r.ok ? r.target : ''}","${r.ok ? 'OK' : (r.error || 'FAIL')}"`
    )].join('\n');

    if (els.resultSrc) els.resultSrc.textContent = `${valid.length} URL diproses`;
    if (els.resultTgt) els.resultTgt.textContent = `${results.filter(r => r.ok).length} berhasil, ${results.filter(r => !r.ok).length} gagal`;
    if (els.resultSvc) els.resultSvc.textContent = 'Batch Mode';
    if (els.resultMeta) els.resultMeta.innerHTML = '';
    if (els.resultCard) {
      els.resultCard.classList.add('visible');
      els.resultCard.setAttribute('data-target', csv);
    }
    showStatus('success', `Batch selesai: ${results.filter(r => r.ok).length}/${valid.length} berhasil.`);
    showToast('Batch selesai! Klik Copy untuk download CSV.', 'success');

    if (els.bypassBtn) {
      els.bypassBtn.disabled = false;
      if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = 'Bypass Sekarang';
    }
  }

  /* ================================================================
     COPY MULTI-FORMAT
     ================================================================ */
  async function copyAs(format) {
    const url = els.resultCard?.getAttribute('data-target');
    if (!url) return;
    const formats = {
      plain:    url,
      markdown: `[Link](${url})`,
      html:     `<a href="${url}" target="_blank" rel="noopener">Link</a>`,
      bbcode:   `[url=${url}]Link[/url]`,
      csv:      url
    };
    const text = formats[format] || url;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Disalin sebagai ' + format.toUpperCase(), 'success');
    } catch {
      window.prompt('Copy manual:', text);
    }
    closeAllDropdowns();
  }

  /* ================================================================
     EXPORT / IMPORT
     ================================================================ */
  function exportHistory(format) {
    const list = loadHistory();
    if (!list.length) { showToast('Riwayat kosong', 'warning'); return; }
    let content, mime, ext;
    if (format === 'csv') {
      content = 'source,target,service,ts\n' + list.map(x =>
        `"${x.source}","${x.target}","${x.service}","${new Date(x.ts).toISOString()}"`
      ).join('\n');
      mime = 'text/csv'; ext = 'csv';
    } else if (format === 'md') {
      content = '# Shortlink Bypass History\n\n' + list.map(x =>
        `- **${x.service}** (${timeAgo(x.ts)})\n  - Source: \`${x.source}\`\n  - Target: \`${x.target}\``
      ).join('\n');
      mime = 'text/markdown'; ext = 'md';
    } else {
      content = JSON.stringify(list, null, 2);
      mime = 'application/json'; ext = 'json';
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'slb-history-' + Date.now() + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('Riwayat diexport sebagai ' + ext.toUpperCase(), 'success');
  }

  function importHistory(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('Bukan array');
        const current = loadHistory();
        const merged = [...data, ...current].slice(0, HISTORY_MAX);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
        renderHistory();
        renderStats();
        showToast(`Imported ${data.length} item`, 'success');
      } catch { showToast('File tidak valid', 'error'); }
    };
    reader.readAsText(file);
  }

  /* ================================================================
     QR / SHARE / DOWNLOAD
     ================================================================ */
  function showQR(url) {
    if (!url || !els.qrContainer) return;
    els.qrContainer.innerHTML = '';
    if (typeof window.QRCode === 'undefined') {
      showToast('QR library belum dimuat', 'error');
      return;
    }
    new window.QRCode(els.qrContainer, {
      text: url, width: 220, height: 220,
      colorDark: '#000', colorLight: '#fff',
      correctLevel: window.QRCode.CorrectLevel.M
    });
    if (els.qrUrl) els.qrUrl.textContent = url;
    openModal('slbQrModal');
  }

  async function shareTarget() {
    const url = els.resultCard?.getAttribute('data-target');
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shortlink Bypass V4', text: 'Link hasil bypass:', url });
        return;
      } catch {}
    }
    await copyAs('plain');
  }

  function downloadResult() {
    const url = els.resultCard?.getAttribute('data-target');
    if (!url) return;
    if (url.startsWith('source,target,status')) {
      const blob = new Blob([url], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'slb-batch-' + Date.now() + '.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast('Batch CSV didownload', 'success');
      return;
    }
    const content = `Shortlink Bypass V4 — Result\n` +
      `Generated: ${new Date().toISOString()}\n` +
      `Source: ${els.resultSrc?.textContent || ''}\n` +
      `Target: ${url}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'slb-result-' + Date.now() + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('Hasil didownload', 'success');
  }

  /* ================================================================
     THEME
     ================================================================ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-slb-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  function toggleTheme() {
    const cur = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
    showToast('Tema: ' + (cur === 'dark' ? 'Light' : 'Dark'), 'info');
  }
  function applyAccent(accent) {
    document.documentElement.setAttribute('data-slb-accent', accent);
    localStorage.setItem(ACCENT_KEY, accent);
    $$('.slb-accent-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-accent') === accent));
  }

  /* ================================================================
     DEBUG PANEL
     ================================================================ */
  function switchDebugTab(tab) {
    const htmlEl = document.getElementById('slbDebugPre');
    const errEl = document.getElementById('slbDebugErrors');
    const statEl = document.getElementById('slbDebugStats');
    if (!htmlEl || !errEl || !statEl) return;
    htmlEl.hidden = tab !== 'html';
    errEl.hidden = tab !== 'errors';
    statEl.hidden = tab !== 'stats';
    $$('.slb-tab').forEach(t => {
      const active = t.getAttribute('data-tab') === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (tab === 'errors') {
      const errs = loadErrors();
      errEl.innerHTML = errs.length
        ? errs.map(e =>
            '<div class="slb-error-item">' +
              '<div class="ts">' + new Date(e.ts).toLocaleString('id-ID') + '</div>' +
              '<div class="svc">' + escapeHtml(e.service) + '</div>' +
              '<div>' + escapeHtml(e.message) + '</div>' +
            '</div>').join('')
        : 'Tidak ada error.';
    } else if (tab === 'stats') {
      const perf = loadPerf();
      if (!perf.length) { statEl.innerHTML = 'Belum ada data performa.'; return; }
      const grouped = {};
      perf.forEach(p => {
        if (!grouped[p.service]) grouped[p.service] = [];
        grouped[p.service].push(p.ms);
      });
      statEl.innerHTML = Object.entries(grouped).map(([svc, arr]) => {
        const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        const min = Math.min(...arr), max = Math.max(...arr);
        return '<div class="slb-perf-item"><span>' + escapeHtml(svc) + '</span>' +
          '<span>avg ' + avg + 'ms • min ' + min + 'ms • max ' + max + 'ms</span></div>';
      }).join('');
    }
  }

  function openDebugPanel() {
    if (els.debugPre) {
      const html = window.__slbLastHtml || '';
      els.debugPre.textContent = html
        ? (html.length > 5000 ? html.slice(0, 5000) + '\n\n... (truncated ' + (html.length - 5000) + ' chars)' : html)
        : 'Belum ada data. Lakukan bypass terlebih dahulu.';
    }
    switchDebugTab('html');
    openModal('slbDebugModal');
  }

  /* ================================================================
     CHANGELOG
     ================================================================ */
  const CHANGELOG = [
    { v:'4.0', date:'2025 — Ultimate', notes:[
      'Merge V2 (Legacy) + V3 (Modern) tanpa kehilangan fitur',
      'Fix: 15 bug V2 + 10 bug V3 (ID mismatch, schema, a11y)',
      'Baru: Loading overlay 3-layer eksklusif + progress bar',
      'Baru: Service List Modal (search + filter kategori/layer)',
      'Baru: Result Cache (TTL 5 menit) + indikator ⚡',
      'Baru: Rate Limiter (10 req/menit)',
      'Baru: History delete single, copy single, sort, search',
      'Baru: Settings panel (auto-copy, auto-open, notif, lang)',
      'Baru: Theme Customizer (4 warna accent)',
      'Baru: Error Log lokal (20 terakhir) + Performance metric',
      'Baru: Quick Actions Bar (5 populer)',
      'Baru: Toast queue (max 3), focus trap, print stylesheet',
      'Baru: Keyboard shortcut Ctrl+L untuk daftar layanan',
      'Fix: #slbHistory → #slbHistorySection (konsisten V2)',
      'Fix: .slb-mini-btn transform konflik di header',
      'Fix: spinner contrast di button gold'
    ]},
    { v:'3.0', date:'2024-12', notes:['Rewrite 4-layer engine','UI refresh','Batch/QR/Export'] },
    { v:'2.0', date:'2024-11', notes:['Modal lengkap','detectLayer helper','bypassOuo'] },
    { v:'1.0', date:'2024-11', notes:['Initial release'] }
  ];

  function renderChangelog() {
    const body = document.getElementById('slbChangelogBody');
    if (!body) return;
    body.innerHTML = CHANGELOG.map(c =>
      '<div class="slb-changelog-entry">' +
        '<div class="slb-changelog-version">v' + c.v + '</div>' +
        '<div class="slb-changelog-date">' + c.date + '</div>' +
        '<ul>' + c.notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('') + '</ul>' +
      '</div>'
    ).join('');
  }

  /* ================================================================
     BATCH TOGGLE
     ================================================================ */
  function toggleBatchMode() {
    if (!els.input || !els.textarea) return;
    const isBatch = els.textarea.style.display === 'none' || !els.textarea.style.display;
    els.textarea.style.display = isBatch ? 'block' : 'none';
    els.input.style.display = isBatch ? 'none' : 'block';
    const btn = document.getElementById('slbBatchToggle');
    if (btn) {
      btn.classList.toggle('active', isBatch);
      btn.setAttribute('aria-pressed', isBatch ? 'true' : 'false');
    }
    if (isBatch) els.textarea.focus();
    else els.input.focus();
  }

  /* ================================================================
     KEYBOARD SHORTCUTS
     ================================================================ */
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (els.textarea && els.textarea.style.display === 'block') performBatchBypass();
        else performBypass();
        return;
      }
      if (e.key === 'Escape') {
        const anyOpen = document.querySelector('.slb-modal.visible');
        if (anyOpen) { closeAllModals(); return; }
        closeAllDropdowns();
        return;
      }
      if (e.key === '?' && !mod && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault(); openModal('slbHelpModal'); return;
      }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBatchMode(); return; }
      if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); openModal('slbServiceListModal'); renderServiceList(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const pb = document.getElementById('slbPasteBtn');
        if (pb) pb.click();
      }
    });
  }

  /* ================================================================
     SETTINGS UI
     ================================================================ */
  function syncSettingsUI() {
    const s = loadSettings();
    const map = {
      setAutoCopy: 'autoCopy', setAutoOpen: 'autoOpen',
      setSaveHistory: 'saveHistory', setNotifications: 'notifications',
      setSound: 'sound', setAutoClipboard: 'autoClipboard'
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!s[key];
    });
    const langEl = document.getElementById('setLang');
    if (langEl) langEl.value = s.lang || 'id';
  }

  function bindSettingsUI() {
    const map = {
      setAutoCopy: 'autoCopy', setAutoOpen: 'autoOpen',
      setSaveHistory: 'saveHistory', setNotifications: 'notifications',
      setSound: 'sound', setAutoClipboard: 'autoClipboard'
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        const s = loadSettings(); s[key] = el.checked; saveSettings(s);
        showToast(key + ': ' + (el.checked ? 'ON' : 'OFF'), 'info');
      });
    });
    const langEl = document.getElementById('setLang');
    if (langEl) langEl.addEventListener('change', () => {
      const s = loadSettings(); s.lang = langEl.value; saveSettings(s);
    });
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    cacheEls();
    if (!els.bypassBtn) return;

    // Theme + accent
    applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
    applyAccent(localStorage.getItem(ACCENT_KEY) || 'gold');
    updateCacheCount();

    // Proxy select
    const proxySel = document.getElementById('slbProxySelect');
    if (proxySel) {
      proxySel.value = localStorage.getItem(PROXY_KEY) || 'auto';
      proxySel.addEventListener('change', () => {
        localStorage.setItem(PROXY_KEY, proxySel.value);
        showToast('Proxy: ' + proxySel.value, 'info');
      });
    }

    // Bypass button
    els.bypassBtn.addEventListener('click', () => {
      if (els.textarea && els.textarea.style.display === 'block') performBatchBypass();
      else performBypass();
    });

    // Input debounce + Enter
    if (els.input) {
      let debounceTimer = null;
      els.input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateBadge, 200);
      });
      els.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); performBypass(); }
      });
      if (getSetting('autoClipboard', false)) {
        els.input.addEventListener('focus', async () => {
          if (els.input.value) return;
          try {
            const t = await navigator.clipboard.readText();
            if (t && isValidUrl(t.trim()) && isValidShortlink(t.trim())) {
              els.input.value = t.trim(); updateBadge();
              showToast('URL terdeteksi dari clipboard', 'info');
            }
          } catch {}
        });
      }
    }

    // Paste button
    const pasteBtn = document.getElementById('slbPasteBtn');
    if (pasteBtn) pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          if (els.textarea && els.textarea.style.display === 'block') {
            els.textarea.value = text; els.textarea.focus();
          } else if (els.input) {
            els.input.value = text.trim(); updateBadge(); els.input.focus();
          }
          showToast('Berhasil paste dari clipboard', 'success');
        }
      } catch { showToast('Gagal akses clipboard. Paste manual (Ctrl+V).', 'warning'); }
    });

    // Clear button
    const clearBtn = document.getElementById('slbClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', resetUI);

    // Cache clear
    const cacheClear = document.getElementById('slbCacheClearBtn');
    if (cacheClear) cacheClear.addEventListener('click', () => {
      clearCache();
      showToast('Cache dibersihkan', 'success');
    });

    // Copy dropdown
    const copyDropdown = document.getElementById('slbCopyDropdown');
    if (copyDropdown) {
      const copyBtn = document.getElementById('slbCopyBtn');
      if (copyBtn) copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        copyDropdown.classList.toggle('open');
      });
      copyDropdown.querySelectorAll('[data-copy]').forEach(item => {
        item.addEventListener('click', () => copyAs(item.getAttribute('data-copy')));
      });
    }

    // Result actions
    const openBtn = document.getElementById('slbOpenBtn');
    if (openBtn) openBtn.addEventListener('click', () => {
      const t = els.resultCard?.getAttribute('data-target');
      if (!t) return;
      if (t.startsWith('source,target,status')) { downloadResult(); return; }
      window.open(t, '_blank', 'noopener');
    });
    const resetBtn = document.getElementById('slbResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetUI);
    const qrBtn = document.getElementById('slbQrBtn');
    if (qrBtn) qrBtn.addEventListener('click', () => {
      const t = els.resultCard?.getAttribute('data-target');
      if (t && !t.startsWith('source,target,status')) showQR(t);
    });
    const shareBtn = document.getElementById('slbShareBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareTarget);
    const dlBtn = document.getElementById('slbDownloadBtn');
    if (dlBtn) dlBtn.addEventListener('click', downloadResult);

    // Batch toggle
    const batchBtn = document.getElementById('slbBatchToggle');
    if (batchBtn) batchBtn.addEventListener('click', toggleBatchMode);

    // History
    if (els.historyList) {
      els.historyList.addEventListener('click', handleHistoryClick);
      els.historyList.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHistoryClick(e); }
      });
    }
    const histSearch = document.getElementById('slbHistorySearch');
    if (histSearch) histSearch.addEventListener('input', () => {
      historySearchQuery = histSearch.value.trim();
      renderHistory();
    });
    const histSort = document.getElementById('slbHistorySort');
    if (histSort) histSort.addEventListener('change', () => {
      historySortMode = histSort.value; renderHistory();
    });
    const clearHist = document.getElementById('slbClearHistoryBtn');
    if (clearHist) clearHist.addEventListener('click', () => {
      if (confirm('Hapus semua riwayat bypass?')) { clearHistory(); showToast('Riwayat dihapus', 'success'); }
    });

    // Export / Import
    const exportBtn = document.getElementById('slbExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', () => exportHistory('json'));
    const exportCsvBtn = document.getElementById('slbExportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportHistory('csv'));
    const importBtn = document.getElementById('slbImportBtn');
    const importFile = document.getElementById('slbImportFile');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) importHistory(f);
        importFile.value = '';
      });
    }

    // Theme
    const themeBtn = document.getElementById('slbThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Settings
    const settingsBtn = document.getElementById('slbSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
      syncSettingsUI();
      openModal('slbSettingsModal');
    });
    bindSettingsUI();

    // Accent picker
    $$('.slb-accent-btn').forEach(btn => {
      btn.addEventListener('click', () => applyAccent(btn.getAttribute('data-accent')));
    });

    // Debug
    const debugBtn = document.getElementById('slbDebugBtn');
    if (debugBtn) debugBtn.addEventListener('click', openDebugPanel);
    $$('.slb-tab').forEach(t => t.addEventListener('click', () => switchDebugTab(t.getAttribute('data-tab'))));

    // Help
    const helpBtn = document.getElementById('slbHelpBtn');
    if (helpBtn) helpBtn.addEventListener('click', () => openModal('slbHelpModal'));

    // Changelog
    const changelogBtn = document.getElementById('slbChangelogBtn');
    if (changelogBtn) changelogBtn.addEventListener('click', () => {
      renderChangelog(); openModal('slbChangelogModal');
    });

    // Service list
    const openService = document.getElementById('slbOpenServiceList');
    const openService2 = document.getElementById('slbOpenServiceList2');
    const handlerSvc = () => { renderServiceList(); openModal('slbServiceListModal'); };
    if (openService) openService.addEventListener('click', handlerSvc);
    if (openService2) openService2.addEventListener('click', handlerSvc);
    ['slbServiceSearch','slbServiceCat','slbServiceLayer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', renderServiceList);
      if (el) el.addEventListener('change', renderServiceList);
    });

    // Quick actions
    $$('.slb-quick-btn[data-quick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const host = btn.getAttribute('data-quick');
        if (els.input) {
          els.input.value = 'https://' + host + '/';
          updateBadge(); els.input.focus();
        }
        showToast('Contoh: ' + host + ' dimuat', 'info');
      });
    });

    // FAQ accordion
    document.addEventListener('click', e => {
      const q = e.target.closest('.slb-faq-q');
      if (q) {
        e.preventDefault();
        const item = q.closest('.slb-faq-item');
        if (item) {
          const open = item.classList.toggle('open');
          q.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      }
    });

    // Modal close
    document.addEventListener('click', e => {
      if (e.target.matches('[data-close-modal]')) { closeAllModals(); return; }
      if (e.target.classList.contains('slb-modal')) { closeAllModals(); return; }
      if (!e.target.closest('.slb-dropdown')) closeAllDropdowns();
    });

    // Login/Profile modal close (V2 compat)
    const closeLogin = document.getElementById('loginModalClose');
    const closeProfile = document.getElementById('profileModalClose');
    const closeRecaptcha = document.getElementById('recaptchaModalClose');
    if (closeLogin) closeLogin.addEventListener('click', () => { document.getElementById('loginModal').style.display = 'none'; });
    if (closeProfile) closeProfile.addEventListener('click', () => { document.getElementById('profileModal').style.display = 'none'; });
    if (closeRecaptcha) closeRecaptcha.addEventListener('click', () => { document.getElementById('recaptchaModal').style.display = 'none'; });

    // Keyboard
    initKeyboard();

    // Render awal
    renderHistory();
    renderStats();
    updateBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ================================================================
     EXPOSE API
     ================================================================ */
  window.IRGXY_SLB = {
    version: '4.0',
    SERVICES, detectService, detectLayer, isValidUrl, isValidShortlink,
    bypassDirect, bypassHtmlProxy, bypassApi, bypassInformative,
    bypassOuo, bypassLinkvertise, followRedirects,
    performBypass, performBatchBypass, performBypassForUrl,
    loadHistory, saveHistory, clearHistory, deleteHistoryItem,
    loadErrors, logError, loadPerf,
    getCache: () => CACHE, clearCache
  };

  console.log(
    '%c✅ Shortlink Bypass V4 (ULTIMATE) %cloaded — ' + SERVICES.length + ' services',
    'background:linear-gradient(135deg,#c9a96e,#7c5cfc);color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold',
    'color:inherit'
  );
})();