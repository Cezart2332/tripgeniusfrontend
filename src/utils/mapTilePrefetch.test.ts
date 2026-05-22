import { describe, expect, it } from 'vitest'
import { buildLineStringGeoJson } from './coords'
import { hasNavigableTrack } from './trackProximity'

describe('mapTilePrefetch', () => {
  it('hasNavigableTrack accepts two-point line', () => {
    const track = buildLineStringGeoJson([
      [45, 25],
      [45.01, 25.01],
    ])
    expect(hasNavigableTrack(track)).toBe(true)
  })
})
