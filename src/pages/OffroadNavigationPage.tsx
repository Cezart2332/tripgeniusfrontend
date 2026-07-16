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
import {
  addUserLocationLayers,
  setUserLocationOnMap,
} from '../utils/mapUserLocation'

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
  const skipNextMapEaseRef = useRef(false)
  const hasFittedProximityViewRef = useRef(false)

  const [route, setRoute] = useState<OffroadRoute | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gpsWaitTimedOut, setGpsWaitTimedOut] = useState(false)

  const trackPoints = useMemo(
    () => (route ? lineStringToLngLatCoords(route.trackGeoJson) : []),
    [route]
  )

  const { position, error: geoError, supported } = useGeolocationWatch(Boolean(route))

  const mapCenterMode = useMemo<'pending' | 'user' | 'track'>(() => {
    if (!supported || geoError) return 'track'
    if (position) return 'user'
    if (gpsWaitTimedOut) return 'track'
    return 'pending'
  }, [supported, geoError, position, gpsWaitTimedOut])

  useEffect(() => {
    if (mapCenterMode !== 'pending') return
    const timeout = window.setTimeout(() => setGpsWaitTimedOut(true), 5000)
    return () => window.clearTimeout(timeout)
  }, [mapCenterMode])

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
      setGpsWaitTimedOut(false)
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
    if (mapCenterMode === 'pending') return

    const [startLng, startLat] = trackPoints[0]
    const useUserCenter = mapCenterMode === 'user' && position != null
    const initialCenter: [number, number] = useUserCenter
      ? [position.lng, position.lat]
      : [startLng, startLat]
    const initialZoom = useUserCenter ? 15 : 14

    if (useUserCenter) skipNextMapEaseRef.current = true

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFFROAD_MAP_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      pitch: useUserCenter ? 55 : 45,
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
        id: 'offroad-checkpoint-shadow',
        type: 'circle',
        source: 'offroad-checkpoints',
        paint: {
          'circle-radius': 24,
          'circle-color': '#0d0f0d',
          'circle-opacity': 0.92,
          'circle-blur': 0.15,
        },
      })
      map.addLayer({
        id: 'offroad-checkpoint-fill',
        type: 'circle',
        source: 'offroad-checkpoints',
        paint: {
          'circle-radius': 16,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'start',
            '#2e8d54',
            'finish',
            '#dc2626',
            offroadMapTrackColors.line,
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#f8faf8',
        },
      })

      addUserLocationLayers(map)
      if (position) setUserLocationOnMap(map, position)

      if (useUserCenter && position) {
        const bounds = new maplibregl.LngLatBounds()
        bounds.extend([position.lng, position.lat])
        trackPoints.forEach(([lng, lat]) => bounds.extend([lng, lat]))
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 0 })
      } else {
        const bounds = new maplibregl.LngLatBounds()
        trackPoints.forEach(([lng, lat]) => bounds.extend([lng, lat]))
        map.fitBounds(bounds, { padding: 80, maxZoom: 15 })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
      skipNextMapEaseRef.current = false
    }
  }, [trackPoints, mapCenterMode, position])

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
    if (!map || !position) return
    setUserLocationOnMap(map, position)
  }, [position])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !position || canStart || trackPoints.length < 2) return
    if (hasFittedProximityViewRef.current) return
    hasFittedProximityViewRef.current = true
    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([position.lng, position.lat])
    trackPoints.forEach(([lng, lat]) => bounds.extend([lng, lat]))
    map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 500 })
  }, [position, canStart, trackPoints])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !position || !canStart) return

    const lngLat: [number, number] = [position.lng, position.lat]
    if (skipNextMapEaseRef.current) {
      skipNextMapEaseRef.current = false
    } else {
      map.easeTo({
        center: lngLat,
        bearing: position.heading ?? map.getBearing(),
        duration: 800,
      })
    }
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
  color: #ffffff;
  font-weight: 700;
  padding: 0.65rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  cursor: pointer;
`

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #e7eee4;
`

const NavBackButton = styled.button`
  position: absolute;
  top: max(1rem, env(safe-area-inset-top, 0px));
  left: 1rem;
  z-index: 1010;
  background: ${({ theme }) => theme.colors.offroad.accent};
  border: none;
  color: #ffffff;
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
  background: rgba(168, 120, 31, 0.15);
  color: ${({ theme }) => theme.colors.offroad.accent};
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
`

const CheckpointPill = styled.div<{ $kind: 'start' | 'finish' }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background: ${({ $kind }) => ($kind === 'start' ? '#145214' : '#7f1d1d')};
  color: #f8faf8;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);

  &::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ $kind }) => ($kind === 'start' ? '#2e8d54' : '#ef4444')};
    border: 2px solid #f8faf8;
    flex-shrink: 0;
  }
`

const ArrivalScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1020;
  background: rgba(255, 255, 255, 0.92);
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
  color: #ffffff;
  font-weight: 700;
  padding: 0.85rem 2rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  cursor: pointer;
`
