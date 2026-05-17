import type maplibregl from 'maplibre-gl'

export const TILE_BASE = 'https://basemaps.cartocdn.com/dark_all'
export const REGIONAL_CACHE_NAME = 'map-tiles-cache'
export const GLOBAL_CACHE_NAME = 'map-tiles-global'

const WORLD_MAP_STORAGE_KEY = 'tripgenius-world-map-v1'
/** z0–5 worldwide ≈ 1365 tiles at 256px */
const WORLD_TILE_COUNT_Z0_TO_5 = 1365

export const MAX_PREFETCH_ZOOM = 17
const DEFAULT_CONCURRENCY = 10
const MIN_FREE_BYTES = 50 * 1024 * 1024 // skip prefetch if < 50 MB free

const prefetchedKeys = new Set<string>()

export interface MapBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface PrefetchOptions {
  cacheName?: string
  concurrency?: number
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
  includeRetina?: boolean
}

export function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  )
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  }
}

export function boundsToTileRange(bounds: MapBounds, z: number) {
  const n = Math.pow(2, z)
  const topLeft = lngLatToTile(bounds.west, bounds.north, z)
  const bottomRight = lngLatToTile(bounds.east, bounds.south, z)
  return {
    xMin: Math.max(0, Math.min(topLeft.x, bottomRight.x)),
    xMax: Math.min(n - 1, Math.max(topLeft.x, bottomRight.x)),
    yMin: Math.max(0, Math.min(topLeft.y, bottomRight.y)),
    yMax: Math.min(n - 1, Math.max(topLeft.y, bottomRight.y)),
  }
}

export function buildTileUrl(z: number, x: number, y: number, retina = false): string {
  const suffix = retina ? '@2x' : ''
  return `${TILE_BASE}/${z}/${x}/${y}${suffix}.png`
}

export function buildTileUrlsForCoord(
  z: number,
  x: number,
  y: number,
  includeRetina = typeof window !== 'undefined' && window.devicePixelRatio >= 2,
): string[] {
  const urls = [buildTileUrl(z, x, y, false)]
  if (includeRetina) {
    urls.push(buildTileUrl(z, x, y, true))
  }
  return urls
}

export function collectTileUrls(
  bounds: MapBounds,
  minZoom: number,
  maxZoom: number,
  bufferTiles = 0,
  includeRetina?: boolean,
): string[] {
  const urls: string[] = []
  const zMin = Math.max(0, minZoom)
  const zMax = Math.min(MAX_PREFETCH_ZOOM, maxZoom)

  for (let z = zMin; z <= zMax; z++) {
    const range = boundsToTileRange(bounds, z)
    for (let x = range.xMin - bufferTiles; x <= range.xMax + bufferTiles; x++) {
      for (let y = range.yMin - bufferTiles; y <= range.yMax + bufferTiles; y++) {
        const n = Math.pow(2, z)
        if (x < 0 || y < 0 || x >= n || y >= n) continue
        urls.push(...buildTileUrlsForCoord(z, x, y, includeRetina))
      }
    }
  }
  return urls
}

export function boundsFromCenter(lng: number, lat: number, radiusDeg: number): MapBounds {
  return {
    west: lng - radiusDeg,
    east: lng + radiusDeg,
    south: lat - radiusDeg,
    north: lat + radiusDeg,
  }
}

export function corridorBounds(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  paddingDeg: number,
): MapBounds {
  return {
    west: Math.min(fromLng, toLng) - paddingDeg,
    east: Math.max(fromLng, toLng) + paddingDeg,
    south: Math.min(fromLat, toLat) - paddingDeg,
    north: Math.max(fromLat, toLat) + paddingDeg,
  }
}

export async function hasStorageQuota(): Promise<boolean> {
  if (!navigator.storage?.estimate) return true
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    return quota - usage > MIN_FREE_BYTES
  } catch {
    return true
  }
}

