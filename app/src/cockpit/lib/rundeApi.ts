import { useCallback, useEffect, useRef, useState } from 'react'
import { beauftrageRunnerOhneWarten, leseSpiegel, runnerDirekt } from './runnerBridge'
import { RUNNER_BASE_URL } from './useRunnerStatus'

/**
 * Die Runde im Cockpit (31.08.2026) — Kevins Ladebildschirm.
 *
 * Wörtlich sein Bild davon: *„dann sagt er, hey, wollen wir jetzt den neuesten
 * Stand laden? Und ich sag ja und dann geht halt dieser Balken los […] und dann
 * komm ich an 'n Schreibtisch und seh, ah, okay, der ist zu siebzig Prozent
 * durch."*
 *
 * Die Rechenarbeit steckt im Runner (`runner/runde.mjs`), nicht hier: Prozent,
 * Kopfzeile und Restschätzung kommen fertig über die Leitung. Zwei Stellen, die
 * dieselbe Zahl ausrechnen, laufen irgendwann auseinander — und dann ist keine
 * von beiden mehr etwas wert.
 */

export type EtappenStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'uebersprungen'

export interface Etappe {
  schluessel: string
  titel: string
  wieLange: string
  gewicht: number
  status: EtappenStatus
  text: string
  anteil: number | null
  von: number | null
  bis: number | null
}

export interface Runde {
  id: string
  gestartet: string
  beendet: string | null
  ausloeser: string
  status: 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen'
  aktuell: string | null
  etappen: Etappe[]
}

export interface RundeStand {
  runde: Runde | null
  prozent: number
  kopf: string
  rest: string
  laeuft: boolean
  letzterStand: string | null
  letzterStandText: string
  /**
   * Soll beim Öffnen gefragt werden? Entschieden im Runner (`runde.mjs`), damit
   * die Vier-Stunden-Grenze nicht an zwei Stellen steht.
   */
  fragen: boolean
  /** Läuft das Sync-Chrome? Entscheidet, ob vier Etappen überhaupt etwas tun können. */
  chrome: boolean
}

/** Wie oft der Schirm nachfragt, solange etwas läuft. */
const TAKT_MS = 2000
/** Und wie oft, wenn nichts läuft — nur damit der „letzter Stand"-Satz nicht altert. */
const RUHE_TAKT_MS = 60_000

async function hole(pfad: string, init?: RequestInit): Promise<RundeStand> {
  const res = await fetch(`${RUNNER_BASE_URL}${pfad}`, { cache: 'no-store', ...init })
  if (!res.ok && res.status !== 409) throw new Error(`Runner antwortet ${res.status}`)
  return (await res.json()) as RundeStand
}

/**
 * Wie alt darf der Spiegel sein, bevor die Live-Seite ihn nicht mehr glaubt?
 *
 * Der Runner schreibt ihn beim Start, bei jedem Etappenwechsel und während der
 * Arbeit alle zweieinhalb Sekunden. Steht er länger als zwei Minuten still,
 * während er „läuft" behauptet, ist der Rechner zugeklappt worden — dann ist
 * „läuft" eine Lüge, und der Knopf muss wieder anbietbar sein.
 */
const SPIEGEL_GILT_MS = 2 * 60 * 1000

/**
 * Auf `localhost` direkt zum Runner, auf der Live-Domain über Supabase.
 *
 * Kevin: *„mir bringt das ja nix, wenn das jetzt nur auf dem Localhost
 * funktioniert."* — Deshalb dasselbe Brücken-Muster wie beim OS-Graph und beim
 * Heartbeat: Der Rechner ruft raus und spiegelt, die Seite liest mit und legt
 * Aufträge ab. Was live NICHT geht, ist der Lauf ohne laufenden Rechner: Der
 * Sync spricht mit Chrome auf Kevins Mac. Das Handy ist die Fernbedienung,
 * nicht der Motor.
 */
