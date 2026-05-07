import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, useRef } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import {
  FiUserPlus,
  FiX,
  FiUploadCloud,
  FiInfo,
  FiMap,
  FiUsers,
  FiMessageSquare,
  FiSettings,
  FiPlusCircle,
  FiClock
} from 'react-icons/fi'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TripRouteMap } from '../components/TripRouteMap'
import type { ChatMessage, MemberRole, TimelineStop, Trip, TripMember, User } from '../types/models'
import * as signalR from '@microsoft/signalr'
import api, { updateCachedResponse } from '../data/api'
import { AxiosError } from 'axios'
import {
  formatDisplayDate,
  formatDisplayDateRange,
  toLocalStartOfDay,
} from '../utils/dateDisplay'
import { useDebouncedCallback } from 'use-debounce'
import { getAvatarUrl } from '../utils/userUtils'

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

type TripWorkspaceTab = 'overview' | 'map' | 'members' | 'chat' | 'settings' | 'history'

interface TripTabItem {
  key: TripWorkspaceTab
  label: string
  Icon: any
}

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type TripFetchState = 'loading' | 'ready' | 'not-found' | 'error'

type TripParticipationState = 'accepted' | 'invited' | 'requested' | 'visitor'

const memberTabs: TripTabItem[] = [
  { key: 'overview', label: 'Overview', Icon: FiInfo },
  { key: 'map', label: 'Itinerary', Icon: FiMap },
  { key: 'members', label: 'Members', Icon: FiUsers },
  { key: 'chat', label: 'Chat', Icon: FiMessageSquare },
  { key: 'history', label: 'History', Icon: FiClock },
]

const ownerTabs: TripTabItem[] = [
  ...memberTabs,
  { key: 'settings', label: 'Settings', Icon: FiSettings },
]

const visitorTabs: TripTabItem[] = [
  { key: 'overview', label: 'Overview', Icon: FiInfo },
  { key: 'map', label: 'Public Plan', Icon: FiMap },
  { key: 'members', label: 'Public Members', Icon: FiUsers },
]

const defaultSelectedDay = (startDate: string, timelineLength: number): number => {
  const start = toLocalStartOfDay(startDate)
  if (!start || timelineLength < 1) {
    return 1
  }

  const today = new Date()
  const localTodayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )

  const dayDiff = Math.floor(
    (localTodayStart.getTime() - start.getTime()) / MILLISECONDS_PER_DAY,
  )

  if (dayDiff < 0) {
    return 1
  }

  if (dayDiff + 1 > timelineLength) {
    return timelineLength
  }

  return dayDiff + 1
}

const EARTH_RADIUS_KM = 6371

const toRadians = (value: number): number => (value * Math.PI) / 180

