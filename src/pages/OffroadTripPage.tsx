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
import { useSelector } from 'react-redux'
import api from '../data/api'
import type { ChatMessage, OffroadTrip, User, OffroadRoute, MemberRole, TripMember } from '../types/models'
import { OffroadRouteMap } from '../components/OffroadRouteMap'
import { getErrorMessage } from '../utils/errorMessage'
import { downloadBlob } from '../utils/gpx'
import { putOffroadTrip, getOffroadTrip } from '../utils/offroadTripCache'
import { formatDisplayDateRange } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { computeElevationStats, estimateDuration } from '../utils/coords'

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

type TripTab = 'overview' | 'routes' | 'chat' | 'members'

const tabTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as const,
}

// Helper to calculate current trip day
const getCurrentTripDay = (startDate: string, endDate: string): number => {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (now < start) return 1
  if (now > end) return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

// Helper to get route for a specific day
const getRouteForDay = (routes: OffroadRoute[], day: number): OffroadRoute | null => {
  return routes.find(r => day >= r.startDay && day <= r.endDay) || routes[0] || null
}

function RouteStatsBar({ route }: { route: OffroadRoute }) {
  const elevStats = useMemo(() => computeElevationStats(route.trackGeoJson), [route.trackGeoJson])
  const gain = elevStats.gainMeters > 0 ? elevStats.gainMeters : Math.round(route.elevationGainMeters)
  const duration = estimateDuration(route.distanceMeters, gain)

  return (
    <div className="offroad-route-statsbar">
      <div className="offroad-route-statsbar-item">
        <span className="offroad-route-statsbar-icon">⏱</span>
        <span className="offroad-route-statsbar-value">{duration}</span>
        <span className="offroad-route-statsbar-label">Duration</span>
      </div>
      <div className="offroad-route-statsbar-divider" />
      <div className="offroad-route-statsbar-item">
        <span className="offroad-route-statsbar-icon">↔</span>
        <span className="offroad-route-statsbar-value">{(route.distanceMeters / 1000).toFixed(2)} km</span>
        <span className="offroad-route-statsbar-label">Length</span>
      </div>
      <div className="offroad-route-statsbar-divider" />
      <div className="offroad-route-statsbar-item">
        <span className="offroad-route-statsbar-icon">↗</span>
        <span className="offroad-route-statsbar-value">{gain} m</span>
        <span className="offroad-route-statsbar-label">Ascent</span>
      </div>
      <div className="offroad-route-statsbar-divider" />
      <div className="offroad-route-statsbar-item">
        <span className="offroad-route-statsbar-icon">↘</span>
        <span className="offroad-route-statsbar-value">{elevStats.lossMeters > 0 ? `${elevStats.lossMeters} m` : '—'}</span>
        <span className="offroad-route-statsbar-label">Descent</span>
      </div>
      {elevStats.maxAltitude !== null && (
        <>
          <div className="offroad-route-statsbar-divider" />
          <div className="offroad-route-statsbar-item">
            <span className="offroad-route-statsbar-icon">▲</span>
            <span className="offroad-route-statsbar-value">{elevStats.maxAltitude} m</span>
            <span className="offroad-route-statsbar-label">Peak</span>
          </div>
        </>
      )}
    </div>
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

  // Member management state
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

  // Get current user from Redux
  const currentUser = useSelector((state: AuthStoreState) => state.auth.user)

  // Computed values must be defined before any early returns to maintain hook order
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

  // Sync members when trip changes
  useEffect(() => {
    if (trip) {
      setMembers(trip.members)
    }
  }, [trip])

  // Member permission helpers
  const normalizeMemberRole = (role: unknown): MemberRole => {
    const r = String(role).toLowerCase()
    if (r === 'owner') return 'owner'
    if (r === 'admin') return 'admin'
    return 'member'
  }

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
          await putOffroadTrip(res.data)
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

  // Auto-scroll chat to bottom
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
    setTrip((t) => (t ? { ...t, routes: t.routes.filter((r) => r.id !== routeId) } : t))
    if (selectedRouteId === routeId) setSelectedRouteId(null)
  }

  // Member management functions
  const handleRequestToJoin = async () => {
    if (!tripId || isJoining) return
    setIsJoining(true)
    setJoinError(null)
    try {
      await api.post('api/OffroadTrip/membership-request', { tripId: Number(tripId) })
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${tripId}`)
      setTrip(res.data)
      await putOffroadTrip(res.data)
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
      <section className="page offroad-trip-page">
        <div className="offroad-loading-state">Loading offroad trip...</div>
      </section>
    )
  }

  if (!trip) {
    return (
      <section className="page offroad-trip-page">
        <p>Trip not found.</p>
        <Link to="/app/offroad" className="btn btn-ghost">
          Back
        </Link>
      </section>
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
    <section className="page offroad-trip-page-v2">
      <div className="offroad-trip-header-bar">
        <Link to="/app/offroad" className="btn btn-ghost btn-sm">
          <FiArrowLeft aria-hidden /> Back
        </Link>
        <div className="offroad-trip-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'offroad-trip-tab is-active' : 'offroad-trip-tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="offroad-trip-header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportTripGpx} disabled={isExporting}>
            <FiDownload aria-hidden /> {isExporting ? 'Exporting...' : 'GPX'}
          </button>
          {isOwner && (
            <Link className="btn btn-primary btn-sm" to={`/app/offroad/${tripId}/route/new`}>
              <FiPlus aria-hidden /> Route
            </Link>
          )}
        </div>
      </div>

      <motion.header
        className={`offroad-trip-hero-v2 ${trip.imageUrl ? 'has-cover' : ''}`}
        style={trip.imageUrl ? { backgroundImage: `url(${trip.imageUrl})` } : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="offroad-trip-hero-overlay-v2">
          <span className="discovery-offroad-badge">
            <FiMap aria-hidden /> {getTripStatusLabel(trip.status)}
          </span>
          <h1>{trip.title}</h1>
          <p className="lead">{trip.description}</p>
          <div className="offroad-trip-hero-meta">
            <span><FiCalendar size={14} /> {formatDisplayDateRange(trip.startingDate, trip.endingDate)}</span>
            <span><FiUsers size={14} /> {trip.currentMembers}/{trip.maxParticipants}</span>
            <span><FiActivity size={14} /> {totalKm.toFixed(1)} km</span>
          </div>
        </div>
      </motion.header>

      {viewerParticipation !== 'accepted' && (
        <motion.div
          className="offroad-modal-join-banner offroad-page-join-banner"
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRequestToJoin}
                disabled={isJoining}
              >
                {isJoining ? 'Requesting...' : 'Request to join'}
              </button>
            </>
          )}
          {joinError && <p className="error-text">{joinError}</p>}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            className="offroad-tab-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={tabTransition}
          >
            {/* Current Day Route Section */}
            <div className="offroad-current-day-section">
              <div className="offroad-current-day-header">
                <h2>
                  <FiNavigation aria-hidden />
                  {currentRoute ? `Day ${currentDay}: ${currentRoute.name}` : `Day ${currentDay}: No route planned`}
                </h2>
                {currentRoute && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedRouteId(currentRoute.id)
                      setActiveTab('routes')
                    }}
                  >
                    View in Routes
                  </button>
                )}
              </div>

              {currentRoute ? (
                <>
                  <div className="offroad-route-map-block">
                    <div className="offroad-current-route-map">
                      <OffroadRouteMap
                        routes={[currentRoute]}
                        selectedRouteId={currentRoute.id}
                        height="320px"
                      />
                    </div>
                    <RouteStatsBar route={currentRoute} />
                  </div>

                  {currentRoute.note && (
                    <div className="offroad-route-note">
                      <strong>Note:</strong> {currentRoute.note}
                    </div>
                  )}
                </>
              ) : (
                <div className="offroad-empty-current-route">
                  <p>No route defined for day {currentDay}.</p>
                  {isOwner && (
                    <Link className="btn btn-primary" to={`/app/offroad/${tripId}/route/new`}>
                      Add Route
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Trip Stats Overview */}
            <div className="offroad-stats-bar-v2">
              <div className="offroad-stat-v2">
                <label>Total Routes</label>
                <span>{trip.routes.length}</span>
              </div>
              <div className="offroad-stat-v2">
                <label>Total Distance</label>
                <span>{totalKm.toFixed(1)} km</span>
              </div>
              <div className="offroad-stat-v2">
                <label>Total Elevation</label>
                <span>{Math.round(totalElevation)} m</span>
              </div>
              <div className="offroad-stat-v2">
                <label>Duration</label>
                <span>{formatDisplayDateRange(trip.startingDate, trip.endingDate)}</span>
              </div>
            </div>

          </motion.div>
        )}

        {/* ROUTES TAB */}
        {activeTab === 'routes' && (
          <motion.div
            key="routes"
            className="offroad-tab-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={tabTransition}
          >
            <div className="offroad-routes-layout">
              <div className="offroad-routes-sidebar">
                <h2 className="offroad-section-title">All Routes</h2>
                {trip.routes.length === 0 ? (
                  <div className="offroad-empty-routes">
                    <h3>No routes yet</h3>
                    <p>Import a GPX file or draw a track on the map to define day segments.</p>
                    {isOwner && (
                      <Link className="btn btn-primary" to={`/app/offroad/${tripId}/route/new`}>
                        Add first route
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="offroad-route-list-v2">
                    {trip.routes.map((route) => (
                      <article
                        key={route.id}
                        className={`offroad-route-card-v2 ${selectedRouteId === route.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedRouteId(route.id)}
                      >
                        <div className="offroad-route-card-header-v2">
                          <h3>{route.name}</h3>
                          <span
                            className={`offroad-route-source ${route.source === 'Drawn' ? 'offroad-route-source--drawn' : ''}`}
                          >
                            {route.source}
                          </span>
                        </div>
                        <div className="offroad-route-meta">
                          <span>
                            Days <strong>{route.startDay}–{route.endDay}</strong>
                          </span>
                          <span>
                            <strong>{(route.distanceMeters / 1000).toFixed(1)} km</strong>
                          </span>
                          {route.elevationGainMeters > 0 && (
                            <span>
                              <strong>{Math.round(route.elevationGainMeters)} m</strong> elev.
                            </span>
                          )}
                        </div>
                        {route.note ? <p className="muted">{route.note}</p> : null}
                        <div className="offroad-route-actions-v2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              exportRouteGpx(route.id)
                            }}
                            disabled={isExporting}
                          >
                            <FiDownload aria-hidden /> GPX
                          </button>
                          {isOwner && (
                            <>
                              <Link
                                className="btn btn-ghost btn-sm"
                                to={`/app/offroad/${tripId}/route/${route.id}/edit`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FiEdit2 aria-hidden /> Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeRoute(route.id)
                                }}
                              >
                                <FiTrash2 aria-hidden />
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="offroad-routes-map-panel">
                {selectedRoute ? (
                  <>
                    <div className="offroad-selected-route-header">
                      <h3>{selectedRoute.name}</h3>
                    </div>
                    <div className="offroad-route-map-block">
                      <div className="offroad-map-shell offroad-map-shell--route-detail">
                        <OffroadRouteMap
                          routes={[selectedRoute]}
                          selectedRouteId={selectedRoute.id}
                          height="100%"
                          interactive={true}
                        />
                      </div>
                      <RouteStatsBar route={selectedRoute} />
                    </div>
                  </>
                ) : (
                  <div className="offroad-no-selection">
                    <p>Select a route to view on map</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <motion.div
            key="members"
            className="offroad-tab-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={tabTransition}
          >
            <div className="offroad-members-section">
              <div className="offroad-members-header">
                <h2>
                  <FiUsers aria-hidden />
                  The Crew
                </h2>
                {canInviteMembers && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsInviteModalOpen(true)}
                  >
                    <FiUserPlus aria-hidden /> Invite
                  </button>
                )}
              </div>

              <div className="offroad-members-list">
                {acceptedMembers.map((m) => (
                  <div key={m.id} className="offroad-member-card">
                    <div className="offroad-member-info">
                      <div className="offroad-member-avatar">
                        {m.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="offroad-member-details">
                        <h4>{m.username}</h4>
                        <span className="offroad-member-role">{normalizeMemberRole(m.role)}</span>
                      </div>
                    </div>
                    <div className="offroad-member-actions">
                      {canEditMemberRoles && normalizeMemberRole(m.role) !== 'owner' && (
                        <select
                          className="input-trigger"
                          value={normalizeMemberRole(m.role)}
                          disabled={isUpdatingRoleMemberId === m.id}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      )}
                      {canRemoveMembers && normalizeMemberRole(m.role) !== 'owner' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={isRemovingMemberId === m.id}
                        >
                          {isRemovingMemberId === m.id ? 'Removing...' : <FiTrash2 aria-hidden />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pendingMembers.length > 0 && (
                <div className="offroad-pending-members">
                  <h3>Pending</h3>
                  <div className="offroad-members-list">
                    {pendingMembers.map((m) => (
                      <div key={m.id} className="offroad-member-card">
                        <div className="offroad-member-info">
                          <div className="offroad-member-avatar">
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="offroad-member-details">
                            <h4>{m.username}</h4>
                            <span className="offroad-member-status">{m.status}</span>
                          </div>
                        </div>
                        {m.status === 'requested' && canInviteMembers && (
                          <div className="offroad-member-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleRespondToRequest(m, 'Accepted')}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleRespondToRequest(m, 'Declined')}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <motion.div
            key="chat"
            className="offroad-tab-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={tabTransition}
          >
            <div className="offroad-chat-panel-v2">
              {!isMember ? (
                <div className="offroad-chat-locked">
                  <FiMessageSquare size={48} style={{ opacity: 0.3 }} />
                  <p>
                    {viewerParticipation === 'requested'
                      ? 'Your join request is pending. Chat unlocks once you are accepted.'
                      : 'Join this trip to access the crew chat.'}
                  </p>
                  {viewerParticipation === 'none' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleRequestToJoin}
                      disabled={isJoining}
                    >
                      {isJoining ? 'Requesting...' : 'Request to join'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="offroad-chat-messages-v2">
                    {chatMessages.length === 0 ? (
                      <div className="offroad-chat-empty">
                        <FiMessageSquare size={48} style={{ opacity: 0.3 }} />
                        <p className="muted">No messages yet. Say hello to the crew!</p>
                      </div>
                    ) : (
                      chatMessages.map((m) => (
                        <div key={m.id} className={`offroad-chat-bubble-v2 ${m.username === trip.members.find(me => me.role === 'owner')?.username ? 'is-owner' : ''}`}>
                          <div className="offroad-chat-bubble-header">
                            {m.profileUrl && (
                              <img src={m.profileUrl} alt="" className="offroad-chat-avatar" />
                            )}
                            <strong>{m.username}</strong>
                            <span className="offroad-chat-time">
                              {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p>{m.content}</p>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="offroad-chat-compose-v2">
                    <input
                      className="input"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Message the crew..."
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button type="button" className="btn btn-primary" onClick={sendMessage}>
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="modal-scrim" onClick={() => setIsInviteModalOpen(false)}>
          <div className="modal-surface" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invite Explorer</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsInviteModalOpen(false)}>
                <FiX aria-hidden />
              </button>
            </div>
            <div className="modal-body">
              <input
                className="input"
                placeholder="Search by username..."
                value={inviteUsernameQuery}
                onChange={(e) => {
                  setInviteUsernameQuery(e.target.value)
                  handleInviteSearch(e.target.value)
                }}
              />
              {isSearchingInviteUser ? (
                <p className="muted">Searching...</p>
              ) : (
                <div className="invite-candidates-list" style={{ marginTop: '1rem' }}>
                  {inviteCandidates.map((c) => (
                    <div key={c.id} className="invite-candidate-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid var(--line-soft)' }}>
                      <span>{c.username}</span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isInvitingUserId === c.id}
                        onClick={() => handleInvite(c)}
                      >
                        {isInvitingUserId === c.id ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {inviteFeedback && (
                <p className={`info-banner ${inviteFeedback.tone}`} style={{ marginTop: '1rem' }}>
                  {inviteFeedback.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
