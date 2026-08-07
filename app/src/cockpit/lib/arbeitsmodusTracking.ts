/**
 * Schreibt ein abgehaktes Posten in die richtige(n) Zeile(n) (Wargame
 * docs/wargames/sales-arbeitsmodus.md, Zug 4 — „die gefährlichste Stelle des
 * Plans"). Nimmt die Schreibfunktionen als Abhängigkeiten entgegen, statt
 * eigene Hook-Instanzen zu öffnen — SalesDashboard (Zug 5) hat sie ohnehin
 * schon für die Kacheln geladen; zweite Subscriptions wären verschwendet.
 *
 * Mapping Spur → Metrik-Feld ist Kevins Tabelle wörtlich: `antwort`,
 * `kundenaufgabe` und `kunde_liegt` zählen bewusst NICHT — kein neues Feld in
 * METRIC_FIELDS erfinden, wenn eine Spur auf keins passt.
 */
import type { Spur } from './prioritaet'
import { zeilenId } from './arbeitsmodusQuellen'
import type { ArbeitsmodusErgebnis } from '../components/Arbeitsmodus'
import type { MetricField } from './useDailyMetrics'

export function metrikFeldFuer(spur: Spur): MetricField | null {
  switch (spur) {
    case 'erstnachricht':
      return 'li_nachrichten'
    case 'followup':
      return 'li_followups'
    case 'loom':
      return 'looms'
    case 'anfrage':
      return 'li_anfragen'
    case 'inmail':
      return 'inmails'
    case 'antwort':
    case 'kundenaufgabe':
    case 'kunde_liegt':
      return null
  }
}

export interface ArbeitsmodusTrackingDeps {
  bump: (field: MetricField, delta: number) => void
  erstnachrichtGesendet: (id: string) => Promise<void> | void
  followupErledigt: (threadId: string) => Promise<void> | void
  loomVerschickt: (threadId: string) => Promise<void> | void
  taskErledigt: (taskId: string) => void
  /** arbeits_dauern-Insert — vom Aufrufer injiziert (kennt brandId + Supabase-Client). */
  schreibeDauer: (input: { spur: Spur; postenId: string; sekunden: number }) => Promise<void> | void
}

/**
 * Führt die zur Spur passende Schreibaktion aus (Status-Übergang der
 * zugrunde liegenden Zeile), bumpt danach genau das eine Metrik-Feld (falls
 * vorhanden) und speichert die gemessene Dauer in `arbeits_dauern`.
 *
 * Zählt beim wiederholten Aufruf für dieselbe Posten-ID trotzdem noch einmal
 * — der Doppelklick-Schutz („nur beim Übergang offen → erledigt") sitzt in
 * der UI (Arbeitsmodus.tsx), nicht hier, weil nur sie weiß, ob ein Posten in
 * dieser Sitzung schon einmal abgehakt wurde.
 */
export async function erledigePosten(
  { posten, sekunden }: ArbeitsmodusErgebnis,
  deps: ArbeitsmodusTrackingDeps,
): Promise<void> {
  // O7: Reine Erinnerungs-Posten haben keine Zeile zum Abhaken und keinen
  // eigenen Zaehler — ihr Metrikfeld wird woanders hochgezaehlt. Ohne diese
  // Sperre wuerde `bump(metrikFeldFuer(spur))` unten doppelt zaehlen. Der
  // Guard steht bewusst VOR allem anderen, nicht als Sonderfall im switch.
  if (posten.nurZaehler) return

  const rowId = zeilenId(posten.id)

  switch (posten.spur) {
    case 'erstnachricht':
      await deps.erstnachrichtGesendet(rowId)
      break
    case 'followup':
      await deps.followupErledigt(rowId)
      break
    case 'loom':
      await deps.loomVerschickt(rowId)
      break
    case 'kundenaufgabe':
      deps.taskErledigt(rowId)
      break
    // 'antwort' und 'kunde_liegt' sind abgeleitete Signale ohne eigene Zeile
    // zum Abhaken — die reale Aktion (Antwort schreiben, Follow-up senden)
    // passiert außerhalb; der nächste Sync/Stage-Wechsel räumt sie selbst weg.
    case 'antwort':
    case 'kunde_liegt':
    case 'anfrage':
    case 'inmail':
      break
  }

  const feld = metrikFeldFuer(posten.spur)
  if (feld) deps.bump(feld, 1)

  // Ausreißer (Handy weggelegt, Uhr läuft weiter) werden NICHT bereinigt — die
  // spätere Auswertung nimmt den Median, nicht den Mittelwert.
  await deps.schreibeDauer({ spur: posten.spur, postenId: posten.id, sekunden })
}
