/**
 * Die Conversion des Pipeline-Boards (25.08.2026, Blaupause
 * `docs/wargames/pipeline-board.md`, Zug 2).
 *
 * Kevins Frage dahinter: *„sehen, wo optimiert werden muss."* Die Antwort steht
 * an den **Kanten** des Baums, nicht an den Knoten — nicht „hier stehen 368",
 * sondern „von hier kommen 22 % dort an".
 *
 * **Warum drei Dinge nötig sind statt einer Formel.** Die Datenlage ist je
 * Kante verschieden, und so zu tun, als wäre sie überall gleich, wäre die Lüge,
 * die dieses Board wertlos macht:
 *
 * 1. **Die erste Kante ist dauerhaft nicht kohortenfähig.** Gemessen am
 *    25.08.: `linkedin_netzwerk` hat 1.092 Zeilen mit `eingeladen_at` und 685
 *    mit `angenommen_at` — die Mengen überschneiden sich fast nicht. Wer
 *    annimmt, verliert sein Einladungsdatum, weil LinkedIn die Einladung aus
 *    der Gesendet-Liste nimmt. Im ganzen Bestand fanden sich **24** auswertbare
 *    Paare. Diese Information entsteht nie — kein Sammeln der Welt füllt das.
 * 2. **Die Follow-up-Kanten haben erst seit heute Daten.** Bis zum 25.08. hat
 *    das Abhaken kein Lead-Ereignis geschrieben (Zug 1 hat das repariert).
 *    `sammelt_noch` sagt das, statt 0 % zu zeigen.
 * 3. **Der stille Zweig wird nie Daten haben,** solange keine Adressen
 *    beschafft sind (`Lead.email` ist ausdrücklich leer, siehe `types/db.ts`).
 *
 * **Keine erfundene Zahl.** Wo die Datenlage keine Rate hergibt, ist `rate`
 * null und `grund` sagt warum. Eine 0 % an einer ungemessenen Kante sähe aus
 * wie ein kaputter Funnel und schickte Kevin zur Optimierung ans falsche Ende —
 * genau das, was dieses Board verhindern soll.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-funnel-raten.ts`.
 */
import type { LeadEreignisTyp } from '../../types/db'
import type { FunnelKartenId } from './funnelKarten'

const TAG_MS = 24 * 60 * 60 * 1000

/**
 * Wie lange die Kohorte zurückreicht. Kevins Wahl vom 25.08.: „letzte 30 Tage,
 * rollierend". Das ist die GRÖSSE des Fensters, nicht seine Lage — die Reifezeit
 * schiebt es zusätzlich nach hinten (siehe `reifeTage`).
 */
export const FENSTER_TAGE = 30

/**
 * Unter dieser Grundgesamtheit gibt es keine Rate.
 *
 * Bei 3 von 4 stünde sonst „75 %" am Knoten, und die nächste Absage macht
 * daraus 60 %. Eine Zahl, die bei einem einzelnen Lead um 15 Punkte springt,
 * ist keine Kennzahl, sondern Rauschen mit Prozentzeichen.
 */
export const MINDEST_GRUNDGESAMTHEIT = 20

/**
 * Zwei Sorten, und die Sorte gehört mit aufs Bild.
 *
 * Die Blaupause nannte drei (`zeitreihe`/`bestand`/`kohorte`). `bestand` wird
 * nicht gebraucht: Für jede Kante, an der eine Bestandsquote in Frage käme,
 * fehlen die Ereignisse ohnehin komplett (stiller Zweig) — eine Sorte, die nie
 * zugewiesen wird, wäre tote Struktur. Abweichung bewusst und hier notiert.
 */
export type RatenArt =
  /**
   * Was ging raus, was kam an — je 30 Tage, aus zwei getrennten Quellen.
   * **Nicht kohortengenau:** Die Annahmen von heute gehören zu Anfragen von
   * vorletzter Woche. Solange Kevins Volumen halbwegs gleichmässig läuft, misst
   * das trotzdem, was er wissen will. Kann über 100 % liegen (an einem Tag
   * treffen mehr Annahmen ein, als Anfragen rausgingen) — das ist kein Fehler.
   */
  | 'zeitreihe'
  /** Dieselben Leads, vorher und nachher. Die beste Sorte, wo sie geht. */
  | 'kohorte'

