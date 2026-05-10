import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { FiArrowLeft, FiArrowUp, FiCornerUpLeft, FiCornerUpRight, FiFlag } from 'react-icons/fi'
import api from '../data/api'
import type { Trip } from '../types/models'
import { saveRouteToIndexedDB, getNearestCachedRoute, getAllRoutes } from '../utils/db'
import type { CachedRoute } from '../utils/db'

// Reuse OSRM logic
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

const OSM_STYLE: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © CARTO',
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

  // Fetch Trip Data
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

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !selectedStop) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [selectedStop.fromCoords[1], selectedStop.fromCoords[0]],
      zoom: 15,
      pitch: 60,
      scrollZoom: true,
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

  // Geolocation & User Dot
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(newLoc)

        // Update User Marker (The "Dot")
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

          // Follow user
          mapRef.current.easeTo({ 
            center: [newLoc[1], newLoc[0]], 
            bearing: pos.coords.heading || 0,
            duration: 1000
          })
        }

        // 500m Re-cache logic
        if (lastCacheLocation) {
          const distSinceLastCache = calculateDistance(newLoc[0], newLoc[1], lastCacheLocation[0], lastCacheLocation[1])
          if (distSinceLastCache >= 500) {
            updateRoute(newLoc)
          }
        } else {
          setLastCacheLocation(newLoc)
        }

        // Arrival Check
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
        // Save to IndexedDB
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
      processRouteData(cached.routeData)
      setOfflineWarning("Route may be inaccurate — reconnect to recalculate")
    }
  }

  const processRouteData = (firstRoute: any) => {
    if (!mapRef.current) return

    const steps: NavigationStep[] = firstRoute.legs[0].steps.map((s: any) => ({
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

  // Route Updates
  useEffect(() => {
    if (!userLocation || !selectedStop) return

    updateRoute()
    const interval = setInterval(() => updateRoute(), 10000)
    return () => clearInterval(interval)
  }, [userLocation, selectedStop])

  if (isLoading) return <div className="nav-page-loading">Loading navigation system...</div>

  return (
    <div className="navigation-screen" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000' }}>
      <div ref={containerRef} data-lenis-prevent style={{ width: '100%', height: '100%' }} />

      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        style={{ 
          position: 'absolute', 
          top: '1.5rem', 
          left: '1.5rem', 
          zIndex: 1010, 
          background: '#2563eb', 
          border: 'none', 
          color: '#fff', 
          width: '50px', 
          height: '50px', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}
      >
        <FiArrowLeft size={28} />
      </button>

      {/* Navigation HUD */}
      {navData && navData.steps && navData.steps.length > 0 && (
        <div className="nav-hud-v2" style={{ position: 'absolute', top: '4rem', left: '1rem', right: '1rem', zIndex: 1010 }}>
          <div style={{ background: 'var(--surface-900)', color: 'var(--text-100)', padding: '1.25rem', borderRadius: '16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--line)', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--green-580)' }}>
              {getManeuverIcon(navData.steps[0].type, navData.steps[0].modifier)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{navData.steps[0].instruction}</div>
              <div style={{ fontSize: '1rem', color: 'var(--text-380)' }}>In {Math.round(navData.steps[0].distance)} m</div>
            </div>
            {isOffline && (
              <div style={{ background: 'var(--danger-500)', color: 'var(--text-100)', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                Offline
              </div>
            )}
          </div>
          
          {offlineWarning && isOffline && (
            <div style={{ background: 'rgba(219, 74, 91, 0.2)', color: 'var(--danger-500)', border: '1px solid rgba(219, 74, 91, 0.3)', padding: '0.5rem 1rem', borderRadius: '12px', marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              {offlineWarning}
            </div>
          )}

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
             <div style={{ background: 'var(--surface-900)', color: 'var(--text-100)', border: '1px solid var(--line-soft)', padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 700, backdropFilter: 'blur(8px)' }}>
                {(navData.distanceMeters! / 1000).toFixed(1)} km left
             </div>
             <div style={{ background: 'var(--surface-900)', color: 'var(--text-100)', border: '1px solid var(--line-soft)', padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 700, backdropFilter: 'blur(8px)' }}>
                ETA: {Math.round(navData.durationSeconds! / 60)} min
             </div>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div id="offline-banner" style={{ position: 'absolute', bottom: '2rem', left: '1rem', right: '1rem', zIndex: 1050, background: 'var(--surface-900)', color: 'var(--text-100)', padding: '1.5rem', borderRadius: '20px', boxShadow: 'var(--shadow)', border: '1px solid rgba(219, 74, 91, 0.4)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>You are offline</div>
          </div>
          
          <div style={{ fontSize: '0.9rem', color: 'var(--text-380)', marginBottom: '1rem' }}>Recently cached routes:</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentRoutes.length > 0 ? recentRoutes.map((r) => (
              <button 
                key={r.id} 
                onClick={() => {
                  processRouteData(r.routeData)
                  setOfflineWarning("Route may be inaccurate — reconnect to recalculate")
                }}
                className="btn btn-ghost"
                style={{ background: 'var(--surface-860)', border: '1px solid var(--line-soft)', color: 'var(--text-100)', padding: '0.75rem 1rem', borderRadius: '12px', textAlign: 'left', fontSize: '0.85rem' }}
              >
                To {r.end.lat.toFixed(4)}, {r.end.lng.toFixed(4)} ({new Date(r.timestamp).toLocaleTimeString('en-US')})
              </button>
            )) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-380)' }}>No saved routes found.</div>
            )}
          </div>
        </div>
      )}

      {arrivalDetected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2000, background: 'var(--bg-940)', color: 'var(--text-100)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', backdropFilter: 'blur(10px)' }}>
           <FiFlag size={80} style={{ marginBottom: '1.5rem' }} />
           <h1 style={{ fontSize: '2.5rem' }}>You have arrived!</h1>
           <button 
             className="btn btn-primary" 
             style={{ marginTop: '2rem', background: 'var(--text-100)', color: 'var(--green-700)', padding: '1rem 3rem', fontSize: '1.2rem' }} 
             onClick={() => navigate(-1)}
           >
             Close
           </button>
        </div>
      )}

      <style>{`
        .user-waze-dot {
          width: 24px;
          height: 24px;
          background: #17f702;
          border: 3px solid #fff;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(23, 247, 2, 0.8);
          position: relative;
        }
        .user-waze-dot::after {
          content: '';
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 12px solid #17f702;
        }
      `}</style>
    </div>
  )
}
