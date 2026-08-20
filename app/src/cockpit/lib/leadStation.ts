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
/** Wie lange ein durchlaufener Lead ruht, bevor er von selbst wiederkommt. */
export const RUHE_MONATE = 6
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
const AUSGEHEND: LeadEreignisTyp[] = ['erstnachricht', 'followup', 'inmail', 'email', 'postkarte', 'anruf']

export type Station =
  | 'anfrage_offen'      // eingeladen, noch keine 30 Tage, noch nicht angenommen
  | 'erstnachricht_faellig' // angenommen, noch nie geschrieben
  | 'wartet_auf_antwort' // geschrieben, Follow-ups laufen über bucketOf
  | 'antwort_da'         // die Person hat geantwortet, Kevin ist am Zug
  | 'loom_offen'         // Loom zugesagt, noch nicht geschickt
  | 'email_faellig'      // stiller Zweig, Stufe 1
  | 'postkarte_faellig'  // stiller Zweig, Stufe 2
  | 'anruf_faellig'      // stiller Zweig, Stufe 3
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

export function leadStation(eingabe: LeadStationEingabe, jetzt: Date): StationErgebnis {
  const now = jetzt.getTime()
  const { ereignisse, thread } = eingabe

  const nieAngenommen = !hat(ereignisse, 'angenommen')
  const imInmailPool = nieAngenommen && !hat(ereignisse, 'inmail') && !thread

  const basis = { bucket: null as FollowupBucket | null, imInmailPool }

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
      naechsterSchritt: 'Anrufen',
      faelligAm: new Date(ziel).toISOString(),
      faellig: now >= ziel,
    }
  }

  if (emailAm != null) {
    const ziel = mitAbstand(emailAm + STILL_POSTKARTE_TAGE * TAG_MS, ereignisse)
    return {
      ...basis,
      station: 'postkarte_faellig',
      naechsterSchritt: 'Postkarte schreiben',
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
  'email_faellig',
  'postkarte_faellig',
  'anruf_faellig',
  'wiedervorlage',
  'anfrage_offen',
  'ruht',
  'kunde',
  'disqualifiziert',
]
