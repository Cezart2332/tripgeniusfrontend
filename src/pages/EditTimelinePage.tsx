import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiArrowLeft, FiMapPin, FiCalendar, FiActivity, FiPlusCircle, FiTrash2 } from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import api from '../data/api'
import { ActivityType } from '../types/models'
import type { TimelineStop, TripActivity } from '../types/models'
import { isQueuedRequestError } from '../utils/errorMessage'
import { ToastContainer } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'

interface LocationSelection {
  name: string
  placeName: string
  lng: number
  lat: number
}

interface LocationSuggestion extends LocationSelection {
  id: string
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
  const { toasts, addToast, removeToast } = useToast()

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
      startDay: number
      endDay: number
      date?: string
      startingPoint?: string
      endPoint?: string
      fromCoords?: number[]
      toCoords?: number[]
      note?: string
      activities?: TripActivity[]
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
          startDay: timeline.startDay,
          endDay: timeline.endDay,
          date: timeline.date ?? '',
          startingPoint: timeline.startingPoint ?? '',
          endPoint: timeline.endPoint ?? '',
          fromCoords: toMapboxCoords(timeline.fromCoords),
          toCoords: toMapboxCoords(timeline.toCoords),
          note: timeline.note ?? '',
          activities: timeline.activities ?? [],
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

    try {
      const payload = {
        id: timelineDraft?.id,
        tripId,
        startDay: timelineDraft?.startDay,
        endDay: timelineDraft?.endDay,
        startingPoint: timelineDraft?.startingPoint,
        endPoint: timelineDraft?.endPoint,
        fromCoords: timelineDraft?.fromCoords ? [timelineDraft.fromCoords[1], timelineDraft.fromCoords[0]] : undefined,
        toCoords: timelineDraft?.toCoords ? [timelineDraft.toCoords[1], timelineDraft.toCoords[0]] : undefined,
        note: timelineDraft?.note,
        activities: timelineDraft?.activities.map(a => ({
          name: a.name,
          description: a.description,
          link: a.link || '',
          cost: a.cost,
          type: a.type
        }))
      }

      const res = await api.patch('api/trip/update-timeline', payload)

      if (res.status === 200) {
        setTimelineDraft(res.data)
        if (tripId) {
          navigate(`/app/trip/${tripId}?view=map`)
          return
        }
      }
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Timeline changes will be synced when online!', 'success')
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
    if (tripId) {
      navigate(`/app/trip/${tripId}?view=map`)
      return
    }

    navigate(-1)
  }

  if (loading) {
    return (
      <PageSection>
        <Panel>
          <Eyebrow>Timeline Editor</Eyebrow>
          <h1>Loading timeline details</h1>
          <p>Please wait while we fetch the timeline data...</p>
        </Panel>
      </PageSection>
    )
  }

