import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConversionPanel } from '../components/ConversionPanel'
import { MonthCurve } from '../components/MonthCurve'
import { VitalsPanel } from '../components/VitalsPanel'
import { channelRates, funnelKpis, sumField, termineAttribution, weekVitals } from '../lib/metricsAggregate'
import type { MetricField } from '../lib/useDailyMetrics'
import { toIsoDate, useDailyMetrics } from '../lib/useDailyMetrics'
import { heutigesMetrikDatum } from '../lib/metricsDates'
import { formatEuro, monthKeyOf } from '../lib/goals'
import { useActiveBrand } from '../lib/activeBrand'
import { useMonthGoal } from '../lib/useMonthGoal'
import { AUTO_METRIK_FELDER } from '../lib/arbeitsmodusTracking'

/** Aktivitäten-Eingabe, gruppiert nach Plattform (Kevins realer Akquise-Tag). */
type InputGroup = { title: string; fields: Array<{ field: MetricField; label: string }> }
const INPUT_GROUPS: InputGroup[] = [
  {
    title: 'LinkedIn',
    fields: [
      { field: 'li_anfragen', label: 'Vernetzungsanfragen' },
      { field: 'li_nachrichten', label: 'Erstnachrichten' },
      { field: 'inmails', label: 'InMail' },
      { field: 'li_followups', label: 'Follow-ups' },
      { field: 'looms', label: 'Looms' },
    ],
  },
  {
    title: 'Instagram',
    fields: [
      { field: 'ig_anfragen', label: 'Follows' },
      { field: 'ig_nachrichten', label: 'Erstnachrichten' },
      { field: 'ig_followups', label: 'Follow-ups' },
    ],
  },
  {
    title: 'Telefon',
    fields: [
      { field: 'cold_calls', label: 'Cold Calls' },
      { field: 'call_followups', label: 'Follow-up Calls' },
    ],
  },
]

/** Termine mit Herkunft — Kevins „Gebracht"-Seite (welcher Kanal liefert Termine?). */
const TERMIN_FIELDS: Array<{ field: MetricField; label: string }> = [
  { field: 'termine_li', label: 'Termin · LinkedIn' },
  { field: 'termine_ig', label: 'Termin · Instagram' },
  { field: 'termine_call', label: 'Termin · Cold Call' },
]

/** Weitere Ergebnisse (nachlaufend): Antworten je Kanal, geführte Calls, Deal. */
const RESULT_FIELDS: Array<{ field: MetricField; label: string }> = [
  { field: 'antworten_li', label: 'Antw. LinkedIn' },
  { field: 'antworten_inmail', label: 'Antw. InMail' },
  { field: 'antworten_ig', label: 'Antw. Instagram' },
  { field: 'quali_termine', label: 'Quali-Calls geführt' },
  { field: 'sales_calls', label: 'Sales-Calls geführt' },
  { field: 'abschluesse', label: 'Abschlüsse' },
]

function Stepper({
  label,
  value,
  onBump,
  auto = false,
}: {
  label: string
  value: number
  onBump: (delta: number) => void
  /** Feld, das der Arbeitsmodus beim Abhaken selbst hochzählt (O13). */
  auto?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 0, // erlaubt Schrumpfen im Grid (sonst Overflow → Karte übersteht)
        padding: '9px 13px',
        border: '1px solid var(--ck-card-border)',
        borderRadius: 'var(--ck-radius-innen)',
      }}
    >
      {/* Zeilen-TITEL, kein Meta-Label (Zug A5): in Versalien mit 0,15em
          Sperrung passte „Vernetzungsanfragen" nicht mehr in die Zeile, und
          --ck-text-3 kam auf der Karte nur auf 3,95:1. Jetzt die Karten-
          Grammatik aus dem Mock: Satzschreibung, Titel-Farbe. */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--ck-text-1)',
          minWidth: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {auto ? (
          <span
            style={{
              flexShrink: 0,
              fontSize: 8.5,
              lineHeight: 1.6,
              padding: '0 5px',
              borderRadius: 99,
              border: '1px solid var(--ck-border)',
              color: 'var(--ck-text-3)',
            }}
            title="zählt beim Abhaken im Arbeitsmodus mit"
          >
            auto
          </span>
        ) : null}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button className="ck-btn ck-counter-btn" style={{ padding: '2px 9px' }} onClick={() => onBump(-1)} aria-label={`${label} minus 1`}>
          −
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 26, textAlign: 'center' }}>{value}</span>
        <button className="ck-btn ck-counter-btn" style={{ padding: '2px 9px' }} onClick={() => onBump(1)} aria-label={`${label} plus 1`}>
          +
        </button>
      </span>
    </div>
  )
}

