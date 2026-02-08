const CACHE_NAME = 'linen-v3';
const BASE_PATH = '/linen';
const urlsToCache = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/app.js`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/favicon.svg`
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
    if (e.request.method !== 'GET' || !e.request.url.includes(BASE_PATH)) 
        return;
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => {
        if (!n || n.status !== 200 || n.type === 'error') 
            return n;
        caches
            .open(CACHE_NAME)
            .then(c => c.put(e.request, n.clone()));
        return n;
    }).catch(() => caches.match(`${BASE_PATH}/index.html`))));
});
self.addEventListener('message', e => {
    if (e.data
        ?.type === 'SKIP_WAITING') 
        self.skipWaiting();
    }
);