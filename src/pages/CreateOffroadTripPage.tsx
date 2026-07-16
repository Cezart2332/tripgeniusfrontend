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
import styled from 'styled-components'
import { useSelector } from 'react-redux'
import api from '../data/api'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { User } from '../types/models'
import { ToastContainer } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import { FieldHint } from '../components/shared/FieldHint'
import { getErrorMessage, isQueuedRequestError } from '../utils/errorMessage'
import { DiscoveryModeTabs } from '../components/layout/DiscoveryModeTabs'
import { ModalSurface } from '../components/ModalSurface'
import waitForBackendButtonUnlock from '../utils/interactionDelay'
import { EMPTY_OFFROAD_TRACK_GEOJSON } from '../utils/coords'

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
  const { toasts, addToast, removeToast } = useToast()
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
      <OffroadPageSection>
        <p>Please sign in to create an offroad trip.</p>
        <PrimaryLink to="/login">Login</PrimaryLink>
      </OffroadPageSection>
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

      routes.forEach((route, i) => {
        form.append(`Routes[${i}].Name`, route.name)
        form.append(`Routes[${i}].StartDay`, String(route.startDay))
        form.append(`Routes[${i}].EndDay`, String(route.endDay))
        form.append(`Routes[${i}].Note`, route.note)
        form.append(`Routes[${i}].Source`, route.importGpxLater ? 'Drawn' : 'Imported')
        form.append(`Routes[${i}].TrackGeoJson`, EMPTY_OFFROAD_TRACK_GEOJSON)
        form.append(`Routes[${i}].DistanceMeters`, '0')
        form.append(`Routes[${i}].ElevationGainMeters`, '0')
      })

      await api.post('api/OffroadTrip/create-offroad-trip', form)
      addToast('Offroad trip created successfully!', 'success')
      setTimeout(() => navigate('/app/offroad'), 1500)
    } catch (err) {
      if (isQueuedRequestError(err)) {
        addToast('Trip creation will be saved when online!', 'success')
        setTimeout(() => navigate('/app/offroad'), 1500)
      } else {
        addToast(getErrorMessage(err, 'Failed to create trip'), 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
      setLoading(false)
    }
  }

  return (
    <OffroadPageSection>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <DiscoveryModeTabs />
      <BackLink to="/app/offroad">
        <FiArrowLeft aria-hidden /> Back to offroad
      </BackLink>

      <OffroadCreateHero
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <OffroadBadge>
          <FiMap aria-hidden /> New Trail
        </OffroadBadge>
        <h1>{builderSteps[activeIndex].label}</h1>
        <LeadText>{builderSteps[activeIndex].description}</LeadText>
      </OffroadCreateHero>

      <BuilderStepsRow>
        {builderSteps.map((s, i) => (
          <StepIndicator key={s.key} $active={activeIndex === i} />
        ))}
      </BuilderStepsRow>

      <OffroadFormContainer onSubmit={e => e.preventDefault()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <StepViewport>
        <AnimatePresence mode="wait">
          {activeStep === 'details' && (
            <StepPanel
              key="details"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <BuilderSection>
                <SectionHeading><FiNavigation aria-hidden /> Core Identity</SectionHeading>
                <FieldLabel style={{ marginTop: '1.5rem' }}>
                  Title
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carpathian loop, Alpine traverse..." />
                </FieldLabel>
                <FieldLabel style={{ marginTop: '1rem' }}>
                  Description
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Terrain, difficulty, vehicle requirements, what to expect..."
                  />
                </FieldLabel>
                <FieldHint>Mention terrain difficulty and required vehicle setup so drivers know if the route suits them.</FieldHint>
              </BuilderSection>

              <BuilderGrid>
                <BuilderSection>
                  <SectionHeading><FiCalendar aria-hidden /> Schedule</SectionHeading>
                  <FieldLabel style={{ marginTop: '1rem' }}>
                    Start date
                    <InputTrigger type="button" onClick={() => openCalendar('startDate')}>
                      <span>{formatDateLabel(startDate)}</span>
                      <FiCalendar />
                    </InputTrigger>
                  </FieldLabel>
                  <FieldLabel style={{ marginTop: '1rem' }}>
                    End date
                    <InputTrigger type="button" onClick={() => openCalendar('endDate')}>
                      <span>{formatDateLabel(endDate)}</span>
                      <FiCalendar />
                    </InputTrigger>
                  </FieldLabel>
                </BuilderSection>

                <BuilderSection>
                  <SectionHeading><FiMap aria-hidden /> Capacity</SectionHeading>
                  <FieldLabel style={{ marginTop: '1rem' }}>
                    Max participants
                    <Input type="number" min={1} max={50} value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} />
                  </FieldLabel>
                  <FieldLabel style={{ marginTop: '1rem' }}>
                    Price (RON)
                    <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                  </FieldLabel>
                  <FieldHint icon={false}>Set 0 for a free community ride.</FieldHint>
                </BuilderSection>
              </BuilderGrid>

              <BuilderSection>
                <SectionHeading>Visual Identity</SectionHeading>
                <OffroadUploadDropzone htmlFor="offroad-cover-upload">
                  {imagePreview ? (
                    <CoverPreviewImg src={imagePreview} alt="" />
                  ) : (
                    <>
                      <FiUploadCloud size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <UploadHint>Click to upload cover image</UploadHint>
                    </>
                  )}
                </OffroadUploadDropzone>
                <VisuallyHiddenInput id="offroad-cover-upload" type="file" accept="image/*" onChange={handleImageUpload} />
              </BuilderSection>

              <BuilderSection>
                <SectionHeading>Tags</SectionHeading>
                <OffroadTagGrid>
                  {tripTypeOptions.map((tag) => (
                    <OffroadTagChip key={tag} $selected={tags.includes(tag)}>
                      <input
                        type="checkbox"
                        checked={tags.includes(tag)}
                        onChange={(e) => {
                          setTags((prev) => (e.target.checked ? [...prev, tag] : prev.filter((t) => t !== tag)))
                        }}
                      />
                      {tag}
                    </OffroadTagChip>
                  ))}
                </OffroadTagGrid>
              </BuilderSection>
            </StepPanel>
          )}

          {activeStep === 'routes' && (
            <StepPanel
              key="routes"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <BuilderSection>
                <RoutesHeader>
                  <SectionHeading><FiNavigation aria-hidden /> Route Segments</SectionHeading>
                  <GhostBtnSm type="button" onClick={addRoute}>
                    <FiPlusCircle /> Add route
                  </GhostBtnSm>
                </RoutesHeader>
                <Eyebrow style={{ marginTop: '0.5rem' }}>
                  Define daily trail segments. You can import GPX files or draw routes later.
                </Eyebrow>
              </BuilderSection>

              <OffroadRoutesList>
                {routes.length === 0 && (
                  <OffroadEmptyRoutesMini>
                    <p>No routes defined yet. Add your first trail segment.</p>
                    <PrimaryBtn type="button" onClick={addRoute}>
                      <FiPlusCircle /> Add first route
                    </PrimaryBtn>
                  </OffroadEmptyRoutesMini>
                )}

                {routes.map((route, index) => (
                  <RouteCardEditor key={route.id}>
                    <RouteCardHeader>
                      <RouteNumber>{index + 1}</RouteNumber>
                      <RouteNameInput
                        value={route.name}
                        onChange={(e) => updateRoute(route.id, { name: e.target.value })}
                        placeholder="Route name"
                      />
                      {routes.length > 1 && (
                        <GhostBtnSm type="button" onClick={() => removeRoute(route.id)}>
                          <FiTrash2 />
                        </GhostBtnSm>
                      )}
                    </RouteCardHeader>

                    <RouteDaysRow>
                      <FormGroup>
                        <FieldLabel>Start Day</FieldLabel>
                        <SmallInput type="number" min={1} value={route.startDay} onChange={(e) => updateRoute(route.id, { startDay: Number(e.target.value) })} />
                      </FormGroup>
                      <FormGroup>
                        <FieldLabel>End Day</FieldLabel>
                        <SmallInput type="number" min={1} value={route.endDay} onChange={(e) => updateRoute(route.id, { endDay: Number(e.target.value) })} />
                      </FormGroup>
                    </RouteDaysRow>

                    <FormGroup style={{ marginTop: '1rem' }}>
                      <FieldLabel>Navigation Note</FieldLabel>
                      <Input
                        value={route.note}
                        onChange={(e) => updateRoute(route.id, { note: e.target.value })}
                        placeholder="Terrain notes, waypoints, difficulty..."
                      />
                    </FormGroup>

                    <ImportOption>
                      <CheckboxLabel>
                        <input
                          type="checkbox"
                          checked={route.importGpxLater}
                          onChange={(e) => updateRoute(route.id, { importGpxLater: e.target.checked })}
                        />
                        <span>Import GPX or draw later</span>
                      </CheckboxLabel>
                    </ImportOption>
                  </RouteCardEditor>
                ))}
              </OffroadRoutesList>

              {routes.length > 0 && (
                <CenteredGhostBtn type="button" onClick={addRoute}>
                  <FiPlusCircle /> Add another route
                </CenteredGhostBtn>
              )}
            </StepPanel>
          )}

          {activeStep === 'overview' && (
            <StepPanel
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <BuilderSection style={{ textAlign: 'center' }}>
                <CheckIcon />
                <SectionHeading>Pre-Flight Check</SectionHeading>
                <p>Your offroad adventure is ready. Review the summary below.</p>
              </BuilderSection>

              <OffroadStatsBar>
                <OffroadStat>
                  <label>Mission</label>
                  <span>{title || 'Untitled'}</span>
                </OffroadStat>
                <OffroadStat>
                  <label>Routes</label>
                  <span>{routes.length} segments</span>
                </OffroadStat>
                <OffroadStat>
                  <label>Dates</label>
                  <span>{formatDateLabel(startDate)} - {formatDateLabel(endDate)}</span>
                </OffroadStat>
                <OffroadStat>
                  <label>Capacity</label>
                  <span>{maxParticipants} explorers</span>
                </OffroadStat>
              </OffroadStatsBar>

              {imagePreview && (
                <BuilderSection>
                  <SectionHeading>Cover Preview</SectionHeading>
                  <OverviewCoverImg src={imagePreview} alt="Cover preview" />
                </BuilderSection>
              )}

              <BuilderSection>
                <SectionHeading>Mission Briefing</SectionHeading>
                <BriefingText>{description || 'No description provided.'}</BriefingText>

                <OffroadTagPreview>
                  {tags.map(tag => (
                    <OffroadTagChipStatic key={tag}>{tag}</OffroadTagChipStatic>
                  ))}
                </OffroadTagPreview>
              </BuilderSection>

              <BuilderSection>
                <SectionHeading>Route Summary</SectionHeading>
                <OffroadRouteSummaryList>
                  {routes.map((route, idx) => (
                    <OffroadRouteSummaryItem key={route.id}>
                      <OffroadRouteSummaryNum>{idx + 1}</OffroadRouteSummaryNum>
                      <OffroadRouteSummaryInfo>
                        <strong>{route.name}</strong>
                        <span>Days {route.startDay}-{route.endDay} {route.importGpxLater ? '(GPX later)' : ''}</span>
                      </OffroadRouteSummaryInfo>
                    </OffroadRouteSummaryItem>
                  ))}
                </OffroadRouteSummaryList>
              </BuilderSection>
            </StepPanel>
          )}
        </AnimatePresence>
        </StepViewport>

        <CreateActions>
          {!isFirst && (
            <GhostBtnLg type="button" disabled={loading} onClick={() => setActiveStep(builderSteps[activeIndex - 1].key)}>
              Previous
            </GhostBtnLg>
          )}
          {isLast ? (
            <PrimaryBtnLg type="button" onClick={submit} $minWidth="240px" disabled={loading || !title || !startDate || !endDate}>
              {loading ? 'Creating...' : 'Create Offroad Trip'}
            </PrimaryBtnLg>
          ) : (
            <PrimaryBtnLg type="button" $minWidth="240px" disabled={loading} onClick={() => setActiveStep(builderSteps[activeIndex + 1].key)}>
              Next
            </PrimaryBtnLg>
          )}
        </CreateActions>
      </OffroadFormContainer>

      <ModalSurface isOpen={Boolean(calendarState)} title="Select Date" subtitle="Pick a date for your offroad trip" onClose={() => setCalendarState(null)}>
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
    </OffroadPageSection>
  )
}

