import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { FiX } from 'react-icons/fi'
import styled from 'styled-components'

interface ModalSurfaceProps {
  isOpen: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

const Scrim = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
`

const Card = styled.div`
  max-width: 500px;
  width: 90%;
  background: ${({ theme }) => theme.glass.bgStrong};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.lg};
  box-shadow: ${({ theme }) => theme.shadows.xl};
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: ${({ theme }) => theme.spacing.md};
`

const HeaderText = styled.div`
  h3 {
    font-size: ${({ theme }) => theme.typography.h3};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.text[500]};
  margin-top: 0.25rem;
`

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.full};
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(243, 255, 241, 0.06);
  color: ${({ theme }) => theme.colors.text[380]};
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(243, 255, 241, 0.12);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

export function ModalSurface({ isOpen, title, subtitle, onClose, children }: ModalSurfaceProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <Scrim
          className="modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={e => e.stopPropagation()}
          >
            <Card>
              <Header>
                <HeaderText>
                  <h3>{title}</h3>
                  {subtitle && <Subtitle>{subtitle}</Subtitle>}
                </HeaderText>
                <CloseButton onClick={onClose}><FiX /></CloseButton>
              </Header>
              {children}
            </Card>
          </motion.div>
        </Scrim>
      )}
    </AnimatePresence>
  )
}
