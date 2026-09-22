const CACHE_NAME = 'aziiki-v1-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install service worker and cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // Ignore cache failures on install
      });
    })
  );
  self.skipWaiting();
});

// Activate and cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch with cache-first strategy for static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache GET requests
  if (request.method !== 'GET') return;

  // Cache-first for assets
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        });
      }).catch(() => {
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Network-first for API calls
  event.respondWith(
    fetch(request).then(response => {
      if (!response || response.status !== 200) return response;
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseClone);
      });
      return response;
    }).catch(() => {
      return caches.match(request).then(response => {
        return response || new Response('Offline', { status: 503 });
      });
    })
  );
});
