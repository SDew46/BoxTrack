// 8RB by 8 Rounds Boxing — Service Worker
// DEV: Chrome DevTools → Application → Service Workers → tick "Update on reload"
//      to bypass the SW cache during local development.

const CACHE = 'boxtrack-v17';

// Only pre-cache assets that never change between deploys.
// JS and CSS are intentionally excluded — they use network-first so code
// updates reach users immediately without requiring a cache version bump.
const STATIC_ASSETS = [
  '/BoxTrack/manifest.json',
  '/BoxTrack/8RB.webp',
  '/BoxTrack/favicon.svg',
  '/BoxTrack/icon.png',
  '/BoxTrack/icon-512.png',
];

self.addEventListener('install', e => {
  console.log('[SW] Installing', CACHE);
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_ASSETS))
      .catch(err => console.warn('[SW] Pre-cache failed (non-fatal):', err))
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] Activating', CACHE);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => { console.log('[SW] Deleting stale cache:', k); return caches.delete(k); })
      ))
      .then(() => clients.claim())
      .then(() => console.log('[SW] Active and controlling all clients'))
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ── HTML navigation: network-first, bypass HTTP cache ────────────────
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(new Request(e.request.url, { cache: 'no-cache' }))
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/BoxTrack/index.html'))
    );
    return;
  }

  // ── JS and CSS: network-first, bypass HTTP cache ──────────────────────
  // cache: 'no-cache' revalidates with the server on every request so code
  // changes propagate immediately without users needing to clear storage.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(new Request(e.request.url, { cache: 'no-cache' }))
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // ── Everything else (images, manifest): cache-first ───────────────────
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => undefined);
    })
  );
});
