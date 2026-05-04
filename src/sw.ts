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

// ─── Pre-cache all trips for offline filtering ────────────────────────────────
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


registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'images-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }) // 30 zile
        ]
    })
)

// ─── Google Fonts — Stale While Revalidate ────────────────────────────────────
registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new StaleWhileRevalidate({ cacheName: 'fonts-cache' })
)

// ─── Catch-all for other GET requests — Stale While Revalidate ────────────────
registerRoute(
    ({ request }) => request.method === 'GET',
    new StaleWhileRevalidate({
        cacheName: 'general-get-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ 
                maxEntries: 100, 
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
            })
        ]
    })
)

// ─── OpenStreetMap Tiles — Cache First ────────────────────────────────────────
registerRoute(
    ({ url }) => url.origin === 'https://tile.openstreetmap.org',
    new CacheFirst({
        cacheName: 'osm-tiles-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ 
                maxEntries: 500, 
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
            })
        ]
    })
)

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