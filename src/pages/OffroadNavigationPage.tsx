import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import maplibregl from 'maplibre-gl'
import { FiArrowLeft, FiArrowUp, FiFlag, FiMapPin } from 'react-icons/fi'
import api from '../data/api'
import type { OffroadRoute } from '../types/models'
import { useGeolocationWatch } from '../hooks/useGeolocationWatch'
import { OFFROAD_MAP_STYLE } from '../map/osmStyle'
import { offroadMapTrackColors } from '../styles/theme'
import { lineStringToLngLatCoords } from '../utils/coords'
import { cacheOffroadRouteForOffline, getOffroadRoute, getOffroadTrip } from '../utils/offroadTripCache'
import {
  OFFROAD_TRACK_START_PROXIMITY_M,
  aheadVertexIndex,
  bearingDegrees,
  canStartOffroadTrack,
  distanceToTrackMeters,
  haversineMeters,
  hasNavigableTrack,
  nearestPointOnLngLatPolyline,
  remainingDistanceOnTrackMeters,
  trackAheadCoords,
  trackCheckpointFeatures,
} from '../utils/trackProximity'

const ARRIVAL_RADIUS_M = 30

function cardinalBearing(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round(((degrees % 360) + 360) % 360 / 45) % 8
  return dirs[idx]
}

