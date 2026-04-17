// Auction Packed — Service Worker
// Cache strategy: cache-first for the app shell, network-first for API calls

const CACHE_NAME = 'auction-packed-v1';

// Files to pre-cache on install (the app shell)
const PRECACHE_URLS = [
  './',
  './index.html'
];

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache when offline, always try network for API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, CricAPI, ESPN, or Google Fonts — always live
  const isExternal = (
    url.hostname.includes('firebase') ||
    url.hostname.includes('cricapi') ||
    url.hostname.includes('espncricinfo') ||
    url.hostname.includes('rapidapi') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('fonts.gstatic') ||
    url.hostname.includes('gstatic')
  );

  if (isExternal) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For same-origin requests: serve from cache, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful same-origin GET responses
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
