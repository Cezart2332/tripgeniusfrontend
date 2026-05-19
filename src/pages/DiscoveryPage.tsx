import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiPlusCircle, FiSliders, FiZap } from 'react-icons/fi'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { Trip, User } from '../types/models'
import { useSelector } from 'react-redux'
import api from '../data/api'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { putAllTrips } from '../utils/tripCache'
import { isNetworkError as isNetworkErrorUtil } from '../utils/errorMessage'

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

function DiscoveryModeTabs() {
  return (
    <nav className="discovery-mode-tabs" aria-label="Trip discovery mode">
      <NavLink
        to="/app"
        end
        className={({ isActive }) =>
          `discovery-mode-tab discovery-mode-tab--classic ${isActive ? 'is-active' : ''}`
        }
      >
        Classic
      </NavLink>
      <NavLink
        to="/app/offroad"
        className={({ isActive }) => `discovery-mode-tab ${isActive ? 'is-active' : ''}`}
      >
        Offroad
      </NavLink>
    </nav>
  )
}

export function DiscoveryPage() {
  const location = useLocation()
  const navigationState = location.state as DiscoveryNavigationState | null
  const user = useSelector((state: AuthStoreState) => state.auth.user)

  // Classic trips state
  const [trips, setTrips] = useState<Trip[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [autoApplyPreferences, setAutoApplyPreferences] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [maxBudget, setMaxBudget] = useState(1000)
  const [isFetchingTrips, setIsFetchingTrips] = useState(true)

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

  // Warm up the all-trips cache for offline use
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

  // Fetch classic trips
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

        // Offline Fallback: Trigger if offline OR if the network request just failed
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
      <section className="page discovery-page">
        <motion.div
          className="discovery-empty-state"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
        >
          <img
            src="/newstickers/sticker5.png"
            alt=""
            className="discovery-empty-sticker"
            aria-hidden="true"
          />
          <div>
            <h1>Sign in to discover trips</h1>
            <p>Unlock personalized filters, matching, and trip collaboration.</p>
            <Link className="btn btn-primary" to="/login">
              Go to login
            </Link>
          </div>
        </motion.div>
      </section>
    )
  }

  return (
    <section className="page discovery-page-v2">
      <DiscoveryModeTabs />
      {/* ── Header row ── */}
      <motion.header
        className="discovery-header-v2"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={revealTransition}
      >
        <div>
          <h1>Discover trips</h1>
          <p className="lead">
            Filter by style, budget, and preferences to find the right trip.
          </p>
        </div>
        <div className="discovery-header-actions" style={{ display: 'flex', gap: '1rem' }}>
          <Link className="btn btn-ghost" style={{ gap: '0.6rem', color: 'var(--green-580)', border: '1px solid rgba(154,198,148,0.2)' }} to="/app/ai-planner">
            <FiZap /> Generate trip with AI
          </Link>
          <Link className="btn btn-primary" to='/app/create-trip'>
            <FiPlusCircle aria-hidden="true" />
            Create trip
          </Link>
        </div>
      </motion.header>

      {/* ── Toolbar ── */}
      <div className="discovery-toolbar-v2">
        <div className="discovery-search-group">
          <input
            id="discover-search"
            className="input"
            value={search}
            onChange={(event) => onChangeText(event.target.value)}
            placeholder="Search destination or theme..."
          />
        </div>

        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => setShowFilters((current) => !current)}
        >
          <FiSliders aria-hidden="true" />
          {showFilters ? 'Hide filters' : 'Filters'}
        </button>

        <label className="discovery-pref-toggle">
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
        </label>
      </div>

      {/* ── Collapsible filters ── */}
      {showFilters ? (
        <motion.div
          className="discovery-filters-v2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="discovery-filter-item">
            <label className="field-label" htmlFor="discover-trip-type">Trip type</label>
            <select
              id="discover-trip-type"
              className="input"
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
            </select>
          </div>

          <div className="discovery-filter-item">
            <label className="field-label" htmlFor="discover-max-budget">
              Budget up to {maxBudget} EUR
            </label>
            <input
              id="discover-max-budget"
              className="range"
              type="range"
              min={300}
              max={2500}
              step={50}
              value={maxBudget}
              onChange={(event) => setMaxBudget(Number(event.target.value))}
            />
          </div>
        </motion.div>
      ) : null}

      {/* ── Banner ── */}
      {navigationState?.createdTripTitle ? (
        <p className="info-banner">
          {navigationState.createdTripTitle} was published and is now visible in discovery.
        </p>
      ) : null}

      {/* ── Results ── */}
      <section className="discovery-results-v2" aria-live="polite" aria-busy={showDiscoverySkeleton}>
        <div className="discovery-results-meta">
          <h2>{showDiscoverySkeleton ? 'Loading...' : `${trips.length} trips found`}</h2>
        </div>

        <div className="discovery-trip-list">
          {showDiscoverySkeleton
            ? Array.from({ length: 3 }, (_, index) => (
              <article className="discovery-trip-row discovery-trip-skeleton" key={`trip-skeleton-${index}`} aria-hidden="true">
                <div className="discovery-trip-thumb discovery-skeleton-block" />
                <div className="discovery-trip-info">
                  <div className="discovery-skeleton-block" style={{ height: '1rem', width: '120px' }} />
                  <div className="discovery-skeleton-block" style={{ height: '1.4rem', width: '280px' }} />
                  <div className="discovery-skeleton-block" style={{ height: '0.85rem', width: '200px' }} />
                </div>
              </article>
            ))
            : trips.map((trip, index) => (
              <motion.article
                className="discovery-trip-row"
                key={trip.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ ...revealTransition, delay: index * 0.04 }}
              >
                <img src={trip.imageUrl} alt={trip.title} className="discovery-trip-thumb" />
                <div className="discovery-trip-info">
                  <span className="discovery-trip-status">{getTripStatusLabel(trip.status)}</span>
                  <h3>{trip.title}</h3>
                  <p className="discovery-trip-desc">{trip.description}</p>
                  <div className="discovery-trip-meta-row">
                    <span>{trip.timelines?.length ?? 0} days</span>
                    <span>·</span>
                    <span>starts {formatDisplayDate(trip.startingDate)}</span>
                    <span>·</span>
                    <span>{trip.currentMembers}/{trip.maxParticipants} members</span>
                    <span>·</span>
                    <span>{trip.price} EUR</span>
                  </div>
                  <div className="discovery-trip-tags">
                    {trip.tags.map((tag) => (
                      <span key={tag} className="chip chip-static chip-sm">{tag}</span>
                    ))}
                  </div>
                </div>
                <Link className="btn btn-primary btn-sm discovery-trip-cta" to={`/app/trip/${trip.id}`}>
                  View
                </Link>
              </motion.article>
            ))}

          {!showDiscoverySkeleton && trips.length === 0 ? (
            <div className="discovery-no-results">
              <h3>No trips match these filters.</h3>
              <p>Try adjusting your budget or disabling preference boost.</p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  )
}
