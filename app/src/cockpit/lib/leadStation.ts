/**
 * Wo steht dieser Lead, und was ist der nächste Zug? — der Workflow-Rechner
 * des Lead-Systems (20.08.2026, Blaupause docs/wargames/lead-system.md).
 *
 * **Es entsteht keine zweite Fälligkeits-Logik.** Solange ein Lead im Postfach
 * unterwegs ist, entscheidet weiterhin `linkedinFollowups.bucketOf`, wann er
 * dran ist — diese Datei fragt dort nach, statt es nachzubauen. Neu ist nur,
 * was *vor* dem ersten Kontakt und *neben* dem Postfach passiert: der stille
 * Zweig für Leute, die die Anfrage nie angenommen haben.
 *
 * **Kevins Korrektur vom 20.08., die den Zuschnitt bestimmt.** Die erste
 * Fassung machte InMail zu einer Station in der Kette. Das war falsch: Kevin
 * fragt dauerhaft mehr Leute an, als er InMail-Credits hat (~30 Anfragen auf
 * ~3 Annahmen, 150 Credits insgesamt). Eine Kette, in der jeder Nicht-Annehmer
 * auf eine InMail wartet, staut sich sofort und zeigt einen Berg, den niemand
 * abtragen kann. Seine Worte: *„Diese InMails mach ich halt einfach konstant
 * nebenbei."* Also ist InMail ein **Nebenstrom** — ein Ereignis, das jederzeit
 * eintreten darf, das aber nichts abhakt und nichts aufhält.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-lead-station.ts`.
 */
import type { LeadEreignisTyp, LeadStatus, LinkedinThread } from '../../types/db'
import { bucketOf, type FollowupBucket } from './linkedinFollowups'

const TAG_MS = 24 * 60 * 60 * 1000

/* ── Die Kadenz. Alle Wartezeiten stehen hier und nirgends sonst. ─────────── */

/** Ab wann jemand, der die Anfrage nie angenommen hat, eine E-Mail bekommt. */
export const STILL_EMAIL_TAGE = 30
/** Abstand E-Mail → handgeschriebene Postkarte. */
export const STILL_POSTKARTE_TAGE = 7
/** Abstand Postkarte → Anruf. */
export const STILL_ANRUF_TAGE = 7
/* Die laute Kette (0078, Kevins Diktat vom 25.08.2026).
 *
 * Sie beginnt dort, wo die LinkedIn-Follow-ups aufhoeren: nach der dritten
 * Stufe (3/7/14 Tage, `linkedinFollowups.FOLLOWUP_THRESHOLDS_DAYS`) steht der
 * Thread im Bucket `abschluss` — bis hierher passierte danach nichts mehr.
 * Das war der teuerste tote Punkt im Ablauf: Diese Leute haben die Anfrage
 * ANGENOMMEN. Der Zugang ist bezahlt, nur die Antwort fehlt.
 *
 * Warum Instagram vor der PDF steht: Ein vierter Anlauf im selben Postfach
 * liest sich als Kampagne. Derselbe Mensch an einem anderen Ort liest sich als
 * Zufall. Der Kanalwechsel ist die staerkere Karte und darf deshalb nicht als
 * Letztes kommen — und ausdruecklich nicht GLEICHZEITIG mit LinkedIn laufen,
 * was beduerftig wirkt (Kevins Entscheidung, 25.08.).
 *
 * Warum die Postkarte vor dem Anruf steht: Sie macht den Anruf warm. „Ich hab
 * Ihnen letzte Woche eine Karte geschrieben" ist ein Aufhaenger; ohne sie
 * waere es ein Kaltanruf. */

/** Abstand letztes LinkedIn-Follow-up -> Instagram-DM. */
export const LAUT_INSTAGRAM_TAGE = 7
/** Abstand Instagram -> Follow-up-Analyse als PDF, ungefragt. */
export const LAUT_PDF_TAGE = 14
/** Abstand PDF -> handgeschriebene Postkarte. */
export const LAUT_POSTKARTE_TAGE = 21
/** Abstand Postkarte -> Anruf. */
export const LAUT_ANRUF_TAGE = 7

/**
 * Wie lange ein durchlaufener Lead ruht, bevor er von selbst wiederkommt.
 *
 * Am 25.08.2026 von 6 auf 4 Monate gesenkt. Sechs Monate waren die vorsichtige
 * Zahl, als die Kette nach dem dritten Follow-up endete; jetzt hat ein Lead
 * bis zur Ruhe sieben Beruehrungen ueber vier Kanaele hinter sich und ist
 * eindeutig durch. Vier Monate heisst drei Zyklen im Jahr statt zwei, ohne
 * dass jemand zweimal dasselbe hoert — der zweite Durchlauf braucht ohnehin
 * einen neuen Aufhaenger.
 */
