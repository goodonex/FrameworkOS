import { WEEK_TARGETS } from './goals'
import type { MetricField } from './metrikFelder'
import { ANFRAGEN_LIMIT_TAG } from './prioritaet'

/**
 * Der Tages-Flow — Kevins Akquise-Ritual in fester Reihenfolge.
 *
 * Entstanden am 11.08.2026 mit fünf Stufen; am 18.08.2026 hat Kevin die
 * Reihenfolge neu diktiert und zwei Dinge getrennt, die vorher in einer Stufe
 * steckten: **Erstnachrichten** (an alle, die angenommen haben) und
 * **Antworten** (wer geschrieben hat, wartet auf Kevin) sind zwei Stationen —
 * und die Antworten sind keine Zähl-Stufe, sondern eine Frische-Frage: nicht
 * „wie viele heute", sondern „wartet jemand länger als einen Tag?".
 *
 * **Reine Funktionen, keine React-Importe.** Alles hier ist per
 * `npx tsx scripts/verify-tages-flow.ts` gegen Fixtures prüfbar. Die
 * Verdrahtung an die Hooks liegt in `useTagesFlow.ts`.
 *
 * **Es entsteht keine zweite Zähl-Wahrheit.** Der Flow LIEST die Tageszeile aus
 * `daily_metrics`; geschrieben wird ausschliesslich über
 * `useDailyMetrics().bump()`. Und er erfindet keine Fälligkeit: wie viele
 * Follow-ups oder Erstnachrichten offen sind, sagen die Quellen in
 * `arbeitsmodusQuellen` — diese Zahlen werden hier nur entgegengenommen.
 */

export type StufenId =
  | 'anfragen'
  | 'erstnachrichten'
  | 'antworten'
  | 'followups'
  | 'reaktivierung'
  | 'looms'

/**
 * Zwei Arten von Stufen, zwei Arten von „grün":
 *
 * - `zaehler`: ein Soll für heute, erledigt wenn der Zähler es erreicht — oder
 *   wenn nichts (mehr) offen ist. Eine leere Pflicht ist erfüllt.
 * - `frische`: kein Soll. Erledigt, solange nichts über der Frische-Schwelle
 *   wartet. Wer beide Arten mit derselben Logik baut, bekommt Kacheln, die
 *   „0 offen" als Erfolg verkaufen — oder nie grün werden.
 */
export type StufenArt = 'zaehler' | 'frische'

/**
 * Kevins Arbeitswoche. Die Brücke von den Wochenzielen in `goals.ts` auf den
 * Tag — damit die Tagesziele nicht als zweite, abgetippte Zahlenreihe neben
 * den Wochenzielen stehen und beim nächsten Justieren auseinanderlaufen.
 */
export const ARBEITSTAGE_WOCHE = 5

/**
 * Reaktivierung (die InMail-Welle) hat in `goals.ts` kein Wochenziel, aus dem
 * sich etwas ableiten liesse — sie ist keine Kanal-Kennzahl, sondern ein
 * Rückstau-Abbau. Fünf pro Tag ist Kevins Vorgabe, kein gemessener Wert;
 * überschreibbar über `ui_settings` (siehe `TAGES_FLOW_ZIELE`).
 */
export const REAKTIVIERUNG_ZIEL_TAG = 5

/**
 * Die Follow-up-Drossel (18.08.2026): Der Rückstand liegt bei ~200 Threads.
 * Liefe das volle Fällige als Soll in die Stufe, wäre sie nie grün — und eine
 * Zeile, die nie grün wird, ist keine Routine, sondern ein Vorwurf. Die Stufe
 * zieht deshalb eine feste Tagesportion aus dem Berg; der Rest ist bewusst
 * unsichtbar. Überschreibbar über `ui_settings` (`followups` in
 * `TAGES_FLOW_ZIELE`).
 */
export const FOLLOWUP_PORTION_TAG = 20

/**
 * Ab wann eine wartende Antwort die Frische-Stufe rot macht. Bei Antworten
 * zählt Reaktionszeit, nicht Vollständigkeit — 43 können warten, solange
 * keine davon von vorgestern ist.
 */
export const ANTWORT_FRISCHE_STUNDEN = 24

/** Schlüssel in `ui_settings` (Migration 0068) für eigene Tagesziele je Stufe. */
export const TAGES_FLOW_ZIELE = 'tagesFlowZiele'

