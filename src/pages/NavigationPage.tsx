import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import maplibregl from 'maplibre-gl'
import { FiArrowLeft, FiArrowUp, FiCornerUpLeft, FiCornerUpRight, FiFlag } from 'react-icons/fi'
import api from '../data/api'
import type { Trip } from '../types/models'
import { saveRouteToIndexedDB, getNearestCachedRoute, getAllRoutes } from '../utils/db'
import type { CachedRoute } from '../utils/db'
import { OSM_STYLE } from '../map/osmStyle'

interface NavigationStep {
  instruction: string
  distance: number
  location: [number, number]
  type: string
  modifier?: string
}

interface RouteData {
  coordinates: [number, number][]
  durationSeconds: number | null
  distanceMeters: number | null
  steps?: NavigationStep[]
}

interface OsrmManeuver {
  type: string
  modifier?: string
  location: [number, number]
}

interface OsrmStep {
  distance: number
  name?: string
  maneuver: OsrmManeuver
}

interface OsrmRoute {
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  duration: number
  distance: number
  legs: Array<{ steps: OsrmStep[] }>
}

const translateManeuver = (type: string, modifier?: string, name?: string): string => {
  const base = name && name !== '' ? name : ''
  
  switch (type) {
    case 'depart': return base || 'Start driving'
    case 'arrive': return 'You have arrived!'
    case 'turn':
      if (modifier === 'right') return `Turn right${base ? ' on ' + base : ''}`
      if (modifier === 'left') return `Turn left${base ? ' on ' + base : ''}`
      if (modifier === 'slight right') return `Slight right${base ? ' on ' + base : ''}`
      if (modifier === 'slight left') return `Slight left${base ? ' on ' + base : ''}`
      return `Turn${base ? ' on ' + base : ''}`
    case 'new name': return `Continue${base ? ' on ' + base : ''}`
    case 'roundabout': return `Enter roundabout${base ? ' on ' + base : ''}`
    case 'exit roundabout': return `Exit roundabout${base ? ' on ' + base : ''}`
    default: return `Continue driving${base ? ' on ' + base : ''}`
  }
}

