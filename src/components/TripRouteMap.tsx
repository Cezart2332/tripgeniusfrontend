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
  showOverlay?: boolean
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

export function TripRouteMap({ timeline, selectedDay, showOverlay = true }: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [isNavOpen, setIsNavOpen] = useState(false)
  // Track the live map instance so usePlaces() re-runs when the map becomes ready
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)

  const selectedStop = useMemo(
    () => timeline.find((stop) => stop.startDay === selectedDay) ?? timeline[0] ?? null,
    [selectedDay, timeline],
  )

  const mapLoadedRef = useRef(false)
  const poiMarkersRef = useRef<maplibregl.Marker[]>([])
  const staticMarkersRef = useRef<maplibregl.Marker[]>([])

  const getPoiColor = (kinds: string) => {
    // Premium, cohesive palette replacing generic Material colors
    if (kinds.includes('foods')) return '#d97706'; // Warm amber
    if (kinds.includes('accomodations')) return '#3b82f6'; // Muted blue
    if (kinds.includes('amusements')) return '#ec4899'; // Soft pink
    if (kinds.includes('sport')) return '#06b6d4'; // Soft cyan
    if (kinds.includes('tourist_facilities')) return '#f59e0b'; // Amber
    if (kinds.includes('historic') || kinds.includes('architecture')) return '#8b5cf6'; // Soft purple
    return '#41a238'; // Theme green (default)
  }

  const getMarkerIcon = (kinds: string) => {
    if (kinds.includes('foods')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V21M2 21V19C2 15.6863 4.68629 13 8 13V13C11.3137 13 14 15.6863 14 19V21M16 8C16 3.58172 19.5817 0 24 0V8H16Z"/></svg>'; // Simplified Utensils
    if (kinds.includes('accomodations')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>'; // Home
    if (kinds.includes('amusements')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'; // Star
    if (kinds.includes('sport')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>'; // Activity
    if (kinds.includes('tourist_facilities')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'; // Info
    if (kinds.includes('historic') || kinds.includes('architecture')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 10V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M7 10v4M11 10v4M15 10v4M19 10v4M3 14h18M5 14v7M19 14v7"></path></svg>'; // Columns/Historic
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'; // Pin
  }

  const createMarkerElement = (color: string, kinds: string, isSpecial?: 'start' | 'end') => {
    const el = document.createElement('div');
    el.className = 'custom-marker-wrapper';

    let icon = getMarkerIcon(kinds);
    if (isSpecial === 'start') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"></path></svg>'; // Play/Start
    } else if (isSpecial === 'end') {
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; // Clock/Arrival
    }

    el.innerHTML = `
      <div class="custom-map-marker" style="background-color: ${color}">
        <div class="marker-icon-inner">${icon}</div>
      </div>
    `;
    return el;
  };

  // usePlaces receives the live mapInstance (null until map fires 'load')
  // This ensures the hook properly re-registers move/zoom listeners
  const { places, loading, zoomLevel } = usePlaces(mapInstance)

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

      const el = createMarkerElement(getPoiColor(place.kinds), place.kinds);
      const marker = new maplibregl.Marker({ element: el })
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
      scrollZoom: true,
      cooperativeGestures: true,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      mapLoadedRef.current = true
      setMapInstance(map)  // triggers usePlaces to initialize with the ready map

      // Add route source and layer
      map.addSource('nav-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      map.addLayer({
        id: 'nav-route-bg',
        type: 'line',
        source: 'nav-route',
        paint: {
          'line-color': '#1a6013',
          'line-width': 8,
          'line-opacity': 0.6
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        }
      })

      map.addLayer({
        id: 'nav-route',
        type: 'line',
        source: 'nav-route',
        paint: {
          'line-color': '#41a238',
          'line-width': 4,
          'line-opacity': 1
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        }
      })

      map.resize()
    })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      setMapInstance(null)  // clear so usePlaces stops
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [])

  // Update markers and route line when selectedStop changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || !selectedStop) return

    // Clear static markers
    staticMarkersRef.current.forEach(m => m.remove())
    staticMarkersRef.current = []

    // 1. Update Markers
    const startEl = createMarkerElement('#f3fff1', '', 'start');
    const startMarker = new maplibregl.Marker({ element: startEl })
      .setLngLat([selectedStop.fromCoords[1], selectedStop.fromCoords[0]])
      .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<div style="color: #2c332b; padding: 5px;"><strong>Start Point</strong></div>'))
      .addTo(map)

    const endEl = createMarkerElement('#41a238', '', 'end');
    const endMarker = new maplibregl.Marker({ element: endEl })
      .setLngLat([selectedStop.toCoords[1], selectedStop.toCoords[0]])
      .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<div style="color: #2c332b; padding: 5px;"><strong>Destination</strong></div>'))
      .addTo(map)

    staticMarkersRef.current = [startMarker, endMarker]

    // 2. Fetch and Update Route Line
    const updateRoute = async () => {
      const from = selectedStop.fromCoords
      const to = selectedStop.toCoords

      try {
        const coordinateString = `${from[1]},${from[0]};${to[1]},${to[0]}`
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson`)
        const data = await res.json()

        if (data.routes && data.routes[0]) {
          const geometry = data.routes[0].geometry
          const source = map.getSource('nav-route') as maplibregl.GeoJSONSource
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: {},
                geometry: geometry
              }]
            })

            // 3. Fit bounds to route
            const coordinates = geometry.coordinates
            const bounds = coordinates.reduce((acc: maplibregl.LngLatBounds, coord: [number, number]) => {
              return acc.extend(coord)
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))

            map.fitBounds(bounds, {
              padding: { top: 80, bottom: 100, left: 50, right: 50 },
              duration: 1200
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch route:', err)
        // Fallback: Fly to destination if route fails
        map.flyTo({
          center: [selectedStop.toCoords[1], selectedStop.toCoords[0]],
          zoom: 14,
          essential: true
        })
      }
    }

    updateRoute()
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
      <div
        ref={containerRef}
        className="map-container"
        data-lenis-prevent
        style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }}
      />

      {/* POI Controls */}
      {showOverlay && (
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div 
            className="map-overlay-compact"
            style={{ background: 'rgba(17, 34, 26, 0.85)', backdropFilter: 'blur(10px)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(65, 162, 56, 0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
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
      )}

      {selectedStop && showOverlay && (
        <div style={{ position: 'absolute', bottom: '1.5rem', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-primary"
              style={{
                borderRadius: '30px',
                padding: '0.8rem 1.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: 'var(--shadow)',
              }}
              onClick={() => setIsNavOpen(!isNavOpen)}
            >
              <FiNavigation size={18} />
              Navigate
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
