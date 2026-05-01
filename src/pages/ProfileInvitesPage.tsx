import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiMail, FiShield, FiUsers } from 'react-icons/fi'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'

import type { User } from '../types/models'
import api from '../data/api'

interface AuthStoreState {
  auth: {
    user: User | null
  }
}

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

export function ProfileInvitesPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [hiddenInviteIds, setHiddenInviteIds] = useState<string[]>([])
  const [isRespondingInviteId, setIsRespondingInviteId] = useState<string | null>(null)
  const [inviteResponseAction, setInviteResponseAction] = useState<'Accepted' | 'Declined' | null>(null)

  useEffect(() => {
    if (user) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [user, navigate])

  const pendingInvites = useMemo(() => {
    if (!user) return []

    const invites: Array<{ tripId: string; invitedId: string; tripTitle: string }> = []

    ;(user.trips ?? []).forEach((trip) => {
      const memberEntry = trip.members?.find((m) => {
        const usernameMatch = String((m as unknown as Record<string, unknown>).username) === String(user.username)
        const memberObj = m as unknown as Record<string, unknown>
        const memberStatus = String(memberObj.status ?? memberObj.memberStatus ?? memberObj.member_status ?? '').toLowerCase()
        return usernameMatch && memberStatus === 'invited'
      })
      if (!memberEntry) return

      const memberIdStr = String((memberEntry as unknown as Record<string, unknown>).id ?? '')
      if (hiddenInviteIds.includes(memberIdStr)) return

      invites.push({ tripId: trip.id, invitedId: memberIdStr, tripTitle: trip.title })
    })

    return invites
  }, [user, hiddenInviteIds])

  const respondToInvite = async (tripId: string, response: 'Accepted' | 'Declined') => {
    if (isRespondingInviteId === tripId) return

    setIsRespondingInviteId(tripId)
    setInviteResponseAction(response)

    try {
      const res = await api.post('api/trip/membership-response', {
        tripId: tripId,
        invitedId: user?.id,
        memberStatus: "Invited",
        action: response === 'Accepted' ? 'accept' : 'decline',
      })
      if (res.status === 200) {
        setHiddenInviteIds((previous) => (previous.includes(tripId) ? previous : [...previous, tripId]))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsRespondingInviteId(null)
      setInviteResponseAction(null)
    }
  }

  if (!user) {
    return (
      <section className="page invites-page">
        <section className="panel invites-main-panel">
          <p className="eyebrow">Profile invites</p>
          <h1>You are not logged in</h1>
          <p>Log in to access invite requests and collaboration controls.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </section>
      </section>
    )
  }

  return (
    <section className="page invites-page">
      <motion.header
        className="panel invites-shell-head"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={revealTransition}
      >
        <p className="eyebrow">Profile invites</p>
        <h1>Invites control room</h1>
        <p>
          Handle collaboration invitations and keep your group-entry workflow organized from one
          place.
        </p>
        <Link className="btn btn-ghost invites-back-link" to="/profile?tab=notifications">
          <FiArrowLeft aria-hidden="true" />
          Back to notifications
        </Link>
      </motion.header>

      <motion.section
        className="panel invites-main-panel"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={revealTransition}
      >
        <div className="invites-grid">
          <article className="invite-block">
            <p className="eyebrow">Pending</p>
            <h2>Incoming invites</h2>
            <p>Trip room invitations will appear here as soon as other travelers send them.</p>

            <div className="invite-empty-state">
              <FiMail aria-hidden="true" />
              <h3>Your Invites</h3>
              {pendingInvites.length > 0 ? (
                <ul className="invite-list">
                  {pendingInvites.map((invite) => (
                    <li key={invite.tripId} className="invite-card">
                      <div className="invite-card-head">
                        <p className="invite-card-title">{invite.tripTitle}</p>
                        <span className="invite-status-pill">Invited</span>
                      </div>

                      <div className="invite-card-actions">
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={isRespondingInviteId === invite.tripId}
                          onClick={() => {
                            void respondToInvite(invite.tripId, 'Accepted')
                          }}
                        >
                          {isRespondingInviteId === invite.tripId && inviteResponseAction === 'Accepted'
                            ? 'Accepting...'
                            : 'Accept'}
                        </button>
                        <button
                          className="btn btn-ghost invite-decline-btn"
                          type="button"
                          disabled={isRespondingInviteId === invite.tripId}
                          onClick={() => {
                            void respondToInvite(invite.tripId, 'Declined')
                          }}
                        >
                          {isRespondingInviteId === invite.tripId && inviteResponseAction === 'Declined'
                            ? 'Declining...'
                            : 'Decline'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="invite-muted-state">No pending invites with status Invited.</p>
              )}
              <Link className="btn btn-primary" to="/discover">
                Explore trip rooms
              </Link>
            </div>
          </article>

          <article className="invite-block">
            <p className="eyebrow">Visibility</p>
            <h2>Invite experience preferences</h2>
            <p>Choose how you want invite activity to appear in your profile workspace.</p>

            <div className="invite-setting-list">
              <article className="invite-setting-item">
                <FiUsers aria-hidden="true" />
                <div>
                  <h3>Group collaboration requests</h3>
                  <p>Receive invite alerts when a trip organizer adds you to a route room.</p>
                </div>
              </article>

              <article className="invite-setting-item">
                <FiShield aria-hidden="true" />
                <div>
                  <h3>Role and trust checkpoints</h3>
                  <p>Get notified when invite terms include role assignments or admin expectations.</p>
                </div>
              </article>
            </div>

            <p className="invite-setting-note">
              This page is UI-only right now, so preference controls are intentionally visual.
            </p>
          </article>
        </div>
      </motion.section>
    </section>
  )
}
