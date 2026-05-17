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

export async function subscribeForNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser.');
        return;
    }

    if (!VAPID_PUBLIC_KEY) {

        console.error('VITE_VAPID_PUBLIC_KEY is not defined in environment variables.');
        return;
    }

    try {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Notification permission denied.');
            return;
        }

        const reg = await navigator.serviceWorker.ready;
        if (!reg) {
            console.error('Service worker is not ready.');
            return;
        }

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });

        await api.post('/api/user/subscribe-to-notifications', { endpoint: subscription.endpoint, p256dh: arrayBufferToBase64(subscription.getKey("p256dh") as ArrayBuffer | null), auth: arrayBufferToBase64(subscription.getKey("auth") as ArrayBuffer | null) });
        console.log('Successfully subscribed to notifications.');
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Push subscribe error:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
            })
        } else {
            console.error('Push subscribe error:', error)
        }
    }
}
