import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Lenis from '@studio-freight/lenis'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FiBell,
  FiCompass,
  FiCpu,
  FiHome,
  FiLogIn,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiUser,
  FiUserPlus,
  FiX,
  FiDownload,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { useDispatch, useSelector } from 'react-redux'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { logout as logoutAction, setUser } from '../data/authSlice'
import api from '../data/api'
import type { Notification as AppNotification, User } from '../types/models'
interface NavItem {
  to: string
  label: string
  Icon: IconType
  end?: boolean
}

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

const primaryNavItems: NavItem[] = [
  { to: '/', label: 'Home', Icon: FiHome, end: true },
  { to: '/discover', label: 'Discover', Icon: FiCompass },
  { to: '/ai', label: 'AI Advisor', Icon: FiCpu },
]

const getNotificationContent = (notification: AppNotification): string => {
  const candidate =
    notification.content ??
    (notification as AppNotification & {
      Content?: string
      message?: string
      Message?: string
      text?: string
    }).Content ??
    (notification as AppNotification & {
      Content?: string
      message?: string
      Message?: string
      text?: string
    }).message ??
    (notification as AppNotification & {
      Content?: string
      message?: string
      Message?: string
      text?: string
    }).Message ??
    (notification as AppNotification & {
      Content?: string
      message?: string
      Message?: string
      text?: string
    }).text

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate
  }

  return 'New notification'
}

