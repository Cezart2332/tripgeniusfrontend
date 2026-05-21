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
  gap: 0.25rem;
  padding: 0.3rem;
  background: ${({ theme }) => theme.glass.bgStrong};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: ${({ theme }) => theme.radii.pill};
  width: fit-content;
`

const ModeTab = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.2rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[380]};
  text-decoration: none;
  transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  &:hover:not(.active) {
    color: ${({ theme }) => theme.colors.text[220]};
  }

  &.active {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
    color: #0a1e08;
    box-shadow: 0 2px 12px rgba(23, 247, 2, 0.2);
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
