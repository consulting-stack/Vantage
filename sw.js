// Vantage Business Suite — service worker
// Bump the version string to bust the cache after deploying changes.
const CACHE = 'vantage-v2';

// Only these URLs are cached and served cache-first. Everything else on the
// origin (marketing site pages) and all third-party requests (EmailJS,
// Cloudinary, fonts, CDNs) pass through to the network untouched.
const APP_SHELL = [
  '/suite.html',
  '/invoice.html',
  '/invoice-hhc.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !APP_SHELL.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
    )
  );
});
