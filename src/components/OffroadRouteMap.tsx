import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { OffroadRoute } from '../types/models'
import { lineStringToLngLatCoords } from '../utils/coords'
import { OFFROAD_MAP_STYLE } from '../map/osmStyle'

interface OffroadRouteMapProps {
  routes: OffroadRoute[]
  selectedRouteId?: number | null
  height?: string
  interactive?: boolean
}

export function OffroadRouteMap({ routes, selectedRouteId, height = '320px', interactive = false }: OffroadRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const applyRoutesToMap = useCallback((map: maplibregl.Map, currentRoutes: OffroadRoute[]) => {
    if (!map.getSource('offroad-routes')) return

    const features = currentRoutes
      .map((route) => {
        const coords = lineStringToLngLatCoords(route.trackGeoJson)
        if (coords.length < 2) return null
        return {
          type: 'Feature' as const,
          properties: { routeId: route.id, name: route.name },
          geometry: { type: 'LineString' as const, coordinates: coords },
        }
      })
      .filter((f): f is NonNullable<typeof f> => f != null)

    const source = map.getSource('offroad-routes') as maplibregl.GeoJSONSource
    source.setData({ type: 'FeatureCollection', features })

    if (features.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      features.forEach((f) => {
        f.geometry.coordinates.forEach((c) => bounds.extend(c as [number, number]))
      })
      map.fitBounds(bounds, { padding: 48, maxZoom: 14 })
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFFROAD_MAP_STYLE,
      center: [25.0, 45.9],
      zoom: 8,
      maxZoom: 17,
      interactive: interactive,
      dragPan: interactive,
      scrollZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoomRotate: interactive,
    })
    if (interactive) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
    }
    mapRef.current = map

    map.on('load', () => {
      map.addSource('offroad-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'offroad-routes-casing',
        type: 'line',
        source: 'offroad-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.9,
        },
      })
      map.addLayer({
        id: 'offroad-routes-line',
        type: 'line',
        source: 'offroad-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1b5e3a',
          'line-width': 5,
        },
      })
      map.addLayer({
        id: 'offroad-routes-accent',
        type: 'line',
        source: 'offroad-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#c9a227',
          'line-width': 2.5,
          'line-dasharray': [2, 1],
        },
      })
      setMapReady(true)
      applyRoutesToMap(map, routes)
    })

    return () => {
      setMapReady(false)
      map.remove()
      mapRef.current = null
    }
  }, [applyRoutesToMap, interactive])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    applyRoutesToMap(map, routes)
  }, [routes, selectedRouteId, mapReady, applyRoutesToMap])

  return (
    <div
      ref={containerRef}
      className="offroad-route-map"
      style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}
    />
  )
}
