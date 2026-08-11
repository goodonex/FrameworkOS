import { useState } from 'react'
import type { DailyMetricsRow, MetricField } from '../lib/useDailyMetrics'
import { ZAEHL_FELDER } from '../lib/zaehlFelder'

const EXPAND_KEY = 'ck.quicktrack.expanded'

/**
 * Dauerhaft sichtbare Zähler (Kevins tägliche Kanäle, Juli 2026) — der Rest
 * ist Eingabe-Detail und lebt hinter „alle anzeigen": das Dashboard zeigt
 * Status, kein Dauerformular.
 *
 * Die Liste selbst liegt seit dem 11.08. in `lib/zaehlFelder.ts`, weil der
 * Zähl-Modus dieselbe Auswahl braucht. Eine Liste, zwei Orte.
 */
const FEATURED_FIELDS: Array<{ field: MetricField; label: string }> = ZAEHL_FELDER.map((z) => ({
  field: z.field,
  label: z.label,
}))

/**
 * Was hinter „alle anzeigen" liegt — abzüglich dessen, was schon vorne steht.
 *
 * Der Filter ist kein Zierrat: seit die Reaktivierungs-Stufe (`inmails`) zum
 * Tages-Flow gehört, steht sie vorne. Ohne diese Zeile stünde derselbe Zähler
 * zweimal auf der Seite — zwei Knöpfe, die dasselbe Feld hochzählen, sind der
 * kürzeste Weg zu einer Zahl, der niemand mehr glaubt.
 */
const MORE_FIELDS_ALLE: Array<{ field: MetricField; label: string }> = [
  { field: 'inmails', label: 'InMail' },
  { field: 'ig_followups', label: 'IG Follow-up' },
  { field: 'cold_calls', label: 'Cold Call' },
]
const MORE_FIELDS = MORE_FIELDS_ALLE.filter((f) => !FEATURED_FIELDS.some((v) => v.field === f.field))

const RESULT_FIELDS: Array<{ field: MetricField; label: string }> = [
  { field: 'termine_li', label: 'Termin LI' },
  { field: 'termine_ig', label: 'Termin IG' },
  { field: 'termine_call', label: 'Termin Call' },
  { field: 'quali_termine', label: 'Quali' },
  { field: 'sales_calls', label: 'Call' },
  { field: 'abschluesse', label: 'Deal' },
]

function Counter({
  label,
  value,
  onPlus,
  vertical = false,
}: {
  label: string
  value: number
  onPlus: () => void
  /** Label über Wert+Button — für schmale 3-Spalten (Labels bleiben lesbar). */
  vertical?: boolean
}) {
  if (vertical) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          minWidth: 0,
          border: '1px solid var(--ck-border)',
          borderRadius: 'var(--ck-radius-innen)',
          padding: '5px 4px',
        }}
      >
        <span className="ck-label" style={{ fontSize: 9.5 }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 12, textAlign: 'right' }}>{value}</span>
          <button
            className="ck-btn ck-counter-btn"
            style={{ padding: '1px 6px', fontSize: 12 }}
            onClick={onPlus}
            aria-label={`${label} plus 1`}
          >
            +
          </button>
        </span>
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        minWidth: 0, // erlaubt Schrumpfen im Grid (sonst Overflow → Overlap)
        border: '1px solid var(--ck-border)',
        borderRadius: 'var(--ck-radius-innen)',
        padding: '4px 5px 4px 7px',
      }}
    >
      <span
        className="ck-label"
        style={{
          fontSize: 9.5,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        {label}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 14, textAlign: 'right' }}>
          {value}
        </span>
        <button
          className="ck-btn"
          style={{ padding: '1px 6px', fontSize: 12 }}
          onClick={onPlus}
          aria-label={`${label} plus 1`}
        >
          +
        </button>
      </span>
    </div>
  )
}

/**
 * Schnell-Tracking im Cockpit: Input-Zähler (Frühindikatoren) + Ergebnis-Zähler
 * (Quali/Call/Deal, Coach-Funnel) als Mini-Stepper — kompletter Akquise-Tag ohne
 * Bereichswechsel. Deal-Bump klappt ein Umsatz-Feld auf (Betrag, wird addiert).
 */
export function QuickTrack({
  today,
  onBump,
  onAddUmsatz,
}: {
  today: DailyMetricsRow
  onBump: (field: MetricField, delta: number) => void
  onAddUmsatz: (amount: number) => void
}) {
  const [umsatzOpen, setUmsatzOpen] = useState(false)
  const [umsatzDraft, setUmsatzDraft] = useState('')
  const [expanded, setExpanded] = useState(() => localStorage.getItem(EXPAND_KEY) === '1')

  const toggleExpanded = () => {
    setExpanded((e) => {
      const next = !e
      localStorage.setItem(EXPAND_KEY, next ? '1' : '0')
      return next
    })
  }

  const commitUmsatz = () => {
    const amount = Number(umsatzDraft.replace(',', '.'))
    if (Number.isFinite(amount) && amount > 0) onAddUmsatz(amount)
    setUmsatzDraft('')
    setUmsatzOpen(false)
  }

  const inputFields = expanded ? [...FEATURED_FIELDS, ...MORE_FIELDS] : FEATURED_FIELDS

  return (
    <section className="ck-panel" aria-label="Schnell-Tracking heute">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '10px 12px 6px',
        }}
      >
        <span className="ck-label">Quick Track · heute</span>
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          style={{
            fontSize: 10,
            color: 'var(--ck-text-3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {expanded ? 'weniger' : `alle anzeigen (${MORE_FIELDS.length}) ▸`}
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 6,
          padding: '0 10px 8px',
        }}
      >
        {inputFields.map((f) => (
          <Counter
            key={f.field}
            label={f.label}
            value={today[f.field]}
            onPlus={() => onBump(f.field, 1)}
          />
        ))}
      </div>

      <div className="ck-label" style={{ padding: '0 12px 4px', fontSize: 9 }}>
        Ergebnisse
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
          gap: 6,
          padding: '0 10px 10px',
        }}
      >
        {RESULT_FIELDS.map((f) => (
          <Counter
            key={f.field}
            label={f.label}
            value={today[f.field]}
            vertical
            onPlus={() => {
              onBump(f.field, 1)
              if (f.field === 'abschluesse') setUmsatzOpen(true)
            }}
          />
        ))}
      </div>

      {umsatzOpen ? (
        <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px', alignItems: 'center' }}>
          <input
            className="ck-input"
            type="number"
            inputMode="decimal"
            min={0}
            value={umsatzDraft}
            onChange={(e) => setUmsatzDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitUmsatz()
              if (e.key === 'Escape') setUmsatzOpen(false)
            }}
            placeholder="Umsatz € (z.B. 3500)"
            aria-label="Umsatz des Abschlusses in Euro"
            autoFocus
            style={{ flex: 1, padding: '8px 10px' }}
          />
          <button className="ck-btn ck-btn--primary" style={{ fontSize: 11 }} onClick={commitUmsatz}>
            OK
          </button>
        </div>
      ) : null}
    </section>
  )
}
