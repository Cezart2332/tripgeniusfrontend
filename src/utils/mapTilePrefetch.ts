import { lineStringToLngLatCoords } from './coords'
import { hasNavigableTrack } from './trackProximity'

export type MapTileStyle = 'topo' | 'carto'

const TOPO_TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.opentopomap.org/${z}/${x}/${y}.png`

const CARTO_TILE_URL = (z: number, x: number, y: number) =>
  `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`

const CACHE_GLOBAL = 'map-tiles-global'
const CACHE_REGIONAL = 'map-tiles-cache'

const DEFAULT_MAX_TILES = 220
const BATCH_SIZE = 8

export interface PrefetchMapTilesOptions {
  minZoom?: number
  maxZoom?: number
  /** Extra padding around track bounds (degrees). */
  paddingDeg?: number
  /** Extra tiles around the track start (first coordinate). */
  prefetchStartZooms?: number[]
  styles?: MapTileStyle[]
  maxTiles?: number
}

function lngLatToTileXY(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  )
  return { x, y: Math.min(Math.max(y, 0), n - 1) }
}

function boundsFromLngLatPoints(
  points: [number, number][],
  paddingDeg: number
): { minLng: number; maxLng: number; minLat: number; maxLat: number } | null {
  if (points.length === 0) return null
  let minLng = points[0][0]
  let maxLng = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  return {
    minLng: minLng - paddingDeg,
    maxLng: maxLng + paddingDeg,
    minLat: minLat - paddingDeg,
    maxLat: maxLat + paddingDeg,
  }
}

function tilesForBounds(
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  z: number
): Array<{ z: number; x: number; y: number }> {
  const nw = lngLatToTileXY(bounds.minLng, bounds.maxLat, z)
  const se = lngLatToTileXY(bounds.maxLng, bounds.minLat, z)
  const tiles: Array<{ z: number; x: number; y: number }> = []
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      tiles.push({ z, x, y })
    }
  }
  return tiles
}

function tileUrl(style: MapTileStyle, z: number, x: number, y: number): string {
  return style === 'topo' ? TOPO_TILE_URL(z, x, y) : CARTO_TILE_URL(z, x, y)
}

function cacheForZoom(z: number): string {
  return z <= 5 ? CACHE_GLOBAL : CACHE_REGIONAL
}

async function putTileInCache(url: string, z: number): Promise<boolean> {
  if (!('caches' in window)) return false
  const cache = await caches.open(cacheForZoom(z))
  const existing = await cache.match(url)
  if (existing) return true
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) return false
    await cache.put(url, res.clone())
    return true
  } catch {
    return false
  }
}

function collectTileJobs(
  points: [number, number][],
  options: PrefetchMapTilesOptions
): Array<{ url: string; z: number }> {
  const {
    minZoom = 10,
    maxZoom = 15,
    paddingDeg = 0.012,
    prefetchStartZooms = [14, 15, 16],
    styles = ['topo', 'carto'],
    maxTiles = DEFAULT_MAX_TILES,
  } = options

  const bounds = boundsFromLngLatPoints(points, paddingDeg)
  if (!bounds) return []

  const seen = new Set<string>()
  const jobs: Array<{ url: string; z: number }> = []

  const push = (style: MapTileStyle, z: number, x: number, y: number) => {
    const key = `${style}:${z}/${x}/${y}`
    if (seen.has(key) || jobs.length >= maxTiles) return
    seen.add(key)
    jobs.push({ url: tileUrl(style, z, x, y), z })
  }

  for (let z = minZoom; z <= maxZoom; z++) {
    for (const t of tilesForBounds(bounds, z)) {
      for (const style of styles) push(style, t.z, t.x, t.y)
      if (jobs.length >= maxTiles) return jobs
    }
  }

  const [startLng, startLat] = points[0]
  for (const z of prefetchStartZooms) {
    const { x, y } = lngLatToTileXY(startLng, startLat, z)
    for (const style of styles) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          push(style, z, x + dx, y + dy)
          if (jobs.length >= maxTiles) return jobs
        }
      }
    }
  }

  return jobs
}

/** Warm Cache Storage map tiles for a GPX/GeoJSON track (topo + carto, start point included). */
export async function prefetchMapTilesForTrack(
  trackGeoJson: string,
  options?: PrefetchMapTilesOptions
): Promise<{ requested: number; cached: number }> {
  if (!hasNavigableTrack(trackGeoJson)) return { requested: 0, cached: 0 }
  const points = lineStringToLngLatCoords(trackGeoJson)
  return prefetchMapTilesForLngLatPoints(points, options)
}

export async function prefetchMapTilesForLngLatPoints(
  points: [number, number][],
  options?: PrefetchMapTilesOptions
): Promise<{ requested: number; cached: number }> {
  const jobs = collectTileJobs(points, options ?? {})
  if (jobs.length === 0) return { requested: 0, cached: 0 }

  let cached = 0
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((j) => putTileInCache(j.url, j.z)))
    cached += results.filter(Boolean).length
  }
  return { requested: jobs.length, cached }
}