export async function prefetchTiles(
  urls: string[],
  options: PrefetchOptions = {},
): Promise<{ cached: number; skipped: number }> {
  const {
    cacheName = REGIONAL_CACHE_NAME,
    concurrency = DEFAULT_CONCURRENCY,
    signal,
    onProgress,
  } = options

  if (!navigator.onLine) return { cached: 0, skipped: urls.length }
  if (!(await hasStorageQuota())) return { cached: 0, skipped: urls.length }

  const unique = [...new Set(urls)]
  const pending = unique.filter((url) => {
    const key = url.replace(TILE_BASE + '/', '')
    if (prefetchedKeys.has(key)) return false
    return true
  })

  if (pending.length === 0) {
    return { cached: 0, skipped: unique.length }
  }

  const cache = await caches.open(cacheName)
  let cached = 0
  let done = 0

  for (let i = 0; i < pending.length; i += concurrency) {
    if (signal?.aborted) break

    const batch = pending.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (url) => {
        if (signal?.aborted) return
        try {
          const existing = await cache.match(url)
          if (existing) {
            prefetchedKeys.add(url.replace(TILE_BASE + '/', ''))
            return
          }
          const response = await fetch(url, { mode: 'cors', signal })
          if (response.ok) {
            await cache.put(url, response.clone())
            prefetchedKeys.add(url.replace(TILE_BASE + '/', ''))
            cached++
          }
        } catch {
          // skip failed tiles
        } finally {
          done++
          onProgress?.(done, pending.length)
        }
      }),
    )
  }

  return { cached, skipped: unique.length - cached }
}

export async function prefetchBounds(
  bounds: MapBounds,
  minZoom: number,
  maxZoom: number,
  options?: PrefetchOptions & { bufferTiles?: number },
): Promise<{ cached: number; skipped: number }> {
  const urls = collectTileUrls(
    bounds,
    minZoom,
    maxZoom,
    options?.bufferTiles ?? 0,
    options?.includeRetina,
  )
  return prefetchTiles(urls, options)
}

export async function prefetchAroundPoint(
  lng: number,
  lat: number,
  radiusDeg: number,
  minZoom: number,
  maxZoom: number,
  options?: PrefetchOptions,
): Promise<{ cached: number; skipped: number }> {
  return prefetchBounds(boundsFromCenter(lng, lat, radiusDeg), minZoom, maxZoom, options)
}

export function markWorldMapCached(): void {
  try {
    localStorage.setItem(WORLD_MAP_STORAGE_KEY, String(Date.now()))
  } catch {
    // ignore quota errors
  }
}

/** True if user completed a world download and global tile cache still has data. */
export async function isWorldMapCached(): Promise<boolean> {
  try {
    const cache = await caches.open(GLOBAL_CACHE_NAME)
    const probe = await cache.match(buildTileUrl(0, 0, 0, false))
    if (!probe?.ok) {
      return false
    }
    const keys = await cache.keys()
    const globalTiles = keys.filter((r) => r.url.includes('/dark_all/'))
    const complete = globalTiles.length >= WORLD_TILE_COUNT_Z0_TO_5 * 0.95
    if (complete) markWorldMapCached()
    return complete
  } catch {
    return false
  }
}

export async function prefetchWorldBase(
  maxZoom = 5,
  options?: PrefetchOptions,
): Promise<{ cached: number; skipped: number }> {
  const bounds: MapBounds = { west: -180, south: -85, east: 180, north: 85 }
  const result = await prefetchBounds(bounds, 0, maxZoom, {
    ...options,
    cacheName: GLOBAL_CACHE_NAME,
    includeRetina: false,
  })
  if (result.cached > 0 || result.skipped >= WORLD_TILE_COUNT_Z0_TO_5 * 0.95) {
    markWorldMapCached()
  }
  return result
}

export async function prefetchViewport(
  map: maplibregl.Map,
  options?: PrefetchOptions & { bufferTiles?: number },
): Promise<{ cached: number; skipped: number }> {
  if (!navigator.onLine) return { cached: 0, skipped: 0 }

  const b = map.getBounds()
  const bounds: MapBounds = {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  }

  const z = Math.floor(map.getZoom())
  const zMin = Math.max(0, z - 1)
  const zMax = Math.min(MAX_PREFETCH_ZOOM, z + 1)

  return prefetchBounds(bounds, zMin, zMax, {
    bufferTiles: options?.bufferTiles ?? 1,
    ...options,
  })
}

/** Parse zoom from CARTO tile URL for service worker routing. */
export function parseTileZoom(url: string): number | null {
  const match = url.match(/\/dark_all\/(\d+)\//)
  return match ? parseInt(match[1], 10) : null
}
