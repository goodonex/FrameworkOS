/**
 * Die Rechenschicht des Sales-Canvas (25.08.2026, Blaupause
 * `docs/wargames/sales-canvas.md`).
 *
 * Sie verheiratet zwei Ebenen, die es beide schon gibt, und erfindet keine
 * dritte:
 *
 * - **Bestand** — wie viele Leute stecken gerade in dieser Phase? Das
 *   beantwortet `leadStation()` je Lead, genau wie in `LeadPipeline`.
 * - **Tagespensum** — wie viele davon sind heute dran, und wie viele sind
 *   schon erledigt? Das beantwortet `stufenStaende()` aus `tagesFlow.ts`.
 *
 * **Es entsteht keine zweite Zähl-Wahrheit.** `soll` und `erledigtHeute` werden
 * hier NICHT gerechnet, sondern durchgereicht. Wer in dieser Datei anfängt,
 * `daily_metrics` nachzuzählen, baut den 78-Erstnachrichten-Fehler vom 17.08.
 * nach — zwei Rechenwege für dieselbe Zahl, die sich irgendwann trennen.
 *
 * **Jeder Lead liegt auf genau einer Karte.** Das ist die Invariante, an der
 * die ganze Ansicht hängt: `leadStation()` liefert genau eine Station, und die
 * entscheidet. Die drei Follow-up-Karten sind kein zweiter Zugriff auf
 * dieselben Leute, sondern eine Aufteilung *innerhalb* der Station
 * `wartet_auf_antwort`. Sonst stünde derselbe Mensch in zwei Karten, die Summe
 * wäre größer als der Bestand, und keine Zahl auf der Seite wäre noch etwas
 * wert. `scripts/verify-funnel-karten.ts` hält das fest.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-funnel-karten.ts`.
 */
import type { LeadEreignisTyp, LeadStatus, LinkedinThread } from '../../types/db'
import { AKQUISE_START } from './arbeitsmodusQuellen'
import { FOLLOWUP_VORLAGEN } from './followupVorlagen'
import { icpUrteil, istArbeitsVorrat } from './icp'
import { STATION_TITEL, leadStation, type Zweig } from './leadStation'
import type { StufenId, StufenStand } from './tagesFlow'

/**
 * Genau die Thread-Felder, die gebraucht werden: `leadStation` fragt sieben ab,
 * `followup_stage` bestimmt zusätzlich, welche der drei Follow-up-Karten es
 * wird. Bewusst schmal statt `LinkedinThread` — sonst müsste jede Prüf-Vorgabe
 * dreißig Felder erfinden, die nichts entscheiden.
 */
export type FunnelThread = Pick<
  LinkedinThread,
  'status' | 'last_from' | 'last_message_at' | 'followup_stage' | 'snoozed_until' | 'starred' | 'loom_status'
>

export interface FunnelLead {
  id: string
  name: string
  /** Die LinkedIn-Headline — das Einzige, woran der ICP-Filter urteilt. */
  headline: string
  lead_status: LeadStatus
  wiedervorlage_am: string | null
  ereignisse: { typ: LeadEreignisTyp; at: string }[]
  /** Der Thread, wenn es einen gibt. Ohne Thread läuft der stille Zweig. */
  thread: FunnelThread | null
}

export interface FunnelEingabe {
  leads: FunnelLead[]
  /**
   * Der Stand der Tages-Stufen aus `stufenStaende()`. Wird gelesen, nie
   * nachgerechnet — das ist die eine Zähl-Wahrheit.
   */
  staende: StufenStand[]
  jetzt: Date
}

/**
 * Die Karten-Kennungen. Drei Stellen weichen von den Stationen ab, und zwar
 * jede aus einem eigenen Grund:
 *
 * - `followup_0/1/2` teilen die Station `wartet_auf_antwort` auf, weil jede
 *   Stufe einen anderen festen Text hat (`FOLLOWUP_VORLAGEN`).
 * - `postkarte_*` und `anruf_*` teilen ihre Station nach Zweig, weil dieselbe
 *   Station aus beiden Ästen kommt und der Text sich unterscheidet: Wer nie
 *   angenommen hat, kennt Kevin gar nicht; wer die Analyse bekommen hat,
 *   kennt ihn schon. Eine Karte für beide wäre in der Hälfte der Fälle falsch.
 * - `ausserhalb` fängt alles ab, was der ICP-Filter aussortiert — als Karte,
 *   nicht als stiller Abzug, damit die Summe aufgeht und ein Filterfehler
 *   auffällt statt 71 Leute verschwinden zu lassen (die Lehre vom 19.08.).
 */
