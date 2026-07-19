import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiMap, FiPlusCircle, FiSliders, FiZap } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { useDebouncedCallback } from 'use-debounce'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { OffroadTrip, User } from '../types/models'
import { useSelector } from 'react-redux'
import api from '../data/api'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { putAllOffroadTrips } from '../utils/offroadTripCache'
import { isNetworkError as isNetworkErrorUtil } from '../utils/errorMessage'
import { SkeletonCard } from '../components/shared/SkeletonCard'
import { DiscoveryModeTabs } from '../components/layout/DiscoveryModeTabs'

const revealTransition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

export function OffroadDiscoveryPage() {
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [trips, setTrips] = useState<OffroadTrip[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [autoApplyPreferences, setAutoApplyPreferences] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [maxBudget, setMaxBudget] = useState(1000)
  const [isFetching, setIsFetching] = useState(true)

  const handleSearch = useDebouncedCallback((text: string) => setDebouncedSearch(text), 500)
  const isSearchDebouncing = search !== debouncedSearch
  const showSkeleton = isSearchDebouncing || isFetching

  useEffect(() => {
    if (user && navigator.onLine) {
      api.get('api/OffroadTrip/get-all-offroad-trips').then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) putAllOffroadTrips(res.data)
      }).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setIsFetching(false)
      return
    }
    let active = true
    setIsFetching(true)
    const load = async () => {
      try {
        const res = await api.post('api/OffroadTrip/get-offroad-trips', {
          preferences: autoApplyPreferences,
          tag: selectedType,
          search: debouncedSearch,
          budget: maxBudget,
        })
        if (active) setTrips(res.data)
      } catch (err) {
        if (!active) return
        if (!navigator.onLine || isNetworkErrorUtil(err)) {
          try {
            const all = await api.get('api/OffroadTrip/get-all-offroad-trips')
            const filtered = (all.data as OffroadTrip[]).filter((t) => {
              const q = debouncedSearch.toLowerCase()
              return (
                (!q || t.title.toLowerCase().includes(q)) &&
                (selectedType === 'all' || t.tags.includes(selectedType)) &&
                t.price <= maxBudget
              )
            })
            if (active) setTrips(filtered)
          } catch {
            /* offline fallback failed */
          }
        }
      } finally {
        if (active) setIsFetching(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user, autoApplyPreferences, selectedType, debouncedSearch, maxBudget])

  if (!user) {
    return (
      <OffroadPage>
        <EmptyAuthState>
          <h1>Sign in to discover offroad trips</h1>
          <LeadText>Browse GPX route adventures and join trail groups.</LeadText>
          <PrimaryLink to="/login">
            Go to login
          </PrimaryLink>
        </EmptyAuthState>
      </OffroadPage>
    )
  }

  return (
    <OffroadPage>
      <DiscoveryModeTabs />

      <DiscoveryHeader
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
      >
        <div>
          <OffroadBadge>
            <FiMap aria-hidden /> GPX routes
          </OffroadBadge>
          <Title>Offroad trips</Title>
          <LeadText>
            Multi-day trail adventures built from imported or hand-drawn GPS tracks.
          </LeadText>
        </div>
        <HeaderActions>
          <AiPlannerLink to="/app/offroad/ai-planner">
            <FiZap aria-hidden="true" /> AI Trail Planner
          </AiPlannerLink>
          <PrimaryLink to="/app/offroad/create">
            <FiPlusCircle aria-hidden="true" /> Create offroad trip
          </PrimaryLink>
        </HeaderActions>
      </DiscoveryHeader>

      <Toolbar>
        <SearchGroup>
          <SearchInput
            placeholder="Search offroad trips..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              handleSearch(e.target.value)
            }}
          />
        </SearchGroup>
        <FiltersBtn type="button" onClick={() => setShowFilters((v) => !v)}>
          <FiSliders aria-hidden /> {showFilters ? 'Hide filters' : 'Filters'}
        </FiltersBtn>
      </Toolbar>

      {showFilters && (
        <FiltersPanel
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.25 }}
        >
          <FilterItem>
            <PrefToggle>
              <input
                type="checkbox"
                checked={autoApplyPreferences}
                onChange={(e) => setAutoApplyPreferences(e.target.checked)}
              />
              <span>Match my preferences</span>
            </PrefToggle>
          </FilterItem>
          <FilterItem>
            <FilterLabel htmlFor="offroad-type">Trip type</FilterLabel>
            <FilterSelect id="offroad-type" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              <option value="all">All types</option>
              {tripTypeOptions.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </FilterSelect>
          </FilterItem>
          <FilterItem>
            <FilterLabel htmlFor="offroad-budget">Budget up to {maxBudget} RON</FilterLabel>
            <RangeInput id="offroad-budget" type="range" min={0} max={2500} step={50} value={maxBudget} onChange={(e) => setMaxBudget(Number(e.target.value))} />
          </FilterItem>
        </FiltersPanel>
      )}

      <ResultsSection aria-live="polite" aria-busy={showSkeleton}>
        <ResultsMeta>
          <h2>{showSkeleton ? 'Loading...' : `${trips.length} offroad trips`}</h2>
        </ResultsMeta>

        <TripList>
          {showSkeleton
            ? Array.from({ length: 3 }, (_, i) => <SkeletonCard key={`sk-${i}`} />)
            : trips.map((trip, index) => (
                <TripRow
                  key={trip.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...revealTransition, delay: index * 0.04 }}
                >
                  {trip.imageUrl ? (
                    <TripThumb src={trip.imageUrl} alt="" />
                  ) : (
                    <TripThumbPlaceholder>
                      <FiMap size={32} style={{ opacity: 0.6 }} />
                    </TripThumbPlaceholder>
                  )}
                  <TripInfo>
                    <TripStatus>{getTripStatusLabel(trip.status)}</TripStatus>
                    <TripTitle>{trip.title}</TripTitle>
                    <TripDesc>{trip.description}</TripDesc>
                    <TripMetaRow>
                      <RoutePill>
                        <FiMap aria-hidden /> {trip.routes?.length ?? 0} routes
                      </RoutePill>
                      <DotSep />
                      <span>{formatDisplayDate(trip.startingDate)} – {formatDisplayDate(trip.endingDate)}</span>
                      <DotSep />
                      <span>{trip.currentMembers}/{trip.maxParticipants} members</span>
                      <DotSep />
                      <span>{trip.price} RON</span>
                    </TripMetaRow>
                    <TripTags>
                      {trip.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </TripTags>
                  </TripInfo>
                  <ViewLink to={`/app/offroad/${trip.id}`}>View trip</ViewLink>
                </TripRow>
              ))}
        </TripList>
      </ResultsSection>
    </OffroadPage>
  )
}

