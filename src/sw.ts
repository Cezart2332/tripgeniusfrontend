/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<any>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
    new NavigationRoute(
        new NetworkFirst({
            cacheName: 'navigation',
            plugins: [new CacheableResponsePlugin({ statuses: [200] })]
        })
    )
)

registerRoute(
    ({ url }) => url.pathname.startsWith('/api'),
    new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }) // 24h
        ]
    })
)

// ─── Special case for Discovery trips (POST used for querying) ───────────────
registerRoute(
    ({ url }) => url.pathname.includes('/api/trip/get-trips'),
    new NetworkFirst({
        cacheName: 'api-trips-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 })
        ]
    }),
    'POST'
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