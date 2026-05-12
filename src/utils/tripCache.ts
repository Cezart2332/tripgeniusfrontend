/**
 * tripCache.ts
 * Per-trip IndexedDB store for full Trip objects (including timelines + members).
 * This supplements the service-worker Cache Storage so that individual trip pages
 * can be loaded offline with complete data.
 */

const DB_NAME = 'trip-idb-cache'
const DB_VERSION = 1
const STORE_NAME = 'trips'

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

/** Persist a single trip (full object with timelines + members). */
export async function putTrip(trip: any): Promise<void> {
    try {
        const db = await openDB()
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put({ ...trip, _cachedAt: Date.now() })
    } catch (err) {
        console.warn('[TripCache] putTrip failed:', err)
    }
}

/** Retrieve a single trip by ID. Returns undefined if not found. */
export async function getTrip(id: string | number): Promise<any | undefined> {
    try {
        const db = await openDB()
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly')
            const req = tx.objectStore(STORE_NAME).get(String(id))
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    } catch (err) {
        console.warn('[TripCache] getTrip failed:', err)
        return undefined
    }
}

/** Retrieve all cached trips. */
export async function getAllCachedTrips(): Promise<any[]> {
    try {
        const db = await openDB()
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly')
            const req = tx.objectStore(STORE_NAME).getAll()
            req.onsuccess = () => resolve(req.result ?? [])
            req.onerror = () => reject(req.error)
        })
    } catch (err) {
        console.warn('[TripCache] getAllCachedTrips failed:', err)
        return []
    }
}

/**
 * Bulk-write an array of trips.
 * Merges with existing cached data — if a trip is already cached with full
 * timeline/member data, it won't be overwritten by a summary-only object
 * unless the summary has timelines.
 */
export async function putAllTrips(trips: any[]): Promise<void> {
    if (!trips.length) return
    try {
        const db = await openDB()
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)

        for (const trip of trips) {
            const key = String(trip.id)
            // Check if we already have a richer version (has timelines array with items)
            const existing: any = await new Promise((resolve) => {
                const r = store.get(key)
                r.onsuccess = () => resolve(r.result)
                r.onerror = () => resolve(undefined)
            })

            const incomingHasTimelines = Array.isArray(trip.timelines) && trip.timelines.length > 0
            const existingHasTimelines = existing && Array.isArray(existing.timelines) && existing.timelines.length > 0

            // Don't downgrade a rich cached entry with a summary-only entry
            if (existingHasTimelines && !incomingHasTimelines) {
                continue
            }

            store.put({ ...trip, _cachedAt: Date.now() })
        }
    } catch (err) {
        console.warn('[TripCache] putAllTrips failed:', err)
    }
}
