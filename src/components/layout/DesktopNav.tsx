import { NavLink } from 'react-router-dom'
import styled from 'styled-components'
import { PiCompassRose, PiMapTrifold, PiSparkle } from 'react-icons/pi'
import type { IconType } from 'react-icons'
import type { User } from '../../types/models'

interface DesktopNavProps {
  user: User | null
}

interface NavItem {
  to: string
  label: string
  Icon: IconType
  end?: boolean
}

const items: NavItem[] = [
  { to: '/app', label: 'Discover', Icon: PiCompassRose, end: true },
  { to: '/map', label: 'Map', Icon: PiMapTrifold },
  { to: '/app/ai', label: 'Advisor', Icon: PiSparkle },
]

const Wrapper = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    justify-content: center;
  }
`

const Link = styled(NavLink)`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.95rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[380]};
  text-decoration: none;
  transition: color 0.2s ease;
  min-height: 36px;

  &.is-active {
    color: ${({ theme }) => theme.colors.bg[980]};
    background: ${({ theme }) => theme.colors.green[400]};
    box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  }

  &:hover:not(.is-active) {
    color: ${({ theme }) => theme.colors.text[220]};
    background: rgba(28, 43, 32, 0.07);
  }

  svg {
    font-size: 1rem;
    flex-shrink: 0;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    gap: 0;
    justify-content: center;
    min-width: 44px;
    padding: 0.4rem;

    span {
      display: none;
    }

    svg {
      font-size: 1.15rem;
    }
  }
`

export function DesktopNav({ user }: DesktopNavProps) {
  const visibleItems = items.filter((item) => {
    if (!user && (item.to === '/app/ai' || item.to === '/map')) return false
    return true
  })

  return (
    <Wrapper>
      {visibleItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => isActive ? 'is-active' : ''}
        >
          <item.Icon />
          <span>{item.label}</span>
        </Link>
      ))}
    </Wrapper>
  )
}
