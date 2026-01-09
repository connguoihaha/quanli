const CACHE_NAME = 'qlkh-v5.0.1';
const STATIC_RESOURCES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
];

const FIREBASE_SDKS = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Opened cache');
      
      // 1. Cache Static Resources (Simple)
      await cache.addAll(STATIC_RESOURCES);

      // 2. Cache Firebase Modules (Strict CORS)
      // Important: ES Modules require non-opaque responses.
      const sdkPromises = FIREBASE_SDKS.map(async (url) => {
          const request = new Request(url, { mode: 'cors' });
          try {
            const response = await fetch(request);
            if(response.ok) {
                await cache.put(request, response);
            }
          } catch (err) {
              console.error('Failed to cache SDK:', url, err);
          }
      });
      await Promise.all(sdkPromises);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Strategy: Cache First, falling back to Network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Check if it's a Font file (often requested by CSS) -> Runtime Cache
      // Fonts usually end in .woff2, .ttf or come from gstatic related to fonts
      if (request.url.includes('fonts.gstatic.com') || 
          request.url.endsWith('.woff2') || 
          request.url.endsWith('.ttf')) {
            return fetch(request).then(response => {
                // Check if valid reference
                if(!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
                return response;
            });
      }

      return fetch(request);
    }).catch(() => {
        // Fallback for navigation requests (e.g. offline reload)
        if (request.mode === 'navigate') {
            return caches.match('./index.html');
        }
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});