function UmsatzInput({ value, onSet }: { value: number; onSet: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '9px 13px',
        border: '1px solid var(--ck-border-strong)',
        borderRadius: 'var(--ck-radius-innen)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ck-text-1)' }}>Umsatz (€)</span>
      <input
        className="ck-input"
        type="number"
        min={0}
        step={100}
        style={{ width: 110, textAlign: 'right' }}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft != null) {
            const v = Number(draft)
            if (!Number.isNaN(v)) onSet(v)
            setDraft(null)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </div>
  )
}

function RatesTable({ rates }: { rates: ReturnType<typeof channelRates> }) {
  const fmt = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`)
  return (
    <div className="ck-table-scroll">
    <table className="ck-table">
      <thead>
        <tr>
          <th>Kanal</th>
          <th style={{ textAlign: 'right' }}>Anfragen</th>
          <th style={{ textAlign: 'right' }}>Antworten</th>
          <th style={{ textAlign: 'right' }}>Rate</th>
          <th style={{ textAlign: 'right' }}>Benchmark</th>
        </tr>
      </thead>
      <tbody>
        {rates.map((r) => {
          const inBench = r.rate != null && r.rate >= r.benchMin
          return (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td style={{ textAlign: 'right' }}>{r.anfragen}</td>
              <td style={{ textAlign: 'right' }}>{r.antworten}</td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: r.rate == null ? 'var(--ck-text-3)' : inBench ? 'var(--ck-accent)' : 'var(--ck-warn)',
                }}
              >
                {fmt(r.rate)}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--ck-text-2)' }}>
                {Math.round(r.benchMin * 100)}–{Math.round(r.benchMax * 100)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}

/**
 * Tracking (REBUILD-PLAN §9): Heute-Eingabe, Wochenziele, Soll-Kurve, Kanal-Raten.
 * Frühindikator-Logik: Umsatz läuft dem Input ~1–2 Wochen nach — die UI
 * alarmiert deshalb über fehlenden INPUT, nicht über fehlenden Umsatz.
 */
export function TrackingArea() {
  const navigate = useNavigate()
  const metrics = useDailyMetrics()
  // Dasselbe Monatsziel wie auf dem Homescreen (GoalCard). Ohne diesen Wert
  // rechnete die Kurve hier mit dem Planungs-Default (40.000 €), waehrend die
  // Home das gesetzte Ziel aus `month_goals` zeigt — ab September 2026 (kein
  // hartverdrahteter Monat mehr) waeren das zwei Zahlen fuer dieselbe Sache.
  const { activeBrand } = useActiveBrand()
  const monthGoal = useMonthGoal(activeBrand?.id, monthKeyOf(new Date()))
  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.windowRows),
    [metrics.weekRows, metrics.windowRows],
  )
  const rates = useMemo(() => channelRates(metrics.monthRows), [metrics.monthRows])
  const termine = useMemo(() => termineAttribution(metrics.monthRows), [metrics.monthRows])
  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])
  const funnel = useMemo(
    () => funnelKpis(metrics.monthRows, monthRevenue),
    [metrics.monthRows, monthRevenue],
  )
  // Ausgewählter Tag fürs (rückwirkende) Eintragen — Default heute.
  const [selectedDate, setSelectedDate] = useState(heutigesMetrikDatum())

  if (metrics.tableMissing) {
    return (
      <div className="ck-panel" style={{ padding: 20, borderColor: 'var(--ck-warn)' }}>
        <div className="ck-label" style={{ color: 'var(--ck-warn)', marginBottom: 8 }}>
          Migration ausstehend
        </div>
        <p style={{ fontSize: 13, color: 'var(--ck-text-2)', lineHeight: 1.6 }}>
          Die Tabelle <code>daily_metrics</code> existiert noch nicht. Führe{' '}
          <code>supabase/migrations/0049_daily_metrics.sql</code> im Supabase-Dashboard
          (SQL-Editor) aus und lade diese Seite neu.
        </p>
      </div>
    )
  }

  const weekUmsatz = metrics.weekRows.reduce((a, r) => a + (Number(r.umsatz) || 0), 0)

  // Datums-Navigation fürs rückwirkende Eintragen.
  const todayIso = heutigesMetrikDatum()
  const shiftDate = (iso: string, delta: number) => {
    const d = new Date(`${iso}T12:00:00`) // Mittag → kein DST/TZ-Tagessprung
    d.setDate(d.getDate() + delta)
    return toIsoDate(d)
  }
  const isToday = selectedDate === todayIso
  const canPrev = selectedDate > metrics.windowStart
  const canNext = selectedDate < todayIso
  const relLabel =
    selectedDate === todayIso
      ? 'Heute'
      : selectedDate === shiftDate(todayIso, -1)
        ? 'Gestern'
        : selectedDate === shiftDate(todayIso, -2)
          ? 'Vorgestern'
          : null
  const fullLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const row = metrics.rowFor(selectedDate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100 }}>
      {/* Tages-Eingabe (mit Datums-Navigation fürs rückwirkende Eintragen) */}
      <section
        className="ck-panel"
        aria-label="Tag eintragen"
        style={!isToday ? { borderColor: 'var(--ck-accent)' } : undefined}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '10px 12px 6px',
          }}
        >
          {/* `flexWrap` ist hier kein Schoenheits-Detail: bei 390 px hat die Zeile
              340 px Platz, und sobald der „Heute"-Knopf erscheint (also an jedem
              Tag ausser heute) braucht sie 355. Ohne Umbruch schob die
              Datums-Navigation die Karte ueber den rechten Rand. */}
          <span className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="ck-btn ck-counter-btn"
              style={{ padding: '2px 9px' }}
              disabled={!canPrev}
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              aria-label="Einen Tag zurück"
            >
              ‹
            </button>
            <span style={{ minWidth: 200, textAlign: 'center' }}>
              {relLabel ? `${relLabel} · ${fullLabel}` : fullLabel}
            </span>
            <button
              className="ck-btn ck-counter-btn"
              style={{ padding: '2px 9px' }}
              disabled={!canNext}
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              aria-label="Einen Tag vor"
            >
              ›
            </button>
            {!isToday ? (
              <button
                className="ck-btn"
                style={{ fontSize: 10 }}
                onClick={() => setSelectedDate(todayIso)}
              >
                Heute
              </button>
            ) : null}
          </span>
          {metrics.error ? (
            <span className="ck-label" style={{ color: 'var(--ck-warn)' }}>Speichern fehlgeschlagen: {metrics.error}</span>
          ) : null}
        </div>

        <div style={{ padding: '0 12px 6px' }}>
          {/* Der Weg in den Zähl-Modus (11.08.). Er steht ueber den Zaehlern,
              weil er sie ersetzt, sobald der Daumen im Spiel ist. */}
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            onClick={() => navigate('/tracking/zaehlen')}
            style={{ width: '100%', minHeight: 52, fontSize: 14, margin: '2px 0 10px' }}
          >
            Zählen — ein Tipp, eine Anfrage
          </button>
          <div className="ck-label" style={{ margin: '4px 0 6px', color: 'var(--ck-text-3)' }}>Aktivitäten (Frühindikator)</div>
          {INPUT_GROUPS.map((g) => (
            <div key={g.title} style={{ marginBottom: 8 }}>
              <div className="ck-label" style={{ margin: '2px 0 5px', fontSize: 9.5, color: 'var(--ck-text-3)' }}>{g.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {g.fields.map((f) => (
                  <Stepper
                    key={f.field}
                    label={f.label}
                    auto={AUTO_METRIK_FELDER.has(f.field)}
                    value={row[f.field]}
                    onBump={(d) => metrics.bumpOn(selectedDate, f.field, d)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="ck-label" style={{ margin: '12px 0 6px', color: 'var(--ck-text-3)' }}>Termine gebracht — welcher Kanal?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {TERMIN_FIELDS.map((f) => (
              <Stepper
                key={f.field}
                label={f.label}
                auto={AUTO_METRIK_FELDER.has(f.field)}
                value={row[f.field]}
                onBump={(d) => metrics.bumpOn(selectedDate, f.field, d)}
              />
            ))}
          </div>
          <div className="ck-label" style={{ margin: '12px 0 6px', color: 'var(--ck-text-3)' }}>Weitere Ergebnisse (nachlaufend)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, paddingBottom: 10 }}>
            {RESULT_FIELDS.map((f) => (
              <Stepper
                key={f.field}
                label={f.label}
                auto={AUTO_METRIK_FELDER.has(f.field)}
                value={row[f.field]}
                onBump={(d) => metrics.bumpOn(selectedDate, f.field, d)}
              />
            ))}
            <UmsatzInput key={selectedDate} value={row.umsatz} onSet={(v) => metrics.setUmsatzOn(selectedDate, v)} />
          </div>
        </div>
      </section>

      {/* Woche + Monat nebeneinander */}
      <div className="ck-tracking-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <VitalsPanel vitals={vitals} />
          <section className="ck-panel" style={{ padding: '10px 12px' }} aria-label="Wochenumsatz">
            <div className="ck-label">Umsatz diese Woche</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{formatEuro(weekUmsatz)}</div>
          </section>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <section className="ck-panel" style={{ padding: '10px 12px' }} aria-label="Monatskurve">
            <MonthCurve monthRows={metrics.monthRows} overrideTotal={monthGoal.total} />
          </section>
          {/* Funnel-Conversions (von der Home hierher gezogen — Monats-Analyse, kein Tagessteuerungs-Instrument) */}
          <ConversionPanel kpis={funnel} />
        </div>
      </div>

      {/* Kanal-Antwortraten */}
      <section className="ck-panel" aria-label="Antwortrate je Kanal">
        <div className="ck-label" style={{ padding: '10px 12px 4px' }}>
          Antwortrate je Kanal · laufender Monat
        </div>
        <RatesTable rates={rates} />
        <p className="ck-label" style={{ padding: '8px 12px', color: 'var(--ck-text-3)' }}>
          Aussagekräftig ab ~2 Wochen Daten. Rate unter Benchmark → Skript/Zielgruppe prüfen, nicht härter senden.
        </p>
      </section>

      {/* Termine-Herkunft: welcher Kanal liefert Termine + Termine ÷ Aktionen */}
      <section className="ck-panel" aria-label="Termine je Herkunfts-Kanal">
        <div className="ck-label" style={{ padding: '10px 12px 4px' }}>
          Termine-Herkunft · laufender Monat
        </div>
        <div className="ck-table-scroll">
          <table className="ck-table">
            <thead>
              <tr>
                <th>Herkunft</th>
                <th style={{ textAlign: 'right' }}>Termine</th>
                <th style={{ textAlign: 'right' }}>Anteil</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'LinkedIn', v: termine.li },
                { label: 'Instagram', v: termine.ig },
                { label: 'Cold Call', v: termine.call },
              ].map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.v}</td>
                  <td style={{ textAlign: 'right', color: 'var(--ck-text-3)' }}>
                    {termine.total > 0 ? `${Math.round((r.v / termine.total) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600 }}>Gesamt</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{termine.total}</td>
                <td style={{ textAlign: 'right', color: 'var(--ck-text-3)' }}>
                  {termine.proAktion == null ? '—' : `${(termine.proAktion * 100).toFixed(1)}% / Aktion`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="ck-label" style={{ padding: '8px 12px', color: 'var(--ck-text-3)' }}>
          „% / Aktion" = Termine ÷ Aktionen (ohne Follow-ups): wie hart jeder ausgehende Kontakt arbeitet.
        </p>
      </section>
    </div>
  )
}