// --- Styled Components ---

const OffroadPageSection = styled.section`
  width: min(890px, 100% - 2rem);
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

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #ffffff;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
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
    background: rgba(46, 141, 84, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const OffroadCreateHero = styled(motion.header)`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.lg} 0;
`

const OffroadBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.offroad.accentSoft};
  color: ${({ theme }) => theme.colors.offroad.accent};
  margin-bottom: 0.5rem;
`

const LeadText = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 480px;
  margin: 0.5rem auto 0;
  line-height: 1.6;
`

const StepViewport = styled.div`
  position: relative;
  width: 100%;
  overflow: hidden;
  isolation: isolate;
`

const StepPanel = styled(motion.div)`
  width: 100%;
`

const BuilderStepsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

const StepIndicator = styled.div<{ $active: boolean }>`
  width: ${({ $active }) => $active ? '4rem' : '1.5rem'};
  height: 4px;
  border-radius: 2px;
  background: ${({ $active, theme }) => $active ? theme.colors.green[500] : theme.colors.lineSoft};
  transition: all 0.3s ease;
`

const OffroadFormContainer = styled(motion.form)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
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

const Input = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  display: block;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.1);
  }
`

const SmallInput = styled(Input)`
  font-size: 0.8rem;
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
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.1);
  }
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

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.green[580]};
  font-weight: 600;
`

