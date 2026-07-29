import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Posten } from '../lib/prioritaet'

/** Ergebnis eines abgehakten Postens — Zug 4 schreibt daraus genau ein Metrik-Feld + die Dauer. */
export interface ArbeitsmodusErgebnis {
  posten: Posten
  sekunden: number
}

interface ArbeitsmodusProps {
  /** bereits sortiert (Zug 1, `ordnePosten`) — der Modus entscheidet über die Reihenfolge nicht selbst */
  posten: Posten[]
  onErledigt: (ergebnis: ArbeitsmodusErgebnis) => void
  onClose: () => void
}

function websiteHref(website: string): string {
  return /^https?:\/\//.test(website) ? website : `https://${website}`
}

/**
 * Vollbild-Arbeitsmodus (Wargame docs/wargames/sales-arbeitsmodus.md, Zug 3).
 * Ein Posten gleichzeitig, spurübergreifend von oben nach unten.
 *
 * Bekannte Falle (App.tsx): `#app-ui-overlay` setzt global `pointer-events: none`.
 * Dieses Overlay setzt `pointerEvents: 'auto'` deshalb selbst — unabhängig davon,
 * ob es innerhalb der CockpitShell (die das ebenfalls tut) montiert wird.
 */
export function Arbeitsmodus({ posten, onErledigt, onClose }: ArbeitsmodusProps) {
  const [index, setIndex] = useState(0)
  const [angezeigtAt, setAngezeigtAt] = useState(() => Date.now())
  const [erledigtCount, setErledigtCount] = useState(0)
  const [kopiert, setKopiert] = useState(false)
  const [kopierGesperrt, setKopierGesperrt] = useState(false)
  // Verhindert Doppelzählung bei Doppelklick — jede Posten-ID darf genau einmal
  // von 'offen' auf 'erledigt' übergehen (Wargame Zug 4, gefährlichste Stelle).
  const verarbeiteteRef = useRef<Set<string>>(new Set())

  const gesamt = posten.length
  const aktuell = index < gesamt ? posten[index] : undefined

  // Neuer Posten eingeblendet → Uhr für die Dauer-Messung neu starten (Zug 4).
  useEffect(() => {
    setAngezeigtAt(Date.now())
    setKopiert(false)
    setKopierGesperrt(false)
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kopieren = useCallback(async () => {
    if (!aktuell) return
    try {
      await navigator.clipboard.writeText(aktuell.text)
      setKopiert(true)
      setKopierGesperrt(false)
      window.setTimeout(() => setKopiert(false), 2000)
    } catch {
      // Zwischenablage ohne sicheren Kontext/Nutzergeste gesperrt — nie stumm scheitern.
      setKopierGesperrt(true)
    }
  }, [aktuell])

  const erledigt = useCallback(() => {
    if (!aktuell) return
    if (verarbeiteteRef.current.has(aktuell.id)) return
    verarbeiteteRef.current.add(aktuell.id)
    const sekunden = Math.max(0, Math.round((Date.now() - angezeigtAt) / 1000))
    onErledigt({ posten: aktuell, sekunden })
    setErledigtCount((n) => n + 1)
    setIndex((i) => i + 1)
  }, [aktuell, angezeigtAt, onErledigt])

  const ueberspringen = useCallback(() => {
    setIndex((i) => i + 1)
  }, [])

  if (gesamt === 0) return null

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    pointerEvents: 'auto',
    background: 'var(--ck-bg)',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  }

  if (!aktuell) {
    return (
      <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Arbeitsmodus — Abschluss">
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div className="ck-label">Fertig</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--ck-text-1)' }}>
            {erledigtCount} von {gesamt} erledigt
          </div>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 48, paddingInline: 24 }}
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Arbeitsmodus">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '14px 16px',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className="ck-label">
            {index + 1} / {gesamt}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ck-btn"
            style={{ minHeight: 40 }}
            aria-label="Schließen"
          >
            Schließen
          </button>
        </div>

        <div style={{ height: 3, background: 'var(--ck-border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
          <div
            style={{
              height: '100%',
              width: `${(index / gesamt) * 100}%`,
              background: 'var(--ck-accent)',
              transition: 'width 200ms ease',
            }}
          />
        </div>

        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ck-text-1)', lineHeight: 1.25 }}>{aktuell.name}</div>
          {aktuell.firma ? (
            <div style={{ fontSize: 14, color: 'var(--ck-text-2)', marginTop: 2 }}>{aktuell.firma}</div>
          ) : null}
          {aktuell.website ? (
            <a
              href={websiteHref(aktuell.website)}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: 'var(--ck-accent)', textDecoration: 'none' }}
            >
              {aktuell.website}
            </a>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--ck-text-1)',
          }}
        >
          {aktuell.text}
        </div>

        {kopierGesperrt ? (
          <div style={{ fontSize: 12, color: 'var(--ck-warn)', flexShrink: 0 }}>
            Zwischenablage gesperrt — Text oben markieren und kopieren.
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 48, flex: '1 1 100%' }}
            onClick={() => void kopieren()}
          >
            {kopiert ? '✓ Kopiert' : 'Kopieren'}
          </button>
          <button
            type="button"
            className="ck-btn"
            style={{ minHeight: 48, flex: '1 1 auto' }}
            onClick={erledigt}
          >
            Erledigt
          </button>
          <button
            type="button"
            className="ck-btn"
            style={{ minHeight: 48, flex: '1 1 auto', color: 'var(--ck-text-3)' }}
            onClick={ueberspringen}
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  )
}
