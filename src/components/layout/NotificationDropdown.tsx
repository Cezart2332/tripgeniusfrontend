import { useMemo, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import styled from 'styled-components'
import { FiBell } from 'react-icons/fi'
import type { User, Notification } from '../../types/models'

interface NotificationDropdownProps {
  user: User | null
  isSyncingUser: boolean
  onReadAll: () => void
  onSync: () => void
}

const Shell = styled.div`
  position: relative;
`

const Trigger = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ $open }) => $open ? 'rgba(247, 243, 232, 0.1)' : 'transparent'};
  color: ${({ theme }) => theme.colors.text[380]};
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    color: ${({ theme }) => theme.colors.text[100]};
    background: rgba(247, 243, 232, 0.06);
  }
`

const Badge = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.danger[500]};
  border: 2px solid ${({ theme }) => theme.colors.bg[980]};
  animation: pulse-ring 2s infinite;

  @keyframes pulse-ring {
    0%, 100% { box-shadow: 0 0 0 0 rgba(219, 74, 91, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(219, 74, 91, 0); }
  }
`

const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(247, 243, 232, 0.2);
  border-top-color: ${({ theme }) => theme.colors.green[500]};
  border-radius: 50%;
  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

const Dropdown = styled(motion.div)`
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  width: 340px;
  max-height: 400px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: ${({ theme }) => theme.radii.xl};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  z-index: 100;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    right: -40px;
    width: calc(100vw - 2rem);
    max-width: 340px;
  }
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const HeadTitle = styled.span`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.text[380]};
`

const ActionsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`

const ActionBtn = styled.button`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.green[300]};
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;

  &:hover {
    text-decoration: underline;
  }
`

const Item = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(247, 243, 232, 0.05);
  }
`

const ItemText = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[100]};
  line-height: 1.4;
  margin-bottom: 0.2rem;
`

const ItemTime = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
`

const EmptyMsg = styled.p`
  padding: 2rem 1rem;
  text-align: center;
  color: ${({ theme }) => theme.colors.text[500]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

function getNotificationContent(n: Notification): string {
  const candidate = n.content ?? n.message ?? n.Message ?? n.text
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : 'New notification'
}

function formatNotificationTime(n: Notification): string {
  const ts = n.CreatedAt ?? n.createdAt ?? n.timestamp ?? n.Timestamp ?? n.date
  if (!ts) return 'Just now'

  const match = /\/Date\((\d+)\)\//.exec(ts)
  const d = match ? new Date(Number(match[1])) : new Date(ts)
  if (isNaN(d.getTime())) return 'Just now'

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

function isRead(n: Notification): boolean {
  return Boolean(n.isRead ?? n.read ?? n.IsRead ?? n.Read)
}

export function NotificationDropdown({ user, isSyncingUser, onReadAll, onSync }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = useMemo(() => {
    return (user?.notifications ?? []).filter((n) => !isRead(n))
  }, [user])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.target instanceof Node && ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [open])

  if (!user) return null

  return (
    <Shell ref={ref}>
      <Trigger
        $open={open}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isSyncingUser}
        onClick={() => {
          if (isSyncingUser) return
          setOpen((prev) => !prev)
          onSync()
        }}
      >
        {isSyncingUser ? <Spinner /> : <FiBell size={18} />}
        {unread.length > 0 && <Badge />}
      </Trigger>

      <AnimatePresence>
        {open && (
          <Dropdown
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
          >
            <Head>
              <HeadTitle>Notifications</HeadTitle>
              <ActionsRow>
                {unread.length > 0 && (
                  <ActionBtn onClick={() => { onReadAll(); setOpen(false) }}>
                    Mark all read
                  </ActionBtn>
                )}
                <Link to="/app/profile?tab=notifications" onClick={() => setOpen(false)}>
                  <ActionBtn as="span">See all</ActionBtn>
                </Link>
              </ActionsRow>
            </Head>
            {unread.length > 0 ? (
              unread.map((n) => (
                <Item key={n.id}>
                  <ItemText>{getNotificationContent(n)}</ItemText>
                  <ItemTime>{formatNotificationTime(n)}</ItemTime>
                </Item>
              ))
            ) : (
              <EmptyMsg>No unread notifications.</EmptyMsg>
            )}
          </Dropdown>
        )}
      </AnimatePresence>
    </Shell>
  )
}
