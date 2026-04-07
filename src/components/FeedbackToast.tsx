import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

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
    <div className="feedback-toast-shell" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            className={`feedback-toast feedback-toast--${toast.tone}`}
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={toastTransition}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <p>{toast.message}</p>
            <button type="button" className="feedback-toast-close" onClick={clearToast}>
              Dismiss
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
