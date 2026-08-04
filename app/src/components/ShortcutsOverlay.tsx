import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

interface ShortcutsOverlayProps {
  open: boolean
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  label: string
}

interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    items: [
      { keys: ['⌘', 'K'], label: 'Command Palette öffnen' },
      { keys: ['?'], label: 'Shortcuts anzeigen' },
      { keys: ['Esc'], label: 'Overlay / Drawer schließen' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['G', 'C'], label: 'Zum Cockpit' },
      { keys: ['G', 'H'], label: 'Zum Cockpit (Home)' },
      { keys: ['G', 'S'], label: 'Zu Sales' },
      { keys: ['G', 'P'], label: 'Zu Projekten' },
      { keys: ['G', 'T'], label: 'Zum Tracking' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: ['⌘', 'Enter'], label: 'Inline-Card speichern' },
      { keys: ['Esc'], label: 'Bearbeitung abbrechen' },
      { keys: ['Tab'], label: 'Nächstes Feld' },
    ],
  },
  {
    title: 'Tasks',
    items: [
      { keys: ['N'], label: 'Neue Task (im Dashboard)' },
      { keys: ['Space'], label: 'Task abhaken' },
    ],
  },
]

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'var(--overlay-scrim-strong)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            pointerEvents: 'auto',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--surface-drawer)',
              border: '1px solid var(--glass-border-1)',
              borderRadius: 18,
              padding: 28,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.2 }}>
                  Tastatur-Shortcuts
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Drücke{' '}
                  <KeyHint>?</KeyHint> um diese Übersicht jederzeit zu öffnen.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'var(--glass-2)',
                  border: '1px solid var(--glass-border-1)',
                  color: 'var(--text-secondary)',
                  borderRadius: 8,
                  fontSize: 12,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                Schließen
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 22,
              }}
            >
              {GROUPS.map((group) => (
                <div key={group.title}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      marginBottom: 10,
                    }}
                  >
                    {group.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.items.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          fontSize: 13,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span>{item.label}</span>
                        <span style={{ display: 'flex', gap: 4 }}>
                          {item.keys.map((k, i) => (
                            <KeyHint key={`${item.label}-${i}`}>{k}</KeyHint>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        padding: '0 6px',
        borderRadius: 5,
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-2)',
        boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.25)',
        fontSize: 11,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </kbd>
  )
}
