import { describe, expect, it } from 'vitest'
import { buildLineStringGeoJson } from './coords'
import { parseGpxFile } from './gpx'

const sampleGpx = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="45.0" lon="25.0"></trkpt>
<trkpt lat="45.1" lon="25.1"></trkpt>
</trkseg></trk></gpx>`

describe('gpx utils', () => {
  it('parses track points', () => {
    const result = parseGpxFile(sampleGpx)
    expect(result.pointCount).toBe(2)
    expect(result.trackGeoJson).toContain('LineString')
    expect(result.distanceMeters).toBeGreaterThan(0)
  })

  it('builds geojson from lat/lng points', () => {
    const json = buildLineStringGeoJson([[45, 25], [45.1, 25.1]])
    const parsed = JSON.parse(json)
    expect(parsed.coordinates[0]).toEqual([25, 45])
  })
})
