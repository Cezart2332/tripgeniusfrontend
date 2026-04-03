import { useEffect, useState } from 'react'
import Lenis from '@studio-freight/lenis'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FiCompass,
  FiCpu,
  FiHome,
  FiLogIn,
  FiSettings,
  FiUser,
  FiUserPlus,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  Icon: IconType
  end?: boolean
}

const primaryNavItems: NavItem[] = [
  { to: '/', label: 'Home', Icon: FiHome, end: true },
  { to: '/discover', label: 'Discover', Icon: FiCompass },
  { to: '/ai', label: 'AI Advisor', Icon: FiCpu },
]

export function AppLayout() {
  const location = useLocation()
  const [hideHeader, setHideHeader] = useState(false)

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

  return (
    <div className="app-shell">
      <div className="ambient-orbs" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="orb orb-three" />
      </div>

      <motion.header
        className="topbar"
        animate={{ y: hideHeader ? -128 : 0, opacity: 1 }}
        initial={{ y: -24, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="brand-block">
          <div className="brand-dot" aria-hidden="true" />
          <div>
            <p className="brand-name">TripGenius</p>
            <p className="brand-subtitle">Find people. Plan smarter. Travel together.</p>
          </div>
        </div>

        <nav className="top-nav" aria-label="Main navigation">
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

        <div className="header-actions">
          <Link className="btn btn-ghost header-auth" to="/login">
            <FiLogIn aria-hidden="true" />
            Login
          </Link>
          <Link className="btn btn-primary header-auth" to="/register">
            <FiUserPlus aria-hidden="true" />
            Register
          </Link>

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
        </div>
      </motion.header>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          className="main-content"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