export const RUHE_MONATE = 4
/**
 * Mindestabstand zwischen zwei ausgehenden Kontakten, über alle Kanäle hinweg.
 *
 * Selbst entschieden (20.08.), weil der Nebenstrom sonst mit der Kette
 * kollidiert: Ging gestern eine InMail raus und ist heute die E-Mail fällig,
 * bekäme dieselbe Person zwei Anläufe in zwei Tagen. Verworfene Alternative:
 * eine InMail setzt die 30-Tage-Uhr zurück — das hätte den Pool leerlaufend
 * wirken lassen, obwohl niemand ausscheidet.
 */
export const MIN_ABSTAND_TAGE = 7

/** Die Kanäle, die als „ausgehender Kontakt" für den Mindestabstand zählen. */
const AUSGEHEND: LeadEreignisTyp[] = [
  'erstnachricht',
  'followup',
  'instagram',
  'pdf',
  'inmail',
  'email',
  'postkarte',
  'anruf',
]

export type Station =
  | 'anfrage_offen'      // eingeladen, noch keine 30 Tage, noch nicht angenommen
  | 'erstnachricht_faellig' // angenommen, noch nie geschrieben
  | 'wartet_auf_antwort' // geschrieben, Follow-ups laufen über bucketOf
  | 'antwort_da'         // die Person hat geantwortet, Kevin ist am Zug
  | 'loom_offen'         // Loom zugesagt, noch nicht geschickt
  | 'instagram_faellig'  // lauter Zweig, Stufe 1 — Follow-ups durch, Kanalwechsel
  | 'pdf_faellig'        // lauter Zweig, Stufe 2 — Analyse ungefragt
  | 'email_faellig'      // stiller Zweig, Stufe 1
  | 'postkarte_faellig'  // Stufe 3 laut / Stufe 2 still — siehe `zweig`
  | 'anruf_faellig'      // Stufe 4 laut / Stufe 3 still — siehe `zweig`
  | 'wiedervorlage'      // Kevin hat ein Datum gesetzt
  | 'ruht'               // Kadenz durch, kommt nach RUHE_MONATE wieder
  | 'disqualifiziert'
  | 'kunde'

export interface LeadStationEingabe {
  lead_status: LeadStatus
  wiedervorlage_am: string | null
  /** Nur die Typen und Zeitpunkte — Texte spielen für die Station keine Rolle. */
  ereignisse: { typ: LeadEreignisTyp; at: string }[]
  /** Der Thread, wenn es einen gibt. Ohne Thread läuft der stille Zweig. */
  thread?: Pick<
    LinkedinThread,
    'status' | 'last_from' | 'last_message_at' | 'followup_stage' | 'snoozed_until' | 'starred' | 'loom_status'
  > | null
}

/**
 * Welcher Ast zu dieser Station gefuehrt hat.
 *
 * Postkarte und Anruf kommen aus BEIDEN Aesten, und der Unterschied bestimmt
 * den Text: Wer nie angenommen hat (`still`), kennt Kevin ueberhaupt nicht.
 * Wer angenommen, aber nie geantwortet hat (`laut`), hat Erstnachricht,
 * Follow-ups, eine Instagram-Nachricht und eine fertige Analyse von ihm
 * gesehen. Dieselbe Postkarte an beide zu schreiben, waere in einem der zwei
 * Faelle falsch.
 */
export type Zweig = 'still' | 'laut'

export interface StationErgebnis {
  station: Station
  /** Was Kevin als Nächstes tun soll — ein Halbsatz für die Oberfläche. */
  naechsterSchritt: string
  /** Wann das fällig ist. null = jetzt, oder es gibt nichts zu tun. */
  faelligAm: string | null
  /** Ist es jetzt so weit? */
  faellig: boolean
  /** Der Bucket aus `linkedinFollowups`, wenn ein Thread im Spiel ist. */
  bucket: FollowupBucket | null
  /**
   * Der Lead ist im InMail-Pool: nie angenommen, noch keine InMail bekommen.
   * Unabhängig von der Station — Kevin arbeitet den Pool nach Credits ab.
   */
  imInmailPool: boolean
  /** Aus welchem Ast die Station kommt; null bei Stationen, die es nur einmal gibt. */
  zweig: Zweig | null
}

