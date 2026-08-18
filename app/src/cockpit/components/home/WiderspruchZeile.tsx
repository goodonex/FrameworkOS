import { useState } from 'react'
import { useWidersprueche } from '../../../hooks/useWidersprueche'

/**
 * „Uriel widerspricht sich" — der Befund des Wächters auf dem Homescreen.
 *
 * Zugeklappt steht dort eine Zeile mit der Zahl; aufgeklappt jeder Widerspruch
 * mit dem Handgriff, der ihn behebt. Bewusst ruhig gehalten: Der Sperrbalken
 * oben ist für „nichts läuft mehr" reserviert, hier geht es um Zahlen, die
 * nicht zueinander passen — wichtig, aber nicht um sieben Uhr morgens
 * schreiend. Wer das verwechselt, hat bald zwei Warnungen, die beide
 * weggeklickt werden.
 */
export function WiderspruchZeile() {
  const { stand } = useWidersprueche()
  const [offen, setOffen] = useState(false)

  if (!stand || stand.anzahl === 0) return null

  return (
    <section className="ck-panel" style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 12.5,
          color: 'var(--ck-text-2)',
        }}
      >
        <span className="ck-label" style={{ color: stand.hoch ? 'var(--ck-warn)' : 'var(--ck-text-3)' }}>
          Widersprüche
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {stand.anzahl} Stellen, an denen zwei Quellen nicht übereinstimmen
          {stand.hoch > 0 ? ` · ${stand.hoch} dringend` : ''}
        </span>
        <span aria-hidden style={{ color: 'var(--ck-text-3)', fontSize: 12, flexShrink: 0 }}>
          {offen ? '▾' : '▸'}
        </span>
      </button>

      {offen
        ? stand.befunde.map((b) => (
            <div
              key={b.schluessel}
              style={{
                padding: '9px 14px',
                borderTop: '1px solid var(--ck-border)',
                fontSize: 12,
                color: 'var(--ck-text-2)',
              }}
            >
              <div style={{ color: b.schwere === 'hoch' ? 'var(--ck-warn)' : 'var(--ck-text-1)' }}>{b.text}</div>
              <div style={{ color: 'var(--ck-text-3)', marginTop: 2 }}>→ {b.tun}</div>
            </div>
          ))
        : null}
    </section>
  )
}
