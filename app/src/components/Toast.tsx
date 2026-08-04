import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/**
 * Toasts (Etappe 4, Schritt 1). Drei Dinge waren kaputt:
 *
 * 1. Sie lagen exakt auf dem Chat-FAB (bottom 20/right 20) und mobil über der
 *    Bottom-Bar — die Meldung verdeckte genau die Knöpfe, die man danach braucht.
 * 2. Fehler verschwanden nach 2,2 s wie ein „gespeichert". Zu kurz zum Lesen,
 *    und ein weggeblendeter Fehler ist ein verschwiegener Fehler.
 * 3. Glas-Optik (blur 28px) mitten im Cockpit, das sonst keins hat.
 *
 * Die Positionierung liegt in cockpit.css (`.ck-toast-stack`), damit Bottom-Bar,
 * FAB-Höhe und `env(safe-area-inset-bottom)` an EINER Stelle gepflegt werden.
 */

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
}

interface ToastContextValue {
  show: (message: string, tone?: ToastItem['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Fehler bleiben deutlich länger stehen — sie sind zum Lesen da, nicht zum Blinken. */
const DAUER_MS: Record<ToastItem['tone'], number> = {
  info: 2200,
  success: 2200,
  error: 5000,
}

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback<ToastContextValue['show']>((message, tone = 'info') => {
    const id = ++counter
    setItems((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, DAUER_MS[tone])
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        // Fehler unterbrechen (assertive), Erfolgsmeldungen nicht.
        aria-live={items.some((t) => t.tone === 'error') ? 'assertive' : 'polite'}
        className="ck-toast-stack"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`ck-toast${t.tone === 'error' ? ' ck-toast--fehler' : t.tone === 'success' ? ' ck-toast--gut' : ''}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}
