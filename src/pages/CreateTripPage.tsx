import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import {
  FiArrowLeft,
  FiCalendar,
  FiUploadCloud,
  FiX,
  FiPlusCircle,
  FiTrash2,
  FiCheckCircle,
  FiTag,
  FiActivity
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import { ActivityType } from '../types/models'
import { useSelector } from 'react-redux'
import type { TripStatus, User } from '../types/models'
import api from '../data/api'
import { FeedbackToast } from '../components/FeedbackToast'
import { getErrorMessage, isQueuedRequestError } from '../utils/errorMessage'
import type { FeedbackToastState } from '../components/FeedbackToast'
import { ModalSurface } from '../components/ModalSurface'
import { LocationAutocompleteField } from '../components/LocationAutocompleteField'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

interface TripActivityDraft {
  name: string
  description: string
  link?: string
  cost?: number
  type: ActivityType
}

interface TimelineDraftStop {
  startDay: number
  endDay: number
  from: string
  to: string
  fromLng: string
  fromLat: string
  toLng: string
  toLat: string
  note: string
  activities: TripActivityDraft[]
}

interface CreateTripFormState {
  title: string
  description: string
  status: TripStatus
  startDate: string
  endDate: string
  budgetPerPerson: number
  maxMembers: number
  tags: string[]
  customTag: string
  coverImageDataUrl: string
  coverImageFileName: string
  coverImageFile: File | null
  timeline: TimelineDraftStop[]
}



interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type CalendarTarget =
  | { kind: 'trip'; field: 'startDate' | 'endDate' }

interface CalendarState {
  target: CalendarTarget
  monthCursor: Date
}

type BuilderStep = 'details' | 'timeline' | 'overview'

const builderSteps: Array<{ key: BuilderStep; label: string; description: string }> = [
  { key: 'details', label: 'Identity', description: 'Define the core of your trip' },
  { key: 'timeline', label: 'Route', description: 'Chart the coordinates and stops' },
  { key: 'overview', label: 'Review', description: 'Final inspection before launch' },
]

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

const builderPaneTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as const,
}


const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

const dateLabelFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})


const getDateOffset = (offset: number): string => {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + offset)
  return formatLocalDate(nextDate)
}

const createTimelineStopDraft = (index: number = 0): TimelineDraftStop => ({
  startDay: index + 1,
  endDay: index + 1,
  from: '',
  to: '',
  fromLng: '',
  fromLat: '',
  toLng: '',
  toLat: '',
  note: '',
  activities: [],
})

const createInitialFormState = (): CreateTripFormState => {
  const startDate = getDateOffset(7)
  const endDate = getDateOffset(10)

  return {
    title: '',
    description: '',
    status: 'Upcoming',
    startDate,
    endDate,
    budgetPerPerson: 900,
    maxMembers: 8,
    tags: ['adventure'],
    customTag: '',
    coverImageDataUrl: '',
    coverImageFileName: 'No image selected',
    coverImageFile: null,
    timeline: [createTimelineStopDraft(0)],
  }
}


const parseLocalDate = (value: string): Date | null => {
  const [yearValue, monthValue, dayValue] = value.split('-').map(Number)
  if (!yearValue || !monthValue || !dayValue) return null
  const date = new Date(yearValue, monthValue - 1, dayValue)
  if (date.getFullYear() !== yearValue || date.getMonth() !== monthValue - 1 || date.getDate() !== dayValue) return null
  return date
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateLabel = (value: string): string => {
  const parsedDate = parseLocalDate(value)
  if (!parsedDate) return 'Select date'
  return dateLabelFormatter.format(parsedDate)
}

const buildCalendarCells = (monthCursor: Date): Array<Date | null> => {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingEmptyCells = firstDay.getDay()
  const cells: Array<Date | null> = Array.from({ length: leadingEmptyCells }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day))
  }
  return cells
}

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

