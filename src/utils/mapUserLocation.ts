import type maplibregl from 'maplibre-gl'
import type { GeolocationPosition } from '../hooks/useGeolocationWatch'

const MIN_ACCURACY_M = 12
const MAX_ACCURACY_M = 120

export const USER_LOCATION_SOURCE = 'user-location'

export function displayAccuracyMeters(accuracy: number | null | undefined): number {
  if (accuracy == null || !Number.isFinite(accuracy)) return 28
  return Math.min(MAX_ACCURACY_M, Math.max(MIN_ACCURACY_M, accuracy))
}

export function userLocationGeoJson(position: GeolocationPosition) {
  const accuracy = displayAccuracyMeters(position.accuracy)
  return {
    type: 'Feature' as const,
    properties: { accuracy, lat: position.lat },
    geometry: {
      type: 'Point' as const,
      coordinates: [position.lng, position.lat] as [number, number],
    },
  }
}

export function addUserLocationLayers(map: maplibregl.Map) {
  if (!map.getSource(USER_LOCATION_SOURCE)) {
    map.addSource(USER_LOCATION_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
  }

  if (!map.getLayer('user-accuracy-circle')) {
    map.addLayer({
      id: 'user-accuracy-circle',
      type: 'circle',
      source: USER_LOCATION_SOURCE,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12,
          ['max', 10, ['/', ['get', 'accuracy'], 6]],
          15,
          ['max', 14, ['/', ['get', 'accuracy'], 3]],
          18,
          ['max', 22, ['/', ['get', 'accuracy'], 1.5]],
        ],
        'circle-color': '#1a73e8',
        'circle-opacity': 0.22,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#1a73e8',
        'circle-stroke-opacity': 0.5,
      },
    })
  }

  if (!map.getLayer('user-position-dot')) {
    map.addLayer({
      id: 'user-position-dot',
      type: 'circle',
      source: USER_LOCATION_SOURCE,
      paint: {
        'circle-radius': 7,
        'circle-color': '#1a73e8',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
}

export function setUserLocationOnMap(map: maplibregl.Map, position: GeolocationPosition | null) {
  const source = map.getSource(USER_LOCATION_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!source) return

  if (!position) {
    source.setData({ type: 'FeatureCollection', features: [] })
    return
  }

  source.setData({
    type: 'FeatureCollection',
    features: [userLocationGeoJson(position)],
  })
}
