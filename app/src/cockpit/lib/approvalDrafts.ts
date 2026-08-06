import type { Contact, LinkedinThread } from '../../types/db'

/**
 * Approval-Queue (IDEAS-2026 A1, v1 migrationsfrei): der followup-entwuerfe-Agent
 * hängt an sein Markdown einen maschinenlesbaren JSON-Block; die App liest den
 * fertigen Run, zeigt Freigabe-Karten und versendet E-Mail-Entwürfe über die
 * bestehende sendEmail-Kette (DM-Entwürfe → Kopieren). Nichts persistiert —
 * die Entwürfe leben, bis der Run erneut läuft.
 */

export type DraftChannel = 'email' | 'linkedin' | 'instagram' | 'other'

export interface FollowupDraft {
  contact_id: string
  channel: DraftChannel
  /** Nur bei E-Mail relevant. */
  subject?: string
  message: string
  /**
   * Anzeigename, wenn kein CRM-Kontakt dahinterhängt (LinkedIn-Threads ohne
   * `contact_id`) — sonst stünde auf der Freigabe-Karte nur „Unbekannter Kontakt".
   */
  name?: string
  /**
   * LinkedIn-Thread, zu dem der Entwurf gehört. Erst damit kann der Entwurf am
   * Posten kleben statt nur in der Freigaben-Queue zu liegen (Etappe 3,
   * Schritt 3) — `contact_id` trägt das nicht, die ist bei Threads meist null.
   */
  thread_key?: string
}

function coerceChannel(x: unknown): DraftChannel {
  const s = String(x ?? '').toLowerCase()
  if (s.includes('mail')) return 'email'
  if (s.includes('linkedin') || s === 'li') return 'linkedin'
  if (s.includes('insta') || s === 'ig') return 'instagram'
  return 'other'
}

/**
 * Extrahiert die strukturierten Entwürfe aus dem Run-Markdown: sucht den letzten
 * ```json-Block mit { "drafts": [...] }. Fehlerhaft/kein Block → leere Liste.
 */
