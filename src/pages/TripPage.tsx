import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useSelector } from 'react-redux'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { TripRouteMap } from '../components/TripRouteMap'
import type { ChatMessage, MemberRole, Trip, TripMember, User } from '../types/models'
import api from '../data/api'
import { AxiosError } from 'axios'
import {
  formatDisplayDate,
  formatDisplayDateRange,
  toLocalStartOfDay,
} from '../utils/dateDisplay'

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

type TripWorkspaceTab = 'overview' | 'map' | 'members' | 'chat'

interface TripTabItem {
  key: TripWorkspaceTab
  label: string
}

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type TripFetchState = 'loading' | 'ready' | 'not-found' | 'error'

const memberTabs: TripTabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'map', label: 'Map + Timeline' },
  { key: 'members', label: 'Members' },
  { key: 'chat', label: 'Chat' },
]

const visitorTabs: TripTabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'map', label: 'Map + Timeline' },
  { key: 'members', label: 'Members' },
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
  // Timeline coordinates are stored as [lng, lat] in map data.
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

const roleOrder: MemberRole[] = ['owner', 'admin', 'member']

const tabTransition = {
  duration: 0.26,
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

        setTrip(nextTrip)
        setFetchState('ready')
      } catch (error: unknown) {
        if (!isMounted) {
          return
        }

        if (error instanceof AxiosError && error.response?.status === 404) {
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

  if (!tripId) {
    return (
      <section className="page trip-page">
        <section className="panel">
          <p className="eyebrow">Trip space</p>
          <h1>Trip not found</h1>
          <p>This trip does not exist anymore or the link is invalid.</p>
          <Link className="btn btn-primary" to="/discover">
            Back to discovery
          </Link>
        </section>
      </section>
    )
  }

  if (fetchState === 'loading') {
    return (
      <section className="page trip-page">
        <section className="panel">
          <p className="eyebrow">Trip space</p>
          <h1>Loading trip workspace</h1>
          <p>Fetching the latest trip details and membership state...</p>
        </section>
      </section>
    )
  }

  if (fetchState === 'error') {
    return (
      <section className="page trip-page">
        <section className="panel">
          <p className="eyebrow">Trip space</p>
          <h1>Could not load this trip</h1>
          <p>There was a problem reaching the trip service. Please try again later.</p>
          <Link className="btn btn-primary" to="/discover">
            Back to discovery
          </Link>
        </section>
      </section>
    )
  }



  if (!trip) {
    return (
      <section className="page trip-page">
        <section className="panel">
          <p className="eyebrow">Trip space</p>
          <h1>Trip not found</h1>
          <p>This trip does not exist anymore or the link is invalid.</p>
          <Link className="btn btn-primary" to="/discover">
            Back to discovery
          </Link>
        </section>
      </section>
    )
  }

  return <TripPageContent key={trip.id} trip={trip} isMember={trip.isUserMember} />
}

interface TripPageContentProps {
  trip: Trip
  isMember: boolean
}

function TripPageContent({ trip, isMember }: TripPageContentProps) {
  const authenticatedUser = useSelector((state: AuthStoreState) => state.auth.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedDay, setSelectedDay] = useState(
    defaultSelectedDay(trip.startingDate, trip.timelines.length),
  )
  const [members, setMembers] = useState<TripMember[]>(trip.members)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [requestedJoin, setRequestedJoin] = useState(false)
  const tabListRef = useRef<HTMLElement | null>(null)

  const tabs = isMember ? memberTabs : visitorTabs
  const requestedTab = searchParams.get('view')
  const normalizedRequestedTab = requestedTab === 'timeline' ? 'map' : requestedTab

  const activeWorkspaceTab: TripWorkspaceTab =
    normalizedRequestedTab && tabs.some((tab) => tab.key === normalizedRequestedTab)
      ? (normalizedRequestedTab as TripWorkspaceTab)
      : isMember
        ? 'map'
        : 'overview'

  const currentStop =
    trip.timelines.find((timelineStop) => timelineStop.day === selectedDay) ??
    trip.timelines[0]

  const selectedRouteDistanceKm = useMemo(
    () => calculateRouteDistanceKm(currentStop.fromCoords, currentStop.toCoords),
    [currentStop],
  )

  const normalizedUserName = authenticatedUser?.username.trim().toLowerCase()

  const viewerMember = members.find(
    (member) => {
      if (authenticatedUser && member.id === String(authenticatedUser.id)) {
        return true
      }

      if (!normalizedUserName) {
        return false
      }

      const normalizedMemberName = member.username.trim().toLowerCase()

      return (
        normalizedMemberName === normalizedUserName ||
        normalizedMemberName.includes(normalizedUserName)
      )
    },
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

  const selectTab = (nextTab: TripWorkspaceTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', nextTab)
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
      nextIndex = (currentIndex + 1) % tabs.length
    }

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    }

    if (event.key === 'Home') {
      nextIndex = 0
    }

    if (event.key === 'End') {
      nextIndex = tabs.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = tabs[nextIndex]
    selectTab(nextTab.key)
    focusTabAt(nextIndex)
  }

  const renderTimelineSelector = () => (
    <div className="timeline-list trip-route-timeline-list">
      {trip.timelines.map((timelineStop) => (
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
            {timelineStop.startingPoint} to {timelineStop.endPoint}
          </strong>
          <small>{timelineStop.note}</small>
        </button>
      ))}
    </div>
  )

  const renderMap = () => (
    <section
      className="panel trip-tab-panel"
      id="trip-panel-map"
      role="tabpanel"
      aria-labelledby="trip-tab-map"
      tabIndex={0}
    >
      <h2>Map and timeline</h2>
      <p>Select a day on the timeline and see the route update instantly on the map.</p>

      <div className="trip-route-combined">
        <div className="trip-route-timeline">
          <h3>Timeline days</h3>
          {renderTimelineSelector()}
        </div>

        <div className="trip-route-map">
          <p className="trip-submeta">
            Day {currentStop.day}: {currentStop.startingPoint} to {currentStop.endPoint}
          </p>
          <TripRouteMap timeline={trip.timelines} selectedDay={selectedDay} />
        </div>
      </div>
    </section>
  )

  const renderOverviewRoutePreview = () => (
    <section className="trip-overview-preview">
      <img src={trip.imageUrl} alt={trip.title} className="trip-overview-cover" />

      <div className="trip-overview-content">
        <div className="trip-overview-day">
          <p className="eyebrow">Route for selected day</p>
          <h3>Day {currentStop.day}</h3>
          <div className="trip-overview-route-line">
            <span className="trip-overview-location">{currentStop.startingPoint}</span>
            <span className="trip-overview-distance-pill">
              {selectedRouteDistanceKm.toFixed(1)} km
            </span>
            <span className="trip-overview-location">{currentStop.endPoint}</span>
          </div>
          <p className="trip-submeta">{formatDisplayDate(currentStop.date)}</p>
          <p className="trip-overview-note">{currentStop.note}</p>
        </div>

        <div className="trip-overview-map">
          <TripRouteMap timeline={trip.timelines} selectedDay={selectedDay} />
        </div>
      </div>
    </section>
  )

  const renderMembers = () => (
    <section
      className="panel trip-tab-panel"
      id="trip-panel-members"
      role="tabpanel"
      aria-labelledby="trip-tab-members"
      tabIndex={0}
    >
      <h2>{isMember ? 'Members and roles' : 'Current members'}</h2>
      <p>
        {isMember
          ? 'Owners and admins can update roles and remove members.'
          : 'Review who is currently in this trip.'}
      </p>

      <ul className="member-list">
        {members.map((member) => (
          <li key={member.id} className="member-row">
            <img className="avatar" src={member.avatarUrl} alt={member.username} />
            <div>
              <p className="list-title">{member.username}</p>
            </div>

            {isMember && canManageMembers && member.role !== 'owner' ? (
              <>
                <select
                  className="input member-role-select"
                  value={member.role}
                  onChange={(event) =>
                    handleRoleChange(member.id, event.target.value as MemberRole)
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
    </section>
  )

  const renderChat = () => (
    <section
      className="panel trip-tab-panel"
      id="trip-panel-chat"
      role="tabpanel"
      aria-labelledby="trip-tab-chat"
      tabIndex={0}
    >
      <h2>Group chat</h2>
      <p>Coordinate fast decisions, logistics, and check-ins with everyone.</p>

      <div className="chat-box">
        {chatMessages.map((message) => (
          <div key={message.id} className="chat-message">
            <p className="chat-meta">
              {message.author} ({message.role}) - {message.at}
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
    </section>
  )

  const renderOverview = () => {
    if (isMember) {
      return (
        <section
          className="panel trip-tab-panel"
          id="trip-panel-overview"
          role="tabpanel"
          aria-labelledby="trip-tab-overview"
          tabIndex={0}
        >
          <h2>Trip workspace overview</h2>
          <p>
            Navigate the sections above to focus on one operational area at a
            time: map, timeline, member management, or chat.
          </p>
          <div className="trip-stat-row">
            <span>{trip.currentMembers}/{trip.maxParticipants} members</span>
            <span>{trip.timelines.length} days in timeline</span>
            <span>{trip.price} EUR per person</span>
          </div>

          {renderOverviewRoutePreview()}

          <div className="chip-row">
            {trip.tags.map((tag) => (
              <span key={tag} className="chip chip-static">
                {tag}
              </span>
            ))}
          </div>
          <p className="info-banner">
            Route defaults to today&apos;s day. If the trip has not started yet,
            day 1 is selected automatically.
          </p>
        </section>
      )
    }

    return (
      <section
        className="panel trip-tab-panel"
        id="trip-panel-overview"
        role="tabpanel"
        aria-labelledby="trip-tab-overview"
        tabIndex={0}
      >
        <h2>Join this trip</h2>
        <p>
          You are not in this group yet. Explore the map, timeline, and members,
          then send a request if this trip fits your style.
        </p>
        <div className="trip-stat-row">
          <span>{trip.price} EUR / person</span>
          <span>{trip.maxParticipants} max members</span>
          <span>{trip.timelines.length} timeline days</span>
        </div>

        {renderOverviewRoutePreview()}

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
      </section>
    )
  }

  const renderActiveTab = () => {
    switch (activeWorkspaceTab) {
      case 'map':
        return renderMap()
      case 'members':
        return renderMembers()
      case 'chat':
        return isMember ? renderChat() : renderOverview()
      case 'overview':
      default:
        return renderOverview()
    }
  }

  return (
    <section className="page trip-page">
      <header className="panel trip-header">
        <p className="eyebrow">{isMember ? 'Trip workspace' : 'Trip details'}</p>
        <h1>{trip.title}</h1>
        <p>{trip.description}</p>
        <p className="trip-meta">
          {formatDisplayDateRange(trip.startingDate, trip.endingDate)} - {trip.currentMembers}/{trip.maxParticipants}{' '}
          members
        </p>
      </header>

      <nav
        ref={tabListRef}
        className="trip-view-bar"
        aria-label="Trip workspace sections"
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            id={`trip-tab-${tab.key}`}
            className={
              activeWorkspaceTab === tab.key
                ? 'trip-view-btn is-active'
                : 'trip-view-btn'
            }
            role="tab"
            aria-selected={activeWorkspaceTab === tab.key}
            aria-controls={`trip-panel-${tab.key}`}
            tabIndex={activeWorkspaceTab === tab.key ? 0 : -1}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeWorkspaceTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={tabTransition}
        >
          {renderActiveTab()}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
