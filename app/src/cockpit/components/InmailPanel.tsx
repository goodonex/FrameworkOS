import { useEffect, useState } from 'react'

/**
 * InMail-Kachel-Fenster (O13 / D8): der Credits-Stand ist editierbar.
 *
 * Vorher stand die 150 als Konstante im Code (`prioritaet.ts`) — die Kachel
 * behauptete also einen Stand, den nur ein Deploy ändern konnte. Der Wert lebt
 * jetzt in `ui_settings` (Migration 0068, Schlüssel `sales.inmailCredits`):
 * kein neues Feld, keine neue Tabelle, geräteübergreifend.
 *
 * Was 150 genau ist (Gesamtbestand oder Monatskontingent), ist weiterhin offen
 * — deshalb steht hier „Bestand" und keine erfundene Tagesration.
 */
export function InmailPanel({
  wert,
  onSpeichern,
}: {
  wert: number
  onSpeichern: (neu: number) => void
}) {
  const [entwurf, setEntwurf] = useState(String(wert))
  const [gespeichert, setGespeichert] = useState(false)

  // Kommt der Wert aus Supabase nach, darf das Feld nicht auf dem alten stehen bleiben.
  useEffect(() => {
    setEntwurf(String(wert))
  }, [wert])

  const zahl = Number(entwurf)
  const gueltig = entwurf.trim() !== '' && Number.isFinite(zahl) && zahl >= 0
  const geaendert = gueltig && zahl !== wert

  const speichern = () => {
    if (!geaendert) return
    onSpeichern(Math.floor(zahl))
    setGespeichert(true)
    window.setTimeout(() => setGespeichert(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>
        Bestand, kein Tagesrhythmus. Reaktivierung offener Anfragen läuft über den Skill{' '}
        <code>linkedin-inmail</code>.
      </span>
      <label className="ck-label" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        Credits-Stand
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
      <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
        Den echten Stand zeigt LinkedIn im Sales Navigator — hier wird er nur festgehalten.
      </span>
    </div>
  )
}
