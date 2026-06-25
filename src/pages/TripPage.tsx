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
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiActivity,
  FiExternalLink,
  FiDollarSign,
  FiDownload,
  FiCalendar
} from 'react-icons/fi'
import { SiGooglemaps, SiWaze, SiApple } from 'react-icons/si'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { TripRouteMap } from '../components/TripRouteMap'
import { ActivityType, ActivityTypeLabels } from '../types/models'
import type { ChatMessage, MemberRole, TimelineStop, Trip, TripMember, User } from '../types/models'
import * as signalR from '@microsoft/signalr'
import api, { updateCachedResponse, invalidateTripsCache } from '../data/api'
import { putTrip, getTrip } from '../utils/tripCache'
import { fetchPlacesInBBox } from '../services/placesService'
import { setCache, getCached } from '../services/placesCache'
import { prefetchAroundPoint, prefetchBounds, corridorBounds } from '../utils/mapTileCache'
import { AxiosError } from 'axios'
import { isNetworkError, isQueuedRequestError } from '../utils/errorMessage'
import {
  formatDisplayDate,
  formatDisplayDateRange,
  toLocalStartOfDay,
} from '../utils/dateDisplay'
import { useDebouncedCallback } from 'use-debounce'
import { getAvatarUrl } from '../utils/userUtils'
import { registerChatModerationEvents } from '../hooks/useChatModerationEvents'
import { TabBar } from '../components/shared/TabBar'

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

type TripWorkspaceTab = 'overview' | 'map' | 'members' | 'chat' | 'settings' | 'history'

interface TripTabItem {
  key: TripWorkspaceTab
  label: string
  Icon: React.ComponentType<{ className?: string; size?: number }>
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

const tabContentTransition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
}

interface TimelineStopCardProps {
  stop: TimelineStop
  isSelected: boolean
  onSelect: () => void
  canManage: boolean
  onEdit: () => void
  onRemove: () => void
  isRemoving: boolean
}

