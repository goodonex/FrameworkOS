import { RUNNER_BASE_URL } from './useRunnerStatus'
import { beauftrageRunner, runnerDirekt } from './runnerBridge'

/**
 * Rechnungen aus dem Cockpit (02.09.2026).
 *
 * Die Maschine steht unter `~/rechnungen/` und gehört dem `rechnung`-Skill —
 * hier läuft nur die Leitung dorthin. Auf diesem Rechner direkt über den
 * Runner, von aussen über einen Auftrag in `runner_jobs` (Migration 0059).
 *
 * **Warum es hier keinen Wiederholungsversuch gibt:** Jeder Lauf verbraucht
 * eine fortlaufende Rechnungsnummer. Ein automatischer zweiter Versuch nach
 * einem Timeout würde eine zweite Rechnung erzeugen, ohne dass jemand es
 * merkt. Bleibt eine Antwort aus, ist Nachsehen richtig, nicht Nachschiessen.
 */

export interface RechnungsPaket {
  schluessel: string
  titel: string
  beschreibung: string
  einzelpreis: number
  wiederkehrend: string | null
}

export interface ErstellteRechnung {
  rechnungsnummer: string
  datei: string
  dateiname: string
  netto: string
  brutto: string
  paket: string
  titel: string
}

export interface RechnungsAuftrag {
  kunde: { firma: string; strasse: string; plz: string; ort: string }
  paket: string
  betrag?: number
  leistungszeitraum?: string
  erzwingen?: boolean
}

/** Fehler mit dem Hinweis, dass es diese Rechnung heute schon gibt. */
export class DublettenFehler extends Error {
  vorhandene: { rechnungsnummer: string; brutto: string } | null
  constructor(message: string, vorhandene: DublettenFehler['vorhandene']) {
    super(message)
    this.name = 'DublettenFehler'
    this.vorhandene = vorhandene
  }
}

export async function ladePakete(): Promise<{ bereit: boolean; pakete: RechnungsPaket[] }> {
  if (!runnerDirekt()) return { bereit: false, pakete: [] }
  const res = await fetch(`${RUNNER_BASE_URL}/rechnung/pakete`)
  if (!res.ok) throw new Error(`Runner-Fehler ${res.status}`)
  return (await res.json()) as { bereit: boolean; pakete: RechnungsPaket[] }
}

export async function erstelleRechnung(auftrag: RechnungsAuftrag): Promise<ErstellteRechnung> {
  if (runnerDirekt()) {
    const res = await fetch(`${RUNNER_BASE_URL}/rechnung/erstellen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auftrag),
    })
    const body = (await res.json()) as ErstellteRechnung & {
      error?: string
      code?: string
      vorhandene?: DublettenFehler['vorhandene']
    }
    if (res.status === 409 && body.code === 'dublette') {
      throw new DublettenFehler(body.error ?? 'Rechnung existiert bereits', body.vorhandene ?? null)
    }
    if (!res.ok) throw new Error(body.error ?? `Runner-Fehler ${res.status}`)
    return body
  }

  const ergebnis = await beauftrageRunner<ErstellteRechnung>('rechnung_erstellen', {
    ...auftrag,
  } as unknown as Record<string, unknown>)
  if (ergebnis.status === 'error') {
    const text = ergebnis.error ?? 'Rechnung fehlgeschlagen'
    if (text.includes('bereits')) throw new DublettenFehler(text, null)
    throw new Error(text)
  }
  if (!ergebnis.result) throw new Error('Der Runner hat kein Ergebnis geliefert')
  return ergebnis.result
}

/** Adresse der fertigen PDF. Nur auf diesem Rechner erreichbar. */
export function rechnungsUrl(dateiname: string): string | null {
  if (!runnerDirekt()) return null
  return `${RUNNER_BASE_URL}/files/rechnungen/${encodeURIComponent(dateiname)}`
}
