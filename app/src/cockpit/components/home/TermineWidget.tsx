import type { CalEvent } from '../../lib/termineEvents'

/**
 * Was heute feststeht — das Widget unter „Heute" (O18, Zug 2).
 *
 * Die Termine kommen fertig aus `termineAmTag(eventsByDate(…), ymd(jetzt))` im
 * Eltern-Container; das Widget formatiert nur. Ein Tipp öffnet `/termine`, wo
 * die Woche steht — hier ist bewusst nur der heutige Tag.
 */
export function TermineWidget({ termine, onOeffnen }: { termine: CalEvent[]; onOeffnen: () => void }) {
  return (
    <button
      type="button"
      className="ck-panel"
      onClick={onOeffnen}
      aria-label="Termine heute — Kalender öffnen"
      style={{
        width: '100%',
        padding: '11px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'var(--ck-text-1)',
      }}
    >
      {/* Kein eigenes Label mehr: seit dem V5-Hero (Zug A4) steht „HEUTE" als
          Sektions-Beschriftung über der Karte — zwei Überschriften für eine
          Liste sind eine zu viel. Der Knopf traegt seinen Namen weiter im
          aria-label, Vorleseprogramme verlieren also nichts. */}
      {termine.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>Heute keine.</span>
      ) : (
        termine.map((e) => (
          <span key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}>
            <span
              style={{
                color: 'var(--ck-accent)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
                minWidth: 44,
              }}
            >
              {e.time ?? '—'}
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.title}
            </span>
          </span>
        ))
      )}
    </button>
  )
}
