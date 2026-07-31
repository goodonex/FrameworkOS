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
  | 'verwaist'
  | 'ruht'

/** Ab hier ist ein nie nachgefasster Thread keine Tagesaufgabe mehr, sondern eine Altlast. */
export const VERWAIST_AB_TAGEN = 30

function isSnoozed(thread: LinkedinThread, now: number): boolean {
  return thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now
}

/** Endzustände: hier ist nichts mehr zu tun. `waiting_reply` gehört bewusst NICHT dazu. */
function isTerminal(status: LinkedinThread['status']): boolean {
  return status === 'archived' || status === 'won' || status === 'lost'
}

/** Von Kevin geschrieben, über 30 Tage her, nie nachgefasst (Stufe unverändert). */
function istVerwaist(thread: LinkedinThread, now: Date): boolean {
  if (thread.last_from !== 'me') return false
  if (thread.followup_stage !== 0) return false
  if (thread.last_message_at == null) return false
  return now.getTime() - new Date(thread.last_message_at).getTime() > VERWAIST_AB_TAGEN * DAY_MS
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
  // Altlast: seit über 30 Tagen liegen gelassen und nie nachgefasst. Das ist
  // keine Tagesaufgabe mehr, sondern eine Handentscheidung — sonst ertränkt der
  // Rückstau die tatsächlich heute fälligen Threads.
  if (istVerwaist(thread, now)) return 'verwaist'
  if (isDue(thread, now)) return 'faellig'
  return 'wartet'
}

/** Feld-Änderungen, die ein „Erledigt" auf einem Thread auslöst. */
export type MarkDonePatch = Partial<
  Pick<LinkedinThread, 'followup_stage' | 'last_from' | 'last_message_at' | 'snoozed_until' | 'status'>
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
 */
export function markDonePatch(thread: LinkedinThread, now: Date = new Date()): MarkDonePatch | null {
  if (isTerminal(thread.status)) return null

  if (thread.last_from === 'them') {
    return {
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

  if (thread.followup_stage >= 3) return { status: 'archived' }

  return { followup_stage: thread.followup_stage + 1 }
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
  /** Altlasten: von Kevin geschrieben, > 30 Tage her, nie nachgefasst. */
  verwaist: number
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
    verwaist: 0,
  }

  const contactIdsWithThread = new Set<string>()

  for (const t of threads) {
    out[bucketOf(t, now)]++
    if (t.contact_id) contactIdsWithThread.add(t.contact_id)
    else out.ohne_kontakt++
  }

  for (const c of contacts) {
    if (isIcpContact(c) && !contactIdsWithThread.has(c.id)) out.nie_angeschrieben++
  }

  return out
}
