import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { TripTimelineStop } from '../types/models'

interface TripRouteMapProps {
  timeline: TripTimelineStop[]
  selectedDay: number
}

type RouteCoordinates = [number, number][]

interface RouteData {
  coordinates: RouteCoordinates
  durationSeconds: number | null
  distanceMeters: number | null
}

interface DirectionsResponse {
  routes?: Array<{
    distance?: number
    duration?: number
    geometry?: {
      coordinates?: number[][]
    }
  }>
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

const buildFallbackCoordinates = (stop: TripTimelineStop): RouteCoordinates => [
  stop.fromCoords,
  stop.toCoords,
]

const normalizeRouteCoordinates = (coordinates: number[][]): RouteCoordinates =>
  coordinates
    .filter((point): point is [number, number] => point.length >= 2)
    .map((point) => [point[0], point[1]])

const fetchDirectionsRoute = async (
  stop: TripTimelineStop,
  token: string,
): Promise<RouteData> => {
  const coordinateString = `${stop.fromCoords[0]},${stop.fromCoords[1]};${stop.toCoords[0]},${stop.toCoords[1]}`
  const query = new URLSearchParams({
    alternatives: 'false',
    overview: 'full',
    geometries: 'geojson',
    access_token: token,
  })

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?${query.toString()}`,
  )

  if (!response.ok) {
    throw new Error('Failed to load directions route')
  }

  const payload = (await response.json()) as DirectionsResponse
  const firstRoute = payload.routes?.[0]
  const coordinates = firstRoute?.geometry?.coordinates

  if (!coordinates || coordinates.length < 2) {
    throw new Error('Directions route did not include coordinates')
  }

  const normalizedCoordinates = normalizeRouteCoordinates(coordinates)

  if (normalizedCoordinates.length < 2) {
    throw new Error('Directions route coordinates were invalid')
  }

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
  stop: TripTimelineStop,
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: stop.from },
      geometry: {
        type: 'Point',
        coordinates: stop.fromCoords,
      },
    },
    {
      type: 'Feature',
      properties: { name: stop.to },
      geometry: {
        type: 'Point',
        coordinates: stop.toCoords,
      },
    },
  ],
})

export function TripRouteMap({ timeline, selectedDay }: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const routeCacheRef = useRef<Record<string, RouteData>>({})
  const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN
  const [routeState, setRouteState] = useState({
    isLoading: false,
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
    if (!containerRef.current || mapRef.current || !token || !initialStop) {
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialStop.fromCoords,
      zoom: 5,
      pitch: 35,
      bearing: 0,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      map.addSource('route-line', {
        type: 'geojson',
        data: createRouteData(buildFallbackCoordinates(initialStop)),
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

      map.addSource('route-points', {
        type: 'geojson',
        data: createPointData(initialStop),
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
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [initialStop, token])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedStop || !token) {
      return
    }

    let cancelled = false

    const applyRouteToMap = (routeData: RouteData, hasError: boolean) => {
      if (cancelled) {
        return
      }

      const lineSource = map.getSource('route-line') as mapboxgl.GeoJSONSource | undefined
      const pointSource = map.getSource('route-points') as mapboxgl.GeoJSONSource | undefined

      if (!lineSource || !pointSource) {
        return
      }

      lineSource.setData(createRouteData(routeData.coordinates))
      pointSource?.setData(createPointData(selectedStop))

      const firstCoordinate = routeData.coordinates[0]
      if (!firstCoordinate) {
        return
      }

      const bounds = new mapboxgl.LngLatBounds(firstCoordinate, firstCoordinate)

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
        const routeData = await fetchDirectionsRoute(selectedStop, token)
        routeCacheRef.current[routeKey] = routeData
        applyRouteToMap(routeData, false)
      } catch {
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
  }, [selectedStop, token])

  if (!selectedStop) {
    return <div className="map-fallback">No timeline stops are available for this trip yet.</div>
  }

  if (!token) {
    return (
      <div className="map-fallback">
        Mapbox token missing. Add VITE_MAPBOX_PUBLIC_TOKEN in .env to render
        interactive trip routes.
      </div>
    )
  }

  let estimationText = 'Route preview ready.'

  if (routeState.isLoading) {
    estimationText = 'Calculating real road route and ETA...'
  } else if (routeState.durationSeconds !== null && routeState.distanceMeters !== null) {
    estimationText = `Estimated drive: ${formatDuration(routeState.durationSeconds)} • ${formatDistance(routeState.distanceMeters)}`
  } else if (routeState.hasError) {
    estimationText = 'Could not fetch driving directions. Showing direct segment fallback.'
  }

  return (
    <div className="map-wrapper">
      <div className="map-container" ref={containerRef} aria-label="Trip route map" />
      <p className={routeState.hasError ? 'map-estimation is-warning' : 'map-estimation'}>
        {estimationText}
      </p>
    </div>
  )
}
