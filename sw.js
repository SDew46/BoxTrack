const CACHE = 'boxtrack-v6';
const ASSETS = ['/', '/BoxTrack/', '/BoxTrack/index.html', '/BoxTrack/manifest.json'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>clients.claim())); });
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
  if(!res||res.status!==200||res.type!=='basic') return res;
  const clone = res.clone();
  caches.open(CACHE).then(c=>c.put(e.request,clone));
  return res;
}).catch(()=>caches.match('/BoxTrack/index.html')))));