export function parseDrafts(content: string): FollowupDraft[] {
  if (!content) return []
  const blocks = [...content.matchAll(/```json\s*([\s\S]*?)```/g)]
  const raw = blocks.length ? blocks[blocks.length - 1][1] : null
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { drafts?: unknown }
    const arr = Array.isArray(parsed.drafts) ? parsed.drafts : []
    const out: FollowupDraft[] = []
    for (const d of arr) {
      if (!d || typeof d !== 'object') continue
      const rec = d as Record<string, unknown>
      // contact_id kann fehlen (z. B. LinkedIn-Thread ohne zugeordneten CRM-Kontakt) —
      // das ist der Normalfall dort, kein Grund den Entwurf zu verwerfen.
      const contactId = typeof rec.contact_id === 'string' ? rec.contact_id : ''
      const message = typeof rec.message === 'string' ? rec.message : ''
      if (!message) continue
      out.push({
        contact_id: contactId,
        channel: coerceChannel(rec.channel),
        subject: typeof rec.subject === 'string' ? rec.subject : undefined,
        message,
        name: typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : undefined,
        thread_key:
          typeof rec.thread_key === 'string' && rec.thread_key.trim() ? rec.thread_key.trim() : undefined,
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Wer hinter einem Entwurf steht — quer über Runs hinweg (O5, 06.08.2026).
 *
 * Die Freigaben-Queue liest nicht mehr nur den jüngsten Run, damit ein
 * unbearbeiteter Entwurf den nächsten Lauf überlebt. Dabei darf derselbe Lead
 * nicht doppelt auf dem Tisch liegen: Der Agent baut ihn in jedem Lauf neu,
 * solange das Follow-up offen ist. `thread_key` ist die stärkste Kennung,
 * `contact_id` die zweite; der Name ist die letzte Rückfallebene für
 * LinkedIn-Threads ohne CRM-Kontakt.
 *
 * Bewusst NICHT die Nachricht selbst: der Agent formuliert bei jedem Lauf neu,
 * sonst stünde derselbe Mensch zweimal in der Liste.
 */
export function draftIdentitaet(d: FollowupDraft): string {
  const kern = d.thread_key || d.contact_id || (d.name ?? '').trim().toLowerCase()
  return `${d.channel}::${kern}`
}

/**
 * Stufen, die überhaupt ein Kunden-/Deal-Follow-up auslösen dürfen (O2, 06.08.2026).
 * `first_contact` fehlt bewusst: ein noch nicht angesprochener Kontakt gehört in den
 * LinkedIn-Funnel (`linkedin_threads`), nicht in die Freigaben-Queue — sonst schickt
 * diese Queue echte E-Mails an kalte Recherche-Leads. `paused` ist ohnehin still.
 */
const FOLLOWUP_STAGES: ReadonlySet<Contact['pipeline_stage']> = new Set([
  'conversation',
  'follow_up',
  'proposal',
  'deal',
])

/**
 * Darf dieser Kontakt überhaupt ein Follow-up aus der Queue bekommen?
 *
 * Zweimal gebraucht, und das ist Absicht: beim **Erzeugen** eines Runs (welche
 * Kontakte der Agent sieht) und beim **Anzeigen** der Karten. Ohne den zweiten
 * Ort taucht ein Entwurf, den ein älterer Run vor der Entscheidung gebaut hat,
 * seit O5 wieder in der Queue auf — mit Sende-Knopf.
 */
export function darfFollowupErhalten(contact: Contact): boolean {
  return FOLLOWUP_STAGES.has(contact.pipeline_stage)
}

/**
 * Wartende Kontakte für Follow-ups: Stage follow_up ODER fälliger next_follow_up_at —
 * beides nur innerhalb der Kunden-/Deal-Welt (siehe FOLLOWUP_STAGES).
 */
export function dueFollowupContacts(contacts: Contact[], max = 10): Contact[] {
  const now = new Date().toISOString()
  return contacts
    .filter(
      (c) =>
        darfFollowupErhalten(c) &&
        (c.pipeline_stage === 'follow_up' ||
          (c.next_follow_up_at != null && c.next_follow_up_at <= now)),
    )
    .slice(0, max)
}

/**
 * Baut den Agenten-Input für followup-entwuerfe. Enthält jetzt id/email/channel,
 * damit der Agent contact_id + Kanal zurückspiegeln kann (→ Freigabe-Karten).
 */
export function buildFollowupInput(contacts: Contact[]): { contacts: Array<Record<string, unknown>> } {
  return {
    contacts: dueFollowupContacts(contacts).map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email || null,
      channel: c.email ? 'email' : 'linkedin',
      stage: c.pipeline_stage,
      lastContact: c.stage_changed_at ?? null,
      nextFollowUp: c.next_follow_up_at,
      notes: c.entscheider_name ? `Entscheider: ${c.entscheider_name}` : null,
    })),
  }
}

/**
 * Baut den Agenten-Input für linkedin-followup-entwuerfe (Wargame Zug 8,
 * docs/wargames/linkedin-followups.md). `contact_id` bleibt `null`, wenn der
 * Thread keinem CRM-Kontakt zugeordnet ist — parseDrafts lässt das zu.
 */
export function buildLinkedinFollowupInput(
  threads: LinkedinThread[],
  now: Date = new Date(),
): { threads: Array<Record<string, unknown>> } {
  return {
    threads: threads.map((t) => ({
      thread_key: t.thread_key,
      contact_id: t.contact_id,
      name: t.name,
      company: t.company,
      profile_url: t.profile_url,
      preview: t.preview,
      tage_seit_kontakt:
        t.last_message_at != null
          ? Math.floor((now.getTime() - new Date(t.last_message_at).getTime()) / (24 * 60 * 60 * 1000))
          : null,
      followup_stage: t.followup_stage,
    })),
  }
}
