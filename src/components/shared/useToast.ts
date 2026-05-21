import { useCallback, useState } from 'react'

export interface ToastItem {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

let nextToastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = ++nextToastId
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => removeToast(id), 3500)
  }, [removeToast])

  return { toasts, addToast, removeToast }
}
