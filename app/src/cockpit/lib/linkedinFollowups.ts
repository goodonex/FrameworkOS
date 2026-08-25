import type { Contact, LinkedinThread } from '../../types/db'

/**
 * Fälligkeitsregeln für LinkedIn-Follow-ups (Wargame Zug 6,
 * docs/wargames/linkedin-followups.md). Reine Funktionen, keine Netzwerk-Aufrufe —
 * per `npx tsx scripts/verify-linkedin-followups.ts` gegen Fixtures prüfbar.
 *
 * Alle Zeitvergleiche laufen über Millisekunden-Differenzen, nie über
 * Kalendertage — sonst kippt eine Zeitzonen-Stunde ein Follow-up einen Tag früh.
 */

export const FOLLOWUP_THRESHOLDS_DAYS = [3, 7, 14] as const

const DAY_MS = 24 * 60 * 60 * 1000

export type FollowupBucket =
  | 'faellig'
  | 'du_bist_dran'
  | 'wartet'
  | 'pruefen'
  | 'abschluss'
  | 'ruht'

/**
 * **Kein Abstellgleis mehr (Kevins Wort am 14.08.2026).**
 *
 * Bis hierher wanderte ein Thread, den Kevin vor über 30 Tagen geschrieben und
 * nie nachgefasst hatte, in den Bucket `verwaist` — raus aus der Tagesliste,
 * und er kam nie wieder hoch. Gedacht war das als Schutz davor, dass der
 * Rückstau die heute fälligen Threads ertränkt. Praktisch hat es einen Stapel
 * von 109 Threads erzeugt, der nur wachsen konnte.
 *
 * Kevins Regel ist einfacher: **Alles, was aus LinkedIn kommt, wird
 * abgearbeitet. Nichts, was liegen geblieben ist, fällt weg.** Ein alter Thread
 * ist damit schlicht fällig — wie jeder andere auch, nur länger überfällig.
 */

export function isSnoozed(thread: LinkedinThread, now: number): boolean {
  return thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now
}

/** Endzustände: hier ist nichts mehr zu tun. `waiting_reply` gehört bewusst NICHT dazu. */
export function isTerminal(status: LinkedinThread['status']): boolean {
  return status === 'archived' || status === 'won' || status === 'lost'
}

export function isDue(thread: LinkedinThread, now: Date): boolean {
  if (thread.status !== 'active') return false
  if (thread.last_from !== 'me') return false
  if (thread.last_message_at == null) return false
  if (thread.followup_stage > 2) return false
  if (isSnoozed(thread, now.getTime())) return false

  const thresholdDays = FOLLOWUP_THRESHOLDS_DAYS[thread.followup_stage]
  const elapsedMs = now.getTime() - new Date(thread.last_message_at).getTime()
  return elapsedMs >= thresholdDays * DAY_MS
}

/**
 * Der Weg zurück aus dem Schlaf (D2, docs/wargames/technik-fundament.md).
 *
 * `bucketOf === 'ruht'` reicht als Filter NICHT: dort landen auch archivierte,
 * gewonnene und verlorene Threads, und die gehören in keine Weck-Liste. Geweckt
 * wird nur, was Kevin selbst schlafen gelegt hat.
 */
export function istWeckbar(thread: LinkedinThread, now: Date): boolean {
  return isSnoozed(thread, now.getTime()) && !isTerminal(thread.status)
}

export function bucketOf(thread: LinkedinThread, now: Date): FollowupBucket {
  // Nur erledigte/schlafende Threads ruhen. `waiting_reply` darf hier NICHT
  // hineinfallen — das ist genau der Zustand, den der Sync setzt, wenn der Lead
  // geantwortet hat, und der gehört nach `du_bist_dran`.
  if (isTerminal(thread.status)) return 'ruht'
  if (isSnoozed(thread, now.getTime())) return 'ruht'
  // Antwort des Leads schlägt alles andere — auf eine Antwort folgt nie ein
  // Break-up, egal welche Follow-up-Stufe der Thread erreicht hat.
  if (thread.last_from === 'them') return 'du_bist_dran'
  if (thread.followup_stage >= 3) return 'abschluss'
  if (thread.last_from === 'unknown' || thread.last_message_at == null) return 'pruefen'
  // Hier stand die Altlast-Regel (> 30 Tage nie nachgefasst → eigener Bucket,
  // raus aus der Tagesliste). Sie ist am 14.08.2026 gefallen: ein alter Thread
  // ist fällig, nicht erledigt. Siehe Kommentar oben.
  if (isDue(thread, now)) return 'faellig'
  return 'wartet'
}

