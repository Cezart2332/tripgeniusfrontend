import { NavLink, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import styled from 'styled-components'
import { FiHome, FiMap, FiCpu, FiLogIn, FiMessageCircle, FiSettings } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { getAvatarUrl } from '../../utils/userUtils'
import { isAiAdvisorPath, isFullscreenMapPath } from '../../utils/mapRoutes'
import type { User } from '../../types/models'

interface AuthStoreState {
  auth: { user: User | null }
}

interface NavItem {
  to: string
  label: string
  Icon: IconType
  end?: boolean
  requiresAuth?: boolean
}

const Nav = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  padding: 0.35rem 0.5rem;
  padding-bottom: calc(env(safe-area-inset-bottom) + 0.35rem);
  background: ${({ theme }) => theme.glass.bgStrong};
  border-top: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${({ theme }) => theme.shadows.bottomNav};

  @media (min-width: ${({ theme }) => `calc(${theme.breakpoints.mobile} + 1px)`}) {
    display: none;
  }
`

const NavItem = styled(NavLink)`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.25rem;
  min-height: 44px;
  max-width: 72px;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: 0.6rem;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s ease;

  &.active {
    color: #0a1e08;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const IconWrap = styled.span`
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
`

const ActiveBg = styled(motion.div)`
  position: absolute;
  inset: 0;
  border-radius: ${({ theme }) => theme.radii.md};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  box-shadow: 0 2px 16px rgba(23, 247, 2, 0.25);
  z-index: -1;
`

const AvatarImg = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
`

const loggedInItems: NavItem[] = [
  { to: '/app', label: 'Home', Icon: FiHome, end: true },
  { to: '/map', label: 'Map', Icon: FiMap },
  { to: '/app/ai', label: 'AI', Icon: FiCpu, requiresAuth: true },
]

const guestItems: NavItem[] = [
  { to: '/app', label: 'Home', Icon: FiHome, end: true },
  { to: '/login', label: 'Login', Icon: FiLogIn },
]

export function MobileBottomNav() {
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const location = useLocation()

  if (isFullscreenMapPath(location.pathname) || isAiAdvisorPath(location.pathname)) return null

  const items = user ? loggedInItems : guestItems

  const isTripPage = location.pathname.includes('/app/trip/')
  const tripId = isTripPage ? location.pathname.split('/trip/')[1]?.split('/')[0] : null

  return (
    <Nav aria-label="Mobile navigation">
      {items.map((item) => {
        if (item.requiresAuth && !user) return null

        return (
          <NavItem
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            {({ isActive }) => (
              <>
                {isActive && <ActiveBg layoutId="nav-active-bg" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
                <IconWrap>
                  <item.Icon />
                </IconWrap>
              </>
            )}
          </NavItem>
        )
      })}

      {user ? (
        <NavItem
          to="/app/profile"
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          {({ isActive }) => (
            <>
              {isActive && <ActiveBg layoutId="nav-active-bg" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
              <IconWrap>
                <AvatarImg
                  src={getAvatarUrl(user.username, user.profileUrl)}
                  alt=""
                />
              </IconWrap>
            </>
          )}
        </NavItem>
      ) : null}

      {isTripPage && tripId && user ? (
        <NavItem
          to={`/app/trip/${tripId}`}
          className={({ isActive }) => isActive ? 'active' : ''}
          aria-label="Trip chat"
        >
          {({ isActive }) => (
            <>
              {isActive && <ActiveBg layoutId="nav-active-bg" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
              <IconWrap>
                <FiMessageCircle />
              </IconWrap>
            </>
          )}
        </NavItem>
      ) : user ? (
        <NavItem
          to="/app/settings"
          className={({ isActive }) => isActive ? 'active' : ''}
          aria-label="Settings"
        >
          {({ isActive }) => (
            <>
              {isActive && <ActiveBg layoutId="nav-active-bg" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
              <IconWrap>
                <FiSettings />
              </IconWrap>
            </>
          )}
        </NavItem>
      ) : null}
    </Nav>
  )
}
