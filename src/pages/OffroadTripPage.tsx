import * as signalR from '@microsoft/signalr'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiMap,
  FiPlus,
  FiTrash2,
  FiCompass,
  FiMessageSquare,
  FiNavigation,
  FiCalendar,
  FiUsers,
  FiActivity,
  FiUserPlus,
  FiX
} from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import styled from 'styled-components'
import { useSelector } from 'react-redux'
import api from '../data/api'
import type { ChatMessage, OffroadTrip, User, OffroadRoute, MemberRole, TripMember } from '../types/models'
import { OffroadRouteMap } from '../components/OffroadRouteMap'
import { OffroadTrackStartBar } from '../components/offroad/OffroadTrackStartBar'
import { getErrorMessage } from '../utils/errorMessage'
import { downloadBlob } from '../utils/gpx'
import {
  cacheOffroadTripForOffline,
  getOffroadTrip,
  deleteOffroadRoute,
} from '../utils/offroadTripCache'
import { formatDisplayDateRange } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { computeElevationStats, estimateDuration } from '../utils/coords'
import { registerChatModerationEvents } from '../hooks/useChatModerationEvents'

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

type TripTab = 'overview' | 'routes' | 'chat' | 'members'

const normalizeMemberRole = (role: unknown): MemberRole => {
  const r = String(role).toLowerCase()
  if (r === 'owner') return 'owner'
  if (r === 'admin') return 'admin'
  return 'member'
}