export type RatenGrund =
  /** Es gibt Zeilen, aber im Fenster zu wenige. */
  | 'zu_wenig_daten'
  /** Für diesen Übergang wird nie etwas erfasst (keine Kanaldaten). */
  | 'nicht_erfasst'
  /** Wird seit Zug 1 erfasst, hat aber noch keine Historie. */
  | 'sammelt_noch'
  /**
   * Beide Ereignis-Typen haben reichlich Zeilen, aber sie stehen fast nie am
   * SELBEN Lead in der richtigen Reihenfolge — die Quellen lassen sich nicht
   * paaren.
   *
   * **Am 25.08. an echten Daten entdeckt, nachdem alle 42 Prüfungen gegen
   * Fixtures grün waren.** `erstnachricht` hat 267 Zeilen, `antwort_erhalten`
   * 67 — aber nur **9** Leads tragen beides in der Reihenfolge
   * Erstnachricht→Antwort. Der Grund steht in `scripts/leads-sync.ts`: Für
   * einen Thread ohne gespiegelten Verlauf wird ENTWEDER `erstnachricht` ODER
   * `antwort_erhalten` abgeleitet, je nachdem wer zuletzt schrieb — nie beides.
   * Wer geantwortet hat, verliert damit seine Erstnachricht.
   *
   * Ohne diese Prüfung stand an der Kante „0,0 %" — die Behauptung, niemand
   * antworte, während in denselben 30 Tagen 21 Antworten eingingen. Das ist
   * die teuerste falsche Zahl, die dieses Board zeigen kann.
   *
   * Behebbar, aber nicht durch Warten: Der Chrome-Sync muss die Verläufe
   * spiegeln, dann entstehen beide Ereignisse je Thread.
   */
  | 'paarung_fehlt'

export interface KantenRate {
  von: FunnelKartenId
  nach: FunnelKartenId
  art: RatenArt
  grundgesamtheit: number
  angekommen: number
  /** `null` heisst NICHT 0 % — es heisst „dafür fehlen die Daten". */
  rate: number | null
  /** Warum es keine Rate gibt. `null`, wenn eine da ist. */
  grund: RatenGrund | null
  /**
   * Ab wann eine Rate zu niedrig ist. **Überall `null`,** weil es für diese
   * Übergänge keine belegte Zahl gibt: `channelRates` in `metricsAggregate.ts`
   * trägt zwar Benchmarks (LinkedIn 15–25 %), misst aber eine ANDERE Kante
   * (Anfrage → Antwort, nicht Anfrage → Annahme). Einen Richtwert zu erfinden
   * wäre schlimmer als keiner: Die Kantenfarbe würde eine Bewertung behaupten,
   * die auf nichts beruht. Sobald Kevin eigene Zielwerte nennt, ist das eine
   * Einzeiler-Änderung im Bauplan unten.
   */
  benchMin: number | null
  benchMax: number | null
}

interface KantenBauplan {
  von: FunnelKartenId
  nach: FunnelKartenId
  art: RatenArt
  /** Das Ereignis, mit dem ein Lead die Kohorte betritt. */
  vonEreignis?: LeadEreignisTyp
  /** Das Ereignis, das „angekommen" bedeutet. */
  nachEreignis?: LeadEreignisTyp
  /**
   * Wie lange ein Lead Zeit gehabt haben muss, bevor er in den Nenner darf.
   *
   * Ohne diesen Abzug sinkt jede Rate, sobald Kevin mehr anfragt — sie misst
   * dann sein Volumen statt seiner Qualität. Gemessen am Bestand (`anfrage` →
   * `angenommen`): Median 8,5 Tage, 80. Perzentil 27. 14 Tage liegt dazwischen
   * und deckt sich mit der dritten Follow-up-Schwelle.
   */
  reifeTage?: number
  /** Gesetzt, wo es dauerhaft keine Daten geben wird. */
  festerGrund?: 'nicht_erfasst'
}

