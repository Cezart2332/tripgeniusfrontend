import { motion } from 'framer-motion'
import { useState } from 'react'
import { FiArrowLeft, FiMapPin, FiCalendar, FiActivity, FiPlusCircle, FiTrash2 } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ActivityType } from '../types/models'
import type { TimelineStop } from '../types/models'
import api from '../data/api'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState } from '../components/FeedbackToast'
import { isQueuedRequestError } from '../utils/errorMessage'

interface LocationSelection {
  name: string
  placeName: string
  lng: number
  lat: number
}

interface LocationSuggestion extends LocationSelection {
  id: string
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

  const [timelineDraft, setTimelineDraft] = useState<TimelineStop>({
    id: 0,
    startDay: 1,
    endDay: 1,
    date: '',
    startingPoint: '',
    endPoint: '',
    fromCoords: [0, 0],
    toCoords: [0, 0],
    note: '',
    activities: [],
  })
  const [fromFocused, setFromFocused] = useState(false)
  const [toFocused, setToFocused] = useState(false)
  const [fromSuggestions, setFromSuggestions] = useState<LocationSuggestion[]>([])
  const [toSuggestions, setToSuggestions] = useState<LocationSuggestion[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)

  const updateTimelineDraft = (updater: (previous: TimelineStop) => TimelineStop) => {
    setTimelineDraft((previous) => updater(previous))
  }

  const searchLocations = async (query: string, field: 'startingPoint' | 'endingPoint') => {
    if (query.length < 3) {
      if (field === 'startingPoint') {
        setFromSuggestions([])
      } else {
        setToSuggestions([])
      }
      return
    }

    try {
      const res = await api.get('/api/geocoding/search', {
        params: { query, limit: 6 }
      })
      const suggestions = res.data as LocationSuggestion[]

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
        startDay: timelineDraft.startDay,
        endDay: timelineDraft.endDay,
        startingPoint: timelineDraft.startingPoint,
        endPoint: timelineDraft.endPoint,
        fromCoords: toBackendCoords(timelineDraft.fromCoords),
        toCoords: toBackendCoords(timelineDraft.toCoords),
        note: timelineDraft.note,
        activities: timelineDraft.activities.map(a => ({
          name: a.name,
          description: a.description,
          link: a.link || '',
          cost: a.cost,
          type: a.type
        })),
        tripId,
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
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        setToast({ id: Date.now(), message: 'Timeline stop will be added when online!', tone: 'success' })
        setTimeout(() => navigate(`/app/trip/${tripId}?view=map`), 2000)
      } else {
        console.error(err)
      }
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
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
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

            <div className="builder-grid-v2">
              <div className="form-group">
                <label className="field-label" htmlFor="startDay">
                  <FiCalendar aria-hidden="true" />
                  Start Day
                </label>
                <input
                  id="startDay"
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={timelineDraft.startDay || ''}
                  onChange={(e) =>
                    updateTimelineDraft((previous) => ({
                      ...previous,
                      startDay: Number.parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="endDay">
                  <FiCalendar aria-hidden="true" />
                  End Day
                </label>
                <input
                  id="endDay"
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={timelineDraft.endDay || ''}
                  onChange={(e) =>
                    updateTimelineDraft((previous) => ({
                      ...previous,
                      endDay: Number.parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {/* Activities Section */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--line-soft)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-100)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <FiActivity size={16} /> Activities
                  </h4>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => updateTimelineDraft(p => ({ 
                      ...p, 
                      activities: [...p.activities, { id: 0, name: '', description: '', link: '', cost: 0, type: ActivityType.Attraction }] 
                    }))}
                  >
                     <FiPlusCircle /> Add
                  </button>
               </div>

               <div style={{ display: 'grid', gap: '1rem' }}>
                  {timelineDraft.activities.map((act, j) => (
                    <div key={j} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--line-soft)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <input 
                            className="input" 
                            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--line-soft)', borderRadius: 0, paddingLeft: 0, fontSize: '0.9rem', fontWeight: 600 }} 
                            placeholder="Activity name..." 
                            value={act.name} 
                            onChange={e => updateTimelineDraft(p => ({
                              ...p,
                              activities: p.activities.map((a, aidx) => aidx === j ? { ...a, name: e.target.value } : a)
                            }))}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => updateTimelineDraft(p => ({
                            ...p,
                            activities: p.activities.filter((_, aidx) => aidx !== j)
                          }))}>
                             <FiTrash2 size={14} />
                          </button>
                       </div>
                       <div className="builder-grid-v2">
                          <div className="form-group">
                             <label className="field-label" style={{ fontSize: '0.75rem' }}>Type</label>
                             <select 
                               className="input" 
                               style={{ fontSize: '0.8rem' }}
                               value={act.type}
                               onChange={e => updateTimelineDraft(p => ({
                                 ...p,
                                 activities: p.activities.map((a, aidx) => aidx === j ? { ...a, type: Number(e.target.value) as ActivityType } : a)
                               }))}
                             >
                                <option value={ActivityType.Attraction}>Attraction</option>
                                <option value={ActivityType.Food}>Food</option>
                                <option value={ActivityType.Accommodation}>Accommodation</option>
                                <option value={ActivityType.Transport}>Transport</option>
                                <option value={ActivityType.Other}>Other</option>
                             </select>
                          </div>
                          <div className="form-group">
                             <label className="field-label" style={{ fontSize: '0.75rem' }}>Cost (EUR)</label>
                             <input 
                               type="number" 
                               className="input" 
                               style={{ fontSize: '0.8rem' }}
                               value={act.cost || ''}
                               onChange={e => updateTimelineDraft(p => ({
                                 ...p,
                                 activities: p.activities.map((a, aidx) => aidx === j ? { ...a, cost: Number(e.target.value) } : a)
                               }))}
                             />
                          </div>
                       </div>
                       <div className="form-group" style={{ marginTop: '0.5rem' }}>
                          <label className="field-label" style={{ fontSize: '0.75rem' }}>Description</label>
                          <textarea 
                            className="input" 
                            rows={2} 
                            style={{ fontSize: '0.8rem' }}
                            placeholder="Brief details..." 
                            value={act.description}
                            onChange={e => updateTimelineDraft(p => ({
                              ...p,
                              activities: p.activities.map((a, aidx) => aidx === j ? { ...a, description: e.target.value } : a)
                            }))}
                          />
                       </div>
                       <div className="form-group" style={{ marginTop: '0.5rem' }}>
                          <label className="field-label" style={{ fontSize: '0.75rem' }}>External Link</label>
                          <input 
                            className="input" 
                            style={{ fontSize: '0.8rem' }}
                            placeholder="https://..." 
                            value={act.link || ''}
                            onChange={e => updateTimelineDraft(p => ({
                              ...p,
                              activities: p.activities.map((a, aidx) => aidx === j ? { ...a, link: e.target.value } : a)
                            }))}
                          />
                       </div>
                    </div>
                  ))}
               </div>
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
