const APP_CACHE = 'nsk-warrior-cache-v013';
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
    '/api/serve-game/scph5501.bin?key=bios',
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
    
    // --- SPECIAL HANDLER: Game Assets ---
    if (decodedPath.includes('/api/serve-game')) {
        
        event.respondWith(async function() {
            const cache = await caches.open(APP_CACHE);
            
            // A. HANDLE HEAD REQUESTS (Bios check, etc.)
            // We assume the file is either pre-cached (BIOS) or lazy-cached (ROM)
            if (event.request.method === 'HEAD') {
                const cachedResponse = await cache.match(event.request, { ignoreVary: true, ignoreMethod: true });
                if (cachedResponse) {
                    return new Response(null, {
                        status: 200,
                        statusText: 'OK',
                        headers: cachedResponse.headers
                    });
                }
                // If not in cache, we return 404 to indicate "Not Offline Ready Yet"
                return new Response(null, { status: 404, statusText: 'Not Cached' });
            }
            
            // B. HANDLE GET REQUESTS (The ROM download)
            if (event.request.method === 'GET') {
                // 1. Check Cache
                const cachedResponse = await cache.match(event.request, { ignoreVary: true });
                if (cachedResponse) return cachedResponse;
                
                // 2. Fetch from Network (Lazy Load for ROM)
                try {
                    const networkResponse = await fetch(event.request);
                    if (!networkResponse || networkResponse.status !== 200) return networkResponse;
                    
                    // 3. Tee Strategy (Stream to Cache + Game)
                    const [stream1, stream2] = networkResponse.body.tee();
                    const headers = new Headers(networkResponse.headers);
                    headers.delete('Vary');
                    
                    const responseForCache = new Response(stream2, {
                        status: 200,
                        headers: headers
                    });
                    
                    event.waitUntil(cache.put(event.request, responseForCache));
                    
                    return new Response(stream1, {
                        status: 200,
                        headers: networkResponse.headers
                    });
                } catch (e) {
                    console.error("Fetch failed:", e);
                    throw e;
                }
            }
        }());
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