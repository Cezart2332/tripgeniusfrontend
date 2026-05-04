import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { FiNavigation } from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'
import type { TimelineStop } from '../types/models'

interface TripRouteMapProps {
  timeline: TimelineStop[]
  selectedDay: number
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

export function TripRouteMap({ timeline, selectedDay }: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()

  const selectedStop = useMemo(
    () => timeline.find((stop) => stop.day === selectedDay) ?? timeline[0] ?? null,
    [selectedDay, timeline],
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !selectedStop) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [selectedStop.fromCoords[1], selectedStop.fromCoords[0]],
      zoom: 12,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('load', async () => {
      // Draw simple route preview
      try {
        const coordinateString = `${selectedStop.fromCoords[1]},${selectedStop.fromCoords[0]};${selectedStop.toCoords[1]},${selectedStop.toCoords[0]}`
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson`)
        const data = await res.json()
        const route = data.routes?.[0]
        
        if (route) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          })

          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#17f702',
              'line-width': 6,
              'line-opacity': 0.8
            }
          })

          // Fit bounds
          const bounds = new maplibregl.LngLatBounds()
          route.geometry.coordinates.forEach((c: [number, number]) => bounds.extend(c))
          map.fitBounds(bounds, { padding: 50 })
        }
      } catch (e) {
        console.error('Failed to draw preview route', e)
      }
    })

    return () => map.remove()
  }, [selectedStop])

  return (
    <div className="map-wrapper" style={{ position: 'relative', height: '100%', minHeight: '400px' }}>
      <div ref={containerRef} className="map-container" style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }} />
      
      {selectedStop && (
        <div style={{ position: 'absolute', bottom: '1.5rem', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <button 
            className="btn btn-primary" 
            style={{ 
              borderRadius: '50px', 
              padding: '0.8rem 2.2rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              fontSize: '1.1rem',
              fontWeight: 800,
              boxShadow: '0 12px 30px rgba(37, 99, 235, 0.5)',
              background: '#2563eb',
              backgroundColor: '#2563eb',
              border: 'none',
              color: '#ffffff',
            }}
            onClick={() => navigate(`/navigation/${tripId}/${selectedDay}`)}
          >
            <FiNavigation size={20} />
            Începe acum!
          </button>
        </div>
      )}
    </div>
  )
}
