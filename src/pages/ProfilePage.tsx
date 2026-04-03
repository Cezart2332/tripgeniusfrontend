import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { FiCompass, FiUploadCloud } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import {
  isUserInTrip,
  mockTrips,
  mockUserProfile,
  tripTypeOptions,
} from '../data/mockData'
import type { UserPreferences } from '../types/models'

interface PersonalizedTripCard {
  id: string
  title: string
  destination: string
  coverImage: string
  description: string
  status: string
  timelineLength: number
  startDate: string
  currentMembers: number
  maxMembers: number
  budgetPerPerson: number
  tags: string[]
  matchScore: number
  matchReasons: string[]
}

const toggleTripType = (current: string[], type: string): string[] =>
  current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

export function ProfilePage() {
  const [avatarUrl, setAvatarUrl] = useState(mockUserProfile.avatarUrl)
  const [avatarFileName, setAvatarFileName] = useState('No image uploaded yet')
  const [description, setDescription] = useState(mockUserProfile.description)
  const [preferences, setPreferences] = useState<UserPreferences>(
    mockUserProfile.preferences,
  )
  const [saved, setSaved] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  const pastTrips = useMemo(
    () => mockTrips.filter((trip) => mockUserProfile.pastTripIds.includes(trip.id)),
    [],
  )

  const futureTrips = useMemo(
    () => mockTrips.filter((trip) => mockUserProfile.futureTripIds.includes(trip.id)),
    [],
  )

  const memberTripIds = useMemo(
    () =>
      new Set(
        mockTrips
          .filter((trip) => isUserInTrip(trip, mockUserProfile))
          .map((trip) => trip.id),
      ),
    [],
  )

  const discoveryTrips = useMemo<PersonalizedTripCard[]>(() => {
    const budgetLimitByTier = {
      low: 900,
      medium: 1300,
      high: 2200,
    } as const

    return [...mockTrips]
      .map((trip) => {
        const matchingTags = trip.tags.filter((tag) =>
          preferences.tripTypes.includes(tag),
        )

        const groupAlignment = trip.maxMembers <= preferences.maxGroupSize ? 10 : -7
        const budgetAlignment =
          trip.budgetPerPerson <= budgetLimitByTier[preferences.budgetTier] ? 8 : -5
        const statusBoost = trip.status === 'upcoming' ? 6 : 2

        const matchScore = clamp(
          49 + matchingTags.length * 14 + groupAlignment + budgetAlignment + statusBoost,
          26,
          98,
        )

        const matchReasons = [
          matchingTags.length > 0
            ? `Shared trip styles: ${matchingTags.slice(0, 2).join(', ')}`
            : 'Great for trying a new travel vibe',
          trip.maxMembers <= preferences.maxGroupSize
            ? 'Fits your preferred group size'
            : 'Larger group than your default setting',
          trip.budgetPerPerson <= budgetLimitByTier[preferences.budgetTier]
            ? 'Budget aligns with your tier'
            : 'Budget is slightly above your default',
        ]

        return {
          id: trip.id,
          title: trip.title,
          destination: trip.destination,
          coverImage: trip.coverImage,
          description: trip.description,
          status: trip.status,
          timelineLength: trip.timeline.length,
          startDate: trip.startDate,
          currentMembers: trip.currentMembers,
          maxMembers: trip.maxMembers,
          budgetPerPerson: trip.budgetPerPerson,
          tags: trip.tags,
          matchScore,
          matchReasons,
        }
      })
      .sort((first, second) => second.matchScore - first.matchScore)
  }, [preferences])

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const nextObjectUrl = URL.createObjectURL(selectedFile)
    objectUrlRef.current = nextObjectUrl

    setAvatarUrl(nextObjectUrl)
    setAvatarFileName(selectedFile.name)
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaved(true)
  }

  return (
    <section className="page profile-page">
      <form className="profile-layout profile-fluid-layout" onSubmit={handleSave}>
        <motion.section
          className="panel profile-editor-card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={revealTransition}
        >
          <p className="eyebrow">Profile</p>
          <h1>{mockUserProfile.name}</h1>
          <p>
            Tune your traveler identity once and let TripGenius build a smarter,
            more relevant discovery experience around your preferences.
          </p>

          <div className="profile-hero">
            <img src={avatarUrl} alt="Profile" className="avatar-lg" />
            <div className="upload-stack">
              <label className="field-label" htmlFor="profile-avatar-file">
                Upload profile picture
              </label>
              <label className="upload-dropzone" htmlFor="profile-avatar-file">
                <FiUploadCloud className="upload-icon" aria-hidden="true" />
                <span>Drop an image or click to upload</span>
                <small className="file-note">{avatarFileName}</small>
              </label>
              <input
                id="profile-avatar-file"
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          <label className="field-label" htmlFor="profile-description">
            Description
          </label>
          <textarea
            id="profile-description"
            className="input input-area"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />

          <h2>Update onboarding preferences</h2>
          <div className="chip-row">
            {tripTypeOptions.map((tripType) => {
              const selected = preferences.tripTypes.includes(tripType)
              return (
                <button
                  key={tripType}
                  type="button"
                  className={selected ? 'chip is-selected' : 'chip'}
                  onClick={() =>
                    setPreferences((previous) => ({
                      ...previous,
                      tripTypes: toggleTripType(previous.tripTypes, tripType),
                    }))
                  }
                >
                  {tripType}
                </button>
              )
            })}
          </div>

          <div className="choice-row">
            <button
              className={
                preferences.groupPreference === 'narrow'
                  ? 'choice-card is-active'
                  : 'choice-card'
              }
              type="button"
              onClick={() =>
                setPreferences((previous) => ({
                  ...previous,
                  groupPreference: 'narrow',
                }))
              }
            >
              Narrow group
            </button>
            <button
              className={
                preferences.groupPreference === 'big'
                  ? 'choice-card is-active'
                  : 'choice-card'
              }
              type="button"
              onClick={() =>
                setPreferences((previous) => ({
                  ...previous,
                  groupPreference: 'big',
                }))
              }
            >
              Big group
            </button>
          </div>

          <label className="field-label" htmlFor="profile-max-group">
            Maximum group members
          </label>
          <input
            id="profile-max-group"
            className="input"
            type="number"
            min={2}
            max={30}
            value={preferences.maxGroupSize}
            onChange={(event) => {
              const nextValue = Number(event.target.value)
              setPreferences((previous) => ({
                ...previous,
                maxGroupSize: Number.isFinite(nextValue) ? nextValue : 8,
              }))
            }}
          />

          <button className="btn btn-primary" type="submit">
            Save profile changes
          </button>

          {saved ? (
            <p className="info-banner">Profile and preferences updated in mock mode.</p>
          ) : null}
        </motion.section>

        <motion.section
          className="panel profile-history-panel"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={revealTransition}
        >
          <p className="eyebrow">Trip timeline</p>
          <h2>Past and upcoming journeys</h2>

          <div className="profile-history-grid">
            <article className="history-block">
              <h3>Future trips</h3>
              <ul className="timeline-mini">
                {futureTrips.map((trip) => (
                  <li key={trip.id} className="history-item">
                    <Link className="history-item-link" to={`/trip/${trip.id}`}>
                      <img src={trip.coverImage} alt={trip.title} className="history-thumb" />
                      <div>
                        <p className="list-title">{trip.title}</p>
                        <p>
                          {trip.startDate} - {trip.endDate}
                        </p>
                        <p>{trip.currentMembers}/{trip.maxMembers} travelers</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>

            <article className="history-block">
              <h3>Past trips</h3>
              <ul className="timeline-mini">
                {pastTrips.map((trip) => (
                  <li key={trip.id} className="history-item">
                    <Link className="history-item-link" to={`/trip/${trip.id}`}>
                      <img src={trip.coverImage} alt={trip.title} className="history-thumb" />
                      <div>
                        <p className="list-title">{trip.title}</p>
                        <p>
                          {trip.startDate} - {trip.endDate}
                        </p>
                        <p>{trip.timeline.length} timeline day entries</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </motion.section>
      </form>

      <motion.section
        className="panel profile-discovery-panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={revealTransition}
      >
        <div className="profile-section-head">
          <div>
            <p className="eyebrow">Discovery inside profile</p>
            <h2>Trips matched to your current preferences</h2>
            <p>
              Same discovery energy, but enriched with personal match logic and
              deeper recommendation context.
            </p>
          </div>
          <Link className="btn btn-ghost" to="/discover">
            <FiCompass aria-hidden="true" />
            Open full discovery
          </Link>
        </div>

        <div className="trip-grid profile-trip-grid">
          {discoveryTrips.map((trip, index) => (
            <motion.article
              className="panel trip-card profile-trip-card"
              key={trip.id}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ ...revealTransition, delay: index * 0.05 }}
            >
              <img src={trip.coverImage} alt={trip.title} className="trip-cover" />
              <div className="trip-card-body">
                {memberTripIds.has(trip.id) ? (
                  <p className="match-pill">You are in this trip</p>
                ) : (
                  <p className="match-pill">Not joined yet</p>
                )}

                <p className="trip-meta">
                  {trip.destination} • {trip.status}
                </p>
                <h2>{trip.title}</h2>
                <p>{trip.description}</p>
                <p className="trip-submeta">
                  {trip.timelineLength} days • starts {trip.startDate}
                </p>

                <div className="trip-stat-row">
                  <span>
                    {trip.currentMembers}/{trip.maxMembers} members
                  </span>
                  <span>{trip.budgetPerPerson} EUR / person</span>
                </div>

                <p className="match-pill">{trip.matchScore}% profile match</p>

                <div className="match-reasons">
                  {trip.matchReasons.map((reason) => (
                    <span key={reason} className="reason-chip">
                      {reason}
                    </span>
                  ))}
                </div>

                <div className="chip-row">
                  {trip.tags.map((tag) => (
                    <span key={tag} className="chip chip-static">
                      {tag}
                    </span>
                  ))}
                </div>

                <Link className="btn btn-primary" to={`/trip/${trip.id}`}>
                  {memberTripIds.has(trip.id) ? 'Open trip space' : 'View details'}
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.section>
    </section>
  )
}
