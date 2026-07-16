import { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { motion, AnimatePresence } from 'framer-motion'
import { isReallyOnline } from '../data/api'

/**
 * Disclaimer global afișat cât timp utilizatorul e offline. Reamintește că
 * acțiunile (inclusiv upload-ul de poze) se pun în coadă și se sincronizează
 * automat la revenirea online.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = async () => {
      // navigator.onLine poate raporta greșit „online" — confirmăm cu un ping real.
      const online = await isReallyOnline()
      setOffline(!online)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return (
    <Wrap aria-hidden={!offline}>
      <AnimatePresence>
        {offline && (
          <Banner
            key="offline-banner"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <Dot />
            <Text>
              <strong>Ești offline.</strong> Modificările și pozele se sincronizează automat când revii online.
            </Text>
          </Banner>
        )}
      </AnimatePresence>
    </Wrap>
  )
}

const Wrap = styled.div`
  position: fixed;
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  z-index: 3000;
  display: flex;
  justify-content: center;
  padding: 0 0.75rem;
  pointer-events: none;

  /* Pe desktop există topbar-ul fix (min-height 64px) cu navigația în centru —
     coborâm banner-ul sub el ca să nu-l acopere. */
  @media (min-width: ${({ theme }) => theme.breakpoints.mobile}) {
    top: calc(64px + 0.6rem);
  }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.72); }
`

const Banner = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: min(92vw, 560px);
  padding: 0.55rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: rgba(40, 34, 16, 0.86);
  border: 1px solid rgba(168, 120, 31, 0.55);
  color: ${({ theme }) => theme.colors.text[100]};
  box-shadow: ${({ theme }) => theme.shadows.md};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
`

const Dot = styled.span`
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.offroad.accent};
  box-shadow: 0 0 0 4px rgba(168, 120, 31, 0.18);
  animation: ${pulse} 1.6s ease-in-out infinite;
`

const Text = styled.span`
  font-size: 0.85rem;
  line-height: 1.35;

  strong {
    font-weight: 700;
  }
`
