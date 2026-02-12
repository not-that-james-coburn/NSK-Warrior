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
        console.log(`[SW] Intercepted Game Asset: ${decodedPath}`);

        event.respondWith(
            (async () => {
                const cache = await caches.open(APP_CACHE);
                
                // STEP A: Try Cache First (Restores Offline Play)
                // We ignore 'Vary' to ensure offline matching works even if headers changed
                const cachedResponse = await cache.match(event.request, { ignoreVary: true });
                
                if (cachedResponse) {
                    console.log(`[SW] Found in Cache: ${decodedPath}`);
                    return cachedResponse;
                }

                console.log(`[SW] Not in cache. Fetching from network: ${decodedPath}`);

                // STEP B: Network Fallback (First-time Load)
                try {
                    const networkResponse = await fetch(event.request);
                    
                    // Validate response
                    if (!networkResponse || networkResponse.status !== 200) {
                        console.warn(`[SW] Network error or 404: ${networkResponse ? networkResponse.status : 'Null'}`);
                        return networkResponse;
                    }

                    console.log(`[SW] Network success. Starting 'tee()' stream...`);

                    // STEP C: The "Tee" Strategy (Splits stream to avoid waiting)
                    // stream1 -> Goes to Browser immediately
                    // stream2 -> Goes to Cache in background
                    const [stream1, stream2] = networkResponse.body.tee();

                    // Create a cache-friendly response (No 'Vary' header)
                    const headers = new Headers(networkResponse.headers);
                    headers.delete('Vary');
                    
                    const responseForCache = new Response(stream2, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: headers
                    });

                    // Cache in background
                    event.waitUntil(
                        cache.put(event.request, responseForCache)
                            .then(() => console.log(`[SW] Background caching complete: ${decodedPath}`))
                            .catch(err => console.error(`[SW] Cache write failed:`, err))
                    );

                    // Return stream to game immediately
                    return new Response(stream1, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: networkResponse.headers
                    });

                } catch (error) {
                    console.error(`[SW] Network Request Failed (Offline?):`, error);
                    // If we are here, it means we are offline AND it wasn't in the cache.
                    // We can't do anything else.
                    throw error;
                }
            })()
        );
        return;
    }

    // --- 2. NETWORK FIRST FILES ---
    if (networkFirstFiles.includes(decodedPath)) {
        event.respondWith(
            fetch(event.request, { cache: 'reload' })
            .then(networkResponse => {
                if (networkResponse && networkResponse.ok && event.request.method === 'GET') {
                    const responseClone = networkResponse.clone();
                    caches.open(APP_CACHE).then(cache => cache.put(event.request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                console.log(`[SW] Network failed for ${decodedPath}, checking cache...`);
                return caches.match(event.request);
            })
        );
    } 
    // --- 3. CACHE FIRST (Default) ---
    else {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                        const responseToCache = networkResponse.clone();
                        caches.open(APP_CACHE).then(cache => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                });
            })
        );
    }
});