// --- Styled Components ---

const OffroadPage = styled.section`
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

const EmptyAuthState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};

  h1 { color: ${({ theme }) => theme.colors.text[100]}; }
`

const LeadText = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 480px;
  line-height: 1.6;
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
  background: ${({ theme }) => theme.colors.green[400]};
  color: ${({ theme }) => theme.colors.bg[980]};
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: ${({ theme }) => theme.colors.green[500]};
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(46, 141, 84, 0.3), 0 0 80px rgba(46, 141, 84, 0.1);
  }
`

const AiPlannerLink = styled(Link)`
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
  color: ${({ theme }) => theme.colors.offroad.accent};
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};

  &:hover {
    background: rgba(168, 120, 31, 0.08);
    border-color: ${({ theme }) => theme.colors.offroad.accent};
  }
`

const DiscoveryHeader = styled(motion.header)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} 0;
  }
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

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text[100]};
  margin-top: 0.25rem;
`

const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
`

const Toolbar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  flex-wrap: wrap;
  padding: 0 0 ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const SearchGroup = styled.div`
  flex: 1;
  min-width: 200px;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.surface[860]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  transition: border-color ${({ theme }) => theme.animation.duration.fast}s ease;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.1);
  }
`

const FiltersBtn = styled.button`
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
  padding: 0.55rem 1.2rem;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:hover {
    background: rgba(28, 43, 32, 0.07);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const FiltersPanel = styled(motion.div)`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  flex-wrap: wrap;
  align-items: flex-end;
  overflow: hidden;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.surface[820]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
`

const FilterItem = styled.div`
  flex: 1;
  min-width: 180px;
  max-width: 380px;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-width: none;
  }
`

const PrefToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[220]};
  cursor: pointer;
  padding: 0.65rem 0;

  input[type="checkbox"] {
    accent-color: ${({ theme }) => theme.colors.green[580]};
  }
`

const FilterLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 0.35rem;
  font-weight: 500;
`

const FilterSelect = styled.select`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.surface[860]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.green[500]}; }
`

const RangeInput = styled.input`
  width: 100%;
  accent-color: ${({ theme }) => theme.colors.green[580]};
  margin-top: 0.35rem;
`

const ResultsSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ResultsMeta = styled.div`
  h2 {
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const TripList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr));
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};
  }

  /* Full-width row for the empty state. */
  > :only-child {
    grid-column: 1 / -1;
  }
`

const TripRow = styled(motion.article)`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};

  &:hover {
    border-color: ${({ theme }) => theme.colors.offroad.line};
    box-shadow: ${({ theme }) => theme.shadows.lg};
    transform: translateY(-2px);
  }

  &:active {
    transform: scale(0.99);
  }
`

const TripThumb = styled.img`
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radii.lg};
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    height: 150px;
  }
`

const TripThumbPlaceholder = styled.div`
  width: 100%;
  height: 170px;
  background: ${({ theme }) => theme.colors.bg[940]};
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radii.lg};
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    height: 150px;
  }
`

const TripInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const TripStatus = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.offroad.accent};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const TripTitle = styled.h3`
  color: ${({ theme }) => theme.colors.text[100]};
`

const TripDesc = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const TripMetaRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const RoutePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: rgba(168, 120, 31, 0.12);
  color: ${({ theme }) => theme.colors.offroad.accent};
  font-weight: 600;
`

const DotSep = styled.span`
  opacity: 0.4;
  &::before { content: '·'; }
`

const TripTags = styled.div`
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
`

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  color: ${({ theme }) => theme.colors.text[220]};
  background: rgba(46, 141, 84, 0.10);
`

const ViewLink = styled(Link)`
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
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: ${({ theme }) => theme.colors.green[400]};
  color: ${({ theme }) => theme.colors.bg[980]};
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  flex-shrink: 0;
  margin-top: auto;
  align-self: flex-end;

  &:hover {
    background: ${({ theme }) => theme.colors.green[500]};
  }

  /* Stretched link: the whole card is one big tap target. Keep transforms off
     this link — they would re-anchor the ::after to the link itself. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: ${({ theme }) => theme.radii.xl};
  }
`