function letztes(ereignisse: { typ: LeadEreignisTyp; at: string }[], typen: LeadEreignisTyp[]): number | null {
  let neuestes: number | null = null
  for (const e of ereignisse) {
    if (!typen.includes(e.typ)) continue
    const zeit = new Date(e.at).getTime()
    if (Number.isNaN(zeit)) continue
    if (neuestes == null || zeit > neuestes) neuestes = zeit
  }
  return neuestes
}

function hat(ereignisse: { typ: LeadEreignisTyp; at: string }[], typ: LeadEreignisTyp): boolean {
  return ereignisse.some((e) => e.typ === typ)
}

/**
 * Den Mindestabstand anwenden: Ein an sich fälliger Zug wartet, wenn erst
 * kürzlich ein anderer Kanal bedient wurde.
 */
function mitAbstand(
  faelligAb: number,
  ereignisse: { typ: LeadEreignisTyp; at: string }[],
): number {
  const letzterKontakt = letztes(ereignisse, AUSGEHEND)
  if (letzterKontakt == null) return faelligAb
  return Math.max(faelligAb, letzterKontakt + MIN_ABSTAND_TAGE * TAG_MS)
}

/** Der Teil des Ergebnisses, den ein Kettenschritt bestimmt. */
type KettenTeil = Pick<StationErgebnis, 'station' | 'naechsterSchritt' | 'faelligAm' | 'faellig' | 'zweig'>

/**
 * Der laute Zweig: angenommen, geschrieben, dreimal nachgefasst — und nie eine
 * Antwort. Ab hier wechselt der Kanal statt der Nachricht.
 *
 * Die Reihenfolge wird RUECKWAERTS gelesen (was zuletzt raus ist, bestimmt den
 * naechsten Schritt), damit ein uebersprungener Schritt die Kette nicht
 * anhaelt: Hat Kevin die Postkarte geschrieben, ohne dass je eine PDF rausging,
 * steht als Naechstes trotzdem der Anruf — nicht die nachgeholte PDF. Die
 * Kadenz ist ein Vorschlag mit Gedaechtnis, kein Formular, das ausgefuellt
 * werden muss.
 */
function lauteKette(
  ereignisse: { typ: LeadEreignisTyp; at: string }[],
  letzteNachricht: string | null,
  now: number,
): KettenTeil {
  /** Ein faelliger Schritt, um den Mindestabstand ergaenzt. */
  const stufe = (ziel: number, station: Station, schritt: string): KettenTeil => {
    const mitPuffer = mitAbstand(ziel, ereignisse)
    // Nur wenn der Abstand tatsaechlich bremst, wird das auch so genannt.
    // Sonst stuende „wartet auf den Mindestabstand" an einem Schritt, dessen
    // eigene Wartezeit schlicht noch laeuft — zwei verschiedene Gruende.
    const gehemmt = mitPuffer > ziel && now >= ziel
    return {
      station,
      naechsterSchritt: gehemmt && now < mitPuffer ? `${schritt} — wartet auf den Mindestabstand` : schritt,
      faelligAm: new Date(mitPuffer).toISOString(),
      faellig: now >= mitPuffer,
      zweig: 'laut',
    }
  }

  const anrufAm = letztes(ereignisse, ['anruf'])
  if (anrufAm != null) {
    const ziel = anrufAm + RUHE_MONATE * 30 * TAG_MS
    return {
      station: 'ruht',
      naechsterSchritt: now >= ziel ? 'Ruhe vorbei — mit neuem Aufhänger ansprechen' : 'Kette durch, ruht',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
      zweig: 'laut',
    }
  }

  const postkarteAm = letztes(ereignisse, ['postkarte'])
  if (postkarteAm != null) {
    return stufe(postkarteAm + LAUT_ANRUF_TAGE * TAG_MS, 'anruf_faellig', 'Anrufen — die Karte ist der Aufhänger')
  }

  const pdfAm = letztes(ereignisse, ['pdf'])
  if (pdfAm != null) {
    return stufe(pdfAm + LAUT_POSTKARTE_TAGE * TAG_MS, 'postkarte_faellig', 'Postkarte schreiben — er kennt die Analyse')
  }

  const instagramAm = letztes(ereignisse, ['instagram'])
  if (instagramAm != null) {
    return stufe(instagramAm + LAUT_PDF_TAGE * TAG_MS, 'pdf_faellig', 'Analyse-PDF ungefragt schicken')
  }

  /* Der Anker der Kette ist die letzte Nachricht im Postfach — sie ist der
   * genauere Zeitpunkt, weil `bucketOf` mit derselben Zahl rechnet. Fehlt sie
   * (Threads ohne brauchbaren Zeitstempel), traegt der letzte ausgehende
   * Kontakt aus dem Protokoll. Fehlt auch der, ist der Schritt sofort faellig:
   * die Follow-ups sind nachweislich durch, und ein Lead ohne Datum soll
   * sichtbar sein statt still zu warten. */
  const ausPostfach = letzteNachricht != null ? new Date(letzteNachricht).getTime() : NaN
  const anker = Number.isNaN(ausPostfach) ? letztes(ereignisse, AUSGEHEND) : ausPostfach
  if (anker == null) {
    return {
      station: 'instagram_faellig',
      naechsterSchritt: 'Auf Instagram anschreiben',
      faelligAm: null,
      faellig: true,
      zweig: 'laut',
    }
  }
  return stufe(anker + LAUT_INSTAGRAM_TAGE * TAG_MS, 'instagram_faellig', 'Auf Instagram anschreiben')
}

