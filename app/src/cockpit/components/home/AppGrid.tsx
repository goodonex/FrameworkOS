import { useCallback, useRef, useState } from 'react'
import type { BereichMitIcon } from '../../lib/bereiche'
import { Badge, BadgeText } from '../Badge'
import { BereichIcon } from '../BereichIcon'

/**
 * Die App-Kacheln (O18, Zug 4) — auf dem Homescreen unter den Widgets, in der
 * Bibliothek (Zug 5) als vollständige Liste aller Bereiche.
 *
 * Zeichen und Reihenfolge kommen aus der Bereichs-Registry (`bereiche.ts`,
 * Zug 1). Das Grid entscheidet nichts über die Bereiche — es zeigt, was ihm
 * gegeben wird, und meldet den Tipp zurück.
 *
 * Badges (D5): nur aus Quellen, die die aufrufende Seite **ohnehin** geladen
 * hat. Ein Badge, das eine eigene Abfrage kostet, gehört nicht auf einen
 * Homescreen — der soll nicht nachladen, sondern dastehen.
 *
 * v2 (a): Kacheln mit Schnell-Aktionen reagieren aufs Halten — ein Tipp öffnet
 * den Bereich, ein Halten springt direkt in die Arbeit darin.
 */

export interface SchnellAktion {
  label: string
  /** Vollständige Route inkl. Parametern — das Grid navigiert nicht selbst. */
  route: string
}

/** Ab wann ein Tipp ein Halten ist. 500 ms ist der Wert, den iOS selbst nutzt. */
const HALTEN_MS = 500

