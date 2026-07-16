import maplibregl from 'maplibre-gl'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiSave, FiTrash2, FiUpload } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import api from '../data/api'
import { OFFROAD_MAP_STYLE } from '../map/osmStyle'
import { DEFAULT_MAP_CENTER, getInitialMapLocation } from '../utils/mapInitialCenter'
import { offroadMapTrackColors } from '../styles/theme'
import {
  buildLineStringGeoJson3D,
  computeElevationStats,
  distanceAlongLngLatPoints,
  lineStringToLngLatCoords,
} from '../utils/coords'
import { fetchElevationsForLngLatPoints } from '../utils/elevationService'
import { getErrorMessage } from '../utils/errorMessage'
import { parseGpxBlob } from '../utils/gpx'
import {
  cacheOffroadRouteForOffline,
  getOffroadRoute,
  getOffroadTrip,
} from '../utils/offroadTripCache'
import type { OffroadRoute } from '../types/models'

export function OffroadRouteEditorPage() {
  const { tripId, routeId } = useParams<{ tripId: string; routeId?: string }>()
  const navigate = useNavigate()
  const isNew = routeId === 'new' || !routeId
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [points, setPoints] = useState<[number, number][]>([])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(1)
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savePhase, setSavePhase] = useState<'idle' | 'elevation' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [gpxPreview, setGpxPreview] = useState<{ file: File; preview: { trackGeoJson: string; pointCount: number; distanceMeters: number } } | null>(null)

  useEffect(() => {
    if (isNew || !tripId || !routeId) return
    let cancelled = false

    const hydrateFromRoute = (route: OffroadRoute) => {
      setName(route.name)
      setNote(route.note)
      setStartDay(route.startDay)
      setEndDay(route.endDay)
      setDistanceMeters(Math.round(route.distanceMeters))
      const coords = lineStringToLngLatCoords(route.trackGeoJson)
      setPoints(coords)
    }

    const load = async () => {
      try {
        const res = await api.get<OffroadRoute>(`api/OffroadTrip/route/${tripId}/${routeId}`)
        if (cancelled) return
        const route = res.data
        hydrateFromRoute(route)
        await cacheOffroadRouteForOffline(tripId, route)
      } catch {
        let route = await getOffroadRoute(tripId, routeId)
        if (!route) {
          const trip = await getOffroadTrip(tripId)
          route = trip?.routes?.find((r) => String(r.id) === routeId) ?? null
        }
        if (cancelled || !route) return
        hydrateFromRoute(route)
        await cacheOffroadRouteForOffline(tripId, route)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isNew, tripId, routeId])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    let cancelled = false

    void (async () => {
      const initial = await getInitialMapLocation()
      if (cancelled || !mapContainer.current || mapRef.current) return

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: OFFROAD_MAP_STYLE,
        center: initial?.center ?? DEFAULT_MAP_CENTER,
        zoom: initial?.zoom ?? 10,
        maxZoom: 17,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
      mapRef.current = map

      const addSourceAndLayer = () => {
        if (map.getSource('draw-line')) return
        map.addSource('draw-line', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        })
        map.addLayer({
          id: 'draw-line-casing',
          type: 'line',
          source: 'draw-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
        })
        map.addLayer({
          id: 'draw-line-layer',
          type: 'line',
          source: 'draw-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#1b5e3a', 'line-width': 5 },
        })
        map.addLayer({
          id: 'draw-line-accent',
          type: 'line',
          source: 'draw-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': offroadMapTrackColors.line, 'line-width': 2.5, 'line-dasharray': [2, 1] },
        })
        map.addSource('draw-points', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'draw-points-layer',
          type: 'circle',
          source: 'draw-points',
          paint: {
            'circle-radius': 6,
            'circle-color': offroadMapTrackColors.line,
            'circle-stroke-width': 2,
            'circle-stroke-color': offroadMapTrackColors.pointStroke,
          },
        })
      }

      if (map.loaded()) {
        addSourceAndLayer()
      } else {
        map.on('load', addSourceAndLayer)
      }

      map.on('click', (e) => {
        setPoints((prev) => {
          const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat]
          return [...prev, newPoint]
        })
      })
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const el = mapContainer.current
    const map = mapRef.current
    if (!el || !map) return

    const resize = () => map.resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)

    const onVisible = (entries: IntersectionObserverEntry[]) => {
      if (entries.some((e) => e.isIntersecting)) resize()
    }
    const visibilityObserver = new IntersectionObserver(onVisible, { threshold: 0.1 })
    visibilityObserver.observe(el)

    return () => {
      observer.disconnect()
      visibilityObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const lineSource = map.getSource('draw-line') as maplibregl.GeoJSONSource | undefined
    const pointsSource = map.getSource('draw-points') as maplibregl.GeoJSONSource | undefined

    if (lineSource) {
      lineSource.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: points },
      })
    }

    if (pointsSource) {
      pointsSource.setData({
        type: 'FeatureCollection',
        features: points.map((coord, index) => ({
          type: 'Feature',
          properties: { index },
          geometry: { type: 'Point', coordinates: coord },
        })),
      })
    }

    if (points.length >= 2) {
      const bounds = new maplibregl.LngLatBounds()
      points.forEach(([lng, lat]) => bounds.extend([lng, lat]))
      map.fitBounds(bounds, { padding: 50, duration: 300 })
    }
  }, [points])

  const onGpxFile = async (file: File) => {
    try {
      const preview = await parseGpxBlob(file)
      setGpxPreview({ file, preview })
      const coords = lineStringToLngLatCoords(preview.trackGeoJson)
      setPoints(coords)
      setDistanceMeters(preview.distanceMeters)
      if (!name) setName(file.name.replace(/\.gpx$/i, ''))
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
      setGpxPreview(null)
    }
  }

  const importGpxToServer = async (file: File) => {
    const form = new FormData()
    form.append('tripId', tripId!)
    form.append('startDay', String(startDay))
    form.append('endDay', String(endDay))
    form.append('name', name || file.name.replace(/\.gpx$/i, ''))
    form.append('note', note)
    form.append('gpx', file)
    setSaving(true)
    try {
      const res = await api.post<OffroadRoute>('api/OffroadTrip/import-route-gpx', form)
      await cacheOffroadRouteForOffline(tripId!, res.data)
      navigate(`/app/offroad/${tripId}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const saveDrawn = async () => {
    if (points.length < 2) {
      setError('Add at least two points on the map.')
      return
    }

    setError(null)
    setSaving(true)
    setSavePhase('elevation')

    try {
      const elevations = await fetchElevationsForLngLatPoints(points)
      const trackGeoJson = buildLineStringGeoJson3D(points, elevations)
      const elevStats = computeElevationStats(trackGeoJson)
      const finalDistance =
        distanceMeters > 0 ? distanceMeters : Math.round(distanceAlongLngLatPoints(points))

      const payload = {
        tripId: Number(tripId),
        startDay,
        endDay,
        name: name || 'Drawn route',
        note,
        trackGeoJson,
        source: 1,
        distanceMeters: finalDistance,
        elevationGainMeters: elevStats.gainMeters,
      }

      setSavePhase('saving')
      const res = isNew
        ? await api.post<OffroadRoute>('api/OffroadTrip/add-route', payload)
        : await api.patch<OffroadRoute>('api/OffroadTrip/update-route', { ...payload, id: Number(routeId) })
      const saved = res.data
      await cacheOffroadRouteForOffline(tripId!, saved)
      navigate(`/app/offroad/${tripId}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
      setSavePhase('idle')
    }
  }

  return (
    <PageSection>
      <BackLink to={`/app/offroad/${tripId}`}>
        <FiArrowLeft aria-hidden /> Back to trip
      </BackLink>

      <EditorHeader initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1>{isNew ? 'Add route' : 'Edit route'}</h1>
        <LeadText>Click the map to place points, import GPX for preview, or upload GPX directly to the server.</LeadText>
      </EditorHeader>

      <EditorLayout>
        <EditorSidebar>
          <HintText>
            Click on the map to add points. Need at least 2 points to save a drawn route.
          </HintText>

          <FieldLabel>
            Route name
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Day 1 — forest climb" />
          </FieldLabel>
          <FieldLabel>
            Note
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mud, river crossing..." />
          </FieldLabel>
          <DaysGrid>
            <FieldLabel>
              Start day
              <Input type="number" min={1} value={startDay} onChange={(e) => setStartDay(Number(e.target.value))} />
            </FieldLabel>
            <FieldLabel>
              End day
              <Input type="number" min={1} value={endDay} onChange={(e) => setEndDay(Number(e.target.value))} />
            </FieldLabel>
          </DaysGrid>

          <GpxSection>
            <GpxFieldLabel>
              <FiUpload aria-hidden /> Import GPX file
            </GpxFieldLabel>
            <GpxFileInput
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  void onGpxFile(file)
                  e.target.value = ''
                }
              }}
            />

            {gpxPreview && (
              <GpxPreviewCard>
                <GpxPreviewTitle>
                  <FiUpload /> {gpxPreview.file.name}
                </GpxPreviewTitle>
                <MutedText>
                  {gpxPreview.preview.pointCount} points · {(gpxPreview.preview.distanceMeters / 1000).toFixed(1)} km
                </MutedText>
                <GpxPreviewActions>
                  <GhostBtnSm
                    type="button"
                    onClick={() => {
                      setGpxPreview(null)
                      setPoints([])
                      setDistanceMeters(0)
                    }}
                  >
                    Clear
                  </GhostBtnSm>
                  <PrimaryBtnSm
                    type="button"
                    disabled={saving}
                    onClick={() => importGpxToServer(gpxPreview.file)}
                  >
                    {saving ? 'Uploading...' : 'Upload GPX'}
                  </PrimaryBtnSm>
                </GpxPreviewActions>
              </GpxPreviewCard>
            )}
          </GpxSection>

          {distanceMeters > 0 && !gpxPreview && (
            <DistanceLabel>Calculated distance: {(distanceMeters / 1000).toFixed(1)} km</DistanceLabel>
          )}

          {!gpxPreview && (
            <DrawingControls>
              <PointCount>{points.length} map points</PointCount>
              <DrawingActions>
                <GhostBtnSm type="button" onClick={() => setPoints([])} disabled={points.length === 0}>
                  <FiTrash2 aria-hidden /> Clear
                </GhostBtnSm>
                <GhostBtnSm type="button" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={points.length === 0}>
                  Undo
                </GhostBtnSm>
              </DrawingActions>
            </DrawingControls>
          )}

          {error && <ErrorText>{error}</ErrorText>}

          {!gpxPreview && (
            <PrimaryBtn type="button" disabled={saving || points.length < 2} onClick={saveDrawn}>
              <FiSave aria-hidden />{' '}
              {savePhase === 'elevation'
                ? 'Fetching elevation...'
                : saving
                  ? 'Saving...'
                  : 'Save drawn route'}
            </PrimaryBtn>
          )}
        </EditorSidebar>

        <EditorMapWrap>
          <EditorMap ref={mapContainer} data-lenis-prevent />
        </EditorMapWrap>
      </EditorLayout>
    </PageSection>
  )
}

