// AI Nav Service Worker v2 — 离线缓存
const CACHE = 'ainav-v25';
const PRECACHE = [
  './', './index.html', './shared.css', './shared.js',
  './knowledge.html', './vibe-coding.html', './financial-news.html',
  './manual.html', './hardware.html', './dashboards.html', './sitemap.html',
  './icon.svg', './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )));
  clients.claim();
});

self.addEventListener('fetch', e => {
  // 只缓存GET请求
  if (e.request.method !== 'GET') return;
  // API请求走网络，不缓存
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: {'Content-Type':'application/json'}
    })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
    )
  );
});
