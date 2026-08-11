import { ANFRAGEN_LIMIT_TAG } from './prioritaet'
import type { MetricField } from './metrikFelder'

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
 */
export interface ZaehlFeld {
  field: MetricField
  /** Kurz — für die Kachel im Raster. */
  label: string
  /** Lang — für die Vollbild-Überschrift, wo Platz ist. */
  langLabel: string
  /**
   * Tagesziel, falls es eines GIBT. Erfunden wird hier nichts: heute existiert
   * genau ein echtes Tagesziel im Code (`ANFRAGEN_LIMIT_TAG` in
   * `prioritaet.ts`, die Zahl, gegen die auch der Ring auf dem Homescreen
   * läuft). Alle anderen Felder zeigen ihren Stand ohne Ziel, statt eine
   * Wunschzahl zu behaupten.
   */
  tagesziel?: number
}

export const ZAEHL_FELDER: ZaehlFeld[] = [
  {
    field: 'li_anfragen',
    label: 'LI Vernetzung',
    langLabel: 'Vernetzungsanfragen',
    tagesziel: ANFRAGEN_LIMIT_TAG,
  },
  { field: 'li_nachrichten', label: 'LI Nachricht', langLabel: 'Erstnachrichten · LinkedIn' },
  { field: 'li_followups', label: 'LI Follow-up', langLabel: 'Follow-ups · LinkedIn' },
  { field: 'looms', label: 'Loom', langLabel: 'Looms' },
  { field: 'ig_anfragen', label: 'IG Follow', langLabel: 'Follows · Instagram' },
  { field: 'ig_nachrichten', label: 'IG Nachricht', langLabel: 'Erstnachrichten · Instagram' },
  { field: 'call_followups', label: 'FU Call', langLabel: 'Follow-up-Calls' },
]

/** Nachschlag für den Vollbild-Modus: welches Feld steht an Position n? */
export function zaehlFeldFuer(field: string | undefined): ZaehlFeld | null {
  return ZAEHL_FELDER.find((z) => z.field === field) ?? null
}