export type FunnelKartenId =
  | 'anfrage_offen'
  | 'erstnachricht_faellig'
  | 'antwort_da'
  | 'followup_0'
  | 'followup_1'
  | 'followup_2'
  | 'loom_offen'
  | 'wartet_auf_antwort'
  | 'instagram_faellig'
  | 'pdf_faellig'
  | 'postkarte_laut'
  | 'anruf_laut'
  | 'email_faellig'
  | 'postkarte_still'
  | 'anruf_still'
  | 'wiedervorlage'
  | 'ruht'
  | 'kunde'
  | 'disqualifiziert'
  | 'ausserhalb'

export interface FunnelKarte {
  id: FunnelKartenId
  titel: string
  /** Wie viele stecken hier insgesamt. */
  bestand: number
  /** Wie viele davon sind heute dran (`StationErgebnis.faellig`). */
  heuteFaellig: number
  /** Tages-Soll aus `stufenStaende` — `null`, wo die Karte keine Flow-Stufe hat. */
  soll: number | null
  /** Heute schon erledigt, aus derselben Quelle — `null` wie oben. */
  erledigtHeute: number | null
  /** Die Klammer zur EINEN Zähl-Wahrheit. */
  stufenId: StufenId | null
  /** Fertiger Textbaustein, `[Vorname]` steht noch drin. */
  vorlage: string | null
  zweig: Zweig | null
}

interface Bauplan {
  id: FunnelKartenId
  titel: string
  stufenId: StufenId | null
  vorlage: string | null
  zweig: Zweig | null
}

/**
 * Reihenfolge und Beschriftung aller Karten — eine Stelle, keine zweite.
 *
 * **Oben stehen die Karten mit Tagesbezug, und zwar in der Reihenfolge von
 * `TAGES_FLOW`.** Das ist Kevins Diktat vom 18.08. („Anfragen → Erstnachrichten
 * → Antworten → Follow-ups → InMails → Looms") und ausdrücklich nicht
 * verhandelbar; das Canvas ordnet es nicht um, nur weil ein Funnel-Bild anders
 * aussähe. Darunter kommt der Bestand ohne Tagesbezug: Leute, bei denen heute
 * nichts zu tun ist, in der Reihenfolge, in der die Kadenz sie durchläuft —
 * erst der laute Ast (haben angenommen), dann der stille (haben nie
 * angenommen), wie in `STATION_REIHENFOLGE`.
 *
 * Die InMail-Welle taucht bewusst NICHT als Karte auf, obwohl sie eine
 * Flow-Stufe ist: Sie ist ein Nebenstrom, keine Station (Kevins Korrektur vom
 * 20.08., nachzulesen im Kopf von `leadStation.ts`). Ein Lead im InMail-Pool
 * steckt gleichzeitig in `anfrage_offen` — eine eigene Karte für ihn würde ihn
 * doppelt zählen und die Invariante brechen.
 */
