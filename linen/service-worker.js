const CACHE_NAME = 'linen-v4';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/favicon.svg'
];
self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)).catch(err => console.error(err)));
    self.skipWaiting();
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(names => Promise.all(names.map(n => n !== CACHE_NAME
        ? caches.delete(n)
        : null))));
    self
        .clients
        .claim();
});
self.addEventListener('fetch', e => {
    const { request } = e;
    const url = new URL(request.url);

    // Always go to network for non-GET requests
    if (request.method !== 'GET') {
        e.respondWith(fetch(request));
        return;
    }

    // Network-first for HTML, JS, CSS
    if (url.pathname === '/index.html' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        e.respondWith(
            fetch(request)
                .then(response => {
                    // If network request succeeds, update cache and return response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // If network request fails, try to serve from cache
                    return caches.match(request).then(response => {
                        return response || caches.match('/index.html'); // Fallback to index.html
                    });
                })
        );
        return;
    }

    // Cache-first for other static assets (e.g., manifest, favicon)
    e.respondWith(
        caches.match(request).then(response => {
            return response || fetch(request).then(networkResponse => {
                const networkResponseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, networkResponseClone);
                });
                return networkResponse;
            });
        })
    );
});
self.addEventListener('message', e => {
    if (e.data
        ?.type === 'SKIP_WAITING') 
        self.skipWaiting();
    }
);