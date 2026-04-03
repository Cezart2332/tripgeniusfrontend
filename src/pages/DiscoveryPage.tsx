import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { FiPlusCircle, FiSliders, FiZap } from 'react-icons/fi'
import { Link, useLocation } from 'react-router-dom'
import {
  getAllTrips,
  isUserInTrip,
  mockUserProfile,
  tripTypeOptions,
} from '../data/mockData'
import type { Trip } from '../types/models'

const revealTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
}

interface DiscoveryNavigationState {
  createdTripTitle?: string
}

export function DiscoveryPage() {
  const location = useLocation()
  const navigationState = location.state as DiscoveryNavigationState | null
  const trips = useMemo<Trip[]>(() => getAllTrips(), [])
  const [showFilters, setShowFilters] = useState(false)
  const [autoApplyPreferences, setAutoApplyPreferences] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [maxBudget, setMaxBudget] = useState(1800)

  const filteredTrips = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const profileTripTypes = mockUserProfile.preferences.tripTypes

    return trips.filter((trip) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        trip.title.toLowerCase().includes(normalizedSearch) ||
        trip.destination.toLowerCase().includes(normalizedSearch) ||
        trip.tags.some((tag) => tag.includes(normalizedSearch))

      const matchesTripType =
        selectedType === 'all' || trip.tags.includes(selectedType)

      const matchesBudget = trip.budgetPerPerson <= maxBudget

      if (!matchesSearch || !matchesTripType || !matchesBudget) {
        return false
      }

      if (!autoApplyPreferences) {
        return true
      }

      const matchesPreferenceType = trip.tags.some((tag) =>
        profileTripTypes.includes(tag),
      )
      const matchesGroupLimit =
        trip.maxMembers <= mockUserProfile.preferences.maxGroupSize

      return matchesPreferenceType && matchesGroupLimit
    })
  }, [autoApplyPreferences, maxBudget, search, selectedType, trips])

  return (
    <section className="page discovery-page">
      <motion.div
        className="panel discovery-toolbar"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={revealTransition}
      >
        <div>
          <p className="eyebrow">Discovery</p>
          <h1>Find trips that match your vibe.</h1>
          <p>
            Explore curated group trips and toggle your preference engine whenever
            you want to discover outside your usual comfort zone.
          </p>
        </div>

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

          <label className="toggle">
            <input
              type="checkbox"
              checked={autoApplyPreferences}
              onChange={(event) => setAutoApplyPreferences(event.target.checked)}
            />
            <FiZap aria-hidden="true" />
            Auto apply onboarding preferences
          </label>
        </div>
      </motion.div>

      {navigationState?.createdTripTitle ? (
        <p className="info-banner">
          {navigationState.createdTripTitle} was published and is now visible in
          discovery.
        </p>
      ) : null}

      {showFilters ? (
        <motion.div
          className="panel filter-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
        >
          <label className="field-label" htmlFor="discover-search">
            Search destination or theme
          </label>
          <input
            id="discover-search"
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by location or type"
          />

          <label className="field-label" htmlFor="discover-trip-type">
            Trip type
          </label>
          <select
            id="discover-trip-type"
            className="input"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
          >
            <option value="all">All types</option>
            {tripTypeOptions.map((tripType) => (
              <option key={tripType} value={tripType}>
                {tripType}
              </option>
            ))}
          </select>

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
        </motion.div>
      ) : null}

      <div className="trip-grid">
        {filteredTrips.map((trip, index) => (
          <motion.article
            className="panel trip-card"
            key={trip.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ ...revealTransition, delay: index * 0.05 }}
          >
            <img src={trip.coverImage} alt={trip.title} className="trip-cover" />
            <div className="trip-card-body">
              {isUserInTrip(trip, mockUserProfile) ? (
                <p className="match-pill">You are part of this trip</p>
              ) : (
                <p className="match-pill">Open details and request to join</p>
              )}

              <p className="trip-meta">
                {trip.destination} • {trip.status}
              </p>
              <h2>{trip.title}</h2>
              <p>{trip.description}</p>
              <p className="trip-submeta">
                {trip.timeline.length} days • starts {trip.startDate}
              </p>
              <div className="trip-stat-row">
                <span>
                  {trip.currentMembers}/{trip.maxMembers} members
                </span>
                <span>{trip.budgetPerPerson} EUR / person</span>
              </div>
              <div className="chip-row">
                {trip.tags.map((tag) => (
                  <span key={tag} className="chip chip-static">
                    {tag}
                  </span>
                ))}
              </div>
              <Link className="btn btn-primary" to={`/trip/${trip.id}`}>
                {isUserInTrip(trip, mockUserProfile)
                  ? 'Open trip space'
                  : 'View details'}
              </Link>
            </div>
          </motion.article>
        ))}

        {filteredTrips.length === 0 ? (
          <div className="panel">
            <h2>No trips match these filters right now.</h2>
            <p>
              Try disabling auto preferences or increasing your budget range to
              reveal more options.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
