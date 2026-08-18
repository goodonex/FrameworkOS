import { useEffect, useState } from 'react'
import type { InmailStand, PoolAbleitung } from '../lib/inmailStand'

/**
 * InMail-Fenster (18.08.2026) — aus der Bestands-Kachel wurde die
 * Reaktivierungs-Zeile: vorne die Tagesration (heute X von Y, direkt
 * buchbar), dahinter der ABGELEITETE Pool.
 *
 * Kevins Frage vom 18.08. („ist das getrackt oder einfach eine Zahl?") hat
 * eine ehrliche Antwort bekommen: der Stand wird beim Speichern mit dem
 * Metrik-Datum gestempelt, und die Anzeige zieht die seither über den Flow
 * gebuchten InMails ab (`inmailStand.poolAbleitung`). Der Pool sinkt also von
 * selbst mit jedem Haken — nachjustiert wird nur noch, wenn LinkedIn anders
 * zählt (Antworten geben Credits zurück).
 */
export function InmailPanel({
  stand,
  abgeleitet,
  tagesration,
  heuteGebucht,
  onBuchen,
  onSpeichern,
}: {
  /** Der gespeicherte Stand mitsamt Stempel. */
  stand: InmailStand
  /** Pool nach Abzug der seither gebuchten InMails. */
  abgeleitet: PoolAbleitung
  /** Das Tagesziel der Reaktivierungs-Stufe. */
  tagesration: number
  /** Heute gebuchte InMails (daily_metrics). */
  heuteGebucht: number
  /** +1/−1 auf `daily_metrics.inmails` — derselbe Weg wie der Zähl-Modus. */
  onBuchen: (delta: 1 | -1) => void
  /** Speichert einen nachjustierten Stand; das Datum stempelt der Aufrufer. */
  onSpeichern: (neu: number) => void
}) {
  const [entwurf, setEntwurf] = useState(String(abgeleitet.pool))
  const [gespeichert, setGespeichert] = useState(false)

  // Kommt der Wert aus Supabase nach, darf das Feld nicht auf dem alten stehen bleiben.
  useEffect(() => {
    setEntwurf(String(abgeleitet.pool))
  }, [abgeleitet.pool])

  const zahl = Number(entwurf)
  const gueltig = entwurf.trim() !== '' && Number.isFinite(zahl) && zahl >= 0
  const geaendert = gueltig && Math.floor(zahl) !== abgeleitet.pool

  const speichern = () => {
    if (!geaendert) return
    onSpeichern(Math.floor(zahl))
    setGespeichert(true)
    window.setTimeout(() => setGespeichert(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Die Tagesration — der eigentliche Handgriff dieser Zeile. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {heuteGebucht} von {tagesration} heute
          </div>
          <div style={{ fontSize: 12, color: 'var(--ck-text-3)', marginTop: 2 }}>
            Verfasst der Skill <code>linkedin-inmail</code> — hier wird gebucht, was raus ist.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="ck-btn"
            style={{ minHeight: 44, minWidth: 44 }}
            disabled={heuteGebucht <= 0}
            onClick={() => onBuchen(-1)}
            aria-label="Eine InMail zurücknehmen"
          >
            −
          </button>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => onBuchen(1)}
            aria-label="Eine InMail buchen"
          >
            +1
          </button>
        </div>
      </div>

      {/* Der abgeleitete Pool — Herkunft offen ausgewiesen. */}
      <div style={{ fontSize: 13, color: 'var(--ck-text-2)', lineHeight: 1.6 }}>
        Pool ≈ <strong>{abgeleitet.pool} Credits</strong>
        {abgeleitet.reichtTage !== null ? <> · reicht ~{abgeleitet.reichtTage} Arbeitstage</> : null}
        <br />
        {stand.standVom ? (
          <>
            Stand vom {stand.standVom.slice(8, 10)}.{stand.standVom.slice(5, 7)}. − {abgeleitet.seitherGebucht}{' '}
            seither gebucht. Antworten geben Credits zurück — gelegentlich mit dem Sales Navigator abgleichen.
          </>
        ) : (
          <>Alt-Bestand ohne Datum — einmal speichern, dann rechnet der Pool ab hier mit.</>
        )}
      </div>

      <label className="ck-label" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        Stand nachjustieren
        <input
          className="ck-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') speichern()
          }}
          style={{ width: 110, fontSize: 13, minHeight: 40 }}
          aria-label="InMail-Credits-Stand"
        />
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          style={{ fontSize: 11, minHeight: 40 }}
          disabled={!geaendert}
          onClick={speichern}
        >
          {gespeichert ? '✓ gespeichert' : 'Speichern'}
        </button>
      </label>
    </div>
  )
}
