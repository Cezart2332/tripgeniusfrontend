import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TripRouteMap } from '../components/TripRouteMap'
import {
  getTripById,
  isUserInTrip,
  mockTripChat,
  mockUserProfile,
} from '../data/mockData'
import type { ChatMessage, MemberRole, Trip, TripMember } from '../types/models'

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

const defaultSelectedDay = (startDate: string, timelineLength: number): number => {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime()) || timelineLength < 1) {
    return 1
  }

  const today = new Date()
  const dayDiff = Math.floor(
    (today.getTime() - start.getTime()) / MILLISECONDS_PER_DAY,
  )

  if (dayDiff < 0) {
    return 1
  }

  if (dayDiff + 1 > timelineLength) {
    return timelineLength
  }

  return dayDiff + 1
}

const roleOrder: MemberRole[] = ['owner', 'admin', 'member']

export function TripPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const trip = useMemo(() => {
    if (!tripId) {
      return undefined
    }

    return getTripById(tripId)
  }, [tripId])

  const isMember = useMemo(
    () => (trip ? isUserInTrip(trip, mockUserProfile) : false),
    [trip],
  )

  if (!trip) {
    return (
      <section className="page trip-page">
        <section className="panel">
          <p className="eyebrow">Trip space</p>
          <h1>Trip not found</h1>
          <p>
            This trip does not exist anymore or the link is invalid.
          </p>
          <Link className="btn btn-primary" to="/discover">
            Back to discovery
          </Link>
        </section>
      </section>
    )
  }

  return <TripPageContent key={trip.id} trip={trip} isMember={isMember} />
}

interface TripPageContentProps {
  trip: Trip
  isMember: boolean
}

