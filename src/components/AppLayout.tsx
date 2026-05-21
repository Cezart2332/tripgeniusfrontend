import { useCallback, useEffect, useRef, useState } from 'react'
import Lenis from '@studio-freight/lenis'
import { motion } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import styled from 'styled-components'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { PWAInstallPopup } from '../components/PWAInstallPopup'
import { MobileBottomNav } from './layout/MobileBottomNav'
import { DesktopTopbar } from './layout/DesktopTopbar'
import { SplashScreen } from './layout/SplashScreen'
import { logout as logoutAction, setUser } from '../data/authSlice'
import api from '../data/api'
import type { Notification, User } from '../types/models'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

const Shell = styled.div`
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  padding: 4.5rem 0 5rem;
  flex: 1;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 0.75rem 0 5rem;
    width: min(1200px, 100% - 1rem);
  }
`

const Main = styled(motion.main)`
  min-height: calc(100vh - 8rem);
  display: flex;
  flex-direction: column;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    min-height: auto;
  }
`

const FullBleedMain = styled(motion.main)`
  position: fixed;
  top: 3.5rem;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
  background: ${({ theme }) => theme.colors.bg[980]};

  & > * {
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    top: 0;
    bottom: calc(3.5rem + env(safe-area-inset-bottom));
  }
`

const AmbientLayer = styled.div`
  display: none;
`

function isRead(n: Notification): boolean {
  return Boolean(n.isRead ?? n.read ?? n.IsRead ?? n.Read)
}

function isAiRoute(pathname: string): boolean {
  return pathname === '/app/ai' || pathname === '/ai'
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [hideHeader, setHideHeader] = useState(false)
  const [isAppInitializing, setIsAppInitializing] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSyncingUser, setIsSyncingUser] = useState(false)
  const { showInstallPopup, isIos, dismissPopup, handleInstallClick, deferredPrompt } = usePWAInstall()
  const isSyncingUserRef = useRef(false)
  const hasAttemptedInit = useRef(false)
  const outlet = useOutlet()
  const aiStandalone = isAiRoute(location.pathname)

  const syncUserFromProfileFetch = useCallback(async () => {
    if (isSyncingUserRef.current) return
    isSyncingUserRef.current = true
    setIsSyncingUser(true)
    try {
      const res = await api.get('api/user/me')
      dispatch(setUser({ user: res.data }))
    } catch { /* ignore transient errors */ }
    finally {
      isSyncingUserRef.current = false
      setIsSyncingUser(false)
      setTimeout(() => setIsAppInitializing(false), 400)
    }
  }, [dispatch])

  useEffect(() => {
    if (isAppInitializing) {
      const timer = setTimeout(() => setIsAppInitializing(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [isAppInitializing])

  const unreadNotifications = (user?.notifications ?? []).filter((n) => !isRead(n))

  const markAllAsRead = async () => {
    if (!user || unreadNotifications.length === 0) return
    try {
      await api.post('/api/user/read-notifications')
      const updated = user.notifications.map((n) => ({
        ...n, isRead: true, read: true, IsRead: true, Read: true,
      }))
      dispatch(setUser({ user: { ...user, notifications: updated } }))
    } catch { /* ignore */ }
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try { await api.post('/api/auth/logout') } catch { /* ignore */ }
    finally {
      dispatch(logoutAction())
      setIsLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const isNarrow = window.matchMedia('(max-width: 850px)').matches
    if (prefersReducedMotion || isCoarsePointer || isNarrow || aiStandalone) return

    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.5 })
    let rafId = 0
    const raf = (time: number) => { lenis.raf(time); rafId = window.requestAnimationFrame(raf) }
    rafId = window.requestAnimationFrame(raf)
    return () => { window.cancelAnimationFrame(rafId); lenis.destroy() }
  }, [aiStandalone])

  useEffect(() => {
    if (aiStandalone) return
    let prevY = window.scrollY
    const onScroll = () => {
      const currentY = window.scrollY
      setHideHeader(currentY > prevY && currentY > 80)
      prevY = currentY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [aiStandalone])

  useEffect(() => {
    if (!aiStandalone) {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, aiStandalone])

  useEffect(() => {
    if (!aiStandalone) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [aiStandalone])

  useEffect(() => {
    if (hasAttemptedInit.current) return
    hasAttemptedInit.current = true
    if (!user) {
      void syncUserFromProfileFetch()
    } else {
      setIsAppInitializing(false)
      void syncUserFromProfileFetch()
    }
  }, [user, syncUserFromProfileFetch])

  useEffect(() => {
    if (!user) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'tripgenius:refresh-user') {
        void syncUserFromProfileFetch()
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handler)
      return () => navigator.serviceWorker.removeEventListener('message', handler)
    }
  }, [user, syncUserFromProfileFetch])

  const topbar = (
    <>
      <DesktopTopbar
        user={user}
        hideHeader={hideHeader}
        isLoggingOut={isLoggingOut}
        isSyncingUser={isSyncingUser}
        deferredPrompt={!!deferredPrompt}
        onLogout={handleLogout}
        onInstall={handleInstallClick}
        onSyncUser={syncUserFromProfileFetch}
        onReadAllNotifications={markAllAsRead}
      />
    </>
  )

  if (aiStandalone) {
    return (
      <>
        {topbar}
        <FullBleedMain
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {outlet}
        </FullBleedMain>
        <MobileBottomNav />
        <PWAInstallPopup
          show={showInstallPopup}
          isIos={isIos}
          onDismiss={dismissPopup}
          onInstall={handleInstallClick}
        />
        <SplashScreen show={isAppInitializing} />
      </>
    )
  }

  return (
    <>
      <Shell>
        <AmbientLayer aria-hidden="true" />
        {topbar}
        <Main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {outlet}
        </Main>
        <MobileBottomNav />
      </Shell>

      <PWAInstallPopup
        show={showInstallPopup}
        isIos={isIos}
        onDismiss={dismissPopup}
        onInstall={handleInstallClick}
      />

      <SplashScreen show={isAppInitializing} />
    </>
  )
}
