/**
 * SERVICE WORKER - Linen PWA
 * Offline support, caching, and /linen/ path handling
 */

const CACHE_NAME = 'linen-v3';
const BASE_PATH = '/linen';
const urlsToCache = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/app.js`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/favicon.svg`,
    `${BASE_PATH}/apple-touch-icon.png`
];

// ============================================
// INSTALL EVENT - cache assets
// ============================================

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.error('Service Worker install failed:', err))
    );
    self.skipWaiting(); // immediately activate new SW
});

// ============================================
// ACTIVATE EVENT - clean old caches
// ============================================

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => 
            Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) return caches.delete(name);
                })
            )
        )
    );
    self.clients.claim(); // take control immediately
});

// ============================================
// FETCH EVENT - offline-first strategy
// ============================================

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    // Only intercept requests under /linen/
    if (!event.request.url.includes(BASE_PATH)) return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) return cachedResponse;

                return fetch(event.request)
                    .then(networkResponse => {
                        // Only cache successful GET responses
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                            return networkResponse;
                        }

                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });

                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback to offline page (index.html)
                        return caches.match(`${BASE_PATH}/index.html`);
                    });
            })
    );
});

// ============================================
// MESSAGE HANDLER - for skipWaiting updates
// ============================================

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});