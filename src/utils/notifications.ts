import api from "../data/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function canUsePush(): boolean {
    return Boolean(
        VAPID_PUBLIC_KEY
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window,
    )
}

async function getOrCreateBrowserSubscription(): Promise<PushSubscription | null> {
    if (!canUsePush()) return null

    const reg = await navigator.serviceWorker.ready
    if (!reg?.pushManager) return null

    let subscription = await reg.pushManager.getSubscription()
    if (subscription) return subscription

    if (Notification.permission !== 'granted') return null

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
    })
    return subscription
}

async function registerSubscriptionWithBackend(subscription: PushSubscription): Promise<void> {
    const p256dh = arrayBufferToBase64(subscription.getKey('p256dh') as ArrayBuffer | null)
    const auth = arrayBufferToBase64(subscription.getKey('auth') as ArrayBuffer | null)
    if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error('Invalid push subscription keys.')
    }

    await api.post('/api/user/subscribe-to-notifications', {
        endpoint: subscription.endpoint,
        p256dh,
        auth,
    })
}

/** Registers the device push endpoint for the signed-in user (no permission prompt if already granted). */
export async function syncPushSubscriptionForCurrentUser(): Promise<boolean> {
    if (!canUsePush()) return false
    if (Notification.permission !== 'granted') return false

    try {
        const subscription = await getOrCreateBrowserSubscription()
        if (!subscription) return false
        await registerSubscriptionWithBackend(subscription)
        return true
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Push sync error:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
            })
        } else {
            console.error('Push sync error:', error)
        }
        return false
    }
}

/** Requests notification permission if needed, then registers push for the current user. */
export async function subscribeForNotifications(): Promise<boolean> {
    if (!canUsePush()) {
        console.warn('Push notifications are not supported in this browser.');
        return false
    }

    if (Notification.permission === 'denied') {
        console.log('Notification permission denied.');
        return false
    }

    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
            console.log('Notification permission denied.');
            return false
        }
    }

    return syncPushSubscriptionForCurrentUser()
}
