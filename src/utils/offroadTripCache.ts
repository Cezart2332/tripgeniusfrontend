import type { OffroadTrip } from '../types/models'

const DB_NAME = 'offroad-trip-idb-cache'
const DB_VERSION = 1
const STORE_NAME = 'offroad-trips'

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

export async function putOffroadTrip(trip: OffroadTrip): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ ...trip, _cachedAt: Date.now() })
  } catch (err) {
    console.warn('[OffroadTripCache] put failed:', err)
  }
}

export async function putAllOffroadTrips(trips: OffroadTrip[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    trips.forEach((t) => store.put({ ...t, _cachedAt: Date.now() }))
  } catch (err) {
    console.warn('[OffroadTripCache] putAll failed:', err)
  }
}

export async function getOffroadTrip(id: string): Promise<OffroadTrip | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve((req.result as OffroadTrip) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}
