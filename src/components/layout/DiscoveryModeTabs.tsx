import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

const Wrapper = styled.div<{ $centered?: boolean }>`
  width: 100%;
  display: flex;
  justify-content: ${({ $centered }) => ($centered ? 'center' : 'flex-start')};
`

const ModeTabNav = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  width: fit-content;
`

const ModeTab = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.2rem;
  border-radius: 0;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[380]};
  text-decoration: none;
  transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  &:hover:not(.active) {
    color: ${({ theme }) => theme.colors.text[220]};
  }

  &.active {
    color: ${({ theme }) => theme.colors.green[300]};
    box-shadow: inset 0 -2px 0 ${({ theme }) => theme.colors.green[500]};
  }
`

interface DiscoveryModeTabsProps {
  centered?: boolean
}

export function DiscoveryModeTabs({ centered = true }: DiscoveryModeTabsProps) {
  return (
    <Wrapper $centered={centered}>
      <ModeTabNav aria-label="Trip discovery mode">
        <ModeTab to="/app" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Classic
        </ModeTab>
        <ModeTab to="/app/offroad" className={({ isActive }) => (isActive ? 'active' : '')}>
          Offroad
        </ModeTab>
      </ModeTabNav>
    </Wrapper>
  )
}
