import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { TripRouteMap } from '../components/TripRouteMap'
import {
  getTripById,
  isUserInTrip,
  mockTripChat,
  mockUserProfile,
} from '../data/mockData'
import type { ChatMessage, MemberRole, Trip, TripMember } from '../types/models'

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24

type TripWorkspaceTab = 'overview' | 'map' | 'timeline' | 'members' | 'chat'

interface TripTabItem {
  key: TripWorkspaceTab
  label: string
}

const memberTabs: TripTabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'map', label: 'Map' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'members', label: 'Members' },
  { key: 'chat', label: 'Chat' },
]

const visitorTabs: TripTabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'map', label: 'Map' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'members', label: 'Members' },
]

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

const tabTransition = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1] as const,
}

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
          <p>This trip does not exist anymore or the link is invalid.</p>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedDay, setSelectedDay] = useState(
    defaultSelectedDay(trip.startDate, trip.timeline.length),
  )
  const [members, setMembers] = useState<TripMember[]>(trip.members)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockTripChat)
  const [newMessage, setNewMessage] = useState('')
  const [requestedJoin, setRequestedJoin] = useState(false)
  const tabListRef = useRef<HTMLElement | null>(null)

  const tabs = isMember ? memberTabs : visitorTabs
  const requestedTab = searchParams.get('view')
  const activeWorkspaceTab: TripWorkspaceTab =
    requestedTab && tabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as TripWorkspaceTab)
      : isMember
        ? 'map'
        : 'overview'

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

  const renderTimeline = () => (
    <section
      className="panel trip-tab-panel"
      id="trip-panel-timeline"
      role="tabpanel"
      aria-labelledby="trip-tab-timeline"
      tabIndex={0}
    >
      <h2>Day-by-day timeline</h2>
      <p>Select any day to inspect the route segment details.</p>
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
  )

  const renderMap = () => (
    <section
      className="panel trip-tab-panel"
      id="trip-panel-map"
      role="tabpanel"
      aria-labelledby="trip-tab-map"
      tabIndex={0}
    >
      <h2>Route map</h2>
      <p>
        Day {currentStop.day}: {currentStop.from} to {currentStop.to}
      </p>
      <TripRouteMap timeline={trip.timeline} selectedDay={selectedDay} />
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
            <img className="avatar" src={member.avatarUrl} alt={member.name} />
            <div>
              <p className="list-title">{member.name}</p>
              <p>{member.location}</p>
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
            <span>{trip.currentMembers}/{trip.maxMembers} members</span>
            <span>{trip.timeline.length} days in timeline</span>
            <span>{trip.budgetPerPerson} EUR per person</span>
          </div>
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
      </section>
    )
  }

  const renderActiveTab = () => {
    switch (activeWorkspaceTab) {
      case 'map':
        return renderMap()
      case 'timeline':
        return renderTimeline()
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
          {trip.startDate} - {trip.endDate} - {trip.currentMembers}/{trip.maxMembers}{' '}
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
