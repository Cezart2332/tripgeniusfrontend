import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import styled from 'styled-components'
import type { ToastItem } from './useToast'

interface ToastContainerProps {
  toasts: ToastItem[]
  removeToast: (id: number) => void
}

const toneColors = {
  success: '#2e8d54',
  error: '#db4a5b',
  info: '#a8781f',
} as const

const Wrapper = styled.div`
  position: fixed;
  top: calc(env(safe-area-inset-top) + 1rem);
  right: 1rem;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 360px;
  width: calc(100% - 2rem);
  pointer-events: none;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
`

const ToastItem = styled(motion.div)<{ $tone: 'success' | 'error' | 'info' }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 1rem;
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ $tone }) => toneColors[$tone]};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: ${({ theme }) => theme.shadows.xl};
  pointer-events: auto;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const Dot = styled.span<{ $tone: 'success' | 'error' | 'info' }>`
  width: 8px;
  height: 8px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ $tone }) => toneColors[$tone]};
  flex-shrink: 0;
`

const Message = styled.span`
  flex: 1;
  line-height: 1.4;
`

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <Wrapper>
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            $tone={toast.tone}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Dot $tone={toast.tone} />
            <Message>{toast.message}</Message>
            <CloseBtn onClick={() => removeToast(toast.id)} aria-label="Dismiss notification" title="Dismiss">
              x
            </CloseBtn>
          </ToastItem>
        ))}
      </AnimatePresence>
    </Wrapper>,
    document.body,
  )
}
