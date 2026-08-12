import { WEEK_TARGETS } from './goals'
import type { MetricField } from './metrikFelder'
import { ANFRAGEN_LIMIT_TAG } from './prioritaet'

/**
 * Der Tages-Flow (11.08.2026) — Kevins Akquise-Ritual in fester Reihenfolge.
 *
 * Bis heute war der Zähler oben auf dem Homescreen EINE Kennzahl
 * („30/30 Anfragen"). Kevins Tag hat aber fünf Stationen, und sie hängen
 * aneinander: erst Kontakte anfragen, dann antworten, dann Looms, dann die
 * Chats ohne Antwort, zuletzt die nie angenommenen Anfragen. Dieses Modul ist
 * die Reihenfolge — nichts weiter.
 *
 * **Reine Funktionen, keine React-Importe.** Alles hier ist per
 * `npx tsx scripts/verify-tages-flow.ts` gegen Fixtures prüfbar. Die
 * Verdrahtung an die Hooks liegt in `useTagesFlow.ts`.
 *
 * **Es entsteht keine zweite Zähl-Wahrheit.** Der Flow LIEST die Tageszeile aus
 * `daily_metrics`; geschrieben wird ausschliesslich über
 * `useDailyMetrics().bump()`. Und er erfindet keine Fälligkeit: wie viele
 * Follow-ups heute dran sind, sagt weiterhin `linkedinFollowups.bucketOf`
 * (über `arbeitsmodusQuellen.followupPosten`) — diese Zahl wird hier nur
 * entgegengenommen.
 */

export type StufenId = 'anfragen' | 'nachrichten' | 'looms' | 'followups' | 'reaktivierung'

/**
 * Kevins Arbeitswoche. Die Brücke von den Wochenzielen in `goals.ts` auf den
 * Tag — damit die Tagesziele nicht als zweite, abgetippte Zahlenreihe neben
 * den Wochenzielen stehen und beim nächsten Justieren auseinanderlaufen.
 */
export const ARBEITSTAGE_WOCHE = 5

/**
 * Reaktivierung (Riege 2, die InMail-Welle) hat in `goals.ts` kein Wochenziel,
 * aus dem sich etwas ableiten liesse — sie ist keine Kanal-Kennzahl, sondern
 * ein Rückstau-Abbau. Fünf pro Tag ist Kevins Vorgabe, kein gemessener Wert;
 * überschreibbar über `ui_settings` (siehe `TAGES_FLOW_ZIELE`).
 */
export const REAKTIVIERUNG_ZIEL_TAG = 5

/** Schlüssel in `ui_settings` (Migration 0068) für eigene Tagesziele je Stufe. */
export const TAGES_FLOW_ZIELE = 'tagesFlowZiele'

export interface Stufe {
  id: StufenId
  /** Das Feld in `daily_metrics`, das diese Stufe zählt. */
  feld: MetricField
  /** Kurz — für den Ring in der Hero-Kette. */
  label: string
  /** Lang — für die Vollbild-Überschrift, wo Platz ist. */
  langLabel: string
  /** Eine Zeile darunter: was hier zu tun ist. */
  hinweis: string
  /**
   * Festes Tagesziel — oder `null`, wenn das Soll aus den Daten des Tages
   * kommt (Stufe 4: so viele Follow-ups, wie heute wirklich fällig sind).
   */
  standardZiel: number | null
}

/**
 * Die Reihenfolge ist Kevins Diktat und nicht verhandelbar (D1). Wer sie
 * ändert, ändert den Arbeitstag — nicht die Optik.
 */
export const TAGES_FLOW: readonly Stufe[] = [
  {
    id: 'anfragen',
    feld: 'li_anfragen',
    label: 'Anfragen',
    langLabel: 'Vernetzungsanfragen',
    hinweis: 'Neue Kontakte auf LinkedIn.',
    standardZiel: ANFRAGEN_LIMIT_TAG,
  },
  {
    id: 'nachrichten',
    feld: 'li_nachrichten',
    label: 'Nachrichten',
    langLabel: 'Nachrichten · LinkedIn',
    hinweis: 'Antworten und Erstnachrichten.',
    // `WEEK_TARGETS.nachrichten` auf fünf Arbeitstage. Das Wochenziel deckt LI
    // und IG zusammen ab, gezählt wird hier der LinkedIn-Anteil — der Kanal,
    // auf dem Kevins Outreach tatsächlich läuft.
    standardZiel: Math.round(WEEK_TARGETS.nachrichten / ARBEITSTAGE_WOCHE),
  },
  {
    id: 'looms',
    feld: 'looms',
    label: 'Looms',
    langLabel: 'Looms',
    hinweis: 'Analysen aufnehmen und rausschicken.',
    standardZiel: Math.round(WEEK_TARGETS.looms / ARBEITSTAGE_WOCHE),
  },
  {
    id: 'followups',
    feld: 'li_followups',
    label: 'Follow-ups',
    langLabel: 'Follow-ups · LinkedIn',
    hinweis: 'Chats ohne Antwort — was heute fällig ist.',
    // Kein festes Ziel: an einem Tag sind drei Threads fällig, am nächsten
    // dreissig. Eine erfundene Zahl wäre hier schlimmer als keine.
    standardZiel: null,
  },
  {
    id: 'reaktivierung',
    feld: 'inmails',
    label: 'Reaktivierung',
    langLabel: 'Reaktivierung · InMails',
    hinweis: 'Nie angenommene Anfragen — die InMail-Welle.',
    standardZiel: REAKTIVIERUNG_ZIEL_TAG,
  },
]

