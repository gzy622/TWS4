const CACHE_VERSION = 'tws4-runtime-v1';
const FONT_CACHE = 'tws4-fonts-v1';

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key.startsWith('tws4-') && key !== CACHE_VERSION && key !== FONT_CACHE)
                .map(key => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const isFontAsset = url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/css/fonts/');
    if (isFontAsset) {
        event.respondWith(cacheFirst(request, FONT_CACHE));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (['style', 'script', 'image'].includes(request.destination)) {
        event.respondWith(staleWhileRevalidate(request));
    }
});

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const update = fetch(request).then(async response => {
        if (response.ok) await cache.put(request, response.clone());
        return response;
    }).catch(() => null);
    if (cached) return cached;
    return (await update) || Response.error();
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    } catch (_) {
        return (await cache.match(request)) || Response.error();
    }
}
