import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { TimelineStop } from '../types/models'

interface TripRouteMapProps {
  timeline: TimelineStop[]
  selectedDay: number
}

type RouteCoordinates = [number, number][]

interface RouteData {
  coordinates: RouteCoordinates
  durationSeconds: number | null
  distanceMeters: number | null
}

interface OSRMResponse {
  routes?: Array<{
    distance?: number
    duration?: number
    geometry?: {
      coordinates?: number[][]
    }
  }>
}

const OSM_STYLE: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
}

const createRouteData = (
  routeCoordinates: RouteCoordinates,
): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates,
      },
    },
  ],
})

const toMapLibreCoordinate = (coordinate: [number, number]): [number, number] => [
  coordinate[1],
  coordinate[0],
]

const buildFallbackCoordinates = (stop: TimelineStop): RouteCoordinates => [
  toMapLibreCoordinate(stop.fromCoords),
  toMapLibreCoordinate(stop.toCoords),
]

const normalizeRouteCoordinates = (coordinates: number[][]): RouteCoordinates =>
  coordinates
    .filter((point): point is [number, number] => point.length >= 2)
    .map((point) => [point[0], point[1]])

const fetchDirectionsRoute = async (
  stop: TimelineStop,
): Promise<RouteData> => {
  const coordinateString = `${stop.fromCoords[1]},${stop.fromCoords[0]};${stop.toCoords[1]},${stop.toCoords[0]}`
  
  // Using public OSRM demo server (free/no key)
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson`,
  )

  if (!response.ok) {
    throw new Error('Failed to load directions route')
  }

  const payload = (await response.json()) as OSRMResponse
  const firstRoute = payload.routes?.[0]
  const coordinates = firstRoute?.geometry?.coordinates

  if (!coordinates || coordinates.length < 2) {
    throw new Error('Directions route did not include coordinates')
  }

  const normalizedCoordinates = normalizeRouteCoordinates(coordinates)

  return {
    coordinates: normalizedCoordinates,
    durationSeconds: firstRoute?.duration ?? null,
    distanceMeters: firstRoute?.distance ?? null,
  }
}

const formatDuration = (durationSeconds: number): string => {
  const roundedMinutes = Math.max(1, Math.round(durationSeconds / 60))

  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`
  }

  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (minutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${minutes} min`
}

const formatDistance = (distanceMeters: number): string => {
  const distanceInKm = distanceMeters / 1000
  const precision = distanceInKm >= 100 ? 0 : 1
  return `${distanceInKm.toFixed(precision)} km`
}

const createPointData = (
  stop: TimelineStop,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: `From ${stop.startingPoint}` },
      geometry: {
        type: 'Point',
        coordinates: toMapLibreCoordinate(stop.fromCoords),
      },
    },
    {
      type: 'Feature',
      properties: { name: `To ${stop.endPoint}` },
      geometry: {
        type: 'Point',
        coordinates: toMapLibreCoordinate(stop.toCoords),
      },
    },
  ],
})

export function TripRouteMap({ timeline, selectedDay }: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const routeCacheRef = useRef<Record<string, RouteData>>({})
  const [routeState, setRouteState] = useState({
    isLoading: true,
    hasHydrated: false,
    hasError: false,
    durationSeconds: null as number | null,
    distanceMeters: null as number | null,
  })

  const selectedStop = useMemo(
    () => timeline.find((stop) => stop.day === selectedDay) ?? timeline[0] ?? null,
    [selectedDay, timeline],
  )

  const initialStop = timeline[0] ?? null

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !initialStop) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: toMapLibreCoordinate(initialStop.fromCoords),
      zoom: 5,
      pitch: 35,
      bearing: 0,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    
    // Browser Geolocation Control (requested by user)
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      } as any),
      'bottom-right'
    )

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [initialStop])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedStop) {
      return
    }

    let cancelled = false

    const upsertRouteLayers = (routeData: RouteData) => {
      const lineSource = map.getSource('route-line') as maplibregl.GeoJSONSource | undefined
      const pointSource = map.getSource('route-points') as maplibregl.GeoJSONSource | undefined

      if (lineSource) {
        lineSource.setData(createRouteData(routeData.coordinates))
      } else {
        map.addSource('route-line', {
          type: 'geojson',
          data: createRouteData(routeData.coordinates),
        })

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#1f8a70',
            'line-width': 5,
            'line-opacity': 0.9,
          },
        })
      }

      if (pointSource) {
        pointSource.setData(createPointData(selectedStop))
      } else {
        map.addSource('route-points', {
          type: 'geojson',
          data: createPointData(selectedStop),
        })

        map.addLayer({
          id: 'route-points',
          type: 'circle',
          source: 'route-points',
          paint: {
            'circle-radius': 7,
            'circle-color': '#ff7a59',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#f8f5ef',
          },
        })
      }
    }

    const applyRouteToMap = (routeData: RouteData, hasError: boolean) => {
      if (cancelled) {
        return
      }

      upsertRouteLayers(routeData)

      const firstCoordinate = routeData.coordinates[0]
      if (!firstCoordinate) {
        return
      }

      const bounds = new maplibregl.LngLatBounds(firstCoordinate, firstCoordinate)

      routeData.coordinates.forEach((coordinate) => {
        bounds.extend(coordinate)
      })

      map.fitBounds(bounds, {
        padding: 90,
        duration: 850,
        maxZoom: 8,
      })

      setRouteState({
        isLoading: false,
        hasHydrated: true,
        hasError,
        durationSeconds: routeData.durationSeconds,
        distanceMeters: routeData.distanceMeters,
      })
    }

    const routeKey = `${selectedStop.fromCoords.join(',')}|${selectedStop.toCoords.join(',')}`

    const updateMapData = async () => {
      setRouteState((previous) => ({
        ...previous,
        isLoading: true,
        hasError: false,
      }))

      const cachedRoute = routeCacheRef.current[routeKey]

      if (cachedRoute) {
        applyRouteToMap(cachedRoute, false)
        return
      }

      try {
        const routeData = await fetchDirectionsRoute(selectedStop)
        routeCacheRef.current[routeKey] = routeData
        applyRouteToMap(routeData, false)
      } catch (err) {
        console.error('OSRM fetch failed:', err)
        const fallbackRoute: RouteData = {
          coordinates: buildFallbackCoordinates(selectedStop),
          durationSeconds: null,
          distanceMeters: null,
        }
        applyRouteToMap(fallbackRoute, true)
      }
    }

    if (map.isStyleLoaded()) {
      void updateMapData()
    } else {
      map.once('load', () => {
        void updateMapData()
      })
    }

    return () => {
      cancelled = true
    }
  }, [selectedStop])

  if (!selectedStop) {
    return <div className="map-fallback">No timeline stops are available for this trip yet.</div>
  }

  const showInitialMapSkeleton = !routeState.hasHydrated

  let estimationText = 'Route preview ready.'

  if (showInitialMapSkeleton) {
    estimationText = 'Syncing trip details with live route map...'
  } else if (routeState.isLoading) {
    estimationText = 'Calculating real road route and ETA...'
  } else if (routeState.durationSeconds !== null && routeState.distanceMeters !== null) {
    estimationText = `Estimated drive: ${formatDuration(routeState.durationSeconds)} • ${formatDistance(routeState.distanceMeters)}`
  } else if (routeState.hasError) {
    estimationText = 'Could not fetch driving directions. Showing direct segment fallback.'
  }

  return (
    <div className="map-wrapper">
      <div className="map-surface" aria-busy={showInitialMapSkeleton}>
        {showInitialMapSkeleton ? (
          <div className="map-loading-skeleton" aria-hidden="true">
            <div className="map-loading-line is-wide" />
            <div className="map-loading-line is-mid" />
            <div className="map-loading-line is-short" />
          </div>
        ) : null}

        <div
          className={showInitialMapSkeleton ? 'map-container is-loading' : 'map-container'}
          ref={containerRef}
          aria-label="Trip route map"
        />
      </div>
      <p className={routeState.hasError ? 'map-estimation is-warning' : 'map-estimation'}>
        {routeState.isLoading || showInitialMapSkeleton ? (
          <span className="inline-loading-content">
            <span className="inline-spinner" aria-hidden="true" />
            {estimationText}
          </span>
        ) : (
          estimationText
        )}
      </p>
    </div>
  )
}
