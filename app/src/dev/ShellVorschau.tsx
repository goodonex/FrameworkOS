import { useState } from 'react'
import { CommandPalette } from '../components/CommandPalette'
import { ToastProvider, useToast } from '../components/Toast'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login): Command-Palette und
 * Toasts. Beide hängen im Produktivbetrieb über der Auth-Shell und sind sonst
 * nur mit Session prüfbar — hier lassen sich ck-Optik, Bereichsliste und die
 * Toast-Position über FAB/Bottom-Bar ohne Anmeldung ansehen.
 *
 * Kontakte/Projekte bleiben leer (keine Supabase-Session); die Bereichsliste
 * kommt aus `bereiche.ts` und ist vollständig.
 */
function Innen() {
  const { show } = useToast()
  const [palette, setPalette] = useState(true)

  return (
    <div
      className="ck-root"
      style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24, pointerEvents: 'auto' }}
    >
      <div className="ck-label" style={{ marginBottom: 14 }}>
        Dev-Vorschau · Shell-Bausteine
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="ck-btn" style={{ minHeight: 40 }} onClick={() => setPalette(true)}>
          Command-Palette öffnen
        </button>
        <button type="button" className="ck-btn" style={{ minHeight: 40 }} onClick={() => show('Entwurf kopiert')}>
          Toast: Info
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ minHeight: 40 }}
          onClick={() => show('Loom-Skript fertig', 'success')}
        >
          Toast: Erfolg
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ minHeight: 40 }}
          onClick={() => show('Upsert fehlgeschlagen: HTTP 400 — Spalte entwurf fehlt', 'error')}
        >
          Toast: Fehler (5 s)
        </button>
      </div>

      {/* Attrappen an den echten Positionen, damit sichtbar wird, dass der Toast
          künftig darüber liegt statt darauf. */}
      <button type="button" className="ck-btn ck-chat-fab" style={{ minHeight: 44 }}>
        Chat
      </button>
      <button type="button" className="ck-btn ck-uriel-fab" style={{ minHeight: 44 }}>
        Uriel
      </button>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}

export function ShellVorschau() {
  return (
    <ToastProvider>
      <Innen />
    </ToastProvider>
  )
}