// --- Styled Components ---

const PageSection = styled.section`
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1200px, 100% - 1rem);
    padding-bottom: 7rem;
    gap: ${({ theme }) => theme.spacing.md};
  }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.55rem 1.2rem;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  align-self: flex-start;

  &:hover {
    background: rgba(46, 141, 84, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const EditorHeader = styled(motion.header)`
  padding-bottom: ${({ theme }) => theme.spacing.sm};

  h1 { color: ${({ theme }) => theme.colors.text[100]}; }
`

const LeadText = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 560px;
  line-height: 1.6;
`

const EditorLayout = styled.div`
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: start;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.lg};
  }
`

const EditorSidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    order: 2;
  }
`

const HintText = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.5;
`

const FieldLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  font-weight: 500;
`

const Input = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  display: block;
  margin-top: 0.35rem;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.1);
  }
`

const DaysGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
`

const GpxSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const GpxFieldLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[220]};
  display: flex;
  align-items: center;
  gap: 0.35rem;
`

const GpxFileInput = styled.input`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
`

const GpxPreviewCard = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.md};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const GpxPreviewTitle = styled.p`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[100]};
`

const MutedText = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.caption};
`

const GpxPreviewActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
`

const GhostBtnSm = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:hover {
    background: rgba(46, 141, 84, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`

const PrimaryBtnSm = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #ffffff;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  border: none;
  cursor: pointer;

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
  &:disabled { opacity: 0.5; transform: none; box-shadow: none; cursor: not-allowed; }
`

const PrimaryBtn = styled(PrimaryBtnSm)`
  padding: 0.65rem 1.5rem;
  min-height: 44px;
  font-size: ${({ theme }) => theme.typography.body};
`

const DistanceLabel = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const DrawingControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const PointCount = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const DrawingActions = styled.div`
  display: flex;
  gap: 0.5rem;
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.danger[500]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const EditorMapWrap = styled.div`
  border-radius: ${({ theme }) => theme.radii.xl};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.glass.border};
  min-height: 420px;
  height: 520px;
  position: sticky;
  top: 1rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    order: 1;
    position: relative;
    top: auto;
    height: min(52dvh, 420px);
    min-height: 280px;
    flex-shrink: 0;
    touch-action: pan-x pan-y pinch-zoom;
  }
`

const EditorMap = styled.div`
  width: 100%;
  height: 100%;
  min-height: 280px;
`
