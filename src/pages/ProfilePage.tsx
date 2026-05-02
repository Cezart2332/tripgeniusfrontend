import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { FiBell, FiChevronDown, FiCompass, FiMail, FiUploadCloud, FiZap, FiUser } from 'react-icons/fi'
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
import { getAvatarUrl } from '../utils/userUtils'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type ProfileTab = 'identity' | 'invites' | 'history' | 'matches' | 'notifications'

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

const DEFAULT_PROFILE_DESCRIPTION = ''


const profileTabs: Array<{ key: ProfileTab; label: string; icon: any }> = [
  { key: 'identity', label: 'Identity', icon: FiUser },
  { key: 'invites', label: 'Invites', icon: FiMail },
  { key: 'history', label: 'History', icon: FiZap },
  { key: 'matches', label: 'Matches', icon: FiCompass },
  { key: 'notifications', label: 'Notifications', icon: FiBell },
]

const formatNotificationTimestamp = (notification: User['notifications'][number]): string => {
  const timestampValue =
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).CreatedAt ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).createdAt ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).timestamp ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).Timestamp ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).created ??
    notification.date

  if (!timestampValue) {
    return 'Just now'
  }

  const dotNetDateMatch = /\/Date\((\d+)\)\//.exec(timestampValue)
  const parsedDate = dotNetDateMatch
    ? new Date(Number(dotNetDateMatch[1]))
    : new Date(timestampValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Just now'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

const isNotificationRead = (
  notification: User['notifications'][number],
  readNotificationIds: number[],
): boolean => {
  const backendReadStatus =
    notification.isRead ??
    notification.read ??
    notification.IsRead ??
    notification.Read ??
    false

  return backendReadStatus || readNotificationIds.includes(notification.id)
}

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data

    if (typeof responseData === 'string') {
      return responseData
    }

    if (responseData && typeof responseData === 'object') {
      const messageValue =
        (responseData as { message?: unknown }).message ??
        (responseData as { error?: unknown }).error ??
        (responseData as { detail?: unknown }).detail

      if (typeof messageValue === 'string') {
        return messageValue
      }

      if (messageValue != null) {
        return String(messageValue)
      }

      return JSON.stringify(responseData)
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

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
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user?.username, user?.profileUrl))
  const [, setAvatarFileName] = useState('No image uploaded yet')
  const [description, setDescription] = useState(
    user?.description ?? DEFAULT_PROFILE_DESCRIPTION,
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [tripTypes, setTripTypes] = useState<string[]>(() => [...(user?.tags ?? [])])
  const [maxGroupSize, setMaxGroupSize] = useState<number | ''>(
    user?.groupSize ?? '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [readNotificationIds, setReadNotificationIds] = useState<number[]>([])
  const [isMarkingNotificationId, setIsMarkingNotificationId] = useState<number | null>(null)
  const [isClearingNotifications, setIsClearingNotifications] = useState(false)
  const [isRespondingInviteId, setIsRespondingInviteId] = useState<string | null>(null)
  const [inviteResponseAction, setInviteResponseAction] = useState<'Accepted' | 'Declined' | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const tabListRef = useRef<HTMLElement | null>(null)

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  const updateUserNotificationsAsRead = (notificationIds: number[]) => {
    if (!user || notificationIds.length === 0) {
      return
    }

    const notificationIdSet = new Set(notificationIds)
    const updatedNotifications = user.notifications.map((notification) => {
      if (!notificationIdSet.has(notification.id)) {
        return notification
      }

      return {
        ...notification,
        isRead: true,
        read: true,
        IsRead: true,
        Read: true,
      }
    })

    dispatch(
      setUser({
        user: {
          ...user,
          notifications: updatedNotifications,
        },
      }),
    )
  }



  useEffect(() => {
    if (!user) {
      return
    }

    setAvatarUrl(getAvatarUrl(user.username, user.profileUrl))
    setDescription(user.description || DEFAULT_PROFILE_DESCRIPTION)
    setTripTypes([...(user.tags ?? [])])
    setMaxGroupSize(user.groupSize ?? '')
  }, [user])

  useEffect(() => {
    const fetchUser = async () => {
      const res = await api.get('api/user/me')
      dispatch(setUser({ user: res.data }))
      console.log(res.data)
    }
    fetchUser()

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
    () => (user?.trips ?? []).filter((trip: Trip) => isFinishedTripStatus(trip.status)),
    [user?.trips],
  )

  const effectiveMaxGroupSize = typeof maxGroupSize === 'number' ? maxGroupSize : null

  const futureTrips = useMemo(
    () => (user?.trips ?? []).filter((trip: Trip) => isUpcomingTripStatus(trip.status)),
    [user?.trips],
  )

  const discoveryTrips = useMemo<PersonalizedTripCard[]>(() => {
    return (user?.trips ?? [])
      .map((trip: Trip) => {
        const tagsSafe = trip.tags ?? []
        const matchingTags = tagsSafe.filter((tag: string) => tripTypes.includes(tag))

        const tripMax = trip.maxParticipants ?? Number.MAX_SAFE_INTEGER
        const groupAlignment =
          effectiveMaxGroupSize === null
            ? 0
            : tripMax <= effectiveMaxGroupSize
              ? 10
              : -7
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
          effectiveMaxGroupSize === null
            ? 'No preferred group size set'
            : trip.maxParticipants <= effectiveMaxGroupSize
              ? 'Fits your preferred group size'
              : 'Larger group than your default setting',
        ]

        return {
          id: trip.id,
          title: trip.title,
          coverImage: trip.imageUrl,
          description: trip.description,
          status: getTripStatusLabel(trip.status),
          timelineLength: (trip.timelines ?? []).length,
          startDate: formatDisplayDate(trip.startingDate),
          currentMembers: trip.currentMembers,
          maxMembers: trip.maxParticipants,
          price: trip.price,
          tags: tagsSafe,
          matchScore,
          matchReasons,
        }
      })
      .sort((first, second) => second.matchScore - first.matchScore)
  }, [user?.trips, tripTypes, effectiveMaxGroupSize])

  const visibleNotifications = useMemo(
    () =>
      (user?.notifications ?? []).filter(
        (notification) => !isNotificationRead(notification, readNotificationIds),
      ),
    [user?.notifications, readNotificationIds],
  )

  const visibleInvites = useMemo(() => {
    const invites: Array<{ tripId: string; invitedId: string; tripTitle: string }> = []

      ; (user?.trips ?? []).forEach((trip) => {
        const memberEntry = trip.members?.find((m) => {
          const usernameMatch = String((m as unknown as Record<string, unknown>).username) === String(user?.username)
          const memberObj = m as unknown as Record<string, unknown>
          const memberStatus = String(memberObj.status ?? memberObj.memberStatus ?? memberObj.member_status ?? '').toLowerCase()
          return usernameMatch && memberStatus === 'invited'
        })

        if (!memberEntry) return

        invites.push({
          tripId: String(trip.id),
          invitedId: String((memberEntry as unknown as Record<string, unknown>).id ?? ''),
          tripTitle: trip.title,
        })
      })

    return invites
  }, [user?.trips, user?.username])


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
    groupSize: number | '',
  ) => {
    const formData = new FormData()

    if (avatar) {
      formData.append('avatar', avatar)
    }

    formData.append('description', nextDescription)
    tags.forEach((tag) => formData.append('tags', tag))
    if (groupSize !== '') {
      formData.append('groupSize', groupSize.toString())
    }

    try {
      const response = await api.put('/api/user/update', formData)

      const updatedUser = (response.data) as User
      dispatch(
        setUser({
          user: updatedUser,
        }),
      )

      return updatedUser
    }
    catch (err: any) {
      if (err?.queued) {
        showToast('Profile and preferences will be updated successfully.', 'success')
      }
      else {
        showToast('There was a problem updating your profile, please try again.', 'error')
        console.error(err)
      }
    }
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setIsSaving(true)

    try {
      const updatedUser = await update(
        avatarFile,
        description.trim(),
        tripTypes,
        maxGroupSize,
      )

      if (updatedUser) {
        if (updatedUser.profileUrl) {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
            objectUrlRef.current = null
          }
          setAvatarUrl(updatedUser.profileUrl)
        }

        setAvatarFileName(avatarFile ? avatarFile.name : 'No image uploaded yet')
        setAvatarFile(null)
        showToast('Profile and preferences updated successfully.', 'success')
      }
    }
    catch (err: unknown) {
      if (err instanceof AxiosError) {
        const message = err.response?.data?.message || err.response?.data || "There was a problem updating your profile, please try again later."
        showToast(String(message), 'error')
      }
      else {
        showToast('Could not update profile. Please try again.', 'error')
      }
    }
    finally {
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

  const markNotificationAsRead = async (notificationId: number) => {
    if (isMarkingNotificationId === notificationId || isClearingNotifications) {
      return
    }

    setIsMarkingNotificationId(notificationId)
    try {
      const res = await api.post('/api/user/read-notification', { notificationId: notificationId })
      if (res.status == 200) {
        setReadNotificationIds((previous) =>
          previous.includes(notificationId)
            ? previous
            : [...previous, notificationId],
        )
        updateUserNotificationsAsRead([notificationId])
      }
    }
    catch (error) {
      console.error(error)
    } finally {
      setIsMarkingNotificationId(null)
    }
  }

  const markNotificationsAsRead = async () => {
    if (isClearingNotifications) {
      return
    }

    setIsClearingNotifications(true)
    try {
      const res = await api.post('/api/user/read-notifications')
      if (res.status == 200) {
        const allNotificationIds = (user?.notifications ?? []).map(
          (notification) => notification.id,
        )

        setReadNotificationIds((previous) =>
          Array.from(new Set([...previous, ...allNotificationIds])),
        )
        updateUserNotificationsAsRead(allNotificationIds)
      }
    }
    catch (error) {
      console.error(error)
    } finally {
      setIsClearingNotifications(false)
    }
  }

  const handleInviteResponse = async (tripId: string, action: 'Accepted' | 'Declined') => {
    if (isRespondingInviteId === tripId) {
      return
    }

    setIsRespondingInviteId(tripId)
    setInviteResponseAction(action)
    try {
      const response = await api.patch('api/trip/membership-response', {
        tripId: tripId,
        invitedId: user?.id,
        memberStatus: 'Invited',
        action: action === 'Accepted' ? 'accept' : 'decline',
      })
      if (response.status === 200) {
        showToast(`Expedition invite ${action.toLowerCase()}ed.`, 'success')
      }

      const userRes = await api.get('api/user/me')
      dispatch(setUser({ user: userRes.data }))

    } catch (error: unknown) {
      const fallbackMessage = `Failed to ${action.toLowerCase()} invite.`
      showToast(getErrorMessage(error, fallbackMessage), 'error')
    } finally {
      setIsRespondingInviteId(null)
      setInviteResponseAction(null)
    }
  }

  if (!user) {
    return (
      <section className="page profile-page">
        <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
        <div className="discovery-empty-state">
          <img src="/newstickers/sticker5.png" alt="" className="discovery-empty-sticker" />
          <h1>You are not logged in</h1>
          <p>Log in to edit your profile and unlock personalized trip discovery.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page profile-page-v2 container">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <header className="profile-header-v2">
        <div>
          <p className="eyebrow">Explorer Workspace</p>
          <h1>Welcome, {user.username}</h1>
        </div>
        <nav
          ref={tabListRef}
          className="profile-tab-bar-v2"
          aria-label="Profile sections"
          role="tablist"
        >
          {profileTabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              id={`profile-tab-${tab.key}`}
              className={activeTab === tab.key ? 'profile-tab-btn-v2 is-active' : 'profile-tab-btn-v2'}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`profile-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              title={tab.label}
            >
              <span className="tab-label-desktop">{tab.label}</span>
              <span className="tab-icon-mobile" aria-hidden="true">
                <tab.icon />
              </span>
            </button>
          ))}
        </nav>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'identity' ? (
          <motion.div
            key="identity"
            id="profile-panel-identity"
            role="tabpanel"
            aria-labelledby="profile-tab-identity"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
            className="profile-identity-v2"
          >
            <div className="profile-avatar-section-v2">
              <label className="avatar-wrapper-v2" htmlFor="profile-avatar-file">
                <img src={avatarUrl} alt="Profile" className="avatar-preview-v2" />
                <div className="avatar-upload-overlay-v2">
                  <FiUploadCloud size={24} />
                  <span>Update photo</span>
                </div>
              </label>
              <input
                id="profile-avatar-file"
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isSaving}
                onChange={handleAvatarUpload}
              />
              <img src="/newstickers/sticker2.png" alt="" className="profile-sticker-v2" style={{ width: '100%', maxWidth: '200px', marginTop: '2rem', opacity: 0.8 }} />
            </div>

            <form className="profile-form-v2" onSubmit={handleSave}>
              <div className="profile-section-v2">
                <h3>Identity Details</h3>
                <label className="field-label" htmlFor="profile-description">
                  Bio / Expedition Motto
                </label>
                <textarea
                  id="profile-description"
                  className="input input-area"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSaving}
                  rows={4}
                  placeholder="Tell us about your travel style..."
                />
              </div>

              <div className="profile-section-v2">
                <h3>Travel DNA</h3>
                <div className="chip-row">
                  {tripTypeOptions.map((tripType) => {
                    const selected = tripTypes.includes(tripType)
                    return (
                      <button
                        key={tripType}
                        type="button"
                        className={selected ? 'chip is-selected' : 'chip'}
                        disabled={isSaving}
                        onClick={() => setTripTypes((previous) => toggleTripType(previous, tripType))}
                      >
                        {tripType}
                      </button>
                    )
                  })}
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label className="field-label" htmlFor="profile-max-group">
                    Ideal Group Size
                  </label>
                  <input
                    id="profile-max-group"
                    className="input"
                    type="number"
                    min={2}
                    max={30}
                    value={maxGroupSize}
                    disabled={isSaving}
                    placeholder="Leave empty if not set"
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setMaxGroupSize(nextValue === '' ? '' : Number(nextValue))
                    }}
                  />
                </div>
              </div>

              <button className="btn btn-primary btn-lg" type="submit" disabled={isSaving}>
                {isSaving ? 'Syncing...' : 'Save Profile Workspace'}
              </button>
            </form>
          </motion.div>
        ) : null}

        {activeTab === 'invites' ? (
          <motion.div
            key="invites"
            id="profile-panel-invites"
            role="tabpanel"
            aria-labelledby="profile-tab-invites"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <div className="profile-section-v2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3>Expedition Invites</h3>
                  <p>Manage your pending trip invitations.</p>
                </div>
              </div>

              <div className="profile-invites-v2">
                {visibleInvites.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <img src="/newstickers/sticker4.png" alt="" style={{ width: '120px', marginBottom: '1rem', opacity: 0.6 }} />
                    <p className="empty-note">No pending invitations.</p>
                  </div>
                )}
                {visibleInvites.map((invite) => (
                  <div key={invite.tripId} className="invite-row-v2">
                    <div className="invite-icon-v2">
                      <FiMail />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#f3fff1', fontWeight: 500 }}>Invitation to {invite.tripTitle}</p>
                    </div>
                    <div className="invite-actions-v2">
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isRespondingInviteId === invite.tripId}
                        onClick={() => handleInviteResponse(invite.tripId, 'Accepted')}
                      >
                        {isRespondingInviteId === invite.tripId && inviteResponseAction === 'Accepted'
                          ? 'Accepting...'
                          : 'Accept'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={isRespondingInviteId === invite.tripId}
                        onClick={() => handleInviteResponse(invite.tripId, 'Declined')}
                      >
                        {isRespondingInviteId === invite.tripId && inviteResponseAction === 'Declined'
                          ? 'Declining...'
                          : 'Decline'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'history' ? (
          <motion.div
            key="history"
            id="profile-panel-history"
            role="tabpanel"
            aria-labelledby="profile-tab-history"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
            className="profile-history-v2"
          >
            <div className="profile-section-v2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Expedition Timeline</h3>
                  <p>Your journey through various territories.</p>
                </div>
                <img src="/newstickers/sticker3.png" alt="" style={{ width: '80px' }} />
              </div>

              <div className="profile-history-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                <div className="history-list-v2">
                  <h4>Upcoming</h4>
                  {futureTrips?.length === 0 && <p className="empty-note">No upcoming trips planned.</p>}
                  {futureTrips?.map((trip) => (
                    <Link key={trip.id} className="history-row-v2" to={`/app/trip/${trip.id}`}>
                      <img src={trip.imageUrl} alt="" className="history-thumb-v2" />
                      <div className="history-info-v2">
                        <h4>{trip.title}</h4>
                        <p>{formatDisplayDateRange(trip.startingDate, trip.endingDate)}</p>
                      </div>
                      <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                    </Link>
                  ))}
                </div>

                <div className="history-list-v2">
                  <h4>Completed</h4>
                  {pastTrips?.length === 0 && <p className="empty-note">Your history is currently a blank map.</p>}
                  {pastTrips?.map((trip) => (
                    <Link key={trip.id} className="history-row-v2" to={`/app/trip/${trip.id}`}>
                      <img src={trip.imageUrl} alt="" className="history-thumb-v2" />
                      <div className="history-info-v2">
                        <h4>{trip.title}</h4>
                        <p>{formatDisplayDateRange(trip.startingDate, trip.endingDate)}</p>
                      </div>
                      <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'matches' ? (
          <motion.div
            key="matches"
            id="profile-panel-matches"
            role="tabpanel"
            aria-labelledby="profile-tab-matches"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <div className="profile-section-v2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3>Match Intelligence</h3>
                  <p>Trips that resonate with your travel DNA.</p>
                </div>
                <Link className="btn btn-ghost" to="/app/discover">
                  <FiCompass /> Full Discovery
                </Link>
              </div>

              <div className="matches-grid-v2">
                {discoveryTrips.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0' }}>
                    <img src="/newstickers/sticker5.png" alt="" style={{ width: '140px', opacity: 0.4, marginBottom: '1rem' }} />
                    <p className="empty-note">No matches found. Try adjusting your preferences in Identity.</p>
                  </div>
                )}
                {discoveryTrips.slice(0, 6).map((trip) => (
                  <Link key={trip.id} to={`/app/trip/${trip.id}`} className="match-card-v2">
                    <div className="match-badge-v2">{trip.matchScore}% Match</div>
                    <img src={trip.coverImage || '/newstickers/sticker1.png'} alt="" className="match-thumb-v2" />

                    <div className="match-content-v2">
                      <p className="eyebrow" style={{ color: 'var(--green-580)', fontSize: '0.7rem' }}>{trip.status}</p>
                      <h3>{trip.title}</h3>
                      <p className="match-desc-v2">{trip.description}</p>

                      <div className="match-reasons-v2">
                        {trip.matchReasons.map((reason, idx) => (
                          <div key={idx} className="match-reason-v2">
                            <FiZap size={12} />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>

                      <div className="match-meta-v2">
                        <div className="match-price-v2">{trip.price} EUR</div>
                        <div className="match-members-v2">{trip.currentMembers}/{trip.maxMembers} Explorers</div>
                      </div>

                      <button className="btn btn-primary btn-sm" style={{ marginTop: '1.5rem', width: '100%' }}>View Workspace</button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'notifications' ? (
          <motion.div
            key="notifications"
            id="profile-panel-notifications"
            role="tabpanel"
            aria-labelledby="profile-tab-notifications"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <div className="profile-section-v2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3>Intelligence Feed</h3>
                  <p>Stay updated on expedition changes.</p>
                </div>
                <button
                  className="btn btn-ghost"
                  disabled={isClearingNotifications || visibleNotifications.length === 0}
                  onClick={markNotificationsAsRead}
                >
                  {isClearingNotifications ? 'Clearing...' : 'Clear all'}
                </button>
              </div>

              <div className="profile-notifications-v2">
                {visibleNotifications.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <img src="/newstickers/sticker6.png" alt="" style={{ width: '120px', marginBottom: '1rem', opacity: 0.6 }} />
                    <p className="empty-note">All quiet on the expedition front.</p>
                  </div>
                )}
                {visibleNotifications.map((notification) => {
                  const read = isNotificationRead(notification, readNotificationIds)
                  return (
                    <div
                      key={notification.id}
                      className={read ? 'notification-row-v2' : 'notification-row-v2 unread'}
                      onClick={() => {
                        if (!read && isMarkingNotificationId !== notification.id && !isClearingNotifications) {
                          markNotificationAsRead(notification.id)
                        }
                      }}
                    >
                      <div className="notification-icon-v2">
                        <FiBell />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#f3fff1', fontWeight: 500 }}>{notification.content}</p>
                        <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.2rem' }}>
                          {formatNotificationTimestamp(notification)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={read || isMarkingNotificationId === notification.id || isClearingNotifications}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!read) {
                            markNotificationAsRead(notification.id)
                          }
                        }}
                      >
                        {read
                          ? 'Read'
                          : isMarkingNotificationId === notification.id
                            ? 'Marking...'
                            : 'Mark as read'}
                      </button>
                      {!read && <span className="notification-badge-dot" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </section>
    )
  }
