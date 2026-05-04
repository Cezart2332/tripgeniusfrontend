import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  FiArrowLeft,
  FiCalendar,
  FiMapPin,
  FiUploadCloud,
  FiX,
  FiPlusCircle,
  FiTrash2,
  FiCheckCircle,
  FiTag
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { User } from '../types/models'
import { useSelector } from 'react-redux'
import type { TripStatus } from '../types/models'
import api from '../data/api'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState } from '../components/FeedbackToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

interface TimelineDraftStop {
  from: string
  to: string
  fromLng: string
  fromLat: string
  toLng: string
  toLat: string
  note: string
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
  coverImageFile : File | null
  timeline: TimelineDraftStop[]
}


interface LocationSelection {
  name: string
  placeName: string
  lng: number
  lat: number
}

interface LocationSuggestion extends LocationSelection {
  id: string
}
interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface ModalSurfaceProps {
  isOpen: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

interface LocationAutocompleteFieldProps {
  id: string
  label: string
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  onLocationSelect: (selection: LocationSelection) => void
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

const createTimelineStopDraft = (): TimelineDraftStop => ({
  from: '',
  to: '',
  fromLng: '',
  fromLat: '',
  toLng: '',
  toLat: '',
  note: '',
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
    coverImageFile : null,
    timeline: [createTimelineStopDraft()],
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

function ModalSurface({ isOpen, title, subtitle, onClose, children }: ModalSurfaceProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="builder-section-v2" style={{ maxWidth: '500px', width: '90%', background: 'var(--bg-900)' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                   <h3>{title}</h3>
                   {subtitle && <p className="eyebrow">{subtitle}</p>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
             </div>
             {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const nominatimCache: Record<string, LocationSuggestion[]> = {}

function LocationAutocompleteField({ id, label, placeholder, value, onValueChange, onLocationSelect }: LocationAutocompleteFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      return
    }

    if (nominatimCache[trimmed]) {
      setSuggestions(nominatimCache[trimmed])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=6`,
          {
            signal: controller.signal,
            headers: {
              'User-Agent': 'TripGenius/1.0',
              'Accept-Language': 'ro'
            }
          }
        )
        const data = await res.json() as NominatimResult[]
        const results: LocationSuggestion[] = data.map(f => ({
          id: String(f.place_id),
          name: f.display_name.split(',')[0],
          placeName: f.display_name,
          lng: parseFloat(f.lon),
          lat: parseFloat(f.lat)
        }))
        
        nominatimCache[trimmed] = results
        setSuggestions(results)
      } catch (err) {
        console.error('Nominatim search failed:', err)
      } finally {
        setIsLoading(false)
      }
    }, 600)
    
    return () => { clearTimeout(timer); controller.abort() }
  }, [value])

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="location-input-shell" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 1rem' }}>
        <FiMapPin style={{ opacity: 0.4 }} />
        <input id={id} className="input" style={{ border: 'none', background: 'transparent' }} value={value} onChange={e => onValueChange(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 200)} placeholder={placeholder} />
      </div>
      {isFocused && (suggestions.length > 0 || isLoading) && (
        <div className="location-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-900)', border: '1px solid rgba(154,198,148,0.1)', borderRadius: '12px', marginTop: '0.5rem', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}>
           {isLoading && <p style={{ padding: '1rem', fontSize: '0.8rem', opacity: 0.5 }}>Querying OpenStreetMap...</p>}
           {suggestions.map(s => (
             <button key={s.id} type="button" className="location-option" style={{ width: '100%', textAlign: 'left', padding: '1rem', border: 'none', background: 'transparent', cursor: 'pointer' }} onMouseDown={() => onLocationSelect(s)}>
                <div style={{ fontWeight: 600, color: '#f3fff1' }}>{s.name}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{s.placeName}</div>
             </button>
           ))}
        </div>
      )}
    </div>
  )
}

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

  const handleCreate = async (e: FormEvent) => {
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
        formData.append(`Timelines[${i}].Day`, String(i + 1))
        formData.append(`Timelines[${i}].StartingPoint`, stop.from)
        formData.append(`Timelines[${i}].FromCoords[0]`, stop.fromLat)
        formData.append(`Timelines[${i}].FromCoords[1]`, stop.fromLng)
        formData.append(`Timelines[${i}].EndPoint`, stop.to)
        formData.append(`Timelines[${i}].ToCoords[0]`, stop.toLat)
        formData.append(`Timelines[${i}].ToCoords[1]`, stop.toLng)
        formData.append(`Timelines[${i}].Note`, stop.note)
      })

      await api.post('/api/trip/create-trip', formData)
      setToast({ id: Date.now(), message: 'Trip saved!', tone: 'success' })
      setTimeout(() => navigate('/app/discover'), 2000)
    } catch (err: any) {
      if (err?.queued) {
        setToast({ id: Date.now(), message: 'Trip creation will be saved when online!', tone: 'success' })
        setTimeout(() => navigate('/app/discover'), 2000)
      } else {
        setError(err.response?.data?.message || 'Synchronization failed.')
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

      <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={revealTransition}>
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
                    <input type="number" className="input" value={formState.budgetPerPerson} onChange={e => setFormState(p => ({ ...p, budgetPerPerson: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="field-label">Max Explorers</label>
                    <input type="number" className="input" value={formState.maxMembers} onChange={e => setFormState(p => ({ ...p, maxMembers: Number(e.target.value) }))} />
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                             <h3>Day {i + 1} Coordinates</h3>
                             {formState.timeline.length > 1 && (
                               <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFormState(p => ({ ...p, timeline: p.timeline.filter((_, idx) => idx !== i) }))}>
                                  <FiTrash2 />
                               </button>
                             )}
                          </div>
                          <div className="builder-grid-v2">
                             <LocationAutocompleteField id={`from-${i}`} label="Starting Point" placeholder="Search locality..." value={stop.from} onValueChange={v => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, from: v } : s) }))} onLocationSelect={s => setFormState(p => ({ ...p, timeline: p.timeline.map((st, idx) => idx === i ? { ...st, from: s.placeName, fromLat: String(s.lat), fromLng: String(s.lng) } : st) }))} />
                             <LocationAutocompleteField id={`to-${i}`} label="End Point" placeholder="Search locality..." value={stop.to} onValueChange={v => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, to: v } : s) }))} onLocationSelect={s => setFormState(p => ({ ...p, timeline: p.timeline.map((st, idx) => idx === i ? { ...st, to: s.placeName, toLat: String(s.lat), toLng: String(s.lng) } : st) }))} />
                          </div>
                          <div className="form-group" style={{ marginTop: '1.5rem' }}>
                             <label className="field-label">Navigation Note</label>
                             <input className="input" placeholder="Planned activities for the day..." value={stop.note} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, note: e.target.value } : s) }))} />
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
               <button type="button" className="btn btn-ghost" style={{ alignSelf: 'center', marginTop: '2rem' }} onClick={() => setFormState(p => ({ ...p, timeline: [...p.timeline, createTimelineStopDraft()] }))}>
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
             <button type="submit" className="btn btn-primary btn-lg" style={{ minWidth: '240px' }} disabled={isPublishingTrip}>
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
               <h4 style={{ color: '#f3fff1' }}>{calendarState && monthFormatter.format(calendarState.monthCursor)}</h4>
               <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftMonth(1)}><FiArrowLeft style={{ transform: 'rotate(180deg)' }} /></button>
            </div>
            <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
               {calendarCells.map((date, i) => {
                 if (!date) return <div key={i} />
                 const isSel = selectedCalendarDate && isSameDay(date, selectedCalendarDate)
                 return (
                   <button key={i} type="button" className={isSel ? 'calendar-day is-selected' : 'calendar-day'} style={{ padding: '0.8rem', borderRadius: '12px', border: 'none', background: isSel ? 'var(--green-580)' : 'rgba(255,255,255,0.03)', color: isSel ? '#fff' : '#f3fff1', cursor: 'pointer' }} onClick={() => selectDate(date)}>
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
