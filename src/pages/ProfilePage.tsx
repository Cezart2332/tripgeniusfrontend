import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { FiCompass, FiUploadCloud } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'

import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { Trip, User } from '../types/models'
import api from '../data/api'
import { setUser } from '../data/authSlice'
import { AxiosError } from 'axios'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState, FeedbackToastTone } from '../components/FeedbackToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'
import { formatDisplayDate, formatDisplayDateRange } from '../utils/dateDisplay'
import {
  getTripStatusLabel,
  isFinishedTripStatus,
  isUpcomingTripStatus,
} from '../utils/tripStatus'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type ProfileTab = 'identity' | 'history' | 'matches'

interface PersonalizedTripCard {
  id: string
  title: string
  coverImage: string
  description: string
  status: string
  timelineLength: number
  startDate: string
  currentMembers: number
  maxMembers: number
  price: number
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

const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=300&q=80'
const DEFAULT_PROFILE_DESCRIPTION = ''
const DEFAULT_TRIP_TYPES = ['adventure', 'nature']
const DEFAULT_MAX_GROUP_SIZE = 8


const profileTabs: Array<{ key: ProfileTab; label: string }> = [
  { key: 'identity', label: 'Identity' },
  { key: 'history', label: 'History' },
  { key: 'matches', label: 'Matches' },
]

export function ProfilePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const shouldRedirectToLogin = !user
  const requestedTab = searchParams.get('tab')
  const activeTab: ProfileTab =
    requestedTab && profileTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as ProfileTab)
      : 'identity'
  const [avatarUrl, setAvatarUrl] = useState(user?.profileUrl ?? DEFAULT_AVATAR_URL)
  const [avatarFileName, setAvatarFileName] = useState('No image uploaded yet')
  const [description, setDescription] = useState(
    user?.description ?? DEFAULT_PROFILE_DESCRIPTION,
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [tripTypes, setTripTypes] = useState<string[]>(() =>
    user?.tags.length && user.tags.length > 0
      ? [...user.tags]
      : [...DEFAULT_TRIP_TYPES],
  )
  const [maxGroupSize, setMaxGroupSize] = useState<number>(
    user?.groupSize ?? DEFAULT_MAX_GROUP_SIZE,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const objectUrlRef = useRef<string | null>(null)
  const tabListRef = useRef<HTMLElement | null>(null)

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }



  useEffect(() => {
    if (!user) {
      return
    }

    setAvatarUrl(user.profileUrl || DEFAULT_AVATAR_URL)
    setDescription(user.description || DEFAULT_PROFILE_DESCRIPTION)
    setTripTypes(user.tags.length > 0 ? [...user.tags] : [...DEFAULT_TRIP_TYPES])
    setMaxGroupSize(user.groupSize || DEFAULT_MAX_GROUP_SIZE)
  }, [user])

  useEffect(() => {
    const fetchUser = async () => {
        const res = await api.get('api/user/me')
        dispatch(setUser({ user: res.data }))
    }
    const fetchUserHistory = async () => {
      const res = await api.get('api/trip/get-user-trips')
      setTrips(res.data)
    }
    fetchUser()
    fetchUserHistory()

    return () => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
        }
    }
  }, [dispatch])

  useEffect(() => {
    if (!shouldRedirectToLogin) {
      return
    }

    setToast({
      id: Date.now(),
      message: 'You will be redirected in 2 seconds to login page',
      tone: 'info',
    })

    const timeoutId = window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [shouldRedirectToLogin, navigate])

  const pastTrips = useMemo(
    () => trips.filter((trip) => isFinishedTripStatus(trip.status)),
    [trips],
  )

  const futureTrips = useMemo(
    () => trips.filter((trip) => isUpcomingTripStatus(trip.status)),
    [trips],
  )

  const memberTripIds = useMemo(() => {
    if (!user) {
      return new Set<string>()
    }

    const normalizedUserName = user.username.trim().toLowerCase()

    return new Set(
      trips
        .filter((trip) =>
          trip.members.some((member) => {
            const normalizedMemberName = member.username.trim().toLowerCase()

            return (
              member.id === String(user.id) ||
              normalizedMemberName === normalizedUserName ||
              normalizedMemberName.includes(normalizedUserName)
            )
          }),
        )
        .map((trip) => trip.id),
    )
  }, [user, trips])

  const discoveryTrips = useMemo<PersonalizedTripCard[]>(() => {
    return [...trips]
      .map((trip) => {
        const matchingTags = trip.tags.filter((tag) =>
          tripTypes.includes(tag),
        )

        const groupAlignment = trip.maxParticipants <= maxGroupSize ? 10 : -7
        const statusBoost = isUpcomingTripStatus(trip.status) ? 6 : 2

        const matchScore = clamp(
          44 + matchingTags.length * 16 + groupAlignment + statusBoost,
          26,
          98,
        )

        const matchReasons = [
          matchingTags.length > 0
            ? `Shared trip styles: ${matchingTags.slice(0, 2).join(', ')}`
            : 'Great for trying a new travel vibe',
          trip.maxParticipants <= maxGroupSize
            ? 'Fits your preferred group size'
            : 'Larger group than your default setting',
        ]

        return {
          id: trip.id,
          title: trip.title,
          coverImage: trip.imageUrl,
          description: trip.description,
          status: getTripStatusLabel(trip.status),
          timelineLength: trip.timelines.length,
          startDate: formatDisplayDate(trip.startingDate),
          currentMembers: trip.currentMembers,
          maxMembers: trip.maxParticipants,
          price: trip.price,
          tags: trip.tags,
          matchScore,
          matchReasons,
        }
      })
      .sort((first, second) => second.matchScore - first.matchScore)
  }, [trips, tripTypes, maxGroupSize])


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
    setAvatarFile(selectedFile)
  }

  const update = async (
    avatar: File | null,
    nextDescription: string,
    tags: string[],
    groupSize: number,
  ) => {
    const formData = new FormData()

    if (avatar) {
      formData.append('avatar', avatar)
    }

    formData.append('description', nextDescription)
    tags.forEach((tag) => formData.append('tags', tag))
    formData.append('groupSize', groupSize.toString())

    const response = await api.put('/api/user/update', formData)

    const updatedUser = (response.data) as User
    dispatch(
      setUser({
        user: updatedUser,
      }),
    )

    return updatedUser
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setIsSaving(true)

    try 
    {
      const updatedUser = await update(
        avatarFile,
        description.trim(),
        tripTypes,
        maxGroupSize,
      )

      if (updatedUser.profileUrl) 
      {
        if (objectUrlRef.current) 
        {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
        setAvatarUrl(updatedUser.profileUrl)
      }

      setAvatarFileName(avatarFile ? avatarFile.name : 'No image uploaded yet')
      setAvatarFile(null)
      showToast('Profile and preferences updated successfully.', 'success')
    } 
    catch (err : unknown) 
    {
      if(err instanceof AxiosError)
      {
        const message = err.response?.data?.message || err.response?.data || "There was a problem updating your profile, please try again later."
        showToast(String(message), 'error')
      }
      else
      {
        showToast('Could not update profile. Please try again.', 'error')
      }
    } 
    finally 
    {
      await waitForBackendButtonUnlock()
      setIsSaving(false)
    }
  }

  const selectTab = (nextTab: ProfileTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', nextTab)
    setSearchParams(nextParams, { replace: true })
  }

  const focusTabAt = (index: number) => {
    const tabButtons = tabListRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )

    tabButtons?.[index]?.focus()
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % profileTabs.length
    }

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + profileTabs.length) % profileTabs.length
    }

    if (event.key === 'Home') {
      nextIndex = 0
    }

    if (event.key === 'End') {
      nextIndex = profileTabs.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = profileTabs[nextIndex]
    selectTab(nextTab.key)
    focusTabAt(nextIndex)
  }

  if (!user) {
    return (
      <section className="page profile-page">
        <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
        <section className="panel profile-editor-card">
          <p className="eyebrow">Profile</p>
          <h1>You are not logged in</h1>
          <p>Log in to edit your profile and unlock personalized trip discovery.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </section>
      </section>
    )
  }

  return (
    <section className="page profile-page">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
      <motion.header
        className="panel profile-shell-head"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={revealTransition}
      >
        <p className="eyebrow">Traveler profile</p>
        <h1>{user.username}</h1>
        <p>Switch between identity editing, trip history, and match intelligence.</p>
      </motion.header>

      <nav
        ref={tabListRef}
        className="profile-tab-bar"
        aria-label="Profile sections"
        role="tablist"
      >
        {profileTabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            id={`profile-tab-${tab.key}`}
            className={activeTab === tab.key ? 'profile-tab-btn is-active' : 'profile-tab-btn'}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`profile-panel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'identity' ? (
          <motion.form
            key="identity"
            className="panel profile-editor-card"
            onSubmit={handleSave}
            id="profile-panel-identity"
            role="tabpanel"
            aria-labelledby="profile-tab-identity"
            tabIndex={0}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <h2>Identity and preference setup</h2>
            <p>Shape how your profile behaves in collaborative trip discovery.</p>

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
                  disabled={isSaving}
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
              onChange={(event) => {
                setDescription(event.target.value)
              }}
              disabled={isSaving}
              rows={4}
            />

            <h2>Preferred trip styles</h2>
            <div className="chip-row">
              {tripTypeOptions.map((tripType) => {
                const selected = tripTypes.includes(tripType)
                return (
                  <button
                    key={tripType}
                    type="button"
                    className={selected ? 'chip is-selected' : 'chip'}
                    disabled={isSaving}
                    onClick={() => {
                      setTripTypes((previous) => toggleTripType(previous, tripType))
                    }}
                  >
                    {tripType}
                  </button>
                )
              })}
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
              value={maxGroupSize}
              disabled={isSaving}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                setMaxGroupSize(Number.isFinite(nextValue) ? nextValue : 8)
              }}
            />

            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? (
                <span className="btn-loading-content">
                  <span className="inline-spinner" aria-hidden="true" />
                  Saving...
                </span>
              ) : (
                'Save profile changes'
              )}
            </button>
          </motion.form>
        ) : null}

        {activeTab === 'history' ? (
          <motion.section
            key="history"
            className="panel profile-history-panel"
            id="profile-panel-history"
            role="tabpanel"
            aria-labelledby="profile-tab-history"
            tabIndex={0}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <h2>Past and upcoming journeys</h2>

            <div className="profile-history-grid">
              <article className="history-block">
                <h3>Future trips</h3>
                <ul className="timeline-mini">
                  {futureTrips.map((trip) => (
                    <li key={trip.id} className="history-item">
                      <Link className="history-item-link" to={`/trip/${trip.id}`}>
                        <img src={trip.imageUrl} alt={trip.title} className="history-thumb" />
                        <div>
                          <p className="list-title">{trip.title}</p>
                          <p>
                            {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                          </p>
                          <p>{trip.currentMembers}/{trip.maxParticipants} travelers</p>
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
                        <img src={trip.imageUrl} alt={trip.title} className="history-thumb" />
                        <div>
                          <p className="list-title">{trip.title}</p>
                          <p>
                            {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                          </p>
                          <p>{trip.timelines.length} timeline day entries</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </motion.section>
        ) : null}

        {activeTab === 'matches' ? (
          <motion.section
            key="matches"
            className="panel profile-discovery-panel"
            id="profile-panel-matches"
            role="tabpanel"
            aria-labelledby="profile-tab-matches"
            tabIndex={0}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <div className="profile-section-head">
              <div>
                <p className="eyebrow">Matching engine</p>
                <h2>Trips matched to your current preferences</h2>
              </div>
              <Link className="btn btn-ghost" to="/discover">
                <FiCompass aria-hidden="true" />
                Open full discovery
              </Link>
            </div>

            <div className="profile-matches-grid">
              {discoveryTrips.map((trip, index) => (
                <motion.article
                  className="panel profile-match-card"
                  key={trip.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ ...revealTransition, delay: index * 0.05 }}
                >
                  <img src={trip.coverImage} alt={trip.title} className="profile-match-cover" />
                  <div className="profile-match-body">
                    {memberTripIds.has(trip.id) ? (
                      <p className="match-pill">You are in this trip</p>
                    ) : (
                      <p className="match-pill">Not joined yet</p>
                    )}

                    <p className="trip-meta">
                      {trip.status}
                    </p>
                    <h2>{trip.title}</h2>
                    <p>{trip.description}</p>
                    <p className="trip-submeta">
                      {trip.timelineLength} days - starts {trip.startDate}
                    </p>

                    <div className="trip-stat-row">
                      <span>
                        {trip.currentMembers}/{trip.maxMembers} members
                      </span>
                      <span>{trip.price} EUR / person</span>
                    </div>

                    <p className="match-pill">{trip.matchScore}% profile match</p>

                    <div className="match-reasons">
                      {trip.matchReasons.map((reason) => (
                        <span key={reason} className="reason-chip">
                          {reason}
                        </span>
                      ))}
                    </div>

                    <div className="chip-row profile-match-tags">
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
        ) : null}
      </AnimatePresence>
    </section>
  )
}
