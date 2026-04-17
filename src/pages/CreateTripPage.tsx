import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronDown,
  FiMapPin,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { User } from '../types/models'
import { useSelector } from 'react-redux'
import type { TripStatus, TripTimelineStop } from '../types/models'
import api from '../data/api'
import { AxiosError } from 'axios'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState, FeedbackToastTone } from '../components/FeedbackToast'
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

type LocationField = 'from' | 'to'

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

interface MapboxFeature {
  id: string
  text: string
  place_name: string
  center: [number, number]
}

interface MapboxGeocodingResponse {
  features?: MapboxFeature[]
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
  mapboxToken: string
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

const builderSteps: Array<{ key: BuilderStep; label: string }> = [
  { key: 'details', label: 'Trip details' },
  { key: 'timeline', label: 'Route timeline' },
  { key: 'overview', label: 'Overview' },
]

const revealTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
}

const modalTransition = {
  duration: 0.25,
  ease: [0.2, 0.8, 0.2, 1] as const,
}

const builderPaneTransition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1] as const,
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

const dateLabelFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const statusOptions: Array<{ value: TripStatus; label: string; hint: string }> = [
  {
    value: 'Upcoming',
    label: 'Upcoming',
    hint: 'Trip is planned and not started yet.',
  },
  {
    value: 'Started',
    label: 'Started',
    hint: 'Trip is currently running and members can follow live updates.',
  },
  {
    value: 'Finished',
    label: 'Finished',
    hint: 'Trip already ended and should appear in history.',
  },
]

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



const sanitizeTag = (tag: string): string =>
  tag.trim().toLowerCase().replace(/\s+/g, '-')

const parseLocalDate = (value: string): Date | null => {
  const [yearValue, monthValue, dayValue] = value.split('-').map(Number)
  if (!yearValue || !monthValue || !dayValue) {
    return null
  }

  const date = new Date(yearValue, monthValue - 1, dayValue)

  if (
    date.getFullYear() !== yearValue ||
    date.getMonth() !== monthValue - 1 ||
    date.getDate() !== dayValue
  ) {
    return null
  }

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
  if (!parsedDate) {
    return 'Select date'
  }

  return dateLabelFormatter.format(parsedDate)
}

const buildCalendarCells = (monthCursor: Date): Array<Date | null> => {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const leadingEmptyCells = firstDay.getDay()
  const cells: Array<Date | null> = Array.from(
    { length: leadingEmptyCells },
    () => null,
  )

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day))
  }

  return cells
}

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

