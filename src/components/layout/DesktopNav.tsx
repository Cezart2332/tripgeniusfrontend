import { NavLink } from 'react-router-dom'
import styled from 'styled-components'
import { FiHome, FiMap, FiCpu } from 'react-icons/fi'
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
  { to: '/app', label: 'Home', Icon: FiHome, end: true },
  { to: '/map', label: 'Map', Icon: FiMap },
  { to: '/app/ai', label: 'AI', Icon: FiCpu },
]

const Wrapper = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.15rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    justify-content: center;
  }
`

const Link = styled(NavLink)`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[380]};
  text-decoration: none;
  transition: color 0.2s ease;
  min-height: 36px;

  &.is-active {
    color: #0a1e08;
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
    box-shadow: 0 2px 12px rgba(23, 247, 2, 0.2);
  }

  &:hover:not(.is-active) {
    color: ${({ theme }) => theme.colors.text[220]};
    background: rgba(65, 162, 56, 0.08);
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