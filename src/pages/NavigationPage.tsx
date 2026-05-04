import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { FiArrowLeft, FiArrowUp, FiCornerUpLeft, FiCornerUpRight, FiFlag } from 'react-icons/fi'
import api from '../data/api'
import type { Trip } from '../types/models'

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
  const base = name && name !== '' ? ` pe ${name}` : ''
  switch (type) {
    case 'depart': return `Porniți la drum${base}`
    case 'arrive': return 'Ați ajuns la destinație'
    case 'turn':
      if (modifier === 'right') return `Virați la dreapta${base}`
      if (modifier === 'left') return `Virați la stânga${base}`
      if (modifier === 'slight right') return `Virați ușor la dreapta${base}`
      if (modifier === 'slight left') return `Virați ușor la stânga${base}`
      return `Virați${base}`
    case 'new name': return `Continuați${base}`
    case 'roundabout': return `Intrați în sensul giratoriu${base}`
    case 'exit roundabout': return `Ieșiți din sensul giratoriu${base}`
    default: return `Continuați drumul${base}`
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

  const selectedStop = useMemo(() => {
    if (!trip) return null
    const dayNum = parseInt(day || '1')
    return trip.timelines.find(t => t.day === dayNum) || trip.timelines[0]
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

        // Arrival Check
        if (selectedStop) {
          const dist = calculateDistance(newLoc[0], newLoc[1], selectedStop.toCoords[0], selectedStop.toCoords[1])
          if (dist < 20) setArrivalDetected(true)
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 1000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      userMarkerRef.current?.remove()
    }
  }, [selectedStop])

  // Route Updates
  useEffect(() => {
    if (!userLocation || !selectedStop) return

    const updateRoute = async () => {
      try {
        const from = userLocation
        const to = selectedStop.toCoords
        const coordinateString = `${from[1]},${from[0]};${to[1]},${to[0]}`
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=true`)
        const data = await res.json()
        
        const firstRoute = data.routes?.[0]
        if (firstRoute && mapRef.current) {
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
      } catch (e) {
        console.error('Route update failed', e)
      }
    }

    updateRoute()
    const interval = setInterval(updateRoute, 10000)
    return () => clearInterval(interval)
  }, [userLocation, selectedStop])

  if (isLoading) return <div className="nav-page-loading">Se încarcă sistemul de navigație...</div>

  return (
    <div className="navigation-screen" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

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
          <div style={{ background: '#1e293b', color: '#fff', padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(23, 247, 2, 0.2)' }}>
            <div style={{ fontSize: '2.5rem', color: '#17f702' }}>
              {getManeuverIcon(navData.steps[0].type, navData.steps[0].modifier)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{navData.steps[0].instruction}</div>
              <div style={{ fontSize: '1rem', opacity: 0.8 }}>Peste {Math.round(navData.steps[0].distance)} m</div>
            </div>
            {!navigator.onLine && (
              <div style={{ background: '#db4a5b', color: '#fff', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                Offline
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
             <div style={{ background: 'rgba(30, 41, 59, 0.95)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 700 }}>
                {(navData.distanceMeters! / 1000).toFixed(1)} km rămași
             </div>
             <div style={{ background: 'rgba(30, 41, 59, 0.95)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 700 }}>
                ETA: {Math.round(navData.durationSeconds! / 60)} min
             </div>
          </div>
        </div>
      )}

      {arrivalDetected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2000, background: 'rgba(22, 163, 74, 0.9)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
           <FiFlag size={80} style={{ marginBottom: '1.5rem' }} />
           <h1 style={{ fontSize: '2.5rem' }}>Ați ajuns la destinație!</h1>
           <button 
             className="btn btn-primary" 
             style={{ marginTop: '2rem', background: '#fff', color: '#16a34a', padding: '1rem 3rem', fontSize: '1.2rem' }} 
             onClick={() => navigate(-1)}
           >
             Închide
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
