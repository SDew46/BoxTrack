const CACHE = 'boxtrack-v9';
const ASSETS = ['/', '/BoxTrack/', '/BoxTrack/index.html', '/BoxTrack/manifest.json', '/BoxTrack/8RB.png', '/BoxTrack/icon.png', '/BoxTrack/icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>clients.claim())); });
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
  if(!res||res.status!==200||res.type!=='basic') return res;
  const clone = res.clone();
  caches.open(CACHE).then(c=>c.put(e.request,clone));
  return res;
}).catch(()=>e.request.destination==='image'?undefined:caches.match('/BoxTrack/index.html')))));