const formatNotificationTimestamp = (notification: AppNotification): string => {
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
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate)
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [hideHeader, setHideHeader] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSyncingUser, setIsSyncingUser] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const notificationMenuRef = useRef<HTMLDivElement | null>(null)
  const isSyncingUserRef = useRef(false)
  const outlet = useOutlet()
  const token = useSelector((state: AuthStoreState) => state.auth.token)

  const syncUserFromProfileFetch = useCallback(async () => {
    if (isSyncingUserRef.current) {
      return
    }

    isSyncingUserRef.current = true
    setIsSyncingUser(true)

    try {
      const res = await api.get('api/user/me')
      dispatch(setUser({ user: res.data }))
    } catch {
      // Ignore transient fetch errors to avoid interrupting UX.
    } finally {
      isSyncingUserRef.current = false
      setIsSyncingUser(false)
    }
  }, [dispatch])

  const isNotificationRead = (notification: AppNotification): boolean => {
    return Boolean(
      notification.isRead ??
      notification.read ??
      notification.IsRead ??
      notification.Read,
    )
  }

  const unreadNotifications = useMemo(() => {
    return (user?.notifications ?? []).filter((notification) => !isNotificationRead(notification))
  }, [user])

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await api.post('/api/auth/logout')
    } finally {
      dispatch(logoutAction())
      setIsLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
    })

    let rafId = 0

    const raf = (time: number) => {
      lenis.raf(time)
      rafId = window.requestAnimationFrame(raf)
    }

    rafId = window.requestAnimationFrame(raf)

    return () => {
      window.cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  useEffect(() => {
    let previousScrollY = window.scrollY

    const onScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > previousScrollY
      setHideHeader(scrollingDown && currentScrollY > 100)
      previousScrollY = currentScrollY
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setIsNotificationOpen(false)
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isNotificationOpen) {
      return
    }

    const closeWhenOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!notificationMenuRef.current?.contains(target)) {
        setIsNotificationOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false)
      }
    }

    window.addEventListener('mousedown', closeWhenOutside)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('mousedown', closeWhenOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isNotificationOpen])

  useEffect(() => {
    if (!user) {
      void syncUserFromProfileFetch()
    }
  }, [user, syncUserFromProfileFetch])

  useEffect(() => {
    if (!user) {
      setIsNotificationOpen(false)
    }
  }, [user])

  // Reset window scroll to 0 when location changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!token) {
      return
    }

    const intervalId = window.setInterval(() => {
      void syncUserFromProfileFetch()
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [token, syncUserFromProfileFetch])

  useEffect(() => {
    const handler = (e: any) => {
      console.log('PWA: beforeinstallprompt event fired')
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }
  return (
    <div className="app-shell">
      <div className="ambient-orbs" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="orb orb-three" />
      </div>

      <motion.header
        className="topbar"
        animate={{ y: hideHeader ? -125 : 0, opacity: 1 }}
        initial={{ y: -100, opacity: 0 }}
        transition={{ duration: 2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="brand-block">
          <img className="brand-logo" src="/fulllogo.svg" alt="TripGenius" />
        </div>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label="Toggle menu"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <FiX /> : <FiMenu />}
        </button>

        <nav className={`top-nav ${isMobileMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav-link is-active' : 'nav-link'
              }
            >
              <item.Icon className="nav-icon" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={`header-actions ${isMobileMenuOpen ? 'is-open' : ''}`}>
          {!user ? (
            <>
              {deferredPrompt && (
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={handleInstallClick}
                  style={{ gap: '0.4rem', border: '1px dashed var(--green-500)', color: 'var(--green-500)' }}
                >
                  <FiDownload aria-hidden="true" />
                  Install App
                </button>
              )}
              <Link className="btn btn-ghost header-auth" to="/login">
                <FiLogIn aria-hidden="true" />
                Login
              </Link>
              <Link className="btn btn-primary header-auth" to="/register">
                <FiUserPlus aria-hidden="true" />
                Register
              </Link>
            </>
          ) : null}

          {user ? (
            <>
              <div className="nav-notification-shell" ref={notificationMenuRef}>
                <button
                  type="button"
                  className={isNotificationOpen ? 'icon-link icon-button is-active' : 'icon-link icon-button'}
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={isNotificationOpen}
                  aria-controls="header-notification-menu"
                  aria-busy={isSyncingUser}
                  disabled={isSyncingUser}
                  onClick={() => {
                    if (isSyncingUser) {
                      return
                    }
                    setIsNotificationOpen((previous) => !previous)
                    void syncUserFromProfileFetch()
                  }}
                >
                  {isSyncingUser ? (
                    <span className="inline-spinner" aria-hidden="true" />
                  ) : (
                    <FiBell aria-hidden="true" />
                  )}
                  {unreadNotifications.length > 0 ? (
                    <span className="notification-badge" aria-hidden="true" />
                  ) : null}
                </button>

                <AnimatePresence>
                  {isNotificationOpen ? (
                    <motion.section
                      className="header-notification-dropdown"
                      id="header-notification-menu"
                      role="menu"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="header-notification-head">
                        <p className="eyebrow">Notifications</p>
                        <Link
                          className="header-notification-see-more"
                          to="/profile?tab=notifications"
                          onClick={() => {
                            setIsNotificationOpen(false)
                          }}
                        >
                          See more
                        </Link>
                      </div>
                      
                      {unreadNotifications.length > 0 ? (
                        unreadNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            style={{
                              padding: '0.75rem 1rem',
                              borderBottom: '1px solid rgba(243, 255, 241, 0.1)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(243, 255, 241, 0.05)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                color: '#f3fff1',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                lineHeight: 1.4,
                              }}
                            >
                              {getNotificationContent(notification)}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                color: 'rgba(243, 255, 241, 0.6)',
                                fontSize: '0.75rem',
                                lineHeight: 1.2,
                              }}
                            >
                              {formatNotificationTimestamp(notification)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="header-notification-empty">No unread notifications.</p>
                      )}

                    </motion.section>
                  ) : null}
                </AnimatePresence>
              </div>

              <button
                type="button"
                className="btn btn-ghost header-auth"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-busy={isLoggingOut}
              >
                {isLoggingOut ? (
                  <span className="btn-loading-content">
                    <span className="inline-spinner" aria-hidden="true" />
                    Logging out...
                  </span>
                ) : (
                  <>
                    <FiLogOut aria-hidden="true" />
                    Logout
                  </>
                )}
              </button>
              
              {deferredPrompt && (
                <button 
                  type="button" 
                  className="icon-link icon-button" 
                  onClick={handleInstallClick}
                  aria-label="Install App"
                  style={{ border: '1px dashed var(--green-500)', color: 'var(--green-500)' }}
                >
                  <FiDownload aria-hidden="true" />
                </button>
              )}

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                isActive ? 'icon-link is-active' : 'icon-link'
              }
              aria-label="Profile"
            >
              <FiUser aria-hidden="true" />
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? 'icon-link is-active' : 'icon-link'
              }
              aria-label="Settings"
            >
              <FiSettings aria-hidden="true" />
            </NavLink>
          </>
        
          ) : null}

        </div>
      </motion.header>

      <motion.main
        key={location.pathname}
        className="main-content"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {outlet}
      </motion.main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
          <FiHome aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/discover" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
          <FiCompass aria-hidden="true" />
          <span>Discover</span>
        </NavLink>
        <NavLink to="/ai" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
          <FiCpu aria-hidden="true" />
          <span>Advisor</span>
        </NavLink>
        {user ? (
          <NavLink to="/profile" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
            <FiUser aria-hidden="true" />
            <span>Profile</span>
          </NavLink>
        ) : (
          <NavLink to="/login" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
            <FiLogIn aria-hidden="true" />
            <span>Login</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}

