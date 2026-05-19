import { FiCpu, FiHome, FiLogIn, FiMap, FiNavigation, FiSettings, FiUser } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getAvatarUrl } from '../utils/userUtils'
import type { User } from '../types/models'

interface AuthStoreState {
  auth: { user: User | null }
}

interface BottomNavItem {
  to: string
  label: string
  Icon: IconType
  end?: boolean
  requiresAuth?: boolean
  avatar?: boolean
}

const loggedInItems: BottomNavItem[] = [
  { to: '/app', label: 'Home', Icon: FiHome, end: true },
  { to: '/map', label: 'Map', Icon: FiMap },
  { to: '/app/offroad', label: 'Trails', Icon: FiNavigation },
  { to: '/app/ai', label: 'AI', Icon: FiCpu, requiresAuth: true },
  { to: '/app/profile', label: 'Profile', Icon: FiUser, requiresAuth: true, avatar: true },
  { to: '/app/settings', label: 'Settings', Icon: FiSettings, requiresAuth: true },
]

const guestItems: BottomNavItem[] = [
  { to: '/app', label: 'Home', Icon: FiHome, end: true },
  { to: '/map', label: 'Map', Icon: FiMap },
  { to: '/app/offroad', label: 'Trails', Icon: FiNavigation },
  { to: '/login', label: 'Login', Icon: FiLogIn },
]

export function MobileBottomNav() {
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const items = user ? loggedInItems : guestItems

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        if (item.requiresAuth && !user) return null

        if (item.avatar && user) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'
              }
            >
              <img
                src={getAvatarUrl(user.username, user.profileUrl)}
                alt=""
                className="bottom-nav-avatar"
              />
              <span>{item.label}</span>
            </NavLink>
          )
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'
            }
          >
            <item.Icon aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
