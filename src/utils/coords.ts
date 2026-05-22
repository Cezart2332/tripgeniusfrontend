import type { GeoJsonLineString } from '../types/models'

/** Valid GeoJSON placeholder when a route has no GPX/track yet (PostgreSQL jsonb rejects ""). */
export const EMPTY_OFFROAD_TRACK_GEOJSON = JSON.stringify({
  type: 'LineString',
  coordinates: [],
} satisfies GeoJsonLineString)

export function parseLineString(trackGeoJson: string): GeoJsonLineString | null {
  try {
    const parsed = JSON.parse(trackGeoJson) as GeoJsonLineString
    if (parsed?.type === 'LineString' && Array.isArray(parsed.coordinates)) return parsed
    return null
  } catch {
    return null
  }
}

/** GeoJSON [lng, lat] → MapLibre LngLat bounds */
export function lineStringToLngLatCoords(trackGeoJson: string): [number, number][] {
  const line = parseLineString(trackGeoJson)
  if (!line) return []
  return line.coordinates.map(([lng, lat]) => [lng, lat])
}

export function buildLineStringGeoJson(points: [number, number][]): string {
  const coordinates = points.map(([lat, lng]) => [lng, lat] as [number, number])
  return JSON.stringify({ type: 'LineString', coordinates } satisfies GeoJsonLineString)
}

/** Build GeoJSON from [lng, lat] points with optional per-point elevation (m). */
export function buildLineStringGeoJson3D(
  points: [number, number][],
  elevations: number[]
): string {
  const coordinates = points.map(([lng, lat], i) => {
    const elev = elevations[i]
    if (typeof elev === 'number' && Number.isFinite(elev)) {
      return [lng, lat, elev] as [number, number, number]
    }
    return [lng, lat] as [number, number]
  })
  return JSON.stringify({ type: 'LineString', coordinates } satisfies GeoJsonLineString)
}

/** Haversine distance along [lng, lat] vertices in meters. */
export function distanceAlongLngLatPoints(points: [number, number][]): number {
  if (points.length < 2) return 0
  const R = 6371000
  let dist = 0
  for (let i = 1; i < points.length; i++) {
    const [lng1, lat1] = points[i - 1]
    const [lng2, lat2] = points[i]
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2
    dist += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return dist
}

export interface RouteElevationStats {
  gainMeters: number
  lossMeters: number
  maxAltitude: number | null
  minAltitude: number | null
}

/** Compute elevation gain, loss and min/max from a 3D GeoJSON LineString. */
export function computeElevationStats(trackGeoJson: string): RouteElevationStats {
  const line = parseLineString(trackGeoJson)
  if (!line) return { gainMeters: 0, lossMeters: 0, maxAltitude: null, minAltitude: null }

  const altitudes = line.coordinates
    .map(c => c[2])
    .filter((a): a is number => typeof a === 'number' && isFinite(a))

  if (altitudes.length < 2) {
    return { gainMeters: 0, lossMeters: 0, maxAltitude: altitudes[0] ?? null, minAltitude: altitudes[0] ?? null }
  }

  let gain = 0
  let loss = 0
  for (let i = 1; i < altitudes.length; i++) {
    const diff = altitudes[i] - altitudes[i - 1]
    if (diff > 0) gain += diff
    else loss += Math.abs(diff)
  }

  return {
    gainMeters: Math.round(gain),
    lossMeters: Math.round(loss),
    maxAltitude: Math.round(Math.max(...altitudes)),
    minAltitude: Math.round(Math.min(...altitudes)),
  }
}

/**
 * Estimate hiking/offroad duration using Naismith's rule:
 * 5 km/h base pace + 1 h per 600 m of ascent.
 * Returns a formatted string like "2 h 30 min" or "~45 min".
 */
export function estimateDuration(distanceMeters: number, elevationGainMeters: number): string {
  const baseHours = distanceMeters / 1000 / 5
  const climbHours = elevationGainMeters / 600
  const totalMinutes = Math.round((baseHours + climbHours) * 60)

  if (totalMinutes < 60) return `~${totalMinutes} min`

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
