const APP_CACHE = 'nsk-warrior-cache-v009';
const networkFirstFiles = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/booklet/booklet.css',
    '/booklet/booklet.js',
    '/booklet/pages/2.webp',
    '/spa-manager.js',
    '/gamepad.js',
    '/loading-ring.js',
    '/images/bearing.gif',
    '/versions/keen-fine/RPG Maker (USA).state',
    '/versions/test-play/RPG Maker (USA).state'
];

// Pre-cache list
const urlsToCache = [
    '/',
    '/images/NSK_Warrior_title.mp4',
    '/booklet/booklet.css',
    '/booklet/booklet.js',
    '/booklet/jquery-3.7.1.min.js',
    '/booklet/panzoom.min.js',
    '/booklet/turn.min.js',
    '/booklet/manual_icon.webp',
    '/booklet/sounds/page_turn.mp3',
    '/booklet/sounds/slide_in.mp3',
    '/booklet/sounds/slide_out.mp3',
    '/booklet/pages/1.webp',
    '/booklet/pages/2.webp',
    '/booklet/pages/3.webp',
    '/booklet/pages/4.webp',
    '/booklet/pages/5.webp',
    '/booklet/pages/6.webp',
    '/booklet/pages/7.webp',
    '/booklet/pages/8.webp',
    '/booklet/pages/9.webp',
    '/booklet/pages/10.webp',
    '/booklet/pages/11.webp',
    '/booklet/pages/12.webp',
    '/booklet/pages/13.webp',
    '/booklet/pages/14.webp',
    '/booklet/pages/15.webp',
    '/booklet/pages/16.webp',
    '/booklet/pages/17.webp',
    '/booklet/pages/18.webp',
    '/booklet/pages/19.webp',
    '/booklet/pages/20.webp'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(APP_CACHE).then(cache => {
            // Silently fail on individual files to prevent the whole install from breaking
            return Promise.all(
                urlsToCache.map(url => {
                    return fetch(url).then(response => {
                        if (!response || !response.ok) {
                            console.warn('Failed to pre-cache:', url);
                            return;
                        }
                        return cache.put(url, response);
                    }).catch(err => console.warn('Pre-cache fetch failed:', url));
                })
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== APP_CACHE)
                .map(key => caches.delete(key))
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    const decodedPath = decodeURI(requestUrl.pathname);
    
    // --- 1. SPECIAL HANDLER: Game Assets (ROM/BIOS) ---
    if (decodedPath.includes('/api/serve-game') || decodedPath.includes('.netlify/functions')) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(APP_CACHE);
                
                // 1. Try Cache First (Fastest)
                // 'ignoreVary' fixes the offline "Network Error"
                const cachedResponse = await cache.match(event.request, { ignoreVary: true });
                if (cachedResponse) return cachedResponse;
                
                // 2. Network Fallback
                try {
                    const networkResponse = await fetch(event.request);
                    
                    // If the response is not valid (e.g. 404 or 500), return it as-is
                    if (!networkResponse || networkResponse.status !== 200) {
                        return networkResponse;
                    }
                    
                    // 3. The "Tee" Trick
                    // Instead of cloning (which buffers), we split the stream.
                    // stream1 = for the browser/game (immediate)
                    // stream2 = for the cache (background)
                    const [stream1, stream2] = networkResponse.body.tee();
                    
                    // 4. Construct a response for the cache
                    // We create a new Response using stream2 and the original headers.
                    // We DELETE the 'Vary' header to prevent future offline issues.
                    const headers = new Headers(networkResponse.headers);
                    headers.delete('Vary');
                    
                    const responseForCache = new Response(stream2, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: headers
                    });
                    
                    // 5. Cache in Background
                    // event.waitUntil keeps the SW alive without blocking the game response
                    event.waitUntil(
                        cache.put(event.request, responseForCache)
                        .catch(err => console.warn('Cache write failed:', err))
                    );
                    
                    // 6. Return response to Game IMMEDIATELY
                    // The game reads stream1. It doesn't have to wait for the cache!
                    return new Response(stream1, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: networkResponse.headers
                    });
                    
                } catch (error) {
                    console.error("Fetch failed:", error);
                    throw error;
                }
            })()
        );
        return;
    }
    
    // --- 2. NETWORK FIRST FILES ---
    if (networkFirstFiles.includes(decodedPath)) {
        event.respondWith(
            fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.ok && event.request.method === 'GET') {
                    const responseClone = networkResponse.clone();
                    caches.open(APP_CACHE).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request);
            })
        );
    }
    // --- 3. CACHE FIRST (Default for everything else) ---
    else {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    
                    if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(APP_CACHE).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                });
            })
        );
    }
});