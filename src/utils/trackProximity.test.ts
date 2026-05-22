import { describe, expect, it } from 'vitest'
import { buildLineStringGeoJson } from './coords'
import {
  OFFROAD_TRACK_START_PROXIMITY_M,
  canStartOffroadTrack,
  distanceToTrackMeters,
  haversineMeters,
} from './trackProximity'

describe('trackProximity', () => {
  const track = buildLineStringGeoJson([
    [45.0, 25.0],
    [45.001, 25.001],
    [45.002, 25.002],
  ])

  it('returns null when track has fewer than two points', () => {
    expect(distanceToTrackMeters(45, 25, '{"type":"LineString","coordinates":[]}')).toBeNull()
  })

  it('allows start when within proximity of the line', () => {
    expect(canStartOffroadTrack(45.0, 25.0, track, OFFROAD_TRACK_START_PROXIMITY_M)).toBe(true)
  })

  it('blocks start when far from the line', () => {
    expect(canStartOffroadTrack(46, 26, track, OFFROAD_TRACK_START_PROXIMITY_M)).toBe(false)
  })

  it('haversineMeters is symmetric', () => {
    const a = haversineMeters(45, 25, 45.001, 25.001)
    const b = haversineMeters(45.001, 25.001, 45, 25)
    expect(a).toBeCloseTo(b, 5)
  })
})