  if (!timelineDraft) {
    return (
      <PageSection>
        <Panel>
          <Eyebrow>Timeline Editor</Eyebrow>
          <h1>Timeline unavailable</h1>
          <p>We could not load this timeline stop.</p>
          <PrimaryBtn type="button" onClick={handleCancel}>
            Back to trip
          </PrimaryBtn>
        </Panel>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PageHeader
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      >
        <HeaderContent>
          <div>
            <Eyebrow>Edit Trip Timeline</Eyebrow>
            <h1>Timeline #{id}</h1>
            <p>Update the route, date, and details for this timeline stop.</p>
          </div>
          <BackBtn type="button" onClick={handleCancel}>
            <FiArrowLeft aria-hidden="true" />
            Back to trip
          </BackBtn>
        </HeaderContent>
      </PageHeader>

      <FormPanel
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      >
        <form onSubmit={(e) => e.preventDefault()}>
          <Fieldset>
            <Legend>Route Details</Legend>

            <FormGroup>
              <FieldLabelEl htmlFor="starting-point">
                <FiMapPin aria-hidden="true" />
                Starting Point
              </FieldLabelEl>
              <LocationAutocompleteWrapper>
                <LocationInputShell>
                  <Input
                    id="starting-point"
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
                </LocationInputShell>
                {fromFocused && fromSuggestions.length > 0 ? (
                  <LocationDropdown>
                    {fromSuggestions.map((suggestion) => (
                      <LocationOption
                        key={suggestion.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleLocationSelect(suggestion, 'startingPoint')
                        }}
                      >
                        <LocationOptionMain>{suggestion.name}</LocationOptionMain>
                        <LocationOptionSub>{suggestion.placeName}</LocationOptionSub>
                      </LocationOption>
                    ))}
                  </LocationDropdown>
                ) : null}
              </LocationAutocompleteWrapper>
              {timelineDraft.fromCoords ? (
                <LocationMeta>
                  {getCoordinateCaption(String(timelineDraft.fromCoords[0]), String(timelineDraft.fromCoords[1]))}
                </LocationMeta>
              ) : null}
            </FormGroup>

            <FormGroup>
              <FieldLabelEl htmlFor="ending-point">
                <FiMapPin aria-hidden="true" />
                Ending Point
              </FieldLabelEl>
              <LocationAutocompleteWrapper>
                <LocationInputShell>
                  <Input
                    id="ending-point"
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
                </LocationInputShell>
                {toFocused && toSuggestions.length > 0 ? (
                  <LocationDropdown>
                    {toSuggestions.map((suggestion) => (
                      <LocationOption
                        key={suggestion.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleLocationSelect(suggestion, 'endingPoint')
                        }}
                      >
                        <LocationOptionMain>{suggestion.name}</LocationOptionMain>
                        <LocationOptionSub>{suggestion.placeName}</LocationOptionSub>
                      </LocationOption>
                    ))}
                  </LocationDropdown>
                ) : null}
              </LocationAutocompleteWrapper>
              {timelineDraft.toCoords ? (
                <LocationMeta>
                  {getCoordinateCaption(String(timelineDraft.toCoords[0]), String(timelineDraft.toCoords[1]))}
                </LocationMeta>
              ) : null}
            </FormGroup>
          </Fieldset>

          <Fieldset>
            <Legend>Additional Information</Legend>

            <BuilderGrid>
              <FormGroup>
                <FieldLabelEl htmlFor="startDay">
                  <FiCalendar aria-hidden="true" />
                  Start Day
                </FieldLabelEl>
                <Input
                  id="startDay"
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
              </FormGroup>

              <FormGroup>
                <FieldLabelEl htmlFor="endDay">
                  <FiCalendar aria-hidden="true" />
                  End Day
                </FieldLabelEl>
                <Input
                  id="endDay"
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
              </FormGroup>
            </BuilderGrid>

            <ActivitiesSection>
               <ActivitiesHeader>
                  <ActivitiesTitle>
                     <FiActivity size={16} /> Activities
                  </ActivitiesTitle>
                  <GhostBtnSm
                    type="button"
                    onClick={() => updateTimelineDraft(p => ({
                      ...p,
                      activities: [...p.activities, { id: 0, name: '', description: '', link: '', cost: 0, type: ActivityType.Attraction }]
                    }))}
                  >
                     <FiPlusCircle /> Add
                  </GhostBtnSm>
               </ActivitiesHeader>

