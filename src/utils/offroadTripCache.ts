import type { OffroadTrip, OffroadRoute } from '../types/models'
import { prefetchMapTilesForTrack } from './mapTilePrefetch'

const DB_NAME = 'offroad-trip-idb-cache'
const DB_VERSION = 2
const STORE_NAME = 'offroad-trips'
const ROUTES_STORE = 'offroad-routes'

interface CachedRouteRow {
  cacheKey: string
  route: OffroadRoute
  cachedAt: number
}

function routeCacheKey(tripId: string, routeId: number) {
  return `${tripId}:${routeId}`
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(ROUTES_STORE)) {
        db.createObjectStore(ROUTES_STORE, { keyPath: 'cacheKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Trip + every route (full GPX GeoJSON) + map tiles for offline navigation. */
export async function cacheOffroadTripForOffline(trip: OffroadTrip): Promise<void> {
  await putOffroadTrip(trip)
  const tripKey = String(trip.id)
  if (trip.routes?.length) {
    await Promise.all(trip.routes.map((r) => putOffroadRoute(tripKey, r)))
    void prefetchOffroadTilesForRoutes(trip.routes)
  }
}

/** Single route row + merge into cached trip + tile prefetch (start + full track). */
export async function cacheOffroadRouteForOffline(tripId: string, route: OffroadRoute): Promise<void> {
  await putOffroadRoute(tripId, route)
  await mergeRouteIntoCachedTrip(tripId, route)
  void prefetchMapTilesForTrack(route.trackGeoJson, {
    styles: ['topo', 'carto'],
    prefetchStartZooms: [13, 14, 15, 16],
  })
}

async function prefetchOffroadTilesForRoutes(routes: OffroadRoute[]): Promise<void> {
  for (const route of routes) {
    await prefetchMapTilesForTrack(route.trackGeoJson, {
      styles: ['topo', 'carto'],
      prefetchStartZooms: [13, 14, 15, 16],
      maxTiles: 180,
    })
  }
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
    void prefetchOffroadTilesForTripsList(trips)
  } catch (err) {
    console.warn('[OffroadTripCache] putAll failed:', err)
  }
}

/** Prefetch tiles for the first navigable route per trip (discovery list). */
async function prefetchOffroadTilesForTripsList(trips: OffroadTrip[]): Promise<void> {
  for (const trip of trips.slice(0, 12)) {
    const route = trip.routes?.find((r) => r.trackGeoJson?.includes('coordinates'))
    if (!route) continue
    await prefetchMapTilesForTrack(route.trackGeoJson, {
      styles: ['topo'],
      minZoom: 9,
      maxZoom: 13,
      maxTiles: 80,
      prefetchStartZooms: [13, 14],
    })
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

/** Persist a single route (full track GeoJSON) for offline editor + map fallback. */
export async function putOffroadRoute(tripId: string, route: OffroadRoute): Promise<void> {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(ROUTES_STORE)) return
    const row: CachedRouteRow = {
      cacheKey: routeCacheKey(tripId, route.id),
      route: { ...route },
      cachedAt: Date.now(),
    }
    const tx = db.transaction(ROUTES_STORE, 'readwrite')
    tx.objectStore(ROUTES_STORE).put(row)
  } catch (err) {
    console.warn('[OffroadTripCache] put route failed:', err)
  }
}

export async function getOffroadRoute(tripId: string, routeId: string): Promise<OffroadRoute | null> {
  try {
    const idNum = Number(routeId)
    if (Number.isNaN(idNum)) return null
    const db = await openDB()
    if (!db.objectStoreNames.contains(ROUTES_STORE)) return null
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction(ROUTES_STORE, 'readonly')
        .objectStore(ROUTES_STORE)
        .get(routeCacheKey(tripId, idNum))
      req.onsuccess = () => {
        const row = req.result as CachedRouteRow | undefined
        resolve(row?.route ?? null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/** Keep the cached full trip in sync so the trip map shows the latest track offline. */
export async function mergeRouteIntoCachedTrip(tripId: string, route: OffroadRoute): Promise<void> {
  try {
    const trip = await getOffroadTrip(tripId)
    if (!trip) return
    const idx = trip.routes.findIndex((r) => r.id === route.id)
    const routes =
      idx >= 0 ? trip.routes.map((r) => (r.id === route.id ? route : r)) : [...trip.routes, route]
    await putOffroadTrip({ ...trip, routes })
  } catch (err) {
    console.warn('[OffroadTripCache] merge route into trip failed:', err)
  }
}

/** Remove cached route row after server delete (avoids stale editor offline). */
export async function deleteOffroadRoute(tripId: string, routeId: number): Promise<void> {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(ROUTES_STORE)) return
    const tx = db.transaction(ROUTES_STORE, 'readwrite')
    tx.objectStore(ROUTES_STORE).delete(routeCacheKey(tripId, routeId))
  } catch (err) {
    console.warn('[OffroadTripCache] delete route failed:', err)
  }
}
