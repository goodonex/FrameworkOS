import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRunde, type RundeStand } from '../lib/rundeApi'
import { Ladeschirm } from './Ladeschirm'

/**
 * Das Tor zur Runde (31.08.2026) — wann der Ladeschirm auftaucht und wann nicht.
 *
 * Drei Regeln, alle drei aus Kevins Beschreibung:
 *
 * 1. **Einmal fragen, nicht dauernd.** Beim ersten Aufschlag des Tages, und
 *    danach nur, wenn der Stand älter als vier Stunden ist (die Grenze
 *    entscheidet der Runner). Wer weggeklickt hat, wird in dieser Sitzung nicht
 *    noch einmal gefragt — eine Frage, die wiederkommt, wird zur Klickübung.
 * 2. **Nie sperren.** *„dann hab ich meinen Kaffee gemacht"* heißt: Er ist
 *    woanders, und wenn er zurückkommt, will er weiterarbeiten können. Der
 *    Schirm lässt sich weglegen, der Lauf läuft weiter.
 * 3. **Nichts auf der Live-Domain.** Dort gibt es keinen erreichbaren Runner;
 *    ein Schirm, der ins Leere fragt, wäre schlimmer als keiner.
 */

interface RundeTorWert {
  stand: RundeStand | null
  runnerWeg: boolean
  /** Den Schirm holen — der Knopf in der Statusleiste ruft das. */
  oeffnen: () => void
  /** Sofort starten, ohne Rückfrage (der „Jetzt aktualisieren"-Weg). */
  jetztLaden: () => void
}

const Kontext = createContext<RundeTorWert>({
  stand: null,
  runnerWeg: true,
  oeffnen: () => {},
  jetztLaden: () => {},
})

export const useRundeTor = () => useContext(Kontext)

export function RundeTor({ children }: { children: ReactNode }) {
  const { stand, runnerWeg, starten, abbrechen } = useRunde()
  const [offen, setOffen] = useState(false)
  /** Einmal weggeklickt heißt: in dieser Sitzung nicht mehr von selbst fragen. */
  const [gefragt, setGefragt] = useState(false)

  // Von selbst aufgehen — nur, wenn der Runner es sagt und Kevin nicht schon
  // abgewinkt hat.
  useEffect(() => {
    if (runnerWeg || !stand || gefragt || offen) return
    if (stand.fragen) {
      setOffen(true)
      setGefragt(true)
    }
  }, [stand, runnerWeg, gefragt, offen])

  const oeffnen = useCallback(() => setOffen(true), [])
  const jetztLaden = useCallback(() => {
    setOffen(true)
    setGefragt(true)
    void starten()
  }, [starten])

  const wert = useMemo<RundeTorWert>(
    () => ({ stand, runnerWeg, oeffnen, jetztLaden }),
    [stand, runnerWeg, oeffnen, jetztLaden],
  )

  return (
    <Kontext.Provider value={wert}>
      {children}
      {offen && stand && !runnerWeg ? (
        <Ladeschirm
          stand={stand}
          onStarten={() => void starten()}
          onAbbrechen={() => {
            void abbrechen()
            setOffen(false)
          }}
          onWeglegen={() => setOffen(false)}
          onSpaeter={() => {
            setGefragt(true)
            setOffen(false)
          }}
        />
      ) : null}
    </Kontext.Provider>
  )
}

/**
 * Der Knopf in der Statusleiste — zugleich die Anzeige, solange der Schirm
 * weggelegt ist.
 *
 * Er trägt immer den aktuellen Zustand: läuft etwas, steht die Prozentzahl
 * darin; läuft nichts, steht das Alter des letzten Standes darin. Damit ist der
 * Satz *„das ist so still im Hintergrund läuft"* nicht mehr möglich — was
 * läuft, steht oben rechts.
 */
export function RundeKnopf() {
  const { stand, runnerWeg, oeffnen, jetztLaden } = useRundeTor()
  if (runnerWeg || !stand) return null

  const laeuft = stand.laeuft
  return (
    <button
      type="button"
      className="ck-btn ck-runde-knopf"
      onClick={laeuft ? oeffnen : jetztLaden}
      title={laeuft ? 'Fortschritt ansehen' : `Letzter Stand: ${stand.letzterStandText} — jetzt aktualisieren`}
      aria-label={laeuft ? `Lauf bei ${stand.prozent} Prozent — Fortschritt ansehen` : 'Neuesten Stand laden'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '0.3rem 0.6rem',
        fontSize: '0.78rem',
        whiteSpace: 'nowrap',
        ...(laeuft ? { borderColor: 'var(--ck-accent)', color: 'var(--ck-accent-text)' } : {}),
      }}
    >
      <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1 }}>⟳</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {laeuft ? `${stand.prozent}%` : stand.letzterStandText}
      </span>
    </button>
  )
}
