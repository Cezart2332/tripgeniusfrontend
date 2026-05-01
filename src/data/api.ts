import axios from 'axios';
import { store } from "./store";
import { setToken, logout } from './authSlice'

const baseURL = import.meta.env.VITE_BASE_URL;

const api = axios.create({
    baseURL,
    withCredentials: true
})

function serializeData(data: unknown): unknown {
    if (data instanceof FormData) {
        const fields: Record<string, string> = {}
        data.forEach((value, key) => {
            if (value instanceof File) return // ← skip fișiere
            fields[key] = value
        })
        return { __formData: true, fields }
    }
    return data
}
function deserializeData(data: unknown): unknown {
    if (data && typeof data === 'object' && '__formData' in (data as any)) {
        const fd = new FormData()
        Object.entries((data as any).fields).forEach(([key, value]) => {
            fd.append(key, value as string)
        })
        return fd
    }
    return data
}
// ─── Offline Queue ────────────────────────────────────────────────────────────

interface QueuedRequest {
    id: string
    url: string
    method: string
    data?: unknown
    timestamp: number
}

const QUEUE_DB = 'api-offline-queue'
const QUEUE_STORE = 'requests'
const MUTATION_METHODS = ['post', 'put', 'patch', 'delete']

async function openQueueDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(QUEUE_DB, 1)
        req.onupgradeneeded = (e) => {
            (e.target as IDBOpenDBRequest).result
                .createObjectStore(QUEUE_STORE, { keyPath: 'id' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function isReallyOnline(): Promise<boolean> {
    try {
        await fetch(`${import.meta.env.VITE_BASE_URL}/api/auth/health`, {
            method: 'GET',
            cache: 'no-store',
        })
        return true
    } catch {
        return false
    }
}

async function enqueueRequest(config: QueuedRequest) {
    const db = await openQueueDB()
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    tx.objectStore(QUEUE_STORE).add(config)
}

async function dequeueRequest(id: string) {
    const db = await openQueueDB()
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    tx.objectStore(QUEUE_STORE).delete(id)
}

let isFlushing = false
export async function flushQueue() {
    if (isFlushing) return
    isFlushing = true

    try {
        const db = await openQueueDB()
        const tx = db.transaction(QUEUE_STORE, 'readonly')
        const all: QueuedRequest[] = await new Promise((resolve) => {
            const req = tx.objectStore(QUEUE_STORE).getAll()
            req.onsuccess = () => resolve(req.result)
        })

        // 1. Sortează după timestamp — primul intrat, primul trimis
        const sorted = all.sort((a, b) => a.timestamp - b.timestamp)

        // 2. Deduplică — pentru același url+method păstrează doar ultimul
        const deduped = sorted.reduce((acc, item) => {
            const key = `${item.method}:${item.url}`
            acc.set(key, item) // suprascrie cu cel mai recent
            return acc
        }, new Map<string, QueuedRequest>())

        // 3. Șterge duplicatele din IDB înainte să trimiți
        const toSend = [...deduped.values()]
        const toDelete = sorted.filter(item => !toSend.includes(item))
        for (const item of toDelete) {
            await dequeueRequest(item.id)
        }

        // 4. Trimite în ordine
        for (const item of toSend) {
            try {
                await api.request({
                    url: item.url,
                    method: item.method,
                    data: deserializeData(item.data),
                })
                await dequeueRequest(item.id)
            } catch {
                break
            }
        }
    } finally {
        isFlushing = false
    }
}

window.addEventListener('online', async () => {
    const online = await isReallyOnline()
    if (online) flushQueue()
})

// ─── Request Interceptor ──────────────────────────────────────────────────────

api.interceptors.request.use(async (config) => {
    const token = store.getState().auth.token;
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// ─── Response Interceptor ─────────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token!);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Request anulat = offline queue, nu e eroare reală
        if (axios.isCancel(error)) {
            return Promise.reject(error)
        }

        const originalRequest = error.config;
        if (!originalRequest) {
            return Promise.reject(error);
        }
        const isNetworkError = !error.response && error.code !== 'ERR_CANCELED'
        const method = (originalRequest.method ?? 'get').toLowerCase()

        if (isNetworkError && MUTATION_METHODS.includes(method)) {
            await enqueueRequest({
                id: crypto.randomUUID(),
                url: originalRequest.url!,
                method: originalRequest.method!,
                data: await serializeData(originalRequest.data),
                timestamp: Date.now(),
            })
            // Returnează un "silent" reject ca UI-ul să știe că e în queue
            return Promise.reject({ queued: true, originalRequest })
        }

        const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

        if (error.response?.status === 401 && !isRefreshCall && !originalRequest._retry) {

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers = originalRequest.headers ?? {};
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await api.post('/api/auth/refresh');
                const newToken = res.data.token;

                store.dispatch(setToken({ token: newToken }));
                originalRequest.headers = originalRequest.headers ?? {};
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                store.dispatch(logout());

                try {
                    await axios.post(`${baseURL}/api/auth/logout`, {}, { withCredentials: true });
                } catch {
                    // Ignore logout cleanup failures.
                }

                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;