function TimelineStopCard({ stop, isSelected, onSelect, canManage, onEdit, onRemove, isRemoving }: TimelineStopCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <TimelineDay>
      <DayMarker />
      <DayCardWrapper $selected={isSelected} onClick={onSelect}>
        <TimelineCardInner>
          <TimelineCardBody>
            <Eyebrow>Day {stop.startDay}{stop.startDay !== stop.endDay ? ` - ${stop.endDay}` : ''}</Eyebrow>
            <TimelineCardTitle>{stop.startingPoint} → {stop.endPoint}</TimelineCardTitle>
            <TimelineCardNote $hasActivities={!!(stop.activities && stop.activities.length > 0)}>{stop.note}</TimelineCardNote>

            <ActivitiesDropdown>
              {(stop.activities && stop.activities.length > 0) ? (
                <>
                  <ActivitiesToggle
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                  >
                    <FiActivity size={14} color="#8fb36a" />
                    {stop.activities.length} Activities
                    {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                  </ActivitiesToggle>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <ActivitiesList>
                          {stop.activities.map((activity, idx) => (
                            <ActivityCard key={idx}>
                              <ActivityCardHeader>
                                <ActivityCardTitle>{activity.name}</ActivityCardTitle>
                                <StaticChipSmall>
                                  {typeof activity.type === 'number' ? ActivityTypeLabels[activity.type as ActivityType] : activity.type}
                                </StaticChipSmall>
                              </ActivityCardHeader>
                              {activity.description && (
                                <ActivityCardDesc>{activity.description}</ActivityCardDesc>
                              )}
                              <ActivityCardMeta>
                                {activity.cost !== undefined && activity.cost !== null && activity.cost > 0 && (
                                  <ActivityCost>
                                    <FiDollarSign size={12} /> {activity.cost}
                                  </ActivityCost>
                                )}
                                {activity.link && (
                                  <ActivityLink
                                    href={activity.link.startsWith('http') ? activity.link : `https://${activity.link}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <FiExternalLink size={12} /> View Details
                                  </ActivityLink>
                                )}
                              </ActivityCardMeta>
                            </ActivityCard>
                          ))}
                        </ActivitiesList>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : canManage && (
                <NoActivities>
                  <FiActivity size={12} opacity={0.5} />
                  No activities planned for this stop.
                </NoActivities>
              )}
            </ActivitiesDropdown>
          </TimelineCardBody>
          {canManage && (
            <InviteActions onClick={e => e.stopPropagation()}>
              <GhostButtonSm onClick={onEdit}>Edit</GhostButtonSm>
              <GhostButtonSm
                style={{ color: '#db4a5b' }}
                disabled={isRemoving}
                onClick={onRemove}
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </GhostButtonSm>
            </InviteActions>
          )}
        </TimelineCardInner>
      </DayCardWrapper>
    </TimelineDay>
  )
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
        putTrip(nextTrip)
      } catch (err: unknown) {
        if (!isMounted) {
          return
        }

        const networkError = isNetworkError(err)
        if (!navigator.onLine || networkError) {
          try {
            const cachedTrip = await getTrip(tripId)
            if (cachedTrip && isMounted) {
              console.log('[TripCache] Serving full trip from IndexedDB cache.')
              setTrip(cachedTrip)
              setFetchState('ready')
              return
            }
          } catch (cacheErr) {
            console.warn('[TripCache] Failed to read from IndexedDB:', cacheErr)
          }

          try {
            const allRes = await api.get('api/trip/get-all-trips')
            const allTrips: Trip[] = allRes.data
            const foundTrip = allTrips.find(t => String(t.id) === String(tripId))

            if (foundTrip && isMounted) {
              console.log('[TripCache] Serving trip summary from all-trips cache.')
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
      <PageSection>
        <EmptyStateWrapper>
          <EmptySticker src="/newstickers/sticker5.png" alt="" />
          <EmptyTitle>Trip not found</EmptyTitle>
          <EmptyDesc>This trip room has been archived or the coordinates are invalid.</EmptyDesc>
          <PrimaryLink to="/app/discover">Back to discovery</PrimaryLink>
        </EmptyStateWrapper>
      </PageSection>
    )
  }

  if (fetchState === 'loading') {
    return (
      <PageSection>
        <EmptyStateWrapper>
          <EmptyTitle>Loading your trip...</EmptyTitle>
          <EmptyDesc>We're getting everything ready for your next adventure.</EmptyDesc>
        </EmptyStateWrapper>
      </PageSection>
    )
  }

  if (fetchState === 'error') {
    return (
      <PageSection>
        <EmptyStateWrapper>
          <EmptySticker src="/newstickers/sticker6.png" alt="" />
          <EmptyTitle>Communication error</EmptyTitle>
          <EmptyDesc>We lost contact with the server. Check your signal and try again.</EmptyDesc>
          <PrimaryLink to="/app/discover">Back to discovery</PrimaryLink>
        </EmptyStateWrapper>
      </PageSection>
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
    return requestedTab && ownerTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as TripWorkspaceTab)
      : 'overview'
  })

  useEffect(() => {
    const requestedTab = searchParams.get('view')
    const nextTab = requestedTab && ownerTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as TripWorkspaceTab)
      : 'overview'
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    () => [...trip.timelines].sort((a, b) => a.startDay - b.startDay),
  )
  const [selectedDay, setSelectedDay] = useState(
    defaultSelectedDay(trip.startingDate, trip.timelines.length),
  )
  const [members, setMembers] = useState<TripMember[]>(trip.members)

  useEffect(() => {
    setMembers(trip.members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    registerChatModerationEvents(connection, setChatMessages, (payload) => {
      setTripDetailsFeedback({
        tone: 'error',
        message: payload.message ?? 'Your message was removed because it was flagged as inappropriate.',
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

  useEffect(() => {
    if (!timelines.length || !navigator.onLine) return

    const ATTRACTION_KINDS = 'interesting_places,foods,amusements,sport,accomodations,tourist_facilities'
    const BBOX_HALF = 0.05

    const prefetchAll = async () => {
      for (const stop of timelines) {
        try {
          const coordStr = `${stop.fromCoords[1]},${stop.fromCoords[0]};${stop.toCoords[1]},${stop.toCoords[0]}`
          await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`)

          await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`)

          const [destLat, destLon] = stop.toCoords
          const lonMin = Number((destLon - BBOX_HALF).toFixed(4))
          const latMin = Number((destLat - BBOX_HALF).toFixed(4))
          const lonMax = Number((destLon + BBOX_HALF).toFixed(4))
          const latMax = Number((destLat + BBOX_HALF).toFixed(4))
          const bboxKey = `${lonMin},${latMin},${lonMax},${latMax}_${ATTRACTION_KINDS}`

          const already = await getCached(bboxKey)
          if (!already) {
            const places = await fetchPlacesInBBox(lonMin, latMin, lonMax, latMax, ATTRACTION_KINDS)
            if (places.length > 0) {
              await setCache(bboxKey, places)
            }
          }

          await prefetchAroundPoint(
            stop.toCoords[1],
            stop.toCoords[0],
            BBOX_HALF,
            12,
            16,
          )

          const corridor = corridorBounds(
            stop.fromCoords[1],
            stop.fromCoords[0],
            stop.toCoords[1],
            stop.toCoords[0],
            BBOX_HALF,
          )
          await prefetchBounds(corridor, 12, 14)
        } catch { void 0 }
      }
    }
    prefetchAll()
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
    timelines.find((timelineStop) => timelineStop.startDay === selectedDay) ??
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

  const tabItems = tabs.map(t => ({
    key: t.key,
    label: t.label,
    icon: <t.Icon size={16} />,
  }))

  const selectTab = (nextTab: string) => {
    setActiveTab(nextTab as TripWorkspaceTab)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', nextTab)
    setSearchParams(nextParams, { replace: true })

    if (nextTab === 'map') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }
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

  const openExternalMap = (type: 'google' | 'waze' | 'apple') => {
    if (!currentStop) return;
    const [lat, lon] = currentStop.toCoords;
    let url = '';
    if (type === 'google') url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    if (type === 'waze') url = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    if (type === 'apple') url = `http://maps.apple.com/?daddr=${lat},${lon}`;
    window.open(url, '_blank');
  };

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

      const finalTrip = updatedTrip || { ...tripDetails, ...ownerTripDraft }
      updateCachedResponse(`api/trip/get-trip/${tripDetails.id}`, finalTrip)
      putTrip({ ...tripDetails, ...finalTrip })
      invalidateTripsCache()
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
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
        putTrip(optimisticTrip)
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
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
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
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        const updatedMembers = action === 'Accepted'
          ? members.map(m => m.id === member.id ? { ...m, status: 'accepted' } : m)
          : members.filter(m => m.id !== member.id)

        setMembers(updatedMembers)

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
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
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
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
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
    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
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

          if (!next.some((stop) => stop.startDay === selectedDay)) {
            setSelectedDay(next[0].startDay)
          }

          putTrip({ ...tripDetails, timelines: next, members })

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

  const [isExportingCosts, setIsExportingCosts] = useState(false)

  const handleExportCosts = async () => {
    if (isExportingCosts) return
    setIsExportingCosts(true)
    try {
      const res = await api.get(`api/trip/export-costs/${trip.id}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `TripCosts_${trip.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setTripDetailsFeedback({ tone: 'error', message: 'Failed to export costs PDF.' })
    } finally {
      setIsExportingCosts(false)
    }
  }

  const exportToGoogleCalendar = () => {
    const format = (date: string) =>
      new Date(date).toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, 8)

    const details = timelines
      .map(tl =>
        `📍 ${tl.startingPoint} → ${tl.endPoint}` +
        (tl.activities && tl.activities.length > 0
          ? '\n' + tl.activities.map(a => `  • ${a.name}${a.cost ? ` (${a.cost} RON)` : ''}`).join('\n')
          : '')
      )
      .join('\n\n')

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: tripDetails.title,
      dates: `${format(tripDetails.startingDate)}/${format(tripDetails.endingDate)}`,
      details: details,
      location: timelines[0]?.startingPoint ?? '',
    })

    window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank')
  }

  const renderOverview = () => (
    <motion.div
      key="tab-overview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tabContentTransition}
    >
      <TripWorkspace>
        <TripMainContent>
          <DayCard style={{ marginBottom: '2rem' }}>
            <CardSectionTitle>Trip Summary</CardSectionTitle>
            <SummaryDesc>{tripDetails.description}</SummaryDesc>
          </DayCard>

          <TripStatsBar>
            <TripStat>
              <StatLabel>Timeline</StatLabel>
              <StatValue>{timelines.length} Days</StatValue>
            </TripStat>
            <TripStat>
              <StatLabel>Group Size</StatLabel>
              <StatValue>{acceptedMembers.length}/{tripDetails.maxParticipants} Explorers</StatValue>
            </TripStat>
            <TripStat>
              <StatLabel>Starting</StatLabel>
              <StatValue>{formatDisplayDate(tripDetails.startingDate)}</StatValue>
            </TripStat>
          </TripStatsBar>

          <BuilderSection>
            <BuilderSectionHeader>
              <CardSectionTitle>Route Preview</CardSectionTitle>
              {currentStop && <StaticChip>{currentStop.startDay}{currentStop.startDay !== currentStop.endDay ? `-${currentStop.endDay}` : ''} OF {timelines.length}</StaticChip>}
            </BuilderSectionHeader>

            {currentStop ? (
              <StopRow>
                <StopConnector>
                  <StopDotFirst />
                  <StopLine />
                  <StopDot />
                </StopConnector>
                <div>
                  <StopTitle>{currentStop.startingPoint} → {currentStop.endPoint}</StopTitle>
                  <StopNote>{currentStop.note}</StopNote>
                  <StopMeta>
                    <StopMetaLabel>{selectedRouteDistanceKm.toFixed(1)} KM</StopMetaLabel>
                    <DotDivider />
                    <StopMetaLabel>{formatDisplayDate(currentStop.date)}</StopMetaLabel>
                  </StopMeta>
                </div>
              </StopRow>
            ) : (
              <EmptyNote>No coordinates mapped yet.</EmptyNote>
            )}

            <OverviewMapContainer>
              <TripRouteMap timeline={timelines} selectedDay={selectedDay} showOverlay={false} />
            </OverviewMapContainer>

            {currentStop && (
              <ExternalMapRow>
                <ExternalMapButton onClick={() => openExternalMap('google')}>
                  <SiGooglemaps size={18} style={{ color: '#4285F4' }} /> Google Maps
                </ExternalMapButton>
                <ExternalMapButton onClick={() => openExternalMap('waze')}>
                  <SiWaze size={18} style={{ color: '#33CCFF' }} /> Waze
                </ExternalMapButton>
                <ExternalMapButton onClick={() => openExternalMap('apple')}>
                  <SiApple size={18} style={{ color: '#FFFFFF' }} /> Apple Maps
                </ExternalMapButton>
              </ExternalMapRow>
            )}
          </BuilderSection>
        </TripMainContent>

        <TripSidebar>
          <DayCard>
            <CardSectionTitle>Your Access</CardSectionTitle>
            {viewerParticipationState === 'accepted' ? (
              <EmptyNote style={{ marginTop: '0.75rem' }}>
                You are part of this trip.
              </EmptyNote>
            ) : viewerParticipationState === 'invited' ? (
              <EmptyNote style={{ marginTop: '0.75rem' }}>
                You have an invitation to join this trip.
              </EmptyNote>
            ) : viewerParticipationState === 'requested' ? (
              <EmptyNote style={{ marginTop: '0.75rem' }}>
                Your join request is pending review.
              </EmptyNote>
            ) : authenticatedUser ? (
              <PrimaryButton onClick={handleRequestToJoin} disabled={isRequestingAccess}>
                {isRequestingAccess ? 'Requesting...' : 'Request to join'}
              </PrimaryButton>
            ) : (
              <PrimaryLink to="/login">
                Log in to request access
              </PrimaryLink>
            )}
          </DayCard>
          <DayCard>
            <CardSectionTitle>Tags</CardSectionTitle>
            <ChipRow>
              {tripDetails.tags.map(t => <StaticChipSmall key={t}>{t}</StaticChipSmall>)}
            </ChipRow>
          </DayCard>
          <SidebarSticker src="/newstickers/sticker2.png" alt="" />
        </TripSidebar>
      </TripWorkspace>
    </motion.div>
  )

  const renderTimeline = () => (
    <motion.div
      key="tab-timeline"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tabContentTransition}
    >
      <TripWorkspace>
        <TripMainContent>

          <ExportStrip>
            <ExportStripLabel>Export</ExportStripLabel>
            <ExportButton
              onClick={handleExportCosts}
              disabled={isExportingCosts}
              title="Download a PDF report of all activity costs"
            >
              {isExportingCosts ? (
                <InlineSpinner />
              ) : (
                <FiDownload size={15} />
              )}
              {isExportingCosts ? 'Exporting...' : 'Export Costs (PDF)'}
            </ExportButton>
            <ExportButton
              onClick={exportToGoogleCalendar}
              title="Add this trip to Google Calendar"
            >
              <FiCalendar size={15} style={{ color: '#4285F4' }} />
              Add to Google Calendar
            </ExportButton>
          </ExportStrip>

          <TimelineFlow>
            {timelines.map((stop) => (
              <TimelineStopCard
                key={stop.id}
                stop={stop}
                isSelected={selectedDay === stop.startDay}
                onSelect={() => setSelectedDay(stop.startDay)}
                canManage={canManageTimelines}
                onEdit={() => navigate(`/app/edit-timeline/${trip.id}/${stop.id}`)}
                onRemove={() => handleRemoveTimeline(stop.id)}
                isRemoving={isRemovingTimelineId === stop.id}
              />
            ))}
            {canManageTimelines && (
              <PrimaryButton onClick={() => navigate(`/app/add-timeline/${trip.id}`)}>
                <FiPlusCircle /> Add Day
              </PrimaryButton>
            )}
          </TimelineFlow>
        </TripMainContent>
        <TripSidebarSticky>
          <DayCard style={{ padding: 0, height: '600px', overflow: 'hidden' }}>
            <TripRouteMap timeline={timelines} selectedDay={selectedDay} />
          </DayCard>
        </TripSidebarSticky>
      </TripWorkspace>
    </motion.div>
  )

  const renderTripMembers = () => (
    <motion.div
      key="tab-members"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tabContentTransition}
    >
      <ProfileSection>
        <MembersHead>
          <div>
            <CardSectionTitle>The Trip Team</CardSectionTitle>
            <SectionDesc>Collaborators and explorers currently in the room.</SectionDesc>
          </div>
          {canInviteMembers && (
            <PrimaryButton onClick={() => setIsInviteModalOpen(true)}>
              <FiUserPlus /> Invite Explorer
            </PrimaryButton>
          )}
        </MembersHead>
      </ProfileSection>

      <DiscoveryGrid>
        {acceptedMembers.map((m) => (
          <HistoryRow key={m.id}>
            <MemberAvatar src={getAvatarUrl(m.username, m.avatarUrl)} alt="" />
            <div>
              <MemberName>{m.username}</MemberName>
              <MemberRoleRow>
                <Eyebrow style={{ fontSize: '0.65rem' }}>{normalizeMemberRole(m.role)}</Eyebrow>
                {canEditMemberRoles && normalizeMemberRole(m.role) !== 'owner' && (
                  <RoleSelect
                    value={normalizeMemberRole(m.role)}
                    disabled={isUpdatingRoleMemberId === m.id || isRemovingMemberId === m.id}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </RoleSelect>
                )}
              </MemberRoleRow>
            </div>
            {canRemoveMembers && normalizeMemberRole(m.role) !== 'owner' && (
              <RemoveButton
                disabled={isRemovingMemberId === m.id}
                onClick={() => handleRemove(m.id)}
              >
                {isRemovingMemberId === m.id ? 'Removing...' : 'Remove'}
              </RemoveButton>
            )}
          </HistoryRow>
        ))}
      </DiscoveryGrid>

      {pendingMembers.length > 0 && (
        <ProfileSection style={{ marginTop: '1.5rem' }}>
          <CardSectionTitle>Pending participants</CardSectionTitle>
          <DiscoveryGrid style={{ marginTop: '1rem' }}>
            {pendingMembers.map((m) => {
              const memberRecord = m as unknown as Record<string, unknown>
              const memberStatusLabel = getTripMemberStatusLabel(
                memberRecord.status ?? memberRecord.memberStatus ?? memberRecord.member_status,
              )

              return (
                <HistoryRow key={m.id}>
                  <MemberAvatar src={getAvatarUrl(m.username, m.avatarUrl)} alt="" />
                  <MemberInfo>
                    <MemberName>{m.username}</MemberName>
                    <MemberStatusRow>
                      <Eyebrow style={{ fontSize: '0.65rem' }}>{memberStatusLabel}</Eyebrow>
                      {memberStatusLabel === 'Waiting for approval' && canInviteMembers && (
                        <MemberActions>
                          <PrimaryButtonSm
                            disabled={isProcessingRequestMemberId === m.id}
                            onClick={() => handleRespondToRequest(m, 'Accepted')}
                          >
                            {isProcessingRequestMemberId === m.id ? 'Processing...' : 'Accept'}
                          </PrimaryButtonSm>
                          <DeclineButton
                            disabled={isProcessingRequestMemberId === m.id}
                            onClick={() => handleRespondToRequest(m, 'Declined')}
                          >
                            Decline
                          </DeclineButton>
                        </MemberActions>
                      )}
                    </MemberStatusRow>
                  </MemberInfo>
                </HistoryRow>
              )
            })}
          </DiscoveryGrid>
        </ProfileSection>
      )}
    </motion.div>
  )

  const renderChat = () => (
    <motion.div
      key="tab-chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tabContentTransition}
    >
      <ChatContainer>
        <ChatThread>
          {chatMessages.length === 0 ? (
            <ChatEmpty>
              <ChatEmptySticker src="/newstickers/sticker3.png" alt="" />
              <EmptyNote>Chat is quiet. Start the conversation.</EmptyNote>
            </ChatEmpty>
          ) : (
            chatMessages.map(msg => (
              <ChatBubble key={msg.id} $isOwn={msg.username === authenticatedUser?.username}>
                <ChatBubbleHeader>
                  <ChatAvatar
                    src={getAvatarUrl(msg.username, msg.profileUrl)}
                    alt=""
                  />
                  <span>{msg.username}</span>
                </ChatBubbleHeader>
                <p>{msg.content}</p>
                <ChatTime>
                  {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </ChatTime>
              </ChatBubble>
            ))
          )}
        </ChatThread>
        <ChatComposer onSubmit={sendMessage}>
          <ChatComposerRow>
            <ChatInput placeholder="Broadcast a signal to the team..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
            <PrimaryButton type="submit">Send</PrimaryButton>
          </ChatComposerRow>
        </ChatComposer>
      </ChatContainer>
    </motion.div>
  )

  const renderSettings = () => (
    <motion.div
      key="tab-settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tabContentTransition}
    >
      <BuilderForm onSubmit={saveOwnerTripDetails}>
        <BuilderSection>
          <CardSectionTitle>Trip Info</CardSectionTitle>
          <SettingsInfoGrid>
            <AvatarUploadWrapper>
              <AvatarPreview src={ownerTripDraft.imagePreviewUrl} alt="" />
              <AvatarUploadOverlay>
                <FiUploadCloud size={24} />
                <span>Upload Cover</span>
              </AvatarUploadOverlay>
              <HiddenInput type="file" accept="image/*" onChange={handleImageUpload} />
            </AvatarUploadWrapper>
            <SettingsFieldsColumn>
              <FormGroup>
                <FieldLabel>Workspace Title</FieldLabel>
                <TextInput value={ownerTripDraft.title} onChange={e => handleOwnerDraftChange('title', e.target.value)} />
              </FormGroup>
              <FormGroup>
                <FieldLabel>Trip Status</FieldLabel>
                <StyledSelect value={ownerTripDraft.status} onChange={e => handleOwnerDraftChange('status', e.target.value)}>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Started">Started</option>
                  <option value="Finished">Finished</option>
                </StyledSelect>
              </FormGroup>
            </SettingsFieldsColumn>
          </SettingsInfoGrid>
          <FormGroup style={{ marginTop: '1.5rem' }}>
            <FieldLabel>Mission Briefing</FieldLabel>
            <TextArea rows={4} value={ownerTripDraft.description} onChange={e => handleOwnerDraftChange('description', e.target.value)} />
          </FormGroup>
        </BuilderSection>

        <BuilderSection>
          <CardSectionTitle>Chronology & Capacity</CardSectionTitle>
          <BuilderGrid>
            <FormGroup>
              <FieldLabel>Starting Sync</FieldLabel>
              <TextInput type="date" value={ownerTripDraft.startingDate} onChange={e => handleOwnerDraftChange('startingDate', e.target.value)} />
            </FormGroup>
            <FormGroup>
              <FieldLabel>Ending Sync</FieldLabel>
              <TextInput type="date" value={ownerTripDraft.endingDate} onChange={e => handleOwnerDraftChange('endingDate', e.target.value)} />
            </FormGroup>
          </BuilderGrid>
          <FormGroup style={{ marginTop: '1.5rem', maxWidth: '300px' }}>
            <FieldLabel>Explorer Capacity</FieldLabel>
            <TextInput type="number" value={ownerTripDraft.maxParticipants} onChange={e => handleOwnerDraftChange('maxParticipants', e.target.value)} />
          </FormGroup>
        </BuilderSection>

        <SettingsActions>
          {tripDetailsFeedback && (
            <InfoBanner $tone={tripDetailsFeedback.tone}>
              {tripDetailsFeedback.message}
            </InfoBanner>
          )}
          <GhostButton type="button" onClick={resetOwnerTripDraft}>Reset</GhostButton>
          <PrimaryButtonLg type="submit" disabled={isSavingTripDetails}>
            {isSavingTripDetails ? 'Syncing...' : 'Save Workspace'}
          </PrimaryButtonLg>
        </SettingsActions>
      </BuilderForm>
    </motion.div>
  )

  const renderHistory = () => (
    <motion.div
      key="tab-history"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tabContentTransition}
    >
      <ProfileSection style={{ marginBottom: '2rem' }}>
        <div>
          <CardSectionTitle>Trip History</CardSectionTitle>
          <SectionDesc>Chronological log of updates and milestones for this journey.</SectionDesc>
        </div>
      </ProfileSection>

      <DiscoveryGrid>
        {tripDetails.history && tripDetails.history.length > 0 ? (
          [...tripDetails.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((h) => (
            <HistoryRowWide key={h.id}>
              <div>
                <HistoryContent>{h.content}</HistoryContent>
                <HistoryDate>{formatDisplayDate(h.date)}</HistoryDate>
              </div>
              <HistoryIcon>
                <FiClock style={{ opacity: 0.3 }} />
              </HistoryIcon>
            </HistoryRowWide>
          ))
        ) : (
          <HistoryEmpty>
            <ChatEmptySticker src="/newstickers/sticker4.png" alt="" />
            <EmptyNote>No history logs recorded yet.</EmptyNote>
          </HistoryEmpty>
        )}
      </DiscoveryGrid>
    </motion.div>
  )

  return (
    <PageSection>
      <TripHero>
        <TripHeroImg src={tripDetails.imageUrl} alt="" />
        <TripHeroOverlay>
          <TripHeroMeta>
            <StaticChip>{tripDetails.status}</StaticChip>
            <StaticChip>{formatDisplayDateRange(tripDetails.startingDate, tripDetails.endingDate)}</StaticChip>
            {!isAcceptedMember && viewerParticipationState !== 'visitor' && (
              <StaticChip>
                {viewerParticipationState === 'invited' ? 'Invitation pending' : 'Request pending'}
              </StaticChip>
            )}
          </TripHeroMeta>
          <TripHeroTitle>{tripDetails.title}</TripHeroTitle>
        </TripHeroOverlay>
      </TripHero>

      <TabBarWrapper onKeyDown={e => {
        const currentIndex = tabs.findIndex(t => t.key === activeTab)
        handleTabKeyDown(e as unknown as KeyboardEvent<HTMLButtonElement>, currentIndex)
      }}>
        <TabBar
          tabs={tabItems}
          activeTab={activeTab}
          onChange={selectTab}
          variant="pill"
        />
      </TabBarWrapper>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'map' && renderTimeline()}
      {activeTab === 'members' && renderTripMembers()}
      {activeTab === 'chat' && renderChat()}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'history' && renderHistory()}

      <AnimatePresence>
        {isInviteModalOpen && (
          <ModalScrim onClick={() => setIsInviteModalOpen(false)}>
            <InviteModal onClick={e => e.stopPropagation()}>
              <InviteModalHeader>
                <CardSectionTitle>Invite Explorer</CardSectionTitle>
                <GhostButtonSm onClick={() => setIsInviteModalOpen(false)}><FiX /></GhostButtonSm>
              </InviteModalHeader>
              <TextInput placeholder="Search by username..." value={inviteUsernameQuery} onChange={e => { setInviteUsernameQuery(e.target.value); debounceSearchInviteCanditate(e.target.value); }} />
              {isSearchingInviteUser ? (
                <EmptyNote style={{ marginTop: '0.75rem' }}>Searching users...</EmptyNote>
              ) : null}

              <CandidateList>
                {candidates.map(c => (
                  <CandidateRow key={c.id}>
                    <CandidateAvatar src={c.profileUrl || '/newstickers/sticker1.png'} alt="" />
                    <CandidateName>{c.username}</CandidateName>
                    <PrimaryButtonSm
                      disabled={isInvitingUserId === String(c.id)}
                      onClick={() => handleInviteAction(c)}
                    >
                      {isInvitingUserId === String(c.id) ? 'Inviting...' : 'Invite'}
                    </PrimaryButtonSm>
                  </CandidateRow>
                ))}
              </CandidateList>
              {inviteFeedback && <InfoBanner $tone={inviteFeedback.tone} style={{ marginTop: '1rem' }}>{inviteFeedback.message}</InfoBanner>}
            </InviteModal>
          </ModalScrim>
        )}
      </AnimatePresence>
    </PageSection>
  )
}

const PageSection = styled.section`
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1200px, 100% - 1rem);
    padding-bottom: 7rem;
  }
`

const EmptyStateWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.lg};
`

const EmptySticker = styled.img`
  width: 160px;
  height: auto;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  opacity: 0.85;
`

const EmptyTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
`

const EmptyDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.lead};
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 440px;
`

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 700;
  text-decoration: none;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
`

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 700;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const PrimaryButtonSm = styled(PrimaryButton)`
  padding: 0.35rem 0.9rem;
  font-size: 0.75rem;
`

const PrimaryButtonLg = styled(PrimaryButton)`
  padding: 0.8rem 2rem;
  font-size: ${({ theme }) => theme.typography.body};
`

const GhostButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 500;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[380]};
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text[220]};
    background: rgba(247, 243, 232, 0.05);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const GhostButtonSm = styled(GhostButton)`
  padding: 0.3rem 0.7rem;
  font-size: 0.75rem;
`

