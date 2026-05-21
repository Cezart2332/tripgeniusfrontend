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
import styled from 'styled-components'
import { tripTypeOptions } from '../data/tripTypeOptions'
import { ActivityType } from '../types/models'
import { useSelector } from 'react-redux'
import type { TripStatus, User } from '../types/models'
import api from '../data/api'
import { useToast, ToastContainer } from '../components/shared/Toast'
import { getErrorMessage, isQueuedRequestError } from '../utils/errorMessage'
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
  const { toasts, addToast, removeToast } = useToast()

  const [formState, setFormState] = useState<CreateTripFormState>(createInitialFormState)
  const [activeStep, setActiveStep] = useState<BuilderStep>('details')
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
      addToast('Trip saved!', 'success')
      setTimeout(() => navigate('/app/discover'), 2000)
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Trip creation will be saved when online!', 'success')
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
      <PageSection>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <EmptyState>
          <h1>Identity verification failed</h1>
          <p>Please log in to start new trips.</p>
          <LinkBtn to="/login">Go to login</LinkBtn>
        </EmptyState>
      </PageSection>
    )
  }

  return (
    <BuilderWorkspace>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <BuilderHeader>
        <Eyebrow>New Trip</Eyebrow>
        <h1>{builderSteps[activeIndex].label}</h1>
        <BuilderDescription>
          {builderSteps[activeIndex].description}
        </BuilderDescription>
      </BuilderHeader>

      <BuilderSteps>
        {builderSteps.map((s, i) => (
          <StepIndicator key={s.key} $active={activeIndex === i} />
        ))}
      </BuilderSteps>

      <motion.form onSubmit={e => e.preventDefault()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}>
        <AnimatePresence mode="wait">
          {activeStep === 'details' && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <BuilderSection>
                <SectionHeading>Core Identity</SectionHeading>
                <FormGroup style={{ marginTop: '2rem' }}>
                  <FieldLabel>Trip Title</FieldLabel>
                  <Input placeholder="Ex: Arctic Adventure" value={formState.title} onChange={e => setFormState(p => ({ ...p, title: e.target.value }))} />
                </FormGroup>
                <FormGroup style={{ marginTop: '1.5rem' }}>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea rows={4} placeholder="Describe the mission goals..." value={formState.description} onChange={e => setFormState(p => ({ ...p, description: e.target.value }))} />
                </FormGroup>
              </BuilderSection>

              <BuilderGrid>
                <BuilderSection>
                  <SectionHeading>Logistics</SectionHeading>
                  <FormGroup style={{ marginTop: '1.5rem' }}>
                    <FieldLabel>Start Date</FieldLabel>
                    <InputTrigger type="button" onClick={() => openCalendar('startDate')}>
                      <span>{formatDateLabel(formState.startDate)}</span>
                      <FiCalendar />
                    </InputTrigger>
                  </FormGroup>
                  <FormGroup style={{ marginTop: '1rem' }}>
                    <FieldLabel>End Date</FieldLabel>
                    <InputTrigger type="button" onClick={() => openCalendar('endDate')}>
                      <span>{formatDateLabel(formState.endDate)}</span>
                      <FiCalendar />
                    </InputTrigger>
                  </FormGroup>
                </BuilderSection>

                <BuilderSection>
                  <SectionHeading>Capacity & Cost</SectionHeading>
                  <FormGroup style={{ marginTop: '1.5rem' }}>
                    <FieldLabel>Budget per Person (EUR)</FieldLabel>
                    <Input type="number" value={formState.budgetPerPerson || ''} onChange={e => setFormState(p => ({ ...p, budgetPerPerson: Number(e.target.value) }))} />
                  </FormGroup>
                  <FormGroup style={{ marginTop: '1rem' }}>
                    <FieldLabel>Max Explorers</FieldLabel>
                    <Input type="number" value={formState.maxMembers || ''} onChange={e => setFormState(p => ({ ...p, maxMembers: Number(e.target.value) }))} />
                  </FormGroup>
                </BuilderSection>
              </BuilderGrid>

              <BuilderSection>
                <SectionHeading>Tags & Vibe</SectionHeading>
                <Eyebrow style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>Select trip styles or add your own</Eyebrow>
                <ChipRow>
                  {tripTypeOptions.map((tag) => {
                    const isSelected = formState.tags.includes(tag)
                    return (
                      <Chip
                        key={tag}
                        type="button"
                        $selected={isSelected}
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
                      </Chip>
                    )
                  })}
                  {formState.tags.filter(t => !tripTypeOptions.includes(t)).map(tag => (
                    <Chip
                      key={tag}
                      type="button"
                      $selected
                      onClick={() => {
                        setFormState(prev => ({
                          ...prev,
                          tags: prev.tags.filter(t => t !== tag)
                        }))
                      }}
                    >
                      {tag} <FiX size={12} style={{ marginLeft: '4px' }} />
                    </Chip>
                  ))}
                </ChipRow>

                <FormGroup style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                  <InputWrapper>
                    <TagIconWrapper>
                      <FiTag />
                    </TagIconWrapper>
                    <Input
                      $pl="2.8rem"
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
                  </InputWrapper>
                  <GhostBtn
                    type="button"
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
                  </GhostBtn>
                </FormGroup>
              </BuilderSection>

              <BuilderSection>
                <SectionHeading>Visual Identification</SectionHeading>
                <UploadDropzone htmlFor="cover-upload">
                  {formState.coverImageDataUrl ? (
                    <CoverPreviewImg src={formState.coverImageDataUrl} alt="" />
                  ) : (
                    <>
                      <FiUploadCloud size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <UploadHint>Click to upload cover satellite image</UploadHint>
                    </>
                  )}
                </UploadDropzone>
                <VisuallyHiddenInput id="cover-upload" type="file" onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => setFormState(p => ({ ...p, coverImageDataUrl: reader.result as string, coverImageFile: file }))
                    reader.readAsDataURL(file)
                  }
                }} />
              </BuilderSection>
            </motion.div>
          )}

          {activeStep === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <TimelineFlow>
                {formState.timeline.map((stop, i) => (
                  <TimelineDay key={i}>
                    <DayMarker />
                    <BuilderSection>
                      <StopHeader>
                        <div>
                          <SectionHeading>Stop #{i + 1}</SectionHeading>
                          <Eyebrow style={{ marginTop: '0.25rem' }}>Coordinates & Schedule</Eyebrow>
                        </div>
                        {formState.timeline.length > 1 && (
                          <GhostBtnSm type="button" onClick={() => setFormState(p => ({ ...p, timeline: p.timeline.filter((_, idx) => idx !== i) }))}>
                            <FiTrash2 />
                          </GhostBtnSm>
                        )}
                      </StopHeader>

                      <BuilderGrid style={{ marginBottom: '1.5rem' }}>
                        <FormGroup>
                          <FieldLabel>Start Day</FieldLabel>
                          <Input type="number" min={1} value={stop.startDay || ''} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, startDay: Number(e.target.value) } : s) }))} />
                        </FormGroup>
                        <FormGroup>
                          <FieldLabel>End Day</FieldLabel>
                          <Input type="number" min={1} value={stop.endDay || ''} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, endDay: Number(e.target.value) } : s) }))} />
                        </FormGroup>
                      </BuilderGrid>

                      <BuilderGrid>
                        <LocationAutocompleteField id={`from-${i}`} label="Starting Point" placeholder="Search locality..." value={stop.from} onValueChange={v => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, from: v } : s) }))} onLocationSelect={s => setFormState(p => ({ ...p, timeline: p.timeline.map((st, idx) => idx === i ? { ...st, from: s.placeName, fromLat: String(s.lat), fromLng: String(s.lng) } : st) }))} />
                        <LocationAutocompleteField id={`to-${i}`} label="End Point" placeholder="Search locality..." value={stop.to} onValueChange={v => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, to: v } : s) }))} onLocationSelect={s => setFormState(p => ({ ...p, timeline: p.timeline.map((st, idx) => idx === i ? { ...st, to: s.placeName, toLat: String(s.lat), toLng: String(s.lng) } : st) }))} />
                      </BuilderGrid>

                      <FormGroup style={{ marginTop: '1.5rem' }}>
                        <FieldLabel>Navigation Note</FieldLabel>
                        <Input placeholder="General info about this stretch..." value={stop.note} onChange={e => setFormState(p => ({ ...p, timeline: p.timeline.map((s, idx) => idx === i ? { ...s, note: e.target.value } : s) }))} />
                      </FormGroup>

                      <ActivitiesSection>
                        <ActivitiesHeader>
                          <ActivitiesTitle>
                            <FiActivity size={16} /> Activities
                          </ActivitiesTitle>
                          <GhostBtnSm
                            type="button"
                            onClick={() => setFormState(p => ({
                              ...p,
                              timeline: p.timeline.map((s, idx) => idx === i ? {
                                ...s,
                                activities: [...s.activities, { name: '', description: '', link: '', cost: 0, type: ActivityType.Attraction as ActivityType }]
                              } : s)
                            }))}
                          >
                            <FiPlusCircle /> Add
                          </GhostBtnSm>
                        </ActivitiesHeader>

                        <ActivitiesGrid>
                          {stop.activities.map((act, j) => (
                            <ActivityCard key={j}>
                              <ActivityCardHeader>
                                <ActivityNameInput
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
                                <DangerBtn
                                  type="button"
                                  onClick={() => setFormState(p => ({
                                    ...p,
                                    timeline: p.timeline.map((s, idx) => idx === i ? {
                                      ...s,
                                      activities: s.activities.filter((_, aidx) => aidx !== j)
                                    } : s)
                                  }))}
                                >
                                  <FiTrash2 size={14} />
                                </DangerBtn>
                              </ActivityCardHeader>
                              <BuilderGrid>
                                <FormGroup>
                                  <SmallFieldLabel>Type</SmallFieldLabel>
                                  <SmallSelect
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
                                  </SmallSelect>
                                </FormGroup>
                                <FormGroup>
                                  <SmallFieldLabel>Cost (EUR)</SmallFieldLabel>
                                  <SmallInput
                                    type="number"
                                    value={act.cost || ''}
                                    onChange={e => setFormState(p => ({
                                      ...p,
                                      timeline: p.timeline.map((s, idx) => idx === i ? {
                                        ...s,
                                        activities: s.activities.map((a, aidx) => aidx === j ? { ...a, cost: Number(e.target.value) } : a)
                                      } : s)
                                    }))}
                                  />
                                </FormGroup>
                              </BuilderGrid>
                              <FormGroup style={{ marginTop: '0.5rem' }}>
                                <SmallFieldLabel>Description</SmallFieldLabel>
                                <SmallTextarea
                                  rows={2}
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
                              </FormGroup>
                              <FormGroup style={{ marginTop: '0.5rem' }}>
                                <SmallFieldLabel>External Link</SmallFieldLabel>
                                <SmallInput
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
                              </FormGroup>
                            </ActivityCard>
                          ))}
                        </ActivitiesGrid>
                      </ActivitiesSection>
                    </BuilderSection>
                  </TimelineDay>
                ))}
              </TimelineFlow>
              <CenteredGhostBtn type="button" onClick={() => setFormState(p => ({ ...p, timeline: [...p.timeline, createTimelineStopDraft(formState.timeline.length)] }))}>
                <FiPlusCircle /> Extend Timeline
              </CenteredGhostBtn>
            </motion.div>
          )}

          {activeStep === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <BuilderSection style={{ textAlign: 'center' }}>
                <CheckIcon />
                <SectionHeading>Pre-Flight Check</SectionHeading>
                <p>All your trip data is ready. Review the summary below.</p>
              </BuilderSection>

              <TripStatsBar>
                <TripStat>
                  <label>Mission</label>
                  <span>{formState.title || 'Untitled'}</span>
                </TripStat>
                <TripStat>
                  <label>Chronology</label>
                  <span>{formState.timeline.length} Days</span>
                </TripStat>
                <TripStat>
                  <label>Budget</label>
                  <span>{formState.budgetPerPerson} EUR</span>
                </TripStat>
              </TripStatsBar>

              <BuilderSection>
                <SectionHeading>Mission Briefing</SectionHeading>
                <BriefingText>{formState.description}</BriefingText>

                <ChipRow style={{ marginTop: '1.5rem' }}>
                  {formState.tags.map(tag => (
                    <StaticChip key={tag}>{tag}</StaticChip>
                  ))}
                </ChipRow>
              </BuilderSection>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <CreateActions>
          {!isFirst && <GhostBtnLg type="button" disabled={isPublishingTrip} onClick={() => setActiveStep(builderSteps[activeIndex - 1].key)}>Previous Step</GhostBtnLg>}
          {isLast ? (
            <PrimaryBtnLg type="button" onClick={handleCreate} $minWidth="240px" disabled={isPublishingTrip}>
              {isPublishingTrip ? 'Publishing...' : 'Publish Trip'}
            </PrimaryBtnLg>
          ) : (
            <PrimaryBtnLg type="button" $minWidth="240px" disabled={isPublishingTrip} onClick={() => setActiveStep(builderSteps[activeIndex + 1].key)}>Next Step</PrimaryBtnLg>
          )}
        </CreateActions>
      </motion.form>

      <ModalSurface isOpen={Boolean(calendarState)} title="Chronology Sync" subtitle="Pick a date for the mission timeline" onClose={() => setCalendarState(null)}>
        <CalendarHead>
          <GhostBtnSm type="button" onClick={() => shiftMonth(-1)}><FiArrowLeft /></GhostBtnSm>
          <MonthLabel>{calendarState && monthFormatter.format(calendarState.monthCursor)}</MonthLabel>
          <GhostBtnSm type="button" onClick={() => shiftMonth(1)}><FiArrowLeft style={{ transform: 'rotate(180deg)' }} /></GhostBtnSm>
        </CalendarHead>
        <CalendarGrid>
          {calendarCells.map((date, i) => {
            if (!date) return <div key={i} />
            const isSel = selectedCalendarDate && isSameDay(date, selectedCalendarDate)
            return (
              <CalendarDay key={i} type="button" $selected={!!isSel} onClick={() => selectDate(date)}>
                {date.getDate()}
              </CalendarDay>
            )
          })}
        </CalendarGrid>
      </ModalSurface>
    </BuilderWorkspace>
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

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};

  h1 { color: ${({ theme }) => theme.colors.text[100]}; }
  p { color: ${({ theme }) => theme.colors.text[380]}; }