/**
 * Die Kanten des Baums — Struktur UND Rate aus einer Quelle.
 *
 * Bewusst zusammen: Zug 3 zeichnet daraus den Baum, und eine zweite Konstante
 * nur fürs Zeichnen würde beim nächsten Umbau von dieser hier abweichen.
 *
 * **Was hier fehlt und warum:** „Loom zugesagt → Loom gesendet" steht in der
 * Blaupause-Tabelle, hat aber keine Kante im Baum — ein gesendetes Loom führt
 * zu keinem anderen Knoten, der Lead verlässt an dieser Stelle den Funnel.
 * Eine Kante von `loom_offen` auf sich selbst wäre ein Kunstgriff; die Zahl
 * gehört an den Knoten und kommt, wenn Kevin sie dort haben will.
 */
export const FUNNEL_KANTEN: readonly KantenBauplan[] = [
  // ── Die Gabelung: angenommen oder nicht ────────────────────────────────
  {
    von: 'anfrage_offen',
    nach: 'erstnachricht_faellig',
    art: 'zeitreihe',
    // Kein `vonEreignis`/`nachEreignis`: Diese Kante rechnet NICHT aus
    // `lead_ereignisse`, sondern aus `daily_metrics` + `angenommen_at`.
    // Siehe Kopf, Punkt 1 — die Kohorte ist hier dauerhaft unmöglich.
  },
  { von: 'anfrage_offen', nach: 'email_faellig', art: 'kohorte', festerGrund: 'nicht_erfasst' },

  // ── Der laute Ast: angenommen, dann die LinkedIn-Kette ─────────────────
  {
    von: 'erstnachricht_faellig',
    nach: 'wartet_auf_antwort',
    art: 'kohorte',
    vonEreignis: 'angenommen',
    nachEreignis: 'erstnachricht',
    reifeTage: 14,
  },
  {
    von: 'wartet_auf_antwort',
    nach: 'antwort_da',
    art: 'kohorte',
    vonEreignis: 'erstnachricht',
    nachEreignis: 'antwort_erhalten',
    reifeTage: 14,
  },
  {
    von: 'antwort_da',
    nach: 'loom_offen',
    art: 'kohorte',
    vonEreignis: 'antwort_erhalten',
    nachEreignis: 'loom_zugesagt',
    // Kürzer als 14: Wer antwortet, sagt im selben Gespräch zu oder gar nicht.
    reifeTage: 7,
  },

  // ── Die Follow-up-Kette: erfasst seit Zug 1, Historie im Aufbau ────────
  {
    von: 'wartet_auf_antwort',
    nach: 'followup_0',
    art: 'kohorte',
    vonEreignis: 'erstnachricht',
    nachEreignis: 'followup',
    reifeTage: 14,
  },
  {
    von: 'followup_0',
    nach: 'followup_1',
    art: 'kohorte',
    vonEreignis: 'followup',
    nachEreignis: 'followup',
    reifeTage: 7,
  },
  {
    von: 'followup_1',
    nach: 'followup_2',
    art: 'kohorte',
    vonEreignis: 'followup',
    nachEreignis: 'followup',
    reifeTage: 14,
  },
  {
    von: 'followup_2',
    nach: 'instagram_faellig',
    art: 'kohorte',
    vonEreignis: 'followup',
    nachEreignis: 'instagram',
    reifeTage: 7,
  },

  // ── Ab hier: Kanäle, für die noch nichts erfasst wird ──────────────────
  { von: 'instagram_faellig', nach: 'pdf_faellig', art: 'kohorte', festerGrund: 'nicht_erfasst' },
  { von: 'pdf_faellig', nach: 'postkarte_laut', art: 'kohorte', festerGrund: 'nicht_erfasst' },
  { von: 'postkarte_laut', nach: 'anruf_laut', art: 'kohorte', festerGrund: 'nicht_erfasst' },
  { von: 'email_faellig', nach: 'postkarte_still', art: 'kohorte', festerGrund: 'nicht_erfasst' },
  { von: 'postkarte_still', nach: 'anruf_still', art: 'kohorte', festerGrund: 'nicht_erfasst' },
]

export interface RatenEreignis {
  lead_id: string
  typ: LeadEreignisTyp
  at: string
}

