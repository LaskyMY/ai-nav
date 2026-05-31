const CACHE = 'ai-nav-v3';
const ASSETS = ['./icon.svg','./manifest.json'];

// Fetch version.json and compare with stored version
async function checkVersion() {
  try {
    const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: 'version-check', version: data.version });
    }
  } catch(e) {}
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
  // Check version on activation
  e.waitUntil(checkVersion());
});

// Periodic version check (every 3 minutes)
setInterval(checkVersion, 180000);

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