`

const LinkBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(23, 247, 2, 0.3), 0 0 80px rgba(23, 247, 2, 0.1);
  }
`

const BuilderWorkspace = styled(PageSection)``

const BuilderHeader = styled.header`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.lg} 0;

  h1 {
    color: ${({ theme }) => theme.colors.text[100]};
    margin-top: 0.5rem;
  }
`

const BuilderDescription = styled.p`
  max-width: 600px;
  margin: 0.5rem auto;
  color: ${({ theme }) => theme.colors.text[380]};
`

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.green[580]};
  font-weight: 600;
`

const BuilderSteps = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`

const StepIndicator = styled.div<{ $active: boolean }>`
  width: ${({ $active }) => $active ? '4rem' : '1.5rem'};
  height: 4px;
  border-radius: 2px;
  background: ${({ $active, theme }) => $active ? theme.colors.green[500] : theme.colors.lineSoft};
  transition: all 0.3s ease;
`

const BuilderSection = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

const SectionHeading = styled.h3`
  color: ${({ theme }) => theme.colors.text[100]};
`

const BuilderGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const FormGroup = styled.div`
  margin-bottom: 0.25rem;
`

const FieldLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 0.35rem;
  font-weight: 500;
`

const SmallFieldLabel = styled(FieldLabel)`
  font-size: 0.75rem;