export function AppGrid({
  bereiche,
  badgeFuer,
  onWaehle,
  istAktiv,
  schnellAktionen,
  anordnen = false,
  onVerschieben,
  spalten = 4,
}: {
  bereiche: BereichMitIcon[]
  badgeFuer?: (path: string) => number
  onWaehle: (path: string) => void
  istAktiv?: (path: string) => boolean
  /** Aktionen hinter dem Halten. Ohne Rückgabe bleibt die Kachel ein einfacher Tipp. */
  schnellAktionen?: (path: string) => SchnellAktion[]
  /** Anordnen-Modus (v2 d): tippen nimmt auf, zweites Tippen setzt ab. */
  anordnen?: boolean
  onVerschieben?: (was: string, vor: string) => void
  spalten?: number
}) {
  const [gehalten, setGehalten] = useState<BereichMitIcon | null>(null)
  const [aufgenommen, setAufgenommen] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  // Nach einem Halten folgt trotzdem ein Klick — der darf nicht zusätzlich
  // navigieren, sonst öffnet sich hinter dem Blatt noch der Bereich.
  const hatGehalten = useRef(false)

  const stoppe = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }, [])

  const beginne = useCallback(
    (b: BereichMitIcon, x: number, y: number) => {
      const aktionen = schnellAktionen?.(b.path) ?? []
      if (aktionen.length === 0) return
      start.current = { x, y }
      hatGehalten.current = false
      timer.current = window.setTimeout(() => {
        hatGehalten.current = true
        setGehalten(b)
      }, HALTEN_MS)
    },
    [schnellAktionen],
  )

  // Wer scrollt, hält nicht. Ohne diese Schwelle öffnet jeder Wisch über das
  // Grid das Blatt.
  const bewegt = useCallback(
    (x: number, y: number) => {
      if (!start.current) return
      if (Math.abs(x - start.current.x) > 10 || Math.abs(y - start.current.y) > 10) stoppe()
    },
    [stoppe],
  )

  return (
    <>
    {gehalten ? (
      <SchnellBlatt
        bereich={gehalten}
        aktionen={schnellAktionen?.(gehalten.path) ?? []}
        onWaehle={(route) => {
          setGehalten(null)
          onWaehle(route)
        }}
        onClose={() => setGehalten(null)}
      />
    ) : null}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))`,
        gap: 6,
      }}
    >
      {bereiche.map((b) => {
        const badge = badgeFuer?.(b.path) ?? 0
        const aktiv = istAktiv?.(b.path) ?? false
        const hatAktionen = (schnellAktionen?.(b.path) ?? []).length > 0
        return (
          <button
            key={b.path}
            type="button"
            onClick={() => {
              // Anordnen-Modus: erster Tipp nimmt auf, zweiter setzt davor ab.
              // Bewusst kein Ziehen — ein Ziehen im Anordnen-Modus kämpft mit
              // dem Scrollen der Seite, und zwei Tipps schaffen jede Strecke,
              // während Pfeiltasten für Kachel 10 neun Tipps brauchen.
              if (anordnen) {
                if (aufgenommen === null) setAufgenommen(b.path)
                else if (aufgenommen === b.path) setAufgenommen(null)
                else {
                  onVerschieben?.(aufgenommen, b.path)
                  setAufgenommen(null)
                }
                return
              }
              if (hatGehalten.current) {
                hatGehalten.current = false
                return
              }
              onWaehle(b.path)
            }}
            onPointerDown={(e) => {
              if (!anordnen) beginne(b, e.clientX, e.clientY)
            }}
            onPointerMove={(e) => bewegt(e.clientX, e.clientY)}
            onPointerUp={stoppe}
            onPointerCancel={stoppe}
            onPointerLeave={stoppe}
            // Rechtsklick am Rechner ist dieselbe Geste — praktisch beim Prüfen,
            // und auf iOS unterdrückt es zusätzlich das System-Menü.
            onContextMenu={(e) => {
              if (!hatAktionen) return
              e.preventDefault()
              stoppe()
              hatGehalten.current = true
              setGehalten(b)
            }}
            style={{
              // Touch-Ziel deutlich über 48 px — vier Spalten auf 390 px sind
              // schmal, in der Höhe ist Platz.
              minHeight: 68,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 2px',
              borderRadius: 12,
              border: `1px solid ${
                aufgenommen === b.path ? 'var(--ck-warn)' : aktiv ? 'var(--ck-accent)' : 'var(--ck-border)'
              }`,
              background: aufgenommen === b.path ? 'var(--ck-warn-dim)' : 'var(--ck-panel)',
              color: aktiv ? 'var(--ck-accent)' : 'var(--ck-text-1)',
              font: 'inherit',
              cursor: 'pointer',
              // Ohne das blendet iOS beim Halten seine eigene Auswahl-/Teilen-
              // Blase ein und die Geste gehört nicht mehr uns.
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              touchAction: 'manipulation',
            }}
          >
            <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
              <BereichIcon name={b.icon} size={22} />
              <Badge anzahl={badge} />
            </span>
            <span
              className="ck-label"
              style={{
                position: 'relative',
                fontSize: 9.5,
                letterSpacing: '0.04em',
                color: aktiv ? 'var(--ck-accent)' : 'var(--ck-text-2)',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {b.label}
              <BadgeText anzahl={badge} />
            </span>
          </button>
        )
      })}
    </div>
    </>
  )
}

/**
 * Das Blatt hinter dem Halten. Bewusst dieselbe Optik wie die Bibliothek
 * (`ck-mehr-*`): gleiche Geste, gleicher Ort, gleicher z-Index — der Nutzer
 * soll nicht zwei Sorten Bottom-Sheet lernen.
 */
function SchnellBlatt({
  bereich,
  aktionen,
  onWaehle,
  onClose,
}: {
  bereich: BereichMitIcon
  aktionen: SchnellAktion[]
  onWaehle: (route: string) => void
  onClose: () => void
}) {
  return (
    <div className="ck-mehr-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ck-mehr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Schnell-Aktionen ${bereich.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ck-label" style={{ padding: '2px 4px 8px', display: 'flex', gap: 10 }}>
          <span aria-hidden className="ck-nav-icon">
            <BereichIcon name={bereich.icon} size={18} />
          </span>
          {bereich.label}
        </div>
        {aktionen.map((a) => (
          <button
            key={a.route}
            type="button"
            className="ck-btn"
            style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start', textAlign: 'left' }}
            onClick={() => onWaehle(a.route)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className="ck-btn"
          style={{ width: '100%', minHeight: 44, marginTop: 6, color: 'var(--ck-text-3)' }}
          onClick={onClose}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
