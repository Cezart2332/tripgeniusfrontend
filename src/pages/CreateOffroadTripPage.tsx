import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import {
  FiArrowLeft,
  FiCalendar,
  FiMap,
  FiPlusCircle,
  FiTrash2,
  FiCheckCircle,
  FiUploadCloud,
  FiNavigation
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../data/api'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { User } from '../types/models'
import { FeedbackToast } from '../components/FeedbackToast'
import { getErrorMessage, isQueuedRequestError } from '../utils/errorMessage'
import type { FeedbackToastState } from '../components/FeedbackToast'
import { DiscoveryModeTabs } from './OffroadDiscoveryPage'
import { ModalSurface } from '../components/ModalSurface'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

interface AuthStoreState {
  auth: { user: User | null }
}

interface RouteDraft {
  id: string
  name: string
  startDay: number
  endDay: number
  note: string
  importGpxLater: boolean
}

type BuilderStep = 'details' | 'routes' | 'overview'

const builderSteps: Array<{ key: BuilderStep; label: string; description: string }> = [
  { key: 'details', label: 'Identity', description: 'Define the core of your offroad trip' },
  { key: 'routes', label: 'Routes', description: 'Add daily trail segments' },
  { key: 'overview', label: 'Review', description: 'Final inspection before launch' },
]

const builderPaneTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as const,
}

type CalendarTarget = { kind: 'trip'; field: 'startDate' | 'endDate' }

interface CalendarState {
  target: CalendarTarget
  monthCursor: Date
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

const createRouteDraft = (index: number): RouteDraft => ({
  id: `draft-${Date.now()}-${index}`,
  name: `Day ${index + 1} Route`,
  startDay: index + 1,
  endDay: index + 1,
  note: '',
  importGpxLater: true,
})

export function CreateOffroadTripPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(4)
  const [price, setPrice] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [calendarState, setCalendarState] = useState<CalendarState | null>(null)
  const [activeStep, setActiveStep] = useState<BuilderStep>('details')
  const [routes, setRoutes] = useState<RouteDraft[]>([createRouteDraft(0)])

  const calendarCells = useMemo(() => calendarState ? buildCalendarCells(calendarState.monthCursor) : [], [calendarState])
  const selectedCalendarDate = useMemo(() => calendarState ? parseLocalDate(calendarState.target.field === 'startDate' ? startDate : endDate) : null, [calendarState, startDate, endDate])

  const openCalendar = (field: 'startDate' | 'endDate') => {
    const val = field === 'startDate' ? startDate : endDate
    const date = parseLocalDate(val) || new Date()
    setCalendarState({ target: { kind: 'trip', field }, monthCursor: new Date(date.getFullYear(), date.getMonth(), 1) })
  }

  const shiftMonth = (step: number) => {
    setCalendarState(p => p ? { ...p, monthCursor: new Date(p.monthCursor.getFullYear(), p.monthCursor.getMonth() + step, 1) } : p)
  }

  const selectDate = (date: Date) => {
    if (!calendarState) return
    const formatted = formatLocalDate(date)
    if (calendarState.target.field === 'startDate') {
      setStartDate(formatted)
    } else {
      setEndDate(formatted)
    }
    setCalendarState(null)
  }

  if (!user) {
    return (
      <section className="page discovery-page-offroad">
        <p>Please sign in to create an offroad trip.</p>
        <Link to="/login" className="btn btn-primary">Login</Link>
      </section>
    )
  }

  const activeIndex = builderSteps.findIndex(s => s.key === activeStep)
  const isFirst = activeIndex === 0
  const isLast = activeIndex === builderSteps.length - 1

  const addRoute = () => {
    setRoutes(prev => [...prev, createRouteDraft(prev.length)])
  }

  const removeRoute = (id: string) => {
    setRoutes(prev => prev.filter(r => r.id !== id))
  }

