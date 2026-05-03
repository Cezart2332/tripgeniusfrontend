/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<any>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigate fallback
self.addEventListener('fetch', (event: FetchEvent) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() =>
                caches.match('/index.html').then(r => r!)
            )
        )
    }
})

// ← Push handler
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