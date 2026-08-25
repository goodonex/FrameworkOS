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
import type { LeadEreignisTyp } from '../../types/db'
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
    case 'aufgabe':
    case 'kunde_liegt':
      return null
  }
}

/**
 * Welches Lead-Ereignis ein Haken automatisch protokolliert (25.08.2026,
 * Blaupause docs/wargames/pipeline-board.md, Zug 1). Abgeleitet aus derselben
 * Spur-Tabelle wie `metrikFeldFuer`, aber eine eigene Funktion — nicht jede
 * Spur mit einem Metrikfeld hat auch ein passendes Ereignis:
 *
 * - **`antwort` bleibt aussen vor**, obwohl sie denselben Statusweg nimmt wie
 *   `followup` (`followupErledigt`). Es gibt keinen Ereignis-Typ für „Kevin
 *   hat geantwortet" — `antwort_erhalten` bedeutet das GEGENTEIL (der LEAD hat
 *   geschrieben). Ihn hier zu schreiben wäre eine Lüge über die Historie.
 * - **`inmail` bleibt aussen vor.** Der Plan sah „beim Buchen einer InMail"
 *   vor, aber die Buchung läuft über `InmailPanel.onBuchen` als reiner
 *   Pool-Zähler (+1/-1) ohne ausgewählten Lead — es gibt dort gar keine
 *   `rowId`, an die sich ein Ereignis hängen liesse. Fund aus der Recon zu
 *   diesem Zug, nicht aus dem ursprünglichen Plan.
 */
export function ereignisTypFuer(spur: Spur): LeadEreignisTyp | null {
  switch (spur) {
    case 'erstnachricht':
      return 'erstnachricht'
    case 'followup':
      return 'followup'
    case 'loom':
      return 'loom_gesendet'
    case 'antwort':
    case 'anfrage':
    case 'inmail':
    case 'kundenaufgabe':
    case 'aufgabe':
    case 'kunde_liegt':
      return null
  }
}

/** Jede Spur genau einmal — die Quelle für AUTO_METRIK_FELDER. */
const ALLE_SPUREN = [
  'erstnachricht',
  'followup',
  'loom',
  'anfrage',
  'inmail',
  'antwort',
  'kundenaufgabe',
  'aufgabe',
  'kunde_liegt',
] as const satisfies readonly Spur[]

/**
 * Die Felder, die beim Abhaken im Arbeitsmodus von selbst mitzählen — abgeleitet
 * aus `metrikFeldFuer`, nicht abgetippt: ein neues Spur/Feld-Paar landet damit
 * automatisch hier. Trägt den „auto"-Chip in /tracking, damit Kevin nicht von
 * Hand nachzählt, was der Arbeitsmodus schon gezählt hat.
 */
export const AUTO_METRIK_FELDER: ReadonlySet<MetricField> = new Set(
  ALLE_SPUREN.map(metrikFeldFuer).filter((f): f is MetricField => f !== null),
)

export interface ArbeitsmodusTrackingDeps {
  bump: (field: MetricField, delta: number) => void
  erstnachrichtGesendet: (id: string) => Promise<void> | void
  followupErledigt: (threadId: string) => Promise<void> | void
  loomVerschickt: (threadId: string) => Promise<void> | void
  taskErledigt: (taskId: string) => void
  /** arbeits_dauern-Insert — vom Aufrufer injiziert (kennt brandId + Supabase-Client). */
  schreibeDauer: (input: { spur: Spur; postenId: string; sekunden: number }) => Promise<void> | void
  /**
   * Das Lead-Ereignis zum Haken protokollieren (0076) — OPTIONAL, weil nicht
   * jeder Aufrufer eine Lead-Historie führt (die alte Testvorgabe in
   * `verify-arbeitsmodus-tracking.ts` lässt das Feld weg und bleibt gültig).
   *
   * `rowId` ist DIESELBE Zeile wie in `erstnachrichtGesendet`/
   * `followupErledigt`/`loomVerschickt` — welche Tabelle das ist (Thread oder
   * Erstnachricht), weiss nur der Aufrufer, deshalb bekommt er die Spur mit
   * statt dass diese Datei Supabase-Tabellen kennen muss.
   */
  protokolliere?: (rowId: string, spur: Spur, typ: LeadEreignisTyp) => Promise<void> | void
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
    case 'aufgabe':
      // Beides sind Zeilen in `foundation_tasks` — der Haken schließt sie
      // wirklich. Genau das meint „wegklicken können".
      deps.taskErledigt(rowId)
      break
    // Eine Antwort HAT eine Zeile: den Thread. Bis zum 14.08.2026 lief dieser
    // Zweig leer, der Haken war rein optisch und nach dem Neuladen stand der
    // Lead wieder da — deshalb lag von 160 Threads keiner in `wartet`.
    // `markDonePatch` hat für genau diesen Fall längst den richtigen Zweig
    // (Antwort → Leiter zurück auf 0, Thread lebt weiter, nie archivieren);
    // er war vom Sales-Dashboard aus nur nicht erreichbar.
    case 'antwort':
      await deps.followupErledigt(rowId)
      break
    // 'kunde_liegt' bleibt ein abgeleitetes Signal ohne eigene Zeile — die
    // reale Aktion passiert im Projekt, der nächste Stage-Wechsel räumt es weg.
    case 'kunde_liegt':
    case 'anfrage':
    case 'inmail':
      break
  }

  // Die Lead-Historie VOR dem Metrik-Bump: „was ist passiert" zuerst,
  // „wie zählt es" danach. Ohne deps.protokolliere (alter Aufrufer, Tests)
  // passiert hier nichts — kein zweiter Pfad, keine Pflicht.
  const ereignisTyp = ereignisTypFuer(posten.spur)
  if (ereignisTyp && deps.protokolliere) await deps.protokolliere(rowId, posten.spur, ereignisTyp)

  const feld = metrikFeldFuer(posten.spur)
  if (feld) deps.bump(feld, 1)

  // Ausreißer (Handy weggelegt, Uhr läuft weiter) werden NICHT bereinigt — die
  // spätere Auswertung nimmt den Median, nicht den Mittelwert.
  await deps.schreibeDauer({ spur: posten.spur, postenId: posten.id, sekunden })
}
