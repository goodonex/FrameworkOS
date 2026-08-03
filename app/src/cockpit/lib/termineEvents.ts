import type { Contact } from '../../types/db'

/**
 * Termin-Ereignisse aus den vier Quellen, die das Cockpit kennt. Lag als
 * `eventsByDate` inline in TermineArea; herausgezogen, damit das Heute-Deck
 * (Etappe 3, Schritt 4) dieselben Termine zeigt wie der Kalender — und nicht
 * eine zweite, leicht abweichende Fassung. Reine Funktionen, keine Hooks.
 */

export type EventKind = 'booking' | 'followup' | 'content' | 'external'

export interface CalEvent {
  id: string
  /** YYYY-MM-DD */
  date: string
  time?: string
  kind: EventKind
  title: string
  sub?: string
  href?: string
  muted?: boolean
}

export const KIND_TONE: Record<EventKind, string> = {
  booking: 'var(--ck-accent)',
  followup: 'var(--ck-warn)',
  content: 'var(--ck-idle)',
  external: '#a78bfa',
}

export const KIND_LABEL: Record<EventKind, string> = {
  booking: 'Termin',
  followup: 'Follow-up',
  content: 'Content',
  external: 'Kalender',
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hhmm(iso: string): string | undefined {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function contactLabel(c: Contact): string {
  return c.name?.trim() || c.company?.trim() || c.email?.trim() || 'Kontakt'
}

/** Minimale Formen der vier Quellen — mehr braucht die Ereignis-Bildung nicht. */
export interface EventQuellen {
  bookings: Array<{ id: string; starts_at: string | null; status: string; name: string; contact_id: string | null }>
  contacts: Contact[]
  content: Array<{ id: string; scheduled_at: string | null; published_at: string | null; title: string }>
  kalender: Array<{ id: string; date: string; time?: string; title: string }>
}

/** Alle Ereignisse nach Datum, je Tag nach Uhrzeit sortiert (ohne Zeit ans Ende). */
export function eventsByDate(q: EventQuellen): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>()
  const push = (e: CalEvent) => {
    const arr = map.get(e.date)
    if (arr) arr.push(e)
    else map.set(e.date, [e])
  }

  for (const b of q.bookings) {
    if (!b.starts_at) continue
    const muted = b.status === 'cancelled' || b.status === 'no_show'
    push({
      id: `b-${b.id}`,
      date: b.starts_at.slice(0, 10),
      time: hhmm(b.starts_at),
      kind: 'booking',
      title: b.name || 'Termin',
      sub: b.status === 'cancelled' ? 'abgesagt' : b.status === 'no_show' ? 'No-Show' : undefined,
      href: b.contact_id ? `/sales/${b.contact_id}` : undefined,
      muted,
    })
  }

  for (const c of q.contacts) {
    if (!c.next_follow_up_at || c.pipeline_stage === 'paused') continue
    const typ = c.custom_fields?.next_termin_typ
    push({
      id: `f-${c.id}`,
      date: c.next_follow_up_at.slice(0, 10),
      time: c.next_follow_up_at.length > 10 ? hhmm(c.next_follow_up_at) : undefined,
      kind: 'followup',
      title: contactLabel(c),
      sub: typeof typ === 'string' && typ ? typ : 'Follow-up',
      href: `/sales/${c.id}`,
    })
  }

  for (const p of q.content) {
    if (!p.scheduled_at) continue
    push({
      id: `c-${p.id}`,
      date: p.scheduled_at.slice(0, 10),
      kind: 'content',
      title: p.title || 'Content',
      sub: p.published_at ? 'live' : 'geplant',
      href: '/content',
      muted: Boolean(p.published_at),
    })
  }

  for (const e of q.kalender) {
    push({ id: `x-${e.id}`, date: e.date, time: e.time, kind: 'external', title: e.title })
  }

  for (const arr of map.values()) {
    arr.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  }
  return map
}

/**
 * Die Termine eines Tages. Abgesagte/No-Show-Buchungen bleiben draußen — im
 * Heute-Deck zählt, was wirklich stattfindet.
 */
export function termineAmTag(map: Map<string, CalEvent[]>, tag: string): CalEvent[] {
  return (map.get(tag) ?? []).filter((e) => !e.muted)
}