export interface RatenEingabe {
  /** Alle Lead-Ereignisse — aus `useLeads().ereignisse`. */
  ereignisse: readonly RatenEreignis[]
  /** Tageszeilen für die Zeitreihe — aus `useDailyMetrics().windowRows`. */
  tageszeilen: readonly { datum: string; li_anfragen: number }[]
  /** Netzwerk-Einträge für die Annahmen — aus `useLinkedinNetzwerk().items`. */
  netzwerk: readonly { angenommen_at: string | null }[]
  jetzt: Date
}

function zeit(iso: string | null | undefined): number {
  const t = new Date(String(iso ?? '')).getTime()
  return Number.isNaN(t) ? Number.NaN : t
}

/**
 * Die Zeitreihe: was ging raus, was kam an.
 *
 * Beide Seiten über dasselbe 30-Tage-Fenster, aber aus getrennten Quellen —
 * `daily_metrics.li_anfragen` für den Nenner (Kevin zählt seine Anfragen dort
 * selbst), `angenommen_at` für den Zähler.
 */
function zeitreihe(bau: KantenBauplan, eingabe: RatenEingabe): KantenRate {
  const jetzt = eingabe.jetzt.getTime()
  const start = jetzt - FENSTER_TAGE * TAG_MS
  const startDatum = new Date(start).toISOString().slice(0, 10)

  let grundgesamtheit = 0
  for (const zeile of eingabe.tageszeilen) {
    if (zeile.datum < startDatum) continue
    const n = Number(zeile.li_anfragen)
    if (Number.isFinite(n)) grundgesamtheit += Math.max(0, n)
  }

  let angekommen = 0
  for (const eintrag of eingabe.netzwerk) {
    const t = zeit(eintrag.angenommen_at)
    if (Number.isNaN(t)) continue
    if (t >= start && t <= jetzt) angekommen++
  }

  const basis = { von: bau.von, nach: bau.nach, art: bau.art, grundgesamtheit, angekommen, benchMin: null, benchMax: null }
  if (grundgesamtheit < MINDEST_GRUNDGESAMTHEIT) {
    return { ...basis, rate: null, grund: 'zu_wenig_daten' }
  }
  // Bewusst NICHT gedeckelt: Über 100 % ist bei dieser Sorte eine echte
  // Aussage („mehr Annahmen als Anfragen — der Rückstau löst sich auf"), kein
  // Rechenfehler. Die Anzeige entscheidet, wie sie das schreibt.
  return { ...basis, rate: angekommen / grundgesamtheit, grund: null }
}

/**
 * Die Kohorte: dieselben Leads, vorher und nachher.
 *
 * Das Fenster ist um `reifeTage` nach hinten verschoben — wer gestern
 * angenommen hat, kann heute noch keine Erstnachricht haben und würde die Rate
 * sonst grundlos drücken. Die 30 Tage sind die GRÖSSE der Kohorte, nicht ihre
 * Lage: `[jetzt − reife − 30d, jetzt − reife)`.
 */
