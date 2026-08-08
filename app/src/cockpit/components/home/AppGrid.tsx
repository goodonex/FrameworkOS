import type { BereichMitIcon } from '../../lib/bereiche'
import { Badge, BadgeText } from '../Badge'

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
 */
export function AppGrid({
  bereiche,
  badgeFuer,
  onWaehle,
  istAktiv,
  spalten = 4,
}: {
  bereiche: BereichMitIcon[]
  badgeFuer?: (path: string) => number
  onWaehle: (path: string) => void
  istAktiv?: (path: string) => boolean
  spalten?: number
}) {
  return (
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
        return (
          <button
            key={b.path}
            type="button"
            onClick={() => onWaehle(b.path)}
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
              border: `1px solid ${aktiv ? 'var(--ck-accent)' : 'var(--ck-border)'}`,
              background: 'var(--ck-panel)',
              color: aktiv ? 'var(--ck-accent)' : 'var(--ck-text-1)',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              className="ck-nav-icon"
              style={{ position: 'relative', fontSize: 20, width: 'auto', lineHeight: 1 }}
            >
              {b.icon}
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
  )
}