function ModalSurface({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
}: ModalSurfaceProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalTransition}
          onClick={onClose}
        >
          <motion.div
            className="modal-card"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={modalTransition}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head">
              <div>
                <h2>{title}</h2>
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
              <button className="modal-close" type="button" onClick={onClose}>
                <FiX aria-hidden="true" />
                <span className="visually-hidden">Close modal</span>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function LocationAutocompleteField({
  id,
  label,
  placeholder,
  value,
  mapboxToken,
  onValueChange,
  onLocationSelect,
}: LocationAutocompleteFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])

  const query = value.trim()

  useEffect(() => {
    if (!mapboxToken || query.length < 2) {
      setSuggestions([])
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const debounceTimer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?autocomplete=true&limit=6&types=place,locality,address,poi&access_token=${mapboxToken}`

        const response = await fetch(endpoint, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Location search temporarily unavailable.')
        }

        const payload = (await response.json()) as MapboxGeocodingResponse

        const parsedSuggestions = (payload.features ?? [])
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

        setSuggestions(parsedSuggestions)
      } catch (searchError) {
        if (controller.signal.aborted) {
          return
        }

        const message =
          searchError instanceof Error
            ? searchError.message
            : 'Could not fetch location suggestions.'
        setError(message)
        setSuggestions([])
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 280)

    return () => {
      controller.abort()
      window.clearTimeout(debounceTimer)
    }
  }, [mapboxToken, query])

  const showDropdown = isFocused && (isLoading || suggestions.length > 0 || !!error)

  return (
    <div className="location-autocomplete">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="location-input-shell">
        <FiMapPin aria-hidden="true" className="location-input-icon" />
        <input
          id={id}
          className="input location-input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsFocused(false)
            }, 120)
          }}
          placeholder={placeholder}
          required
        />
      </div>

      {showDropdown ? (
        <div className="location-dropdown">
          {isLoading ? (
            <p className="location-meta">
              <span className="inline-loading-content">
                <span className="inline-spinner" aria-hidden="true" />
                Searching places...
              </span>
            </p>
          ) : null}
          {!isLoading && error ? <p className="location-meta is-error">{error}</p> : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <p className="location-meta">No matches found for this location.</p>
          ) : null}

          {!isLoading && !error
            ? suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="location-option"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onLocationSelect(suggestion)
                    setIsFocused(false)
                  }}
                >
                  <span className="location-option-main">{suggestion.name}</span>
                  <span className="location-option-sub">{suggestion.placeName}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  )
}

const getCalendarValue = (
  target: CalendarTarget,
  formState: CreateTripFormState,
): string => {
  return formState[target.field]
}

const getCoordinateCaption = (lng: string, lat: string): string => {
  const parsedLng = Number(lng)
  const parsedLat = Number(lat)

  if (!Number.isFinite(parsedLng) || !Number.isFinite(parsedLat)) {
    return 'No coordinates yet. Select a location from the search list.'
  }

  return `Lat ${parsedLat.toFixed(5)} / Lng ${parsedLng.toFixed(5)}`
}

export function CreateTripPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const mapboxPublicToken =
    (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined)?.trim() ?? ''

  const [formState, setFormState] = useState<CreateTripFormState>(
    createInitialFormState,
  )
  const [activeBuilderStep, setActiveBuilderStep] = useState<BuilderStep>('details')
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [creationError, setCreationError] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [calendarState, setCalendarState] = useState<CalendarState | null>(null)

  const activeBuilderStepIndex = Math.max(
    0,
    builderSteps.findIndex((step) => step.key === activeBuilderStep),
  )
  const isFirstBuilderStep = activeBuilderStepIndex === 0
  const isLastBuilderStep = activeBuilderStepIndex === builderSteps.length - 1
  const nextBuilderStep = !isLastBuilderStep
    ? builderSteps[activeBuilderStepIndex + 1]
    : null

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  const calendarCells = useMemo(() => {
    if (!calendarState) {
      return []
    }

    return buildCalendarCells(calendarState.monthCursor)
  }, [calendarState])

  const selectedCalendarDate = useMemo(() => {
    if (!calendarState) {
      return null
    }

    return parseLocalDate(getCalendarValue(calendarState.target, formState))
  }, [calendarState, formState])

  const openCalendar = (target: CalendarTarget) => {
    const currentValue = getCalendarValue(target, formState)
    const parsedDate = parseLocalDate(currentValue) ?? new Date()

    setCalendarState({
      target,
      monthCursor: new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1),
    })
  }

  const closeCalendar = () => {
    setCalendarState(null)
  }

  const shiftCalendarMonth = (step: number) => {
    setCalendarState((previous) => {
      if (!previous) {
        return previous
      }

      return {
        ...previous,
        monthCursor: new Date(
          previous.monthCursor.getFullYear(),
          previous.monthCursor.getMonth() + step,
          1,
        ),
      }
    })
  }

  const selectCalendarDate = (date: Date) => {
    if (!calendarState) {
      return
    }

    const serializedDate = formatLocalDate(date)

    setFormState((previous) => ({
      ...previous,
      [calendarState.target.field]: serializedDate,
    }))

    closeCalendar()
  }

  const updateTimelineStop = (
    index: number,
    field: keyof TimelineDraftStop,
    value: string,
  ) => {
    setFormState((previous) => ({
      ...previous,
      timeline: previous.timeline.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, [field]: value } : stop,
      ),
    }))
  }

  const updateTimelineLocationValue = (
    index: number,
    field: LocationField,
    value: string,
  ) => {
    setFormState((previous) => ({
      ...previous,
      timeline: previous.timeline.map((stop, stopIndex) => {
        if (stopIndex !== index) {
          return stop
        }

        if (field === 'from') {
          return {
            ...stop,
            from: value,
            fromLng: '',
            fromLat: '',
          }
        }

        return {
          ...stop,
          to: value,
          toLng: '',
          toLat: '',
        }
      }),
    }))
  }

  const applyTimelineLocationSelection = (
    index: number,
    field: LocationField,
    selection: LocationSelection,
  ) => {
    setFormState((previous) => ({
      ...previous,
      timeline: previous.timeline.map((stop, stopIndex) => {
        if (stopIndex !== index) {
          return stop
        }

        if (field === 'from') {
          return {
            ...stop,
            from: selection.placeName,
            fromLng: selection.lng.toFixed(6),
            fromLat: selection.lat.toFixed(6),
          }
        }

        return {
          ...stop,
          to: selection.placeName,
          toLng: selection.lng.toFixed(6),
          toLat: selection.lat.toFixed(6),
        }
      }),
    }))
  }

  const addTimelineStop = () => {
    setFormState((previous) => ({
      ...previous,
      timeline: [...previous.timeline, createTimelineStopDraft()],
    }))
  }

  const removeTimelineStop = (index: number) => {
    setFormState((previous) => {
      if (previous.timeline.length <= 1) {
        return previous
      }

      return {
        ...previous,
        timeline: previous.timeline.filter((_, stopIndex) => stopIndex !== index),
      }
    })
  }

  const toggleTripTag = (tag: string) => {
    setFormState((previous) => {
      const alreadySelected = previous.tags.includes(tag)

      return {
        ...previous,
        tags: alreadySelected
          ? previous.tags.filter((tripTag) => tripTag !== tag)
          : [...previous.tags, tag],
      }
    })
  }

  const addCustomTag = () => {
    const normalizedTag = sanitizeTag(formState.customTag)
    if (!normalizedTag) {
      return
    }

    setFormState((previous) => {
      if (previous.tags.includes(normalizedTag)) {
        return { ...previous, customTag: '' }
      }

      return {
        ...previous,
        tags: [...previous.tags, normalizedTag],
        customTag: '',
      }
    })
  }

  const handleCoverImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0]
    setCreationError(null)

    if (!selectedFile) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        setCreationError('Could not read the selected image file.')
        return
      }

      setFormState((previous) => ({
        ...previous,
        coverImageDataUrl: result,
        coverImageFileName: selectedFile.name,
        coverImageFile:selectedFile
      }))
    }

    reader.onerror = () => {
      setCreationError('Could not read the selected image file.')
    }

    reader.readAsDataURL(selectedFile)
  }

  const createTrip = async (
    title: string,
    description: string,
    image: File | null,
    startingDate: Date,
    endingDate: Date,
    status: TripStatus,
    tags: string[],
    maxParticipants: number,
    price: number,
    timelines: TripTimelineStop[],
  ) => {
    const formData = new FormData()
    formData.append('title', title)
    formData.append('description', description)
    if (image) {
      formData.append('image', image)
    }
    formData.append('startingDate', startingDate.toISOString())
    formData.append('endingDate', endingDate.toISOString())
    formData.append('status', status)
    tags.forEach((tag) => formData.append('tags', tag))
    formData.append('maxParticipants', String(maxParticipants))
    formData.append('price', String(price))
    timelines.forEach((timeline, i) =>{
      formData.append(`Timelines[${i}].Day`, String(timeline.day))
      formData.append(`Timelines[${i}].StartingPoint`, timeline.startingPoint)
      formData.append(`Timelines[${i}].FromCoords[0]`, String(timeline.fromCoords[0]))
      formData.append(`Timelines[${i}].FromCoords[1]`, String(timeline.fromCoords[1]))
      formData.append(`Timelines[${i}].EndPoint`, timeline.endPoint)
      formData.append(`Timelines[${i}].ToCoords[0]`, String(timeline.toCoords[0]))
      formData.append(`Timelines[${i}].ToCoords[1]`, String(timeline.toCoords[1]))
      formData.append(`Timelines[${i}].Note`, String(timeline.note))
    })


    return api.post('/api/trip/create-trip', formData)
  }

  const handleCreateTrip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreationError(null)

    if (!formState.title.trim()) {
      setCreationError('Trip title is required.')
      return
    }

    if (!formState.description.trim()) {
      setCreationError('Please add a short trip description.')
      return
    }

    if (!formState.coverImageDataUrl) {
      setCreationError('Please upload a cover image file for the trip.')
      return
    }

    if (formState.tags.length === 0) {
      setCreationError('Select at least one trip tag.')
      return
    }

    const startDate = parseLocalDate(formState.startDate)
    const endDate = parseLocalDate(formState.endDate)

    if (!startDate || !endDate) {
      setCreationError('Please select valid start and end dates from the calendar.')
      return
    }

    if (startDate.getTime() > endDate.getTime()) {
      setCreationError('Trip end date must be the same as or after the start date.')
      return
    }

    const minimumEndDate = new Date(startDate)
    minimumEndDate.setDate(startDate.getDate() + (formState.timeline.length - 1))

    if (endDate.getTime() < minimumEndDate.getTime()) {
      setCreationError(
        `End date should include all timeline days. Choose ${formatDateLabel(
          formatLocalDate(minimumEndDate),
        )} or later.`,
      )
      return
    }

    if (!mapboxPublicToken) {
      setCreationError(
        'Mapbox token is missing, so location lookup cannot provide coordinates.',
      )
      return
    }

    let timeline: TripTimelineStop[]

    try {
      timeline = formState.timeline.map((stop, index) => {
        if (!stop.from.trim() || !stop.to.trim()) {
          throw new Error(`Timeline day ${index + 1} needs both From and To locations.`)
        }

        const fromLat = Number(stop.fromLat)
        const fromLng = Number(stop.fromLng)
        const toLat = Number(stop.toLat)
        const toLng = Number(stop.toLng)
        
        if (
          !Number.isFinite(fromLng) ||
          !Number.isFinite(fromLat) ||
          !Number.isFinite(toLng) ||
          !Number.isFinite(toLat)
        ) {
          throw new Error(
            `Timeline day ${index + 1} is missing coordinates. Pick a place from the search suggestions for both From and To.`,
          )
        }

        const timelineDate = new Date(startDate)
        timelineDate.setDate(startDate.getDate() + index)

        return {
          day: index + 1,
          date: formatLocalDate(timelineDate),
          startingPoint: stop.from.trim(),
          endPoint: stop.to.trim(),
          fromCoords: [fromLat, fromLng],
          toCoords: [toLat, toLng],
          note: stop.note.trim() || 'Trip stop details will be updated by trip admins.',
        }
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Please complete all timeline fields before publishing.'
      setCreationError(message)
      return
    }

    try {
      await createTrip(
        formState.title,
        formState.description,
        formState.coverImageFile,
        startDate,
        endDate,
        formState.status,
        formState.tags,
        formState.maxMembers,
        formState.budgetPerPerson,
        timeline,
      )

      showToast('Your trip has been created successfully', 'success')
      window.setTimeout(() => {
        navigate('/discover', { replace: true })
      }, 2000)
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const message =
          err.response?.data?.message ||
          err.response?.data ||
          'There was a problem creating your trip'
        showToast(String(message), 'error')
      } else {
        showToast('There was a problem creating your trip', 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
    }

    



  }

  const hasMapboxToken = Boolean(mapboxPublicToken)
  const selectedStatusOption =
    statusOptions.find((option) => option.value === formState.status) ?? statusOptions[0]

  const getTimelineDateLabel = (index: number): string => {
    const parsedStartDate = parseLocalDate(formState.startDate)
    if (!parsedStartDate) {
      return `Day ${index + 1}`
    }

    const timelineDate = new Date(parsedStartDate)
    timelineDate.setDate(parsedStartDate.getDate() + index)
    return formatDateLabel(formatLocalDate(timelineDate))
  }

  const selectBuilderStep = (nextStep: BuilderStep) => {
    setCreationError(null)
    setActiveBuilderStep(nextStep)
  }

  const goToNextBuilderStep = () => {
    if (isLastBuilderStep) {
      return
    }

    selectBuilderStep(builderSteps[activeBuilderStepIndex + 1].key)
  }

  const goToPreviousBuilderStep = () => {
    if (isFirstBuilderStep) {
      return
    }

    selectBuilderStep(builderSteps[activeBuilderStepIndex - 1].key)
  }

  if (!user) {
    return (
      <section className="page profile-page">
        <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
        <section className="panel profile-editor-card">
          <p className="eyebrow">Profile</p>
          <h1>You are not logged in</h1>
          <p>Log in to edit your profile and unlock personalized trip discovery.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </section>
      </section>
    )
  }

  return (
    <section className="page create-trip-page">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
      <motion.form
        className="panel create-trip-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
        onSubmit={handleCreateTrip}
      >
        <div className="profile-section-head">
          <div>
            <p className="eyebrow">Create trip</p>
            <h1>Publish a new trip</h1>
            <p>
              Use custom controls for status and dates, and select timeline locations
              from search suggestions to auto-fill latitude and longitude.
            </p>
          </div>
          <Link className="btn btn-ghost" to="/discover">
            <FiArrowLeft aria-hidden="true" />
            Back to discovery
          </Link>
        </div>

        <ol className="builder-stepper" aria-label="Create trip steps">
          {builderSteps.map((step, index) => {
            const isActive = step.key === activeBuilderStep
            const isComplete = index < activeBuilderStepIndex

            return (
              <li
                key={step.key}
                className={
                  isActive
                    ? 'builder-step-item is-active'
                    : isComplete
                      ? 'builder-step-item is-complete'
                      : 'builder-step-item'
                }
              >
                <button
                  type="button"
                  className="builder-step-btn"
                  onClick={() => selectBuilderStep(step.key)}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="builder-step-index">{index + 1}</span>
                  <span>{step.label}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <p className="field-help builder-step-caption">
          Step {activeBuilderStepIndex + 1} of {builderSteps.length}
        </p>

        {!hasMapboxToken ? (
          <p className="info-banner is-error">
            Mapbox token is missing. Add VITE_MAPBOX_PUBLIC_TOKEN in your environment
            to enable location autocomplete and coordinate auto-fill.
          </p>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeBuilderStep}
            className="builder-step-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={builderPaneTransition}
          >
            {activeBuilderStep === 'details' ? (
              <div className="create-trip-grid create-trip-grid-single">
                <div>
                  <label className="field-label" htmlFor="create-trip-title">
                    Trip title
                  </label>
                  <input
                    id="create-trip-title"
                    className="input"
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Ex: Balkan Summer Roadtrip"
                    required
                  />

                  <label className="field-label" htmlFor="create-trip-description">
                    Description
                  </label>
                  <textarea
                    id="create-trip-description"
                    className="input input-area"
                    rows={4}
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Write what this trip is about"
                    required
                  />

                  <label className="field-label" htmlFor="create-trip-cover-file">
                    Cover image file
                  </label>
                  <label className="upload-dropzone" htmlFor="create-trip-cover-file">
                    <FiUploadCloud className="upload-icon" aria-hidden="true" />
                    <span>Drop an image or click to upload</span>
                    <small className="file-note">{formState.coverImageFileName}</small>
                  </label>
                  <input
                    id="create-trip-cover-file"
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCoverImageUpload}
                  />

                  {formState.coverImageDataUrl ? (
                    <img
                      src={formState.coverImageDataUrl}
                      alt="Trip cover preview"
                      className="trip-cover-preview"
                    />
                  ) : null}

                  <div className="create-fields-row">
                    <div>
                      <label className="field-label">Status</label>
                      <button
                        className="input input-trigger"
                        type="button"
                        onClick={() => setStatusModalOpen(true)}
                      >
                        <span className="input-trigger-content">
                          {selectedStatusOption.label}
                        </span>
                        <FiChevronDown aria-hidden="true" />
                      </button>
                      <p className="field-help">{selectedStatusOption.hint}</p>
                    </div>

                    <div>
                      <label className="field-label" htmlFor="create-trip-budget">
                        Budget / person (EUR)
                      </label>
                      <input
                        id="create-trip-budget"
                        className="input"
                        type="number"
                        min={1}
                        value={formState.budgetPerPerson}
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            budgetPerPerson: Number(event.target.value),
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="create-fields-row">
                    <div>
                      <label className="field-label">Start date</label>
                      <button
                        className="input input-trigger"
                        type="button"
                        onClick={() =>
                          openCalendar({
                            kind: 'trip',
                            field: 'startDate',
                          })
                        }
                      >
                        <span className="input-trigger-content">
                          <FiCalendar aria-hidden="true" />
                          {formatDateLabel(formState.startDate)}
                        </span>
                        <FiChevronDown aria-hidden="true" />
                      </button>
                    </div>

                    <div>
                      <label className="field-label">End date</label>
                      <button
                        className="input input-trigger"
                        type="button"
                        onClick={() =>
                          openCalendar({
                            kind: 'trip',
                            field: 'endDate',
                          })
                        }
                      >
                        <span className="input-trigger-content">
                          <FiCalendar aria-hidden="true" />
                          {formatDateLabel(formState.endDate)}
                        </span>
                        <FiChevronDown aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <label className="field-label" htmlFor="create-trip-max-members">
                    Maximum members
                  </label>
                  <input
                    id="create-trip-max-members"
                    className="input"
                    type="number"
                    min={2}
                    value={formState.maxMembers}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        maxMembers: Number(event.target.value),
                      }))
                    }
                    required
                  />

                  <label className="field-label">Trip tags</label>
                  <div className="chip-row">
                    {tripTypeOptions.map((tripType) => {
                      const selected = formState.tags.includes(tripType)

                      return (
                        <button
                          key={tripType}
                          type="button"
                          className={selected ? 'chip is-selected' : 'chip'}
                          onClick={() => toggleTripTag(tripType)}
                        >
                          {tripType}
                        </button>
                      )
                    })}
                  </div>

                  <div className="custom-tag-row">
                    <input
                      className="input"
                      value={formState.customTag}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          customTag: event.target.value,
                        }))
                      }
                      placeholder="Add custom tag"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={addCustomTag}
                    >
                      Add tag
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeBuilderStep === 'timeline' ? (
              <div className="timeline-editor">
                <h2>Timeline route stops</h2>
                <p>
                  Add route stops for each day. Dates are automatically assigned in
                  order, starting from your trip start date.
                </p>

                {formState.timeline.map((stop, index) => (
                  <section key={`timeline-stop-${index}`} className="timeline-stop-card">
                    <div className="timeline-stop-header">
                      <p className="list-title">Day {index + 1}</p>
                      {formState.timeline.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn-ghost timeline-remove-btn"
                          onClick={() => removeTimelineStop(index)}
                        >
                          Remove day
                        </button>
                      ) : null}
                    </div>

                    <div className="create-fields-row">
                      <div>
                        <LocationAutocompleteField
                          id={`timeline-from-${index}`}
                          label="From"
                          placeholder="Search departure location"
                          mapboxToken={mapboxPublicToken ?? ''}
                          value={stop.from}
                          onValueChange={(value) =>
                            updateTimelineLocationValue(index, 'from', value)
                          }
                          onLocationSelect={(selection) =>
                            applyTimelineLocationSelection(index, 'from', selection)
                          }
                        />
                        <p className="coord-caption">
                          {getCoordinateCaption(stop.fromLng, stop.fromLat)}
                        </p>
                      </div>

                      <div>
                        <LocationAutocompleteField
                          id={`timeline-to-${index}`}
                          label="To"
                          placeholder="Search destination location"
                          mapboxToken={mapboxPublicToken ?? ''}
                          value={stop.to}
                          onValueChange={(value) =>
                            updateTimelineLocationValue(index, 'to', value)
                          }
                          onLocationSelect={(selection) =>
                            applyTimelineLocationSelection(index, 'to', selection)
                          }
                        />
                        <p className="coord-caption">
                          {getCoordinateCaption(stop.toLng, stop.toLat)}
                        </p>
                      </div>
                    </div>

                    <label className="field-label" htmlFor={`timeline-note-${index}`}>
                      Stop note
                    </label>
                    <textarea
                      id={`timeline-note-${index}`}
                      className="input input-area"
                      rows={2}
                      value={stop.note}
                      onChange={(event) =>
                        updateTimelineStop(index, 'note', event.target.value)
                      }
                      placeholder="Plan for this day"
                    />
                  </section>
                ))}

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addTimelineStop}
                >
                  Add another day stop
                </button>
              </div>
            ) : null}

            {activeBuilderStep === 'overview' ? (
              <section className="panel create-publish-overview">
                <h2>Trip overview</h2>
                <p>Review your details before publishing.</p>

                <div className="trip-stat-row">
                  <span>Title: {formState.title || 'Missing'}</span>
                  <span>Status: {selectedStatusOption.label}</span>
                  <span>Timeline days: {formState.timeline.length}</span>
                </div>

                <div className="trip-stat-row">
                  <span>Start: {formatDateLabel(formState.startDate)}</span>
                  <span>End: {formatDateLabel(formState.endDate)}</span>
                  <span>Budget: {Math.max(1, formState.budgetPerPerson)} EUR</span>
                  <span>Max members: {Math.max(2, formState.maxMembers)}</span>
                </div>

                <section className="overview-block">
                  <p className="list-title">Description</p>
                  <p>{formState.description || 'Missing description'}</p>
                </section>

                <section className="overview-block">
                  <p className="list-title">Trip tags</p>
                  <div className="chip-row">
                    {formState.tags.length > 0
                      ? formState.tags.map((tag) => (
                          <span key={tag} className="chip is-selected">
                            {tag}
                          </span>
                        ))
                      : 'No tags selected yet.'}
                  </div>
                </section>

                {formState.coverImageDataUrl ? (
                  <section className="overview-block">
                    <p className="list-title">Cover preview</p>
                    <img
                      src={formState.coverImageDataUrl}
                      alt="Trip cover preview"
                      className="trip-cover-preview"
                    />
                  </section>
                ) : null}

                <section className="overview-block">
                  <p className="list-title">Timeline summary</p>
                  <div className="overview-timeline-list">
                    {formState.timeline.map((stop, index) => (
                      <article
                        key={`overview-stop-${index}`}
                        className="overview-timeline-item"
                      >
                        <p className="list-title">
                          Day {index + 1} · {getTimelineDateLabel(index)}
                        </p>
                        <p>
                          {stop.from.trim() || 'Missing departure'} to{' '}
                          {stop.to.trim() || 'Missing destination'}
                        </p>
                        <p className="trip-submeta">
                          {stop.note.trim() || 'No note added for this day.'}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {creationError ? <p className="info-banner is-error">{creationError}</p> : null}

        <div className="create-actions">
          {!isFirstBuilderStep ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={goToPreviousBuilderStep}
            >
              Previous step
            </button>
          ) : null}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setFormState(createInitialFormState())
              setCreationError(null)
              setActiveBuilderStep('details')
            }}
          >
            Reset fields
          </button>

          {!isLastBuilderStep ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={goToNextBuilderStep}
            >
              {nextBuilderStep ? `Next: ${nextBuilderStep.label}` : 'Next step'}
            </button>
          ) : (
            <button className="btn btn-primary" type="submit">
              Publish trip
            </button>
          )}
        </div>
      </motion.form>

      <ModalSurface
        isOpen={statusModalOpen}
        title="Trip status"
        subtitle="Choose how the trip should appear in discovery."
        onClose={() => setStatusModalOpen(false)}
      >
        <div className="option-stack">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === formState.status
                  ? 'option-item is-active'
                  : 'option-item'
              }
              onClick={() => {
                setFormState((previous) => ({
                  ...previous,
                  status: option.value,
                }))
                setStatusModalOpen(false)
              }}
            >
              <span>{option.label}</span>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </ModalSurface>

      <ModalSurface
        isOpen={Boolean(calendarState)}
        title="Select date"
        subtitle="Pick a date from the custom trip calendar."
        onClose={closeCalendar}
      >
        {calendarState ? (
          <div className="calendar-shell">
            <div className="calendar-head">
              <button
                type="button"
                className="icon-btn"
                onClick={() => shiftCalendarMonth(-1)}
              >
                <FiChevronDown aria-hidden="true" className="icon-rotated" />
                <span className="visually-hidden">Previous month</span>
              </button>
              <p>{monthFormatter.format(calendarState.monthCursor)}</p>
              <button
                type="button"
                className="icon-btn"
                onClick={() => shiftCalendarMonth(1)}
              >
                <FiChevronDown aria-hidden="true" className="icon-rotated-down" />
                <span className="visually-hidden">Next month</span>
              </button>
            </div>

            <div className="calendar-weekdays">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarCells.map((calendarDate, index) => {
                if (!calendarDate) {
                  return <span key={`empty-${index}`} className="calendar-empty" />
                }

                const isSelected = selectedCalendarDate
                  ? isSameDay(calendarDate, selectedCalendarDate)
                  : false
                const isToday = isSameDay(calendarDate, new Date())

                return (
                  <button
                    key={calendarDate.toISOString()}
                    type="button"
                    className={
                      isSelected
                        ? 'calendar-day is-selected'
                        : isToday
                          ? 'calendar-day is-today'
                          : 'calendar-day'
                    }
                    onClick={() => selectCalendarDate(calendarDate)}
                  >
                    {calendarDate.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </ModalSurface>
    </section>
  )
}