export function OffroadNavigationPage() {
  const { tripId, routeId } = useParams<{ tripId: string; routeId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [route, setRoute] = useState<OffroadRoute | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const trackPoints = useMemo(
    () => (route ? lineStringToLngLatCoords(route.trackGeoJson) : []),
    [route]
  )

  const { position, error: geoError, supported } = useGeolocationWatch(Boolean(route))

  const distanceToTrack = useMemo(() => {
    if (!position || trackPoints.length < 2) return null
    return distanceToTrackMeters(position.lat, position.lng, route!.trackGeoJson)
  }, [position, route, trackPoints.length])

  const canStart = useMemo(() => {
    if (!position || !route) return false
    return canStartOffroadTrack(position.lat, position.lng, route.trackGeoJson)
  }, [position, route])

  const remainingM = useMemo(() => {
    if (!position || trackPoints.length < 2) return null
    return remainingDistanceOnTrackMeters(position.lat, position.lng, trackPoints)
  }, [position, trackPoints])

  const arrived = useMemo(
    () => canStart && remainingM != null && remainingM < ARRIVAL_RADIUS_M,
    [canStart, remainingM]
  )

  /** Full trail before navigation; only the path ahead once on the track. */
  const visibleTrackCoords = useMemo((): [number, number][] => {
    if (trackPoints.length < 2) return trackPoints
    if (!canStart || !position) return trackPoints
    return trackAheadCoords(position.lat, position.lng, trackPoints)
  }, [trackPoints, canStart, position])

  const checkpointData = useMemo(
    () => trackCheckpointFeatures(trackPoints),
    [trackPoints]
  )

  const hudInstruction = useMemo(() => {
    if (!position || trackPoints.length < 2) return 'Waiting for GPS…'
    const nearest = nearestPointOnLngLatPolyline(position.lat, position.lng, trackPoints)
    if (!nearest) return 'Follow the trail'
    const aheadIdx = aheadVertexIndex(nearest.segmentIndex, trackPoints.length)
    const [aheadLng, aheadLat] = trackPoints[aheadIdx]
    const bearing = bearingDegrees(position.lat, position.lng, aheadLat, aheadLng)
    const distToAhead = haversineMeters(position.lat, position.lng, aheadLat, aheadLng)
    if (distToAhead < 15) return 'Continue on the trail'
    return `Head ${cardinalBearing(bearing)} · ${Math.round(distToAhead)} m`
  }, [position, trackPoints])

  useEffect(() => {
    if (!tripId || !routeId) return
    const load = async () => {
      try {
        const res = await api.get<{ routes: OffroadRoute[] }>(`api/OffroadTrip/get-offroad-trip/${tripId}`)
        const found = res.data.routes?.find((r) => r.id === Number(routeId))
        if (found) {
          setRoute(found)
          void cacheOffroadRouteForOffline(tripId, found)
          return
        }
      } catch {
        /* try cache */
      }
      const trip = await getOffroadTrip(tripId)
      const fromTrip = trip?.routes.find((r) => r.id === Number(routeId))
      if (fromTrip) {
        setRoute(fromTrip)
        void cacheOffroadRouteForOffline(tripId, fromTrip)
        return
      }
      const cached = await getOffroadRoute(tripId, routeId)
      if (cached) {
        setRoute(cached)
        void cacheOffroadRouteForOffline(tripId, cached)
        return
      }
      setLoadError('Route not found.')
    }
    void load()
  }, [tripId, routeId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || trackPoints.length < 2) return

    const [startLng, startLat] = trackPoints[0]
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFFROAD_MAP_STYLE,
      center: [startLng, startLat],
      zoom: 14,
      pitch: 55,
      cooperativeGestures: true,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('offroad-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: trackPoints },
        },
      })
      map.addLayer({
        id: 'offroad-track-casing',
        type: 'line',
        source: 'offroad-track',
        paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.85 },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      })
      map.addLayer({
        id: 'offroad-track-line',
        type: 'line',
        source: 'offroad-track',
        paint: { 'line-color': offroadMapTrackColors.line, 'line-width': 6 },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      })

      map.addSource('offroad-checkpoints', {
        type: 'geojson',
        data: trackCheckpointFeatures(trackPoints),
      })
      map.addLayer({
        id: 'offroad-checkpoint-ring',
        type: 'circle',
        source: 'offroad-checkpoints',
        paint: {
          'circle-radius': 14,
          'circle-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      })
      map.addLayer({
        id: 'offroad-checkpoint-dot',
        type: 'circle',
        source: 'offroad-checkpoints',
        paint: {
          'circle-radius': 9,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'start',
            '#17f702',
            'finish',
            '#ef4444',
            offroadMapTrackColors.line,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0d0f0d',
        },
      })

      const bounds = new maplibregl.LngLatBounds()
      trackPoints.forEach(([lng, lat]) => bounds.extend([lng, lat]))
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 })
    })

    return () => {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [trackPoints])

  useEffect(() => {
    const map = mapRef.current
    if (!map || trackPoints.length < 2) return

    const trackSource = map.getSource('offroad-track') as maplibregl.GeoJSONSource | undefined
    if (trackSource) {
      trackSource.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: visibleTrackCoords },
      })
    }

    const checkpointSource = map.getSource('offroad-checkpoints') as maplibregl.GeoJSONSource | undefined
    if (checkpointSource) {
      checkpointSource.setData(checkpointData)
    }
  }, [visibleTrackCoords, checkpointData, trackPoints.length])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !position || !canStart) return

    const lngLat: [number, number] = [position.lng, position.lat]
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'user-waze-dot'
      userMarkerRef.current = new maplibregl.Marker(el).setLngLat(lngLat).addTo(map)
    } else {
      userMarkerRef.current.setLngLat(lngLat)
    }

    map.easeTo({
      center: lngLat,
      bearing: position.heading ?? map.getBearing(),
      duration: 800,
    })
  }, [position, canStart])

  if (loadError) {
    return (
      <LoadingScreen>
        <p>{loadError}</p>
        <BackLink type="button" onClick={() => navigate(-1)}>
          Go back
        </BackLink>
      </LoadingScreen>
    )
  }

  if (!route) {
    return <LoadingScreen>Loading track…</LoadingScreen>
  }

  if (!hasNavigableTrack(route.trackGeoJson)) {
    return (
      <LoadingScreen>
        <p>This route has no track to follow yet.</p>
        <BackLink type="button" onClick={() => navigate(`/app/offroad/${tripId}`)}>
          Back to trip
        </BackLink>
      </LoadingScreen>
    )
  }

  return (
    <Screen>
      <div ref={containerRef} data-lenis-prevent style={{ width: '100%', height: '100%' }} />

      <NavBackButton type="button" onClick={() => navigate(`/app/offroad/${tripId}`)} aria-label="Back to trip">
        <FiArrowLeft size={28} />
      </NavBackButton>

      {!canStart && (
        <ProximityGate>
          <ProximityTitle>
            <FiMapPin aria-hidden /> Get closer to the trail
          </ProximityTitle>
          <ProximityText>
            {distanceToTrack != null
              ? `You are about ${Math.round(distanceToTrack)} m away. Move within ${OFFROAD_TRACK_START_PROXIMITY_M} m to start.`
              : supported && !geoError
                ? 'Waiting for your location…'
                : geoError || 'Enable location to start track navigation.'}
          </ProximityText>
        </ProximityGate>
      )}

      {canStart && remainingM != null && !arrived && (
        <NavHud>
          <NavHudCard>
            <ManeuverIcon>
              <FiArrowUp />
            </ManeuverIcon>
            <NavHudInfo>
              <RouteName>{route.name}</RouteName>
              <NavInstruction>{hudInstruction}</NavInstruction>
            </NavHudInfo>
          </NavHudCard>
          <NavStatsRow>
            <NavStatPill>{(remainingM / 1000).toFixed(2)} km left on trail</NavStatPill>
            {distanceToTrack != null && (
              <NavStatPill>{Math.round(distanceToTrack)} m from line</NavStatPill>
            )}
            <CheckpointPill $kind="start">Start</CheckpointPill>
            <CheckpointPill $kind="finish">Finish</CheckpointPill>
          </NavStatsRow>
        </NavHud>
      )}

      {arrived && (
        <ArrivalScreen>
          <FiFlag size={80} style={{ marginBottom: '1.5rem' }} />
          <ArrivalTitle>Trail complete!</ArrivalTitle>
          <ArrivalSub>You reached the end of {route.name}</ArrivalSub>
          <ArrivalCloseBtn type="button" onClick={() => navigate(`/app/offroad/${tripId}`)}>
            Back to trip
          </ArrivalCloseBtn>
        </ArrivalScreen>
      )}
    </Screen>
  )
}

