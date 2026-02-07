/**
 * SERVICE WORKER - Offline Support & Caching
 * Handles /linen/ subdirectory on GitHub Pages
 */

const CACHE_NAME = 'linen-v2';
const BASE_PATH = '/linen';
const urlsToCache = [
    BASE_PATH + '/',
    BASE_PATH + '/index.html',
    BASE_PATH + '/styles.css',
    BASE_PATH + '/app.js',
    BASE_PATH + '/manifest.json',
    BASE_PATH + '/favicon.svg',
    BASE_PATH + '/apple-touch-icon.png'
];

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.log('Cache installation failed:', error);
            })
    );
    self.skipWaiting();
});

// ============================================
// ACTIVATE EVENT
// ============================================

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

// ============================================
// FETCH EVENT - Offline-First Strategy
// ============================================

self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip requests outside /linen/ path
    if (!event.request.url.includes(BASE_PATH)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Fallback to index.html for offline navigation
                        return caches.match(BASE_PATH + '/index.html');
                    });
            })
    );
});

// ============================================
// MESSAGE HANDLING
// ============================================

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