`

const Input = styled.input<{ $pl?: string }>`
  width: 100%;
  padding: 0.7rem 1rem;
  padding-left: ${({ $pl }) => $pl ?? '1rem'};
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.1);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;
  min-height: 44px;
  resize: vertical;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.1);
  }
`

const SmallTextarea = styled(Textarea)`
  font-size: 0.8rem;
`

const SmallInput = styled(Input)`
  font-size: 0.8rem;
`

const SmallSelect = styled.select`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: 0.8rem;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.green[500]}; }
`

const InputTrigger = styled.button`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  cursor: pointer;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;

  &:hover { border-color: ${({ theme }) => theme.colors.line}; }
`

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const Chip = styled.button<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  border: 1px solid ${({ $selected, theme }) => $selected ? theme.colors.green[580] : theme.colors.lineSoft};
  background: ${({ $selected }) => $selected ? 'rgba(65, 162, 56, 0.2)' : 'transparent'};
  color: ${({ $selected, theme }) => $selected ? theme.colors.green[500] : theme.colors.text[220]};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const StaticChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  color: ${({ theme }) => theme.colors.text[220]};
  background: rgba(65, 162, 56, 0.08);
`

const InputWrapper = styled.div`
  position: relative;
  flex: 1;
`

const TagIconWrapper = styled.div`
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.4;
  display: flex;
`

