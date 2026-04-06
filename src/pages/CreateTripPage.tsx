import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronDown,
  FiMapPin,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { addCreatedTrip, mockUserProfile, tripTypeOptions } from '../data/mockData'
import type { Trip, TripStatus, TripTimelineStop } from '../types/models'

interface TimelineDraftStop {
  date: string
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
  destination: string
  status: TripStatus
  startDate: string
  endDate: string
  budgetPerPerson: number
  maxMembers: number
  tags: string[]
  customTag: string
  coverImageDataUrl: string
  coverImageFileName: string
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
  | { kind: 'timeline'; index: number }

interface CalendarState {
  target: CalendarTarget
  monthCursor: Date
}

type BuilderPane = 'overview' | 'timeline' | 'publish'

const builderPanes: Array<{ key: BuilderPane; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'publish', label: 'Publish' },
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
    value: 'upcoming',
    label: 'Upcoming',
    hint: 'Trip is planned and not started yet.',
  },
  {
    value: 'active',
    label: 'Active',
    hint: 'Trip is currently running and members can follow live updates.',
  },
  {
    value: 'completed',
    label: 'Completed',
    hint: 'Trip already ended and should appear in history.',
  },
]

const getDateOffset = (offset: number): string => {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + offset)
  return formatLocalDate(nextDate)
}

