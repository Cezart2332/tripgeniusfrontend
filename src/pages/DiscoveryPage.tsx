import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiPlusCircle, FiSliders, FiZap } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import styled from 'styled-components'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { Trip, User } from '../types/models'
import { useSelector } from 'react-redux'
import api from '../data/api'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { putAllTrips } from '../utils/tripCache'
import { isNetworkError as isNetworkErrorUtil } from '../utils/errorMessage'
import { SearchBar } from '../components/shared/SearchBar'
import { BottomSheet } from '../components/shared/BottomSheet'
import { DiscoveryModeTabs } from '../components/layout/DiscoveryModeTabs'
import { SkeletonCard } from '../components/shared/SkeletonCard'
import { EmptyState } from '../components/shared/EmptyState'

const revealTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
}

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

interface DiscoveryNavigationState {
  createdTripTitle?: string
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

const Page = styled.section`
  width: min(1320px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1320px, 100% - 1rem);
    padding-bottom: 7rem;
    gap: ${({ theme }) => theme.spacing.md};
  }
`

const AuthEmptyWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.lg};
`

const AuthSticker = styled.img`
  width: 160px;
  height: auto;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  opacity: 0.85;
`

const AuthBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`

const AuthTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
`

const AuthDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.lead};
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 440px;
`

const HeaderRow = styled(motion.header)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background:
    radial-gradient(circle at 80% 0%, rgba(143, 179, 106, 0.12), transparent 22rem);

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const HeaderLeft = styled.div`
  flex: 1;
`

const HeaderTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`

const HeaderLead = styled.p`
  font-size: ${({ theme }) => theme.typography.lead};
  color: ${({ theme }) => theme.colors.text[380]};
`

const HeaderActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: center;
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    flex-wrap: wrap;
  }
`

const GhostButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
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
  color: ${({ theme }) => theme.colors.green[580]};
  border: 1px solid rgba(154, 198, 148, 0.2);

  &:hover {
    background: rgba(143, 179, 106, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.green[500]};
  }

  &:active {
    background: rgba(143, 179, 106, 0.12);
  }
`

const PrimaryButton = styled(Link)`
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
  color: #10120f;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(143, 179, 106, 0.3), 0 0 80px rgba(143, 179, 106, 0.1);
  }

  &:active {
    transform: translateY(0);
  }
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  padding: 0 0 ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: stretch;
  }
`

const FilterToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: inherit;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: rgba(247, 243, 232, 0.035);
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  cursor: pointer;

  &:hover {
    background: rgba(247, 243, 232, 0.07);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }

  &:active {
    background: rgba(247, 243, 232, 0.10);
  }
`

const PrefToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;
  border: 1px solid transparent;

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
    border-color: ${({ theme }) => theme.colors.lineSoft};
  }

  input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    accent-color: ${({ theme }) => theme.colors.green[500]};
    cursor: pointer;
    margin: 0;
  }
`

const FiltersPanel = styled(motion.div)`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  padding: 0 0 ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
  }
`

const FilterItem = styled.div`
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text[500]};
`

const SelectInput = styled.select`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.surface[860]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  transition: border-color 0.15s ease;
  min-height: 44px;
  font-family: inherit;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(143, 179, 106, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  option {
    background: ${({ theme }) => theme.colors.bg[940]};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const RangeInput = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  accent-color: ${({ theme }) => theme.colors.green[500]};
  cursor: pointer;
`

const InfoBanner = styled.p`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(143, 179, 106, 0.06);
  border: 1px solid rgba(143, 179, 106, 0.15);
  color: ${({ theme }) => theme.colors.green[400]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const ResultsSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ResultsMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const ResultsCount = styled.h2`
  font-size: ${({ theme }) => theme.typography.h2};
  color: ${({ theme }) => theme.colors.text[100]};
`

const TripList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const TripCard = styled(motion.article)`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  background:
    linear-gradient(145deg, rgba(247, 243, 232, 0.045), rgba(247, 243, 232, 0.015)),
    ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  align-items: flex-start;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    box-shadow: ${({ theme }) => theme.shadows.lg};
    transform: translateY(-2px);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const Thumb = styled.img`
  width: 100%;
  height: 150px;
  border-radius: ${({ theme }) => theme.radii.lg};
  object-fit: cover;
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    height: 180px;
  }
`

const TripInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
`

const TripStatus = styled.span`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.offroad.accent};
  font-weight: 600;
`

const TripTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.colors.text[100]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const TripDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
`

const MetaDot = styled.span`
  color: ${({ theme }) => theme.colors.lineSoft};
`

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.25rem;
`

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 500;
  background: rgba(143, 179, 106, 0.12);
  color: ${({ theme }) => theme.colors.green[300]};
`

const ViewButton = styled(Link)`
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
  text-decoration: none;
  line-height: 1;
  padding: 0.4rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[400]}, ${({ theme }) => theme.colors.offroad.accent});
  color: ${({ theme }) => theme.colors.bg[980]};
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  flex-shrink: 0;

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[300]}, ${({ theme }) => theme.colors.offroad.accent});
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.glowGold};
  }