function kohorte(bau: KantenBauplan, eingabe: RatenEingabe): KantenRate {
  const reife = (bau.reifeTage ?? 0) * TAG_MS
  const ende = eingabe.jetzt.getTime() - reife
  const start = ende - FENSTER_TAGE * TAG_MS

  /** Der früheste Zeitpunkt je Lead, an dem er die Kohorte betreten hat. */
  const eintritt = new Map<string, number>()
  /** Alle Zeitpunkte des Ziel-Ereignisses je Lead. */
  const ziel = new Map<string, number[]>()
  /** Der früheste Start-Zeitpunkt je Lead, ÜBER ALLE ZEITEN — für die Paarungsprobe. */
  const startAlle = new Map<string, number>()

  let vonGesamt = 0
  let nachGesamt = 0

  for (const e of eingabe.ereignisse) {
    const t = zeit(e.at)
    if (Number.isNaN(t)) continue
    if (e.typ === bau.vonEreignis) {
      vonGesamt++
      const bisherAlle = startAlle.get(e.lead_id)
      if (bisherAlle === undefined || t < bisherAlle) startAlle.set(e.lead_id, t)
      if (t >= start && t < ende) {
        const bisher = eintritt.get(e.lead_id)
        if (bisher === undefined || t < bisher) eintritt.set(e.lead_id, t)
      }
    }
    if (e.typ === bau.nachEreignis) {
      nachGesamt++
      const liste = ziel.get(e.lead_id)
      if (liste) liste.push(t)
      else ziel.set(e.lead_id, [t])
    }
  }

  /**
   * Wie oft kommt dieser Übergang im GANZEN Bestand vor — ohne Fenster, ohne
   * Reifezeit? Das ist die Probe darauf, ob die beiden Quellen sich überhaupt
   * paaren lassen. Siehe `paarung_fehlt`.
   */
  let paarungGesamt = 0
  for (const [leadId, startZeit] of startAlle) {
    const zeiten = ziel.get(leadId)
    if (zeiten && zeiten.some((t) => t > startZeit)) paarungGesamt++
  }

  let angekommen = 0
  for (const [leadId, eintrittsZeit] of eintritt) {
    const zeiten = ziel.get(leadId)
    if (!zeiten) continue
    /**
     * Das Ziel muss NACH dem Eintritt liegen — sonst zählte eine alte
     * Erstnachricht von Mai als „Antwort auf die Annahme von Juli".
     *
     * `>` statt `>=`, weil `followup → followup` (Stufe 1 → 2) beide Seiten
     * aus demselben Ereignis-Typ zieht: Ohne echtes Später wäre jeder Lead
     * sein eigener Nachfolger und die Rate stünde konstant auf 100 %.
     */
    if (zeiten.some((t) => t > eintrittsZeit)) angekommen++
  }

  const grundgesamtheit = eintritt.size
  const basis = { von: bau.von, nach: bau.nach, art: bau.art, grundgesamtheit, angekommen, benchMin: null, benchMax: null }

  /**
   * Die Reihenfolge ist die Aussage. Jeder Grund sagt Kevin etwas anderes
   * darüber, was zu tun ist — und keiner von ihnen ist „0 %".
   */
  // 1. Wird nie erfasst (keine Kanaldaten beschafft).
  if (bau.festerGrund) return { ...basis, rate: null, grund: bau.festerGrund }
  // 2. Zu wenig Historie überhaupt: Wir haben gerade erst angefangen zu messen
  //    (Zug 1, 25.08.). Nicht „0 %", sondern „die Uhr läuft".
  if (vonGesamt < MINDEST_GRUNDGESAMTHEIT || nachGesamt < MINDEST_GRUNDGESAMTHEIT) {
    return { ...basis, rate: null, grund: 'sammelt_noch' }
  }
  // 3. Beide Seiten haben Zeilen, aber sie treffen sich nicht am selben Lead.
  //    Warten hilft hier NICHT — der Verlauf muss gespiegelt werden.
  if (paarungGesamt < MINDEST_GRUNDGESAMTHEIT) return { ...basis, rate: null, grund: 'paarung_fehlt' }
  // 4. Datenlage trägt, aber dieses Fenster ist zu dünn.
  if (grundgesamtheit < MINDEST_GRUNDGESAMTHEIT) return { ...basis, rate: null, grund: 'zu_wenig_daten' }
  return { ...basis, rate: angekommen / grundgesamtheit, grund: null }
}

/** Alle Kanten des Baums mit ihrer Rate — oder mit dem Grund, warum keine da ist. */
export function funnelRaten(eingabe: RatenEingabe): KantenRate[] {
  return FUNNEL_KANTEN.map((bau) => {
    if (bau.festerGrund) {
      return {
        von: bau.von,
        nach: bau.nach,
        art: bau.art,
        grundgesamtheit: 0,
        angekommen: 0,
        rate: null,
        grund: bau.festerGrund,
        benchMin: null,
        benchMax: null,
      }
    }
    return bau.art === 'zeitreihe' ? zeitreihe(bau, eingabe) : kohorte(bau, eingabe)
  })
}

/** Nachschlag für die Oberfläche: die Rate einer bestimmten Kante. */
export function rateFuer(raten: readonly KantenRate[], von: FunnelKartenId, nach: FunnelKartenId): KantenRate | null {
  return raten.find((r) => r.von === von && r.nach === nach) ?? null
}
