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
      })
    }
    return out
  } catch {
    return []
  }
}

/** Wartende Kontakte für Follow-ups: Stage follow_up ODER fälliger next_follow_up_at. */
export function dueFollowupContacts(contacts: Contact[], max = 10): Contact[] {
  const now = new Date().toISOString()
  return contacts
    .filter(
      (c) =>
        c.pipeline_stage !== 'paused' &&
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