const createTimelineStopDraft = (date: string): TimelineDraftStop => ({
  date,
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
    destination: '',
    status: 'upcoming',
    startDate,
    endDate,
    budgetPerPerson: 900,
    maxMembers: 8,
    tags: ['adventure'],
    customTag: '',
    coverImageDataUrl: '',
    coverImageFileName: 'No image selected',
    timeline: [createTimelineStopDraft(startDate)],
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
  if (target.kind === 'trip') {
    return formState[target.field]
  }

  return formState.timeline[target.index]?.date ?? ''
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
  const [searchParams, setSearchParams] = useSearchParams()
  const mapboxPublicToken =
    (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined)?.trim() ?? ''

  const [formState, setFormState] = useState<CreateTripFormState>(
    createInitialFormState,
  )
  const [creationError, setCreationError] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [calendarState, setCalendarState] = useState<CalendarState | null>(null)
  const tabListRef = useRef<HTMLElement | null>(null)
  const requestedPane = searchParams.get('step')
  const activeBuilderPane: BuilderPane =
    requestedPane && builderPanes.some((pane) => pane.key === requestedPane)
      ? (requestedPane as BuilderPane)
      : 'overview'

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
    const calendarTarget = calendarState.target

    if (calendarTarget.kind === 'trip') {
      setFormState((previous) => ({
        ...previous,
        [calendarTarget.field]: serializedDate,
      }))
    } else {
      updateTimelineStop(calendarTarget.index, 'date', serializedDate)
    }

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
    setFormState((previous) => {
      const previousStop = previous.timeline[previous.timeline.length - 1]
      const nextDate = previousStop?.date || previous.startDate

      return {
        ...previous,
        timeline: [...previous.timeline, createTimelineStopDraft(nextDate)],
      }
    })
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
      }))
    }

    reader.onerror = () => {
      setCreationError('Could not read the selected image file.')
    }

    reader.readAsDataURL(selectedFile)
  }

  const handleCreateTrip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreationError(null)

    if (!formState.title.trim() || !formState.destination.trim()) {
      setCreationError('Trip title and destination are required.')
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

    if (!mapboxPublicToken) {
      setCreationError(
        'Mapbox token is missing, so location lookup cannot provide coordinates.',
      )
      return
    }

    let timeline: TripTimelineStop[]

    try {
      timeline = formState.timeline.map((stop, index) => {
        if (!stop.date || !stop.from.trim() || !stop.to.trim()) {
          throw new Error(`Timeline day ${index + 1} needs date, from, and to values.`)
        }

        const fromLng = Number(stop.fromLng)
        const fromLat = Number(stop.fromLat)
        const toLng = Number(stop.toLng)
        const toLat = Number(stop.toLat)

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

        return {
          day: index + 1,
          date: stop.date,
          from: stop.from.trim(),
          to: stop.to.trim(),
          fromCoords: [fromLng, fromLat],
          toCoords: [toLng, toLat],
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

    const tripId = `trip-${Date.now()}`
    const createdTrip: Trip = {
      id: tripId,
      title: formState.title.trim(),
      description: formState.description.trim(),
      destination: formState.destination.trim(),
      coverImage: formState.coverImageDataUrl,
      status: formState.status,
      startDate: formState.startDate,
      endDate: formState.endDate,
      budgetPerPerson: Math.max(1, formState.budgetPerPerson),
      currentMembers: 1,
      maxMembers: Math.max(2, formState.maxMembers),
      tags: formState.tags,
      timeline,
      members: [
        {
          id: mockUserProfile.id,
          name: mockUserProfile.name,
          role: 'owner',
          avatarUrl: mockUserProfile.avatarUrl,
          location: 'Your location',
        },
      ],
    }

    addCreatedTrip(createdTrip)

    navigate('/discover', {
      state: { createdTripTitle: createdTrip.title },
    })
  }

  const hasMapboxToken = Boolean(mapboxPublicToken)
  const selectedStatusOption =
    statusOptions.find((option) => option.value === formState.status) ?? statusOptions[0]

  const selectBuilderPane = (nextPane: BuilderPane) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('step', nextPane)
    setSearchParams(nextParams, { replace: true })
  }

  const focusBuilderTabAt = (index: number) => {
    const tabButtons = tabListRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )

    tabButtons?.[index]?.focus()
  }

  const handleBuilderTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % builderPanes.length
    }

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + builderPanes.length) % builderPanes.length
    }

    if (event.key === 'Home') {
      nextIndex = 0
    }

    if (event.key === 'End') {
      nextIndex = builderPanes.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextPane = builderPanes[nextIndex]
    selectBuilderPane(nextPane.key)
    focusBuilderTabAt(nextIndex)
  }

  return (
    <section className="page create-trip-page">
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

        <nav
          ref={tabListRef}
          className="builder-tab-bar"
          aria-label="Create trip sections"
          role="tablist"
        >
          {builderPanes.map((pane, index) => (
            <button
              key={pane.key}
              type="button"
              id={`builder-tab-${pane.key}`}
              className={
                activeBuilderPane === pane.key
                  ? 'builder-tab-btn is-active'
                  : 'builder-tab-btn'
              }
              role="tab"
              aria-selected={activeBuilderPane === pane.key}
              aria-controls={`builder-panel-${pane.key}`}
              tabIndex={activeBuilderPane === pane.key ? 0 : -1}
              onClick={() => selectBuilderPane(pane.key)}
              onKeyDown={(event) => handleBuilderTabKeyDown(event, index)}
            >
              {pane.label}
            </button>
          ))}
        </nav>

        {!hasMapboxToken ? (
          <p className="info-banner is-error">
            Mapbox token is missing. Add VITE_MAPBOX_PUBLIC_TOKEN in your environment
            to enable location autocomplete and coordinate auto-fill.
          </p>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeBuilderPane}
            id={`builder-panel-${activeBuilderPane}`}
            role="tabpanel"
            aria-labelledby={`builder-tab-${activeBuilderPane}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={builderPaneTransition}
          >
            <div className="create-trip-grid">
              {activeBuilderPane !== 'timeline' ? (
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

            <label className="field-label" htmlFor="create-trip-destination">
              Destination
            </label>
            <input
              id="create-trip-destination"
              className="input"
              value={formState.destination}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  destination: event.target.value,
                }))
              }
              placeholder="Country / cities"
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
              ) : null}

              {activeBuilderPane !== 'overview' ? (
              <div className="timeline-editor">
            <h2>Timeline route stops</h2>
            <p>
              Search locations for each stop and pick suggestions to auto-fill
              coordinates used by the route map and ETA calculation.
            </p>

            {formState.timeline.map((stop, index) => (
              <section key={`${index}-${stop.date}`} className="timeline-stop-card">
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

                <label className="field-label">Day date</label>
                <button
                  className="input input-trigger"
                  type="button"
                  onClick={() =>
                    openCalendar({
                      kind: 'timeline',
                      index,
                    })
                  }
                >
                  <span className="input-trigger-content">
                    <FiCalendar aria-hidden="true" />
                    {formatDateLabel(stop.date)}
                  </span>
                  <FiChevronDown aria-hidden="true" />
                </button>

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

            <button type="button" className="btn btn-ghost" onClick={addTimelineStop}>
              Add another day stop
            </button>
          </div>
              ) : null}
            </div>

            {activeBuilderPane === 'publish' ? (
              <section className="panel create-publish-overview">
                <h2>Publish readiness</h2>
                <p>
                  Review your expedition setup before publishing it to discovery.
                </p>
                <div className="trip-stat-row">
                  <span>Title: {formState.title || 'Missing'}</span>
                  <span>Destination: {formState.destination || 'Missing'}</span>
                  <span>Timeline days: {formState.timeline.length}</span>
                </div>
                <div className="trip-stat-row">
                  <span>Budget: {Math.max(1, formState.budgetPerPerson)} EUR</span>
                  <span>Max members: {Math.max(2, formState.maxMembers)}</span>
                  <span>Tags selected: {formState.tags.length}</span>
                </div>
              </section>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {creationError ? <p className="info-banner is-error">{creationError}</p> : null}

        <div className="create-actions">
          <button className="btn btn-primary" type="submit">
            Publish trip
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setFormState(createInitialFormState())
              setCreationError(null)
            }}
          >
            Reset fields
          </button>
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