  const updateRoute = (id: string, updates: Partial<RouteDraft>) => {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const submit = async () => {
    setLoading(true)
    try {
      const form = new FormData()
      form.append('Title', title)
      form.append('Description', description)
      form.append('StartingDate', startDate)
      form.append('EndingDate', endDate)
      form.append('Status', 'Upcoming')
      form.append('MaxParticipants', String(maxParticipants))
      form.append('Price', String(price))
      tags.forEach((tag, i) => form.append(`Tags[${i}]`, tag))
      if (image) form.append('Image', image)

      // Add routes to the form data
      routes.forEach((route, i) => {
        form.append(`Routes[${i}].Name`, route.name)
        form.append(`Routes[${i}].StartDay`, String(route.startDay))
        form.append(`Routes[${i}].EndDay`, String(route.endDay))
        form.append(`Routes[${i}].Note`, route.note)
        form.append(`Routes[${i}].Source`, route.importGpxLater ? 'Drawn' : 'Imported')
      })

      await api.post('api/OffroadTrip/create-offroad-trip', form)
      setToast({ id: Date.now(), message: 'Offroad trip created successfully!', tone: 'success' })
      setTimeout(() => navigate('/app/offroad'), 1500)
    } catch (err) {
      if (isQueuedRequestError(err)) {
        setToast({ id: Date.now(), message: 'Trip creation will be saved when online!', tone: 'success' })
        setTimeout(() => navigate('/app/offroad'), 1500)
      } else {
        setToast({ id: Date.now(), message: getErrorMessage(err, 'Failed to create trip'), tone: 'error' })
      }
    } finally {
      await waitForBackendButtonUnlock()
      setLoading(false)
    }
  }

  return (
    <section className="page offroad-create-page-v2 discovery-page-offroad">
      <DiscoveryModeTabs />
      <Link to="/app/offroad" className="btn btn-ghost offroad-back-btn">
        <FiArrowLeft aria-hidden /> Back to offroad
      </Link>

      <motion.header
        className="offroad-create-hero-v2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="discovery-offroad-badge">
          <FiMap aria-hidden /> New Trail
        </span>
        <h1>{builderSteps[activeIndex].label}</h1>
        <p className="lead">
          {builderSteps[activeIndex].description}
        </p>
      </motion.header>

      <div className="builder-steps-v2 offroad-builder-steps">
        {builderSteps.map((s, i) => (
          <div key={s.key} className={activeIndex === i ? 'step-indicator-v2 is-active' : 'step-indicator-v2'} />
        ))}
      </div>

      <motion.form className="offroad-form-container" onSubmit={e => e.preventDefault()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <AnimatePresence mode="wait">
          {activeStep === 'details' && (
            <motion.div
              key="details"
              className="offroad-form-panel-v2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={builderPaneTransition}
            >
              <div className="builder-section-v2">
                <h3><FiNavigation aria-hidden /> Core Identity</h3>
                <label className="field-label" style={{ marginTop: '1.5rem' }}>
                  Title
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carpathian loop, Alpine traverse..." />
                </label>
                <label className="field-label" style={{ marginTop: '1rem' }}>
                  Description
                  <textarea
                    className="input input-area"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Terrain, difficulty, vehicle requirements, what to expect..."
                  />
                </label>
              </div>

              <div className="builder-grid-v2">
                <div className="builder-section-v2">
                  <h3><FiCalendar aria-hidden /> Schedule</h3>
                  <label className="field-label" style={{ marginTop: '1rem' }}>
                    Start date
                    <button type="button" className="input input-trigger" onClick={() => openCalendar('startDate')}>
                      <span>{formatDateLabel(startDate)}</span>
                      <FiCalendar />
                    </button>
                  </label>
                  <label className="field-label" style={{ marginTop: '1rem' }}>
                    End date
                    <button type="button" className="input input-trigger" onClick={() => openCalendar('endDate')}>
                      <span>{formatDateLabel(endDate)}</span>
                      <FiCalendar />
                    </button>
                  </label>
                </div>

                <div className="builder-section-v2">
                  <h3><FiMap aria-hidden /> Capacity</h3>
                  <label className="field-label" style={{ marginTop: '1rem' }}>
                    Max participants
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={50}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    />
                  </label>
                  <label className="field-label" style={{ marginTop: '1rem' }}>
                    Price (RON)
                    <input className="input" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                  </label>
                </div>
              </div>

              <div className="builder-section-v2">
                <h3>Visual Identity</h3>
                <label className="upload-dropzone" htmlFor="offroad-cover-upload" style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed var(--offroad-line)', height: '200px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '1rem' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'calc(var(--radius-md) - 2px)' }} />
                  ) : (
                    <>
                      <FiUploadCloud size={40} style={{ opacity: 0.3, marginBottom: '1rem', color: 'var(--offroad-accent)' }} />
                      <p style={{ opacity: 0.5 }}>Click to upload cover image</p>
                    </>
                  )}
                </label>
                <input id="offroad-cover-upload" type="file" className="visually-hidden" accept="image/*" onChange={handleImageUpload} />
              </div>

              <div className="builder-section-v2">
                <h3>Tags</h3>
                <div className="offroad-tag-grid-v2" style={{ marginTop: '1rem' }}>
                  {tripTypeOptions.map((tag) => (
                    <label key={tag} className={`offroad-tag-chip-v2 ${tags.includes(tag) ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={tags.includes(tag)}
                        onChange={(e) => {
                          setTags((prev) => (e.target.checked ? [...prev, tag] : prev.filter((t) => t !== tag)))
                        }}
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeStep === 'routes' && (
            <motion.div
              key="routes"
              className="offroad-form-panel-v2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={builderPaneTransition}
            >
              <div className="builder-section-v2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3><FiNavigation aria-hidden /> Route Segments</h3>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addRoute}>
                    <FiPlusCircle /> Add route
                  </button>
                </div>
                <p className="eyebrow" style={{ marginTop: '0.5rem' }}>
                  Define daily trail segments. You can import GPX files or draw routes later.
                </p>
              </div>

              <div className="offroad-routes-list">
                {routes.length === 0 && (
                  <div className="offroad-empty-routes-mini">
                    <p>No routes defined yet. Add your first trail segment.</p>
                    <button type="button" className="btn btn-primary" onClick={addRoute}>
                      <FiPlusCircle /> Add first route
                    </button>
                  </div>
                )}

                {routes.map((route, index) => (
                  <div key={route.id} className="offroad-route-card-editor">
                    <div className="offroad-route-card-header">
                      <span className="offroad-route-number">{index + 1}</span>
                      <input
                        className="input offroad-route-name-input"
                        value={route.name}
                        onChange={(e) => updateRoute(route.id, { name: e.target.value })}
                        placeholder="Route name"
                      />
                      {routes.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRoute(route.id)}>
                          <FiTrash2 />
                        </button>
                      )}
                    </div>

                    <div className="offroad-route-days">
                      <div className="form-group">
                        <label className="field-label">Start Day</label>
                        <input
                          type="number"
                          className="input"
                          min={1}
                          value={route.startDay}
                          onChange={(e) => updateRoute(route.id, { startDay: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label">End Day</label>
                        <input
                          type="number"
                          className="input"
                          min={1}
                          value={route.endDay}
                          onChange={(e) => updateRoute(route.id, { endDay: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="field-label">Navigation Note</label>
                      <input
                        className="input"
                        value={route.note}
                        onChange={(e) => updateRoute(route.id, { note: e.target.value })}
                        placeholder="Terrain notes, waypoints, difficulty..."
                      />
                    </div>

                    <div className="offroad-route-import-option" style={{ marginTop: '1rem' }}>
                      <label className="offroad-checkbox-label">
                        <input
                          type="checkbox"
                          checked={route.importGpxLater}
                          onChange={(e) => updateRoute(route.id, { importGpxLater: e.target.checked })}
                        />
                        <span>Import GPX or draw later</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {routes.length > 0 && (
                <button type="button" className="btn btn-ghost" style={{ alignSelf: 'center', marginTop: '1rem' }} onClick={addRoute}>
                  <FiPlusCircle /> Add another route
                </button>
              )}
            </motion.div>
          )}

          {activeStep === 'overview' && (
            <motion.div
              key="overview"
              className="offroad-form-panel-v2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={builderPaneTransition}
            >
              <div className="builder-section-v2" style={{ textAlign: 'center' }}>
                <FiCheckCircle size={48} style={{ color: 'var(--offroad-accent)', marginBottom: '1rem' }} />
                <h3>Pre-Flight Check</h3>
                <p>Your offroad adventure is ready. Review the summary below.</p>
              </div>

              <div className="offroad-stats-bar-v2">
                <div className="offroad-stat-v2">
                  <label>Mission</label>
                  <span>{title || 'Untitled'}</span>
                </div>
                <div className="offroad-stat-v2">
                  <label>Routes</label>
                  <span>{routes.length} segments</span>
                </div>
                <div className="offroad-stat-v2">
                  <label>Dates</label>
                  <span>{formatDateLabel(startDate)} - {formatDateLabel(endDate)}</span>
                </div>
                <div className="offroad-stat-v2">
                  <label>Capacity</label>
                  <span>{maxParticipants} explorers</span>
                </div>
              </div>

              {imagePreview && (
                <div className="builder-section-v2">
                  <h3>Cover Preview</h3>
                  <img src={imagePreview} alt="Cover preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginTop: '1rem' }} />
                </div>
              )}

              <div className="builder-section-v2">
                <h3>Mission Briefing</h3>
                <p style={{ marginTop: '1rem', color: 'var(--text-380)', lineHeight: 1.6 }}>{description || 'No description provided.'}</p>

                <div className="offroad-tag-preview" style={{ marginTop: '1.5rem' }}>
                  {tags.map(tag => (
                    <span key={tag} className="offroad-tag-chip-static">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="builder-section-v2">
                <h3>Route Summary</h3>
                <div className="offroad-route-summary-list" style={{ marginTop: '1rem' }}>
                  {routes.map((route, idx) => (
                    <div key={route.id} className="offroad-route-summary-item">
                      <span className="offroad-route-summary-num">{idx + 1}</span>
                      <div className="offroad-route-summary-info">
                        <strong>{route.name}</strong>
                        <span>Days {route.startDay}-{route.endDay} {route.importGpxLater ? '(GPX later)' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="create-actions offroad-create-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {!isFirst && (
            <button type="button" className="btn btn-ghost btn-lg" disabled={loading} onClick={() => setActiveStep(builderSteps[activeIndex - 1].key)}>
              Previous
            </button>
          )}
          {isLast ? (
            <button type="button" onClick={submit} className="btn btn-primary btn-lg offroad-btn-primary" style={{ minWidth: '240px' }} disabled={loading || !title || !startDate || !endDate}>
              {loading ? 'Creating...' : 'Create Offroad Trip'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg offroad-btn-primary" style={{ minWidth: '240px' }} disabled={loading} onClick={() => setActiveStep(builderSteps[activeIndex + 1].key)}>
              Next
            </button>
          )}
        </div>
      </motion.form>

      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      {/* Calendar Modal */}
      <ModalSurface isOpen={Boolean(calendarState)} title="Select Date" subtitle="Pick a date for your offroad trip" onClose={() => setCalendarState(null)}>
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
                <button key={i} type="button" className={isSel ? 'calendar-day is-selected' : 'calendar-day'} style={{ padding: '0.8rem', borderRadius: '12px', border: 'none', background: isSel ? 'var(--offroad-accent)' : 'var(--surface-860)', color: isSel ? '#1a1408' : 'var(--text-100)', cursor: 'pointer' }} onClick={() => selectDate(date)}>
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