const DeclineButton = styled(GhostButtonSm)`
  color: ${({ theme }) => theme.colors.danger[500]};
`

const RemoveButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: transparent;
  color: ${({ theme }) => theme.colors.danger[500]};
  border: none;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radii.sm};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(219, 74, 91, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const TripHero = styled.header`
  position: relative;
  width: 100%;
  height: 340px;
  border-radius: ${({ theme }) => theme.radii.xl};
  overflow: hidden;
  margin-bottom: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    height: 220px;
    border-radius: ${({ theme }) => theme.radii.lg};
  }
`

const TripHeroImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const TripHeroOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(13, 15, 13, 0.2) 0%, rgba(13, 15, 13, 0.85) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`

const TripHeroMeta = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
`

const TripHeroTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0;
`

const StaticChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.green[700]};
  color: ${({ theme }) => theme.colors.green[300]};
  white-space: nowrap;
`

const StaticChipSmall = styled(StaticChip)`
  font-size: 0.65rem;
  padding: 0.15rem 0.5rem;
  background: ${({ theme }) => theme.colors.surface[860]};
  color: ${({ theme }) => theme.colors.text[380]};
`

const TabBarWrapper = styled.nav`
  width: 100%;
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    position: sticky;
    top: 0;
    z-index: 30;
    width: 100vw;
    max-width: 100vw;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.sm}
      max(0.5rem, env(safe-area-inset-right, 0px))
      ${({ theme }) => theme.spacing.sm}
      max(0.5rem, env(safe-area-inset-left, 0px));
    box-sizing: border-box;
    background: ${({ theme }) => theme.colors.bg[980]};
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  }
`

const TripWorkspace = styled.div`
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: ${({ theme }) => theme.spacing.xl};
  align-items: start;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.lg};
  }
`

const TripMainContent = styled.div`
  min-width: 0;
`

const TripSidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`

const TripSidebarSticky = styled(TripSidebar)`
  position: sticky;
  top: 2rem;
`

const DayCard = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
`

const DayCardWrapper = styled.div<{ $selected: boolean }>`
  background: ${({ theme, $selected }) => $selected ? 'rgba(26, 96, 19, 0.2)' : theme.glass.bg};
  border: 1px solid ${({ theme, $selected }) => $selected ? theme.colors.green[580] : theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
  }
`

const CardSectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0 0 0.75rem;
`

const SummaryDesc = styled.p`
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0;
`

const TripStatsBar = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const TripStat = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`

const StatValue = styled.span`
  font-size: ${({ theme }) => theme.typography.body};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[100]};
`

const BuilderSection = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const BuilderSectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h3 {
    margin: 0;
  }
`

const StopRow = styled.div`
  display: flex;
  gap: 1.25rem;
`

const StopConnector = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
`

const StopDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.text[500]};
  flex-shrink: 0;
