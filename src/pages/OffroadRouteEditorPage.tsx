import maplibregl from 'maplibre-gl'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiSave, FiTrash2, FiUpload } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../data/api'
import { OFFROAD_MAP_STYLE } from '../map/osmStyle'
import {
  buildLineStringGeoJson3D,
  computeElevationStats,
  distanceAlongLngLatPoints,
  lineStringToLngLatCoords,
} from '../utils/coords'
import { fetchElevationsForLngLatPoints } from '../utils/elevationService'
import { getErrorMessage } from '../utils/errorMessage'
import { parseGpxBlob } from '../utils/gpx'

export function OffroadRouteEditorPage() {
  const { tripId, routeId } = useParams<{ tripId: string; routeId?: string }>()
  const navigate = useNavigate()
  const isNew = routeId === 'new' || !routeId
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [points, setPoints] = useState<[number, number][]>([]) // Stored as [lng, lat] for GeoJSON consistency
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(1)
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savePhase, setSavePhase] = useState<'idle' | 'elevation' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [gpxPreview, setGpxPreview] = useState<{ file: File; preview: { trackGeoJson: string; pointCount: number; distanceMeters: number } } | null>(null)

  // Load existing route data for editing
  useEffect(() => {
    if (isNew || !tripId || !routeId) return
    api
      .get(`api/OffroadTrip/route/${tripId}/${routeId}`)
      .then((res) => {
        const route = res.data
        setName(route.name)
        setNote(route.note)
        setStartDay(route.startDay)
        setEndDay(route.endDay)
        setDistanceMeters(route.distanceMeters)
        // lineStringToLngLatCoords returns [lng, lat] which is what we store
        const coords = lineStringToLngLatCoords(route.trackGeoJson)
        setPoints(coords)
      })
      .catch(() => {})
  }, [isNew, tripId, routeId])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OFFROAD_MAP_STYLE,
      center: [25.0, 45.9],
      zoom: 10,
      maxZoom: 17,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    // Add source and layer when map is loaded
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
        paint: { 'line-color': '#c9a227', 'line-width': 2.5, 'line-dasharray': [2, 1] },
      })
      // Add points markers layer
      map.addSource('draw-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'draw-points-layer',
        type: 'circle',
        source: 'draw-points',
        paint: { 'circle-radius': 6, 'circle-color': '#c9a227', 'circle-stroke-width': 2, 'circle-stroke-color': '#1a1408' },
      })
    }

    if (map.loaded()) {
      addSourceAndLayer()
    } else {
      map.on('load', addSourceAndLayer)
    }

    // Handle map clicks to add points
    map.on('click', (e) => {
      setPoints((prev) => {
        const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        return [...prev, newPoint]
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update map when points change
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

    // Auto-fit bounds to show all points
    if (points.length >= 2) {
      const bounds = new maplibregl.LngLatBounds()
      points.forEach(([lng, lat]) => bounds.extend([lng, lat]))
      map.fitBounds(bounds, { padding: 50, duration: 300 })
    }
  }, [points])

  // Preview GPX file locally
  const onGpxFile = async (file: File) => {
    try {
      const preview = await parseGpxBlob(file)
      setGpxPreview({ file, preview })
      // lineStringToLngLatCoords returns [lng, lat] coordinates
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

  // Upload GPX directly to server (direct import without preview)
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
      await api.post('api/OffroadTrip/import-route-gpx', form)
      navigate(`/app/offroad/${tripId}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Save drawn route (fetch terrain elevation, then persist 3D track)
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
        source: 1, // 1 = Drawn
        distanceMeters: finalDistance,
        elevationGainMeters: elevStats.gainMeters,
      }

      setSavePhase('saving')
      if (isNew) {
        await api.post('api/OffroadTrip/add-route', payload)
      } else {
        await api.patch('api/OffroadTrip/update-route', { ...payload, id: Number(routeId) })
      }
      navigate(`/app/offroad/${tripId}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
      setSavePhase('idle')
    }
  }

  return (
    <section className="page offroad-editor-page discovery-page-offroad">
      <Link to={`/app/offroad/${tripId}`} className="btn btn-ghost">
        <FiArrowLeft aria-hidden /> Back to trip
      </Link>

      <motion.header
        className="offroad-create-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>{isNew ? 'Add route' : 'Edit route'}</h1>
        <p className="lead">Click the map to place points, import GPX for preview, or upload GPX directly to the server.</p>
      </motion.header>

      <div className="offroad-editor-layout">
        <aside className="offroad-editor-sidebar">
          <p className="offroad-editor-hint">
            Click on the map to add points. Need at least 2 points to save a drawn route.
          </p>

          <label>
            Route name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Day 1 — forest climb" />
          </label>
          <label>
            Note
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mud, river crossing..." />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label>
              Start day
              <input className="input" type="number" min={1} value={startDay} onChange={(e) => setStartDay(Number(e.target.value))} />
            </label>
            <label>
              End day
              <input className="input" type="number" min={1} value={endDay} onChange={(e) => setEndDay(Number(e.target.value))} />
            </label>
          </div>

          {/* GPX Preview Section */}
          <div className="offroad-gpx-section">
            <label className="field-label">
              <FiUpload aria-hidden /> Import GPX file
            </label>
            <input
              className="input"
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  void onGpxFile(file)
                  e.target.value = '' // Reset input
                }
              }}
            />

            {gpxPreview && (
              <div className="offroad-gpx-preview">
                <p className="offroad-gpx-preview-title">
                  <FiUpload /> {gpxPreview.file.name}
                </p>
                <p className="muted">
                  {gpxPreview.preview.pointCount} points · {(gpxPreview.preview.distanceMeters / 1000).toFixed(1)} km
                </p>
                <div className="offroad-gpx-preview-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setGpxPreview(null)
                      setPoints([])
                      setDistanceMeters(0)
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={saving}
                    onClick={() => importGpxToServer(gpxPreview.file)}
                  >
                    {saving ? 'Uploading...' : 'Upload GPX'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {distanceMeters > 0 && !gpxPreview && (
            <p className="muted">Calculated distance: {(distanceMeters / 1000).toFixed(1)} km</p>
          )}

          {/* Drawing controls */}
          {!gpxPreview && (
            <div className="offroad-drawing-controls">
              <p className="offroad-point-count">{points.length} map points</p>
              <div className="offroad-drawing-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPoints([])} disabled={points.length === 0}>
                  <FiTrash2 aria-hidden /> Clear
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={points.length === 0}>
                  Undo
                </button>
              </div>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          {/* Save button for drawn routes */}
          {!gpxPreview && (
            <button type="button" className="btn btn-primary" disabled={saving || points.length < 2} onClick={saveDrawn}>
              <FiSave aria-hidden />{' '}
              {savePhase === 'elevation'
                ? 'Fetching elevation...'
                : saving
                  ? 'Saving...'
                  : 'Save drawn route'}
            </button>
          )}
        </aside>

        <div className="offroad-editor-map-wrap">
          <div ref={mapContainer} className="offroad-editor-map" />
        </div>
      </div>
    </section>
  )
}
