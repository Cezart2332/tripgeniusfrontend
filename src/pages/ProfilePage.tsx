import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { FiBell, FiChevronDown, FiCompass, FiMail, FiUploadCloud, FiZap, FiUser, FiUsers, FiCalendar, FiClock } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'

import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { OffroadTrip, Trip, User } from '../types/models'
import api, { updateCachedResponse } from '../data/api'
import { setUser } from '../data/authSlice'
import { AxiosError } from 'axios'
import { isQueuedRequestError } from '../utils/errorMessage'
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

type TripWithType = (Trip | OffroadTrip) & { tripType: 'classic' | 'offroad' }

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

/**
 * Determines if a trip is currently active (happening now)
 * A trip is active when: startDate <= today <= endDate
 */
const isActiveTrip = (trip: TripWithType): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(trip.startingDate)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(trip.endingDate)
  endDate.setHours(0, 0, 0, 0)

  return startDate <= today && today <= endDate
}

/**
 * Determines if a trip is upcoming (future start date)
 */
const isUpcomingTrip = (trip: TripWithType): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(trip.startingDate)
  startDate.setHours(0, 0, 0, 0)

  return startDate > today
}

/**
 * Determines if a trip is past (ended before today)
 */
const isPastTrip = (trip: TripWithType): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endDate = new Date(trip.endingDate)
  endDate.setHours(0, 0, 0, 0)

  return endDate < today
}



