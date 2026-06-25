import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styled from 'styled-components'
import { FiX } from 'react-icons/fi'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  height?: string
}

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(5, 7, 4, 0.62);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`

const Sheet = styled(motion.div)<{ $height: string }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1001;
  max-height: ${({ $height }) => $height};
  height: ${({ $height }) => $height};
  background:
    linear-gradient(145deg, rgba(247, 243, 232, 0.045), rgba(247, 243, 232, 0.015)),
    ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-bottom: none;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: ${({ theme }) => theme.radii.xl} ${({ theme }) => theme.radii.xl} 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: ${({ theme }) => theme.shadows.xl};
`

const Handle = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: ${({ theme }) => theme.colors.text[500]};
  margin: 0.75rem auto 0.5rem;
  opacity: 0.6;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.sm};
`

const Title = styled.h3`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.colors.text[100]};
`

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(247, 243, 232, 0.06);
  color: ${({ theme }) => theme.colors.text[380]};
  transition: all 0.2s ease;

  &:hover {
    background: rgba(247, 243, 232, 0.12);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  -webkit-overflow-scrolling: touch;
`

export function BottomSheet({ isOpen, onClose, title, children, height = '60vh' }: BottomSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleDrag = useCallback((_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    if (info.offset.y > 100 || info.velocity.y > 300) {
      onClose()
    }
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Overlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
          />
          <Sheet
            $height={height}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDrag}
          >
            <Handle />
            {title && (
              <Header>
                <Title>{title}</Title>
                <CloseButton onClick={onClose} aria-label="Close">
                  <FiX size={18} />
                </CloseButton>
              </Header>
            )}
            <Content ref={contentRef}>
              {children}
            </Content>
          </Sheet>
        </>
      )}
    </AnimatePresence>
  )
}
