/**
 * Linen — Personal AI Assistant
 * Copyright (c) 2025-2026 Ramin Najafi. All Rights Reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE file for details.
 */

const CACHE_NAME = 'linen-v115';
const BASE_PATH = '/linen';
const urlsToCache = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/app.js`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/logo.png`,
    `${BASE_PATH}/icon-192.png`,
    `${BASE_PATH}/icon-512.png`
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.addAll(urlsToCache))
            .catch(err => console.error('Cache install error:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(names =>
            Promise.all(names.map(n => n !== CACHE_NAME ? caches.delete(n) : null))
        )
    );
    self.clients.claim();
});

// Network-first strategy: always try network, fall back to cache
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    if (!e.request.url.includes(BASE_PATH)) return;

    // Skip API calls
    if (e.request.url.includes('googleapis.com')) return;

    e.respondWith(
        fetch(e.request)
            .then(response => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                return response;
            })
            .catch(() => caches.match(e.request).then(r => r || caches.match(`${BASE_PATH}/index.html`)))
    );
});

self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
