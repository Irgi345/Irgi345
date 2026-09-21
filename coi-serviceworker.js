
---

## 7. `coi-serviceworker.js` (opsional)

```js
/* coi-serviceworker.js — v1.0.0
   Fallback COOP/COEP via Service Worker untuk SharedArrayBuffer.
   Sumber referensi: https://github.com/gzuidhof/coi-serviceworker (MIT)
   Cara pakai: <script src="coi-serviceworker.js"></script> sebelum script utama.
*/
'use strict';

(function () {
  if (typeof window === 'undefined') return;
  if (window.crossOriginIsolated) return;
  if (!window.isSecureContext) return;
  if (!('serviceWorker' in navigator)) return;

  const swCode = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  event.respondWith(
    fetch(req).then((resp) => {
      if (resp.status === 0) return resp;
      const h = new Headers(resp.headers);
      h.set('Cross-Origin-Embedder-Policy', 'require-corp');
      h.set('Cross-Origin-Opener-Policy', 'same-origin');
      h.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
    }).catch((err) => new Response('Network error: ' + err, { status: 503 }))
  );
});
`;
  const blob = new Blob([swCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  navigator.serviceWorker.register(url, { scope: './' }).then((reg) => {
    if (reg.active) return;
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'activated' && !navigator.serviceWorker.controller) {
          window.location.reload();
        }
      });
    });
  }).catch((err) => console.warn('[coi-sw] register failed:', err));

  if (navigator.serviceWorker.controller) {
    // sudah aktif
  } else {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__coiReloaded) return;
      window.__coiReloaded = true;
      window.location.reload();
    });
  }
})();