const getManeuverIcon = (type: string, modifier?: string) => {
  if (type === 'arrive') return <FiFlag />
  if (modifier?.includes('left')) return <FiCornerUpLeft />
  if (modifier?.includes('right')) return <FiCornerUpRight />
  return <FiArrowUp />
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function NavigationPage() {
  const { tripId, day } = useParams<{ tripId: string, day: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [trip, setTrip] = useState<Trip | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [navData, setNavData] = useState<RouteData | null>(null)
  const [arrivalDetected, setArrivalDetected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [recentRoutes, setRecentRoutes] = useState<CachedRoute[]>([])
  const [lastCacheLocation, setLastCacheLocation] = useState<[number, number] | null>(null)
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null)

  const selectedStop = useMemo(() => {
    if (!trip) return null
    const dayNum = parseInt(day || '1')
    return trip.timelines.find(t => t.startDay === dayNum) || trip.timelines[0]
  }, [trip, day])

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const res = await api.get(`api/trip/get-trip/${tripId}`)
        setTrip(res.data)
      } catch (err) {
        console.error('Failed to load trip for navigation:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTrip()
  }, [tripId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !selectedStop) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [selectedStop.fromCoords[1], selectedStop.fromCoords[0]],
      zoom: 15,
      pitch: 60,
      scrollZoom: true,
      cooperativeGestures: true,
    })

    mapRef.current = map

    map.on('load', () => {
      map.addSource('nav-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'nav-route',
        type: 'line',
        source: 'nav-route',
        paint: { 'line-color': '#17f702', 'line-width': 10, 'line-opacity': 0.85 }
      })
    })

    return () => map.remove()
  }, [selectedStop])

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(newLoc)

        if (mapRef.current) {
          if (!userMarkerRef.current) {
            const el = document.createElement('div')
            el.className = 'user-waze-dot'
            userMarkerRef.current = new maplibregl.Marker(el)
              .setLngLat([newLoc[1], newLoc[0]])
              .addTo(mapRef.current)
          } else {
            userMarkerRef.current.setLngLat([newLoc[1], newLoc[0]])
          }

          mapRef.current.easeTo({ 
            center: [newLoc[1], newLoc[0]], 
            bearing: pos.coords.heading || 0,
            duration: 1000
          })
        }

        if (lastCacheLocation) {
          const distSinceLastCache = calculateDistance(newLoc[0], newLoc[1], lastCacheLocation[0], lastCacheLocation[1])
          if (distSinceLastCache >= 500) {
            updateRoute(newLoc)
          }
        } else {
          setLastCacheLocation(newLoc)
        }

        if (selectedStop) {
          const dist = calculateDistance(newLoc[0], newLoc[1], selectedStop.toCoords[0], selectedStop.toCoords[1])
          if (dist < 20) setArrivalDetected(true)
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 1000 }
    )

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => {
      setIsOffline(true)
      loadRecentRoutes()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      userMarkerRef.current?.remove()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geolocation watch; updateRoute invoked inline
  }, [selectedStop, lastCacheLocation])

  const loadRecentRoutes = async () => {
    const routes = await getAllRoutes()
    setRecentRoutes(routes.slice(0, 5))
  }

  const updateRoute = async (currentLoc?: [number, number], isManualSelection = false) => {
    const from = currentLoc || userLocation
    const to = selectedStop?.toCoords
    if (!from || !to) return

    try {
      const coordinateString = `${from[1]},${from[0]};${to[1]},${to[0]}`
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=true`)
      const data = await res.json()
      
      if (data.code === 'OFFLINE') {
        handleOfflineFallback(to[0], to[1])
        return
      }

      const firstRoute = data.routes?.[0]
      if (firstRoute) {
        processRouteData(firstRoute)
        saveRouteToIndexedDB(
          { lat: from[0], lng: from[1] },
          { lat: to[0], lng: to[1] },
          firstRoute
        )
        setLastCacheLocation(from)
        if (isManualSelection) setOfflineWarning("Route may be inaccurate — reconnect to recalculate")
      }
    } catch (e) {
      console.error('Route update failed', e)
      handleOfflineFallback(to[0], to[1])
    }
  }

  const handleOfflineFallback = async (lat: number, lng: number) => {
    const cached = await getNearestCachedRoute(lat, lng)
    if (cached) {
      processRouteData(cached.routeData as OsrmRoute)
      setOfflineWarning("Route may be inaccurate — reconnect to recalculate")
    }
  }

  const processRouteData = (firstRoute: OsrmRoute) => {
    if (!mapRef.current) return

    const steps: NavigationStep[] = firstRoute.legs[0].steps.map((s) => ({
      instruction: translateManeuver(s.maneuver.type, s.maneuver.modifier, s.name),
      distance: s.distance,
      location: s.maneuver.location,
      type: s.maneuver.type,
      modifier: s.maneuver.modifier
    }))

    setNavData({
      coordinates: firstRoute.geometry.coordinates,
      durationSeconds: firstRoute.duration,
      distanceMeters: firstRoute.distance,
      steps
    })

    const source = mapRef.current.getSource('nav-route') as maplibregl.GeoJSONSource
    source?.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: firstRoute.geometry
      }]
    })
  }

  useEffect(() => {
    if (!userLocation || !selectedStop) return

    updateRoute()
    const interval = setInterval(() => updateRoute(), 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateRoute is stable for location/stop changes
  }, [userLocation, selectedStop])

  if (isLoading) return <LoadingScreen>Loading navigation system...</LoadingScreen>

  return (
    <Screen>
      <div ref={containerRef} data-lenis-prevent style={{ width: '100%', height: '100%' }} />

      <NavBackButton onClick={() => navigate(-1)}>
        <FiArrowLeft size={28} />
      </NavBackButton>

      {navData && navData.steps && navData.steps.length > 0 && (
        <NavHud>
          <NavHudCard>
            <ManeuverIcon>
              {getManeuverIcon(navData.steps[0].type, navData.steps[0].modifier)}
            </ManeuverIcon>
            <NavHudInfo>
              <NavInstruction>{navData.steps[0].instruction}</NavInstruction>
              <NavDistance>In {Math.round(navData.steps[0].distance)} m</NavDistance>
            </NavHudInfo>
            {isOffline && (
              <OfflineBadge>
                Offline
              </OfflineBadge>
            )}
          </NavHudCard>
          
          {offlineWarning && isOffline && (
            <OfflineWarningBar>
              {offlineWarning}
            </OfflineWarningBar>
          )}

          <NavStatsRow>
             <NavStatPill>
                {(navData.distanceMeters! / 1000).toFixed(1)} km left
             </NavStatPill>
             <NavStatPill>
                ETA: {Math.round(navData.durationSeconds! / 60)} min
             </NavStatPill>
          </NavStatsRow>
        </NavHud>
      )}

      {isOffline && (
        <OfflineBanner>
          <OfflineBannerHeader>
            <OfflineBannerEmoji>⚠️</OfflineBannerEmoji>
            <OfflineBannerTitle>You are offline</OfflineBannerTitle>
          </OfflineBannerHeader>
          
          <OfflineBannerSub>Recently cached routes:</OfflineBannerSub>
          
          <CachedRoutesList>
            {recentRoutes.length > 0 ? recentRoutes.map((r) => (
              <CachedRouteBtn 
                key={r.id} 
                onClick={() => {
                  processRouteData(r.routeData as OsrmRoute)
                  setOfflineWarning("Route may be inaccurate — reconnect to recalculate")
                }}
              >
                To {r.end.lat.toFixed(4)}, {r.end.lng.toFixed(4)} ({new Date(r.timestamp).toLocaleTimeString('en-US')})
              </CachedRouteBtn>
            )) : (
              <NoRoutesMsg>No saved routes found.</NoRoutesMsg>
            )}
          </CachedRoutesList>
        </OfflineBanner>
      )}

      {arrivalDetected && (
        <ArrivalScreen>
           <FiFlag size={80} style={{ marginBottom: '1.5rem' }} />
           <ArrivalTitle>You have arrived!</ArrivalTitle>
           <ArrivalCloseBtn onClick={() => navigate(-1)}>
             Close
           </ArrivalCloseBtn>
        </ArrivalScreen>
      )}
    </Screen>
  )
}

// --- Styled Components ---

const LoadingScreen = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.body};
`

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #000;
`

const NavBackButton = styled.button`
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 1010;
  background: #2563eb;
  border: none;
  color: #fff;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  cursor: pointer;
`

const NavHud = styled.div`
  position: absolute;
  top: 4rem;
  left: 1rem;
  right: 1rem;
  z-index: 1010;

  @media (max-width: 600px) {
    top: 1rem;
  }
`

const NavHudCard = styled.div`
  background: ${({ theme }) => theme.colors.surface[900]};
  color: ${({ theme }) => theme.colors.text[100]};
  padding: 1.25rem;
  border-radius: 16px;
  box-shadow: ${({ theme }) => theme.shadows.md};
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid ${({ theme }) => theme.colors.line};
  backdrop-filter: blur(12px);

  @media (max-width: 600px) {
    padding: 0.75rem;
    gap: 0.75rem;
  }
`

const ManeuverIcon = styled.div`
  font-size: 2.5rem;
  color: ${({ theme }) => theme.colors.green[580]};

  @media (max-width: 600px) {
    font-size: 1.8rem;
  }
`

const NavHudInfo = styled.div`
  flex: 1;
`

const NavInstruction = styled.div`
  font-size: 1.4rem;
  font-weight: 800;

  @media (max-width: 600px) {
    font-size: 1.1rem;
  }
`

const NavDistance = styled.div`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text[380]};
`

const OfflineBadge = styled.div`
  background: ${({ theme }) => theme.colors.danger[500]};
  color: ${({ theme }) => theme.colors.text[100]};
  padding: 0.3rem 0.6rem;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
`

const OfflineWarningBar = styled.div`
  background: rgba(219, 74, 91, 0.2);
  color: ${({ theme }) => theme.colors.danger[500]};
  border: 1px solid rgba(219, 74, 91, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  text-align: center;
  backdrop-filter: blur(8px);
`

const NavStatsRow = styled.div`
  margin-top: 0.75rem;
  display: flex;
  gap: 0.75rem;
`

const NavStatPill = styled.div`
  background: ${({ theme }) => theme.colors.surface[900]};
  color: ${({ theme }) => theme.colors.text[100]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
`

const OfflineBanner = styled.div`
  position: absolute;
  bottom: 2rem;
  left: 1rem;
  right: 1rem;
  z-index: 1050;
  background: ${({ theme }) => theme.colors.surface[900]};
  color: ${({ theme }) => theme.colors.text[100]};
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: ${({ theme }) => theme.shadows.md};
  border: 1px solid rgba(219, 74, 91, 0.4);
  backdrop-filter: blur(12px);
`

const OfflineBannerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
`

const OfflineBannerEmoji = styled.span`
  font-size: 1.5rem;
`

const OfflineBannerTitle = styled.div`
  font-size: 1.2rem;
  font-weight: 800;
`

const OfflineBannerSub = styled.div`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 1rem;
`

const CachedRoutesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const CachedRouteBtn = styled.button`
  background: ${({ theme }) => theme.colors.surface[860]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  color: ${({ theme }) => theme.colors.text[100]};
  padding: 0.75rem 1rem;
  border-radius: 12px;
  text-align: left;
  font-size: 0.85rem;
  cursor: pointer;

  &:hover {
    background: rgba(65, 162, 56, 0.08);
  }
`

const NoRoutesMsg = styled.div`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text[380]};
`

const ArrivalScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2000;
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  backdrop-filter: blur(10px);
`

const ArrivalTitle = styled.h1`
  font-size: 2.5rem;
`

const ArrivalCloseBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  line-height: 1;
  margin-top: 2rem;
  background: ${({ theme }) => theme.colors.text[100]};
  color: ${({ theme }) => theme.colors.green[700]};
  padding: 1rem 3rem;
  font-size: 1.2rem;
  border: none;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.text[220]};
  }
`
