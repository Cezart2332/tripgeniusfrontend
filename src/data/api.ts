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
    
    // Dacă Axios a serializat deja datele în string, încercăm să le punem înapoi în obiect
    // pentru ca la re-trimitere Axios să poată seta corect Content-Type: application/json
    if (typeof data === 'string') {
        try {
            return JSON.parse(data)
        } catch {
            return data
        }
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
        // Folosim un timeout scurt pentru a nu bloca UI-ul prea mult
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        await fetch(`${import.meta.env.VITE_BASE_URL}/api/auth/health`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        })
        clearTimeout(timeoutId)
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

        if (all.length === 0) return

        const sorted = all.sort((a, b) => a.timestamp - b.timestamp)

        for (const item of sorted) {
            try {
        await api.request({
                    url: item.url,
                    method: item.method,
                    data: deserializeData(item.data),
                    // Marcăm cererea ca fiind din queue pentru a nu o re-adăuga în caz de eroare de rețea
                    ...({ _fromQueue: true } as any)
                })
                // Ștergem din queue DOAR dacă cererea a ajuns la server și a fost procesată (succes sau eroare 4xx/5xx)
                await dequeueRequest(item.id)
            } catch (error: any) {
                const isNetworkError = !error.response && error.code !== 'ERR_CANCELED'
                
                if (isNetworkError) {
                    // Dacă e eroare de rețea, oprim procesarea cozii (încă suntem offline)
                    break
                } else {
                    // Dacă e eroare de la server (ex: 400 Bad Request, 500 Server Error), 
                    // scoatem cererea din queue pentru a nu bloca restul cozii la infinit.
                    await dequeueRequest(item.id)
                }
            }
        }
    } catch (e) {
        console.error('Error flushing offline queue:', e)
    } finally {
        isFlushing = false
    }
}

window.addEventListener('online', async () => {
    const online = await isReallyOnline()
    if (online) flushQueue()
})

/**
 * Updates the browser's Cache Storage (api-cache) for a specific GET request.
 * Useful for optimistic UI updates when offline.
 */
export async function updateCachedResponse(url: string, data: any) {
    if (!('caches' in window)) return

    try {
        const cache = await caches.open('api-cache')
        const fullUrl = url.startsWith('http') ? url : `${baseURL}/${url.startsWith('/') ? url.slice(1) : url}`
        
        // Construct a new response with the provided data
        const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
            statusText: 'OK'
        })
        
        await cache.put(fullUrl, response)
        console.log(`[Cache Sync] Updated ${fullUrl} with optimistic data.`)
    } catch (err) {
        console.error('[Cache Sync] Failed to update cache:', err)
    }
}

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
    (response) => {
        // Dacă o cerere reușește, înseamnă că suntem online, deci încercăm să golim coada.
        flushQueue()
        return response
    },
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

        // Nu re-adăugăm în queue dacă cererea provine deja din flushQueue
        if (isNetworkError && MUTATION_METHODS.includes(method) && !originalRequest._fromQueue) {
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