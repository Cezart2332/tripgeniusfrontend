import { motion, AnimatePresence } from 'framer-motion'
import styled from 'styled-components'

interface SplashScreenProps {
  show: boolean
}

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.bg[980]};
  gap: 1.5rem;
`

const Logo = styled(motion.img)`
  width: 160px;
  height: auto;
`

const LoaderTrack = styled.div`
  width: 120px;
  height: 3px;
  border-radius: 2px;
  background: rgba(46, 141, 84, 0.15);
  overflow: hidden;
`

const LoaderBar = styled(motion.div)`
  height: 100%;
  border-radius: 2px;
  background: ${({ theme }) => theme.colors.green[400]};
`

const Tagline = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
`

export function SplashScreen({ show }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {show && (
        <Overlay
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <Logo
            src="/fulllogo.svg"
            alt="TripGenius"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <LoaderTrack>
            <LoaderBar
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            />
          </LoaderTrack>
          <Tagline>Getting things ready...</Tagline>
        </Overlay>
      )}
    </AnimatePresence>
  )
}