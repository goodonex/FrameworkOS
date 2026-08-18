import type { MetricField } from './metrikFelder'
import { TAGES_FLOW, type Stufe, type StufenId } from './tagesFlow'

/**
 * Die Felder, die Kevin im Tagesgeschäft wirklich mit dem Daumen zählt.
 *
 * **Eine Liste, zwei Orte.** Sie stand bis zum 11.08.2026 als
 * `FEATURED_FIELDS` in `QuickTrack.tsx`; seit der Zähl-Modus dieselbe Auswahl
 * braucht, liegt sie hier und wird von beiden gelesen. Wer einen Kanal
 * ergänzt, pflegt genau diese Stelle.
 *
 * Bewusst NICHT alle 19 Metrikfelder: der Zähl-Modus ist zum Abarbeiten da,
 * nicht zum Nachtragen. Alles Übrige bleibt in `/tracking` erreichbar.
 *
 * **Die Reihenfolge ist der Tages-Flow** (D7, 11.08.): vorne die Stufen aus
 * `tagesFlow.ts` in Kevins Reihenfolge, dahinter die Kanäle, die nicht Teil
 * des Rituals sind. Die Antworten-Stufe fehlt hier mit Absicht: sie hat kein
 * Zähl-Feld (Antworten werden abgearbeitet, nicht gezählt) — ihre Arbeit
 * passiert im Sales-Flow, nicht unterm Daumen.
 */
export interface ZaehlFeld {
  field: MetricField
  /** Kurz — für die Kachel im Raster. */
  label: string
  /** Lang — für die Vollbild-Überschrift, wo Platz ist. */
  langLabel: string
  /**
   * Tagesziel, falls es ein FESTES gibt. Erfunden wird hier nichts: die Ziele
   * stammen aus `tagesFlow.ts`, das sie seinerseits aus `ANFRAGEN_LIMIT_TAG`
   * und den Wochenzielen in `goals.ts` ableitet. Felder ohne Ziel zeigen ihren
   * Stand, statt eine Wunschzahl zu behaupten.
   *
   * Erstnachrichten und Follow-ups stehen bewusst OHNE Ziel in dieser Liste:
   * ihr Soll hängt an den offenen bzw. fälligen Zeilen und ist einer
   * statischen Liste nicht bekannt. Wer es braucht, fragt den Flow
   * (`useTagesFlow`).
   */
  tagesziel?: number
}

/**
 * Die kurzen Kachel-Namen. Sie bleiben, wie sie waren — im Raster steht der
 * Kanal vorne („LI …"), weil dort Instagram daneben liegt. Die langen Namen
 * und die Ziele kommen aus dem Flow, damit sie nur an einer Stelle stehen.
 */
const KURZ_LABEL: Record<StufenId, string> = {
  anfragen: 'LI Vernetzung',
  erstnachrichten: 'LI Nachricht',
  antworten: 'LI Antwort',
  followups: 'LI Follow-up',
  reaktivierung: 'Reaktivierung',
  looms: 'Loom',
}

/** Nur Stufen mit Zähl-Feld werden zu Zähl-Kacheln. */
type ZaehlbareStufe = Stufe & { feld: MetricField }

function ausStufe(stufe: ZaehlbareStufe): ZaehlFeld {
  const feld: ZaehlFeld = {
    field: stufe.feld,
    label: KURZ_LABEL[stufe.id],
    langLabel: stufe.langLabel,
  }
  if (stufe.standardZiel !== null) feld.tagesziel = stufe.standardZiel
  return feld
}

export const ZAEHL_FELDER: ZaehlFeld[] = [
  ...TAGES_FLOW.filter((s): s is ZaehlbareStufe => s.feld !== null).map(ausStufe),
  { field: 'ig_anfragen', label: 'IG Follow', langLabel: 'Follows · Instagram' },
  { field: 'ig_nachrichten', label: 'IG Nachricht', langLabel: 'Erstnachrichten · Instagram' },
  { field: 'call_followups', label: 'FU Call', langLabel: 'Follow-up-Calls' },
]

/** Nachschlag für den Vollbild-Modus: welches Feld steht an Position n? */
export function zaehlFeldFuer(field: string | undefined): ZaehlFeld | null {
  return ZAEHL_FELDER.find((z) => z.field === field) ?? null
}