`

const StopDotFirst = styled(StopDot)`
  background: ${({ theme }) => theme.colors.green[580]};
`

const StopLine = styled.div`
  width: 2px;
  flex: 1;
  min-height: 24px;
  background: ${({ theme }) => theme.colors.lineSoft};
`

const StopTitle = styled.h4`
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0 0 0.4rem;
  font-size: ${({ theme }) => theme.typography.body};
  font-weight: 600;
`

const StopNote = styled.p`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0;
`

const StopMeta = styled.div`
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  align-items: center;
`

const StopMetaLabel = styled.span`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text[500]};
`

const DotDivider = styled.span`
  width: 4px;
  height: 4px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.text[500]};
`

const OverviewMapContainer = styled.div`
  height: 300px;
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
  margin-top: 2rem;
  position: relative;
`

const ExternalMapRow = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`

const ExternalMapButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  background: ${({ theme }) => theme.colors.surface[860]};
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.surface[820]};
  border-radius: 12px;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.surface[820]};
    border-color: ${({ theme }) => theme.colors.line};
  }
`

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`

const SidebarSticker = styled.img`
  width: 100%;
  margin-top: 2rem;
  opacity: 0.6;
`

const EmptyNote = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[500]};
  text-align: center;
  padding: 1rem 0;
