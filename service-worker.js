const APP_CACHE = 'nsk-warrior-cache-v007';
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
            // We can silently fail on individual files to prevent the whole install from breaking
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
                // A. Try Cache First (ignoring Vary header for safety)
                const cache = await caches.open(APP_CACHE);
                const cachedResponse = await cache.match(event.request, { ignoreVary: true }); // <--- FIX 1
                
                if (cachedResponse) {
                    return cachedResponse;
                }

                // B. Network Fallback
                try {
                    const networkResponse = await fetch(event.request);
                    
                    // Only cache valid full downloads (Status 200), not partials (206) or errors
                    if (networkResponse.status === 200) {
                        
                        // C. Create a "Clean" Response for the Cache (Strip 'Vary' header)
                        // We must recreate the response to modify headers
                        const responseToCache = new Response(networkResponse.clone().body, {
                            status: networkResponse.status,
                            statusText: networkResponse.statusText,
                            headers: new Headers(networkResponse.headers)
                        });
                        
                        // FIX 2: Delete the Vary header so offline matching works
                        responseToCache.headers.delete('Vary'); 

                        // FIX 3: Don't await this! Use waitUntil to run it in background
                        // This lets the game load while the cache writes to disk
                        event.waitUntil(
                            cache.put(event.request, responseToCache)
                                .catch(err => console.warn('Background cache failed:', err))
                        );
                    }
                    
                    return networkResponse;
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
                     // Check if valid to cache (skip non-GET, non-200)
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