function TripPageContent({ trip, isMember }: TripPageContentProps) {
  const [selectedDay, setSelectedDay] = useState(
    defaultSelectedDay(trip.startDate, trip.timeline.length),
  )
  const [members, setMembers] = useState<TripMember[]>(trip.members)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockTripChat)
  const [newMessage, setNewMessage] = useState('')
  const [requestedJoin, setRequestedJoin] = useState(false)

  const currentStop =
    trip.timeline.find((timelineStop) => timelineStop.day === selectedDay) ??
    trip.timeline[0]

  const viewerMember = members.find(
    (member) =>
      member.id === mockUserProfile.id ||
      member.name.toLowerCase().includes(mockUserProfile.name.toLowerCase()),
  )

  const viewerRole: MemberRole = viewerMember?.role ?? 'member'
  const canManageMembers = viewerRole === 'owner' || viewerRole === 'admin'

  const handleRoleChange = (memberId: string, nextRole: MemberRole) => {
    setMembers((previous) =>
      previous.map((member) =>
        member.id === memberId ? { ...member, role: nextRole } : member,
      ),
    )
  }

  const handleRemove = (memberId: string) => {
    setMembers((previous) => previous.filter((member) => member.id !== memberId))
  }

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = newMessage.trim()
    if (!content) {
      return
    }

    const now = new Date()
    const at = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`

    setChatMessages((previous) => [
      ...previous,
      {
        id: `chat-${previous.length + 1}`,
        author: 'You',
        role: 'owner',
        content,
        at,
      },
    ])
    setNewMessage('')
  }

  if (!isMember) {
    return (
      <section className="page trip-page">
        <header className="panel trip-header">
          <p className="eyebrow">Trip details</p>
          <h1>{trip.title}</h1>
          <p>{trip.description}</p>
          <p className="trip-meta">
            {trip.startDate} - {trip.endDate} • {trip.currentMembers}/{trip.maxMembers}{' '}
            members
          </p>
        </header>

        <div className="trip-layout">
          <section className="panel">
            <h2>Planned route preview</h2>
            <p>
              Day {currentStop.day}: {currentStop.from} to {currentStop.to}
            </p>
            <TripRouteMap timeline={trip.timeline} selectedDay={selectedDay} />

            <h2>Timeline</h2>
            <div className="timeline-list">
              {trip.timeline.map((timelineStop) => (
                <button
                  key={timelineStop.day}
                  type="button"
                  className={
                    selectedDay === timelineStop.day
                      ? 'timeline-item is-active'
                      : 'timeline-item'
                  }
                  onClick={() => setSelectedDay(timelineStop.day)}
                >
                  <span>Day {timelineStop.day}</span>
                  <strong>
                    {timelineStop.from} to {timelineStop.to}
                  </strong>
                  <small>{timelineStop.note}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="trip-side-column">
            <article className="panel trip-request-card">
              <h2>Join this trip</h2>
              <p>
                You are currently not part of this group. Review the details and
                send a join request to the owners/admins.
              </p>
              <div className="trip-stat-row">
                <span>{trip.budgetPerPerson} EUR / person</span>
                <span>{trip.maxMembers} max members</span>
                <span>{trip.timeline.length} timeline days</span>
              </div>

              <div className="chip-row">
                {trip.tags.map((tag) => (
                  <span key={tag} className="chip chip-static">
                    {tag}
                  </span>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setRequestedJoin(true)}
                disabled={requestedJoin}
              >
                {requestedJoin ? 'Request sent' : 'Request to join'}
              </button>

              {requestedJoin ? (
                <p className="info-banner">
                  Join request sent. Trip owners and admins will review it soon.
                </p>
              ) : null}
            </article>

            <article className="panel">
              <h2>Current members</h2>
              <ul className="member-list">
                {trip.members.map((member) => (
                  <li key={member.id} className="member-row">
                    <img className="avatar" src={member.avatarUrl} alt={member.name} />
                    <div>
                      <p className="list-title">{member.name}</p>
                      <p>{member.location}</p>
                    </div>
                    <span className="role-pill">{member.role}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      </section>
    )
  }

  return (
    <section className="page trip-page">
      <header className="panel trip-header">
        <p className="eyebrow">Trip space</p>
        <h1>{trip.title}</h1>
        <p>{trip.description}</p>
        <p className="trip-meta">
          {trip.startDate} - {trip.endDate} • {trip.currentMembers}/{trip.maxMembers}{' '}
          members
        </p>
        <p className="info-banner">
          Route defaults to today&apos;s trip day. If the trip has not started yet,
          day 1 route is shown automatically.
        </p>
      </header>

      <div className="trip-layout">
        <section className="panel">
          <h2>Interactive route map</h2>
          <p>
            Day {currentStop.day}: {currentStop.from} to {currentStop.to}
          </p>
          <TripRouteMap timeline={trip.timeline} selectedDay={selectedDay} />

          <h2>Timeline</h2>
          <div className="timeline-list">
            {trip.timeline.map((timelineStop) => (
              <button
                key={timelineStop.day}
                type="button"
                className={
                  selectedDay === timelineStop.day
                    ? 'timeline-item is-active'
                    : 'timeline-item'
                }
                onClick={() => setSelectedDay(timelineStop.day)}
              >
                <span>Day {timelineStop.day}</span>
                <strong>
                  {timelineStop.from} to {timelineStop.to}
                </strong>
                <small>{timelineStop.note}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="trip-side-column">
          <article className="panel">
            <h2>Members and roles</h2>
            <p>Owners and admins can manage members and update trip locations.</p>

            <ul className="member-list">
              {members.map((member) => (
                <li key={member.id} className="member-row">
                  <img className="avatar" src={member.avatarUrl} alt={member.name} />
                  <div>
                    <p className="list-title">{member.name}</p>
                    <p>{member.location}</p>
                  </div>

                  {canManageMembers && member.role !== 'owner' ? (
                    <>
                      <select
                        className="input member-role-select"
                        value={member.role}
                        onChange={(event) =>
                          handleRoleChange(
                            member.id,
                            event.target.value as MemberRole,
                          )
                        }
                      >
                        {roleOrder.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => handleRemove(member.id)}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="role-pill">{member.role}</span>
                  )}
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <h2>Trip chat</h2>
            <div className="chat-box">
              {chatMessages.map((message) => (
                <div key={message.id} className="chat-message">
                  <p className="chat-meta">
                    {message.author} ({message.role}) • {message.at}
                  </p>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>

            <form className="chat-form" onSubmit={sendMessage}>
              <input
                className="input"
                placeholder="Write a message to your group"
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                Send
              </button>
            </form>
          </article>
        </section>
      </div>
    </section>
  )
}