export function leadStation(eingabe: LeadStationEingabe, jetzt: Date): StationErgebnis {
  const now = jetzt.getTime()
  const { ereignisse, thread } = eingabe

  const nieAngenommen = !hat(ereignisse, 'angenommen')
  const imInmailPool = nieAngenommen && !hat(ereignisse, 'inmail') && !thread

  const basis = { bucket: null as FollowupBucket | null, imInmailPool, zweig: null as Zweig | null }

  /* Endstationen und Übersteuerungen zuerst — sie stechen jede Rechnung. */

  if (eingabe.lead_status === 'kunde') {
    return { ...basis, station: 'kunde', naechsterSchritt: 'Kunde — läuft über die Projekte', faelligAm: null, faellig: false }
  }
  if (eingabe.lead_status === 'disqualifiziert') {
    return {
      ...basis,
      station: 'disqualifiziert',
      naechsterSchritt: 'Aussortiert',
      faelligAm: null,
      faellig: false,
      imInmailPool: false,
    }
  }
  if (eingabe.lead_status === 'wiedervorlage' && eingabe.wiedervorlage_am) {
    const ziel = new Date(`${eingabe.wiedervorlage_am}T09:00:00.000Z`).getTime()
    return {
      ...basis,
      station: 'wiedervorlage',
      naechsterSchritt: now >= ziel ? 'Wiedervorlage ist dran' : 'Wiedervorlage gesetzt',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
    }
  }
  if (eingabe.lead_status === 'ruht') {
    const seit = letztes(ereignisse, AUSGEHEND) ?? letztes(ereignisse, ['anfrage'])
    const ziel = (seit ?? now) + RUHE_MONATE * 30 * TAG_MS
    return {
      ...basis,
      station: 'ruht',
      naechsterSchritt: now >= ziel ? 'Ruhe vorbei — neu ansprechen' : 'Ruht',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
    }
  }

  /* Hauptweg: sobald ein Thread existiert, gilt die Postfach-Logik. */

  if (thread) {
    const bucket = bucketOf(thread as LinkedinThread, jetzt)
    if (thread.starred && thread.loom_status === 'offen') {
      return {
        ...basis,
        bucket,
        station: 'loom_offen',
        naechsterSchritt: 'Loom aufnehmen und schicken',
        faelligAm: thread.last_message_at,
        faellig: true,
      }
    }
    if (thread.last_from === 'them') {
      return {
        ...basis,
        bucket,
        station: 'antwort_da',
        naechsterSchritt: 'Antworten',
        faelligAm: thread.last_message_at,
        faellig: true,
      }
    }
    /* Hier endete der Hauptweg bis zum 25.08.2026. `abschluss` heisst: drei
     * Follow-ups sind raus, `followup_stage` ist auf 3 und `bucketOf` hat
     * nichts mehr anzubieten — der Thread lag damit fuer immer unter „Wartet
     * auf Antwort", ohne je wieder faellig zu werden. Genau diese Leute haben
     * die Anfrage aber ANGENOMMEN; sie sind der guenstigste Vorrat, den Kevin
     * hat. Ab jetzt uebernimmt die laute Kette. */
    if (bucket === 'abschluss') {
      return { ...basis, bucket, ...lauteKette(ereignisse, thread.last_message_at, now) }
    }

    const faellig = bucket === 'faellig' || bucket === 'du_bist_dran'
    return {
      ...basis,
      bucket,
      station: 'wartet_auf_antwort',
      naechsterSchritt: faellig ? 'Nachfassen' : 'Wartet auf Antwort',
      faelligAm: thread.last_message_at,
      faellig,
    }
  }

  /* Angenommen, aber noch nie geschrieben — die Erstnachricht steht an. */

  if (!nieAngenommen) {
    const angenommenAm = letztes(ereignisse, ['angenommen'])
    return {
      ...basis,
      station: 'erstnachricht_faellig',
      naechsterSchritt: 'Erstnachricht schreiben',
      faelligAm: angenommenAm ? new Date(angenommenAm).toISOString() : null,
      faellig: true,
    }
  }

  /* Stiller Zweig: nie angenommen. Die Uhr läuft ab der Anfrage. */

  const anfrageAm = letztes(ereignisse, ['anfrage'])
  if (anfrageAm == null) {
    return { ...basis, station: 'anfrage_offen', naechsterSchritt: 'Kein Anfrage-Datum bekannt', faelligAm: null, faellig: false }
  }

  const anrufAm = letztes(ereignisse, ['anruf'])
  const postkarteAm = letztes(ereignisse, ['postkarte'])
  const emailAm = letztes(ereignisse, ['email'])

  if (anrufAm != null) {
    const ziel = anrufAm + RUHE_MONATE * 30 * TAG_MS
    return {
      ...basis,
      station: 'ruht',
      naechsterSchritt: now >= ziel ? 'Ruhe vorbei — neu ansprechen' : 'Kadenz durch, ruht',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
    }
  }

  if (postkarteAm != null) {
    const ziel = mitAbstand(postkarteAm + STILL_ANRUF_TAGE * TAG_MS, ereignisse)
    return {
      ...basis,
      station: 'anruf_faellig',
      naechsterSchritt: 'Anrufen — er kennt dich noch nicht',
      zweig: 'still',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
    }
  }

  if (emailAm != null) {
    const ziel = mitAbstand(emailAm + STILL_POSTKARTE_TAGE * TAG_MS, ereignisse)
    return {
      ...basis,
      station: 'postkarte_faellig',
      naechsterSchritt: 'Postkarte schreiben — er kennt dich noch nicht',
      zweig: 'still',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
    }
  }

  /**
   * Station und Fälligkeit werden getrennt bestimmt — der Unterschied ist für
   * Kevin einer, den er sehen will. Sobald die 30 Tage um sind, IST der Lead in
   * der E-Mail-Stufe („der ist durch, kommt am 26. dran"). Ob er heute dran ist,
   * entscheidet zusätzlich der Mindestabstand. Würde der Abstand die Station
   * mitverschieben, stünde ein längst durchgelaufener Lead wieder unter
   * „Anfrage läuft" und sähe aus, als hoffe er noch auf eine Annahme.
   */
  const emailBasis = anfrageAm + STILL_EMAIL_TAGE * TAG_MS
  const emailZiel = mitAbstand(emailBasis, ereignisse)
  if (now >= emailBasis) {
    return {
      ...basis,
      station: 'email_faellig',
      naechsterSchritt: now >= emailZiel ? 'E-Mail schreiben' : 'E-Mail — wartet auf den Mindestabstand',
      zweig: 'still',
      faelligAm: new Date(emailZiel).toISOString(),
      faellig: now >= emailZiel,
    }
  }

  return {
    ...basis,
    station: 'anfrage_offen',
    naechsterSchritt: 'Wartet auf Annahme',
    faelligAm: new Date(emailZiel).toISOString(),
    faellig: false,
  }
}

