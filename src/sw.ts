/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<any>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigation Route — serve index.html for all navigation requests (SPA support)
// We try NetworkFirst but fallback to the cached index.html immediately if offline
const navigationHandler = new NetworkFirst({
    cacheName: 'navigation',
    networkTimeoutSeconds: 3,
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
    ],
})

registerRoute(
    new NavigationRoute(async (params) => {
        try {
            const res = await navigationHandler.handle(params)
            if (res) return res
        } catch (e) {
            // offline or error
        }
        
        // Try to match the precached index.html
        const match = await caches.match('/index.html') || await caches.match('index.html')
        if (match) return match

        // Last resort fallback via createHandlerBoundToURL
        try {
            return await createHandlerBoundToURL('index.html')(params)
        } catch (e) {
            return Response.error()
        }
    })
)

// ─── Assets (CSS/JS) — Cache First ───────────────────────────────────────────
registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new CacheFirst({
        cacheName: 'assets-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
        ]
    })
)

// ─── All-trips list — Stale While Revalidate (discovery + offline fallback) ───
registerRoute(
    ({ url }) => url.pathname.includes('/api/trip/get-all-trips'),
    new StaleWhileRevalidate({
        cacheName: 'all-trips-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 }) // 24h
        ]
    })
)

// ─── Individual trip — Network First (full data with timelines + members) ─────
registerRoute(
    ({ url, request }) =>
        request.method === 'GET' &&
        /\/api\/trip\/get-trip\//.test(url.pathname),
    new NetworkFirst({
        cacheName: 'individual-trip-cache',
        networkTimeoutSeconds: 5,
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }) // 7 days
        ]
    })
)

// ─── Trip messages — Network First ───────────────────────────────────────────
registerRoute(
    ({ url, request }) =>
        request.method === 'GET' &&
        url.pathname.includes('/api/trip/get-messages/'),
    new NetworkFirst({
        cacheName: 'trip-messages-cache',
        networkTimeoutSeconds: 5,
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }) // 24h
        ]
    })
)

// ─── General API GETs — Network First (catch-all for remaining /api/* GETs) ──
registerRoute(
    ({ url, request }) => url.pathname.startsWith('/api') && request.method === 'GET',
    new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }) // 24h
        ]
    })
)

// ─── Images — Cache First ─────────────────────────────────────────────────────
registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'images-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }) // 30 days
        ]
    })
)

// ─── Map Tiles (CartoDB dark theme) — Cache First ─────────────────────────────
// Must be BEFORE the general-get-cache catch-all to use its own dedicated bucket
registerRoute(
    ({ url }) =>
        url.origin === 'https://tile.openstreetmap.org' ||
        url.hostname.endsWith('basemaps.cartocdn.com') ||
        url.hostname.endsWith('cartocdn.com'),
    new CacheFirst({
        cacheName: 'map-tiles-cache',
        plugins: [
            // status 0 = opaque response from cross-origin tile servers
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 2000,          // ≈ full city view worth of tiles
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                purgeOnQuotaError: true,   // auto-evict if storage is full
            })
        ]
    })
)

// ─── OpenTripMap Attractions — Cache First (7 days) ───────────────────────────
// The usePlaces hook + placesCache.ts already manage IndexedDB-level caching;
// this SW route provides an additional HTTP-level cache layer so the network
// request itself is cached and survives offline even if IndexedDB is cleared.
registerRoute(
    ({ url }) => url.hostname === 'api.opentripmap.com',
    new CacheFirst({
        cacheName: 'attractions-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 200,                      // 200 distinct bounding-box queries
                maxAgeSeconds: 60 * 60 * 24 * 7,      // 7 days
                purgeOnQuotaError: true,
            })
        ]
    })
)

// ─── OSRM Routing — Network First with offline fallback ──────────────────────
registerRoute(
    ({ url }) => url.origin === 'https://router.project-osrm.org',
    async ({ request }) => {
        const cacheName = 'routes-cache-v1';

        // Network-first: try to fetch and cache the fresh route
        if (navigator.onLine) {
            try {
                const response = await fetch(request);
                const cache = await caches.open(cacheName);
                cache.put(request, response.clone());
                return response;
            } catch {
                // fetch failed despite being online — fall through to cache
            }
        }

        // Offline or failed: serve cached route if available
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // Nothing cached — graceful JSON error
        return new Response(
            JSON.stringify({
                code: 'OFFLINE',
                message: 'You are offline and no cached route exists for this destination.',
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
);

// ─── MapLibre GL Assets — Cache First ────────────────────────────────────────
registerRoute(
    ({ url }) => url.pathname.includes('maplibre-gl'),
    new CacheFirst({
        cacheName: 'maplibre-assets-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] })
        ]
    })
)

// ─── Google Fonts — Stale While Revalidate ────────────────────────────────────
registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new StaleWhileRevalidate({ cacheName: 'fonts-cache' })
)

// ─── Catch-all for other GET requests — Stale While Revalidate ────────────────
// Must stay LAST so all specific routes above are matched first
registerRoute(
    ({ request }) => request.method === 'GET',
    new StaleWhileRevalidate({
        cacheName: 'general-get-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
            })
        ]
    })
)

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
    const data = event.data?.json() ?? {}
    event.waitUntil(
        self.registration.showNotification(data.title ?? 'TripGenius', {
            body: data.body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { url: data.url ?? '/app' },
        })
    )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close()
    event.waitUntil(
        self.clients.openWindow(event.notification.data.url)
    )
})