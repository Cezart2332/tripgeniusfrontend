import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiMap, FiPlusCircle, FiSliders, FiZap } from 'react-icons/fi'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { OffroadTrip, User } from '../types/models'
import { useSelector } from 'react-redux'
import api from '../data/api'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { putAllOffroadTrips } from '../utils/offroadTripCache'
import { isNetworkError as isNetworkErrorUtil } from '../utils/errorMessage'

const revealTransition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

export function DiscoveryModeTabs() {
  const location = useLocation()
  const isOffroad = location.pathname.startsWith('/app/offroad')

  return (
    <nav className="discovery-mode-tabs" aria-label="Trip discovery mode">
      <NavLink
        to="/app"
        end
        className={() =>
          `discovery-mode-tab discovery-mode-tab--classic ${!isOffroad ? 'is-active' : ''}`
        }
      >
        Classic
      </NavLink>
      <NavLink
        to="/app/offroad"
        className={() => `discovery-mode-tab ${isOffroad ? 'is-active' : ''}`}
      >
        Offroad
      </NavLink>
    </nav>
  )
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
      <section className="page discovery-page discovery-page-offroad">
        <div className="discovery-empty-state discovery-auth-empty">
          <h1>Sign in to discover offroad trips</h1>
          <p className="lead">Browse GPX route adventures and join trail groups.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page discovery-page-v2 discovery-page-offroad">
      <DiscoveryModeTabs />

      <motion.header
        className="discovery-header-v2"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
      >
        <div>
          <span className="discovery-offroad-badge">
            <FiMap aria-hidden /> GPX routes
          </span>
          <h1>Offroad trips</h1>
          <p className="lead">
            Multi-day trail adventures built from imported or hand-drawn GPS tracks.
          </p>
        </div>
        <div className="discovery-header-actions">
          <Link className="btn btn-ghost" to="/app/offroad/ai-planner" style={{ borderColor: 'var(--offroad-accent, #c9a227)', color: 'var(--offroad-accent, #c9a227)' }}>
            <FiZap aria-hidden="true" /> AI Trail Planner
          </Link>
          <Link className="btn btn-primary" to="/app/offroad/create">
            <FiPlusCircle aria-hidden="true" /> Create offroad trip
          </Link>
        </div>
      </motion.header>

      <div className="discovery-toolbar-v2">
        <div className="discovery-search-group">
          <input
            className="input"
            placeholder="Search offroad trips..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              handleSearch(e.target.value)
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowFilters((v) => !v)}
        >
          <FiSliders aria-hidden /> {showFilters ? 'Hide filters' : 'Filters'}
        </button>
      </div>

      {showFilters && (
        <motion.div
          className="discovery-filters-v2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.25 }}
        >
          <div className="discovery-filter-item">
            <label className="discovery-pref-toggle">
              <input
                type="checkbox"
                checked={autoApplyPreferences}
                onChange={(e) => setAutoApplyPreferences(e.target.checked)}
              />
              <span>Match my preferences</span>
            </label>
          </div>
          <div className="discovery-filter-item">
            <label className="field-label" htmlFor="offroad-type">
              Trip type
            </label>
            <select
              id="offroad-type"
              className="input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All types</option>
              {tripTypeOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div className="discovery-filter-item">
            <label className="field-label" htmlFor="offroad-budget">
              Budget up to {maxBudget} RON
            </label>
            <input
              id="offroad-budget"
              className="range"
              type="range"
              min={0}
              max={2500}
              step={50}
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
            />
          </div>
        </motion.div>
      )}

      <section className="discovery-results-v2" aria-live="polite" aria-busy={showSkeleton}>
        <div className="discovery-results-meta">
          <h2>{showSkeleton ? 'Loading...' : `${trips.length} offroad trips`}</h2>
        </div>

        <div className="discovery-trip-list">
          {showSkeleton
            ? Array.from({ length: 3 }, (_, i) => (
                <article
                  key={`sk-${i}`}
                  className="discovery-trip-row discovery-trip-row--offroad discovery-trip-skeleton"
                  aria-hidden
                >
                  <div className="discovery-trip-thumb discovery-skeleton-block" />
                  <div className="discovery-trip-info">
                    <div className="discovery-skeleton-block" style={{ height: '1rem', width: 100 }} />
                    <div className="discovery-skeleton-block" style={{ height: '1.4rem', width: 260 }} />
                  </div>
                </article>
              ))
            : trips.map((trip, index) => (
                <motion.article
                  key={trip.id}
                  className="discovery-trip-row discovery-trip-row--offroad"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...revealTransition, delay: index * 0.04 }}
                >
                  {trip.imageUrl ? (
                    <img src={trip.imageUrl} alt="" className="discovery-trip-thumb" />
                  ) : (
                    <div
                      className="discovery-trip-thumb"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(201,162,39,0.25), rgba(44,51,43,0.9))',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <FiMap size={32} color="var(--offroad-accent)" aria-hidden />
                    </div>
                  )}
                  <div className="discovery-trip-info">
                    <span className="discovery-trip-status">{getTripStatusLabel(trip.status)}</span>
                    <h3>{trip.title}</h3>
                    <p className="discovery-trip-desc">{trip.description}</p>
                    <div className="discovery-trip-meta-row">
                      <span className="discovery-trip-route-pill">
                        <FiMap aria-hidden /> {trip.routes?.length ?? 0} routes
                      </span>
                      <span>·</span>
                      <span>
                        {formatDisplayDate(trip.startingDate)} – {formatDisplayDate(trip.endingDate)}
                      </span>
                      <span>·</span>
                      <span>
                        {trip.currentMembers}/{trip.maxParticipants} members
                      </span>
                      <span>·</span>
                      <span>{trip.price} RON</span>
                    </div>
                    <div className="discovery-trip-tags">
                      {trip.tags.map((tag) => (
                        <span key={tag} className="chip chip-static chip-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link className="btn btn-primary btn-sm discovery-trip-cta" to={`/app/offroad/${trip.id}`}>
                    View
                  </Link>
                </motion.article>
              ))}

          {!showSkeleton && trips.length === 0 && (
            <div className="discovery-no-results offroad-empty-routes">
              <h3>No offroad trips match these filters.</h3>
              <p>Try a wider budget or create the first trail adventure.</p>
              <Link className="btn btn-primary" to="/app/offroad/create">
                Create offroad trip
              </Link>
            </div>
          )}
        </div>
      </section>
    </section>
  )
}