`

const MobileFilterPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`

function FilterFields({
  selectedType,
  setSelectedType,
  maxBudget,
  setMaxBudget,
  autoApplyPreferences,
}: {
  selectedType: string
  setSelectedType: (v: string) => void
  maxBudget: number
  setMaxBudget: (v: number) => void
  autoApplyPreferences: boolean
}) {
  return (
    <>
      <FilterItem>
        <FieldLabel htmlFor="discover-trip-type">Trip type</FieldLabel>
        <SelectInput
          id="discover-trip-type"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value)}
          disabled={autoApplyPreferences}
        >
          <option value="all">All types</option>
          {tripTypeOptions.map((tripType) => (
            <option key={tripType} value={tripType}>
              {tripType}
            </option>
          ))}
        </SelectInput>
      </FilterItem>

      <FilterItem>
        <FieldLabel htmlFor="discover-max-budget">
          Budget up to {maxBudget} EUR
        </FieldLabel>
        <RangeInput
          id="discover-max-budget"
          type="range"
          min={300}
          max={2500}
          step={50}
          value={maxBudget}
          onChange={(event) => setMaxBudget(Number(event.target.value))}
        />
      </FilterItem>
    </>
  )
}

export function DiscoveryPage() {
  const location = useLocation()
  const navigationState = location.state as DiscoveryNavigationState | null
  const user = useSelector((state: AuthStoreState) => state.auth.user)

  const [trips, setTrips] = useState<Trip[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [autoApplyPreferences, setAutoApplyPreferences] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [maxBudget, setMaxBudget] = useState(1000)
  const [isFetchingTrips, setIsFetchingTrips] = useState(true)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const isMobile = useMediaQuery(`(max-width: ${'850px'})`)

  const isSearchDebouncing = search !== debouncedSearch
  const showDiscoverySkeleton = isSearchDebouncing || isFetchingTrips

  const onChangeText = (text: string) => {
    setSearch(text)
    handleSearch(text)
  }

  const handleSearch = useDebouncedCallback((text: string) => {
    setDebouncedSearch(text)
  }, 500)

  useEffect(() => {
    return () => {
      handleSearch.cancel()
    }
  }, [handleSearch])

  useEffect(() => {
    if (user && navigator.onLine) {
      api.get('api/trip/get-all-trips')
        .then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            putAllTrips(res.data)
          }
        })
        .catch(() => { })
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setIsFetchingTrips(false)
      return
    }

    let isActive = true

    setIsFetchingTrips(true)

    const fetchData = async () => {
      try {
        const res = await api.post('api/trip/get-trips', {
          preferences: autoApplyPreferences,
          tag: selectedType,
          search: debouncedSearch,
          budget: maxBudget,
        })

        if (!isActive) {
          return
        }

        setTrips(res.data)
      } catch (err: unknown) {
        if (!isActive) {
          return
        }

        const isNetworkError = isNetworkErrorUtil(err)
        if (!navigator.onLine || isNetworkError) {
          try {
            const allRes = await api.get('api/trip/get-all-trips')
            const allTrips: Trip[] = allRes.data

            const filtered = allTrips.filter(t => {
              const matchesSearch = !debouncedSearch ||
                t.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                t.description.toLowerCase().includes(debouncedSearch.toLowerCase())
              const matchesTag = selectedType === 'all' || t.tags.includes(selectedType)
              const matchesBudget = t.price <= maxBudget
              return matchesSearch && matchesTag && matchesBudget
            })

            setTrips(filtered)
          } catch (offlineErr) {
            console.error('Offline fallback failed:', offlineErr)
          }
        }
      } finally {
        if (isActive) {
          setIsFetchingTrips(false)
        }
      }
    }

    fetchData()

    return () => {
      isActive = false
    }
  }, [autoApplyPreferences, selectedType, debouncedSearch, maxBudget, user])

  if (user == null) {
    return (
      <Page>
        <AuthEmptyWrapper
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
        >
          <AuthSticker
            src="/newstickers/sticker5.png"
            alt=""
            aria-hidden="true"
          />
          <AuthBody>
            <AuthTitle>Sign in to discover trips</AuthTitle>
            <AuthDesc>Unlock personalized filters, matching, and trip collaboration.</AuthDesc>
            <PrimaryButton to="/login">
              Go to login
            </PrimaryButton>
          </AuthBody>
        </AuthEmptyWrapper>
      </Page>
    )
  }

  return (
    <Page>
      <DiscoveryModeTabs />

      <HeaderRow
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={revealTransition}
      >
        <HeaderLeft>
          <HeaderTitle>Discover trips</HeaderTitle>
          <HeaderLead>
            Filter by style, budget, and preferences to find the right trip.
          </HeaderLead>
        </HeaderLeft>
        <HeaderActions>
          <GhostButton to="/app/ai-planner">
            <FiZap /> Generate trip with AI
          </GhostButton>
          <PrimaryButton to="/app/create-trip">
            <FiPlusCircle aria-hidden="true" />
            Create trip
          </PrimaryButton>
        </HeaderActions>
      </HeaderRow>

      <Toolbar>
        <SearchBar
          value={search}
          onChange={onChangeText}
          placeholder="Search destination or theme..."
        />

        <FilterToggleBtn
          type="button"
          onClick={() => {
            if (isMobile) {
              setMobileFilterOpen(true)
            } else {
              setShowFilters((current) => !current)
            }
          }}
        >
          <FiSliders aria-hidden="true" />
          {isMobile ? 'Filters' : showFilters ? 'Hide filters' : 'Filters'}
        </FilterToggleBtn>

        <PrefToggle>
          <input
            type="checkbox"
            checked={autoApplyPreferences}
            onChange={(event) => {
              const isChecked = event.target.checked
              setAutoApplyPreferences(isChecked)
              if (isChecked) {
                setSelectedType('all')
              }
            }}
          />
          <FiZap aria-hidden="true" />
          <span>Personalized for you</span>
        </PrefToggle>
      </Toolbar>

      {showFilters && !isMobile && (
        <FiltersPanel
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <FilterFields
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            maxBudget={maxBudget}
            setMaxBudget={setMaxBudget}
            autoApplyPreferences={autoApplyPreferences}
          />
        </FiltersPanel>
      )}

      <BottomSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Filters"
      >
        <MobileFilterPanel>
          <FilterFields
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            maxBudget={maxBudget}
            setMaxBudget={setMaxBudget}
            autoApplyPreferences={autoApplyPreferences}
          />
        </MobileFilterPanel>
      </BottomSheet>

      {navigationState?.createdTripTitle ? (
        <InfoBanner>
          {navigationState.createdTripTitle} was published and is now visible in discovery.
        </InfoBanner>
      ) : null}

      <ResultsSection aria-live="polite" aria-busy={showDiscoverySkeleton}>
        <ResultsMeta>
          <ResultsCount>{showDiscoverySkeleton ? 'Loading...' : `${trips.length} trips found`}</ResultsCount>
        </ResultsMeta>

        <TripList>
          {showDiscoverySkeleton
            ? Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard key={`trip-skeleton-${index}`} />
            ))
            : trips.map((trip, index) => (
              <TripCard
                key={trip.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ ...revealTransition, delay: index * 0.04 }}
              >
                <Thumb src={trip.imageUrl} alt={trip.title} />
                <TripInfo>
                  <TripStatus>{getTripStatusLabel(trip.status)}</TripStatus>
                  <TripTitle>{trip.title}</TripTitle>
                  <TripDesc>{trip.description}</TripDesc>
                  <MetaRow>
                    <span>{trip.timelines?.length ?? 0} days</span>
                    <MetaDot>·</MetaDot>
                    <span>starts {formatDisplayDate(trip.startingDate)}</span>
                    <MetaDot>·</MetaDot>
                    <span>{trip.currentMembers}/{trip.maxParticipants} members</span>
                    <MetaDot>·</MetaDot>
                    <span>{trip.price} EUR</span>
                  </MetaRow>
                  <TagsRow>
                    {trip.tags.map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                  </TagsRow>
                </TripInfo>
                <ViewButton to={`/app/trip/${trip.id}`}>
                  View
                </ViewButton>
              </TripCard>
            ))}

          {!showDiscoverySkeleton && trips.length === 0 ? (
            <EmptyState
              title="No trips match these filters."
              description="Try adjusting your budget or disabling preference boost."
            />
          ) : null}
        </TripList>
      </ResultsSection>
    </Page>
  )
}