const OffroadUploadDropzone = styled.label`
  background: rgba(28, 43, 32,0.02);
  border: 2px dashed ${({ theme }) => theme.colors.offroad.line};
  height: 200px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 1rem;
`

const CoverPreviewImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: calc(${({ theme }) => theme.radii.md} - 2px);
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

const OffroadTagGrid = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const OffroadTagChip = styled.label<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  border: 1px solid ${({ $selected, theme }) => $selected ? theme.colors.offroad.accent : theme.colors.lineSoft};
  background: ${({ $selected }) => $selected ? 'rgba(168, 120, 31, 0.15)' : 'transparent'};
  color: ${({ $selected, theme }) => $selected ? theme.colors.offroad.accent : theme.colors.text[220]};
  cursor: pointer;

  input { display: none; }
`

const RoutesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const GhostBtnSm = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:hover {
    background: rgba(46, 141, 84, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`

const GhostBtnLg = styled(GhostBtnSm)`
  padding: 0.85rem 2rem;
  font-size: 1.05rem;
  min-height: 52px;
`

const CenteredGhostBtn = styled(GhostBtnSm)`
  align-self: center;
  margin-top: 1rem;
`

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #ffffff;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  border: none;
  cursor: pointer;

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
  &:disabled { opacity: 0.5; transform: none; box-shadow: none; cursor: not-allowed; }