const calculateRouteDistanceKm = (
  fromCoords: [number, number],
  toCoords: [number, number],
): number => {
  const [fromLng, fromLat] = fromCoords
  const [toLng, toLat] = toCoords

  const dLat = toRadians(toLat - fromLat)
  const dLng = toRadians(toLng - fromLng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
    Math.cos(toRadians(toLat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

const normalizeMemberRole = (role: unknown): MemberRole => {
  if (typeof role !== 'string') {
    return 'member'
  }

  const normalizedRole = role.trim().toLowerCase()

  if (normalizedRole === 'owner' || normalizedRole === 'admin' || normalizedRole === 'member') {
    return normalizedRole
  }

  return 'member'
}

const normalizeTripMemberStatus = (status: unknown): TripParticipationState => {
  if (typeof status !== 'string') {
    return 'visitor'
  }

  const normalizedStatus = status.trim().toLowerCase()

  if (normalizedStatus === 'accepted' || normalizedStatus === 'member') {
    return 'accepted'
  }

  if (normalizedStatus === 'invited') {
    return 'invited'
  }

  if (normalizedStatus === 'requested' || normalizedStatus === 'request') {
    return 'requested'
  }

  return 'visitor'
}

const getTripMemberStatusLabel = (status: unknown): string => {
  const normalizedStatus = normalizeTripMemberStatus(status)

  if (normalizedStatus === 'invited') {
    return 'Waiting to accept'
  }

  if (normalizedStatus === 'requested') {
    return 'Waiting for approval'
  }

  if (normalizedStatus === 'accepted') {
    return 'Member'
  }

  return 'Visitor'
}

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

export function TripPage() {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [fetchState, setFetchState] = useState<TripFetchState>('loading')
  const { tripId } = useParams<{ tripId: string }>()

  useEffect(() => {
    if (!tripId) {
      return
    }

    let isMounted = true

    const fetchTrip = async () => {
      setFetchState('loading')

      try {
        const res = await api.get(`api/trip/get-trip/${tripId}`)
        if (!isMounted) {
          return
        }

        const payload = res.data as Trip | { trip: Trip } | null
        const nextTrip =
          payload && typeof payload === 'object' && 'trip' in payload
            ? payload.trip
            : payload

        if (!nextTrip) {
          setTrip(null)
          setFetchState('not-found')
          return
        }
        console.log(nextTrip)
        setTrip(nextTrip)
        setFetchState('ready')
      } catch (err: any) {
        if (!isMounted) {
          return
        }

        // Offline Fallback: Try to find this trip in the 'get-all-trips' cache
        const isNetworkError = !err.response && err.code !== 'ERR_CANCELED'
        if (!navigator.onLine || isNetworkError) {
          try {
            const allRes = await api.get('api/trip/get-all-trips')
            const allTrips: Trip[] = allRes.data
            const foundTrip = allTrips.find(t => String(t.id) === String(tripId))

            if (foundTrip) {
              setTrip(foundTrip)
              setFetchState('ready')
              return
            }
          } catch (offlineErr) {
            console.error('Failed to find trip in offline cache:', offlineErr)
          }
        }

        if (err instanceof AxiosError && err.response?.status === 404) {
          setTrip(null)
          setFetchState('not-found')
          return
        }

        setTrip(null)
        setFetchState('error')
      }
    }
    fetchTrip()
    return () => {
      isMounted = false
    }
  }, [tripId])

  if (!tripId || fetchState === 'not-found') {
    return (
      <section className="page trip-page-v2 container">
        <div className="discovery-empty-state">
          <img src="/newstickers/sticker5.png" alt="" className="discovery-empty-sticker" />
          <h1>Trip not found</h1>
          <p>This trip room has been archived or the coordinates are invalid.</p>
          <Link className="btn btn-primary" to="/app/discover">
            Back to discovery
          </Link>
        </div>
      </section>
    )
  }

  if (fetchState === 'loading') {
    return (
      <section className="page trip-page-v2 container">
        <div className="discovery-empty-state">
          <h1>Loading your trip...</h1>
          <p>We're getting everything ready for your next adventure.</p>
        </div>
      </section>
    )
  }

  if (fetchState === 'error') {
    return (
      <section className="page trip-page-v2 container">
        <div className="discovery-empty-state">
          <img src="/newstickers/sticker6.png" alt="" className="discovery-empty-sticker" />
          <h1>Communication error</h1>
          <p>We lost contact with the server. Check your signal and try again.</p>
          <Link className="btn btn-primary" to="/app/discover">
            Back to discovery
          </Link>
        </div>
      </section>
    )
  }

  if (!trip) return null

  return <TripPageContent key={trip.id} trip={trip} />
}

interface TripPageContentProps {
  trip: Trip
}

interface OwnerTripEditState {
  title: string
  description: string
  status: Trip['status']
  startingDate: string
  endingDate: string
  maxParticipants: string
  tags: string[]
  customTag: string
  imagePreviewUrl: string
  imageFile: File | null
}

const normalizeDateInputValue = (value: string): string => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createOwnerTripEditState = (trip: Trip): OwnerTripEditState => ({
  title: trip.title,
  description: trip.description,
  status: trip.status,
  startingDate: normalizeDateInputValue(trip.startingDate),
  endingDate: normalizeDateInputValue(trip.endingDate),
  maxParticipants: String(trip.maxParticipants),
  tags: trip.tags,
  customTag: '',
  imagePreviewUrl: trip.imageUrl,
  imageFile: null,
})

function TripPageContent({ trip }: TripPageContentProps) {
  const navigate = useNavigate()
  const authenticatedUser = useSelector((state: AuthStoreState) => state.auth.user)
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const baseURL = import.meta.env.VITE_BASE_URL;
  const [searchParams, setSearchParams] = useSearchParams()
  const [tripDetails, setTripDetails] = useState<Trip>(trip)
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [activeTab, setActiveTab] = useState<TripWorkspaceTab>(() => {
    const requestedTab = searchParams.get('view')
    // ownerTabs contains all possible valid keys
    return requestedTab && ownerTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as TripWorkspaceTab)
      : 'overview'
  })

  // Sync activeTab with URL
  useEffect(() => {
    const requestedTab = searchParams.get('view')
    const nextTab = requestedTab && ownerTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as TripWorkspaceTab)
      : 'overview'
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [searchParams])
  const [ownerTripDraft, setOwnerTripDraft] = useState<OwnerTripEditState>(
    createOwnerTripEditState(trip),
  )
  const [isSavingTripDetails, setIsSavingTripDetails] = useState(false)
  const [tripDetailsFeedback, setTripDetailsFeedback] = useState<{
    tone: 'success' | 'info' | 'error'
    message: string
  } | null>(null)
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [timelines, setTimelines] = useState<TimelineStop[]>(
    () => [...trip.timelines].sort((a, b) => a.day - b.day),
  )
  const [selectedDay, setSelectedDay] = useState(
    defaultSelectedDay(trip.startingDate, trip.timelines.length),
  )
  const [members, setMembers] = useState<TripMember[]>(trip.members)

  // Sync members only when the trip ID changes (initial load)
  // Subsequent updates are handled locally in member action handlers
  useEffect(() => {
    setMembers(trip.members);
  }, [trip.id]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await api.get(`api/trip/get-messages/${trip.id}`)
        if (res.status === 200) {
          const fetchedMessages: ChatMessage[] = res.data;
          setChatMessages((prev) => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = fetchedMessages.filter(m => !existingIds.has(m.id));
            return [...prev, ...uniqueNew].sort((a, b) =>
              new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
            );
          });
        }
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseURL}/hubs/trip-chat?access_token=${token}`)
      .withAutomaticReconnect()
      .build()

    connection.on("ReceiveMessage", (msg: ChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      })
    })

    connectionRef.current = connection
    let isStopped = false;
    const start = async () => {
      try {
        await connection.start()
        if (!isStopped) {
          await connection.invoke("JoinTrip", trip.id)
        }
      }
      catch (err) {
        console.error(`Connection failed: ${err}`)
      }
    }
    start()

    fetchMessages()

    return () => {
      isStopped = true;
      const stop = async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("LeaveTrip", trip.id)
          }
        }
        catch (error) {
          console.error("LeaveTrip error:", error)
        }
        await connection.stop()
      }
      stop()
      connectionRef.current = null;
    }
  }, [trip.id, token, baseURL])

  // Pre-fetch all routes for offline use
  useEffect(() => {
    if (!timelines.length) return

    const prefetchRoutes = async () => {
      for (const stop of timelines) {
        try {
          const coordinateString = `${stop.fromCoords[1]},${stop.fromCoords[0]};${stop.toCoords[1]},${stop.toCoords[0]}`

          // 1. Preview Route
          const previewUrl = `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson`
          await fetch(previewUrl)

          // 2. Navigation Route (with steps)
          const navUrl = `https://router.project-osrm.org/route/v1/driving/${coordinateString}?overview=full&geometries=geojson&steps=true`
          await fetch(navUrl)

        } catch (e) {
          // Ignore pre-fetch errors
        }
      }
    }
    prefetchRoutes()
  }, [timelines])

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteUsernameQuery, setInviteUsernameQuery] = useState('')
  const [isSearchingInviteUser, setIsSearchingInviteUser] = useState(false)
  const [isInvitingUserId, setIsInvitingUserId] = useState<string | null>(null)
  const [isUpdatingRoleMemberId, setIsUpdatingRoleMemberId] = useState<string | null>(null)
  const [isRemovingMemberId, setIsRemovingMemberId] = useState<string | null>(null)
  const [isRemovingTimelineId, setIsRemovingTimelineId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<User[]>([])
  const [inviteFeedback, setInviteFeedback] = useState<{
    tone: 'success' | 'info' | 'error'
    message: string
  } | null>(null)
  const [isProcessingRequestMemberId, setIsProcessingRequestMemberId] = useState<string | null>(null)
  const tripRoleData = trip as Trip & {
    userRole?: unknown
    viewerRole?: unknown
    memberRole?: unknown
  }


  const currentStop =
    timelines.find((timelineStop) => timelineStop.day === selectedDay) ??
    timelines[0]

  const selectedRouteDistanceKm = useMemo(
    () =>
      currentStop
        ? calculateRouteDistanceKm(currentStop.fromCoords, currentStop.toCoords)
        : 0,
    [currentStop],
  )

  const normalizedUserName = authenticatedUser?.username.trim().toLowerCase()

  const viewerMember = members.find((m) => {
    if (authenticatedUser && String(m.id) === String(authenticatedUser.id)) return true
    if (!normalizedUserName) return false
    const nmn = m.username.trim().toLowerCase()
    return nmn === normalizedUserName || nmn.includes(normalizedUserName)
  })

  const tripPayloadRole =
    tripRoleData.userRole ?? tripRoleData.viewerRole ?? tripRoleData.memberRole
  const viewerRole: MemberRole = viewerMember ? normalizeMemberRole(viewerMember.role) : normalizeMemberRole(tripPayloadRole)
  const viewerParticipationState = useMemo<TripParticipationState>(() => {
    const viewerId = authenticatedUser?.id != null ? String(authenticatedUser.id) : null
    const viewerUsername = authenticatedUser?.username.trim().toLowerCase() ?? null

    const matchingMember = members.find((member) => {
      const memberRecord = member as unknown as Record<string, unknown>
      const memberId = memberRecord.id != null ? String(memberRecord.id) : null
      const memberUsername = typeof member.username === 'string' ? member.username.trim().toLowerCase() : ''

      return (
        (viewerId !== null && memberId === viewerId) ||
        (viewerUsername !== null && memberUsername === viewerUsername)
      )
    })

    if (!matchingMember) {
      return 'visitor'
    }

    const memberRecord = matchingMember as unknown as Record<string, unknown>
    return normalizeTripMemberStatus(
      memberRecord.status ?? memberRecord.memberStatus ?? memberRecord.member_status,
    )
  }, [authenticatedUser?.id, authenticatedUser?.username, members])

  const isAcceptedMember = viewerParticipationState === 'accepted'
  const isInvitedOrRequested = viewerParticipationState === 'invited' || viewerParticipationState === 'requested'

  const acceptedMembers = useMemo(
    () => members.filter((member) => normalizeTripMemberStatus((member as unknown as Record<string, unknown>).status ?? (member as unknown as Record<string, unknown>).memberStatus ?? (member as unknown as Record<string, unknown>).member_status) === 'accepted'),
    [members],
  )

  const pendingMembers = useMemo(
    () => members.filter((member) => {
      const memberStatus = normalizeTripMemberStatus(
        (member as unknown as Record<string, unknown>).status ??
        (member as unknown as Record<string, unknown>).memberStatus ??
        (member as unknown as Record<string, unknown>).member_status,
      )
      return memberStatus === 'invited' || memberStatus === 'requested'
    }),
    [members],
  )

  const canInviteMembers = viewerRole === 'owner' || viewerRole === 'admin'
  const canEditMemberRoles = viewerRole === 'owner'
  const canRemoveMembers = viewerRole === 'owner'
  const canManageTimelines = viewerRole === 'owner'
  const canManageTripDetails = viewerRole === 'owner'

  const tabs = isAcceptedMember ? (canManageTripDetails ? ownerTabs : memberTabs) : visitorTabs

  const selectTab = (nextTab: TripWorkspaceTab) => {
    setActiveTab(nextTab) // Immediate UI update
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', nextTab)
    setSearchParams(nextParams, { replace: true })
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    selectTab(tabs[nextIndex].key)
  }

  // API Methods
  const handleOwnerDraftChange = (field: Exclude<keyof OwnerTripEditState, 'imageFile'>, value: string) => {
    setOwnerTripDraft((p) => ({ ...p, [field]: value }))
  }

  const resetOwnerTripDraft = () => {
    setOwnerTripDraft(createOwnerTripEditState(tripDetails))
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setOwnerTripDraft(prev => ({
        ...prev,
        imageFile: file,
        imagePreviewUrl: e.target?.result as string
      }))
    }
    reader.readAsDataURL(file)
  }

  const saveOwnerTripDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingTripDetails(true)
    try {
      const formData = new FormData()
      formData.append('id', tripDetails.id)
      formData.append('title', ownerTripDraft.title)
      formData.append('description', ownerTripDraft.description)
      formData.append('startingDate', new Date(ownerTripDraft.startingDate).toISOString())
      formData.append('endingDate', new Date(ownerTripDraft.endingDate).toISOString())
      formData.append('status', ownerTripDraft.status)
      formData.append('maxParticipants', ownerTripDraft.maxParticipants)
      ownerTripDraft.tags.forEach(t => formData.append('tags', t))
      if (ownerTripDraft.imageFile) formData.append('image', ownerTripDraft.imageFile)

      const res = await api.patch('api/trip/update-trip', formData)

      const payload = res.data
      const updatedTrip = payload && typeof payload === 'object' && 'trip' in payload ? payload.trip : payload

      if (updatedTrip && updatedTrip.id) {
        setTripDetails(updatedTrip)
      } else {
        setTripDetails(prev => ({
          ...prev,
          title: ownerTripDraft.title,
          description: ownerTripDraft.description,
          startingDate: new Date(ownerTripDraft.startingDate).toISOString(),
          endingDate: new Date(ownerTripDraft.endingDate).toISOString(),
          status: ownerTripDraft.status,
          maxParticipants: Number(ownerTripDraft.maxParticipants),
          tags: ownerTripDraft.tags,
          imageUrl: ownerTripDraft.imageFile ? ownerTripDraft.imagePreviewUrl : prev.imageUrl
        }))
      }

      setTripDetailsFeedback({ tone: 'success', message: 'Trip details updated.' })
      
      // Update cache
      updateCachedResponse(`api/trip/get-trip/${tripDetails.id}`, updatedTrip || { ...tripDetails, ...ownerTripDraft })
    } catch (err: any) {
      if (err?.queued) {
        const optimisticTrip = {
          ...tripDetails,
          title: ownerTripDraft.title,
          description: ownerTripDraft.description,
          startingDate: new Date(ownerTripDraft.startingDate).toISOString(),
          endingDate: new Date(ownerTripDraft.endingDate).toISOString(),
          status: ownerTripDraft.status,
          maxParticipants: Number(ownerTripDraft.maxParticipants),
          tags: ownerTripDraft.tags,
        }
        setTripDetails(optimisticTrip)
        updateCachedResponse(`api/trip/get-trip/${tripDetails.id}`, optimisticTrip)
        setTripDetailsFeedback({ tone: 'success', message: 'Trip updates will be synced when you are back online.' })
      } else {
        setTripDetailsFeedback({ tone: 'error', message: 'Failed to update trip.' })
      }
    } finally {
      setIsSavingTripDetails(false)
    }
  }

  const debounceSearchInviteCanditate = useDebouncedCallback(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setCandidates([])
      return
    }
    setIsSearchingInviteUser(true)
    try {
      const res = await api.post(`api/user/search-users`, { username: query })
      setCandidates(res.data)
    } catch {
      setInviteFeedback({ tone: 'error', message: 'User search failed.' })
    } finally {
      setIsSearchingInviteUser(false)
    }
  }, 400)

  const handleInviteAction = async (candidate: User) => {
    const candidateId = String(candidate.id)
    if (isInvitingUserId === candidateId) {
      return
    }

    setIsInvitingUserId(candidateId)
    try {
      await api.post('api/trip/membership-request', { userId: candidate.id, tripId: tripDetails.id, invitedBy: authenticatedUser?.id })
      setInviteFeedback({ tone: 'success', message: `Invite sent to ${candidate.username}.` })
      setMembers((prev) => [
        ...prev,
        {
          id: String(candidate.id),
          username: candidate.username,
          role: 'member',
          avatarUrl: candidate.profileUrl,
          status: 'invited',
        },
      ])
    } catch (err: any) {
      if (err?.queued) {
        setInviteFeedback({ tone: 'success', message: `Invite for ${candidate.username} will be sent when online.` })
      } else {
        setInviteFeedback({ tone: 'error', message: 'Failed to send invite.' })
      }
    } finally {
      setIsInvitingUserId(null)
    }
  }

  const handleRespondToRequest = async (member: TripMember, action: 'Accepted' | 'Declined') => {
    if (isProcessingRequestMemberId === member.id) return

    setIsProcessingRequestMemberId(member.id)
    try {
      const res = await api.patch('api/trip/membership-response', {
        tripId: tripDetails.id,
        invitedId: member.id,
        memberStatus: 'Requested',
        action: action === 'Accepted' ? 'accept' : 'decline',
      })

      if (res.status >= 200 && res.status < 300) {
        setTripDetailsFeedback({ tone: 'success', message: `${member.username} ${action === 'Accepted' ? 'added to' : 'removed from'} the trip.` })
        if (action === 'Accepted') {
          setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: 'accepted' } : m))
        } else {
          setMembers(prev => prev.filter(m => m.id !== member.id))
        }
      }
    } catch (err: any) {
      if (err?.queued) {
        const updatedMembers = action === 'Accepted' 
          ? members.map(m => m.id === member.id ? { ...m, status: 'accepted' } : m)
          : members.filter(m => m.id !== member.id)
          
        setMembers(updatedMembers)
        
        // Sync cache
        updateCachedResponse(`api/trip/get-trip/${tripDetails.id}`, { ...tripDetails, members: updatedMembers })
        
        setTripDetailsFeedback({ tone: 'success', message: `Response to ${member.username} will be processed later.` })
      } else {
        setTripDetailsFeedback({ tone: 'error', message: 'Failed to respond to request.' })
      }
    } finally {
      setIsProcessingRequestMemberId(null)
    }
  }

  const handleRequestToJoin = async () => {
    if (!authenticatedUser || isAcceptedMember || isInvitedOrRequested || isRequestingAccess) {
      return
    }


    setIsRequestingAccess(true)
    try {
      const res = await api.post('api/trip/membership-request', { userId: authenticatedUser.id, tripId: tripDetails.id, invitedBy: authenticatedUser?.id })
      if (res.status >= 200 && res.status < 300) {
        setTripDetailsFeedback({ tone: 'success', message: 'Join request sent. Waiting for approval.' })
        setMembers((prev) => [
          ...prev,
          {
            id: String(authenticatedUser.id),
            username: authenticatedUser.username,
            role: 'member',
            avatarUrl: authenticatedUser.profileUrl,
            status: 'requested',
          },
        ])
      }
    } catch (err: any) {
      if (err?.queued) {
        // Optimistic update for join request
        setMembers((prev) => [
          ...prev,
          {
            id: String(authenticatedUser.id),
            username: authenticatedUser.username,
            role: 'member',
            avatarUrl: authenticatedUser.profileUrl,
            status: 'requested',
          },
        ])
        setTripDetailsFeedback({ tone: 'success', message: 'Join request will be sent when you are back online.' })
      } else {
        setTripDetailsFeedback({ tone: 'error', message: 'Failed to request access.' })
      }
    } finally {
      setIsRequestingAccess(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    if (isUpdatingRoleMemberId === userId) {
      return
    }

    setIsUpdatingRoleMemberId(userId)
    try {
      await api.patch('api/trip/change-role', { id: userId, tripId: trip.id, role: newRole })
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))
    } catch (err: any) {
      if (err?.queued) {
        setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))
        setTripDetailsFeedback({ tone: 'success', message: 'Role change will be synced.' })
      } else {
        setTripDetailsFeedback({ tone: 'error', message: 'Failed to update role.' })
      }
    } finally {
      setIsUpdatingRoleMemberId(null)
    }
  }

  const handleRemove = async (userId: string) => {
    if (isRemovingMemberId === userId) {
      return
    }

    if (!window.confirm('Are you sure you want to remove this traveler?')) return

    setIsRemovingMemberId(userId)
    try {
      await api.delete(`api/trip/remove-member/${tripDetails.id}/${userId}`)
      setMembers(prev => prev.filter(m => m.id !== userId))
    } catch (err: any) {
      if (err?.queued) {
        setMembers(prev => prev.filter(m => m.id !== userId))
        setTripDetailsFeedback({ tone: 'success', message: 'Traveler removal will be synced.' })
      } else {
        setTripDetailsFeedback({ tone: 'error', message: 'Failed to remove member.' })
      }
    } finally {
      setIsRemovingMemberId(null)
    }
  }

  const handleRemoveTimeline = async (timelineId: number) => {
    if (isRemovingTimelineId === timelineId) {
      return
    }

    if (!window.confirm('Are you sure you want to remove this timeline stop?')) return

    setIsRemovingTimelineId(timelineId)
    try {
      const res = await api.delete(`api/trip/timeline-remove/${trip.id}/${timelineId}`)
      if (res.status === 200) {
        setTimelines((previous) => {
          const next = previous.filter((stop) => stop.id !== timelineId)

          if (next.length === 0) {
            setSelectedDay(1)
            return next
          }

          if (!next.some((stop) => stop.day === selectedDay)) {
            setSelectedDay(next[0].day)
          }

          return next
        })
      }
    }
    catch (error) {
      console.error(error)
    } finally {
      setIsRemovingTimelineId(null)
    }

  }

  const sendMessage = async (e: FormEvent) => {
    console.log(newMessage)
    e.preventDefault()
    if (!connectionRef.current || !newMessage.trim()) return
    await connectionRef.current.invoke("SendMessage", trip.id, newMessage)

    setNewMessage('')
  }

  // Renderers
  const renderOverview = () => (
    <motion.div
      key="tab-overview"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={revealTransition}
      className="trip-workspace-v2"
    >
      <div className="trip-main-content">
        <div className="day-card-v2" style={{ marginBottom: '2rem' }}>
          <h3>Trip Summary</h3>
          <p style={{ lineHeight: 1.6, color: 'var(--text-380)' }}>{tripDetails.description}</p>
        </div>

        <div className="trip-stats-bar-v2">
          <div className="trip-stat-v2">
            <label>Timeline</label>
            <span>{timelines.length} Days</span>
          </div>
          <div className="trip-stat-v2">
            <label>Group Size</label>
            <span>{acceptedMembers.length}/{tripDetails.maxParticipants} Explorers</span>
          </div>
          <div className="trip-stat-v2">
            <label>Starting</label>
            <span>{formatDisplayDate(tripDetails.startingDate)}</span>
          </div>
        </div>

        <div className="builder-section-v2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Route Preview</h3>
            {currentStop && <span className="chip chip-static">{currentStop.day} OF {timelines.length}</span>}
          </div>

          {currentStop ? (
            <div className="stop-row-v2" style={{ border: 'none' }}>
              <div className="stop-connector-v2">
                <div className="stop-dot-v2" style={{ background: 'var(--green-580)' }} />
                <div className="stop-line-v2" />
                <div className="stop-dot-v2" />
              </div>
              <div>
                <h4 style={{ color: '#f3fff1', marginBottom: '0.4rem' }}>{currentStop.startingPoint} → {currentStop.endPoint}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-380)' }}>{currentStop.note}</p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{selectedRouteDistanceKm.toFixed(1)} KM</span>
                  <span className="dot" />
                  <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{formatDisplayDate(currentStop.date)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-note">No coordinates mapped yet.</p>
          )}

          <div className="trip-overview-map" style={{ height: '300px', borderRadius: '16px', overflow: 'hidden', marginTop: '2rem' }}>
            <TripRouteMap timeline={timelines} selectedDay={selectedDay} />
          </div>
        </div>
      </div>

      <aside className="trip-sidebar-v2">
        <div className="day-card-v2">
          <h3>Your Access</h3>
          {viewerParticipationState === 'accepted' ? (
            <p className="empty-note" style={{ marginTop: '0.75rem' }}>
              You are part of this trip.
            </p>
          ) : viewerParticipationState === 'invited' ? (
            <p className="empty-note" style={{ marginTop: '0.75rem' }}>
              You have an invitation to join this trip.
            </p>
          ) : viewerParticipationState === 'requested' ? (
            <p className="empty-note" style={{ marginTop: '0.75rem' }}>
              Your join request is pending review.
            </p>
          ) : authenticatedUser ? (
            <button className="btn btn-primary" onClick={handleRequestToJoin} disabled={isRequestingAccess}>
              {isRequestingAccess ? 'Requesting...' : 'Request to join'}
            </button>
          ) : (
            <Link className="btn btn-primary" to="/login">
              Log in to request access
            </Link>
          )}
        </div>
        <div className="day-card-v2">
          <h3>Tags</h3>
          <div className="chip-row" style={{ marginTop: '1rem' }}>
            {tripDetails.tags.map(t => <span key={t} className="chip chip-static chip-sm">{t}</span>)}
          </div>
        </div>
        <img src="/newstickers/sticker2.png" alt="" style={{ width: '100%', marginTop: '2rem', opacity: 0.6 }} />
      </aside>
    </motion.div>
  )

  const renderTimeline = () => (
    <motion.div
      key="tab-timeline"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={revealTransition}
      className="trip-workspace-v2"
    >
      <div className="trip-main-content">
        <div className="timeline-flow-v2">
          {timelines.map((stop) => (
            <div key={stop.day} className="timeline-day-v2">
              <div className="day-marker-v2" />
              <div className={selectedDay === stop.day ? 'day-card-v2 is-selected' : 'day-card-v2'} onClick={() => setSelectedDay(stop.day)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p className="eyebrow">Day {stop.day}</p>
                    <h3 style={{ margin: '0.2rem 0' }}>{stop.startingPoint} → {stop.endPoint}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-380)' }}>{stop.note}</p>
                  </div>
                  {canManageTimelines && (
                    <div className="invite-actions-v2">
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/app/edit-timeline/${trip.id}/${stop.id}`)}>Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#ff6b6b' }}
                        disabled={isRemovingTimelineId === stop.id}
                        onClick={() => handleRemoveTimeline(stop.id)}
                      >
                        {isRemovingTimelineId === stop.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {canManageTimelines && (
            <button className="btn btn-primary" onClick={() => navigate(`/app/add-timeline/${trip.id}`)}>
              <FiPlusCircle /> Add Day
            </button>
          )}
        </div>
      </div>
      <div className="trip-sidebar-v2" style={{ position: 'sticky', top: '2rem' }}>
        <div className="day-card-v2" style={{ padding: 0, height: '600px', overflow: 'hidden' }}>
          <TripRouteMap timeline={timelines} selectedDay={selectedDay} />
        </div>
      </div>
    </motion.div>
  )

  const renderTripMembers = () => (
    <motion.div
      key="tab-members"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={revealTransition}
    >
      <div className="profile-section-v2" style={{ marginBottom: '2rem' }}>
        <div className="trip-members-head-v2">
          <div>
            <h3>The Trip Team</h3>
            <p>Collaborators and explorers currently in the room.</p>
          </div>
          {canInviteMembers && (
            <button className="btn btn-primary invite-btn-mobile" onClick={() => setIsInviteModalOpen(true)}>
              <FiUserPlus /> Invite Explorer
            </button>
          )}
        </div>
      </div>

      <div className="discovery-grid">
        {acceptedMembers.map((m) => (
          <div key={m.id} className="history-row-v2" style={{ background: 'rgba(9, 14, 10, 0.4)', gridTemplateColumns: '60px 1fr auto' }}>
            <img src={getAvatarUrl(m.username, m.avatarUrl)} alt="" className="avatar" style={{ width: '50px', height: '50px', borderRadius: '14px', objectFit: 'cover' }} />
            <div>
              <h4 style={{ color: '#f3fff1' }}>{m.username}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <p className="eyebrow" style={{ fontSize: '0.65rem' }}>{normalizeMemberRole(m.role)}</p>
                {canEditMemberRoles && normalizeMemberRole(m.role) !== 'owner' && (
                  <select
                    className="input-trigger"
                    style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: 'var(--green-580)' }}
                    value={normalizeMemberRole(m.role)}
                    disabled={isUpdatingRoleMemberId === m.id || isRemovingMemberId === m.id}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                )}
              </div>
            </div>
            {canRemoveMembers && normalizeMemberRole(m.role) !== 'owner' && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: '#ff6b6b' }}
                disabled={isRemovingMemberId === m.id}
                onClick={() => handleRemove(m.id)}
              >
                {isRemovingMemberId === m.id ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        ))}
      </div>

      {pendingMembers.length > 0 && (
        <div className="profile-section-v2" style={{ marginTop: '1.5rem' }}>
          <h3>Pending participants</h3>
          <div className="discovery-grid" style={{ marginTop: '1rem' }}>
            {pendingMembers.map((m) => {
              const memberRecord = m as unknown as Record<string, unknown>
              const memberStatusLabel = getTripMemberStatusLabel(
                memberRecord.status ?? memberRecord.memberStatus ?? memberRecord.member_status,
              )

              return (
                <div key={m.id} className="history-row-v2" style={{ background: 'rgba(9, 14, 10, 0.4)', gridTemplateColumns: '60px 1fr auto' }}>
                  <img src={getAvatarUrl(m.username, m.avatarUrl)} alt="" className="avatar" style={{ width: '50px', height: '50px', borderRadius: '14px', objectFit: 'cover' }} />
                  <div className="member-info-v2">
                    <h4 style={{ color: '#f3fff1' }}>{m.username}</h4>
                    <div className="member-status-row-v2">
                      <p className="eyebrow" style={{ fontSize: '0.65rem' }}>{memberStatusLabel}</p>
                      {memberStatusLabel === 'Waiting for approval' && canInviteMembers && (
                        <div className="member-actions-v2">
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={isProcessingRequestMemberId === m.id}
                            onClick={() => handleRespondToRequest(m, 'Accepted')}
                          >
                            {isProcessingRequestMemberId === m.id ? 'Processing...' : 'Accept'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={isProcessingRequestMemberId === m.id}
                            onClick={() => handleRespondToRequest(m, 'Declined')}
                            style={{ color: '#ff6b6b' }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )

  const renderChat = () => (
    <motion.div
      key="tab-chat"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={revealTransition}
      className="ai-chat-v2 trip-chat-v2"
    >
      <div className="ai-thread-v2">
        {chatMessages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <img src="/newstickers/sticker3.png" alt="" style={{ width: '120px', opacity: 0.4 }} />
            <p className="empty-note">Chat is quiet. Start the conversation.</p>
          </div>
        ) : (
          chatMessages.map(msg => (
            <div
              key={msg.id}
              className={msg.username === authenticatedUser?.username ? 'ai-bubble-v2 user' : 'ai-bubble-v2 assistant'}
            >
              <header className="bubble-header" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img
                  src={getAvatarUrl(msg.username, msg.profileUrl)}
                  alt=""
                  style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span>{msg.username}</span>
              </header>
              <p>{msg.content}</p>
              <span style={{ fontSize: '0.65rem', opacity: 0.4, float: 'right', marginTop: '0.3rem' }}>
                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
      <form className="ai-composer-v2" onSubmit={sendMessage}>
        <div className="ai-composer-input-v2">
          <input className="input" placeholder="Broadcast a signal to the team..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
          <button className="btn btn-primary" type="submit">Send</button>
        </div>
      </form>
    </motion.div>
  )

  const renderSettings = () => (
    <motion.div
      key="tab-settings"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={revealTransition}
    >
      <form className="builder-form-v2" onSubmit={saveOwnerTripDetails}>
        <div className="builder-section-v2">
          <h3>Trip Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <label className="avatar-wrapper-v2" style={{ width: '240px', height: '160px', borderRadius: '24px' }}>
              <img src={ownerTripDraft.imagePreviewUrl} alt="" className="avatar-preview-v2" />
              <div className="avatar-upload-overlay-v2">
                <FiUploadCloud size={24} />
                <span>Upload Cover</span>
              </div>
              <input type="file" className="visually-hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
            <div style={{ display: 'grid', gap: '1.5rem', flex: 1 }}>
              <div className="form-group">
                <label className="field-label">Workspace Title</label>
                <input className="input" value={ownerTripDraft.title} onChange={e => handleOwnerDraftChange('title', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="field-label">Trip Status</label>
                <select className="input" value={ownerTripDraft.status} onChange={e => handleOwnerDraftChange('status', e.target.value)}>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Started">Started</option>
                  <option value="Finished">Finished</option>
                </select>
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="field-label">Mission Briefing</label>
            <textarea className="input" rows={4} value={ownerTripDraft.description} onChange={e => handleOwnerDraftChange('description', e.target.value)} />
          </div>
        </div>

        <div className="builder-section-v2">
          <h3>Chronology & Capacity</h3>
          <div className="builder-grid-v2">
            <div className="form-group">
              <label className="field-label">Starting Sync</label>
              <input className="input" type="date" value={ownerTripDraft.startingDate} onChange={e => handleOwnerDraftChange('startingDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="field-label">Ending Sync</label>
              <input className="input" type="date" value={ownerTripDraft.endingDate} onChange={e => handleOwnerDraftChange('endingDate', e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '1.5rem', maxWidth: '300px' }}>
            <label className="field-label">Explorer Capacity</label>
            <input className="input" type="number" value={ownerTripDraft.maxParticipants} onChange={e => handleOwnerDraftChange('maxParticipants', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          {tripDetailsFeedback && (
            <span className={`info-banner ${tripDetailsFeedback.tone}`} style={{ padding: '0.4rem 0.8rem', margin: 0, fontSize: '0.85rem' }}>
              {tripDetailsFeedback.message}
            </span>
          )}
          <button className="btn btn-ghost" type="button" onClick={resetOwnerTripDraft}>Reset</button>
          <button className="btn btn-primary btn-lg" type="submit" disabled={isSavingTripDetails}>
            {isSavingTripDetails ? 'Syncing...' : 'Save Workspace'}
          </button>
        </div>
      </form>
    </motion.div>
  )

  const renderHistory = () => (
    <motion.div
      key="tab-history"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={revealTransition}
    >
      <div className="profile-section-v2" style={{ marginBottom: '2rem' }}>
        <div>
          <h3>Trip History</h3>
          <p>Chronological log of updates and milestones for this journey.</p>
        </div>
      </div>

      <div className="discovery-grid">
        {tripDetails.history && tripDetails.history.length > 0 ? (
          [...tripDetails.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((h) => (
            <div key={h.id} className="history-row-v2" style={{ background: 'rgba(9, 14, 10, 0.4)', gridTemplateColumns: '1fr auto', padding: '1.25rem' }}>
              <div>
                <p style={{ color: '#f3fff1', fontSize: '1rem', marginBottom: '0.4rem' }}>{h.content}</p>
                <p className="eyebrow" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                  {formatDisplayDate(h.date)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FiClock style={{ opacity: 0.3 }} />
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0', gridColumn: '1 / -1' }}>
            <img src="/newstickers/sticker4.png" alt="" style={{ width: '120px', opacity: 0.4 }} />
            <p className="empty-note">No history logs recorded yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  )

  return (
    <section className="page trip-page-v2 container">
      <header className="trip-hero-v2">
        <img src={tripDetails.imageUrl} alt="" className="trip-hero-img-v2" />
        <div className="trip-hero-overlay-v2">
          <div className="trip-hero-meta-v2">
            <span className="chip chip-static">{tripDetails.status}</span>
            <span className="chip chip-static">{formatDisplayDateRange(tripDetails.startingDate, tripDetails.endingDate)}</span>
            {!isAcceptedMember && viewerParticipationState !== 'visitor' && (
              <span className="chip chip-static">
                {viewerParticipationState === 'invited' ? 'Invitation pending' : 'Request pending'}
              </span>
            )}
          </div>
          <h1>{tripDetails.title}</h1>
        </div>
      </header>

      <nav className="profile-tab-bar-v2" style={{ marginBottom: '3rem' }}>
        {tabs.map((tab, idx) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'profile-tab-btn-v2 is-active' : 'profile-tab-btn-v2'}
            onClick={() => selectTab(tab.key)}
            onKeyDown={e => handleTabKeyDown(e, idx)}
          >
            <span className="tab-icon-mobile"><tab.Icon /></span>
            <span className="tab-label-desktop">{tab.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="popLayout">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'map' && renderTimeline()}
        {activeTab === 'members' && renderTripMembers()}
        {activeTab === 'chat' && renderChat()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'history' && renderHistory()}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="modal-scrim" onClick={() => setIsInviteModalOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="builder-section-v2" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-900)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h3>Invite Explorer</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setIsInviteModalOpen(false)}><FiX /></button>
              </div>
              <input className="input" placeholder="Search by username..." value={inviteUsernameQuery} onChange={e => { setInviteUsernameQuery(e.target.value); debounceSearchInviteCanditate(e.target.value); }} />
              {isSearchingInviteUser ? (
                <p className="empty-note" style={{ marginTop: '0.75rem' }}>Searching users...</p>
              ) : null}

              <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
                {candidates.map(c => (
                  <div key={c.id} className="history-row-v2" style={{ gridTemplateColumns: '40px 1fr auto', padding: '0.6rem' }}>
                    <img src={c.profileUrl || '/newstickers/sticker1.png'} alt="" style={{ width: '30px', height: '30px', borderRadius: '8px' }} />
                    <span style={{ fontSize: '0.9rem' }}>{c.username}</span>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isInvitingUserId === String(c.id)}
                      onClick={() => handleInviteAction(c)}
                    >
                      {isInvitingUserId === String(c.id) ? 'Inviting...' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
              {inviteFeedback && <p className={`info-banner ${inviteFeedback.tone}`} style={{ marginTop: '1rem' }}>{inviteFeedback.message}</p>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}

