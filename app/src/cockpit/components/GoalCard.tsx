import { useMemo, useState } from 'react'
import { computeMrrMetrics } from '../../lib/performanceMetrics'
import type { Contact } from '../../types/db'
import { useActiveBrand } from '../lib/activeBrand'
import { LIFE_TARGET, currentSoll, formatEuro, monthKeyOf, monthTargetFor } from '../lib/goals'
import type { DailyMetricsRow } from '../lib/useDailyMetrics'
import { useMonthGoal } from '../lib/useMonthGoal'
import { MonthCurve } from './MonthCurve'

/**
 * Ziel-Karte (Dashboard-Vereinfachung Juli 2026): fasst Primary Directive,
 * Monatskurve und Nordstern in EINER Karte zusammen — dieselbe Datenfamilie
 * (Geld vs. Ziel) gehört an einen Ort. Aufbau: Monatsumsatz groß, Soll-Zeile,
 * kompakte Kurve, Nordstern als eine Fußzeile (MRR + Retainer aus dem CRM).
 */
export function GoalCard({
  monthRevenue,
  monthRows,
  contacts,
}: {
  monthRevenue: number
  monthRows: DailyMetricsRow[]
  contacts: Contact[]
}) {
  const now = new Date()
  const monthKey = monthKeyOf(now)
  const { activeBrand } = useActiveBrand()
  const goal = useMonthGoal(activeBrand?.id, monthKey)
  const month = monthTargetFor(monthKey, goal.total)

  const [editing, setEditing] = useState(false)
  const [entwurf, setEntwurf] = useState('')

  const soll = month ? currentSoll(month.curve, now) : 0
  const total = month?.total ?? 0
  const onTrack = monthRevenue >= soll
  const pct = total > 0 ? Math.min(1, monthRevenue / total) : 0

  const oeffneEditor = () => {
    setEntwurf(String(total || ''))
    setEditing(true)
  }

  const speichere = () => {
    const n = Number(entwurf.replace(/[^\d]/g, ''))
    void goal.save(Number.isFinite(n) && n > 0 ? n : null)
    setEditing(false)
  }

  const { activeRetainers, currentMrr } = useMemo(
    () => computeMrrMetrics(contacts),
    [contacts],
  )
  // Solange potenzial_betrag ungepflegt ist, MRR über die Kundenzahl schätzen
  // (gleiches Fallback wie die alte Nordstern-Karte).
  const mrr = currentMrr > 0 ? currentMrr : activeRetainers * LIFE_TARGET.mrrProKunde
  const reached = activeRetainers >= LIFE_TARGET.retainerKundenZiel

  return (
    <section className="ck-panel" aria-label="Monatsziel und Nordstern">
      <div style={{ padding: '12px 14px' }}>
        <div className="ck-karten-titel" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span>Monatsziel · {month?.label ?? 'Monat'}</span>
          {/* „geplant" = für diesen Monat wurde nie ein Ziel gesetzt, es gilt der
              40.000-€-Default. Vorher stand das kommentarlos da und war nicht
              änderbar — genau die Falle ab September. */}
          {month?.generated ? <span style={{ color: 'var(--ck-warn)' }}>· Ziel geplant</span> : null}
          {!editing ? (
            <button
              type="button"
              onClick={oeffneEditor}
              className="ck-label"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--ck-text-3)',
                textDecoration: 'underline',
              }}
            >
              Ziel ändern
            </button>
          ) : null}
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '6px 0 4px', flexWrap: 'wrap' }}>
            <input
              className="ck-input"
              value={entwurf}
              onChange={(e) => setEntwurf(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') speichere()
                if (e.key === 'Escape') setEditing(false)
              }}
              inputMode="numeric"
              autoFocus
              aria-label={`Umsatzziel ${month?.label ?? ''} in Euro`}
              style={{ width: 110, fontSize: 14 }}
            />
            <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>€</span>
            <button type="button" className="ck-btn ck-btn--primary" style={{ fontSize: 10 }} onClick={speichere}>
              Speichern
            </button>
            <button type="button" className="ck-btn" style={{ fontSize: 10 }} onClick={() => setEditing(false)}>
              Abbrechen
            </button>
            {/* Nur wenn wirklich ein eigenes Ziel gesetzt ist — bei den
                hartverdrahteten Monaten gäbe es sonst nichts zurückzusetzen. */}
            {goal.total != null ? (
              <button
                type="button"
                className="ck-btn"
                style={{ fontSize: 10, color: 'var(--ck-text-3)' }}
                onClick={() => {
                  void goal.save(null)
                  setEditing(false)
                }}
              >
                Zurücksetzen
              </button>
            ) : null}
          </div>
        ) : null}

        {/* KPI-Grosszahl — einer der drei editorialen Momente, an denen das
            Tokens-Doc Instrument Serif zulaesst (Zug C4). */}
        <div className="ck-serif ck-zahl" style={{ fontSize: 30, lineHeight: 1.2, color: 'var(--ck-text-1)' }}>
          {formatEuro(monthRevenue)}
          <span style={{ fontFamily: 'var(--ck-font)', fontSize: 13, fontWeight: 400, color: 'var(--ck-text-2)' }}>
            {' '}/ {formatEuro(total)}
          </span>
        </div>

        {goal.tableMissing ? (
          <div style={{ fontSize: 11, color: 'var(--ck-text-3)', marginTop: 2 }}>
            Ziel nur auf diesem Gerät gespeichert — Migration 0062 noch nicht eingespielt.
          </div>
        ) : null}
        {goal.error ? (
          <div style={{ fontSize: 11, color: 'var(--ck-warn)', marginTop: 2 }}>{goal.error}</div>
        ) : null}
        <div style={{ height: 4, background: 'var(--ck-border)', borderRadius: 2, overflow: 'hidden', margin: '8px 0 6px' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', background: onTrack ? 'var(--ck-accent)' : 'var(--ck-idle)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="ck-label">Soll bis heute</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: onTrack ? 'var(--ck-accent)' : 'var(--ck-warn)' }}>
            {formatEuro(soll)}
          </span>
        </div>
        <div className="ck-karten-titel" style={{ marginTop: 2, color: 'var(--ck-text-3)' }}>
          {onTrack ? 'On track' : 'Input prüfen — Ernte folgt dem Lag'}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--ck-border)', padding: '6px 2px 0' }}>
        <MonthCurve monthRows={monthRows} overrideTotal={goal.total} />
      </div>

      {/* Nordstern als eine Zeile — Langfrist-Kontext, kein eigenes Panel mehr. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          padding: '8px 14px 10px',
          borderTop: '1px solid var(--ck-border)',
        }}
      >
        <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>☾ Nordstern</span>
        <span style={{ fontSize: 12, color: reached ? 'var(--ck-accent)' : 'var(--ck-text-2)' }}>
          {reached
            ? '✓ Freundin kann aufhören'
            : `${formatEuro(mrr)} / ${formatEuro(LIFE_TARGET.mrrMeilenstein)} MRR · ${activeRetainers} / ${LIFE_TARGET.retainerKundenZiel} Retainer`}
        </span>
      </div>
    </section>
  )
}
