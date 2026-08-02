// ─────────────────────────────────────────────────────────────
// Attendo Service Worker
// App shell (HTML/CSS/JS) is network-first so a Netlify deploy
// shows up on next load — cache is only a fallback for offline.
// Truly static assets (icons, fonts, CDN libs) stay cache-first.
// Bump CACHE_VER only if you need to force-evict old caches.
// ─────────────────────────────────────────────────────────────
const CACHE_VER = 'v4';
const SHELL     = 'attendo-shell-' + CACHE_VER;
const EXT       = 'attendo-ext-'   + CACHE_VER;

const APP_SHELL = [
  './index.html',
  './setup.html',
  './stats.html',
  './css/theme.css',
  './js/utils.js',
  './js/storage.js',
  './js/dashboard.js',
  './js/setup.js',
  './js/stats.js',
  './js/pwa.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Requests matching these get network-first treatment (app shell —
// changes on every deploy). Everything else same-origin (icons, etc.)
// is cache-first since it almost never changes.
const NETWORK_FIRST_EXT = /\.(?:html|js|css|json)$/;

const EXT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(cache =>
      // Cache each asset individually — one miss won't break the whole install
      Promise.allSettled(APP_SHELL.map(url =>
        cache.add(url).catch(() => {/* non-fatal */})
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== EXT).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() =>
        // Tell every open tab a new version just activated
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
      )
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  if (EXT_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(cacheFirst(req, EXT));
    return;
  }

  if (url.origin === self.location.origin) {
    const isShellAsset = req.mode === 'navigate' || NETWORK_FIRST_EXT.test(url.pathname);
    event.respondWith(isShellAsset ? networkFirst(req, SHELL) : cacheFirst(req, SHELL));
    return;
  }
});

// Always try the network first so deploys show up immediately;
// fall back to cache when offline (and to index.html for navigations).
async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// Serve from cache when available; otherwise fetch and cache for next time.
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// ── MESSAGES ─────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