/** Eigene Tagesziele je Stufe, wie sie in `ui_settings` liegen können. */
export type ZielUeberschreibung = Partial<Record<StufenId, number>>

export interface StufenStand {
  stufe: Stufe
  /** Der heutige Stand aus `daily_metrics`. */
  wert: number
  /** Das Soll für heute — fest, überschrieben oder aus den Daten. */
  soll: number
  /** Steht die Stufe? Ein Soll von 0 gilt als erledigt (es ist nichts zu tun). */
  erledigt: boolean
}

/**
 * Nur das, was der Flow aus der Tageszeile wirklich liest. Bewusst so schmal
 * und teilweise: damit `stufenStaende` gegen ein Objektliteral prüfbar ist und
 * nicht die ganze `DailyMetricsRow` nachgebaut werden muss. Eine echte Zeile
 * aus `useDailyMetrics().today` passt hier ohne Umweg hinein.
 */
export type TagesZeile = Partial<Record<MetricField, number>>

export interface FlowEingabe {
  /** Die heutige Zeile aus `daily_metrics` (nur lesend). */
  today: TagesZeile
  /**
   * Wie viele LinkedIn-Threads heute im Bucket `faellig` stehen — das Soll der
   * vierten Stufe. Kommt von `followupPosten(threads, jetzt).length`, also aus
   * der einen Fälligkeits-Logik, nicht aus einer nachgebauten Schwelle.
   */
  faelligHeute: number
  /** Eigene Ziele aus `ui_settings`, falls gesetzt. */
  ziele?: ZielUeberschreibung
}

/**
 * Eine Überschreibung zählt nur, wenn sie eine brauchbare Zahl ist.
 *
 * Der Wert kommt aus einer Key-Value-Tabelle und war schon einmal alles
 * mögliche — ein kaputter Eintrag darf den Tages-Flow nicht auf `NaN` stellen
 * und damit jede Stufe als „nie fertig" führen.
 */
function gueltigesZiel(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= 0 && wert <= 1000
}

/** Das Soll einer Stufe für heute. */
export function sollFuer(stufe: Stufe, eingabe: FlowEingabe): number {
  // Dynamisch schlägt Überschreibung: „so viele, wie fällig sind" ist eine
  // Tatsache des Tages. Eine feste Zahl darüberzulegen hiesse, sich die
  // Warteschlange schönzurechnen.
  if (stufe.standardZiel === null) return Math.max(0, Math.trunc(eingabe.faelligHeute) || 0)
  const eigen = eingabe.ziele?.[stufe.id]
  return gueltigesZiel(eigen) ? eigen : stufe.standardZiel
}

/** Der Stand aller fünf Stufen — die eine Berechnung, die Hero und Vollbild teilen. */
export function stufenStaende(eingabe: FlowEingabe): StufenStand[] {
  return TAGES_FLOW.map((stufe) => {
    const soll = sollFuer(stufe, eingabe)
    const roh = eingabe.today[stufe.feld]
    // Ein fehlendes oder kaputtes Feld zählt als 0. Ohne diese Klammer stünde
    // `NaN >= soll` — und die Stufe wäre für immer offen.
    const wert = typeof roh === 'number' && Number.isFinite(roh) ? roh : 0
    return { stufe, wert, soll, erledigt: soll <= 0 || wert >= soll }
  })
}

/**
 * Die erste Stufe, die heute noch offen ist — dort steigt Kevin morgens ein.
 * `-1`, wenn der Tag steht.
 */
export function ersteOffeneStufe(staende: StufenStand[]): number {
  return staende.findIndex((s) => !s.erledigt)
}

/**
 * Die nächste offene Stufe nach `vonIndex` (D5, Auto-Advance).
 *
 * Erst vorwärts bis zum Ende, dann von vorn — wer mittendrin einsteigt und
 * seine Stufe abschliesst, soll nicht in einer Sackgasse landen, während vorne
 * noch etwas offen ist. Die eigene Stufe kommt nie als Antwort zurück; `-1`
 * heisst: alles steht.
 */
export function naechsteStufe(staende: StufenStand[], vonIndex: number): number {
  const n = staende.length
  if (n === 0) return -1
  for (let schritt = 1; schritt <= n; schritt++) {
    const i = (vonIndex + schritt) % n
    if (i === vonIndex) break
    if (!staende[i].erledigt) return i
  }
  return -1
}

/** Nachschlag: zu welcher Stufe gehört ein Zähl-Feld? `null` für alles Übrige. */
export function stufeFuerFeld(feld: string | undefined): Stufe | null {
  return TAGES_FLOW.find((s) => s.feld === feld) ?? null
}

/** Wie weit ist der Tag? Für die Zeile unter der Stufen-Kette. */
export function flowFortschritt(staende: StufenStand[]): { erledigt: number; gesamt: number } {
  return { erledigt: staende.filter((s) => s.erledigt).length, gesamt: staende.length }
}