export async function fetchRunde(): Promise<RundeStand> {
  if (runnerDirekt()) return hole('/runde')

  const gespiegelt = await leseSpiegel<RundeStand>('runde_stand')
  if (!gespiegelt) throw new Error('Noch kein Spiegel — der Rechner war seit dem Umbau nicht an')

  const alter = Date.now() - new Date(gespiegelt.updatedAt).getTime()
  const eingefroren = gespiegelt.data.laeuft && alter > SPIEGEL_GILT_MS
  return {
    ...gespiegelt.data,
    // Ein eingefrorener Spiegel darf nicht „läuft" behaupten — sonst wartet
    // Kevin am Handy auf einen Balken, der sich nie wieder bewegt.
    laeuft: gespiegelt.data.laeuft && !eingefroren,
    kopf: eingefroren ? 'Abgerissen — lief der Rechner weiter?' : gespiegelt.data.kopf,
    rest: eingefroren ? '' : gespiegelt.data.rest,
  }
}

export async function startRunde(optionen: { nur?: string[]; tief?: boolean } = {}): Promise<RundeStand> {
  if (runnerDirekt()) {
    return hole('/runde/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ausloeser: 'kevin', ...optionen }),
    })
  }
  await beauftrageRunnerOhneWarten('runde', { ...optionen })
  // Der Runner holt den Auftrag alle vier Sekunden; bis dahin bleibt der alte
  // Stand stehen. Der Hook fasst gleich nach.
  return fetchRunde()
}

export async function brichRundeAb(): Promise<RundeStand> {
  if (runnerDirekt()) return hole('/runde/abbrechen', { method: 'POST' })
  await beauftrageRunnerOhneWarten('runde_abbrechen', {})
  return fetchRunde()
}

/**
 * Der Hook für Schirm und Knopf.
 *
 * **Der Takt wechselt mit dem Zustand.** Während eines Laufs alle zwei
 * Sekunden, sonst einmal pro Minute. Ein Cockpit, das den ganzen Tag im
 * Zwei-Sekunden-Takt fragt, ist genau die Sorte Dauerlast, wegen der dieser
 * Umbau überhaupt entstanden ist — sie wäre nur vom Runner in den Browser
 * umgezogen.
 *
 * `runnerWeg` ist kein Fehler, sondern ein Zustand: Auf der Live-Domain gibt es
 * keinen erreichbaren Runner, und dort soll der Schirm schweigen statt rot zu
 * blinken.
 */
export function useRunde() {
  const [stand, setStand] = useState<RundeStand | null>(null)
  const [runnerWeg, setRunnerWeg] = useState(false)
  const laeuftRef = useRef(false)

  const laden = useCallback(async () => {
    try {
      const s = await fetchRunde()
      setStand(s)
      setRunnerWeg(false)
      laeuftRef.current = s.laeuft
    } catch {
      setRunnerWeg(true)
      laeuftRef.current = false
    }
  }, [])

  useEffect(() => {
    let lebt = true
    let timer: number | undefined
    const tick = async () => {
      if (!lebt) return
      await laden()
      if (!lebt) return
      timer = window.setTimeout(tick, laeuftRef.current ? TAKT_MS : RUHE_TAKT_MS)
    }
    void tick()
    return () => {
      lebt = false
      if (timer) window.clearTimeout(timer)
    }
  }, [laden])

  const starten = useCallback(
    async (optionen: { nur?: string[]; tief?: boolean } = {}) => {
      try {
        const s = await startRunde(optionen)
        setStand(s)
        laeuftRef.current = true
        // Sofort nachfassen, damit der Balken nicht zwei Sekunden auf 0 steht.
        // Über die Brücke dauert es länger: Der Runner holt Aufträge alle vier
        // Sekunden ab, und erst danach steht etwas im Spiegel.
        window.setTimeout(() => void laden(), runnerDirekt() ? 400 : 2000)
        if (!runnerDirekt()) {
          window.setTimeout(() => void laden(), 6000)
          window.setTimeout(() => void laden(), 11_000)
        }
      } catch {
        setRunnerWeg(true)
      }
    },
    [laden],
  )

  const abbrechen = useCallback(async () => {
    try {
      setStand(await brichRundeAb())
    } catch {
      /* Ein misslungener Abbruch ändert nichts — der nächste Tick zeigt die Wahrheit. */
    }
  }, [])

  return { stand, runnerWeg, starten, abbrechen, neuLaden: laden }
}