export function CreateTripPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)

  const [formState, setFormState] = useState<CreateTripFormState>(createInitialFormState)
  const [activeStep, setActiveStep] = useState<BuilderStep>('details')
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPublishingTrip, setIsPublishingTrip] = useState(false)
  const [calendarState, setCalendarState] = useState<CalendarState | null>(null)

  const activeIndex = builderSteps.findIndex(s => s.key === activeStep)
  const isFirst = activeIndex === 0
  const isLast = activeIndex === builderSteps.length - 1

  const calendarCells = useMemo(() => calendarState ? buildCalendarCells(calendarState.monthCursor) : [], [calendarState])
  const selectedCalendarDate = useMemo(() => calendarState ? parseLocalDate(formState[calendarState.target.field]) : null, [calendarState, formState])

  const openCalendar = (field: 'startDate' | 'endDate') => {
    const val = formState[field]
    const date = parseLocalDate(val) || new Date()
    setCalendarState({ target: { kind: 'trip', field }, monthCursor: new Date(date.getFullYear(), date.getMonth(), 1) })
  }

  const shiftMonth = (step: number) => {
    setCalendarState(p => p ? { ...p, monthCursor: new Date(p.monthCursor.getFullYear(), p.monthCursor.getMonth() + step, 1) } : p)
  }

  const selectDate = (date: Date) => {
    if (!calendarState) return
    setFormState(p => ({ ...p, [calendarState.target.field]: formatLocalDate(date) }))
    setCalendarState(null)
  }

  // Auto-locate user for new trips
  useEffect(() => {
    if (formState.timeline.length > 0 && !formState.timeline[0].from) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            const data = await res.json()
            if (data) {
              setFormState(p => ({
                ...p,
                timeline: p.timeline.map((s, i) => i === 0 ? {
                  ...s,
                  from: data.display_name,
                  fromLat: String(latitude),
                  fromLng: String(longitude)
                } : s)
              }))
            }
          } catch (err) {
            console.warn('Auto-location geocoding failed:', err)
          }
        },
        (err) => console.warn('Auto-location geolocation failed:', err),
        { timeout: 10000 }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for geolocation seed only
  }, [])

  const handleCreate = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()

    if (isPublishingTrip) {
      return
    }

    setError(null)
    if (!formState.title.trim()) { setError('Mission title is required.'); return }
    if (!formState.coverImageFile) { setError('A cover image is required for identification.'); return }

    setIsPublishingTrip(true)

    try {
      const formData = new FormData()
      formData.append('title', formState.title)
      formData.append('description', formState.description)
      if (formState.coverImageFile) formData.append('image', formState.coverImageFile)
      formData.append('startingDate', new Date(formState.startDate).toISOString())
      formData.append('endingDate', new Date(formState.endDate).toISOString())
      formData.append('status', formState.status)
      formState.tags.forEach(t => formData.append('tags', t))
      formData.append('maxParticipants', String(formState.maxMembers))
      formData.append('price', String(formState.budgetPerPerson))

      formState.timeline.forEach((stop, i) => {
        formData.append(`Timelines[${i}].StartDay`, String(stop.startDay))
        formData.append(`Timelines[${i}].EndDay`, String(stop.endDay))
        formData.append(`Timelines[${i}].StartingPoint`, stop.from)
        formData.append(`Timelines[${i}].FromCoords[0]`, stop.fromLat)
        formData.append(`Timelines[${i}].FromCoords[1]`, stop.fromLng)
        formData.append(`Timelines[${i}].EndPoint`, stop.to)
        formData.append(`Timelines[${i}].ToCoords[0]`, stop.toLat)
        formData.append(`Timelines[${i}].ToCoords[1]`, stop.toLng)
        formData.append(`Timelines[${i}].Note`, stop.note)

        stop.activities.forEach((activity, j) => {
          formData.append(`Timelines[${i}].Activities[${j}].Name`, activity.name)
          formData.append(`Timelines[${i}].Activities[${j}].Description`, activity.description)
          if (activity.link) formData.append(`Timelines[${i}].Activities[${j}].Link`, activity.link)
          if (activity.cost !== undefined && activity.cost !== null) {
            formData.append(`Timelines[${i}].Activities[${j}].Cost`, String(activity.cost))
          }
          formData.append(`Timelines[${i}].Activities[${j}].Type`, String(activity.type))
        })
      })

      await api.post('/api/trip/create-trip', formData)
      setToast({ id: Date.now(), message: 'Trip saved!', tone: 'success' })
      setTimeout(() => navigate('/app/discover'), 2000)
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        setToast({ id: Date.now(), message: 'Trip creation will be saved when online!', tone: 'success' })
        setTimeout(() => navigate('/app/discover'), 2000)
      } else {
        setError(getErrorMessage(err, 'Synchronization failed.'))
      }
    } finally {
      await waitForBackendButtonUnlock()
      setIsPublishingTrip(false)
    }
  }

  if (!user) {
    return (
      <section className="page container">
        <div className="discovery-empty-state">
          <h1>Identity verification failed</h1>
          <p>Please log in to start new trips.</p>
          <Link className="btn btn-primary" to="/login">Go to login</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page builder-workspace-v2 container">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <header className="builder-header-v2">
        <p className="eyebrow">New Trip</p>
        <h1>{builderSteps[activeIndex].label}</h1>
        <p style={{ maxWidth: '600px', margin: '0.5rem auto', color: 'var(--text-380)' }}>
          {builderSteps[activeIndex].description}
        </p>
      </header>

      <div className="builder-steps-v2">
        {builderSteps.map((s, i) => (
          <div key={s.key} className={activeIndex === i ? 'step-indicator-v2 is-active' : 'step-indicator-v2'} />
        ))}
      </div>

      <motion.form onSubmit={e => e.preventDefault()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={revealTransition}>
        <AnimatePresence mode="wait">
          {activeStep === 'details' && (
            <motion.div key="details" className="builder-form-v2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={builderPaneTransition}>
              <div className="builder-section-v2">
                <h3>Core Identity</h3>
                <div className="form-group" style={{ marginTop: '2rem' }}>
                  <label className="field-label">Trip Title</label>
                  <input className="input" placeholder="Ex: Arctic Adventure" value={formState.title} onChange={e => setFormState(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label className="field-label">Description</label>
                  <textarea className="input" rows={4} placeholder="Describe the mission goals..." value={formState.description} onChange={e => setFormState(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>

              <div className="builder-grid-v2">
                <div className="builder-section-v2">
                  <h3>Logistics</h3>
                  <div className="form-group" style={{ marginTop: '1.5rem' }}>
                    <label className="field-label">Start Date</label>
                    <button type="button" className="input input-trigger" onClick={() => openCalendar('startDate')}>
                      <span>{formatDateLabel(formState.startDate)}</span>
                      <FiCalendar />
                    </button>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="field-label">End Date</label>
                    <button type="button" className="input input-trigger" onClick={() => openCalendar('endDate')}>
                      <span>{formatDateLabel(formState.endDate)}</span>
                      <FiCalendar />
                    </button>
                  </div>
                </div>

                <div className="builder-section-v2">
                  <h3>Capacity & Cost</h3>
                  <div className="form-group" style={{ marginTop: '1.5rem' }}>
                    <label className="field-label">Budget per Person (EUR)</label>
                    <input type="number" className="input" value={formState.budgetPerPerson || ''} onChange={e => setFormState(p => ({ ...p, budgetPerPerson: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="field-label">Max Explorers</label>
                    <input type="number" className="input" value={formState.maxMembers || ''} onChange={e => setFormState(p => ({ ...p, maxMembers: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>

              <div className="builder-section-v2">
                <h3>Tags & Vibe</h3>
                <p className="eyebrow" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>Select trip styles or add your own</p>
                <div className="chip-row">
                  {tripTypeOptions.map((tag) => {
                    const isSelected = formState.tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={isSelected ? 'chip is-selected' : 'chip'}
                        onClick={() => {
                          setFormState(prev => ({
                            ...prev,
                            tags: isSelected
                              ? prev.tags.filter(t => t !== tag)
                              : [...prev.tags, tag]
                          }))
                        }}
                      >
                        {tag}
                      </button>
                    )
                  })}
                  {/* Custom Tags already added */}
                  {formState.tags.filter(t => !tripTypeOptions.includes(t)).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="chip is-selected"
                      onClick={() => {
                        setFormState(prev => ({
                          ...prev,
                          tags: prev.tags.filter(t => t !== tag)
                        }))
                      }}
                    >
                      {tag} <FiX size={12} style={{ marginLeft: '4px' }} />
                    </button>
                  ))}
                </div>

                <div className="form-group" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <FiTag style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                      className="input"
                      style={{ paddingLeft: '2.8rem' }}
                      placeholder="Add custom mission tag..."
                      value={formState.customTag}
                      onChange={e => setFormState(p => ({ ...p, customTag: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const tag = formState.customTag.trim().toLowerCase()
                          if (tag && !formState.tags.includes(tag)) {
                            setFormState(p => ({
                              ...p,
                              tags: [...p.tags, tag],
                              customTag: ''
                            }))
                          }
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const tag = formState.customTag.trim().toLowerCase()
                      if (tag && !formState.tags.includes(tag)) {
                        setFormState(p => ({
                          ...p,
                          tags: [...p.tags, tag],
                          customTag: ''
                        }))
                      }
                    }}
                  >
                    <FiPlusCircle />
                  </button>
                </div>
              </div>

              <div className="builder-section-v2">
                <h3>Visual Identification</h3>
                <label className="upload-dropzone" htmlFor="cover-upload" style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(154,198,148,0.1)', height: '240px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {formState.coverImageDataUrl ? (
                    <img src={formState.coverImageDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '22px' }} />
                  ) : (
                    <>
                      <FiUploadCloud size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p style={{ opacity: 0.5 }}>Click to upload cover satellite image</p>
                    </>
                  )}
                </label>
                <input id="cover-upload" type="file" className="visually-hidden" onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => setFormState(p => ({ ...p, coverImageDataUrl: reader.result as string, coverImageFile: file }))
                    reader.readAsDataURL(file)
                  }
                }} />
              </div>
            </motion.div>
          )}

          {activeStep === 'timeline' && (
            <motion.div key="timeline" className="builder-form-v2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={builderPaneTransition}>
              <div className="timeline-flow-v2">
                {formState.timeline.map((stop, i) => (
                  <div key={i} className="timeline-day-v2">
                    <div className="day-marker-v2" />
                    <div className="builder-section-v2">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                          <h3>Stop #{i + 1}</h3>
                          <p className="eyebrow" style={{ marginTop: '0.25rem' }}>Coordinates & Schedule</p>
                        </div>
                        {formState.timeline.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFormState(p => ({ ...p, timeline: p.timeline.filter((_, idx) => idx !== i) }))}>
                            <FiTrash2 />
                          </button>
                        )}
                      </div>

                      <div className="builder-grid-v2" style={{ marginBottom: '1.5rem' }}>
                        <div className="form-group">
                          <label className="field-label">Start Day</label>
                          <input type="number" className="input" min={1} value={stop.startDay || ''} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, startDay: Number(e.target.value) } : s) }))} />
                        </div>
                        <div className="form-group">
                          <label className="field-label">End Day</label>
                          <input type="number" className="input" min={1} value={stop.endDay || ''} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, endDay: Number(e.target.value) } : s) }))} />
                        </div>
                      </div>

                      <div className="builder-grid-v2">
                        <LocationAutocompleteField id={`from-${i}`} label="Starting Point" placeholder="Search locality..." value={stop.from} onValueChange={v => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, from: v } : s) }))} onLocationSelect={s => setFormState(p => ({ ...p, timeline: p.timeline.map((st, idx) => idx === i ? { ...st, from: s.placeName, fromLat: String(s.lat), fromLng: String(s.lng) } : st) }))} />
                        <LocationAutocompleteField id={`to-${i}`} label="End Point" placeholder="Search locality..." value={stop.to} onValueChange={v => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, to: v } : s) }))} onLocationSelect={s => setFormState(p => ({ ...p, timeline: p.timeline.map((st, idx) => idx === i ? { ...st, to: s.placeName, toLat: String(s.lat), toLng: String(s.lng) } : st) }))} />
                      </div>

                      <div className="form-group" style={{ marginTop: '1.5rem' }}>
                        <label className="field-label">Navigation Note</label>
                        <input className="input" placeholder="General info about this stretch..." value={stop.note} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, note: e.target.value } : s) }))} />
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
                            onClick={() => setFormState(p => ({
                              ...p,
                              timeline: p.timeline.map((s, idx) => idx === i ? {
                                ...s,
                                activities: [...s.activities, { name: '', description: '', link: '', cost: 0, type: ActivityType.Attraction as ActivityType }]
                              } : s)
                            }))}
                          >
                            <FiPlusCircle /> Add
                          </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {stop.activities.map((act, j) => (
                            <div key={j} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--line-soft)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <input
                                  className="input"
                                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--line-soft)', borderRadius: 0, paddingLeft: 0, fontSize: '0.9rem', fontWeight: 600 }}
                                  placeholder="Activity name..."
                                  value={act.name}
                                  onChange={e => setFormState(p => ({
                                    ...p,
                                    timeline: p.timeline.map((s, idx) => idx === i ? {
                                      ...s,
                                      activities: s.activities.map((a, aidx) => aidx === j ? { ...a, name: e.target.value } : a)
                                    } : s)
                                  }))}
                                />
                                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => setFormState(p => ({
                                  ...p,
                                  timeline: p.timeline.map((s, idx) => idx === i ? {
                                    ...s,
                                    activities: s.activities.filter((_, aidx) => aidx !== j)
                                  } : s)
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
                                    onChange={e => setFormState(p => ({
                                      ...p,
                                      timeline: p.timeline.map((s, idx) => idx === i ? {
                                        ...s,
                                        activities: s.activities.map((a, aidx) => aidx === j ? { ...a, type: Number(e.target.value) as ActivityType } : a)
                                      } : s)
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
                                    onChange={e => setFormState(p => ({
                                      ...p,
                                      timeline: p.timeline.map((s, idx) => idx === i ? {
                                        ...s,
                                        activities: s.activities.map((a, aidx) => aidx === j ? { ...a, cost: Number(e.target.value) } : a)
                                      } : s)
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
                                  onChange={e => setFormState(p => ({
                                    ...p,
                                    timeline: p.timeline.map((s, idx) => idx === i ? {
                                      ...s,
                                      activities: s.activities.map((a, aidx) => aidx === j ? { ...a, description: e.target.value } : a)
                                    } : s)
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
                                  onChange={e => setFormState(p => ({
                                    ...p,
                                    timeline: p.timeline.map((s, idx) => idx === i ? {
                                      ...s,
                                      activities: s.activities.map((a, aidx) => aidx === j ? { ...a, link: e.target.value } : a)
                                    } : s)
                                  }))}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost" style={{ alignSelf: 'center', marginTop: '2rem' }} onClick={() => setFormState(p => ({ ...p, timeline: [...p.timeline, createTimelineStopDraft(formState.timeline.length)] }))}>
                <FiPlusCircle /> Extend Timeline
              </button>
            </motion.div>
          )}

          {activeStep === 'overview' && (
            <motion.div key="overview" className="builder-form-v2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={builderPaneTransition}>
              <div className="builder-section-v2" style={{ textAlign: 'center' }}>
                <FiCheckCircle size={48} style={{ color: 'var(--green-580)', marginBottom: '1rem' }} />
                <h3>Pre-Flight Check</h3>
                <p>All your trip data is ready. Review the summary below.</p>
              </div>

              <div className="trip-stats-bar-v2">
                <div className="trip-stat-v2">
                  <label>Mission</label>
                  <span>{formState.title || 'Untitled'}</span>
                </div>
                <div className="trip-stat-v2">
                  <label>Chronology</label>
                  <span>{formState.timeline.length} Days</span>
                </div>
                <div className="trip-stat-v2">
                  <label>Budget</label>
                  <span>{formState.budgetPerPerson} EUR</span>
                </div>
              </div>

              <div className="builder-section-v2">
                <h3>Mission Briefing</h3>
                <p style={{ marginTop: '1rem', color: 'var(--text-380)', lineHeight: 1.6 }}>{formState.description}</p>

                <div className="chip-row" style={{ marginTop: '1.5rem' }}>
                  {formState.tags.map(tag => (
                    <span key={tag} className="chip-static">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="info-banner is-error" style={{ marginTop: '2rem' }}>{error}</p>}

        <div className="create-actions" style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {!isFirst && <button type="button" className="btn btn-ghost btn-lg" disabled={isPublishingTrip} onClick={() => setActiveStep(builderSteps[activeIndex - 1].key)}>Previous Step</button>}
          {isLast ? (
            <button type="button" onClick={handleCreate} className="btn btn-primary btn-lg" style={{ minWidth: '240px' }} disabled={isPublishingTrip}>
              {isPublishingTrip ? 'Publishing...' : 'Publish Trip'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" style={{ minWidth: '240px' }} disabled={isPublishingTrip} onClick={() => setActiveStep(builderSteps[activeIndex + 1].key)}>Next Step</button>
          )}
        </div>
      </motion.form>

      {/* Calendar Modal */}
      <ModalSurface isOpen={Boolean(calendarState)} title="Chronology Sync" subtitle="Pick a date for the mission timeline" onClose={() => setCalendarState(null)}>
        <div className="calendar-shell">
          <div className="calendar-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(-1)}><FiArrowLeft /></button>
            <h4 style={{ color: 'var(--text-100)' }}>{calendarState && monthFormatter.format(calendarState.monthCursor)}</h4>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)}><FiArrowLeft style={{ transform: 'rotate(180deg)' }} /></button>
          </div>
          <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
            {calendarCells.map((date, i) => {
              if (!date) return <div key={i} />
              const isSel = selectedCalendarDate && isSameDay(date, selectedCalendarDate)
              return (
                <button key={i} type="button" className={isSel ? 'calendar-day is-selected' : 'calendar-day'} style={{ padding: '0.8rem', borderRadius: '12px', border: 'none', background: isSel ? 'var(--green-580)' : 'var(--surface-860)', color: isSel ? 'var(--text-100)' : 'var(--text-100)', cursor: 'pointer' }} onClick={() => selectDate(date)}>
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      </ModalSurface>
    </section>
  )
}
