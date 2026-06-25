import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import styled from 'styled-components'

export type FeedbackToastTone = 'success' | 'error' | 'info'

export interface FeedbackToastState {
  id: number
  message: string
  tone: FeedbackToastTone
}

interface FeedbackToastProps {
  toast: FeedbackToastState | null
  clearToast: () => void
}

const toastTransition = {
  type: 'spring',
  stiffness: 390,
  damping: 30,
} as const

const toneColors: Record<FeedbackToastTone, { bg: string; border: string }> = {
  success: { bg: 'rgba(143, 179, 106, 0.1)', border: 'rgba(143, 179, 106, 0.3)' },
  error: { bg: 'rgba(219, 74, 91, 0.1)', border: 'rgba(219, 74, 91, 0.3)' },
  info: { bg: 'rgba(143, 179, 106, 0.1)', border: 'rgba(143, 179, 106, 0.3)' },
}

const Shell = styled.div`
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

const ToastItem = styled(motion.div)<{ $tone: FeedbackToastTone }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 1rem;
  background: ${({ $tone }) => toneColors[$tone].bg};
  border: 1px solid ${({ $tone }) => toneColors[$tone].border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: ${({ theme }) => theme.shadows.lg};
  pointer-events: auto;
`

const Message = styled.p`
  flex: 1;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  line-height: 1.4;
  margin: 0;
`

const DismissButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.caption};
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  transition: all 0.15s ease;
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.text[100]};
    background: rgba(247, 243, 232, 0.08);
  }
`

export function FeedbackToast({ toast, clearToast }: FeedbackToastProps) {
  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      clearToast()
    }, 3200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast, clearToast])

  return (
    <Shell aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toast ? (
          <ToastItem
            key={toast.id}
            $tone={toast.tone}
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={toastTransition}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <Message>{toast.message}</Message>
            <DismissButton onClick={clearToast}>
              Dismiss
            </DismissButton>
          </ToastItem>
        ) : null}
      </AnimatePresence>
    </Shell>
  )
}