/** Wie die Stationen in der Pipeline-Sicht heißen und in welcher Reihenfolge. */
export const STATION_TITEL: Record<Station, string> = {
  anfrage_offen: 'Anfrage läuft',
  erstnachricht_faellig: 'Erstnachricht fällig',
  wartet_auf_antwort: 'Wartet auf Antwort',
  antwort_da: 'Antwort da',
  loom_offen: 'Loom offen',
  instagram_faellig: 'Instagram fällig',
  pdf_faellig: 'Analyse-PDF fällig',
  email_faellig: 'E-Mail fällig',
  postkarte_faellig: 'Postkarte fällig',
  anruf_faellig: 'Anruf fällig',
  wiedervorlage: 'Wiedervorlage',
  ruht: 'Ruht',
  disqualifiziert: 'Aussortiert',
  kunde: 'Kunde',
}

export const STATION_REIHENFOLGE: Station[] = [
  'antwort_da',
  'loom_offen',
  'erstnachricht_faellig',
  'wartet_auf_antwort',
  // Der laute Zweig steht vor dem stillen: Diese Leute haben schon Ja zum
  // Kontakt gesagt, ihre Ausbeute je Handgriff ist die hoechste im Bestand.
  'instagram_faellig',
  'pdf_faellig',
  'email_faellig',
  'postkarte_faellig',
  'anruf_faellig',
  'wiedervorlage',
  'anfrage_offen',
  'ruht',
  'kunde',
  'disqualifiziert',
]
