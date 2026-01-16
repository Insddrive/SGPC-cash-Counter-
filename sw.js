const CACHE_NAME = 'sgpc-cash-v24';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './developer.jpg',
  './icon-192.png',
  './icon-512.png',
  // External resources (Google Fonts stylesheet + common CDN libs)
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;600;700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error('SW install cache failed:', err))
  );
});

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
    }).then(() => self.clients.claim())
  );
});

/**
 * Fetch strategy:
 * 1) Try cache first
 * 2) If not cached, fetch from network
 * 3) On successful network response, add certain responses to cache for offline use
 * 4) On failure, fallback to cached index.html (helps SPA navigation)
 */
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        // If response is invalid, just return it (do not attempt to cache)
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Decide which requests to cache at runtime
        const shouldRuntimeCache = () => {
          const url = event.request.url;
          // cache same-origin app assets and common CDNs & fonts
          return url.startsWith(self.location.origin) ||
                 url.includes('fonts.googleapis.com') ||
                 url.includes('fonts.gstatic.com') ||
                 url.includes('unpkg.com') ||
                 url.includes('cdn.tailwindcss.com') ||
                 url.includes('cdnjs.cloudflare.com');
        };
        if (shouldRuntimeCache()) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            // put may fail for opaque responses in some browsers, but we attempt it
            try { cache.put(event.request, responseClone); } catch (e) { /* ignore */ }
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed — fallback to cached index.html for navigations or root resources
        return caches.match('./index.html');
      });
    })
  );
});