export const FUNNEL_BAUPLAN: readonly Bauplan[] = [
  // ── Mit Tagesbezug, in der Reihenfolge des Rituals ──────────────────────
  { id: 'anfrage_offen', titel: STATION_TITEL.anfrage_offen, stufenId: 'anfragen', vorlage: null, zweig: null },
  {
    id: 'erstnachricht_faellig',
    titel: STATION_TITEL.erstnachricht_faellig,
    stufenId: 'erstnachrichten',
    vorlage: null,
    zweig: null,
  },
  { id: 'antwort_da', titel: STATION_TITEL.antwort_da, stufenId: 'antworten', vorlage: null, zweig: null },
  // Kevin zählt in der Oberfläche ab 1 — `followup_stage` im Datensatz ab 0.
  { id: 'followup_0', titel: 'Follow-up 1', stufenId: 'followups', vorlage: FOLLOWUP_VORLAGEN[0], zweig: null },
  { id: 'followup_1', titel: 'Follow-up 2', stufenId: 'followups', vorlage: FOLLOWUP_VORLAGEN[1], zweig: null },
  { id: 'followup_2', titel: 'Follow-up 3', stufenId: 'followups', vorlage: FOLLOWUP_VORLAGEN[2], zweig: null },
  { id: 'loom_offen', titel: STATION_TITEL.loom_offen, stufenId: 'looms', vorlage: null, zweig: null },

  // ── Bestand ohne Tagesbezug: hier ist heute nichts zu tun ───────────────
  { id: 'wartet_auf_antwort', titel: STATION_TITEL.wartet_auf_antwort, stufenId: null, vorlage: null, zweig: null },
  { id: 'instagram_faellig', titel: STATION_TITEL.instagram_faellig, stufenId: null, vorlage: null, zweig: 'laut' },
  { id: 'pdf_faellig', titel: STATION_TITEL.pdf_faellig, stufenId: null, vorlage: null, zweig: 'laut' },
  { id: 'postkarte_laut', titel: 'Postkarte — kennt die Analyse', stufenId: null, vorlage: null, zweig: 'laut' },
  { id: 'anruf_laut', titel: 'Anruf — die Karte ist der Aufhänger', stufenId: null, vorlage: null, zweig: 'laut' },
  { id: 'email_faellig', titel: STATION_TITEL.email_faellig, stufenId: null, vorlage: null, zweig: 'still' },
  { id: 'postkarte_still', titel: 'Postkarte — kennt dich noch nicht', stufenId: null, vorlage: null, zweig: 'still' },
  { id: 'anruf_still', titel: 'Anruf — kennt dich noch nicht', stufenId: null, vorlage: null, zweig: 'still' },
  { id: 'wiedervorlage', titel: STATION_TITEL.wiedervorlage, stufenId: null, vorlage: null, zweig: null },
  { id: 'ruht', titel: STATION_TITEL.ruht, stufenId: null, vorlage: null, zweig: null },
  { id: 'kunde', titel: STATION_TITEL.kunde, stufenId: null, vorlage: null, zweig: null },
  { id: 'disqualifiziert', titel: STATION_TITEL.disqualifiziert, stufenId: null, vorlage: null, zweig: null },
  { id: 'ausserhalb', titel: 'Nicht in der Zielgruppe', stufenId: null, vorlage: null, zweig: null },
]

/**
 * Eingegangen, bevor Kevin auf Makler umgestellt hat — dieselbe Regel wie in
 * `LeadPipeline`, importiert statt nachgebaut. Nur Threads, in denen die ANDERE
 * Seite zuletzt geschrieben hat, zählen: bei einem Thread, den Kevin selbst
 * angefangen hat, gilt weiter „nichts, was liegen geblieben ist, fällt weg".
 */
function vorDerAkquise(thread: FunnelThread | null): boolean {
  if (!thread || thread.last_from !== 'them') return false
  return thread.last_message_at != null && thread.last_message_at < AKQUISE_START
}

/** Gehört dieser Lead in Kevins Arbeitsvorrat? `unklar` zählt bewusst als Ja. */
export function imArbeitsVorrat(lead: FunnelLead): boolean {
  return istArbeitsVorrat(icpUrteil(lead.headline, lead.name).urteil) && !vorDerAkquise(lead.thread)
}

/**
 * Auf welche Karte gehört dieser Lead? Genau eine Antwort, immer.
 *
 * Die Doppelzählungs-Falle sitzt hier: Station und Follow-up-Bucket beantworten
 * verschiedene Fragen, und wer beide nebeneinander abfragt, bekommt denselben
 * Lead zweimal. Deshalb entscheidet die Station zuerst, und der Bucket darf nur
 * noch *innerhalb* von `wartet_auf_antwort` verfeinern.
 */
