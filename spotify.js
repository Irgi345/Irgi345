/* ================================================================
   IRGXYMODS — SPOTIFY CLONE (spotify.js v1.0)
   OAuth 2.0 PKCE + Web Playback SDK + Full Player
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     CONFIG
     ================================================================ */
  const CONFIG = {
    // ⚠️ GANTI dengan Client ID Anda dari https://developer.spotify.com/dashboard
    // Buat app, tambahkan Redirect URI di bawah, lalu salin Client ID ke sini.
    clientId: '1a5e72b0b4624c12aff94841fc2fab60',
    redirectUri: window.location.origin + window.location.pathname,
    scopes: [
      'user-read-private',
      'user-read-email',
      'user-library-read',
      'user-library-modify',
      'user-top-read',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-recently-played',
      'streaming',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-private',
      'playlist-modify-public'
    ].join(' '),
    authEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
    apiBase: 'https://api.spotify.com/v1'
  };

  /* ================================================================
     SHORTCUTS & GUARDS
     ================================================================ */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const toast = (msg, type = 'success') => {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else console.log(`[toast:${type}]`, msg);
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  /* ================================================================
     STATE
     ================================================================ */
  const State = {
    user: null,
    token: null,
    deviceId: null,
    player: null,
    ready: false,
    currentTrack: null,
    contextUri: null,
    contextType: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    progressMs: 0,
    durationMs: 0,
    volume: 0.7,
    muted: false,
    shuffle: false,
    repeat: 'off',
    likedIds: new Set(),
    route: 'home',
    routeParam: null,
    cache: new Map()
  };

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };

  /* ================================================================
     PKCE HELPERS
     ================================================================ */
  function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  }

  async function sha256(plain) {
    const enc = new TextEncoder();
    return await crypto.subtle.digest('SHA-256', enc.encode(plain));
  }

  function base64urlencode(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async function generateCodeChallenge(verifier) {
    return base64urlencode(await sha256(verifier));
  }

  /* ================================================================
     AUTH
     ================================================================ */
  async function loginWithSpotify() {
    if (!CONFIG.clientId || CONFIG.clientId === 'YOUR_SPOTIFY_CLIENT_ID_HERE') {
      toast('Client ID belum dikonfigurasi. Hubungi admin.', 'warning');
      return;
    }
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    LS.set('sp_code_verifier', verifier);

    const params = new URLSearchParams({
      client_id: CONFIG.clientId,
      response_type: 'code',
      redirect_uri: CONFIG.redirectUri,
      scope: CONFIG.scopes,
      code_challenge_method: 'S256',
      code_challenge: challenge
    });
    window.location.href = `${CONFIG.authEndpoint}?${params.toString()}`;
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      toast('Login dibatalkan: ' + error, 'error');
      window.history.replaceState({}, '', window.location.pathname);
      return false;
    }
    if (!code) return false;

    const verifier = LS.get('sp_code_verifier', null);
    if (!verifier) {
      toast('Session verifier hilang. Coba login ulang.', 'error');
      return false;
    }

    try {
      const res = await fetch(CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CONFIG.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: CONFIG.redirectUri,
          code_verifier: verifier
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || 'Token exchange failed');

      LS.set('sp_access_token', data.access_token);
      if (data.refresh_token) LS.set('sp_refresh_token', data.refresh_token);
      LS.set('sp_expires_at', Date.now() + (data.expires_in * 1000));
      LS.del('sp_code_verifier');

      window.history.replaceState({}, '', window.location.pathname);
      toast('Login berhasil!', 'success');
      return true;
    } catch (err) {
      console.error('Callback error:', err);
      toast('Gagal login: ' + err.message, 'error');
      return false;
    }
  }

  async function refreshAccessToken() {
    const refreshToken = LS.get('sp_refresh_token', null);
    if (!refreshToken) return null;

    try {
      const res = await fetch(CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CONFIG.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || 'Refresh failed');

      LS.set('sp_access_token', data.access_token);
      if (data.refresh_token) LS.set('sp_refresh_token', data.refresh_token);
      LS.set('sp_expires_at', Date.now() + (data.expires_in * 1000));
      State.token = data.access_token;
      return data.access_token;
    } catch (err) {
      console.warn('Refresh failed:', err);
      return null;
    }
  }

  async function getValidToken() {
    const expiresAt = Number(LS.get('sp_expires_at', 0));
    const token = LS.get('sp_access_token', null);
    const now = Date.now();

    if (!token) return null;
    // Refresh jika expired atau akan expired dalam 5 menit
    if (now > expiresAt - 300000) {
      const refreshed = await refreshAccessToken();
      return refreshed || token;
    }
    return token;
  }

  function logoutSpotify() {
    ['sp_access_token', 'sp_refresh_token', 'sp_expires_at', 'sp_code_verifier', 'sp_player_state'].forEach(LS.del);
    State.user = null;
    State.token = null;
    State.currentTrack = null;
    State.likedIds.clear();
    if (State.player && State.player.disconnect) {
      try { State.player.disconnect(); } catch {}
    }
    toast('Logout berhasil', 'success');
    setTimeout(() => location.reload(), 700);
  }

  /* ================================================================
     API WRAPPER
     ================================================================ */
  async function api(endpoint, options = {}, retries = 2) {
    const token = await getValidToken();
    if (!token) throw new Error('NOT_AUTHENTICATED');

    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.apiBase}/${endpoint}`;
    const opts = {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, opts);

        if (res.status === 204 || res.status === 202) return null;
        if (res.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            opts.headers['Authorization'] = `Bearer ${newToken}`;
            continue;
          }
          throw new Error('TOKEN_EXPIRED');
        }
        if (res.status === 429) {
          const retry = Number(res.headers.get('Retry-After') || 3);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, retry * 1000));
            continue;
          }
          throw new Error('RATE_LIMITED');
        }
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try { const e = await res.json(); msg = e.error?.message || msg; } catch {}
          throw new Error(msg);
        }
        return await res.json();
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  async function apiSafe(endpoint, options, fallback = null) {
    try { return await api(endpoint, options); }
    catch (err) {
      if (err.message === 'NOT_AUTHENTICATED' || err.message === 'TOKEN_EXPIRED') return fallback;
      console.warn('API error:', endpoint, err.message);
      return fallback;
    }
  }

  /* ================================================================
     UTILITIES
     ================================================================ */
  function formatTime(ms) {
    if (!ms || ms < 0) return '0:00';
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return '0 mnt';
    const total = Math.floor(ms / 60000);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h} jam ${m} mnt` : `${m} mnt`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  function debounce(fn, wait = 300) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function pickImage(images, idx = 0) {
    if (!Array.isArray(images) || !images.length) return '';
    return images[Math.min(idx, images.length - 1)]?.url || images[0].url || '';
  }

  function artistsStr(t) {
    if (!t || !t.artists) return '—';
    return t.artists.map(a => a.name).join(', ');
  }

  /* ================================================================
     WEB PLAYBACK SDK
     ================================================================ */
  function initSDKPlayer() {
    return new Promise((resolve) => {
      if (!window.Spotify) {
        // SDK belum siap — tunggu
        window.onSpotifyWebPlaybackSDKReady = () => {
          createPlayer(resolve);
        };
      } else {
        createPlayer(resolve);
      }
    });
  }

  function createPlayer(resolve) {
    const player = new window.Spotify.Player({
      name: 'IRGXYMODS Web Player',
      getOAuthToken: async cb => {
        const token = await getValidToken();
        if (token) cb(token);
      },
      volume: State.volume
    });

    player.addListener('ready', ({ device_id }) => {
      State.deviceId = device_id;
      LS.set('sp_device_id', device_id);
      console.log('✅ Spotify Player ready:', device_id);
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.warn('Player not ready:', device_id);
      State.deviceId = null;
    });

    player.addListener('player_state_changed', (s) => {
      if (!s) return;
      State.currentTrack = s.track_window.current_track;
      State.isPlaying = !s.paused;
      State.progressMs = s.position;
      State.durationMs = s.duration;
      State.shuffle = s.shuffle;
      State.repeat = s.repeat_mode === 0 ? 'off' : s.repeat_mode === 1 ? 'context' : 'track';
      updatePlayerUI();
      updateMediaSession();
    });

    player.addListener('initialization_error', ({ message }) => {
      console.error('SDK init error:', message);
      toast('Player error: ' + message, 'error');
    });
    player.addListener('authentication_error', ({ message }) => {
      console.error('SDK auth error:', message);
      toast('Autentikasi player gagal', 'error');
    });
    player.addListener('account_error', ({ message }) => {
      console.error('SDK account error:', message);
      toast('Spotify Premium diperlukan untuk Web Player', 'warning');
    });

    player.connect().then(ok => {
      if (ok) {
        State.player = player;
        State.ready = true;
        console.log('✅ SDK connected');
      }
      resolve(player);
    });
  }

  /* ================================================================
     PLAYBACK CONTROL
     ================================================================ */
  async function playUri(uri, contextUri = null, contextType = null) {
    if (!State.deviceId) {
      toast('Player belum siap. Coba lagi.', 'warning');
      return;
    }
    try {
      const body = contextUri
        ? { context_uri: contextUri, offset: { uri }, position_ms: 0 }
        : { uris: [uri], position_ms: 0 };
      await api(`me/player/play?device_id=${State.deviceId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      if (contextUri) { State.contextUri = contextUri; State.contextType = contextType; }
    } catch (err) {
      if (err.message === 'NOT_AUTHENTICATED') toast('Login Spotify Premium untuk memutar', 'warning');
      else toast('Gagal memutar: ' + err.message, 'error');
    }
  }

  async function togglePlay() {
    if (!State.player || !State.deviceId) {
      toast('Login Spotify Premium untuk memutar lagu', 'warning');
      return;
    }
    try {
      if (State.isPlaying) {
        await api(`me/player/pause?device_id=${State.deviceId}`, { method: 'PUT' });
      } else {
        await api(`me/player/play?device_id=${State.deviceId}`, { method: 'PUT' });
      }
    } catch (err) { toast('Error: ' + err.message, 'error'); }
  }

  async function nextTrack() {
    try { await api(`me/player/next?device_id=${State.deviceId}`, { method: 'POST' }); }
    catch (err) { toast('Error: ' + err.message, 'error'); }
  }
  async function prevTrack() {
    try { await api(`me/player/previous?device_id=${State.deviceId}`, { method: 'POST' }); }
    catch (err) { toast('Error: ' + err.message, 'error'); }
  }
  async function seekTo(ms) {
    try {
      await api(`me/player/seek?position_ms=${Math.max(0, Math.floor(ms))}&device_id=${State.deviceId}`, { method: 'PUT' });
    } catch {}
  }
  async function setVolume(v) {
    State.volume = Math.max(0, Math.min(1, v));
    LS.set('sp_volume', State.volume);
    updateVolumeUI();
    try {
      await api(`me/player/volume?volume_percent=${Math.round(State.volume * 100)}&device_id=${State.deviceId}`, { method: 'PUT' });
    } catch {}
  }
  async function toggleShuffle() {
    State.shuffle = !State.shuffle;
    try {
      await api(`me/player/shuffle?state=${State.shuffle}&device_id=${State.deviceId}`, { method: 'PUT' });
      updateShuffleUI();
    } catch {}
  }
  async function cycleRepeat() {
    const modes = ['off', 'context', 'track'];
    const idx = (modes.indexOf(State.repeat) + 1) % modes.length;
    State.repeat = modes[idx];
    try {
      await api(`me/player/repeat?state=${State.repeat}&device_id=${State.deviceId}`, { method: 'PUT' });
      updateRepeatUI();
    } catch {}
  }
  async function addToQueue(uri) {
    try {
      await api(`me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${State.deviceId}`, { method: 'POST' });
      toast('Ditambahkan ke antrian', 'success');
    } catch (err) { toast('Gagal: ' + err.message, 'error'); }
  }
  async function likeTrack(id) {
    if (!id) return;
    try {
      const isLiked = State.likedIds.has(id);
      await api(`me/tracks?ids=${id}`, { method: isLiked ? 'DELETE' : 'PUT' });
      if (isLiked) State.likedIds.delete(id); else State.likedIds.add(id);
      updateLikeUI();
      toast(isLiked ? 'Dihapus dari Lagu Disukai' : 'Ditambahkan ke Lagu Disukai', 'success');
    } catch (err) { toast('Gagal: ' + err.message, 'error'); }
  }

  /* ================================================================
     MEDIA SESSION
     ================================================================ */
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !State.currentTrack) return;
    const t = State.currentTrack;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        album: t.album?.name || '',
        artwork: (t.album?.images || []).slice(0, 3).map(i => ({
          src: i.url, sizes: `${i.width}x${i.height}`, type: 'image/jpeg'
        }))
      });
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      navigator.mediaSession.setActionHandler('seekbackward', () => seekTo(State.progressMs - 10000));
      navigator.mediaSession.setActionHandler('seekforward', () => seekTo(State.progressMs + 10000));
    } catch {}
  }

  /* ================================================================
     PLAYER UI UPDATE
     ================================================================ */
  function updatePlayerUI() {
    const t = State.currentTrack;
    if (t) {
      const cover = pickImage(t.album?.images, 1);
      const coverEl = $('#spNowCover');
      coverEl.innerHTML = cover ? `<img src="${cover}" alt="">` : '<i class="fas fa-music"></i>';
      $('#spNowTitle').textContent = t.name;
      $('#spNowArtist').textContent = artistsStr(t);
      $('#spNowTitleLg').textContent = t.name;
      $('#spNowArtistLg').textContent = artistsStr(t);
      const bg = pickImage(t.album?.images, 0);
      $('#spNowBg').style.backgroundImage = bg ? `url("${bg}")` : 'none';
      const lgCover = $('#spNowCoverLg');
      lgCover.innerHTML = cover ? `<img src="${cover}" alt="">` : '<i class="fas fa-music"></i>';

      // Liked state
      State.likedIds.has(t.id) ? $('#spLikeBtn').classList.add('active') : $('#spLikeBtn').classList.remove('active');
      $('#spLikeBtn').innerHTML = State.likedIds.has(t.id)
        ? '<i class="fas fa-heart"></i>'
        : '<i class="far fa-heart"></i>';

      // Highlight playing track in list
      $$('.sp-track').forEach(el => {
        el.classList.toggle('playing', el.dataset.uri === t.uri);
      });
    }

    // Play icon
    $('#spPlayIcon').className = State.isPlaying ? 'fas fa-pause' : 'fas fa-play';
    $('#spPlayPause').classList.toggle('playing', State.isPlaying);

    // Progress
    const pct = State.durationMs ? (State.progressMs / State.durationMs) * 100 : 0;
    $('#spProgressFill').style.width = pct + '%';
    $('#spProgressHandle').style.left = pct + '%';
    $('#spTimeCur').textContent = formatTime(State.progressMs);
    $('#spTimeDur').textContent = formatTime(State.durationMs);

    updateShuffleUI();
    updateRepeatUI();
    updateVolumeUI();
  }

  function updateShuffleUI() {
    $('#spShuffle').classList.toggle('active', State.shuffle);
  }
  function updateRepeatUI() {
    const btn = $('#spRepeat');
    btn.classList.toggle('active', State.repeat !== 'off');
    if (State.repeat === 'track') btn.innerHTML = '<i class="fas fa-redo"></i><sup style="font-size:0.6rem">1</sup>';
    else btn.innerHTML = '<i class="fas fa-redo"></i>';
  }
  function updateVolumeUI() {
    const pct = State.muted ? 0 : State.volume * 100;
    $('#spVolumeFill').style.width = pct + '%';
    const icon = State.muted || State.volume === 0 ? 'fa-volume-mute'
      : State.volume < 0.4 ? 'fa-volume-down'
      : 'fa-volume-up';
    $('#spVolumeBtn').innerHTML = `<i class="fas ${icon}"></i>`;
  }
  function updateLikeUI() {
    const t = State.currentTrack;
    if (!t) return;
    const isLiked = State.likedIds.has(t.id);
    const btn = $('#spLikeBtn');
    btn.classList.toggle('active', isLiked);
    btn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
  }

  /* ================================================================
     PROGRESS TRACK INTERACTION
     ================================================================ */
  function bindProgressTrack() {
    const track = $('#spProgressTrack');
    const volTrack = $('#spVolumeTrack');

    const seekFromEvent = (e) => {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const newPos = pct * State.durationMs;
      State.progressMs = newPos;
      $('#spProgressFill').style.width = (pct * 100) + '%';
      $('#spProgressHandle').style.left = (pct * 100) + '%';
      $('#spTimeCur').textContent = formatTime(newPos);
      return newPos;
    };

    track.addEventListener('click', (e) => seekTo(seekFromEvent(e)));
    track.addEventListener('touchstart', (e) => { e.preventDefault(); seekTo(seekFromEvent(e)); }, { passive: false });

    let dragging = false;
    const onMove = (e) => { if (dragging) seekFromEvent(e); };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      const rect = track.getBoundingClientRect();
      const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      seekTo(pct * State.durationMs);
    };
    track.addEventListener('mousedown', (e) => { dragging = true; seekFromEvent(e); });
    track.addEventListener('touchstart', () => { dragging = true; }, { passive: true });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);

    // Volume
    const setVolFromEvent = (e) => {
      const rect = volTrack.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      State.muted = false;
      setVolume(pct);
    };
    volTrack.addEventListener('click', setVolFromEvent);
    volTrack.addEventListener('touchstart', (e) => { e.preventDefault(); setVolFromEvent(e); }, { passive: false });
    volTrack.addEventListener('mousedown', () => {
      const move = (e) => setVolFromEvent(e);
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  /* ================================================================
     VIEW: HOME
     ================================================================ */
  async function renderHome(container) {
    container.innerHTML = `
      <div class="sp-hero-greeting">${greeting()}${State.user ? ', ' + esc(State.user.display_name || State.user.id) : ''} <span>👋</span></div>
      <div class="sp-quick-grid" id="spQuick"></div>
      <div id="spHomeContent">
        <div class="sp-section"><h2 class="sp-section-title">Memuat...</h2>
          <div class="sp-grid">${'<div class="sp-skeleton" style="height:220px"></div>'.repeat(5)}</div>
        </div>
      </div>
    `;

    if (!State.user) {
      renderQuickTiles(container);
      $('#spHomeContent').innerHTML = guestHomeHTML();
      return;
    }

    renderQuickTiles(container);

    // Fetch parallel
    const [recent, topTracks, topArtists, newReleases, featured] = await Promise.all([
      apiSafe('me/player/recently-played?limit=8'),
      apiSafe('me/top/tracks?limit=8&time_range=short_term'),
      apiSafe('me/top/artists?limit=8&time_range=short_term'),
      apiSafe('browse/new-releases?limit=8&country=ID'),
      apiSafe('browse/featured-playlists?limit=8&country=ID')
    ]);

    const html = [];
    if (recent?.items?.length) {
      html.push(sectionHTML('Terakhir Diputar', recent.items.map(i => i.track), 'track'));
    }
    if (topTracks?.items?.length) {
      html.push(sectionHTML('Lagu Teratasmu', topTracks.items, 'track'));
    }
    if (topArtists?.items?.length) {
      html.push(sectionHTML('Artist Teratasmu', topArtists.items, 'artist'));
    }
    if (newReleases?.albums?.items?.length) {
      html.push(sectionHTML('Rilis Baru', newReleases.albums.items, 'album'));
    }
    if (featured?.playlists?.items?.length) {
      html.push(sectionHTML('Playlist Pilihan', featured.playlists.items, 'playlist'));
    }

    if (!html.length) html.push('<div class="sp-empty"><i class="fas fa-music"></i><h3>Belum ada data</h3><p>Putar beberapa lagu atau login dengan akun Spotify untuk melihat rekomendasi.</p></div>');

    $('#spHomeContent').innerHTML = html.join('');
  }

  function renderQuickTiles(container) {
    const tiles = [
      { name: 'Lagu Disukai', icon: 'heart', route: 'liked' },
      { name: 'Terakhir Diputar', icon: 'history', route: 'recent' },
      { name: 'Koleksi Saya', icon: 'book', route: 'library' },
      { name: 'Cari Musik', icon: 'search', route: 'search' }
    ];
    const el = $('#spQuick');
    if (!el) return;
    el.innerHTML = tiles.map(t => `
      <div class="sp-quick-tile" data-nav="${t.route}">
        <div class="sp-quick-tile-icon"><i class="fas fa-${t.icon}"></i></div>
        <span>${t.name}</span>
        <button class="sp-quick-play" data-nav="${t.route}"><i class="fas fa-play"></i></button>
      </div>`).join('');
  }

  function guestHomeHTML() {
    return `
      <div class="sp-empty">
        <i class="fab fa-spotify"></i>
        <h3>Selamat datang di IRGXYMODS Music</h3>
        <p>Login dengan akun Spotify Anda untuk memutar jutaan lagu, mengakses playlist pribadi, dan menikmati playback premium.</p>
        <button class="sp-btn-primary" id="spHomeLogin"><i class="fab fa-spotify"></i> Login dengan Spotify</button>
      </div>`;
  }

  function sectionHTML(title, items, type) {
    if (!items?.length) return '';
    return `
      <section class="sp-section">
        <div class="sp-section-head"><h2 class="sp-section-title">${esc(title)}</h2></div>
        <div class="sp-grid">${items.map(it => cardHTML(it, type)).join('')}</div>
      </section>`;
  }

  function cardHTML(item, type) {
    if (!item) return '';
    const id = item.id;
    const name = item.name || '—';
    const uri = item.uri || (type === 'track' ? `spotify:track:${id}` : item.album?.uri || '');

    let img = '';
    let sub = '';
    let round = false;
    let route = '';

    if (type === 'track') {
      img = pickImage(item.album?.images, 1);
      sub = artistsStr(item);
      route = item.album?.id ? `#/album/${item.album.id}` : '';
    } else if (type === 'artist') {
      img = pickImage(item.images, 1);
      sub = 'Artist';
      round = true;
      route = `#/artist/${id}`;
    } else if (type === 'album') {
      img = pickImage(item.images, 1);
      sub = artistsStr(item);
      route = `#/album/${id}`;
    } else if (type === 'playlist') {
      img = pickImage(item.images, 1);
      sub = item.description || `Oleh ${item.owner?.display_name || 'Spotify'}`;
      route = `#/playlist/${id}`;
    }

    return `
      <button class="sp-card" data-nav="${route}" data-uri="${uri}" data-play-uri="${uri}">
        <div class="sp-card-img-wrap ${round ? 'round' : ''}">
          ${img ? `<img src="${img}" loading="lazy" alt="${esc(name)}">` : ''}
          <span class="sp-card-play" data-play-uri="${uri}" data-context="${item.context_uri || ''}">
            <i class="fas fa-play"></i>
          </span>
        </div>
        <div class="sp-card-title">${esc(name)}</div>
        <div class="sp-card-desc">${esc(sub)}</div>
      </button>`;
  }

  /* ================================================================
     VIEW: SEARCH
     ================================================================ */
  async function renderSearch(container, query) {
    if (!query) {
      container.innerHTML = `
        <h2 class="sp-section-title" style="margin:20px 0">Jelajahi Semua</h2>
        <div class="sp-grid">
          ${['Pop','Hip-Hop','Rock','Jazz','K-Pop','Indie','Elektronik','R&B','Chill','Workout','Party','Indonesia']
            .map(c => `<button class="sp-card" data-search="${c}"><div class="sp-card-img-wrap" style="background:linear-gradient(135deg,#${Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0')},#${Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0')})"></div><div class="sp-card-title">${c}</div></button>`).join('')}
        </div>`;
      return;
    }

    container.innerHTML = `<div class="sp-empty"><i class="fas fa-spinner fa-spin"></i><p>Mencari "${esc(query)}"...</p></div>`;

    const q = encodeURIComponent(query);
    const data = await apiSafe(`search?q=${q}&type=track,artist,album,playlist&limit=8&market=ID`);
    if (!data) { container.innerHTML = `<div class="sp-empty"><i class="fas fa-exclamation"></i><h3>Gagal mencari</h3><p>Coba lagi nanti.</p></div>`; return; }

    const tracks = data.tracks?.items || [];
    const artists = data.artists?.items || [];
    const albums = data.albums?.items || [];
    const playlists = data.playlists?.items || [];

    const html = [];
    if (tracks.length) html.push(`<section class="sp-section"><div class="sp-section-head"><h2 class="sp-section-title">Lagu</h2></div>${trackListHTML(tracks)}</section>`);
    if (artists.length) html.push(sectionHTML('Artist', artists, 'artist'));
    if (albums.length) html.push(sectionHTML('Album', albums, 'album'));
    if (playlists.length) html.push(sectionHTML('Playlist', playlists.filter(p => p), 'playlist'));

    container.innerHTML = html.length ? html.join('') : `<div class="sp-empty"><i class="fas fa-search"></i><h3>Tidak ada hasil</h3><p>Tidak ada hasil untuk "${esc(query)}".</p></div>`;
  }

  /* ================================================================
     VIEW: LIKED / LIBRARY / RECENT
     ================================================================ */
  async function renderLiked(container) {
    if (!State.user) {
      container.innerHTML = loginPrompt('Login untuk melihat Lagu Disukai');
      return;
    }
    container.innerHTML = `<div class="sp-view-loading" style="position:relative;height:200px"><div class="sp-spinner-lg"></div></div>`;
    const data = await apiSafe('me/tracks?limit=50');
    const items = (data?.items || []).map(i => i.track);
    container.innerHTML = `
      <div class="sp-detail-head">
        <div class="sp-detail-cover"><div style="width:100%;height:100%;background:linear-gradient(135deg,#450af5,#c4efd9);display:flex;align-items:center;justify-content:center;font-size:5rem;color:#fff"><i class="fas fa-heart"></i></div></div>
        <div class="sp-detail-meta">
          <div class="sp-detail-type">Playlist</div>
          <h1 class="sp-detail-title">Lagu Disukai</h1>
          <div class="sp-detail-sub"><strong>${esc(State.user.display_name || State.user.id)}</strong> <span>${items.length} lagu</span></div>
        </div>
      </div>
      <div class="sp-detail-actions">
        <button class="sp-play-large" id="spPlayLiked"><i class="fas fa-play"></i></button>
      </div>
      ${items.length ? trackListHTML(items) : '<div class="sp-empty"><i class="fas fa-heart"></i><h3>Belum ada lagu</h3><p>Lagu yang Anda sukai akan muncul di sini.</p></div>'}
    `;
    $('#spPlayLiked')?.addEventListener('click', () => {
      if (!items.length) return;
      playUri(items[0].uri, 'spotify:user:' + State.user.id + ':collection', 'collection');
    });
    // Sync liked set
    items.forEach(t => t?.id && State.likedIds.add(t.id));
  }

  async function renderRecent(container) {
    if (!State.user) {
      container.innerHTML = loginPrompt('Login untuk melihat riwayat');
      return;
    }
    container.innerHTML = `<div class="sp-view-loading" style="position:relative;height:200px"><div class="sp-spinner-lg"></div></div>`;
    const data = await apiSafe('me/player/recently-played?limit=50');
    const tracks = (data?.items || []).map(i => i.track);
    container.innerHTML = `
      <h1 class="sp-detail-title" style="font-size:2rem;margin:20px 0">Terakhir Diputar</h1>
      ${tracks.length ? trackListHTML(tracks) : '<div class="sp-empty"><i class="fas fa-history"></i><h3>Belum ada riwayat</h3></div>'}
    `;
  }

  async function renderLibrary(container) {
    if (!State.user) { container.innerHTML = loginPrompt('Login untuk melihat koleksi'); return; }
    container.innerHTML = `<div class="sp-view-loading" style="position:relative;height:200px"><div class="sp-spinner-lg"></div></div>`;
    const data = await apiSafe('me/playlists?limit=50');
    const lists = data?.items || [];
    container.innerHTML = `
      <h1 class="sp-detail-title" style="font-size:2rem;margin:20px 0">Koleksi Saya</h1>
      ${lists.length ? `<div class="sp-grid">${lists.map(p => cardHTML(p, 'playlist')).join('')}</div>` : '<div class="sp-empty"><i class="fas fa-book"></i><h3>Belum ada playlist</h3></div>'}
    `;
  }

  /* ================================================================
     VIEW: ALBUM / ARTIST / PLAYLIST
     ================================================================ */
  async function renderAlbum(container, id) {
    container.innerHTML = `<div class="sp-view-loading" style="position:relative;height:200px"><div class="sp-spinner-lg"></div></div>`;
    const [album, tracks] = await Promise.all([
      apiSafe(`albums/${id}`),
      apiSafe(`albums/${id}/tracks?limit=50`)
    ]);
    if (!album) { container.innerHTML = '<div class="sp-empty"><h3>Album tidak ditemukan</h3></div>'; return; }
    const items = (tracks?.items || []).map(t => ({ ...t, album }));
    container.innerHTML = `
      <div class="sp-detail-head">
        <div class="sp-detail-cover"><img src="${pickImage(album.images, 0)}" alt=""></div>
        <div class="sp-detail-meta">
          <div class="sp-detail-type">Album</div>
          <h1 class="sp-detail-title">${esc(album.name)}</h1>
          <div class="sp-detail-sub">
            <strong>${esc(artistsStr(album))}</strong>
            <span>${album.release_date?.slice(0, 4) || ''}</span>
            <span>${album.total_tracks} lagu</span>
          </div>
        </div>
      </div>
      <div class="sp-detail-actions">
        <button class="sp-play-large" id="spPlayAlbum"><i class="fas fa-play"></i></button>
      </div>
      ${trackListHTML(items)}
    `;
    $('#spPlayAlbum')?.addEventListener('click', () => {
      if (!items.length) return;
      playUri(items[0].uri, album.uri, 'album');
    });
  }

  async function renderArtist(container, id) {
    container.innerHTML = `<div class="sp-view-loading" style="position:relative;height:200px"><div class="sp-spinner-lg"></div></div>`;
    const [artist, topTracks, albums] = await Promise.all([
      apiSafe(`artists/${id}`),
      apiSafe(`artists/${id}/top-tracks?market=ID`),
      apiSafe(`artists/${id}/albums?include_groups=album,single&limit=20&market=ID`)
    ]);
    if (!artist) { container.innerHTML = '<div class="sp-empty"><h3>Artist tidak ditemukan</h3></div>'; return; }
    const top = topTracks?.tracks || [];
    container.innerHTML = `
      <div class="sp-detail-head">
        <div class="sp-detail-cover round"><img src="${pickImage(artist.images, 0)}" alt=""></div>
        <div class="sp-detail-meta">
          <div class="sp-detail-type">Artist</div>
          <h1 class="sp-detail-title">${esc(artist.name)}</h1>
          <div class="sp-detail-sub"><span>${(artist.followers?.total || 0).toLocaleString('id-ID')} pengikut</span></div>
        </div>
      </div>
      ${top.length ? `<section class="sp-section"><div class="sp-section-head"><h2 class="sp-section-title">Populer</h2></div>${trackListHTML(top)}</section>` : ''}
      ${albums?.items?.length ? sectionHTML('Album & Single', albums.items.filter(a => a), 'album') : ''}
    `;
  }

  async function renderPlaylist(container, id) {
    container.innerHTML = `<div class="sp-view-loading" style="position:relative;height:200px"><div class="sp-spinner-lg"></div></div>`;
    const [pl, tracks] = await Promise.all([
      apiSafe(`playlists/${id}`),
      apiSafe(`playlists/${id}/tracks?limit=100`)
    ]);
    if (!pl) { container.innerHTML = '<div class="sp-empty"><h3>Playlist tidak ditemukan</h3></div>'; return; }
    const items = (tracks?.items || []).map(i => i.track).filter(Boolean);
    container.innerHTML = `
      <div class="sp-detail-head">
        <div class="sp-detail-cover"><img src="${pickImage(pl.images, 0)}" alt=""></div>
        <div class="sp-detail-meta">
          <div class="sp-detail-type">Playlist</div>
          <h1 class="sp-detail-title">${esc(pl.name)}</h1>
          <div class="sp-detail-sub">
            <strong>${esc(pl.owner?.display_name || '')}</strong>
            <span>${items.length} lagu</span>
          </div>
        </div>
      </div>
      <div class="sp-detail-actions">
        <button class="sp-play-large" id="spPlayPl"><i class="fas fa-play"></i></button>
      </div>
      ${items.length ? trackListHTML(items) : '<div class="sp-empty"><i class="fas fa-music"></i><h3>Playlist kosong</h3></div>'}
    `;
    $('#spPlayPl')?.addEventListener('click', () => {
      if (!items.length) return;
      playUri(items[0].uri, pl.uri, 'playlist');
    });
  }

  function loginPrompt(msg) {
    return `<div class="sp-empty">
      <i class="fab fa-spotify"></i>
      <h3>${esc(msg)}</h3>
      <p>Login dengan Spotify Premium untuk mengakses fitur lengkap.</p>
      <button class="sp-btn-primary" id="spHomeLogin"><i class="fab fa-spotify"></i> Login</button>
    </div>`;
  }

  /* ================================================================
     TRACK LIST HTML
     ================================================================ */
  function trackListHTML(tracks) {
    return `
      <div class="sp-tracklist">
        ${tracks.map((t, i) => {
          if (!t) return '';
          const isPlaying = State.currentTrack?.uri === t.uri;
          return `
            <div class="sp-track ${isPlaying ? 'playing' : ''}" data-uri="${t.uri}" data-track-id="${t.id}">
              <div class="sp-track-num">
                <span class="sp-track-num-text">${i + 1}</span>
                <i class="fas fa-play sp-track-play-icon"></i>
              </div>
              <div class="sp-track-img">${pickImage(t.album?.images, 2) ? `<img src="${pickImage(t.album?.images, 2)}" loading="lazy" alt="">` : ''}</div>
              <div class="sp-track-meta">
                <div class="sp-track-title">${esc(t.name)}</div>
                <div class="sp-track-artist">${esc(artistsStr(t))}</div>
              </div>
              <div class="sp-track-album">${esc(t.album?.name || '')}</div>
              <div class="sp-track-dur">${formatTime(t.duration_ms)}</div>
              <div class="sp-track-actions">
                <button data-track-menu="${t.id}" aria-label="Menu lagu"><i class="fas fa-ellipsis-h"></i></button>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* ================================================================
     ROUTER
     ================================================================ */
  const routes = {
    home: (c) => renderHome(c),
    search: (c, q) => renderSearch(c, q),
    library: (c) => renderLibrary(c),
    liked: (c) => renderLiked(c),
    recent: (c) => renderRecent(c),
    album: (c, id) => renderAlbum(c, id),
    artist: (c, id) => renderArtist(c, id),
    playlist: (c, id) => renderPlaylist(c, id)
  };

  async function navigate() {
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const [route, ...rest] = hash.split('/');
    const param = rest.join('/');
    const container = $('#spViewContainer');

    State.route = route;
    State.routeParam = param;

    // Active nav
    $$('.sp-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    // Scroll top
    container.scrollTop = 0;

    const fn = routes[route] || routes.home;
    try {
      await fn(container, param);
      // Re-bind inside
      bindTrackClicks(container);
    } catch (err) {
      console.error('Route error:', err);
      container.innerHTML = `<div class="sp-empty"><i class="fas fa-exclamation-triangle"></i><h3>Terjadi kesalahan</h3><p>${esc(err.message)}</p></div>`;
    }

    // Update search input
    const si = $('#spSearchInput');
    if (route === 'search' && param) si.value = decodeURIComponent(param);
  }

  function bindTrackClicks(container) {
    container.querySelectorAll('.sp-track').forEach(el => {
      el.addEventListener('dblclick', () => {
        const uri = el.dataset.uri;
        if (uri) playUri(uri, State.contextUri, State.contextType);
      });
      el.querySelector('.sp-track-play-icon')?.parentElement?.addEventListener('click', (e) => {
        e.stopPropagation();
        const uri = el.dataset.uri;
        if (uri) playUri(uri, State.contextUri, State.contextType);
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-track-menu]')) return;
        if (e.target.closest('.sp-track-actions')) return;
        const uri = el.dataset.uri;
        if (uri) playUri(uri, State.contextUri, State.contextType);
      });
    });
  }

  /* ================================================================
     EVENT DELEGATION
     ================================================================ */
  function bindGlobalEvents() {
    // Navigate via [data-nav]
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        const route = nav.dataset.nav;
        if (route && route.startsWith('#')) location.hash = route;
        else if (route) location.hash = '#/' + route;
        return;
      }
      const search = e.target.closest('[data-search]');
      if (search) {
        const q = search.dataset.search;
        location.hash = '#/search/' + encodeURIComponent(q);
        $('#spSearchInput').value = q;
        return;
      }
      const playBtn = e.target.closest('[data-play-uri]');
      if (playBtn) {
        e.stopPropagation();
        const uri = playBtn.dataset.playUri;
        const ctx = playBtn.dataset.context || null;
        if (uri) playUri(uri, ctx, ctx ? 'playlist' : null);
        return;
      }
      // Close context menu
      if (!e.target.closest('.sp-context-menu')) closeContextMenu();
      // Close user dropdown
      if (!e.target.closest('#spUserTopbarBtn') && !e.target.closest('#spUserDropdown')) {
        $('#spUserDropdown')?.classList.remove('open');
      }
    });

    // Home login button (delegated)
    document.addEventListener('click', (e) => {
      if (e.target.closest('#spHomeLogin') || e.target.closest('#spLoginBtn')) {
        e.preventDefault();
        loginWithSpotify();
      }
    });

    // Player controls
    $('#spPlayPause')?.addEventListener('click', togglePlay);
    $('#spNext')?.addEventListener('click', nextTrack);
    $('#spPrev')?.addEventListener('click', prevTrack);
    $('#spShuffle')?.addEventListener('click', toggleShuffle);
    $('#spRepeat')?.addEventListener('click', cycleRepeat);
    $('#spLikeBtn')?.addEventListener('click', () => State.currentTrack && likeTrack(State.currentTrack.id));
    $('#spVolumeBtn')?.addEventListener('click', () => {
      State.muted = !State.muted;
      setVolume(State.muted ? 0 : (LS.get('sp_volume', 0.7) || 0.7));
    });

    // Back / Forward
    $('#spBack')?.addEventListener('click', () => history.back());
    $('#spForward')?.addEventListener('click', () => history.forward());
    $('#spMobileMenu')?.addEventListener('click', () => $('#spSidebar').classList.toggle('open'));

    // Search
    const searchInput = $('#spSearchInput');
    const performSearch = debounce((q) => {
      if (q) location.hash = '#/search/' + encodeURIComponent(q);
      else location.hash = '#/search';
    }, 400);

    searchInput?.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      $('#spSearchClear').hidden = !v;
      performSearch(v);
    });
    $('#spSearchClear')?.addEventListener('click', () => {
      searchInput.value = '';
      $('#spSearchClear').hidden = true;
      location.hash = '#/search';
    });

    // User dropdown
    $('#spUserTopbarBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      $('#spUserDropdown').classList.toggle('open');
    });
    $('#spLogoutBtn')?.addEventListener('click', logoutSpotify);
    $('#spLoginBtn')?.addEventListener('click', loginWithSpotify);

    // Queue drawer
    $('#spQueueBtn')?.addEventListener('click', async () => {
      const dr = $('#spQueueDrawer');
      dr.hidden = !dr.hidden;
      if (!dr.hidden) await renderQueue();
    });
    $('#spQueueClose')?.addEventListener('click', () => { $('#spQueueDrawer').hidden = true; });

    // Now playing fullscreen
    $('#spNowCover')?.addEventListener('click', () => { $('#spNowFullscreen').hidden = false; });
    $('#spNowClose')?.addEventListener('click', () => { $('#spNowFullscreen').hidden = true; });
    $('#spFullscreen')?.addEventListener('click', () => { $('#spNowFullscreen').hidden = false; });

    // Create playlist
    $('#spCreatePlaylist')?.addEventListener('click', createPlaylistFlow);

    // Context menu on track-actions
    document.addEventListener('click', (e) => {
      const menu = e.target.closest('[data-track-menu]');
      if (menu) {
        e.stopPropagation();
        const id = menu.dataset.trackMenu;
        openTrackContextMenu(e.clientX, e.clientY, id);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      if (inInput && e.key !== 'Escape') return;

      switch (e.key) {
        case ' ': if (!inInput) { e.preventDefault(); togglePlay(); } break;
        case 'ArrowRight': if (!inInput && e.shiftKey) nextTrack(); break;
        case 'ArrowLeft': if (!inInput && e.shiftKey) prevTrack(); break;
        case 'ArrowUp': if (!inInput) { e.preventDefault(); setVolume(State.volume + 0.05); } break;
        case 'ArrowDown': if (!inInput) { e.preventDefault(); setVolume(State.volume - 0.05); } break;
        case 'm': case 'M': if (!inInput) $('#spVolumeBtn')?.click(); break;
        case 's': case 'S': if (!inInput) toggleShuffle(); break;
        case 'r': case 'R': if (!inInput) cycleRepeat(); break;
        case '/': if (!inInput) { e.preventDefault(); searchInput?.focus(); } break;
        case 'Escape':
          closeContextMenu();
          $('#spUserDropdown')?.classList.remove('open');
          $('#spNowFullscreen').hidden = true;
          $('#spQueueDrawer').hidden = true;
          break;
        case 'l': case 'L': if (!inInput && State.currentTrack) likeTrack(State.currentTrack.id); break;
      }
    });

    // Hash router
    window.addEventListener('hashchange', navigate);

    // Online/offline
    window.addEventListener('offline', () => toast('Koneksi terputus', 'warning'));
    window.addEventListener('online', () => { toast('Koneksi kembali', 'success'); navigate(); });

    // Save player state periodically
    setInterval(() => {
      if (!State.currentTrack) return;
      LS.set('sp_player_state', {
        currentTrackUri: State.currentTrack.uri,
        positionMs: State.progressMs,
        volume: State.volume,
        shuffle: State.shuffle,
        repeat: State.repeat,
        updatedAt: Date.now()
      });
    }, 5000);

    // Progress tick (SDK gives position via event, but we poll for smoothness)
    setInterval(() => {
      if (State.isPlaying && State.durationMs) {
        State.progressMs = Math.min(State.durationMs, State.progressMs + 1000);
        const pct = (State.progressMs / State.durationMs) * 100;
        $('#spProgressFill').style.width = pct + '%';
        $('#spProgressHandle').style.left = pct + '%';
        $('#spTimeCur').textContent = formatTime(State.progressMs);
      }
    }, 1000);
  }

  function closeContextMenu() {
    const el = $('#spContextMenu');
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }

  function openTrackContextMenu(x, y, trackId) {
    const el = $('#spContextMenu');
    const uri = `spotify:track:${trackId}`;
    el.innerHTML = `
      <button data-act="queue"><i class="fas fa-list"></i> Tambah ke Antrian</button>
      <button data-act="like"><i class="fas fa-heart"></i> ${State.likedIds.has(trackId) ? 'Hapus dari' : 'Tambah ke'} Lagu Disukai</button>
      <button data-act="copy"><i class="fas fa-link"></i> Salin link lagu</button>
      <hr />
      <button data-act="artist"><i class="fas fa-user"></i> Buka artist</button>
      <button data-act="album"><i class="fas fa-compact-disc"></i> Buka album</button>
    `;
    el.style.left = Math.min(x, window.innerWidth - 240) + 'px';
    el.style.top = Math.min(y, window.innerHeight - 260) + 'px';
    el.hidden = false;

    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        closeContextMenu();
        if (act === 'queue') await addToQueue(uri);
        else if (act === 'like') await likeTrack(trackId);
        else if (act === 'copy') {
          try {
            await navigator.clipboard.writeText(`https://open.spotify.com/track/${trackId}`);
            toast('Link disalin', 'success');
          } catch { toast('Gagal menyalin', 'error'); }
        } else if (act === 'artist') {
          const tr = await apiSafe(`tracks/${trackId}`);
          if (tr?.artists?.[0]) location.hash = `#/artist/${tr.artists[0].id}`;
        } else if (act === 'album') {
          const tr = await apiSafe(`tracks/${trackId}`);
          if (tr?.album?.id) location.hash = `#/album/${tr.album.id}`;
        }
      });
    });
  }

  async function createPlaylistFlow() {
    if (!State.user) { toast('Login untuk membuat playlist', 'warning'); return; }
    const name = prompt('Nama playlist baru:');
    if (!name?.trim()) return;
    try {
      const pl = await api(`users/${State.user.id}/playlists`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), public: false, description: 'Dibuat dari IRGXYMODS' })
      });
      toast('Playlist dibuat', 'success');
      await loadPlaylists();
      if (pl?.id) location.hash = `#/playlist/${pl.id}`;
    } catch (err) { toast('Gagal: ' + err.message, 'error'); }
  }

  async function renderQueue() {
    const body = $('#spQueueBody');
    if (!body) return;
    const data = await apiSafe('me/player/queue');
    if (!data) { body.innerHTML = '<div class="sp-drawer-empty">Login untuk melihat antrian</div>'; return; }
    const cur = data.currently_playing;
    const queue = data.queue || [];
    const items = [cur, ...queue].filter(Boolean);
    if (!items.length) { body.innerHTML = '<div class="sp-drawer-empty">Antrian kosong</div>'; return; }
    body.innerHTML = `
      <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:1px;padding:8px 4px">Sedang Diputar</div>
      ${cur ? `<div class="sp-track" data-uri="${cur.uri}">
        <div class="sp-track-img">${pickImage(cur.album?.images, 2) ? `<img src="${pickImage(cur.album?.images,2)}">` : ''}</div>
        <div class="sp-track-meta"><div class="sp-track-title">${esc(cur.name)}</div><div class="sp-track-artist">${esc(artistsStr(cur))}</div></div>
      </div>` : ''}
      <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:1px;padding:16px 4px 8px">Berikutnya</div>
      ${queue.map(t => `<div class="sp-track" data-uri="${t.uri}">
        <div class="sp-track-img">${pickImage(t.album?.images, 2) ? `<img src="${pickImage(t.album?.images,2)}">` : ''}</div>
        <div class="sp-track-meta"><div class="sp-track-title">${esc(t.name)}</div><div class="sp-track-artist">${esc(artistsStr(t))}</div></div>
      </div>`).join('')}
    `;
    body.querySelectorAll('.sp-track').forEach(el => {
      el.addEventListener('click', () => { if (el.dataset.uri) playUri(el.dataset.uri); });
    });
  }

  /* ================================================================
     USER & PLAYLISTS LOAD
     ================================================================ */
  async function loadUser() {
    const me = await apiSafe('me');
    if (!me) return false;
    State.user = me;
    LS.set('sp_user_profile', me);

    // Topbar
    $('#spUserTopbar').hidden = false;
    $('#spLoginBtn').hidden = true;
    $('#spTopbarAvatar').src = pickImage(me.images, 0) || '';
    $('#spTopbarName').textContent = me.display_name || me.id;

    // Sidebar
    $('#spUserName').textContent = me.display_name || me.id;
    $('#spUserStatus').textContent = me.product === 'premium' ? 'Premium' : (me.product || 'Free');
    const av = $('#spUserAvatar');
    if (me.images?.[0]?.url) av.innerHTML = `<img src="${me.images[0].url}" alt="">`;

    // Liked tracks cache
    const liked = await apiSafe('me/tracks?limit=50');
    if (liked?.items) liked.items.forEach(i => i.track?.id && State.likedIds.add(i.track.id));

    return true;
  }

  async function loadPlaylists() {
    const list = $('#spPlaylistList');
    if (!State.user) return;
    const data = await apiSafe('me/playlists?limit=30');
    const items = data?.items || [];
    if (!items.length) {
      list.innerHTML = `<div class="sp-sidebar-empty"><i class="fas fa-music"></i><p>Belum ada playlist</p><small>Buat playlist pertamamu</small></div>`;
      return;
    }
    list.innerHTML = items.map(p => `
      <a href="#/playlist/${p.id}" class="sp-playlist-item" data-route="playlist">
        <div class="sp-playlist-cover">${pickImage(p.images, 2) ? `<img src="${pickImage(p.images,2)}" alt="">` : '<i class="fas fa-music"></i>'}</div>
        <div class="sp-playlist-name">${esc(p.name)}</div>
      </a>
    `).join('');
  }

  /* ================================================================
     RESTORE STATE
     ================================================================ */
  function restoreVolume() {
    State.volume = LS.get('sp_volume', 0.7);
    if (typeof State.volume !== 'number' || isNaN(State.volume)) State.volume = 0.7;
  }

  /* ================================================================
     INIT
     ================================================================ */
  async function init() {
    console.log('🎵 Spotify module loading...');
    restoreVolume();

    // Show login button if not authed
    const hasToken = !!LS.get('sp_access_token', null);
    if (!hasToken) {
      $('#spLoginBtn').hidden = false;
    }

    // Handle OAuth callback
    const wasCallback = await handleCallback();

    // Validate token + load user
    if (hasToken || wasCallback) {
      const ok = await loadUser();
      if (!ok) {
        // Token invalid
        toast('Session expired, silakan login ulang', 'warning');
        $('#spLoginBtn').hidden = false;
      } else {
        await loadPlaylists();
        // Init SDK
        try { await initSDKPlayer(); }
        catch (err) { console.warn('SDK init failed:', err); }
      }
    }

    // Bind events
    bindGlobalEvents();
    bindProgressTrack();

    // Initial route
    if (!location.hash) location.hash = '#/home';
    await navigate();

    console.log('✅ Spotify module loaded (v1.0)');
  }

  /* ================================================================
     EXPORT DEBUG
     ================================================================ */
  window.SpotifyApp = {
    version: '1.0',
    debug: true,
    state: State,
    api,
    play: playUri,
    toggle: togglePlay,
    next: nextTrack,
    prev: prevTrack,
    login: loginWithSpotify,
    logout: logoutSpotify
  };

  /* ================================================================
     BOOT
     ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Cleanup on unload */
  window.addEventListener('beforeunload', () => {
    if (State.player && State.player.disconnect) {
      try { State.player.disconnect(); } catch {}
    }
  });

  window.addEventListener('error', e => {
    console.warn('[Spotify] Error:', e.message);
  });
  window.addEventListener('unhandledrejection', e => {
    console.warn('[Spotify] Promise rejected:', e.reason);
    if (String(e.reason?.message || '').includes('TOKEN_EXPIRED')) {
      toast('Session expired, login ulang', 'warning');
      setTimeout(logoutSpotify, 2000);
    }
  });
})();