`

const SectionDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0;
`

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 0.25rem;
`

const TimelineFlow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const TimelineDay = styled.div`
  display: flex;
  gap: 1rem;
  align-items: stretch;
`

const DayMarker = styled.div`
  width: 3px;
  flex-shrink: 0;
  background: linear-gradient(180deg, ${({ theme }) => theme.colors.green[580]} 0%, transparent 100%);
  border-radius: 2px;
`

const TimelineCardInner = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`

const TimelineCardBody = styled.div`
  flex: 1;
`

const TimelineCardTitle = styled.h3`
  margin: 0.2rem 0;
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[100]};
`

const TimelineCardNote = styled.p<{ $hasActivities: boolean }>`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0 0 ${({ $hasActivities }) => $hasActivities ? '1rem' : 0};
`

const ActivitiesDropdown = styled.div`
  margin-top: 0.8rem;
`

const ActivitiesToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`

const ActivitiesList = styled.div`
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
`

const ActivityCard = styled.div`
  padding: 0.75rem;
  background: ${({ theme }) => theme.colors.bg[980]};
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const ActivityCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
`

const ActivityCardTitle = styled.h4`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text[100]};
  font-weight: 600;
  margin: 0;
`

const ActivityCardDesc = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0 0 0.5rem;
  line-height: 1.4;
`