const getCurrentTripDay = (startDate: string, endDate: string): number => {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (now < start) return 1
  if (now > end) return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

const getRouteForDay = (routes: OffroadRoute[], day: number): OffroadRoute | null => {
  return routes.find(r => day >= r.startDay && day <= r.endDay) || routes[0] || null
}

function RouteStatsBar({ route }: { route: OffroadRoute }) {
  const elevStats = useMemo(() => computeElevationStats(route.trackGeoJson), [route.trackGeoJson])
  const gain = elevStats.gainMeters > 0 ? elevStats.gainMeters : Math.round(route.elevationGainMeters)
  const duration = estimateDuration(route.distanceMeters, gain)

  return (
    <RouteStatsRow>
      <RouteStatItem>
        <RouteStatIcon>⏱</RouteStatIcon>
        <RouteStatValue>{duration}</RouteStatValue>
        <RouteStatLabel>Duration</RouteStatLabel>
      </RouteStatItem>
      <RouteStatDivider />
      <RouteStatItem>
        <RouteStatIcon>↔</RouteStatIcon>
        <RouteStatValue>{(route.distanceMeters / 1000).toFixed(2)} km</RouteStatValue>
        <RouteStatLabel>Length</RouteStatLabel>
      </RouteStatItem>
      <RouteStatDivider />
      <RouteStatItem>
        <RouteStatIcon>↗</RouteStatIcon>
        <RouteStatValue>{gain} m</RouteStatValue>
        <RouteStatLabel>Ascent</RouteStatLabel>
      </RouteStatItem>
      <RouteStatDivider />
      <RouteStatItem>
        <RouteStatIcon>↘</RouteStatIcon>
        <RouteStatValue>{elevStats.lossMeters > 0 ? `${elevStats.lossMeters} m` : '—'}</RouteStatValue>
        <RouteStatLabel>Descent</RouteStatLabel>
      </RouteStatItem>
      {elevStats.maxAltitude !== null && (
        <>
          <RouteStatDivider />
          <RouteStatItem>
            <RouteStatIcon>▲</RouteStatIcon>
            <RouteStatValue>{elevStats.maxAltitude} m</RouteStatValue>
            <RouteStatLabel>Peak</RouteStatLabel>
          </RouteStatItem>
        </>
      )}
    </RouteStatsRow>
  )
}

export function OffroadTripPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const baseURL = import.meta.env.VITE_BASE_URL
  const [trip, setTrip] = useState<OffroadTrip | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TripTab>('overview')
  const [isExporting, setIsExporting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [members, setMembers] = useState<TripMember[]>([])
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteUsernameQuery, setInviteUsernameQuery] = useState('')
  const [isSearchingInviteUser, setIsSearchingInviteUser] = useState(false)
  const [isInvitingUserId, setIsInvitingUserId] = useState<number | null>(null)
  const [isUpdatingRoleMemberId, setIsUpdatingRoleMemberId] = useState<string | null>(null)
  const [isRemovingMemberId, setIsRemovingMemberId] = useState<string | null>(null)
  const [inviteFeedback, setInviteFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [inviteCandidates, setInviteCandidates] = useState<User[]>([])
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const currentUser = useSelector((state: AuthStoreState) => state.auth.user)

  const currentDay = useMemo(() => {
    if (!trip) return 1
    return getCurrentTripDay(trip.startingDate, trip.endingDate)
  }, [trip])

  const currentRoute = useMemo(() => {
    if (!trip) return null
    return getRouteForDay(trip.routes, currentDay)
  }, [trip, currentDay])

  const selectedRoute = useMemo(() => {
    if (!trip) return null
    return trip.routes.find(r => r.id === selectedRouteId) || currentRoute
  }, [trip, selectedRouteId, currentRoute])

  useEffect(() => {
    if (trip) {
      setMembers(trip.members)
    }
  }, [trip])

  const viewerRole: MemberRole = useMemo(() => {
    if (!currentUser) return 'member'
    const viewer = members.find((m) => m.username === currentUser.username)
    return normalizeMemberRole(viewer?.role)
  }, [members, currentUser])

  const canInviteMembers = viewerRole === 'owner' || viewerRole === 'admin'
  const canEditMemberRoles = viewerRole === 'owner'
  const canRemoveMembers = viewerRole === 'owner'

  const acceptedMembers = useMemo(() =>
    members.filter((m) => (m.status ?? 'accepted') === 'accepted'),
    [members]
  )

  const pendingMembers = useMemo(() =>
    members.filter((m) => {
      const status = m.status ?? 'accepted'
      return status === 'invited' || status === 'requested'
    }),
    [members]
  )

  const viewerParticipation = useMemo(() => {
    if (!currentUser) return 'guest' as const
    const viewer = members.find((m) => String(m.id) === String(currentUser.id))
    if (!viewer) return 'none' as const
    const status = (viewer.status ?? 'accepted').toLowerCase()
    if (status === 'accepted') return 'accepted' as const
    if (status === 'requested') return 'requested' as const
    if (status === 'invited') return 'invited' as const
    return 'none' as const
  }, [members, currentUser])

  useEffect(() => {
    if (!tripId) return
    let active = true
    const load = async () => {
      try {
        const res = await api.get(`api/OffroadTrip/get-offroad-trip/${tripId}`)
        if (active) {
          setTrip(res.data)
          await cacheOffroadTripForOffline(res.data)
        }
      } catch {
        const cached = await getOffroadTrip(tripId)
        if (active && cached) setTrip(cached)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [tripId])

  useEffect(() => {
    if (!tripId || !token) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseURL}/hubs/offroad-trip-chat?access_token=${token}`)
      .withAutomaticReconnect()
      .build()

    connection.on('ReceiveMessage', (msg: ChatMessage) => {
      setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })

    registerChatModerationEvents(connection, setChatMessages, (payload) => {
      console.warn(payload.message ?? 'Message removed by moderation.')
    })

    connectionRef.current = connection
    let stopped = false

    const start = async () => {
      try {
        await connection.start()
        if (!stopped) await connection.invoke('JoinOffroadTrip', Number(tripId))
      } catch (err) {
        console.error('Offroad chat connection failed', err)
      }
    }
    start()

    api
      .get(`api/OffroadTrip/get-messages/${tripId}`)
      .then((res) => {
        if (Array.isArray(res.data)) setChatMessages(res.data)
      })
      .catch(() => {})

    return () => {
      stopped = true
      void (async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke('LeaveOffroadTrip', Number(tripId))
          }
        } catch {
          /* ignore */
        }
        await connection.stop()
      })()
    }
  }, [tripId, token, baseURL])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendMessage = async () => {
    if (!newMessage.trim() || !connectionRef.current) return
    try {
      await connectionRef.current.invoke('SendMessage', Number(tripId), newMessage.trim())
      setNewMessage('')
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const exportRouteGpx = async (routeId: number) => {
    setIsExporting(true)
    try {
      const res = await api.get(`api/OffroadTrip/export-route-gpx/${tripId}/${routeId}`, {
        responseType: 'blob',
      })
      downloadBlob(res.data, `route-${routeId}.gpx`)
    } finally {
      setIsExporting(false)
    }
  }

  const exportTripGpx = async () => {
    setIsExporting(true)
    try {
      const res = await api.get(`api/OffroadTrip/export-trip-gpx/${tripId}`, { responseType: 'blob' })
      downloadBlob(res.data, `offroad-trip-${tripId}.gpx`)
    } finally {
      setIsExporting(false)
    }
  }

  const removeRoute = async (routeId: number) => {
    await api.delete(`api/OffroadTrip/route-remove/${tripId}/${routeId}`)
    if (selectedRouteId === routeId) setSelectedRouteId(null)
    setTrip((t) => {
      if (!t) return t
      const next = { ...t, routes: t.routes.filter((r) => r.id !== routeId) }
      void cacheOffroadTripForOffline(next)
      void deleteOffroadRoute(tripId!, routeId)
      return next
    })
  }

  const handleRequestToJoin = async () => {
    if (!tripId || isJoining) return
    setIsJoining(true)
    setJoinError(null)
    try {
      await api.post('api/OffroadTrip/membership-request', { tripId: Number(tripId) })
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${tripId}`)
      setTrip(res.data)
      await cacheOffroadTripForOffline(res.data)
    } catch (err) {
      setJoinError(getErrorMessage(err))
    } finally {
      setIsJoining(false)
    }
  }

  const handleInviteSearch = async (query: string) => {
    if (!query.trim()) {
      setInviteCandidates([])
      return
    }
    setIsSearchingInviteUser(true)
    try {
      const res = await api.get(`api/user/search?query=${encodeURIComponent(query)}`)
      if (Array.isArray(res.data)) {
        setInviteCandidates(res.data.filter((u: User) => !members.some((m) => m.username === u.username)))
      }
    } catch {
      setInviteFeedback({ tone: 'error', message: 'User search failed.' })
    } finally {
      setIsSearchingInviteUser(false)
    }
  }

  const handleInvite = async (user: User) => {
    if (isInvitingUserId === user.id) return
    setIsInvitingUserId(user.id)
    try {
      await api.post('api/OffroadTrip/membership-request', {
        tripId: Number(tripId),
        userId: user.id,
        invitedBy: currentUser?.id
      })
      setInviteFeedback({ tone: 'success', message: `Invite sent to ${user.username}.` })
      setMembers((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          username: user.username,
          role: 'member',
          status: 'invited',
          avatarUrl: user.profileUrl
        } as TripMember
      ])
      setInviteCandidates((prev) => prev.filter((c) => c.id !== user.id))
    } catch {
      setInviteFeedback({ tone: 'error', message: 'Failed to send invite.' })
    } finally {
      setIsInvitingUserId(null)
    }
  }

  const handleRespondToRequest = async (member: typeof members[0], action: 'Accepted' | 'Declined') => {
    try {
      await api.patch('api/OffroadTrip/membership-response', {
        tripId: Number(tripId),
        invitedId: member.id,
        action
      })
      if (action === 'Accepted') {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: 'accepted' } : m)))
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== member.id))
      }
    } catch {
      setInviteFeedback({ tone: 'error', message: 'Failed to process request.' })
    }
  }

  const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
    if (isUpdatingRoleMemberId === memberId) return
    setIsUpdatingRoleMemberId(memberId)
    try {
      await api.patch('api/OffroadTrip/change-role', {
        tripId: Number(tripId),
        memberId,
        role: newRole
      })
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
    } catch {
      setInviteFeedback({ tone: 'error', message: 'Failed to update role.' })
    } finally {
      setIsUpdatingRoleMemberId(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (isRemovingMemberId === memberId) return
    setIsRemovingMemberId(memberId)
    try {
      await api.delete(`api/OffroadTrip/remove-member/${tripId}/${memberId}`)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      setInviteFeedback({ tone: 'error', message: 'Failed to remove member.' })
    } finally {
      setIsRemovingMemberId(null)
    }
  }

  if (loading) {
    return (
      <PageSection>
        <LoadingState>Loading offroad trip...</LoadingState>
      </PageSection>
    )
  }

  if (!trip) {
    return (
      <PageSection>
        <p>Trip not found.</p>
        <BackLink to="/app/offroad">Back</BackLink>
      </PageSection>
    )
  }

  const totalKm = trip.routes.reduce((sum, r) => sum + r.distanceMeters, 0) / 1000
  const totalElevation = trip.routes.reduce((sum, r) => sum + r.elevationGainMeters, 0)
  const isOwner = viewerRole === 'owner'
  const isMember = viewerParticipation === 'accepted'

  const tabs: Array<{ key: TripTab; label: string; icon: typeof FiMap }> = [
    { key: 'overview', label: 'Overview', icon: FiCompass },
    { key: 'routes', label: 'Routes', icon: FiNavigation },
    { key: 'members', label: 'Members', icon: FiUsers },
    { key: 'chat', label: 'Chat', icon: FiMessageSquare },
  ]

  return (
    <PageSection>
      <HeaderBar>
        <BackLink to="/app/offroad">
          <FiArrowLeft aria-hidden /> Back
        </BackLink>
        <OffroadTabs>
          {tabs.map((tab) => (
            <OffroadTab
              key={tab.key}
              type="button"
              $active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </OffroadTab>
          ))}
        </OffroadTabs>
        <HeaderActions>
          <GhostBtnSm type="button" onClick={exportTripGpx} disabled={isExporting}>
            <FiDownload aria-hidden /> {isExporting ? 'Exporting...' : 'GPX'}
          </GhostBtnSm>
          {isOwner && (
            <PrimaryLinkSm to={`/app/offroad/${tripId}/route/new`}>
              <FiPlus aria-hidden /> Route
            </PrimaryLinkSm>
          )}
        </HeaderActions>
      </HeaderBar>

      <TripHero
        $hasCover={!!trip.imageUrl}
        style={trip.imageUrl ? { backgroundImage: `url(${trip.imageUrl})` } : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <HeroOverlay $hasCover={!!trip.imageUrl}>
          <StatusBadge>
            <FiMap aria-hidden /> {getTripStatusLabel(trip.status)}
          </StatusBadge>
          <HeroTitle>{trip.title}</HeroTitle>
          <HeroLead>{trip.description}</HeroLead>
          <HeroMeta>
            <span><FiCalendar size={14} /> {formatDisplayDateRange(trip.startingDate, trip.endingDate)}</span>
            <span><FiUsers size={14} /> {trip.currentMembers}/{trip.maxParticipants}</span>
            <span><FiActivity size={14} /> {totalKm.toFixed(1)} km</span>
          </HeroMeta>
        </HeroOverlay>
      </TripHero>

      {viewerParticipation !== 'accepted' && (
        <JoinBanner
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {viewerParticipation === 'requested' ? (
            <p>Your join request is pending review.</p>
          ) : viewerParticipation === 'invited' ? (
            <p>You have been invited to this trip. Open the Members tab to respond.</p>
          ) : (
            <>
              <p>Join this offroad adventure to access routes and chat with the crew.</p>
              <PrimaryBtn type="button" onClick={handleRequestToJoin} disabled={isJoining}>
                {isJoining ? 'Requesting...' : 'Request to join'}
              </PrimaryBtn>
            </>
          )}
          {joinError && <ErrorText>{joinError}</ErrorText>}
        </JoinBanner>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <TabContent
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <CurrentDaySection>
              <CurrentDayHeader>
                <CurrentDayTitle>
                  <FiNavigation aria-hidden />
                  {currentRoute ? `Day ${currentDay}: ${currentRoute.name}` : `Day ${currentDay}: No route planned`}
                </CurrentDayTitle>
                {currentRoute && (
                  <CurrentDayActionBtn
                    type="button"
                    onClick={() => {
                      setSelectedRouteId(currentRoute.id)
                      setActiveTab('routes')
                    }}
                  >
                    <span className="label-full">View in Routes</span>
                    <span className="label-short">Routes</span>
                  </CurrentDayActionBtn>
                )}
              </CurrentDayHeader>

              {currentRoute ? (
                <>
                  <RouteMapBlock>
                    <CurrentRouteMap>
                      <OffroadRouteMap routes={[currentRoute]} selectedRouteId={currentRoute.id} height="320px" />
                    </CurrentRouteMap>
                    <RouteStatsBar route={currentRoute} />
                  </RouteMapBlock>

                  {viewerParticipation === 'accepted' && tripId && (
                    <OffroadTrackStartBar tripId={tripId} route={currentRoute} />
                  )}

                  {currentRoute.note && (
                    <RouteNote>
                      <strong>Note:</strong> {currentRoute.note}
                    </RouteNote>
                  )}
                </>
              ) : (
                <EmptyCurrentRoute>
                  <p>No route defined for day {currentDay}.</p>
                  {isOwner && (
                    <PrimaryLink to={`/app/offroad/${tripId}/route/new`}>Add Route</PrimaryLink>
                  )}
                </EmptyCurrentRoute>
              )}
            </CurrentDaySection>

            <OffroadStatsBar>
              <OffroadStat>
                <label>Total Routes</label>
                <span>{trip.routes.length}</span>
              </OffroadStat>
              <OffroadStat>
                <label>Total Distance</label>
                <span>{totalKm.toFixed(1)} km</span>
              </OffroadStat>
              <OffroadStat>
                <label>Total Elevation</label>
                <span>{Math.round(totalElevation)} m</span>
              </OffroadStat>
              <OffroadStat>
                <label>Duration</label>
                <span>{formatDisplayDateRange(trip.startingDate, trip.endingDate)}</span>
              </OffroadStat>
            </OffroadStatsBar>
          </TabContent>
        )}

        {activeTab === 'routes' && (
          <TabContent
            key="routes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <RoutesLayout>
              <RoutesSidebar>
                <SectionTitle>All Routes</SectionTitle>
                {trip.routes.length === 0 ? (
                  <EmptyRoutes>
                    <h3>No routes yet</h3>
                    <MutedText>Import a GPX file or draw a track on the map to define day segments.</MutedText>
                    {isOwner && (
                      <PrimaryLink to={`/app/offroad/${tripId}/route/new`}>Add first route</PrimaryLink>
                    )}
                  </EmptyRoutes>
                ) : (
                  <RouteList>
                    {trip.routes.map((route) => (
                      <RouteCard
                        key={route.id}
                        $selected={selectedRouteId === route.id}
                        onClick={() => setSelectedRouteId(route.id)}
                      >
                        <RouteCardHeader>
                          <h3>{route.name}</h3>
                          <RouteSource $isDrawn={route.source === 'Drawn'}>{route.source}</RouteSource>
                        </RouteCardHeader>
                        <RouteMeta>
                          <span>Days <strong>{route.startDay}–{route.endDay}</strong></span>
                          <span><strong>{(route.distanceMeters / 1000).toFixed(1)} km</strong></span>
                          {route.elevationGainMeters > 0 && (
                            <span><strong>{Math.round(route.elevationGainMeters)} m</strong> elev.</span>
                          )}
                        </RouteMeta>
                        {route.note ? <MutedText>{route.note}</MutedText> : null}
                        <RouteActions>
                          <GhostBtnSm type="button" onClick={(e) => { e.stopPropagation(); exportRouteGpx(route.id); }} disabled={isExporting}>
                            <FiDownload aria-hidden /> GPX
                          </GhostBtnSm>
                          {isOwner && (
                            <>
                              <GhostLinkSm to={`/app/offroad/${tripId}/route/${route.id}/edit`} onClick={(e) => e.stopPropagation()}>
                                <FiEdit2 aria-hidden /> Edit
                              </GhostLinkSm>
                              <GhostBtnSm type="button" onClick={(e) => { e.stopPropagation(); removeRoute(route.id); }}>
                                <FiTrash2 aria-hidden />
                              </GhostBtnSm>
                            </>
                          )}
                        </RouteActions>
                      </RouteCard>
                    ))}
                  </RouteList>
                )}
              </RoutesSidebar>

              <RoutesMapPanel>
                {selectedRoute ? (
                  <>
                    <SelectedRouteHeader>
                      <h3>{selectedRoute.name}</h3>
                    </SelectedRouteHeader>
                    <RouteMapBlock>
                      <RouteMapShell>
                        <OffroadRouteMap routes={[selectedRoute]} selectedRouteId={selectedRoute.id} height="100%" interactive={true} />
                      </RouteMapShell>
                      <RouteStatsBar route={selectedRoute} />
                    </RouteMapBlock>
                    {viewerParticipation === 'accepted' && tripId && (
                      <OffroadTrackStartBar tripId={tripId} route={selectedRoute} />
                    )}
                  </>
                ) : (
                  <NoSelection>
                    <p>Select a route to view on map</p>
                  </NoSelection>
                )}
              </RoutesMapPanel>
            </RoutesLayout>
          </TabContent>
        )}

        {activeTab === 'members' && (
          <TabContent
            key="members"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <MembersSection>
              <MembersHeader>
                <SectionTitle><FiUsers aria-hidden /> The Crew</SectionTitle>
                {canInviteMembers && (
                  <PrimaryBtnSm type="button" onClick={() => setIsInviteModalOpen(true)}>
                    <FiUserPlus aria-hidden /> Invite
                  </PrimaryBtnSm>
                )}
              </MembersHeader>

              <MemberList>
                {acceptedMembers.map((m) => (
                  <MemberCard key={m.id}>
                    <MemberInfo>
                      <MemberAvatar>{m.username.charAt(0).toUpperCase()}</MemberAvatar>
                      <MemberDetails>
                        <h4>{m.username}</h4>
                        <MemberRoleBadge>{normalizeMemberRole(m.role)}</MemberRoleBadge>
                      </MemberDetails>
                    </MemberInfo>
                    <MemberActions>
                      {canEditMemberRoles && normalizeMemberRole(m.role) !== 'owner' && (
                        <RoleSelect
                          value={normalizeMemberRole(m.role)}
                          disabled={isUpdatingRoleMemberId === m.id}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </RoleSelect>
                      )}
                      {canRemoveMembers && normalizeMemberRole(m.role) !== 'owner' && (
                        <GhostBtnSm
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={isRemovingMemberId === m.id}
                        >
                          {isRemovingMemberId === m.id ? 'Removing...' : <FiTrash2 aria-hidden />}
                        </GhostBtnSm>
                      )}
                    </MemberActions>
                  </MemberCard>
                ))}
              </MemberList>

              {pendingMembers.length > 0 && (
                <PendingMembers>
                  <h3>Pending</h3>
                  <MemberList>
                    {pendingMembers.map((m) => (
                      <MemberCard key={m.id}>
                        <MemberInfo>
                          <MemberAvatar>{m.username.charAt(0).toUpperCase()}</MemberAvatar>
                          <MemberDetails>
                            <h4>{m.username}</h4>
                            <MemberStatus>{m.status}</MemberStatus>
                          </MemberDetails>
                        </MemberInfo>
                        {m.status === 'requested' && canInviteMembers && (
                          <MemberActions>
                            <PrimaryBtnSm type="button" onClick={() => handleRespondToRequest(m, 'Accepted')}>Accept</PrimaryBtnSm>
                            <GhostBtnSm type="button" onClick={() => handleRespondToRequest(m, 'Declined')}>Decline</GhostBtnSm>
                          </MemberActions>
                        )}
                      </MemberCard>
                    ))}
                  </MemberList>
                </PendingMembers>
              )}
            </MembersSection>
          </TabContent>
        )}

        {activeTab === 'chat' && (
          <TabContent
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ChatPanel>
              {!isMember ? (
                <ChatLocked>
                  <FiMessageSquare size={48} style={{ opacity: 0.3 }} />
                  <p>
                    {viewerParticipation === 'requested'
                      ? 'Your join request is pending. Chat unlocks once you are accepted.'
                      : 'Join this trip to access the crew chat.'}
                  </p>
                  {viewerParticipation === 'none' && (
                    <PrimaryBtn type="button" onClick={handleRequestToJoin} disabled={isJoining}>
                      {isJoining ? 'Requesting...' : 'Request to join'}
                    </PrimaryBtn>
                  )}
                </ChatLocked>
              ) : (
                <>
                  <ChatMessages>
                    {chatMessages.length === 0 ? (
                      <ChatEmpty>
                        <FiMessageSquare size={48} style={{ opacity: 0.3 }} />
                        <MutedText>No messages yet. Say hello to the crew!</MutedText>
                      </ChatEmpty>
                    ) : (
                      chatMessages.map((m) => (
                        <ChatBubble key={m.id} $isOwner={m.username === trip.members.find(me => me.role === 'owner')?.username}>
                          <ChatBubbleHeader>
                            {m.profileUrl && <ChatAvatar src={m.profileUrl} alt="" />}
                            <strong>{m.username}</strong>
                            <ChatTime>
                              {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </ChatTime>
                          </ChatBubbleHeader>
                          <p>{m.content}</p>
                        </ChatBubble>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </ChatMessages>
                  <ChatCompose>
                    <ChatInput
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Message the crew..."
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <PrimaryBtnSm type="button" onClick={sendMessage}>Send</PrimaryBtnSm>
                  </ChatCompose>
                </>
              )}
            </ChatPanel>
          </TabContent>
        )}
      </AnimatePresence>

      {isInviteModalOpen && (
        <ModalScrim onClick={() => setIsInviteModalOpen(false)}>
          <ModalSurface onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <h3>Invite Explorer</h3>
              <GhostBtnSm type="button" onClick={() => setIsInviteModalOpen(false)}>
                <FiX aria-hidden />
              </GhostBtnSm>
            </ModalHeader>
            <ModalBody>
              <ModalInput
                placeholder="Search by username..."
                value={inviteUsernameQuery}
                onChange={(e) => {
                  setInviteUsernameQuery(e.target.value)
                  handleInviteSearch(e.target.value)
                }}
              />
              {isSearchingInviteUser ? (
                <MutedText>Searching...</MutedText>
              ) : (
                <InviteCandidatesList>
                  {inviteCandidates.map((c) => (
                    <InviteCandidateItem key={c.id}>
                      <span>{c.username}</span>
                      <PrimaryBtnSm type="button" disabled={isInvitingUserId === c.id} onClick={() => handleInvite(c)}>
                        {isInvitingUserId === c.id ? 'Inviting...' : 'Invite'}
                      </PrimaryBtnSm>
                    </InviteCandidateItem>
                  ))}
                </InviteCandidatesList>
              )}
              {inviteFeedback && (
                <FeedbackMessage $tone={inviteFeedback.tone}>
                  {inviteFeedback.message}
                </FeedbackMessage>
              )}
            </ModalBody>
          </ModalSurface>
        </ModalScrim>
      )}
    </PageSection>
  )
}

// --- Styled Components ---

const PageSection = styled.section`
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1200px, 100% - 1rem);
    padding-bottom: 7rem;
    gap: ${({ theme }) => theme.spacing.md};
  }
`

const LoadingState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']};
  color: ${({ theme }) => theme.colors.text[380]};
`

const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    gap: ${({ theme }) => theme.spacing.sm};
  }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
`

const PrimaryLinkSm = styled(PrimaryLink)`
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  min-height: 36px;
  min-width: 36px;
`

const GhostBtnSm = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  box-sizing: border-box;
  flex-shrink: 0;
  max-width: 100%;

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`

const GhostLinkSm = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.text[220]};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  border: none;
  cursor: pointer;

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
  &:disabled { opacity: 0.5; transform: none; box-shadow: none; cursor: not-allowed; }
`

const PrimaryBtnSm = styled(PrimaryBtn)`
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  min-height: 36px;
  min-width: 36px;
`

const OffroadTabs = styled.div`
  display: flex;
  gap: 0.25rem;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

const OffroadTab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: ${({ $active }) => $active ? 700 : 500};
  color: ${({ $active, theme }) => $active ? '#0a1e08' : theme.colors.text[380]};
  background: ${({ $active, theme }) => $active ? `linear-gradient(135deg, ${theme.colors.green[580]}, ${theme.colors.green[500]})` : 'transparent'};
  border: ${({ $active, theme }) => $active ? 'none' : `1px solid ${theme.colors.lineSoft}`};
  border-radius: ${({ theme }) => theme.radii.pill};
  cursor: pointer;
  white-space: nowrap;
  min-height: 40px;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    color: ${({ $active, theme }) => $active ? '#0a1e08' : theme.colors.text[220]};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 0.5rem 0.75rem;

    span {
      display: none;
    }
  }
`

const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }
`

const TripHero = styled(motion.header)<{ $hasCover: boolean }>`
  border-radius: ${({ theme }) => theme.radii.xl};
  overflow: hidden;
  background: ${({ $hasCover, theme }) => $hasCover ? 'center / cover no-repeat' : theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
`

const HeroOverlay = styled.div<{ $hasCover: boolean }>`
  padding: ${({ theme }) => theme.spacing['2xl']} ${({ theme }) => theme.spacing.lg};
  background: ${({ $hasCover }) => $hasCover ? 'linear-gradient(to top, rgba(13,15,13,0.95) 0%, rgba(13,15,13,0.5) 100%)' : 'none'};
  backdrop-filter: ${({ $hasCover }) => $hasCover ? 'blur(4px)' : 'none'};
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  }
`

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.offroad.accentSoft};
  color: ${({ theme }) => theme.colors.offroad.accent};
  width: fit-content;
`

const HeroTitle = styled.h1`
  color: ${({ theme }) => theme.colors.text[100]};
`

const HeroLead = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 640px;
  line-height: 1.6;
`

const HeroMeta = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;

  span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: ${({ theme }) => theme.typography.bodySmall};
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const JoinBanner = styled(motion.div)`
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  text-align: center;
  color: ${({ theme }) => theme.colors.text[100]};

  p { margin-bottom: ${({ theme }) => theme.spacing.sm}; }
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.danger[500]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const TabContent = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const CurrentDaySection = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`

const CurrentDayHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: stretch;
  }
`

const CurrentDayTitle = styled.h2`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex: 1 1 auto;
  min-width: 0;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.h3};
  line-height: 1.35;
  overflow-wrap: anywhere;

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    font-size: ${({ theme }) => theme.typography.body};
  }
`

const CurrentDayActionBtn = styled(GhostBtnSm)`
  .label-short {
    display: none;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    align-self: flex-start;

    .label-full {
      display: none;
    }

    .label-short {
      display: inline;
    }
  }
`

const RouteMapBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const CurrentRouteMap = styled.div`
  border-radius: 12px;
  overflow: hidden;
`

const RouteNote = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  background: rgba(201, 162, 39, 0.08);
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text[220]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

const EmptyCurrentRoute = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.text[380]};

  p { margin-bottom: ${({ theme }) => theme.spacing.md}; }
`

const OffroadStatsBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`

const OffroadStat = styled.div`
  flex: 1;
  min-width: 140px;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  text-align: center;

  label {
    display: block;
    font-size: ${({ theme }) => theme.typography.caption};
    color: ${({ theme }) => theme.colors.text[380]};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }
  span { color: ${({ theme }) => theme.colors.text[100]}; font-size: ${({ theme }) => theme.typography.body}; font-weight: 600; }
`

const RoutesLayout = styled.div`
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 520px;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
  }
`

const RoutesSidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const SectionTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text[100]};
`

const EmptyRoutes = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.text[380]};

  h3 { color: ${({ theme }) => theme.colors.text[100]}; margin-bottom: 0.5rem; }
  p { margin-bottom: ${({ theme }) => theme.spacing.md}; }
`

const MutedText = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const RouteList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  max-height: 520px;
  overflow-y: auto;
`

const RouteCard = styled.article<{ $selected: boolean }>`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ $selected, theme }) => $selected ? 'rgba(201, 162, 39, 0.1)' : theme.glass.bg};
  border: 1px solid ${({ $selected, theme }) => $selected ? theme.colors.offroad.accent : theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover { border-color: ${({ theme }) => theme.colors.line}; }
`

const RouteCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;

  h3 {
    color: ${({ theme }) => theme.colors.text[100]};
    font-size: ${({ theme }) => theme.typography.body};
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

const RouteSource = styled.span<{ $isDrawn: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  background: ${({ $isDrawn }) => $isDrawn ? 'rgba(201, 162, 39, 0.15)' : 'rgba(65, 162, 56, 0.15)'};
  color: ${({ $isDrawn, theme }) => $isDrawn ? theme.colors.offroad.accent : theme.colors.green[580]};
`

const RouteMeta = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};

  strong { color: ${({ theme }) => theme.colors.text[100]}; }
