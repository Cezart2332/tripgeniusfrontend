import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiArrowLeft, FiMapPin, FiCalendar } from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../data/api'
import type { TimelineStop } from '../types/models'

interface LocationSelection {
  name: string
  placeName: string
  lng: number
  lat: number
}

interface LocationSuggestion extends LocationSelection {
  id: string
}

interface MapboxFeature {
  id: string
  text: string
  place_name: string
  center: [number, number]
}

interface MapboxGeocodingResponse {
  features?: MapboxFeature[]
}

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

const getCoordinateCaption = (lng: string, lat: string): string => {
  const parsedLng = Number(lng)
  const parsedLat = Number(lat)

  if (!Number.isFinite(parsedLng) || !Number.isFinite(parsedLat)) {
    return 'No coordinates yet. Select a location from the search list.'
  }

  return `Lng ${parsedLng.toFixed(5)} / Lat ${parsedLat.toFixed(5)}`
}

const toMapboxCoords = (coords?: number[]): [number, number] => {
  const backendLat = Number(coords?.[0])
  const backendLng = Number(coords?.[1])

  if (!Number.isFinite(backendLat) || !Number.isFinite(backendLng)) {
    return [0, 0]
  }

  return [backendLng, backendLat]
}

export function EditTimelinePage() {
  const navigate = useNavigate()
  const { tripId, id } = useParams<{ tripId: string; id: string }>()
  const mapboxPublicToken =
    (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined)?.trim() ?? ''

  const [loading, setLoading] = useState(true)
  const [timelineDraft, setTimelineDraft] = useState<TimelineStop | null>(null)
  const [fromFocused, setFromFocused] = useState(false)
  const [toFocused, setToFocused] = useState(false)
  const [fromSuggestions, setFromSuggestions] = useState<LocationSuggestion[]>([])
  const [toSuggestions, setToSuggestions] = useState<LocationSuggestion[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!tripId || !id) {
      setLoading(false)
      return
    }

    let isMounted = true

    interface TimelineDto {
      id: number
      day: number
      date?: string
      startingPoint?: string
      endPoint?: string
      fromCoords?: number[]
      toCoords?: number[]
      note?: string
    }

    const fetchTimeline = async () => {
      try {
        const res = await api.get<TimelineDto>(`api/trip/timeline/${tripId}/${id}`)
        if (!isMounted) {
          return
        }

        const timeline = res.data
        setTimelineDraft({
          id: timeline.id,
          day: timeline.day,
          date: timeline.date ?? '',
          startingPoint: timeline.startingPoint ?? '',
          endPoint: timeline.endPoint ?? '',
          fromCoords: toMapboxCoords(timeline.fromCoords),
          toCoords: toMapboxCoords(timeline.toCoords),
          note: timeline.note ?? '',
        })
        setLoading(false)
      } catch (error) {
        if (!isMounted) {
          return
        }

        console.error('Failed to fetch timeline:', error)
        setLoading(false)
      }
    }

    fetchTimeline()

    return () => {
      isMounted = false
    }
  }, [tripId, id])

  const updateTimelineDraft = (updater: (previous: TimelineStop) => TimelineStop) => {
    setTimelineDraft((previous) => {
      if (!previous) {
        return previous
      }

      return updater(previous)
    })
  }

  const searchLocations = async (query: string, field: 'startingPoint' | 'endingPoint') => {
    if (!mapboxPublicToken || query.length < 2) {
      if (field === 'startingPoint') {
        setFromSuggestions([])
      } else {
        setToSuggestions([])
      }
      return
    }

    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query,
      )}.json?autocomplete=true&limit=6&types=place,locality,address,poi&access_token=${mapboxPublicToken}`

      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Location search failed')

      const payload = (await response.json()) as MapboxGeocodingResponse
      const suggestions = (payload.features ?? [])
        .map((feature) => ({
          id: feature.id,
          name: feature.text || feature.place_name,
          placeName: feature.place_name,
          lng: Number(feature.center?.[0]),
          lat: Number(feature.center?.[1]),
        }))
        .filter(
          (feature) =>
            Number.isFinite(feature.lng) &&
            Number.isFinite(feature.lat) &&
            feature.placeName,
        )

      if (field === 'startingPoint') {
        setFromSuggestions(suggestions)
      } else {
        setToSuggestions(suggestions)
      }
    } catch (error) {
      console.error('Location search error:', error)
    }
  }

  const handleLocationSelect = (selection: LocationSelection, field: 'startingPoint' | 'endingPoint') => {
    if (field === 'startingPoint') {
      updateTimelineDraft((previous) => ({
        ...previous,
        startingPoint: selection.placeName,
        fromCoords: [selection.lng, selection.lat],
      }))
      setFromSuggestions([])
      setFromFocused(false)
    } else {
      updateTimelineDraft((previous) => ({
        ...previous,
        endPoint: selection.placeName,
        toCoords: [selection.lng, selection.lat],
      }))
      setToSuggestions([])
      setToFocused(false)
    }
  }

  const handleStartingPointChange = (value: string) => {
    updateTimelineDraft((previous) => ({
      ...previous,
      startingPoint: value,
      fromCoords: [0, 0],
    }))
    searchLocations(value, 'startingPoint')
  }

  const handleEndingPointChange = (value: string) => {
    updateTimelineDraft((previous) => ({
      ...previous,
      endPoint: value,
      toCoords: [0, 0],
    }))
    searchLocations(value, 'endingPoint')
  }

  const handleSave = async () => {
    if (isSaving) {
      return
    }

    setIsSaving(true)

    try {
      const payload = {
        id: timelineDraft?.id,
        tripId,
        day: timelineDraft?.day,
        startingPoint: timelineDraft?.startingPoint,
        endPoint: timelineDraft?.endPoint,
        fromCoords: timelineDraft?.fromCoords ? [timelineDraft.fromCoords[1], timelineDraft.fromCoords[0]] : undefined,
        toCoords: timelineDraft?.toCoords ? [timelineDraft.toCoords[1], timelineDraft.toCoords[0]] : undefined,
        note: timelineDraft?.note,
      }

      const res = await api.patch('api/trip/update-timeline', payload)

      if (res.status === 200) {
        setTimelineDraft(res.data)
        if (tripId) {
          navigate(`/app/trip/${tripId}?view=map`)
          return
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
    navigate(-1)
  }

  const handleCancel = () => {
    if (tripId) {
      navigate(`/app/trip/${tripId}?view=map`)
      return
    }

    navigate(-1)
  }

  if (loading) {
    return (
      <section className="page edit-timeline-page">
        <section className="panel">
          <p className="eyebrow">Timeline Editor</p>
          <h1>Loading timeline details</h1>
          <p>Please wait while we fetch the timeline data...</p>
        </section>
      </section>
    )
  }

  if (!timelineDraft) {
    return (
      <section className="page edit-timeline-page">
        <section className="panel">
          <p className="eyebrow">Timeline Editor</p>
          <h1>Timeline unavailable</h1>
          <p>We could not load this timeline stop.</p>
          <button type="button" className="btn btn-primary" onClick={handleCancel}>
            Back to trip
          </button>
        </section>
      </section>
    )
  }

  return (
    <section className="page edit-timeline-page">
      <motion.header
        className="panel edit-timeline-head"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={revealTransition}
      >
        <div className="edit-timeline-header-content">
          <div>
            <p className="eyebrow">Edit Trip Timeline</p>
            <h1>Timeline #{id}</h1>
            <p>Update the route, date, and details for this timeline stop.</p>
          </div>
          <button type="button" className="btn btn-ghost edit-timeline-back-link" onClick={handleCancel}>
            <FiArrowLeft aria-hidden="true" />
            Back to trip
          </button>
        </div>
      </motion.header>

      <motion.section
        className="panel edit-timeline-form-panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={revealTransition}
      >
        <form className="edit-timeline-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Route Details</legend>

            <div className="form-group">
              <label className="field-label" htmlFor="starting-point">
                <FiMapPin aria-hidden="true" />
                Starting Point
              </label>
              <div className="location-autocomplete">
                <div className="location-input-shell">
                  <input
                    id="starting-point"
                    className="input location-input"
                    type="text"
                    placeholder="Search location..."
                    value={timelineDraft.startingPoint}
                    onChange={(e) => handleStartingPointChange(e.target.value)}
                    onFocus={() => setFromFocused(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setFromFocused(false)
                      }, 120)
                    }}
                  />
                </div>
                {fromFocused && fromSuggestions.length > 0 ? (
                  <div className="location-dropdown">
                    {fromSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="location-option"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleLocationSelect(suggestion, 'startingPoint')
                        }}
                      >
                        <span className="location-option-main">{suggestion.name}</span>
                        <span className="location-option-sub">{suggestion.placeName}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {timelineDraft.fromCoords ? (
                <p className="location-meta">
                  {getCoordinateCaption(String(timelineDraft.fromCoords[0]), String(timelineDraft.fromCoords[1]))}
                </p>
              ) : null}
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="ending-point">
                <FiMapPin aria-hidden="true" />
                Ending Point
              </label>
              <div className="location-autocomplete">
                <div className="location-input-shell">
                  <input
                    id="ending-point"
                    className="input location-input"
                    type="text"
                    placeholder="Search location..."
                    value={timelineDraft.endPoint}
                    onChange={(e) => handleEndingPointChange(e.target.value)}
                    onFocus={() => setToFocused(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setToFocused(false)
                      }, 120)
                    }}
                  />
                </div>
                {toFocused && toSuggestions.length > 0 ? (
                  <div className="location-dropdown">
                    {toSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="location-option"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleLocationSelect(suggestion, 'endingPoint')
                        }}
                      >
                        <span className="location-option-main">{suggestion.name}</span>
                        <span className="location-option-sub">{suggestion.placeName}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {timelineDraft.toCoords ? (
                <p className="location-meta">
                  {getCoordinateCaption(String(timelineDraft.toCoords[0]), String(timelineDraft.toCoords[1]))}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset>
            <legend>Additional Information</legend>

            <div className="form-group">
              <label className="field-label" htmlFor="day">
                <FiCalendar aria-hidden="true" />
                Day
              </label>
              <input
                id="day"
                className="input"
                type="number"
                min={1}
                step={1}
                value={timelineDraft.day}
                onChange={(e) =>
                  updateTimelineDraft((previous) => ({
                    ...previous,
                    day: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="note">
                Notes
              </label>
              <textarea
                id="note"
                className="input"
                placeholder="Add any notes or highlights for this day..."
                rows={4}
                  value={timelineDraft.note}
                  onChange={(e) => updateTimelineDraft((previous) => ({ ...previous, note: e.target.value }))}
              />
            </div>
          </fieldset>

          <div className="edit-timeline-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isSaving}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <p className="info-banner">
          This timeline editor is UI-only. To persist changes, connect this form to your backend API.
        </p>
      </motion.section>
    </section>
  )
}