export function kartenIdFuer(lead: FunnelLead, jetzt: Date): FunnelKartenId {
  return zuordnung(lead, jetzt).id
}

/**
 * Karte und Fälligkeit in einem Durchgang.
 *
 * Bewusst zusammen: Beides hängt an demselben `leadStation()`-Ergebnis, und
 * zwei getrennte Aufrufe wären nicht nur doppelte Arbeit über 1.700 Leads,
 * sondern zwei Wege, die sich beim nächsten Umbau trennen können.
 */
function zuordnung(lead: FunnelLead, jetzt: Date): { id: FunnelKartenId; faellig: boolean } {
  if (!imArbeitsVorrat(lead)) return { id: 'ausserhalb', faellig: false }

  const stand = leadStation(
    {
      lead_status: lead.lead_status,
      wiedervorlage_am: lead.wiedervorlage_am,
      ereignisse: lead.ereignisse,
      thread: lead.thread,
    },
    jetzt,
  )

  const id = ((): FunnelKartenId => {
    switch (stand.station) {
      case 'wartet_auf_antwort': {
        if (stand.bucket !== 'faellig') return 'wartet_auf_antwort'
        const stufe = lead.thread?.followup_stage
        // Eine Stufe jenseits der drei Vorlagen gibt es hier nicht (ab 3 greift
        // `bucketOf` mit `abschluss` und die laute Kette übernimmt). Falls doch
        // je eine kaputte Zahl in der Zeile steht, landet der Lead sichtbar
        // unter „Wartet auf Antwort" statt lautlos zu verschwinden.
        if (stufe === 0) return 'followup_0'
        if (stufe === 1) return 'followup_1'
        if (stufe === 2) return 'followup_2'
        return 'wartet_auf_antwort'
      }
      // Beide Stationen kommen aus beiden Ästen — der Zweig entscheidet den Text.
      case 'postkarte_faellig':
        return stand.zweig === 'still' ? 'postkarte_still' : 'postkarte_laut'
      case 'anruf_faellig':
        return stand.zweig === 'still' ? 'anruf_still' : 'anruf_laut'
      default:
        return stand.station
    }
  })()

  return { id, faellig: stand.faellig }
}

/**
 * Die Kartenliste — vollständig, auch die leeren. Was zusammengeklappt wird,
 * entscheidet die Oberfläche, nicht die Rechnung: eine Karte, die je nach
 * Datenlage im Ergebnis fehlt, würde beim Zählen und beim Prüfen jedes Mal
 * anders aussehen.
 */
export function funnelKarten(eingabe: FunnelEingabe): FunnelKarte[] {
  const bestand = new Map<FunnelKartenId, number>()
  const faellig = new Map<FunnelKartenId, number>()

  for (const lead of eingabe.leads) {
    const { id, faellig: heute } = zuordnung(lead, eingabe.jetzt)
    bestand.set(id, (bestand.get(id) ?? 0) + 1)
    if (heute) faellig.set(id, (faellig.get(id) ?? 0) + 1)
  }

  const standJeStufe = new Map<StufenId, StufenStand>()
  for (const s of eingabe.staende) standJeStufe.set(s.stufe.id, s)

  return FUNNEL_BAUPLAN.map((bau): FunnelKarte => {
    const stand = bau.stufenId ? standJeStufe.get(bau.stufenId) : undefined
    /**
     * Die Antworten-Stufe ist eine Frische-Frage, keine Zähl-Stufe: ihr `soll`
     * ist 0 und ihr `wert` sagt „wie viele warten", nicht „wie viele sind
     * erledigt". „heute 43 von 0" wäre die Zahl, die daraus entstünde.
     */
    const zaehlbar = stand?.stufe.art === 'zaehler' ? stand : null
    return {
      id: bau.id,
      titel: bau.titel,
      bestand: bestand.get(bau.id) ?? 0,
      heuteFaellig: faellig.get(bau.id) ?? 0,
      soll: zaehlbar ? zaehlbar.soll : null,
      erledigtHeute: zaehlbar ? zaehlbar.wert : null,
      stufenId: bau.stufenId,
      vorlage: bau.vorlage,
      zweig: bau.zweig,
    }
  })
}
