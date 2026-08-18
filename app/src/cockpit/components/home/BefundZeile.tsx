import { istGesperrt, type AgentenBefund } from '../../lib/agentenGesundheit'

/**
 * Die Warnzeile über dem Morgen: „morgenbrief ist heute gescheitert — ansehen".
 *
 * Wörtlich die Zeile aus `MorgenArea` (O17) — dieselbe Optik, dasselbe
 * Verhalten, jetzt an zwei Orten (Morgen-Seite und Homescreen). Sie rechnet
 * nichts: `agentenBefund(runs, jetzt)` läuft im Eltern-Container, der die Runs
 * ohnehin lädt (Gesetz 4: keine neuen Datenquellen).
 *
 * **Zwei Stufen seit dem 17.08.2026.** Ein gescheiterter Einzellauf ist eine
 * Notiz — die dünne Zeile unten. Eine abgelaufene Anmeldung ist etwas anderes:
 * dann läuft GAR NICHTS mehr, kein Morgenbrief, keine Entwürfe, kein
 * Postfach-Sync. Vom 14. bis 17.08. lief drei Tage lang kein einziger Agent
 * durch, und die Meldung dazu sah aus wie jede andere rote Zeile am Handy.
 * Deshalb bekommt dieser Fall den Sperrbalken: oben, pulsierend, nicht
 * wegklickbar.
 */
export function BefundZeile({ befund, onOeffnen }: { befund: AgentenBefund; onOeffnen: () => void }) {
  // Der Sperrbalken sagt dasselbe lauter und steht weiter oben.
  if (istGesperrt(befund)) return null
  const meldung = befund.meldung
  if (!meldung) return null
  return (
    <button
      type="button"
      onClick={onOeffnen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 11px',
        borderRadius: 'var(--ck-radius)',
        border: '1px solid var(--ck-danger)',
        background: 'transparent',
        color: 'var(--ck-danger)',
        fontSize: 12,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden>⚠</span>
      <span>{meldung} — ansehen</span>
    </button>
  )
}

/**
 * Der Sperrbalken für den Fall „Uriel steht still".
 *
 * Gibt `null` zurück, solange nichts zu tun ist — er kann also bedenkenlos ganz
 * oben in jeder Ansicht stehen. Sichtbar wird er nur, wenn der Runner selbst
 * einen Grund mit `handeln: true` gemeldet hat (`runner/laufGrund.mjs`); das
 * Cockpit deutet hier nichts eigenständig.
 */
export function SperrBalken({ befund, onOeffnen }: { befund: AgentenBefund; onOeffnen: () => void }) {
  const grund = befund.handlungsbedarf?.grund
  if (!grund?.handeln) return null
  return (
    <button type="button" className="ck-sperrbalken" onClick={onOeffnen} aria-live="assertive">
      <span aria-hidden>⚠</span>
      <span className="ck-sperrbalken-text">
        {grund.kurz} — Uriel läuft nicht
        <span className="ck-sperrbalken-tun">{grund.hinweis}</span>
      </span>
      <span className="ck-sperrbalken-pfeil" aria-hidden>
        ›
      </span>
    </button>
  )
}
