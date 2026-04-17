import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiPlusCircle, FiSliders, FiZap } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { Trip,User } from '../types/models'
import {useSelector } from 'react-redux'
import api from '../data/api'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'

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

export function DiscoveryPage() {
  const location = useLocation()
  const navigationState = location.state as DiscoveryNavigationState | null
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [trips, setTrips] = useState<Trip[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [autoApplyPreferences, setAutoApplyPreferences] = useState(true)
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
      } catch {
        if (!isActive) {
          return
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


  if(user == null) 
  {
    return (
      <section className="page discovery-page">
        <motion.section
          className="panel discovery-auth-empty"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
        >
          <p className="eyebrow">Discovery</p>
          <h1>You are not logged in</h1>
          <p>
            Log in to unlock discovery filters, personalized matching, and trip collaboration.
          </p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </motion.section>
      </section>
    )
  }

  return (
    <section className="page discovery-page">
      <motion.header
        className="panel discovery-headline"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={revealTransition}
      >
        <p className="eyebrow">Discovery command</p>
        <h1>Scout trips with route-first filtering.</h1>
        <p>
          Use filter rails and preference toggles to narrow down high-fit trip spaces.
        </p>
      </motion.header>

      <div className="discovery-shell">
        <aside className="panel discovery-filter-rail">
          <div className="toolbar-actions">
            <Link className="btn btn-primary" to="/create-trip">
              <FiPlusCircle aria-hidden="true" />
              Create trip
            </Link>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setShowFilters((current) => !current)}
            >
              <FiSliders aria-hidden="true" />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          {showFilters ? (
            <>
              <label
                className={
                  autoApplyPreferences
                    ? 'discovery-boost-toggle is-active'
                    : 'discovery-boost-toggle'
                }
              >
                <input
                  className="visually-hidden"
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
                <span className="discovery-boost-switch" aria-hidden="true">
                  <span className="discovery-boost-thumb" />
                </span>
                <span className="discovery-boost-copy">
                  <span className="discovery-boost-title">
                    <FiZap aria-hidden="true" />
                    Boost with onboarding preferences
                  </span>
                  <small>Use your profile preferences to auto-prioritize matching trips.</small>
                </span>
              </label>

              <label className="field-label" htmlFor="discover-search">
                Search destination or theme
              </label>
              <input
                id="discover-search"
                className="input"
                value={search}
                onChange={(event) => onChangeText(event.target.value)}
                placeholder="Search by location or type"
              />

              <label className="field-label" htmlFor="discover-trip-type">
                Trip type
              </label>
              <select
                id="discover-trip-type"
                className={
                  autoApplyPreferences
                    ? 'input discovery-trip-type is-locked'
                    : 'input discovery-trip-type'
                }
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                disabled={autoApplyPreferences}
                aria-disabled={autoApplyPreferences}
              >
                <option value="all">All types</option>
                {tripTypeOptions.map((tripType) => (
                  <option key={tripType} value={tripType}>
                    {tripType}
                  </option>
                ))}
              </select>
              <p className={autoApplyPreferences ? 'discovery-field-note is-locked' : 'discovery-field-note'}>
                {autoApplyPreferences
                  ? 'Trip type is disabled while onboarding boost is enabled.'
                  : 'Choose a trip style to narrow results manually.'}
              </p>

              <label className="field-label" htmlFor="discover-max-budget">
                Budget per person up to {maxBudget} EUR
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
            </>
          ) : null}
        </aside>

        <section className="panel discovery-results-rail" aria-live="polite" aria-busy={showDiscoverySkeleton}>
          {navigationState?.createdTripTitle ? (
            <p className="info-banner">
              {navigationState.createdTripTitle} was published and is now visible in discovery.
            </p>
          ) : null}

          <h2>{showDiscoverySkeleton ? 'Updating results...' : `Results (${trips.length})`}</h2>
          <p className={showDiscoverySkeleton ? 'discovery-search-status is-loading' : 'discovery-search-status'}>
            {isSearchDebouncing
              ? 'Filtering trips for your latest search...'
              : showDiscoverySkeleton
                ? 'Loading the latest matching trips...'
                : 'Open any trip to switch between map, timeline, members, and chat.'}
          </p>

          <div className="trip-grid">
            {showDiscoverySkeleton
              ? Array.from({ length: 3 }, (_, index) => (
                <article className="panel trip-card trip-card-skeleton" key={`trip-skeleton-${index}`} aria-hidden="true">
                  <div className="trip-cover discovery-skeleton-block discovery-skeleton-cover" />
                  <div className="trip-card-body">
                    <div className="discovery-skeleton-block discovery-skeleton-pill" />
                    <div className="discovery-skeleton-block discovery-skeleton-title" />
                    <div className="discovery-skeleton-block discovery-skeleton-text" />
                    <div className="discovery-skeleton-block discovery-skeleton-text is-short" />
                    <div className="discovery-skeleton-block discovery-skeleton-submeta" />
                    <div className="discovery-skeleton-stat-row">
                      <div className="discovery-skeleton-block discovery-skeleton-stat" />
                      <div className="discovery-skeleton-block discovery-skeleton-stat" />
                    </div>
                    <div className="discovery-skeleton-chip-row">
                      <div className="discovery-skeleton-block discovery-skeleton-chip" />
                      <div className="discovery-skeleton-block discovery-skeleton-chip" />
                      <div className="discovery-skeleton-block discovery-skeleton-chip" />
                    </div>
                    <div className="discovery-skeleton-block discovery-skeleton-cta" />
                  </div>
                </article>
              ))
              : trips.map((trip, index) => (
              <motion.article
                className="panel trip-card"
                key={trip.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ ...revealTransition, delay: index * 0.05 }}
              >
                <img src={trip.imageUrl} alt={trip.title} className="trip-cover" />
                <div className="trip-card-body">

                  <p className="trip-meta">
                    {getTripStatusLabel(trip.status)}
                  </p>
                  <h2>{trip.title}</h2>
                  <p>{trip.description}</p>
                  <p className="trip-submeta">
                    {trip.timelines.length} days - starts {formatDisplayDate(trip.startingDate)}
                  </p>
                  <div className="trip-stat-row">
                    <span>
                      {trip.currentMembers}/{trip.maxParticipants} members
                    </span>
                    <span>{trip.price} EUR / person</span>
                  </div>
                  <div className="chip-row">
                    {trip.tags.map((tag) => (
                      <span key={tag} className="chip chip-static">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link className="btn btn-primary" to={`/trip/${trip.id}`}>
                      View details
                  </Link>
                </div>
              </motion.article>
            ))}

            {!showDiscoverySkeleton && trips.length === 0 ? (
              <div className="panel">
                <h2>No trips match these filters right now.</h2>
                <p>
                  Disable profile boosting or raise budget range to reveal more options.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  )
}

