// 8RB by 8 Rounds Boxing — Service Worker
// DEV: Chrome DevTools → Application → Service Workers → tick "Update on reload"
//      to bypass the SW cache during local development.

const CACHE = 'boxtrack-v14';

// Static assets pre-cached on install.
// index.html is intentionally excluded — it is fetched network-first on
// every navigation so content updates are visible without a cache wipe.
const STATIC_ASSETS = [
  '/BoxTrack/manifest.json',
  '/BoxTrack/8RB.png',
  '/BoxTrack/icon.png',
  '/BoxTrack/icon-512.png',
  '/BoxTrack/styles.css',
  '/BoxTrack/firebase.js',
  '/BoxTrack/data.js',
  '/BoxTrack/app.js',
  '/BoxTrack/train.js',
  '/BoxTrack/box.js',
  '/BoxTrack/progress.js',
  '/BoxTrack/admin.html',
];

self.addEventListener('install', e => {
  console.log('[SW] Installing', CACHE);
  // Skip the waiting phase immediately so the new SW activates on the
  // next clients.claim() without requiring all tabs to close first.
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
      // Take control of all open clients immediately after activation.
      // This triggers controllerchange on each client, which the page
      // uses to reload and pick up the latest content.
      .then(() => clients.claim())
      .then(() => console.log('[SW] Active and controlling all clients'))
  );
});

self.addEventListener('fetch', e => {
  // ── HTML navigation: network-first ───────────────────────────────────
  // Always try the network so the user gets the latest index.html after
  // a push, even if sw.js itself didn't change between deploys.
  // Falls back to the cached copy when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/BoxTrack/index.html'))
    );
    return;
  }

  // ── Everything else: cache-first ─────────────────────────────────────
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