const ActivityCardMeta = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`

const ActivityCost = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.green[500]};
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
`

const ActivityLink = styled.a`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.green[400]};
  display: flex;
  align-items: center;
  gap: 0.25rem;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.green[300]};
  }
`

const NoActivities = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.text[500]};
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`

const InviteActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
  margin-left: 1rem;
`

const ExportStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(140deg, rgba(17, 34, 26, 0.7), rgba(9, 18, 13, 0.6));
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.md};
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const ExportStripLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text[380]};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-right: auto;
`

const ExportButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(247, 243, 232, 0.05);
    border-color: ${({ theme }) => theme.colors.line};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const InlineSpinner = styled.span`
  width: 15px;
  height: 15px;
  border: 2px solid rgba(247, 243, 232, 0.2);
  border-top-color: ${({ theme }) => theme.colors.green[500]};
  border-radius: ${({ theme }) => theme.radii.full};
  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const ProfileSection = styled.div`
  margin-bottom: 2rem;
`

const MembersHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`

const DiscoveryGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const HistoryRow = styled.div`
  display: grid;
  grid-template-columns: 60px 1fr auto;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: center;
  padding: 1rem ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.surface[860]};
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const HistoryRowWide = styled(HistoryRow)`
  grid-template-columns: 1fr auto;
  padding: 1.25rem;
`