export interface Stufe {
  id: StufenId
  art: StufenArt
  /**
   * Das Feld in `daily_metrics`, das diese Stufe zählt — `null` bei der
   * Frische-Stufe: Antworten werden abgearbeitet, nicht gezählt (das Mapping
   * `antwort → null` in `arbeitsmodusTracking.metrikFeldFuer` ist Kevins
   * Tabelle wörtlich).
   */
  feld: MetricField | null
  /** Kurz — für den Ring in der Hero-Kette. */
  label: string
  /** Lang — für die Vollbild-Überschrift, wo Platz ist. */
  langLabel: string
  /** Eine Zeile darunter: was hier zu tun ist. */
  hinweis: string
  /**
   * Festes Tagesziel — oder `null`, wenn das Soll aus den Daten des Tages
   * kommt (Erstnachrichten: so viele, wie offen sind; Follow-ups: die
   * Tagesportion aus dem Fälligen; Looms: das Ziel, gedeckelt auf die
   * offenen Zusagen).
   */
  standardZiel: number | null
}

/**
 * Die Reihenfolge ist Kevins Diktat und nicht verhandelbar (D1, neu diktiert
 * am 18.08.2026). Wer sie ändert, ändert den Arbeitstag — nicht die Optik:
 * morgens erst alle Anfragen raus, dann bekommen die Annehmer ihre
 * Erstnachricht, dann die wartenden Antworten, dann die Follow-up-Portion,
 * dann die InMail-Welle an die Nie-Annehmer, zuletzt die zugesagten Looms.
 */
export const TAGES_FLOW: readonly Stufe[] = [
  {
    id: 'anfragen',
    art: 'zaehler',
    feld: 'li_anfragen',
    label: 'Anfragen',
    langLabel: 'Vernetzungsanfragen',
    hinweis: 'Neue Kontakte auf LinkedIn.',
    standardZiel: ANFRAGEN_LIMIT_TAG,
  },
  {
    id: 'erstnachrichten',
    art: 'zaehler',
    feld: 'li_nachrichten',
    label: 'Erstnachrichten',
    langLabel: 'Erstnachrichten · LinkedIn',
    hinweis: 'Wer angenommen hat, bekommt seine Nachricht.',
    // Kein festes Ziel: es gehen alle raus, die durch Annahmen entstanden
    // sind — an einem Tag zwei, am nächsten zwölf.
    standardZiel: null,
  },
  {
    id: 'antworten',
    art: 'frische',
    feld: null,
    label: 'Antworten',
    langLabel: 'Antworten · LinkedIn',
    hinweis: 'Wer geschrieben hat, wartet auf dich.',
    standardZiel: null,
  },
  {
    id: 'followups',
    art: 'zaehler',
    feld: 'li_followups',
    label: 'Follow-ups',
    langLabel: 'Follow-ups · LinkedIn',
    hinweis: 'Chats ohne Antwort — die heutige Portion.',
    // Kein festes Ziel: die Portion kommt aus dem Fälligen, gedrosselt auf
    // FOLLOWUP_PORTION_TAG. Siehe sollFuer().
    standardZiel: null,
  },
  {
    id: 'reaktivierung',
    art: 'zaehler',
    feld: 'inmails',
    label: 'InMails',
    langLabel: 'Reaktivierung · InMails',
    hinweis: 'Nie angenommene Anfragen — die InMail-Welle.',
    standardZiel: REAKTIVIERUNG_ZIEL_TAG,
  },
  {
    id: 'looms',
    art: 'zaehler',
    feld: 'looms',
    label: 'Looms',
    langLabel: 'Looms',
    hinweis: 'Zugesagte Analysen aufnehmen und rausschicken.',
    standardZiel: Math.round(WEEK_TARGETS.looms / ARBEITSTAGE_WOCHE),
  },
]

/** Eigene Tagesziele je Stufe, wie sie in `ui_settings` liegen können. */
export type ZielUeberschreibung = Partial<Record<StufenId, number>>

/** Der Zustand der Antworten-Stufe, aus derselben Quelle wie die Sales-Liste. */
export interface AntwortenStand {
  /** Wie viele Leads warten gerade auf eine Antwort. */
  warten: number
  /** Wie lange wartet der älteste — `null`, wenn keiner wartet. */
  aeltesteStunden: number | null
}