const UploadDropzone = styled.label`
  background: rgba(255,255,255,0.02);
  border: 2px dashed rgba(154,198,148,0.1);
  height: 240px;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: ${({ theme }) => theme.spacing.md};
`

const CoverPreviewImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 22px;
`

const UploadHint = styled.p`
  opacity: 0.5;
  color: ${({ theme }) => theme.colors.text[380]};
`

const VisuallyHiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`

const TimelineFlow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const TimelineDay = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  position: relative;

  & > ${BuilderSection} { flex: 1; }
`

const DayMarker = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.green[580]};
  margin-top: 1.5rem;
  flex-shrink: 0;
  box-shadow: 0 0 12px rgba(23, 247, 2, 0.3);
`

const StopHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
`

const ActivitiesSection = styled.div`
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px dashed ${({ theme }) => theme.colors.lineSoft};
`

const ActivitiesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`

const ActivitiesTitle = styled.h4`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text[100]};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const ActivitiesGrid = styled.div`
  display: grid;
  gap: 1rem;
`

const ActivityCard = styled.div`
  padding: 1rem;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const ActivityCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
`

const ActivityNameInput = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: 0;
  padding-left: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[100]};
  flex: 1;
  min-height: 32px;
  outline: none;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus { border-color: ${({ theme }) => theme.colors.green[500]}; }
`

const GhostBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
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

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; background: transparent; }
`

const GhostBtnSm = styled(GhostBtn)`
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  min-height: 36px;
  min-width: 36px;
`

const GhostBtnLg = styled(GhostBtn)`
  padding: 0.85rem 2rem;
  font-size: 1.05rem;
  min-height: 52px;
`

const DangerBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  min-height: 36px;
  min-width: 36px;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: transparent;
  color: ${({ theme }) => theme.colors.danger[500]};
  border: 1px solid rgba(219, 74, 91, 0.25);
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};

  &:hover { background: rgba(219, 74, 91, 0.1); border-color: ${({ theme }) => theme.colors.danger[500]}; }
`

const CenteredGhostBtn = styled(GhostBtn)`
  align-self: center;
  margin-top: 2rem;
`

const CheckIcon = styled(FiCheckCircle).attrs({ size: 48 })`
  color: ${({ theme }) => theme.colors.green[580]};
  margin-bottom: 1rem;
`

const TripStatsBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-wrap: wrap;
  }
`

const TripStat = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  text-align: center;

  label {
    display: block;
    font-size: ${({ theme }) => theme.typography.caption};
    color: ${({ theme }) => theme.colors.text[380]};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }
  span {
    color: ${({ theme }) => theme.colors.text[100]};
    font-size: ${({ theme }) => theme.typography.body};
    font-weight: 600;
  }
`

const BriefingText = styled.p`
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.6;
`

const ErrorBanner = styled.p`
  background: rgba(219, 74, 91, 0.1);
  border: 1px solid rgba(219, 74, 91, 0.3);
  color: ${({ theme }) => theme.colors.danger[500]};
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  margin-top: 2rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const CreateActions = styled.div`
  margin-top: 3rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
`

const PrimaryBtnLg = styled.button<{ $minWidth: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 52px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.85rem 2rem;
  font-size: 1.05rem;
  min-width: ${({ $minWidth }) => $minWidth};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(23, 247, 2, 0.3), 0 0 80px rgba(23, 247, 2, 0.1);
  }
  &:active { transform: translateY(0); }
  &:disabled { opacity: 0.5; transform: none; box-shadow: none; cursor: not-allowed; }
`

const CalendarHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`

const MonthLabel = styled.h4`
  color: ${({ theme }) => theme.colors.text[100]};
`

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
`

const CalendarDay = styled.button<{ $selected: boolean }>`
  padding: 0.8rem;
  border-radius: 12px;
  border: none;
  background: ${({ $selected, theme }) => $selected ? theme.colors.green[580] : theme.colors.surface[860]};
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.bodySmall};

  &:hover {
    background: ${({ $selected, theme }) => $selected ? theme.colors.green[580] : 'rgba(65, 162, 56, 0.25)'};
  }
`