/** Feld-Änderungen, die ein „Erledigt" auf einem Thread auslöst. */
export type MarkDonePatch = Partial<
  Pick<
    LinkedinThread,
    | 'followup_stage'
    | 'last_from'
    | 'last_message_at'
    | 'snoozed_until'
    | 'status'
    | 'entwurf'
    | 'entwurf_at'
  >
>

/**
 * Was „Erledigt" bedeutet, hängt am Bucket — nicht an der Stufe allein.
 *
 * Vorher zählte der Klick stur `followup_stage + 1` und archivierte ab Stufe 3.
 * Damit wurde ein Lead, der NACH drei Follow-ups antwortet, beim Beantworten
 * still archiviert — der teuerste Fehler im Funnel. `bucketOf` weiß längst, dass
 * eine Antwort alles andere schlägt; diese Regel zieht nach.
 *
 * - Lead hat geantwortet (`du_bist_dran`) → Kevin hat geantwortet: Leiter zurück
 *   auf 0, der Thread lebt weiter. Nie archivieren.
 * - Break-up war fällig (`abschluss`) → archivieren.
 * - Sonst (fällig, Altlast, prüfen) → eine Stufe weiter.
 *
 * Gibt `null` zurück, wenn nichts zu tun ist (Thread schon in einem Endzustand).
 *
 * In jedem Fall wird ein anliegender Entwurf (0065) gelöscht: „Erledigt" heißt,
 * die Nachricht ist raus. Bliebe er stehen, böte die Liste morgen an, dieselbe
 * Nachricht ein zweites Mal zu verschicken.
 */
export function markDonePatch(thread: LinkedinThread, now: Date = new Date()): MarkDonePatch | null {
  if (isTerminal(thread.status)) return null

  const entwurfWeg = { entwurf: null, entwurf_at: null } as const

  if (thread.last_from === 'them') {
    return {
      ...entwurfWeg,
      followup_stage: 0,
      // Kevin hat eben geantwortet — der Sync bestätigt das beim nächsten Lauf,
      // bis dahin zählt die Leiter ab jetzt statt ab der Nachricht des Leads.
      last_from: 'me',
      last_message_at: now.toISOString(),
      snoozed_until: null,
      // 'waiting_reply' würde den Thread aus isDue() aussperren (dort ist
      // 'active' Bedingung) und er käme nie wieder als fällig hoch.
      status: 'active',
    }
  }

  /**
   * **Hier wurde bis zum 25.08.2026 archiviert — das war das Ende der Fahne.**
   *
   * Die Regel stammt aus einer Zeit, in der nach dem dritten Follow-up
   * tatsaechlich nichts mehr kam: LinkedIn durch, also Thread zu. Seit 0078
   * beginnt an genau dieser Stelle die laute Kette (Instagram, Analyse-PDF,
   * Postkarte, Anruf — `leadStation.lauteKette`), und die haengt an
   * `bucketOf(thread) === 'abschluss'`. Ein archivierter Thread ist
   * `isTerminal` und liefert `ruht`: Wer hier archiviert, kappt die neue Kette
   * in dem Moment, in dem sie anfangen soll.
   *
   * Der Thread bleibt deshalb aktiv auf Stufe 3 stehen. Er faellt trotzdem aus
   * jeder LinkedIn-Arbeitsliste heraus, weil `isDue` ab Stufe 3 false liefert
   * und `followupPosten` nur den Bucket `faellig` zeigt — es entsteht also
   * kein Rueckstau im Postfach. Der Zeitstempel wird mitgesetzt, weil er der
   * Anker der lauten Kette ist: Instagram ist sieben Tage nach der letzten
   * LinkedIn-Nachricht dran.
   *
   * Wer einen Thread wirklich schliessen will, hat dafuer weiterhin
   * `status: 'won' | 'lost' | 'archived'` von Hand — das ist eine Aussage
   * ueber den Lead, kein Nebeneffekt des dritten Hakens.
   */
  if (thread.followup_stage >= 3) {
    return { ...entwurfWeg, followup_stage: 3, last_from: 'me', last_message_at: now.toISOString() }
  }

  // O4 (06.08.2026): Der Zeitstempel muss mit. `isDue` rechnet die Frist der
  // nächsten Stufe ab `last_message_at` — blieb der auf der alten Nachricht
  // stehen, war die nächste Stufe oft sofort wieder fällig (Stufe 0→1: die
  // Nachricht war 3+ Tage alt, Schwelle für Stufe 1 sind 7 Tage, die alten
  // Tage zählten also mit). Der Sync zieht die echte Nachricht später nach;
  // bis dahin ist „ab jetzt" die ehrlichere Annahme als „ab damals".
  // `last_from` wird ausdrücklich gesetzt, weil dieser Zweig auch 'unknown'
  // erwischt (Bucket „prüfen") — Kevin hat gerade geschrieben.
  return {
    ...entwurfWeg,
    followup_stage: thread.followup_stage + 1,
    last_from: 'me',
    last_message_at: now.toISOString(),
  }
}

