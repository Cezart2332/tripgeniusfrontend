import { AnimatePresence, motion } from 'framer-motion'
import * as signalR from '@microsoft/signalr'
import { useEffect, useRef, useState } from 'react'
import { FiCheck, FiDownload, FiEdit2, FiMap, FiMessageSquare, FiPlus, FiTrash2, FiUserPlus, FiX, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../data/api'
import type { ChatMessage, MemberRole, OffroadTrip, User } from '../types/models'
import { OffroadRouteMap } from './OffroadRouteMap'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { getErrorMessage } from '../utils/errorMessage'
import { downloadBlob } from '../utils/gpx'
import { getAvatarUrl } from '../utils/userUtils'

interface OffroadTripModalProps {
  trip: OffroadTrip | null
  isOpen: boolean
  onClose: () => void
  onTripUpdate: (trip: OffroadTrip) => void
}

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

type ModalTab = 'details' | 'routes' | 'members' | 'chat'

const roleOrder: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 }

export function OffroadTripModal({ trip, isOpen, onClose, onTripUpdate }: OffroadTripModalProps) {
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const baseURL = import.meta.env.VITE_BASE_URL
  const [activeTab, setActiveTab] = useState<ModalTab>('details')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [inviteUsername, setInviteUsername] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isOwner = trip?.members.some((m) => m.id === String(user?.id) && m.role === 'owner') ?? false
  const isAdmin = trip?.members.some((m) => m.id === String(user?.id) && (m.role === 'owner' || m.role === 'admin')) ?? false
  const isMember = trip?.members.some((m) => m.id === String(user?.id)) ?? false
  const pendingRequests = trip?.members.filter((m) => m.status === 'pending') ?? []

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('details')
      setJoinError(null)
      setInviteError(null)
      setInviteSuccess(null)
      setInviteUsername('')
    }
  }, [isOpen])

  // Load chat messages and connect to SignalR
  useEffect(() => {
    if (!isOpen || !trip || !token) {
      setChatMessages([])
      return
    }

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
        if (!stopped) await connection.invoke('JoinOffroadTrip', Number(trip.id))
      } catch (err) {
        console.error('Offroad chat connection failed', err)
      }
    }
    start()

    api
      .get(`api/OffroadTrip/get-messages/${trip.id}`)
      .then((res) => {
        if (Array.isArray(res.data)) setChatMessages(res.data)
      })
      .catch(() => {})

    return () => {
      stopped = true
      void (async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke('LeaveOffroadTrip', Number(trip.id))
          }
        } catch {
          /* ignore */
        }
        await connection.stop()
      })()
    }
  }, [isOpen, trip, token, baseURL])

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, activeTab])

  const sendMessage = async () => {
    if (!newMessage.trim() || !connectionRef.current || !trip) return
    try {
      await connectionRef.current.invoke('SendMessage', Number(trip.id), newMessage.trim())
      setNewMessage('')
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const exportRouteGpx = async (routeId: number) => {
    if (!trip) return
    const res = await api.get(`api/OffroadTrip/export-route-gpx/${trip.id}/${routeId}`, {
      responseType: 'blob',
    })
    downloadBlob(res.data, `route-${routeId}.gpx`)
  }

  const exportTripGpx = async () => {
    if (!trip) return
    const res = await api.get(`api/OffroadTrip/export-trip-gpx/${trip.id}`, { responseType: 'blob' })
    downloadBlob(res.data, `offroad-trip-${trip.id}.gpx`)
  }

  const requestMembership = async () => {
    if (!trip) return
    setIsJoining(true)
    setJoinError(null)
    try {
      await api.post('api/OffroadTrip/membership-request', { tripId: Number(trip.id) })
      // Refresh trip data
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      setJoinError(getErrorMessage(err))
    } finally {
      setIsJoining(false)
    }
  }

  const respondToRequest = async (memberId: string, accept: boolean) => {
    if (!trip) return
    try {
      await api.patch('api/OffroadTrip/membership-response', {
        tripId: Number(trip.id),
        memberId: Number(memberId),
        accept,
      })
      // Refresh trip data
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const removeMember = async (memberId: string) => {
    if (!trip || !window.confirm('Are you sure you want to remove this member?')) return
    try {
      await api.delete(`api/OffroadTrip/remove-member/${trip.id}/${memberId}`)
      // Refresh trip data
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const changeMemberRole = async (memberId: string, newRole: MemberRole) => {
    if (!trip) return
    try {
      await api.patch('api/OffroadTrip/change-role', {
        tripId: Number(trip.id),
        memberId: Number(memberId),
        newRole,
      })
      // Refresh trip data
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trip || !inviteUsername.trim()) return
    setIsInviting(true)
    setInviteError(null)
    setInviteSuccess(null)
    try {
      await api.post('api/OffroadTrip/membership-request', {
        tripId: Number(trip.id),
        username: inviteUsername.trim(),
      })
      setInviteSuccess(`Invitation sent to ${inviteUsername}`)
      setInviteUsername('')
      // Refresh trip data
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      setInviteError(getErrorMessage(err))
    } finally {
      setIsInviting(false)
    }
  }

  const sortedMembers = [...(trip?.members ?? [])].sort((a, b) => {
    const statusOrder = { accepted: 0, pending: 1 }
    const aStatus = statusOrder[a.status as keyof typeof statusOrder] ?? 2
    const bStatus = statusOrder[b.status as keyof typeof statusOrder] ?? 2
    if (aStatus !== bStatus) return aStatus - bStatus
    return roleOrder[a.role as MemberRole] - roleOrder[b.role as MemberRole]
  })

  const totalKm = (trip?.routes ?? []).reduce((sum, r) => sum + r.distanceMeters, 0) / 1000

  return (
    <AnimatePresence>
      {isOpen && trip && (
        <motion.div
          className="modal-scrim offroad-modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="offroad-trip-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="offroad-modal-header">
              <div className="offroad-modal-header-content">
                <span className="discovery-offroad-badge">
                  <FiMap aria-hidden /> {getTripStatusLabel(trip.status)}
                </span>
                <h2>{trip.title}</h2>
                <p className="offroad-modal-description">{trip.description}</p>
                <div className="offroad-modal-meta">
                  <span>{formatDisplayDate(trip.startingDate)} – {formatDisplayDate(trip.endingDate)}</span>
                  <span>·</span>
                  <span>{trip.currentMembers}/{trip.maxParticipants} members</span>
                  <span>·</span>
                  <span>{trip.price} RON</span>
                  <span>·</span>
                  <span>{totalKm.toFixed(1)} km total</span>
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm offroad-modal-close" onClick={onClose}>
                <FiX />
              </button>
            </div>

            {/* Join Button for non-members */}
            {!isMember && (
              <div className="offroad-modal-join-banner">
                <p>Join this offroad adventure to access routes and chat with the crew.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={requestMembership}
                  disabled={isJoining}
                >
                  {isJoining ? 'Requesting...' : 'Request to join'}
                </button>
                {joinError && <p className="error-text">{joinError}</p>}
              </div>
            )}

            {/* Tabs */}
            <div className="offroad-modal-tabs">
              <button
                type="button"
                className={`offroad-modal-tab ${activeTab === 'details' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                <FiMap /> Routes
              </button>
              <button
                type="button"
                className={`offroad-modal-tab ${activeTab === 'members' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('members')}
              >
                <FiUsers /> Members ({trip.members.length})
              </button>
              <button
                type="button"
                className={`offroad-modal-tab ${activeTab === 'chat' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <FiMessageSquare /> Chat
              </button>
            </div>

            {/* Tab Content */}
            <div className="offroad-modal-content">
              {/* Routes Tab */}
              {activeTab === 'details' && (
                <div className="offroad-modal-routes">
                  <div className="offroad-modal-map">
                    <OffroadRouteMap routes={trip.routes} selectedRouteId={selectedRouteId} height="240px" />
                  </div>

                  <div className="offroad-modal-routes-header">
                    <h3>Trip Routes ({trip.routes.length})</h3>
                    {trip.routes.length > 0 && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={exportTripGpx}>
                        <FiDownload /> Export all GPX
                      </button>
                    )}
                  </div>

                  {trip.routes.length === 0 ? (
                    <div className="offroad-empty-routes">
                      <p>No routes yet. Import a GPX file or draw a track on the map.</p>
                      {isAdmin && (
                        <Link className="btn btn-primary" to={`/app/offroad/${trip.id}/route/new`} onClick={onClose}>
                          <FiPlus /> Add first route
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="offroad-modal-route-list">
                      {trip.routes.map((route) => (
                        <div
                          key={route.id}
                          className={`offroad-route-card ${selectedRouteId === route.id ? 'is-selected' : ''}`}
                        >
                          <div className="offroad-route-card-header">
                            <h4>{route.name}</h4>
                            <span
                              className={`offroad-route-source ${route.source === 'Drawn' ? 'offroad-route-source--drawn' : ''}`}
                            >
                              {route.source}
                            </span>
                          </div>
                          <div className="offroad-route-meta">
                            <span>Days <strong>{route.startDay}–{route.endDay}</strong></span>
                            <span><strong>{(route.distanceMeters / 1000).toFixed(1)} km</strong></span>
                            {route.elevationGainMeters > 0 && (
                              <span><strong>{Math.round(route.elevationGainMeters)} m</strong> elev.</span>
                            )}
                          </div>
                          {route.note && <p className="muted">{route.note}</p>}
                          <div className="offroad-route-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setSelectedRouteId(route.id)}
                            >
                              Show on map
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => exportRouteGpx(route.id)}
                            >
                              <FiDownload /> GPX
                            </button>
                            {isAdmin && (
                              <>
                                <Link
                                  className="btn btn-ghost btn-sm"
                                  to={`/app/offroad/${trip.id}/route/${route.id}/edit`}
                                  onClick={onClose}
                                >
                                  <FiEdit2 />
                                </Link>
                                <Link
                                  className="btn btn-ghost btn-sm"
                                  to={`/app/offroad/${trip.id}/route/${route.id}/edit`}
                                  onClick={onClose}
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <FiTrash2 />
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAdmin && trip.routes.length > 0 && (
                    <Link
                      className="btn btn-primary"
                      to={`/app/offroad/${trip.id}/route/new`}
                      onClick={onClose}
                      style={{ marginTop: '1rem' }}
                    >
                      <FiPlus /> Add route
                    </Link>
                  )}
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="offroad-modal-members">
                  {/* Invite Section - Only for admins */}
                  {isAdmin && (
                    <form className="offroad-invite-form" onSubmit={inviteMember}>
                      <h4>Invite Member</h4>
                      <div className="offroad-invite-input-group">
                        <input
                          type="text"
                          className="input"
                          placeholder="Enter username..."
                          value={inviteUsername}
                          onChange={(e) => setInviteUsername(e.target.value)}
                          disabled={isInviting}
                        />
                        <button type="submit" className="btn btn-primary" disabled={isInviting || !inviteUsername.trim()}>
                          <FiUserPlus /> {isInviting ? 'Inviting...' : 'Invite'}
                        </button>
                      </div>
                      {inviteError && <p className="error-text">{inviteError}</p>}
                      {inviteSuccess && <p className="success-text">{inviteSuccess}</p>}
                    </form>
                  )}

                  {/* Pending Requests Section - Only for admins */}
                  {isAdmin && pendingRequests.length > 0 && (
                    <div className="offroad-pending-requests">
                      <h4>Pending Requests ({pendingRequests.length})</h4>
                      {pendingRequests.map((member) => (
                        <div key={member.id} className="offroad-member-card offroad-member-card--pending">
                          <div className="offroad-member-info">
                            <img
                              src={getAvatarUrl(member.username, member.avatarUrl)}
                              alt={member.username}
                              className="offroad-member-avatar"
                            />
                            <div>
                              <strong>{member.username}</strong>
                              <span className="offroad-member-role">Wants to join</span>
                            </div>
                          </div>
                          <div className="offroad-member-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => respondToRequest(member.id, true)}
                            >
                              <FiCheck /> Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => respondToRequest(member.id, false)}
                            >
                              <FiX /> Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Members List */}
                  <div className="offroad-members-list">
                    <h4>Members</h4>
                    {sortedMembers
                      .filter((m) => m.status === 'accepted' || m.status === 'active')
                      .map((member) => (
                        <div key={member.id} className="offroad-member-card">
                          <div className="offroad-member-info">
                            <img
                              src={getAvatarUrl(member.username, member.avatarUrl)}
                              alt={member.username}
                              className="offroad-member-avatar"
                            />
                            <div>
                              <strong>{member.username}</strong>
                              <span className={`offroad-member-role offroad-member-role--${member.role}`}>
                                {member.role}
                              </span>
                            </div>
                          </div>
                          <div className="offroad-member-actions">
                            {/* Role change - only owner can change roles, can't change owner */}
                            {isOwner && member.role !== 'owner' && (
                              <select
                                className="input input-sm"
                                value={member.role}
                                onChange={(e) => changeMemberRole(member.id, e.target.value as MemberRole)}
                                title="Change role"
                              >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                              </select>
                            )}
                            {/* Remove member - owner can remove anyone except themselves, admin can remove members */}
                            {((isOwner && member.role !== 'owner') || (isAdmin && member.role === 'member')) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeMember(member.id)}
                                title="Remove member"
                              >
                                <FiTrash2 />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="offroad-modal-chat">
                  {!isMember ? (
                    <div className="offroad-chat-locked">
                      <FiMessageSquare size={48} />
                      <p>Join this trip to access the crew chat.</p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={requestMembership}
                        disabled={isJoining}
                      >
                        {isJoining ? 'Requesting...' : 'Request to join'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="offroad-modal-chat-messages">
                        {chatMessages.length === 0 ? (
                          <p className="muted">No messages yet. Say hello to the crew!</p>
                        ) : (
                          chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`offroad-chat-bubble ${msg.username === user?.username ? 'is-self' : ''}`}
                            >
                              <div className="offroad-chat-bubble-header">
                                <img
                                  src={getAvatarUrl(msg.username, msg.profileUrl)}
                                  alt={msg.username}
                                  className="offroad-chat-avatar"
                                />
                                <strong>{msg.username}</strong>
                                <span className="offroad-chat-time">
                                  {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p>{msg.content}</p>
                            </div>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="offroad-modal-chat-compose">
                        <input
                          className="input"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Message the crew..."
                          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button type="button" className="btn btn-primary" onClick={sendMessage} disabled={!newMessage.trim()}>
                          Send
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
