import { lineStringToLngLatCoords } from './coords'

export const OFFROAD_TRACK_START_PROXIMITY_M = 500

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function hasNavigableTrack(trackGeoJson: string): boolean {
  return lineStringToLngLatCoords(trackGeoJson).length >= 2
}

export interface NearestOnTrack {
  distanceMeters: number
  segmentIndex: number
  lng: number
  lat: number
}

/** Shortest distance from a point to a [lng, lat] polyline (meters). */
export function nearestPointOnLngLatPolyline(
  lat: number,
  lng: number,
  points: [number, number][]
): NearestOnTrack | null {
  if (points.length === 0) return null
  if (points.length === 1) {
    const [lng0, lat0] = points[0]
    return { distanceMeters: haversineMeters(lat, lng, lat0, lng0), segmentIndex: 0, lng: lng0, lat: lat0 }
  }

  let bestDist = Infinity
  let bestIndex = 0
  let bestLng = points[0][0]
  let bestLat = points[0][1]

  for (let i = 0; i < points.length - 1; i++) {
    const [lng0, lat0] = points[i]
    const [lng1, lat1] = points[i + 1]
    const t = clamp(projectOntoSegment(lat, lng, lat0, lng0, lat1, lng1), 0, 1)
    const plng = lng0 + t * (lng1 - lng0)
    const plat = lat0 + t * (lat1 - lat0)
    const d = haversineMeters(lat, lng, plat, plng)
    if (d < bestDist) {
      bestDist = d
      bestIndex = i
      bestLng = plng
      bestLat = plat
    }
  }

  return { distanceMeters: bestDist, segmentIndex: bestIndex, lng: bestLng, lat: bestLat }
}

export function distanceToTrackMeters(lat: number, lng: number, trackGeoJson: string): number | null {
  const points = lineStringToLngLatCoords(trackGeoJson)
  if (points.length < 2) return null
  return nearestPointOnLngLatPolyline(lat, lng, points)?.distanceMeters ?? null
}

export function canStartOffroadTrack(
  lat: number,
  lng: number,
  trackGeoJson: string,
  radiusM = OFFROAD_TRACK_START_PROXIMITY_M
): boolean {
  const d = distanceToTrackMeters(lat, lng, trackGeoJson)
  return d != null && d <= radiusM
}

/** Meters remaining along the track from the nearest point on the line toward the end. */
export function remainingDistanceOnTrackMeters(
  lat: number,
  lng: number,
  points: [number, number][]
): number {
  const nearest = nearestPointOnLngLatPolyline(lat, lng, points)
  if (!nearest || points.length < 2) return 0

  let remaining = haversineMeters(nearest.lat, nearest.lng, points[nearest.segmentIndex + 1][1], points[nearest.segmentIndex + 1][0])
  for (let i = nearest.segmentIndex + 1; i < points.length - 1; i++) {
    remaining += haversineMeters(
      points[i][1],
      points[i][0],
      points[i + 1][1],
      points[i + 1][0]
    )
  }
  return remaining
}

/** Index of the next vertex ahead on the track (for heading hints). */
export function aheadVertexIndex(segmentIndex: number, pointCount: number, lookAhead = 5): number {
  return Math.min(segmentIndex + lookAhead, pointCount - 1)
}

export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Project (lat,lng) onto segment (lat0,lng0)-(lat1,lng1); returns param t in [0,1] (local equirectangular). */
function projectOntoSegment(
  lat: number,
  lng: number,
  lat0: number,
  lng0: number,
  lat1: number,
  lng1: number
): number {
  const dx = lng1 - lng0
  const dy = lat1 - lat0
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return 0
  return ((lng - lng0) * dx + (lat - lat0) * dy) / len2
}
