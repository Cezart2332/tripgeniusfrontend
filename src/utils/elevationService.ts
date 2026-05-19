import api from '../data/api'

/** Terrain elevation via backend proxy (OpenTopoData; no API key, no browser CORS). */
export async function fetchElevationsForLngLatPoints(
  points: [number, number][]
): Promise<number[]> {
  if (points.length === 0) return []

  const res = await api.post<{ elevations: number[] }>('api/Geocoding/elevation', {
    points: points.map(([lng, lat]) => ({ lng, lat })),
  })

  const elevations = res.data?.elevations
  if (!Array.isArray(elevations) || elevations.length !== points.length) {
    throw new Error('Invalid elevation response')
  }

  const validCount = elevations.filter((e) => typeof e === 'number' && Number.isFinite(e)).length
  if (validCount < 2) {
    throw new Error('Not enough elevation data for this route')
  }

  return elevations
}