const LoadingScreen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 100dvh;
  padding: 2rem;
  text-align: center;
  color: ${({ theme }) => theme.colors.text[380]};
`

const BackLink = styled.button`
  border: none;
  background: ${({ theme }) => theme.colors.offroad.accent};
  color: #1a1408;
  font-weight: 700;
  padding: 0.65rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  cursor: pointer;
`

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #0d0f0d;
`

const NavBackButton = styled.button`
  position: absolute;
  top: max(1rem, env(safe-area-inset-top, 0px));
  left: 1rem;
  z-index: 1010;
  background: ${({ theme }) => theme.colors.offroad.accent};
  border: none;
  color: #1a1408;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
  cursor: pointer;
`

const ProximityGate = styled.div`
  position: absolute;
  bottom: max(1.5rem, env(safe-area-inset-bottom, 0px));
  left: 1rem;
  right: 1rem;
  z-index: 1010;
  padding: 1.25rem;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};
  backdrop-filter: blur(12px);
`

const ProximityTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.offroad.accent};
  margin-bottom: 0.5rem;
`

const ProximityText = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.5;
`

const NavHud = styled.div`
  position: absolute;
  top: max(4.5rem, calc(env(safe-area-inset-top, 0px) + 3rem));
  left: 1rem;
  right: 1rem;
  z-index: 1010;
`

const NavHudCard = styled.div`
  background: ${({ theme }) => theme.colors.surface[900]};
  color: ${({ theme }) => theme.colors.text[100]};
  padding: 1.25rem;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};
  backdrop-filter: blur(12px);
`

const ManeuverIcon = styled.div`
  font-size: 2.5rem;
  color: ${({ theme }) => theme.colors.offroad.accent};
`

const NavHudInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const RouteName = styled.div`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 0.25rem;
`

const NavInstruction = styled.div`
  font-size: 1.25rem;
  font-weight: 800;
`

const NavStatsRow = styled.div`
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const NavStatPill = styled.div`
  background: rgba(201, 162, 39, 0.15);
  color: ${({ theme }) => theme.colors.offroad.accent};
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
`

const CheckpointPill = styled.div<{ $kind: 'start' | 'finish' }>`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  background: ${({ $kind }) =>
    $kind === 'start' ? 'rgba(23, 247, 2, 0.12)' : 'rgba(239, 68, 68, 0.12)'};
  color: ${({ $kind }) => ($kind === 'start' ? '#5cf752' : '#f87171')};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $kind }) => ($kind === 'start' ? '#17f702' : '#ef4444')};
  }
`

const ArrivalScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1020;
  background: rgba(13, 15, 13, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text[100]};
  text-align: center;
  padding: 2rem;
`

const ArrivalTitle = styled.h2`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`

const ArrivalSub = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 2rem;
`

const ArrivalCloseBtn = styled.button`
  border: none;
  background: ${({ theme }) => theme.colors.offroad.accent};
  color: #1a1408;
  font-weight: 700;
  padding: 0.85rem 2rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  cursor: pointer;
`
