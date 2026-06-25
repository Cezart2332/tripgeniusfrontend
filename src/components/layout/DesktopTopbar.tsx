import { Link, NavLink } from 'react-router-dom'
import styled from 'styled-components'
import { FiLogIn, FiLogOut, FiUserPlus, FiDownload, FiSettings } from 'react-icons/fi'
import { motion } from 'framer-motion'
import type { User } from '../../types/models'
import { DesktopNav } from './DesktopNav'
import { NotificationDropdown } from './NotificationDropdown'
import { getAvatarUrl } from '../../utils/userUtils'

interface DesktopTopbarProps {
  user: User | null
  hideHeader: boolean
  isLoggingOut: boolean
  isSyncingUser: boolean
  deferredPrompt: boolean
  onLogout: () => void
  onInstall: () => void
  onSyncUser: () => void
  onReadAllNotifications: () => void
}

const Bar = styled(motion.header)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 800;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0.7rem clamp(1rem, 4vw, 2rem);
  background: linear-gradient(180deg, rgba(20, 24, 18, 0.94), rgba(20, 24, 18, 0.82));
  border-bottom: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${({ theme }) => theme.shadows.topbar};
  min-height: 64px;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: none;
  }
`

const NavSlot = styled.div`
  display: flex;
  justify-content: center;
`

const Brand = styled(Link)`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: fit-content;
  padding: 0.35rem 0.55rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: background 0.18s ease;

  &:hover {
    background: rgba(247, 243, 232, 0.06);
  }
`

const Logo = styled.img`
  height: 28px;
  width: auto;
  margin-right: 0.75rem;
`

const RightActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
`

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[220]};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.glass.border};
  transition: all 0.15s ease;
  min-height: 36px;
  white-space: nowrap;

  &:hover {
    background: rgba(247, 243, 232, 0.07);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const PrimaryBtn = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[400]}, ${({ theme }) => theme.colors.offroad.accent});
  color: ${({ theme }) => theme.colors.bg[980]};
  text-decoration: none;
  min-height: 36px;
  white-space: nowrap;

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.glowGold};
  }
`

const InstallAction = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green[300]};
  background: rgba(143, 179, 106, 0.08);
  border: 1px dashed ${({ theme }) => theme.colors.line};
  transition: all 0.15s ease;
  min-height: 36px;
  white-space: nowrap;

  &:hover {
    background: rgba(143, 179, 106, 0.14);
  }
`

const IconLink = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: 1.1rem;
  transition: all 0.15s ease;

  &.is-active, &:hover {
    color: ${({ theme }) => theme.colors.text[100]};
    background: rgba(247, 243, 232, 0.08);
  }
`

const AvatarLink = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: center;
`

const AvatarImg = styled.img`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  object-fit: cover;
  border: 2px solid ${({ theme }) => theme.glass.border};
  transition: border-color 0.15s ease;

  .is-active &, &:hover {
    border-color: ${({ theme }) => theme.colors.green[500]};
  }
`

const Spinner = styled.span`
  width: 14px;
  height: 14px;
  border: 2px solid rgba(247, 243, 232, 0.2);
  border-top-color: ${({ theme }) => theme.colors.green[500]};
  border-radius: 50%;
  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

export function DesktopTopbar({
  user,
  hideHeader,
  isLoggingOut,
  isSyncingUser,
  deferredPrompt,
  onLogout,
  onInstall,
  onSyncUser,
  onReadAllNotifications,
}: DesktopTopbarProps) {
  return (
    <Bar
      animate={{ y: hideHeader ? -120 : 0, opacity: hideHeader ? 0 : 1 }}
      initial={false}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Brand to="/app" aria-label="TripGenius home">
        <Logo src="/fulllogo.svg" alt="TripGenius" />
      </Brand>

      <NavSlot>
        <DesktopNav user={user} />
      </NavSlot>

      <RightActions>
        {!user ? (
          <>
            {deferredPrompt && (
              <InstallAction onClick={onInstall}>
                <FiDownload size={14} />
                Install
              </InstallAction>
            )}
            <ActionBtn as={Link} to="/login">
              <FiLogIn size={14} />
              Login
            </ActionBtn>
            <PrimaryBtn to="/register">
              <FiUserPlus size={14} />
              Register
            </PrimaryBtn>
          </>
        ) : (
          <>
            <NotificationDropdown
              user={user}
              isSyncingUser={isSyncingUser}
              onReadAll={onReadAllNotifications}
              onSync={onSyncUser}
            />
            <ActionBtn onClick={onLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <><Spinner /> Logging out...</>
              ) : (
                <><FiLogOut size={14} /> Logout</>
              )}
            </ActionBtn>
            {deferredPrompt && (
              <InstallAction onClick={onInstall} aria-label="Install app" style={{ padding: '0.4rem 0.55rem' }}>
                <FiDownload size={16} />
              </InstallAction>
            )}
            <AvatarLink to="/app/profile" className={({ isActive }) => isActive ? 'is-active' : ''}>
              <AvatarImg
                src={getAvatarUrl(user.username, user.profileUrl)}
                alt="Profile"
              />
            </AvatarLink>
            <IconLink to="/app/settings" aria-label="Settings">
              <FiSettings size={18} />
            </IconLink>
          </>
        )}
      </RightActions>
    </Bar>
  )
}
