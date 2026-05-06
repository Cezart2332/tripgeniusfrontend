import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { FiNavigation, FiMapPin, FiLoader, FiZoomIn } from 'react-icons/fi'
import { SiGooglemaps, SiWaze, SiApple } from 'react-icons/si'
import type { TimelineStop } from '../types/models'
import { usePlaces } from '../hooks/usePlaces'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [isNavOpen, setIsNavOpen] = useState(false)
  
  const selectedStop = useMemo(
    () => timeline.find((stop) => stop.day === selectedDay) ?? timeline[0] ?? null,
    [selectedDay, timeline],
  )

  const mapLoadedRef = useRef(false)
  const poiMarkersRef = useRef<maplibregl.Marker[]>([])
  const staticMarkersRef = useRef<maplibregl.Marker[]>([])
  
  const getPoiColor = (kinds: string) => {
    if (kinds.includes('foods')) return '#ff9800'; // Orange
    if (kinds.includes('accomodations')) return '#2196f3'; // Blue
    if (kinds.includes('amusements')) return '#e91e63'; // Pink
    if (kinds.includes('sport')) return '#00bcd4'; // Cyan
    if (kinds.includes('tourist_facilities')) return '#ffc107'; // Amber
    return '#41a238'; // Green (default)
  }

  const { places, loading, zoomLevel } = usePlaces(mapRef.current)

  // Sync POI markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    poiMarkersRef.current.forEach(m => m.remove())
    poiMarkersRef.current = []

    places.filter(p => p.name).forEach(place => {
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="color: #2c332b; padding: 5px;">
          <strong style="display: block; margin-bottom: 4px;">${place.name}</strong>
          <small style="color: #666; text-transform: capitalize;">${place.kinds.replace(/_/g, ' ')}</small>
        </div>`
      )

      const marker = new maplibregl.Marker({ color: getPoiColor(place.kinds) })
        .setLngLat([place.point.lon, place.point.lat])
        .setPopup(popup)
        .addTo(map)

      poiMarkersRef.current.push(marker)
    })
  }, [places])

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: selectedStop ? [selectedStop.toCoords[1], selectedStop.toCoords[0]] : [26.1025, 44.4268],
      zoom: 13,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      mapLoadedRef.current = true
      map.resize()
    })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [])

  // Update center and static markers when selectedStop changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || !selectedStop) return

    // Clear static markers
    staticMarkersRef.current.forEach(m => m.remove())
    staticMarkersRef.current = []

    // Fly to end point
    map.flyTo({
      center: [selectedStop.toCoords[1], selectedStop.toCoords[0]],
      zoom: 14,
      essential: true
    })

    // Add Start marker
    const startMarker = new maplibregl.Marker({ color: '#ff4444' })
      .setLngLat([selectedStop.fromCoords[1], selectedStop.fromCoords[0]])
      .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<strong>Start Point</strong>'))
      .addTo(map)
    
    // Add End marker
    const endMarker = new maplibregl.Marker({ color: '#2563eb' })
      .setLngLat([selectedStop.toCoords[1], selectedStop.toCoords[0]])
      .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<strong>Destination</strong>'))
      .addTo(map)

    staticMarkersRef.current = [startMarker, endMarker]
  }, [selectedStop])

  const openExternalMap = (type: 'google' | 'waze' | 'apple') => {
    if (!selectedStop) return;
    const [lat, lon] = selectedStop.toCoords;
    let url = '';
    if (type === 'google') url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    if (type === 'waze') url = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    if (type === 'apple') url = `http://maps.apple.com/?daddr=${lat},${lon}`;
    window.open(url, '_blank');
    setIsNavOpen(false);
  };

  return (
    <div className="map-wrapper" style={{ position: 'relative', height: '100%', minHeight: '400px' }}>
      <div ref={containerRef} className="map-container" style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }} />
      
      {/* POI Controls */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ background: 'rgba(17, 34, 26, 0.85)', backdropFilter: 'blur(10px)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(65, 162, 56, 0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FiMapPin style={{ color: 'var(--green-500)' }} />
          <span style={{ color: 'var(--text-100)', fontSize: '0.85rem', fontWeight: 600 }}>Points of Interest</span>
        </div>

        {zoomLevel < 12 && (
          <div style={{ background: 'rgba(255, 165, 0, 0.9)', color: '#000', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FiZoomIn /> Zoom in for places
          </div>
        )}

        {loading && (
          <div style={{ background: 'rgba(17, 34, 26, 0.85)', color: 'var(--green-500)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FiLoader className="spin" /> Fetching...
          </div>
        )}
      </div>

      {selectedStop && (
        <div style={{ position: 'absolute', bottom: '1.5rem', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ position: 'relative' }}>
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
              onClick={() => setIsNavOpen(!isNavOpen)}
            >
              <FiNavigation size={20} />
              Open in Maps
            </button>

            <AnimatePresence>
              {isNavOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: -10, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  style={{ 
                    position: 'absolute', 
                    bottom: '100%', 
                    left: '50%', 
                    translateX: '-50%',
                    background: 'rgba(17, 34, 26, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(65, 162, 56, 0.4)',
                    borderRadius: '20px',
                    padding: '0.75rem',
                    display: 'grid',
                    gap: '0.5rem',
                    width: '200px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    marginBottom: '1rem'
                  }}
                >
                  <button onClick={() => openExternalMap('google')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '1rem', border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                    <SiGooglemaps style={{ color: '#4285F4' }} /> Google Maps
                  </button>
                  <button onClick={() => openExternalMap('waze')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '1rem', border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                    <SiWaze style={{ color: '#33CCFF' }} /> Waze
                  </button>
                  <button onClick={() => openExternalMap('apple')} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '1rem', border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                    <SiApple style={{ color: '#FFF' }} /> Apple Maps
                  </button>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                    <button onClick={() => setIsNavOpen(false)} className="btn btn-ghost" style={{ width: '100%', border: 'none', fontSize: '0.8rem', opacity: 0.6 }}>
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