               <ActivitiesGrid>
                  {timelineDraft.activities.map((act, j) => (
                    <ActivityCard key={j}>
                       <ActivityCardHeader>
                          <ActivityNameInput
                            placeholder="Activity name..."
                            value={act.name}
                            onChange={e => updateTimelineDraft(p => ({
                              ...p,
                              activities: p.activities.map((a, aidx) => aidx === j ? { ...a, name: e.target.value } : a)
                            }))}
                          />
                          <DangerBtn type="button" onClick={() => updateTimelineDraft(p => ({
                            ...p,
                            activities: p.activities.filter((_, aidx) => aidx !== j)
                          }))}>
                             <FiTrash2 size={14} />
                          </DangerBtn>
                       </ActivityCardHeader>
                       <BuilderGrid>
                          <FormGroup>
                             <SmallFieldLabel>Type</SmallFieldLabel>
                             <SmallSelect
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
                             </SmallSelect>
                          </FormGroup>
                          <FormGroup>
                             <SmallFieldLabel>Cost (EUR)</SmallFieldLabel>
                             <SmallInput
                               type="number"
                               value={act.cost || ''}
                               onChange={e => updateTimelineDraft(p => ({
                                 ...p,
                                 activities: p.activities.map((a, aidx) => aidx === j ? { ...a, cost: Number(e.target.value) } : a)
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
                            onChange={e => updateTimelineDraft(p => ({
                              ...p,
                              activities: p.activities.map((a, aidx) => aidx === j ? { ...a, description: e.target.value } : a)
                            }))}
                          />
                       </FormGroup>
                       <FormGroup style={{ marginTop: '0.5rem' }}>
                          <SmallFieldLabel>External Link</SmallFieldLabel>
                          <SmallInput
                            placeholder="https://..."
                            value={act.link || ''}
                            onChange={e => updateTimelineDraft(p => ({
                              ...p,
                              activities: p.activities.map((a, aidx) => aidx === j ? { ...a, link: e.target.value } : a)
                            }))}
                          />
                       </FormGroup>
                    </ActivityCard>
                  ))}
               </ActivitiesGrid>
            </ActivitiesSection>

            <FormGroup style={{ marginTop: '1.5rem' }}>
              <FieldLabelEl htmlFor="note">Notes</FieldLabelEl>
              <Textarea
                id="note"
                placeholder="Add any notes or highlights for this day..."
                rows={4}
                value={timelineDraft.note}
                onChange={(e) => updateTimelineDraft((previous) => ({ ...previous, note: e.target.value }))}
              />
            </FormGroup>
          </Fieldset>

          <Actions>
            <GhostBtn type="button" disabled={isSaving} onClick={handleCancel}>
              Cancel
            </GhostBtn>
            <PrimaryBtn type="button" disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </PrimaryBtn>
          </Actions>
        </form>

        <InfoBanner>
          This timeline editor is UI-only. To persist changes, connect this form to your backend API.
        </InfoBanner>
      </FormPanel>
    </PageSection>
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

const Panel = styled.section`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  h1 { color: ${({ theme }) => theme.colors.text[100]}; margin-top: 0.25rem; }
  p { color: ${({ theme }) => theme.colors.text[380]}; margin-bottom: ${({ theme }) => theme.spacing.md}; }
`

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.green[580]};
  font-weight: 600;
`

const PrimaryBtn = styled.button`
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
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  border: none;
  cursor: pointer;

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
  &:disabled { opacity: 0.5; transform: none; box-shadow: none; cursor: not-allowed; }
`

const PageHeader = styled(motion.header)`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  h1 { color: ${({ theme }) => theme.colors.text[100]}; }
  p { color: ${({ theme }) => theme.colors.text[380]}; }
`

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`

const BackBtn = styled.button`
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
  &:disabled { opacity: 0.4; }
`

const FormPanel = styled(motion.section)`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  form { display: flex; flex-direction: column; gap: ${({ theme }) => theme.spacing.lg}; }
`

const Fieldset = styled.fieldset`
  border: none;
  padding: 0;
`

const Legend = styled.legend`
  font-size: ${({ theme }) => theme.typography.body};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

const FormGroup = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
`

const FieldLabelEl = styled.label`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 0.35rem;
  font-weight: 500;
`

const SmallFieldLabel = styled(FieldLabelEl)`
  font-size: 0.75rem;
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

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.1);
  }
  &:disabled { opacity: 0.5; }
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

const SmallTextarea = styled.textarea`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: 0.8rem;
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

const BuilderGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const LocationAutocompleteWrapper = styled.div`
  position: relative;
`

const LocationInputShell = styled.div``

const LocationDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: ${({ theme }) => theme.colors.bg[960]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.md};
  max-height: 220px;
  overflow-y: auto;
  margin-top: 0.25rem;
`

const LocationOption = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 0.65rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  cursor: pointer;
  text-align: left;
  color: ${({ theme }) => theme.colors.text[100]};

  &:last-child { border-bottom: none; }
  &:hover { background: rgba(65, 162, 56, 0.08); }
`

const LocationOptionMain = styled.span`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
`

const LocationOptionSub = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const LocationMeta = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
  margin-top: 0.25rem;
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

const GhostBtnSm = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
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
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`

const GhostBtn = styled(GhostBtnSm)`
  padding: 0.55rem 1.2rem;
  min-height: 44px;
  font-size: ${({ theme }) => theme.typography.body};
`

const DangerBtn = styled(GhostBtnSm)`
  color: ${({ theme }) => theme.colors.danger[500]};
  border-color: rgba(219, 74, 91, 0.25);

  &:hover { background: rgba(219, 74, 91, 0.1); border-color: ${({ theme }) => theme.colors.danger[500]}; color: ${({ theme }) => theme.colors.danger[400]}; }
`

const Actions = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`

const InfoBanner = styled.p`
  background: rgba(65, 162, 56, 0.08);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  color: ${({ theme }) => theme.colors.text[380]};
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-top: ${({ theme }) => theme.spacing.lg};
`