export interface StufenStand {
  stufe: Stufe
  /** Der heutige Stand aus `daily_metrics` — bei der Frische-Stufe: wie viele warten. */
  wert: number
  /** Das Soll für heute — fest, Portion oder aus den Daten. 0 bei Frische-Stufen. */
  soll: number
  /**
   * Was JETZT noch offen ist (Live-Zahl der Quelle) — `null`, wo es keine
   * Quelle gibt (Anfragen, InMails: dort ist der Zähler die Wahrheit).
   */
  offenJetzt: number | null
  /** Steht die Stufe? Eine leere Pflicht (nichts fällig, nichts offen) gilt als erledigt. */
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
   * Wie viele LinkedIn-Threads JETZT im Bucket `faellig` stehen. Kommt von
   * `followupPosten(threads, jetzt).length`, also aus der einen
   * Fälligkeits-Logik, nicht aus einer nachgebauten Schwelle.
   */
  faelligHeute: number
  /** Offene Erstnachrichten JETZT (`erstnachrichtPosten(...).length`). */
  erstnachrichtenOffen?: number
  /** Offene Loom-Zusagen JETZT (`loomPosten(...).length`). */
  loomsOffen?: number
  /** Der Zustand der Antworten-Stufe (`antwortenStandVon(...)`). */
  antworten?: AntwortenStand
  /**
   * Die beim ersten Öffnen des Tages EINGEFRORENEN Solls (`sales_tagesportionen`).
   * Ohne Einfrieren wäre „20/20" ein bewegliches Ziel: um 14 Uhr sind es 23,
   * weil neue Fälle nachgerutscht sind — und die Stufe würde nie grün. Was
   * nach dem Einfrieren reinkommt, ist Ware für morgen.
   */
  portionen?: Partial<Record<StufenId, number>>
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

/** Fehlende oder kaputte Zahlen zählen als 0 — nie als NaN. */
function anzahl(wert: number | undefined): number {
  return typeof wert === 'number' && Number.isFinite(wert) ? Math.max(0, Math.trunc(wert)) : 0
}

/** Der heutige Zähler-Stand eines Feldes, NaN-fest. */
function wertVon(stufe: Stufe, eingabe: FlowEingabe): number {
  if (!stufe.feld) return 0
  const roh = eingabe.today[stufe.feld]
  return typeof roh === 'number' && Number.isFinite(roh) ? roh : 0
}

/**
 * Das Soll einer Stufe für heute.
 *
 * Rangfolge: eingefrorene Portion → Live-Rechnung. Die Live-Rechnung addiert
 * bei Aus-den-Daten-Stufen das heute schon Erledigte auf das noch Offene —
 * sonst schrumpfte das Soll mit jedem Haken („morgens 7, drei erledigt, Soll
 * plötzlich 4/4") und die Zeile löge über den Tag.
 */
export function sollFuer(stufe: Stufe, eingabe: FlowEingabe): number {
  if (stufe.art === 'frische') return 0

  const portion = eingabe.portionen?.[stufe.id]
  if (gueltigesZiel(portion)) return portion

  const eigen = eingabe.ziele?.[stufe.id]
  const wert = wertVon(stufe, eingabe)

  switch (stufe.id) {
    case 'erstnachrichten':
      // Alle raus, die da sind — heute Erledigte eingerechnet, damit das Soll
      // beim Abhaken stehen bleibt.
      return anzahl(eingabe.erstnachrichtenOffen) + wert
    case 'followups': {
      const drossel = gueltigesZiel(eigen) ? eigen : FOLLOWUP_PORTION_TAG
      return Math.min(drossel, anzahl(eingabe.faelligHeute) + wert)
    }
    case 'looms': {
      const ziel = gueltigesZiel(eigen) ? eigen : (stufe.standardZiel ?? 0)
      // Ohne Kenntnis der offenen Zusagen bleibt das feste Ziel stehen —
      // lieber ein zu hohes Soll als ein erfundenes „nichts fällig".
      if (eingabe.loomsOffen == null) return ziel
      return Math.min(ziel, anzahl(eingabe.loomsOffen) + wert)
    }
    default:
      return gueltigesZiel(eigen) ? eigen : (stufe.standardZiel ?? 0)
  }
}

/** Die Live-Zahl der Quelle einer Stufe — `null`, wo es keine gibt. */
function offenJetztFuer(stufe: Stufe, eingabe: FlowEingabe): number | null {
  switch (stufe.id) {
    case 'erstnachrichten':
      return eingabe.erstnachrichtenOffen == null ? null : anzahl(eingabe.erstnachrichtenOffen)
    case 'followups':
      return anzahl(eingabe.faelligHeute)
    case 'looms':
      return eingabe.loomsOffen == null ? null : anzahl(eingabe.loomsOffen)
    case 'antworten':
      return eingabe.antworten ? anzahl(eingabe.antworten.warten) : null
    default:
      return null
  }
}

/** Der Stand aller Stufen — die eine Berechnung, die Hero, Zähl-Modus und Sales teilen. */
export function stufenStaende(eingabe: FlowEingabe): StufenStand[] {
  return TAGES_FLOW.map((stufe): StufenStand => {
    if (stufe.art === 'frische') {
      const warten = eingabe.antworten ? anzahl(eingabe.antworten.warten) : 0
      const aelteste = eingabe.antworten?.aeltesteStunden ?? null
      // Frisch heisst: niemand wartet über der Schwelle. Kein Soll, keine
      // Quote — 43 dürfen warten, solange keiner von vorgestern ist.
      const erledigt = aelteste === null || aelteste < ANTWORT_FRISCHE_STUNDEN
      return { stufe, wert: warten, soll: 0, offenJetzt: warten, erledigt }
    }

    const soll = sollFuer(stufe, eingabe)
    const wert = wertVon(stufe, eingabe)
    const offenJetzt = offenJetztFuer(stufe, eingabe)
    // Erledigt auf zwei Wegen: das Soll steht — oder die Quelle ist leer
    // (eine Erstnachricht, die Kevin verwirft statt sendet, darf die Stufe
    // nicht für immer rot halten). Ein Soll von 0 gilt als erledigt.
    const erledigt = soll <= 0 || wert >= soll || offenJetzt === 0
    return { stufe, wert, soll, offenJetzt, erledigt }
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

/**
 * Wie `naechsteStufe`, aber nur Stufen mit Zähl-Feld — für das Zähl-Vollbild,
 * das nach „Stufe steht" weiterschiebt. Die Antworten-Stufe hat dort keine
 * Seite (sie wird abgearbeitet, nicht gezählt) und würde als Sprungziel auf
 * `/tracking/zaehlen/null` führen.
 */
export function naechsteZaehlbareStufe(staende: StufenStand[], vonIndex: number): number {
  const n = staende.length
  if (n === 0) return -1
  for (let schritt = 1; schritt <= n; schritt++) {
    const i = (vonIndex + schritt) % n
    if (i === vonIndex) break
    if (!staende[i].erledigt && staende[i].stufe.feld !== null) return i
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

/**
 * Die Flow-Eingaben aus den Posten-Quellen — dieselben Listen, die auch die
 * Sales-Zeilen und das Heute-Deck füttern (`usePosten().quellen` bzw. die
 * Einzel-Funktionen aus `arbeitsmodusQuellen`).
 *
 * Das ist die „eine Abfrage, eine Zahl"-Regel als Code: die Zahl auf einer
 * Flow-Zeile ist buchstäblich die Länge der Liste, die sich hinter ihr
 * öffnet — nie ein zweiter Rechenweg. Zwei Wahrheiten für eine Zahl waren
 * der 78-Erstnachrichten-Fehler (17.08.), und der entsteht hier nicht wieder.
 */
export function flowQuellen(
  quellen: {
    followup?: ReadonlyArray<unknown>
    erstnachricht?: ReadonlyArray<unknown>
    loom?: ReadonlyArray<unknown>
    antwort?: ReadonlyArray<{ timestamp: string | null }>
  },
  jetzt: Date,
): Pick<FlowEingabe, 'faelligHeute' | 'erstnachrichtenOffen' | 'loomsOffen' | 'antworten'> {
  const antworten = quellen.antwort ?? []
  const zeiten = antworten
    .map((p) => (p.timestamp ? new Date(p.timestamp).getTime() : Number.NaN))
    .filter((t) => Number.isFinite(t))
  return {
    faelligHeute: (quellen.followup ?? []).length,
    erstnachrichtenOffen: (quellen.erstnachricht ?? []).length,
    loomsOffen: (quellen.loom ?? []).length,
    antworten: {
      warten: antworten.length,
      aeltesteStunden: zeiten.length ? (jetzt.getTime() - Math.min(...zeiten)) / 3_600_000 : null,
    },
  }
}

/**
 * Die Stufen, deren Soll beim ersten Öffnen des Tages eingefroren wird
 * (`sales_tagesportionen`, Migration 0074). Feste Ziele (Anfragen, InMails)
 * sind von sich aus stabil und brauchen kein Gedächtnis.
 */
export const PORTION_STUFEN: readonly StufenId[] = ['erstnachrichten', 'followups', 'looms']

/**
 * Was heute einzufrieren wäre — die Live-Rechnung von `sollFuer`, ohne schon
 * eingefrorene Portionen. Genau EINE Soll-Formel für beide Wege: was diese
 * Funktion heute festschreibt, hätte `sollFuer` ohne Tabelle live gerechnet.
 */
export function einzufrierendePortionen(eingabe: FlowEingabe): Partial<Record<StufenId, number>> {
  const live: FlowEingabe = { ...eingabe, portionen: undefined }
  const out: Partial<Record<StufenId, number>> = {}
  for (const stufe of TAGES_FLOW) {
    if (!PORTION_STUFEN.includes(stufe.id)) continue
    out[stufe.id] = sollFuer(stufe, live)
  }
  return out
}