`

const PrimaryBtnLg = styled(PrimaryBtn)<{ $minWidth: string }>`
  min-width: ${({ $minWidth }) => $minWidth};
  padding: 0.85rem 2rem;
  font-size: 1.05rem;
  min-height: 52px;
  box-sizing: border-box;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    min-width: 0;
  }
`

const CreateActions = styled.div`
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  align-items: stretch;
  width: 100%;
  position: relative;
  z-index: 5;
  clear: both;

  & > button {
    flex: 1 1 12rem;
    max-width: 100%;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: stretch;

    & > button {
      width: 100%;
      flex: 1 1 auto;
    }
  }
`

const CheckIcon = styled(FiCheckCircle).attrs({ size: 48 })`
  color: ${({ theme }) => theme.colors.offroad.accent};
  margin-bottom: 1rem;
`

const OffroadStatsBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`

const OffroadStat = styled.div`
  flex: 1;
  min-width: 140px;
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

const OverviewCoverImg = styled.img`
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radii.md};
  margin-top: 1rem;
`

const BriefingText = styled.p`
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.6;
`

const OffroadTagPreview = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const OffroadTagChipStatic = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};
  color: ${({ theme }) => theme.colors.offroad.accent};
  background: rgba(168, 120, 31, 0.08);
`

const OffroadRouteSummaryList = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const OffroadRouteSummaryItem = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: rgba(28, 43, 32,0.02);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.md};
`

const OffroadRouteSummaryNum = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.offroad.accent};
  color: #ffffff;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
`

const OffroadRouteSummaryInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  strong { color: ${({ theme }) => theme.colors.text[100]}; }
  span { color: ${({ theme }) => theme.colors.text[380]}; font-size: ${({ theme }) => theme.typography.caption}; }
`

const OffroadRoutesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const OffroadEmptyRoutesMini = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  p { color: ${({ theme }) => theme.colors.text[380]}; margin-bottom: ${({ theme }) => theme.spacing.md}; }
`

const RouteCardEditor = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
`

const RouteCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`

const RouteNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.offroad.accent};
  color: #ffffff;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
`

const RouteNameInput = styled.input`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: transparent;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  outline: none;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus { border-color: ${({ theme }) => theme.colors.green[500]}; }
`

const RouteDaysRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1rem;
`

const ImportOption = styled.div`
  margin-top: 1rem;
`

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  cursor: pointer;

  input[type="checkbox"] { accent-color: ${({ theme }) => theme.colors.offroad.accent}; }
`

const CalendarHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  min-width: 0;
`

const MonthLabel = styled.h4`
  flex: 1;
  min-width: 0;
  text-align: center;
  color: ${({ theme }) => theme.colors.text[100]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
  width: 100%;
  min-width: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    gap: 0.2rem;
  }
`

const CalendarDay = styled.button<{ $selected: boolean }>`
  aspect-ratio: 1;
  min-width: 0;
  padding: 0.5rem 0.25rem;
  border-radius: 10px;
  border: none;
  background: ${({ $selected, theme }) => $selected ? theme.colors.offroad.accent : theme.colors.surface[860]};
  color: ${({ $selected, theme }) => $selected ? '#ffffff' : theme.colors.text[100]};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  line-height: 1;

  &:hover { opacity: 0.85; }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 0.35rem 0.15rem;
    font-size: ${({ theme }) => theme.typography.caption};
    border-radius: 8px;
  }
`
