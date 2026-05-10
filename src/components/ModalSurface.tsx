import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { FiX } from 'react-icons/fi'

interface ModalSurfaceProps {
  isOpen: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

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
        <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="builder-section-v2" style={{ maxWidth: '500px', width: '90%', background: 'var(--bg-900)' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                   <h3>{title}</h3>
                   {subtitle && <p className="eyebrow">{subtitle}</p>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onClose}><FiX /></button>
             </div>
             {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
