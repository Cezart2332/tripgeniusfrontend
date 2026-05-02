import { motion } from 'framer-motion'
import { useState } from 'react'
import { FiArrowLeft, FiMapPin, FiCalendar } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { TimelineStop } from '../types/models'
import api from '../data/api'

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

const toBackendCoords = (coords: [number, number]): [number, number] => [
  coords[1],
  coords[0],
]

export function AddTimelinePage() {
  const navigate = useNavigate()
  const { tripId } = useParams<{ tripId: string }>()
  const mapboxPublicToken =
    (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined)?.trim() ?? ''

  const [timelineDraft, setTimelineDraft] = useState<TimelineStop>({
    id: 0,
    day: 1,
    date: '',
    startingPoint: '',
    endPoint: '',
    fromCoords: [0, 0],
    toCoords: [0, 0],
    note: '',
  })
  const [fromFocused, setFromFocused] = useState(false)
  const [toFocused, setToFocused] = useState(false)
  const [fromSuggestions, setFromSuggestions] = useState<LocationSuggestion[]>([])
  const [toSuggestions, setToSuggestions] = useState<LocationSuggestion[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const updateTimelineDraft = (updater: (previous: TimelineStop) => TimelineStop) => {
    setTimelineDraft((previous) => updater(previous))
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

    try
    {
      const payload = {
        ...timelineDraft,
        tripId,
        fromCoords: toBackendCoords(timelineDraft.fromCoords),
        toCoords: toBackendCoords(timelineDraft.toCoords),
      }
      const res = await api.post('api/trip/add-timeline', payload)

      if (res.status === 200) {
        setTimelineDraft(res.data)
        if (tripId) {
          navigate(`/app/trip/${tripId}?view=map`)
          return
        }
      }
    }
    catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
    navigate(-1)

  }

  const handleCancel = () => {
    navigate(`/app/trip/${tripId}?view=map`)
  }

  return (
    <section className="page add-timeline-page">
      <motion.header
        className="panel add-timeline-head"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={revealTransition}
      >
        <div className="add-timeline-header-content">
          <div>
            <p className="eyebrow">Add Trip Timeline</p>
            <h1>Create a new timeline stop</h1>
            <p>Define the route, date, and details for the next day in your trip.</p>
          </div>
          <Link className="btn btn-ghost add-timeline-back-link" to={`/app/trip/${tripId}?view=map`}>
            <FiArrowLeft aria-hidden="true" />
            Back to trip
          </Link>
        </div>
      </motion.header>

      <motion.section
        className="panel add-timeline-form-panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={revealTransition}
      >
        <form className="add-timeline-form" onSubmit={(e) => e.preventDefault()}>
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

          <div className="add-timeline-actions">
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
              {isSaving ? 'Saving...' : 'Add Timeline'}
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
