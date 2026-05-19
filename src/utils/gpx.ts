import { buildLineStringGeoJson } from './coords'

export interface GpxPreview {
  trackGeoJson: string
  pointCount: number
  distanceMeters: number
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGpxFile(xml: string): GpxPreview {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const points: [number, number][] = []

  doc.querySelectorAll('trkpt').forEach((pt) => {
    const lat = Number(pt.getAttribute('lat'))
    const lon = Number(pt.getAttribute('lon'))
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon])
  })

  if (points.length < 2) throw new Error('GPX must contain at least two track points.')

  let distance = 0
  for (let i = 1; i < points.length; i++) {
    distance += haversineMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
  }

  return {
    trackGeoJson: buildLineStringGeoJson(points),
    pointCount: points.length,
    distanceMeters: distance,
  }
}

export async function parseGpxBlob(file: Blob): Promise<GpxPreview> {
  const text = await file.text()
  return parseGpxFile(text)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
