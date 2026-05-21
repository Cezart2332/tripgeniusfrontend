import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { FiNavigation, FiMapPin, FiLoader, FiZoomIn } from 'react-icons/fi'
import { SiGooglemaps, SiWaze, SiApple } from 'react-icons/si'
import type { TimelineStop } from '../types/models'
import { usePlaces } from '../hooks/usePlaces'
import { useMapTilePrefetch } from '../hooks/useMapTilePrefetch'
import { motion, AnimatePresence } from 'framer-motion'
import { OSM_STYLE } from '../map/osmStyle'
import { createMarkerElement, getPoiColor } from '../utils/mapMarkers'
import styled from 'styled-components'

interface TripRouteMapProps {
  timeline: TimelineStop[]
  selectedDay: number
  showOverlay?: boolean
}

const MapWrapper = styled.div`
  position: relative;
  height: 100%;
  min-height: 400px;
`

const MapContainer = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
`

const OverlayColumn = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const PoiBadge = styled.div`
  background: rgba(17, 34, 26, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(65, 162, 56, 0.3);
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const PoiLabel = styled.span`
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: 0.85rem;
  font-weight: 600;
`

const ZoomHint = styled.div`
  background: rgba(255, 165, 0, 0.9);
  color: #000;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`

const LoadingBanner = styled.div`
  background: rgba(17, 34, 26, 0.85);
  color: ${({ theme }) => theme.colors.green[500]};
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`

const NavArea = styled.div`
  position: absolute;
  bottom: 1.5rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 10;
`

const NavAnchor = styled.div`
  position: relative;
`

const NavButton = styled.button`
  border-radius: 30px;
  padding: 0.8rem 1.8rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  box-shadow: ${({ theme }) => theme.shadows.md};
  background: ${({ theme }) => theme.colors.green[580]};
  color: ${({ theme }) => theme.colors.text[100]};
  border: none;
  font-size: ${({ theme }) => theme.typography.body};
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.green[700]};
  }
`

const NavMenu = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 34, 26, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(65, 162, 56, 0.4);
  border-radius: 20px;
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
  width: 200px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  margin-bottom: 1rem;
`

const NavMenuItem = styled.button`
  width: 100%;
  justify-content: flex-start;
  gap: 1rem;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.6rem 0.8rem;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

const NavMenuDivider = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 0.25rem;
  padding-top: 0.25rem;
`

const NavMenuCancel = styled.button`
  width: 100%;
  border: none;
  font-size: 0.8rem;
  opacity: 0.6;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[380]};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: ${({ theme }) => theme.radii.md};
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 1;
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const SpinnerIcon = styled(FiLoader)`
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

export function TripRouteMap({ timeline, selectedDay, showOverlay = true }: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)

  const selectedStop = useMemo(
    () => timeline.find((stop) => stop.startDay === selectedDay) ?? timeline[0] ?? null,
    [selectedDay, timeline],
  )

  const mapLoadedRef = useRef(false)
  const poiMarkersRef = useRef<maplibregl.Marker[]>([])
  const staticMarkersRef = useRef<maplibregl.Marker[]>([])

  const { places, loading, zoomLevel } = usePlaces(mapInstance)
  useMapTilePrefetch(mapInstance)

  useEffect(() => {
    if (!mapInstance) return

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
        .addTo(mapInstance)

      poiMarkersRef.current.push(marker)
    })
  }, [places, mapInstance])

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
      setMapInstance(map)

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
      setMapInstance(null)
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once; selectedStop handled in separate effect
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapInstance || !selectedStop) return

    staticMarkersRef.current.forEach(m => m.remove())
    staticMarkersRef.current = []

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

            const coordinates = geometry.coordinates
            const bounds = coordinates.reduce((acc: maplibregl.LngLatBounds, coord: [number, number]) => {
              return acc.extend(coord)
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))

            map.fitBounds(bounds, {
              padding: { top: 80, bottom: 100, left: 50, right: 50 },
              maxZoom: 14,
              duration: 1200,
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch route:', err)
        map.flyTo({
          center: [selectedStop.toCoords[1], selectedStop.toCoords[0]],
          zoom: 14,
          essential: true
        })
      }
    }

    updateRoute()

    requestAnimationFrame(() => map.resize())
  }, [selectedStop, mapInstance])

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
    <MapWrapper>
      <MapContainer
        ref={containerRef}
        data-lenis-prevent
      />

      {showOverlay && (
        <OverlayColumn>
          <motion.div>
            <PoiBadge>
              <FiMapPin style={{ color: '#17f702' }} />
              <PoiLabel>Points of Interest</PoiLabel>
            </PoiBadge>
          </motion.div>

          {zoomLevel < 11 && (
            <ZoomHint>
              <FiZoomIn /> Zoom in for places
            </ZoomHint>
          )}

          {loading && (
            <LoadingBanner>
              <SpinnerIcon /> Fetching...
            </LoadingBanner>
          )}
        </OverlayColumn>
      )}

      {selectedStop && showOverlay && (
        <NavArea>
          <NavAnchor>
            <NavButton onClick={() => setIsNavOpen(!isNavOpen)}>
              <FiNavigation size={18} />
              Navigate
            </NavButton>

            <AnimatePresence>
              {isNavOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: -10, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                >
                  <NavMenu>
                    <NavMenuItem onClick={() => openExternalMap('google')}>
                      <SiGooglemaps style={{ color: '#4285F4' }} /> Google Maps
                    </NavMenuItem>
                    <NavMenuItem onClick={() => openExternalMap('waze')}>
                      <SiWaze style={{ color: '#33CCFF' }} /> Waze
                    </NavMenuItem>
                    <NavMenuItem onClick={() => openExternalMap('apple')}>
                      <SiApple style={{ color: '#FFF' }} /> Apple Maps
                    </NavMenuItem>
                    <NavMenuDivider>
                      <NavMenuCancel onClick={() => setIsNavOpen(false)}>
                        Cancel
                      </NavMenuCancel>
                    </NavMenuDivider>
                  </NavMenu>
                </motion.div>
              )}
            </AnimatePresence>
          </NavAnchor>
        </NavArea>
      )}
    </MapWrapper>
  )
}