`

const RouteActions = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-top: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  align-items: center;
`

const RoutesMapPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const SelectedRouteHeader = styled.div`
  h3 { color: ${({ theme }) => theme.colors.text[100]}; }
`

const RouteMapShell = styled.div`
  height: 100%;
  min-height: 350px;
  border-radius: 12px;
  overflow: hidden;
`

const NoSelection = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 300px;
  color: ${({ theme }) => theme.colors.text[380]};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
`

const MembersSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const MembersHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const MemberList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const MemberCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
`

const MemberInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`

const MemberAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.offroad.accentSoft};
  color: ${({ theme }) => theme.colors.offroad.accent};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
`

const MemberDetails = styled.div`
  h4 { color: ${({ theme }) => theme.colors.text[100]}; margin: 0; }
`

const MemberRoleBadge = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
  text-transform: capitalize;
`

const MemberStatus = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.offroad.accent};
  text-transform: capitalize;
`

const MemberActions = styled.div`
  display: flex;
  gap: 0.35rem;
  align-items: center;
`

const RoleSelect = styled.select`
  padding: 0.4rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.caption};
  min-height: 36px;
`

const PendingMembers = styled.div`
  h3 { color: ${({ theme }) => theme.colors.text[220]}; margin-bottom: ${({ theme }) => theme.spacing.sm}; }
`