const MemberAvatar = styled.img`
  width: 50px;
  height: 50px;
  border-radius: 14px;
  object-fit: cover;
`

const MemberName = styled.h4`
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0 0 0.2rem;
  font-size: ${({ theme }) => theme.typography.body};
`

const MemberRoleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const RoleSelect = styled.select`
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  background: ${({ theme }) => theme.colors.surface[860]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.green[580]};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
`

const MemberInfo = styled.div``

const MemberStatusRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const MemberActions = styled.div`
  display: flex;
  gap: 0.5rem;
`

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 500px);
  min-height: 400px;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  overflow: hidden;
`

const ChatThread = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ChatEmpty = styled.div`
  text-align: center;
  padding: 4rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
`

const ChatEmptySticker = styled.img`
  width: 120px;
  opacity: 0.4;
`

const ChatBubble = styled.div<{ $isOwn: boolean }>`
  max-width: 70%;
  padding: 0.8rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme, $isOwn }) => $isOwn ? 'rgba(143, 179, 106, 0.1)' : theme.colors.surface[860]};
  border: 1px solid ${({ theme, $isOwn }) => $isOwn ? 'rgba(143, 179, 106, 0.2)' : theme.colors.lineSoft};
  align-self: ${({ $isOwn }) => $isOwn ? 'flex-end' : 'flex-start'};
  color: ${({ theme }) => theme.colors.text[100]};