export interface FollowupCoverage {
  faellig: number
  du_bist_dran: number
  wartet: number
  pruefen: number
  abschluss: number
  ruht: number
  /** ICP-Kontakte ohne zugeordneten Thread. */
  nie_angeschrieben: number
  /** Threads ohne zugeordneten Kontakt. */
  ohne_kontakt: number
  /**
   * Wie viele der fälligen Threads schon länger als {@link ALTLAST_AB_TAGEN}
   * liegen. Reine Anzeige-Information („davon 109 Altlasten") — sie werden
   * NICHT aus der Arbeitsliste genommen, sondern stehen ganz oben in ihr.
   */
  altlast: number
}

/** Ab hier nennt die Oberfläche einen fälligen Thread eine Altlast. */
export const ALTLAST_AB_TAGEN = 30

/** Fällig und seit über {@link ALTLAST_AB_TAGEN} Tagen unbewegt. */
export function istAltlast(thread: LinkedinThread, now: Date): boolean {
  if (thread.last_message_at == null) return false
  if (bucketOf(thread, now) !== 'faellig') return false
  return now.getTime() - new Date(thread.last_message_at).getTime() > ALTLAST_AB_TAGEN * DAY_MS
}

/** ICP-Definition (L-4 im Wargame-Ledger, bis Kevin bestätigt): pipeline_stage != 'paused' und linkedin gesetzt. */
function isIcpContact(contact: Contact): boolean {
  return contact.pipeline_stage !== 'paused' && contact.linkedin.trim() !== ''
}

export function coverage(threads: LinkedinThread[], contacts: Contact[], now: Date): FollowupCoverage {
  const out: FollowupCoverage = {
    faellig: 0,
    du_bist_dran: 0,
    wartet: 0,
    pruefen: 0,
    abschluss: 0,
    ruht: 0,
    nie_angeschrieben: 0,
    ohne_kontakt: 0,
    altlast: 0,
  }

  const contactIdsWithThread = new Set<string>()

  for (const t of threads) {
    out[bucketOf(t, now)]++
    // Altlast ist kein eigener Eimer mehr, sondern eine Eigenschaft fälliger
    // Threads — deshalb zusätzlich gezählt, nicht statt `faellig`.
    if (istAltlast(t, now)) out.altlast++
    if (t.contact_id) contactIdsWithThread.add(t.contact_id)
    else out.ohne_kontakt++
  }

  for (const c of contacts) {
    if (isIcpContact(c) && !contactIdsWithThread.has(c.id)) out.nie_angeschrieben++
  }

  return out
}