const profileTabs: Array<{ key: ProfileTab; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = [
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
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const shouldRedirectToLogin = !user
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    const requestedTab = searchParams.get('tab')
    return requestedTab && profileTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as ProfileTab)
      : 'identity'
  })
  
  // Sync activeTab with URL
  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    const nextTab = requestedTab && profileTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as ProfileTab)
      : 'identity'
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync tab from URL only
  }, [searchParams])

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
  const [allTrips, setAllTrips] = useState<Trip[]>([])
  const [isFetchingAllTrips, setIsFetchingAllTrips] = useState(false)
  const [offroadTrips, setOffroadTrips] = useState<OffroadTrip[]>([])
  const [isFetchingOffroadTrips, setIsFetchingOffroadTrips] = useState(false)
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

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      setIsFetchingAllTrips(true)
      try {
        const res = await api.get('api/trip/get-all-trips')
        setAllTrips(res.data || [])
      } catch (err) {
        console.error('Failed to fetch discovery trips:', err)
      } finally {
        setIsFetchingAllTrips(false)
      }
    }

    const fetchOffroadTrips = async () => {
      setIsFetchingOffroadTrips(true)
      try {
        const res = await api.get('api/OffroadTrip/get-all-offroad-trips')
        setOffroadTrips(res.data || [])
      } catch (err) {
        console.error('Failed to fetch offroad trips:', err)
      } finally {
        setIsFetchingOffroadTrips(false)
      }
    }

    fetchAll()
    fetchOffroadTrips()
  }, [user])

  const memberOffroadTrips = useMemo(
    () => offroadTrips.filter((t) => t.isUserMember),
    [offroadTrips]
  )

  // Combine classic trips and offroad trips for history (membership only)
  const allUserTrips = useMemo<TripWithType[]>(() => {
    const classicTrips = (user?.trips ?? []).map(t => ({ ...t, tripType: 'classic' as const }))
    const userOffroadTrips = memberOffroadTrips.map(t => ({ ...t, tripType: 'offroad' as const }))
    return [...classicTrips, ...userOffroadTrips]
  }, [user?.trips, memberOffroadTrips])

  // Categorize trips by date: active, upcoming, past
  const categorizedTrips = useMemo(() => {
    const active = allUserTrips.filter(isActiveTrip)
    const upcoming = allUserTrips.filter(isUpcomingTrip)
    const past = allUserTrips.filter(isPastTrip)

    // Sort each category by date
    const sortByDate = (a: TripWithType, b: TripWithType) =>
      new Date(a.startingDate).getTime() - new Date(b.startingDate).getTime()

    return {
      active: active.sort(sortByDate),
      upcoming: upcoming.sort(sortByDate),
      past: past.sort((a, b) => new Date(b.endingDate).getTime() - new Date(a.endingDate).getTime()), // Most recent first
    }
  }, [allUserTrips])

  const effectiveMaxGroupSize = typeof maxGroupSize === 'number' ? maxGroupSize : null

  const discoveryTrips = useMemo<PersonalizedTripCard[]>(() => {
    // We filter ALL trips from the platform, excluding those the user is already in
    const userTripIds = new Set((user?.trips ?? []).map(t => String(t.id)))
    const userOffroadTripIds = new Set(memberOffroadTrips.map(t => String(t.id)))

    return allTrips
      .filter(trip => !userTripIds.has(String(trip.id)) && !userOffroadTripIds.has(String(trip.id)))
      .map((trip: Trip) => {
        const tagsSafe = trip.tags ?? []
        const matchingTags = tagsSafe.filter((tag: string) => tripTypes.includes(tag))

        // Calculate Interest Match (0-100)
        let interestScore = 0
        if (tripTypes.length > 0) {
          interestScore = (matchingTags.length / tripTypes.length) * 100
        }

        const tripMax = trip.maxParticipants ?? Number.MAX_SAFE_INTEGER
        const groupAlignment =
          effectiveMaxGroupSize === null
            ? 0
            : tripMax <= effectiveMaxGroupSize
              ? 10
              : -7
        
        // Final score: 80% Interests + 20% Group size/status alignment
        const matchScore = clamp(
          Math.round(interestScore * 0.8 + 20 + groupAlignment),
          0,
          100
        )

        const matchReasons = [
          matchingTags.length > 0
            ? `Shared trip styles: ${matchingTags.slice(0, 2).join(', ')}`
            : 'Explore a new travel vibe',
          effectiveMaxGroupSize === null
            ? 'Set a preferred group size for better results'
            : trip.maxParticipants <= effectiveMaxGroupSize
              ? 'Fits your preferred group size'
              : 'Larger group than your usual preference',
        ]

        return {
          id: String(trip.id),
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
      .filter(card => card.matchScore >= 50) // ONLY high matches
      .sort((first, second) => second.matchScore - first.matchScore)
  }, [allTrips, user?.trips, memberOffroadTrips, tripTypes, effectiveMaxGroupSize])

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
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
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

    // Optimistic Update: Update Redux state immediately
    if (user) {
      const optimisticUser: User = {
        ...user,
        description: description.trim(),
        tags: tripTypes,
        groupSize: typeof maxGroupSize === 'number' ? maxGroupSize : user.groupSize
      }
      dispatch(setUser({ user: optimisticUser }))
      
      // Update the Service Worker's cache for /api/user/me so refresh works offline
      updateCachedResponse('api/user/me', optimisticUser)
    }

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
      if (isQueuedRequestError(err)) {
        showToast('Profile and preferences will be updated successfully.', 'success')
      }
      else {
        // Rollback on actual server error (not network error)
        if (user) {
          dispatch(setUser({ user }))
          updateCachedResponse('api/user/me', user)
        }
        
        if (err instanceof AxiosError) {
          const message = err.response?.data?.message || err.response?.data || "There was a problem updating your profile, please try again later."
          showToast(String(message), 'error')
        }
        else {
          showToast('Could not update profile. Please try again.', 'error')
        }
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsSaving(false)
    }
  }

  const selectTab = (nextTab: ProfileTab) => {
    setActiveTab(nextTab) // Immediate UI update
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
        showToast(`Trip invite ${action.toLowerCase()}ed.`, 'success')
        // Local state update for immediate feedback
        if (user) {
          const updatedTrips = user.trips.map(trip => {
            if (String(trip.id) === String(tripId)) {
              const updatedMembers = trip.members?.map(m => {
                if (String(m.id) === String(user.id)) {
                  return { ...m, status: action === 'Accepted' ? 'accepted' : 'declined' }
                }
                return m
              })
              return { ...trip, members: updatedMembers }
            }
            return trip
          })
          dispatch(setUser({ user: { ...user, trips: updatedTrips } }))
        }
      }

      const userRes = await api.get('api/user/me')
      dispatch(setUser({ user: userRes.data }))

    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        // Optimistic Update: Remove from local list so user sees it "worked"
        if (user) {
          const updatedTrips = user.trips.map(trip => {
            if (String(trip.id) === String(tripId)) {
              const updatedMembers = trip.members?.map(m => {
                if (String(m.id) === String(user.id)) {
                  return { ...m, status: action === 'Accepted' ? 'accepted' : 'declined' }
                }
                return m
              })
              return { ...trip, members: updatedMembers }
            }
            return trip
          })
          dispatch(setUser({ user: { ...user, trips: updatedTrips } }))
        }
        showToast(`Invite response will be sent when online.`, 'success')
      } else {
        const fallbackMessage = `Failed to ${action.toLowerCase()} invite.`
        showToast(getErrorMessage(err, fallbackMessage), 'error')
      }
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

      <AnimatePresence mode="popLayout" initial={false}>
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
                  About me / Bio
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
                  <h3>Trip Invitations</h3>
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
                      <p style={{ color: 'var(--text-100)', fontWeight: 500 }}>Invitation to {invite.tripTitle}</p>
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
              <div className="profile-tab-header-v2">
                <div>
                  <h3>My Travels</h3>
                  <p>Your journey through various territories.</p>
                </div>
                <img src="/newstickers/sticker3.png" alt="" style={{ width: '80px' }} className="header-sticker-v2" />
              </div>

              <div className="profile-history-categories">
                {/* Active Trips Section */}
                <div className="history-category-section">
                  <div className="history-category-header">
                    <div className="history-category-title">
                      <FiClock className="category-icon" />
                      <h4>Active Trips</h4>
                      <span className="history-category-count">{categorizedTrips.active.length}</span>
                    </div>
                  </div>
                  <div className="history-category-content">
                    {isFetchingOffroadTrips && categorizedTrips.active.length === 0 ? (
                      <div className="history-loading-state">
                        <div className="history-skeleton-row" />
                        <div className="history-skeleton-row" />
                      </div>
                    ) : categorizedTrips.active.length === 0 ? (
                      <div className="history-empty-state">
                        <img src="/newstickers/sticker3.png" alt="" className="history-empty-sticker" />
                        <p className="empty-note">No active trips at the moment.</p>
                      </div>
                    ) : (
                      <div className="history-list-v2">
                        {categorizedTrips.active.map((trip) => (
                          <Link
                            key={`${trip.tripType}-${trip.id}`}
                            className="history-row-v2 history-row-active"
                            to={trip.tripType === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                          >
                            <img src={trip.imageUrl} alt="" className="history-thumb-v2" />
                            <div className="history-info-v2">
                              <h4>
                                {trip.title}
                                {trip.tripType === 'offroad' && (
                                  <span className="history-badge-offroad">Offroad</span>
                                )}
                                <span className="history-badge-active">Active</span>
                              </h4>
                              <div className="history-meta-row">
                                <span className="history-meta-item">
                                  <FiCalendar size={12} />
                                  {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                                </span>
                                <span className="history-meta-item">
                                  <FiUsers size={12} />
                                  {trip.currentMembers}/{trip.maxParticipants} members
                                </span>
                              </div>
                            </div>
                            <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Trips Section */}
                <div className="history-category-section">
                  <div className="history-category-header">
                    <div className="history-category-title">
                      <FiCalendar className="category-icon" />
                      <h4>Upcoming Trips</h4>
                      <span className="history-category-count">{categorizedTrips.upcoming.length}</span>
                    </div>
                  </div>
                  <div className="history-category-content">
                    {isFetchingOffroadTrips && categorizedTrips.upcoming.length === 0 ? (
                      <div className="history-loading-state">
                        <div className="history-skeleton-row" />
                        <div className="history-skeleton-row" />
                      </div>
                    ) : categorizedTrips.upcoming.length === 0 ? (
                      <div className="history-empty-state">
                        <img src="/newstickers/sticker1.png" alt="" className="history-empty-sticker" />
                        <p className="empty-note">No upcoming trips planned. Start exploring!</p>
                        <Link to="/app/discover" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                          <FiCompass /> Discover Trips
                        </Link>
                      </div>
                    ) : (
                      <div className="history-list-v2">
                        {categorizedTrips.upcoming.map((trip) => (
                          <Link
                            key={`${trip.tripType}-${trip.id}`}
                            className="history-row-v2"
                            to={trip.tripType === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                          >
                            <img src={trip.imageUrl} alt="" className="history-thumb-v2" />
                            <div className="history-info-v2">
                              <h4>
                                {trip.title}
                                {trip.tripType === 'offroad' && (
                                  <span className="history-badge-offroad">Offroad</span>
                                )}
                                <span className={`history-badge-status ${isUpcomingTripStatus(trip.status) ? 'status-upcoming' : ''}`}>
                                  {getTripStatusLabel(trip.status)}
                                </span>
                              </h4>
                              <div className="history-meta-row">
                                <span className="history-meta-item">
                                  <FiCalendar size={12} />
                                  {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                                </span>
                                <span className="history-meta-item">
                                  <FiUsers size={12} />
                                  {trip.currentMembers}/{trip.maxParticipants} members
                                </span>
                              </div>
                            </div>
                            <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Past Trips Section */}
                <div className="history-category-section">
                  <div className="history-category-header">
                    <div className="history-category-title">
                      <FiZap className="category-icon" />
                      <h4>Past Trips</h4>
                      <span className="history-category-count">{categorizedTrips.past.length}</span>
                    </div>
                  </div>
                  <div className="history-category-content">
                    {isFetchingOffroadTrips && categorizedTrips.past.length === 0 ? (
                      <div className="history-loading-state">
                        <div className="history-skeleton-row" />
                        <div className="history-skeleton-row" />
                      </div>
                    ) : categorizedTrips.past.length === 0 ? (
                      <div className="history-empty-state">
                        <img src="/newstickers/sticker4.png" alt="" className="history-empty-sticker" />
                        <p className="empty-note">Your history is currently a blank map.</p>
                      </div>
                    ) : (
                      <div className="history-list-v2">
                        {categorizedTrips.past.map((trip) => (
                          <Link
                            key={`${trip.tripType}-${trip.id}`}
                            className="history-row-v2 history-row-past"
                            to={trip.tripType === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                          >
                            <img src={trip.imageUrl} alt="" className="history-thumb-v2" />
                            <div className="history-info-v2">
                              <h4>
                                {trip.title}
                                {trip.tripType === 'offroad' && (
                                  <span className="history-badge-offroad">Offroad</span>
                                )}
                                <span className={`history-badge-status ${isFinishedTripStatus(trip.status) ? 'status-past' : ''}`}>
                                  {getTripStatusLabel(trip.status)}
                                </span>
                              </h4>
                              <div className="history-meta-row">
                                <span className="history-meta-item">
                                  <FiCalendar size={12} />
                                  {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                                </span>
                                <span className="history-meta-item">
                                  <FiUsers size={12} />
                                  {trip.currentMembers}/{trip.maxParticipants} members
                                </span>
                              </div>
                            </div>
                            <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
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
              <div className="profile-tab-header-v2">
                <div>
                  <h3>Match Intelligence</h3>
                  <p>Trips that resonate with your travel DNA.</p>
                </div>
                <Link className="btn btn-ghost" to="/app/discover">
                  <FiCompass /> Full Discovery
                </Link>
              </div>

              <div className="matches-grid-v2">
                {isFetchingAllTrips ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="match-card-v2 discovery-trip-skeleton" style={{ height: '300px' }}>
                       <div className="discovery-skeleton-block" style={{ height: '100%', width: '100%' }} />
                    </div>
                  ))
                ) : discoveryTrips.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0' }}>
                    <img src="/newstickers/sticker5.png" alt="" style={{ width: '140px', opacity: 0.4, marginBottom: '1rem' }} />
                    <p className="empty-note">No matches found. Try adjusting your preferences in Identity.</p>
                  </div>
                ) : (
                  discoveryTrips.slice(0, 6).map((trip) => (
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
                ))
              )}
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
                  <p>Stay updated on trip changes.</p>
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
                    <p className="empty-note">All quiet on the trip front.</p>
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
                        <p style={{ color: 'var(--text-100)', fontWeight: 500 }}>{notification.content}</p>
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