`

const ChatBubbleHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 0.25rem;
`

const ChatAvatar = styled.img`
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.radii.full};
  object-fit: cover;
`

const ChatTime = styled.span`
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.text[500]};
  float: right;
  margin-top: 0.3rem;
`

const ChatComposer = styled.form`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const ChatComposerRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`

const ChatInput = styled.input`
  flex: 1;
  padding: 0.65rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.green[500]};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }
`

const TextInput = styled.input`
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.green[500]};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }
`

const StyledSelect = styled.select`
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.green[500]};
  }
`

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.green[500]};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }
`

const BuilderForm = styled.form``

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[380]};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
`

const BuilderGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const SettingsInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2rem;
  margin-bottom: 2rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const SettingsFieldsColumn = styled.div`
  display: grid;
  gap: 1.5rem;
  flex: 1;
`

const AvatarUploadWrapper = styled.label`
  position: relative;
  width: 240px;
  height: 160px;
  border-radius: 24px;
  overflow: hidden;
  cursor: pointer;
  display: block;

  &:hover > div {
    opacity: 1;
  }
`

const AvatarPreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const AvatarUploadOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(13, 15, 13, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  opacity: 0;
  transition: opacity 0.25s ease;
`

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

const SettingsActions = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.lg};
`

const InfoBanner = styled.span<{ $tone: 'success' | 'info' | 'error' }>`
  padding: 0.4rem 0.8rem;
  margin: 0;
  font-size: 0.85rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  color: ${({ theme, $tone }) =>
    $tone === 'success' ? theme.colors.green[300] :
    $tone === 'error' ? theme.colors.danger[400] :
    theme.colors.text[220]
  };
  background: ${({ $tone }) =>
    $tone === 'success' ? 'rgba(143, 179, 106, 0.1)' :
    $tone === 'error' ? 'rgba(219, 74, 91, 0.1)' :
    'rgba(247, 243, 232, 0.06)'
  };
  border: 1px solid ${({ theme, $tone }) =>
    $tone === 'success' ? 'rgba(143, 179, 106, 0.2)' :
    $tone === 'error' ? 'rgba(219, 74, 91, 0.2)' :
    theme.colors.lineSoft
  };
`

const HistoryContent = styled.p`
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: 1rem;
  margin: 0 0 0.4rem;
`

const HistoryDate = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.text[500]};
  margin: 0;
`

const HistoryIcon = styled.div`
  display: flex;
  align-items: center;
`

const HistoryEmpty = styled.div`
  text-align: center;
  padding: 4rem 0;
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
`

const ModalScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: ${({ theme }) => theme.colors.overlay};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
`

const InviteModal = styled(motion.div).attrs({
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
})`
  width: 100%;
  max-width: 500px;
  background: ${({ theme }) => theme.colors.bg[980]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
`

const InviteModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;

  h3 {
    margin: 0;
  }
`

const CandidateList = styled.div`
  margin-top: 2rem;
  display: grid;
  gap: 1rem;
`

const CandidateRow = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  padding: 0.6rem;
`

const CandidateAvatar = styled.img`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  object-fit: cover;
`

const CandidateName = styled.span`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text[100]};
`