const ChatPanel = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  min-height: 400px;
  display: flex;
  flex-direction: column;
`

const ChatLocked = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex: 1;
  padding: ${({ theme }) => theme.spacing['3xl']};
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.text[380]};
`

const ChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  max-height: 420px;
`

const ChatEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: ${({ theme }) => theme.spacing.xl};
  gap: ${({ theme }) => theme.spacing.sm};
`

const ChatBubble = styled.div<{ $isOwner: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ $isOwner }) => $isOwner ? 'rgba(201, 162, 39, 0.08)' : 'rgba(255,255,255,0.03)'};
  border-radius: ${({ theme }) => theme.radii.lg};
`

const ChatBubbleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};

  strong { color: ${({ theme }) => theme.colors.text[100]}; }
`

const ChatAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
`

const ChatTime = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
  margin-left: auto;
`

const ChatCompose = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const ChatInput = styled.input`
  flex: 1;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  outline: none;
  min-height: 44px;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus { border-color: ${({ theme }) => theme.colors.green[500]}; }
`

const ModalScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.md};
`

const ModalSurface = styled.div`
  max-width: 500px;
  width: 90%;
  background: ${({ theme }) => theme.colors.bg[960]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
`

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};

  h3 { color: ${({ theme }) => theme.colors.text[100]}; }
`

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ModalInput = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  outline: none;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus { border-color: ${({ theme }) => theme.colors.green[500]}; }
`

const InviteCandidatesList = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const InviteCandidateItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  color: ${({ theme }) => theme.colors.text[100]};
`

const FeedbackMessage = styled.p<{ $tone: 'success' | 'error' }>`
  background: ${({ $tone }) => $tone === 'success' ? 'rgba(23, 247, 2, 0.1)' : 'rgba(219, 74, 91, 0.1)'};
  border: 1px solid ${({ $tone, theme }) => $tone === 'success' ? theme.colors.green[580] : theme.colors.danger[500]};
  color: ${({ $tone, theme }) => $tone === 'success' ? theme.colors.green[500] : theme.colors.danger[500]};
  padding: 0.5rem 0.75rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-top: 1rem;
`

const RouteStatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: ${({ theme }) => theme.spacing.sm};
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
`

const RouteStatItem = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0 0.5rem;
  min-width: 4.25rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex: 0 0 auto;
  }
`

const RouteStatIcon = styled.span`
  font-size: 1.1rem;
`

const RouteStatValue = styled.span`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text[100]};
`

const RouteStatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const RouteStatDivider = styled.div`
  width: 1px;
  height: 36px;
  background: ${({ theme }) => theme.colors.lineSoft};
  flex-shrink: 0;
`
